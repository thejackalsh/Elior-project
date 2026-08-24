import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Camera, useCameraDevice, useFrameProcessor, type CameraRuntimeError, type Orientation, type TakeSnapshotOptions, type PhotoFile } from 'react-native-vision-camera'
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite'
import { useResizePlugin } from 'vision-camera-resize-plugin'
import { useSharedValue, useRunOnJS } from 'react-native-worklets-core'
import { NitroModules } from 'react-native-nitro-modules'
import { Asset } from 'expo-asset'
import {
  type LocalizerBox,
  decodeLocalizer,
  LOCALIZER_IMG_SIZE,
  LOCALIZER_PAD,
} from '../services/rupiah/RupiahLocalizerService'
import {
  decodeClassifier,
  majorityVote,
  CLASSIFIER_IMG_SIZE,
  CLASSIFIER_PAD,
  CLASSIFIER_CROP_MARGIN,
} from '../services/rupiah/RupiahClassifierService'
import {
  computeLetterboxFit,
  packLetterboxTensor,
  inverseLetterboxBox,
  inverseOrientationBox,
  computeCropRect,
  type RotationDeg,
} from '../services/rupiah/letterboxTensor'

// Live real-time deteksi uang: frame processor jalan tiap frame di worklet thread,
// preview kamera TETAP live (bukan snapshot/capture). Stage-1 (localizer, tiap frame
// throttled) cari bbox; stage-2 (classifier, gated stabil+throttle) baca nominal.
// Hasil dikirim ke JS thread via runOnJS → parent urus overlay/TTS/history.
//
// TfliteModel (Nitro HybridObject/jsi::NativeState) tidak bisa diakses langsung dari
// VisionCamera v4 worklet runtime — wajib box() di JS thread, unbox() di worklet
// (lihat react-native-fast-tflite README "Usage (VisionCamera)").

export type UangDetectorState = 'loading' | 'ready' | 'error'

export interface UangDetectorHandle {
  takeSnapshot: (options?: TakeSnapshotOptions) => Promise<PhotoFile>
}

// Release build: require() resolve ke Android resource name tanpa protocol
// ("assets_models_xxx"), bikin nitro HybridAssetLoader lempar MalformedURLException.
// Load via expo-asset (localUri file:// yang valid) sebagai fix-nya.
function useModelFromAsset(moduleId: number) {
  const [model, setModel] = useState<TfliteModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const asset = Asset.fromModule(moduleId)
        await asset.downloadAsync()
        if (!asset.localUri) throw new Error('Asset model tidak ditemukan')
        const m = await loadTensorflowModel({ url: asset.localUri }, [])
        if (!cancelled) setModel(m)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [moduleId])
  return { model, error }
}

interface Props {
  facing: 'back' | 'front'
  torch: boolean
  speaking: boolean
  // Default true — parent set false saat app di background / drawer hasil
  // terbuka, supaya frame processor + 2 model TFLite berhenti (hemat baterai/panas).
  isActive?: boolean
  onBox: (box: LocalizerBox | null, frameW: number, frameH: number) => void
  onNominal: (labelIdx: number, score: number, box: LocalizerBox) => void
  onStateChange: (state: UangDetectorState, error: string | null) => void
}

// Keputusan produk (2026-07-31): dinaikkan dari 0.85. Kalibrasi notebook v16
// cell 52 (test set 2.227 sampel): threshold 0.85 -> coverage 85,9%/akurasi
// 0,9995; threshold 0.90 -> coverage 61,4%/akurasi 1,0000. Trade-off yang
// diterima: ~38,6% scan TIDAK diumumkan sama sekali (naik dari ~14,1%), TANPA
// umpan balik suara saat ditolak — user tidak diberi tahu harus mengulang.
// Alasan: kalibrasi OOD (koin Rp50 tanpa kelas, dll) belum pernah dikerjakan
// di notebook v16, ambang tinggi jadi penangkal kasar. Jangan turunkan balik
// ke 0.85 tanpa keputusan produk baru yang eksplisit.
const NOMINAL_CONF_GATE = 0.90
const NOMINAL_COOLDOWN_MS = 3000

// ── Tangga adaptif 3-tingkat ─────────────────────────────────────────────────
// IDLE: belum ada apa pun di frame. Localizer mengintip pelan (hemat baterai/panas).
// CANDIDATE: localizer kena sesuatu tapi belum yakin — box TIDAK ditampilkan.
//   Confidence harus TERBUKTI stabil-atau-naik (bukan turun) & di atas
//   CONFIRM_CONF_GATE, 2x berturut (bukan cuma "kena sekali") sebelum
//   dipromosikan ke LOCK — dibandingkan ke poll SEBELUMNYA, bukan rekor
//   tertinggi (confidence detektor nyata berfluktuasi di sekitar plateau,
//   tidak memanjat monoton). False positive (kartu/HP/dompet) dibuang di sini,
//   bukan ikut menaikkan rate poll. Kalau langsung confidence tinggi (uang jelas),
//   ada jalur pintas lewat STRONG_CONF_GATE — tidak perlu menimbang dulu.
// LOCK: box dikunci & ditampilkan, localizer dipercepat (posisi akurat penting
//   buat crop classifier), classifier jalan tiap tick, voting 3-frame + early-exit,
//   announce → balik ke IDLE. Timeout supaya tidak nyangkut di 15fps kalau
//   classifier tak pernah lolos gate (uang ambigu/rusak/koin Rp50 tanpa kelas).
// Classifier TIDAK PERNAH jalan paralel dengan localizer — keduanya sekuensial
// dalam 1 blok worklet yang sama, cuma dipanggil di fase LOCK.
const TIER_IDLE = 0
const TIER_CANDIDATE = 1
const TIER_LOCK = 2

const IDLE_INTERVAL_MS = 300      // ~3,3fps — mengintip
const CANDIDATE_INTERVAL_MS = 200 // ~5fps — menimbang, belum yakin
const LOCK_INTERVAL_MS = 66       // ~15fps — sudah yakin, kunci posisi

const IDLE_CONF_GATE = 0.35       // longgar, cuma "ada sesuatu" -> masuk CANDIDATE
const CONFIRM_CONF_GATE = 0.6     // syarat naik ke LOCK lewat tangga 2-hit
const STRONG_CONF_GATE = 0.85     // bukti sudah kuat -> LOCK langsung, lewati tangga
const CONF_RISE_EPS = 0.02        // kenaikan minimal supaya dihitung "membaik"
const CANDIDATE_RISE_HITS = 2     // 2x membaik berturut -> promosi ke LOCK
const CANDIDATE_MAX_POLLS = 5     // jatah poll di CANDIDATE sebelum nyerah
const CANDIDATE_BACKOFF_MS = 1000 // nyerah -> jangan masuk CANDIDATE lagi selama ini
                                   // (anti ping-pong buat false positive keras kepala)

const LOCK_LOST_FRAMES = 5        // box tak ketemu berturut sebanyak ini -> balik IDLE
const LOCK_TIMEOUT_MS = 5000      // guard anti-nyangkut: classifier tak pernah lolos gate

const VOTE_FRAMES = 3             // klasifikasi maks 3x back-to-back, majority vote
// Diturunkan dari 0.95 (2026-07-31): di 0.95 coverage cuma 4,8% dari sampel
// yang lolos gate (tabel kalibrasi cell 52) — early-exit praktis tidak pernah
// kepakai. Di 0.92, sekitar separuh sampel yang lolos NOMINAL_CONF_GATE (0.90)
// juga memenuhi ini, jadi optimasinya benar-benar hidup.
const VOTE_EARLY_EXIT_SCORE = 0.92 // 2 vote sepakat & keduanya >= ini -> terima, hemat 1 run

// Frame.orientation degrees (lihat types/Orientation.d.ts) match 1:1 dengan
// resize-plugin rotation enum — dipakai buat counter-rotate frame ke upright
// sebelum masuk model (model dilatih dari gambar upright).
const ORIENTATION_ROTATION: Record<Orientation, RotationDeg> = {
  'portrait': '0deg',
  'landscape-left': '90deg',
  'portrait-upside-down': '180deg',
  'landscape-right': '270deg',
}

const UangDetector = forwardRef<UangDetectorHandle, Props>(function UangDetector(
  { facing, torch, speaking, isActive = true, onBox, onNominal, onStateChange }: Props,
  ref,
) {
  const device = useCameraDevice(facing)
  const cameraRef = useRef<Camera>(null)
  const localizer = useModelFromAsset(require('../assets/models/localizer_v4.tflite'))
  const classifier = useModelFromAsset(require('../assets/models/classifier_v16.tflite'))
  const { resize } = useResizePlugin()

  useImperativeHandle(ref, () => ({
    takeSnapshot: (options) => {
      if (!cameraRef.current) return Promise.reject(new Error('Kamera belum siap'))
      return cameraRef.current.takeSnapshot(options)
    },
  }), [])

  const localizerModel = localizer.model
  const classifierModel = classifier.model

  // Box HybridObject supaya bisa dipakai (unbox) di worklet thread yang terpisah.
  const boxedLocalizer = useMemo(() => (localizerModel != null ? NitroModules.box(localizerModel) : undefined), [localizerModel])
  const boxedClassifier = useMemo(() => (classifierModel != null ? NitroModules.box(classifierModel) : undefined), [classifierModel])

  const speakingSV = useSharedValue(speaking)
  useEffect(() => { speakingSV.value = speaking }, [speaking, speakingSV])

  // State tier + stage-2 (vote/cooldown) — shared value supaya persist antar
  // frame di worklet runtime tanpa bergantung semantik closure re-render React.
  const tierSV = useSharedValue(TIER_IDLE)
  const lastLocalizerAtSV = useSharedValue(0)
  const lockLostCountSV = useSharedValue(0)
  const lockEnteredAtSV = useSharedValue(0)
  const lastConfSV = useSharedValue(0)
  const candidatePollsSV = useSharedValue(0)
  const riseHitsSV = useSharedValue(0)
  const backoffUntilSV = useSharedValue(0)
  const voteASV = useSharedValue(-1)
  const voteBSV = useSharedValue(-1)
  const voteCSV = useSharedValue(-1)
  const voteScoreASV = useSharedValue(0)
  const voteScoreBSV = useSharedValue(0)
  const voteScoreCSV = useSharedValue(0)
  const voteCountSV = useSharedValue(0)
  const lastLabelIdxSV = useSharedValue(-1)
  const nominalCooldownUntilSV = useSharedValue(0)

  const reportBox = useRunOnJS(onBox, [onBox])
  const reportNominal = useRunOnJS(onNominal, [onNominal])
  const reportState = useRunOnJS(onStateChange, [onStateChange])

  // Tanpa handler ini, kegagalan sesi kamera (mis. camera-already-in-use saat
  // pindah dari expo-camera) cuma bikin layar hitam tanpa pesan apa pun.
  const handleCameraError = useCallback((e: CameraRuntimeError) => {
    onStateChange('error', `Kamera bermasalah (${e.code}). Coba lagi.`)
  }, [onStateChange])

  useEffect(() => {
    if (!device) { onStateChange('error', 'Kamera tidak tersedia di perangkat ini'); return }
    if (localizer.error != null) { onStateChange('error', localizer.error || 'Gagal memuat model deteksi'); return }
    if (classifier.error != null) { onStateChange('error', classifier.error || 'Gagal memuat model klasifikasi'); return }
    if (localizerModel != null && classifierModel != null) { onStateChange('ready', null); return }
    onStateChange('loading', null)
  }, [device, localizer.error, classifier.error, localizerModel, classifierModel, onStateChange])

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    if (boxedLocalizer == null || boxedClassifier == null) return
    const localizerModel = boxedLocalizer.unbox()
    const classifierModel = boxedClassifier.unbox()

    // resetToIdle/finishVote: closure lokal biasa (BUKAN worklet terpisah — cuma
    // helper dalam scope worklet frame processor yang sama, tidak pernah dikirim
    // lintas thread sendiri). Dikumpulkan di sini, didefinisikan SEBELUM dipakai
    // (bukan mengandalkan hoisting function declaration), supaya tidak ada jalur
    // keluar yang lupa reset sebagian state (bug lama: cooldown return tanpa
    // reset fase, tetap LOCK 66ms, classifier jalan lagi).
    const resetToIdle = () => {
      tierSV.value = TIER_IDLE
      lockLostCountSV.value = 0
      candidatePollsSV.value = 0
      riseHitsSV.value = 0
      lastConfSV.value = 0
      voteCountSV.value = 0
    }

    // Interval + gate berubah per-tier — tidak bisa pakai runAtTargetFps (fps
    // fix) buat itu, gating manual by timestamp.
    const now = Date.now()
    const tier = tierSV.value
    const interval = tier === TIER_LOCK ? LOCK_INTERVAL_MS : tier === TIER_CANDIDATE ? CANDIDATE_INTERVAL_MS : IDLE_INTERVAL_MS
    if (now - lastLocalizerAtSV.value < interval) return
    lastLocalizerAtSV.value = now

    // IDLE dengan backoff aktif (baru saja nyerah dari CANDIDATE, atau baru
    // announce) — diam total, jangan jalankan localizer sama sekali.
    if (tier === TIER_IDLE && now < backoffUntilSV.value) return

    try {
      const rotation = ORIENTATION_ROTATION[frame.orientation]
      const swaps = rotation === '90deg' || rotation === '270deg'
      const uprightW = swaps ? frame.height : frame.width
      const uprightH = swaps ? frame.width : frame.height

      // ── Stage 1: localizer (full frame, counter-rotated ke upright) ──
      const { nw, nh } = computeLetterboxFit(uprightW, uprightH, LOCALIZER_IMG_SIZE)
      // resize-plugin: crop -> scale -> rotate (native pipeline order), jadi scale
      // target harus di-swap balik supaya HASIL setelah rotate = nw×nh upright.
      const scaleW = swaps ? nh : nw
      const scaleH = swaps ? nw : nh
      const pixels = resize(frame, {
        scale: { width: scaleW, height: scaleH },
        rotation,
        pixelFormat: 'rgb',
        dataType: 'uint8',
      })
      // normalize=false: localizer v4 memanggang ImageNet norm ke graph ekspor
      // sendiri (LocalizerExportWrapper) — kirim RGB 0..1 mentah. JANGAN normalize
      // di sini, itu double-normalize (gagal senyap, box jadi sampah tanpa error).
      const tensor = packLetterboxTensor(pixels, nw, nh, LOCALIZER_IMG_SIZE, LOCALIZER_PAD, false)
      const outputs = localizerModel.runSync([tensor.buffer as ArrayBuffer])
      const raw = new Float32Array(outputs[0] as ArrayBuffer)
      // Gate longgar di luar LOCK — IDLE/CANDIDATE cuma menimbang, LOCK pakai
      // threshold ketat baku (box di sini SUDAH dipercaya, dipakai buat crop).
      const gate = tier === TIER_LOCK ? undefined : IDLE_CONF_GATE
      const rawBox = decodeLocalizer(raw, gate)

      if (!rawBox) {
        if (tier === TIER_LOCK) {
          lockLostCountSV.value += 1
          // Uang lepas dari frame beberapa kali berturut — balik ke IDLE
          // (localizer pelan lagi, box disembunyikan).
          if (lockLostCountSV.value >= LOCK_LOST_FRAMES) {
            resetToIdle()
            reportBox(null, uprightW, uprightH)
          }
        } else if (tier === TIER_CANDIDATE) {
          // Miss jujur (bukan false positive keras kepala) — balik IDLE tanpa
          // backoff, boleh langsung coba lagi tick berikutnya.
          resetToIdle()
        }
        return
      }
      if (tier === TIER_LOCK) lockLostCountSV.value = 0

      const boxFrac = inverseLetterboxBox(rawBox, nw, nh, LOCALIZER_IMG_SIZE, uprightW, uprightH)
      const box: LocalizerBox = { ...boxFrac, confidence: rawBox.confidence }

      // finishVote: announce + cooldown + reset ke IDLE. Didefinisikan di sini
      // (sebelum dipakai — tidak mengandalkan hoisting) supaya bisa dipanggil
      // dari jalur early-exit vote maupun jalur normal tanpa duplikasi logika
      // cooldown. Closure biasa atas box/uprightW/uprightH di scope try ini.
      const finishVote = (winnerIdx: number, avgScore: number) => {
        const t = Date.now()
        if (winnerIdx === lastLabelIdxSV.value && t < nominalCooldownUntilSV.value) {
          // Uang yang sama masih dalam cooldown — jangan announce ulang, dan
          // JANGAN tetap di LOCK (bug lama: classifier jalan lagi 66ms
          // kemudian, berulang ~15x/detik). Diam sampai cooldown habis.
          resetToIdle()
          backoffUntilSV.value = nominalCooldownUntilSV.value
          reportBox(null, uprightW, uprightH)
          return
        }
        lastLabelIdxSV.value = winnerIdx
        nominalCooldownUntilSV.value = t + NOMINAL_COOLDOWN_MS

        reportNominal(winnerIdx, avgScore, box)

        // Announce selesai — balik ke IDLE (localizer pelan lagi, box sembunyi)
        // sampai ada uang baru masuk frame.
        resetToIdle()
        reportBox(null, uprightW, uprightH)
      }

      // ── Tier IDLE: hit pertama — JANGAN buang, evaluasi langsung sbg poll
      // CANDIDATE pertama di frame yang SAMA (localizer sudah jalan & box sudah
      // di tangan; membuangnya berarti 1 siklus penuh IDLE_INTERVAL_MS hangus
      // tanpa alasan). Sengaja tidak `return` di sini — jatuh ke blok CANDIDATE.
      let effectiveTier = tier
      if (tier === TIER_IDLE) {
        tierSV.value = TIER_CANDIDATE
        lastConfSV.value = 0
        candidatePollsSV.value = 0
        riseHitsSV.value = 0
        effectiveTier = TIER_CANDIDATE
      }

      let promoted = false
      if (effectiveTier === TIER_CANDIDATE) {
        if (rawBox.confidence >= STRONG_CONF_GATE) {
          // Jalur pintas: bukti sudah kuat, tidak ada yang perlu ditimbang.
          promoted = true
        } else {
          candidatePollsSV.value += 1
          // Dibandingkan ke poll SEBELUMNYA (bukan rekor tertinggi) — confidence
          // detektor nyata berfluktuasi di sekitar plateau, tidak memanjat
          // monoton. Menuntut "harus naik dari rekor tertinggi" bikin uang di
          // rentang 0.6-0.85 gagal dipromosikan meski confidence-nya stabil
          // (audit: delay acak 2-4 detik). Sekarang "stabil ATAU naik" cukup.
          const notWorse = rawBox.confidence >= lastConfSV.value - CONF_RISE_EPS
          lastConfSV.value = rawBox.confidence
          if (notWorse && rawBox.confidence >= CONFIRM_CONF_GATE) {
            riseHitsSV.value += 1
            if (riseHitsSV.value >= CANDIDATE_RISE_HITS) promoted = true
          } else {
            // Confidence di bawah gate ATAU memburuk: streak direset. Ini pusat
            // aturan "jangan dispam kalau belum naik akurasinya" — rate TIDAK
            // dinaikkan di sini.
            riseHitsSV.value = 0
          }
          if (!promoted && candidatePollsSV.value >= CANDIDATE_MAX_POLLS) {
            // Nyerah — kemungkinan besar false positive (kartu/HP/dompet).
            // Backoff supaya tidak langsung ping-pong balik ke CANDIDATE.
            tierSV.value = TIER_IDLE
            backoffUntilSV.value = Date.now() + CANDIDATE_BACKOFF_MS
            candidatePollsSV.value = 0
            riseHitsSV.value = 0
            lastConfSV.value = 0
          }
        }
        if (!promoted) return // masih menimbang di CANDIDATE — box TIDAK dilaporkan
      }

      // ── Promosi ke LOCK — box dari localizer run yang SAMA dipakai langsung,
      // sengaja TIDAK `return` di sini supaya classify jalan di frame ini juga
      // (menunggu 66ms lagi tidak menambah kualitas, box sudah final).
      if (promoted) {
        tierSV.value = TIER_LOCK
        lockEnteredAtSV.value = Date.now()
        lockLostCountSV.value = 0
        voteCountSV.value = 0
      }

      // ── Tier LOCK ──
      reportBox(box, uprightW, uprightH)

      if (Date.now() - lockEnteredAtSV.value > LOCK_TIMEOUT_MS) {
        // Guard anti-nyangkut: classifier tak pernah lolos gate 0,85 (uang
        // ambigu/rusak/koin tanpa kelas) — jangan poll 15fps selamanya.
        resetToIdle()
        reportBox(null, uprightW, uprightH)
        return
      }
      if (speakingSV.value) {
        // Jangan poll 15fps selama TTS bicara — box tetap dilaporkan di atas
        // (posisi terakhir tetap ditampilkan), cuma classify yang berhenti.
        // lockLostCountSV direset supaya tidak bawa hitungan basi kalau LOCK
        // di-re-enter cepat sesudah ini (premature "lost" trigger kalau tidak).
        tierSV.value = TIER_IDLE
        lockLostCountSV.value = 0
        return
      }

      // ── Stage 2: classifier (crop). resize-plugin crop rect = RAW (pre-rotasi)
      // pixel space (native pipeline crop dulu baru rotate) → box perlu di-inverse
      // dulu ke raw-frame fraction sebelum dipakai hitung crop rect. Classifier
      // sekuensial setelah localizer di blok yang sama — tidak pernah paralel.
      const rawBoxFrac = inverseOrientationBox(boxFrac, rotation)
      const cropRect = computeCropRect(rawBoxFrac, frame.width, frame.height, CLASSIFIER_CROP_MARGIN)
      if (!cropRect) return

      const cropUprightW = swaps ? cropRect.height : cropRect.width
      const cropUprightH = swaps ? cropRect.width : cropRect.height
      const fit = computeLetterboxFit(cropUprightW, cropUprightH, CLASSIFIER_IMG_SIZE)
      const cropScaleW = swaps ? fit.nh : fit.nw
      const cropScaleH = swaps ? fit.nw : fit.nh
      const cropPixels = resize(frame, {
        crop: cropRect,
        scale: { width: cropScaleW, height: cropScaleH },
        rotation,
        pixelFormat: 'rgb',
        dataType: 'uint8',
      })
      // normalize default true — classifier v16 TIDAK bake normalisasi ke graph
      // (beda dari localizer v4 di atas), tetap butuh ImageNet normalize manual.
      const cropTensor = packLetterboxTensor(cropPixels, fit.nw, fit.nh, CLASSIFIER_IMG_SIZE, CLASSIFIER_PAD)
      const clsOutputs = classifierModel.runSync([cropTensor.buffer as ArrayBuffer])
      const clsRaw = new Float32Array(clsOutputs[0] as ArrayBuffer)
      const decoded = decodeClassifier(clsRaw)
      if (!decoded || decoded.score < NOMINAL_CONF_GATE) return

      // ── Voting back-to-back dengan early-exit ──
      const voteCount = voteCountSV.value
      if (voteCount === 0) {
        voteASV.value = decoded.labelIdx
        voteScoreASV.value = decoded.score
      } else if (voteCount === 1) {
        voteBSV.value = decoded.labelIdx
        voteScoreBSV.value = decoded.score
        // 2 vote sepakat & keduanya sangat yakin → terima sekarang, hemat 1 run.
        if (voteASV.value === voteBSV.value && voteScoreASV.value >= VOTE_EARLY_EXIT_SCORE && voteScoreBSV.value >= VOTE_EARLY_EXIT_SCORE) {
          finishVote(voteASV.value, (voteScoreASV.value + voteScoreBSV.value) / 2)
          return
        }
      } else {
        voteCSV.value = decoded.labelIdx
        voteScoreCSV.value = decoded.score
      }
      voteCountSV.value = voteCount + 1
      if (voteCountSV.value < VOTE_FRAMES) return

      const winner = majorityVote(voteASV.value, voteBSV.value, voteCSV.value)
      voteCountSV.value = 0
      if (winner == null) return // 3 label beda, tidak ada mayoritas — ulang voting frame berikutnya

      // Rata-rata score dari vote yang cocok dengan pemenang — BUKAN score
      // klasifikasi terakhir (bisa milik kelas yang justru kalah vote, angka
      // itu masuk DB sebagai confidence dan ditampilkan ke user).
      let scoreSum = 0
      let scoreN = 0
      if (voteASV.value === winner) { scoreSum += voteScoreASV.value; scoreN++ }
      if (voteBSV.value === winner) { scoreSum += voteScoreBSV.value; scoreN++ }
      if (voteCSV.value === winner) { scoreSum += voteScoreCSV.value; scoreN++ }
      finishVote(winner, scoreN > 0 ? scoreSum / scoreN : decoded.score)
    } catch (e) {
      // runSync bisa throw (native inference gagal) — jangan biarkan worklet
      // crash diam-diam, surface sebagai error state (banner + auto-retry di camera.tsx).
      reportState('error', 'Deteksi uang gagal, mencoba lagi...')
    }
  }, [boxedLocalizer, boxedClassifier, resize, reportBox, reportNominal, reportState])

  // Mount kamera hanya setelah kedua model siap — frame processor jadi stabil
  // dari frame pertama, tidak ada re-attach pipeline di tengah sesi (model load
  // async selesai ~1-2s setelah mount, dulu bikin FP identity berubah 2x).
  if (!device || boxedLocalizer == null || boxedClassifier == null) return null

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      torch={torch ? 'on' : 'off'}
      frameProcessor={frameProcessor}
      onError={handleCameraError}
      accessible={false}
    />
  )
})

export default UangDetector
