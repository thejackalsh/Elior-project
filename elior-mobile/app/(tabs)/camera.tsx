import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
} from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  AppState,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Audio } from 'expo-av'
import { CameraView } from 'expo-camera'
import { useKeepAwake } from 'expo-keep-awake'
import { Ionicons, Octicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import { useCamera } from '../../hooks/useCamera'
import { useAnalyze } from '../../hooks/useAnalyze'
import { useTTS } from '../../hooks/useTTS'

import { useHaptics } from '../../hooks/useHaptics'
import { useAccessibility } from '../../hooks/useAccessibility'
import { EliorText } from '../../components/ui'
import { useDrawerContext } from '../../contexts/ResultDrawerContext'
import { usePindaiContext } from '../../contexts/PindaiContext'
import { useAuth } from '../../contexts/AuthContext'
import { useTts } from '../../contexts/TtsContext'
import * as ImageManipulator from 'expo-image-manipulator'
import { saveMemory } from '../../services/memory'
import UangDetector, { type UangDetectorState, type UangDetectorHandle } from '../../components/UangDetector'
import { type LocalizerBox } from '../../services/rupiah/RupiahLocalizerService'
import { buildRupiahPrediction, type RupiahPrediction } from '../../services/rupiah/RupiahClassifierService'
import { computeCropRect } from '../../services/rupiah/letterboxTensor'
import { serviceConfig } from '../../config'
import { colors, spacing, radius, PINDAI_BAR_H } from '../../constants/theme'


const TAB_CONTENT_HEIGHT = 56
const SCAN_LIMIT_KEY = '@elior_scan_limit_until'
const SPEED_MIN = 0.5
const SPEED_MAX = 10.0
const SPEED_STEP = 0.2
const QR_WARNING = 'Waspada saat memindai kode QR. Jangan memberikan data atau informasi pribadi.'
const UANG_AUTO_RETRY_MAX = 3
// Sama persis dengan CLASSIFIER_CROP_MARGIN (services/rupiah/RupiahClassifierService.ts)
// — gambar history sengaja dibuat identik dengan crop yang benar-benar dilihat
// classifier, supaya bisa dipakai audit kalau prediksi salah (dulu 0.30, lebih
// longgar "biar enak dilihat", tapi itu bikin gambar tersimpan tidak merepresentasikan
// input model sama sekali).
const THUMBNAIL_CROP_MARGIN = 0.12
// Konstanta throttle stage-2 (stable/classify/cooldown) sekarang di components/UangDetector.tsx —
// gating jalan di worklet, bukan di JS thread.

const CATEGORY_SHORT: Record<string, string> = {
  ocr: 'Teks',
  rupiah: 'Rupiah',
  object: 'Objek',
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function formatCountdown(until: Date): string {
  const diff = until.getTime() - Date.now()
  if (diff <= 0) return 'sekarang'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h} jam${m > 0 ? ` ${m} menit` : ''}`
  return `${m || 1} menit`
}

// Preview vision-camera default-nya "cover" (fill+crop), sementara box localizer
// adalah fraksi dari FULL FRAME. Kalau aspect frame != aspect view, mapping % mentah
// akan meleset (ini akar "bbox ngawur" lama). Hitung offset crop dulu sebelum konversi.
function mapBoxToView(
  box: { cx: number; cy: number; w: number; h: number },
  frame: { w: number; h: number } | null,
  view: { w: number; h: number } | null,
): { left: number; top: number; width: number; height: number } {
  if (!frame || !view || frame.w <= 0 || frame.h <= 0 || view.w <= 0 || view.h <= 0) {
    return {
      left: Math.max(0, box.cx - box.w / 2),
      top: Math.max(0, box.cy - box.h / 2),
      width: box.w,
      height: box.h,
    }
  }
  const coverScale = Math.max(view.w / frame.w, view.h / frame.h)
  const displayedW = frame.w * coverScale
  const displayedH = frame.h * coverScale
  const offsetX = (displayedW - view.w) / 2
  const offsetY = (displayedH - view.h) / 2

  const x1 = (box.cx - box.w / 2) * displayedW - offsetX
  const y1 = (box.cy - box.h / 2) * displayedH - offsetY
  const width = box.w * displayedW
  const height = box.h * displayedH

  return {
    left: Math.max(0, x1 / view.w),
    top: Math.max(0, y1 / view.h),
    width: width / view.w,
    height: height / view.h,
  }
}

// ── Speed Tap Control ───────────────────────────────────────────────────────

function SpeedTapControl({
  rate,
  onDecrease,
  onIncrease,
}: {
  rate: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <View style={tapS.wrap}>
      <TouchableOpacity
        style={[tapS.btn, rate <= SPEED_MIN && tapS.btnDisabled]}
        onPress={onDecrease}
        disabled={rate <= SPEED_MIN}
        accessibilityRole="button"
        accessibilityLabel="Kurangi kecepatan"
        activeOpacity={0.65}
      >
        <Text style={[tapS.btnText, rate <= SPEED_MIN && tapS.btnTextDisabled]}>−</Text>
      </TouchableOpacity>

      <Text style={tapS.rateText}>{rate.toFixed(1)}×</Text>

      <TouchableOpacity
        style={[tapS.btn, rate >= SPEED_MAX && tapS.btnDisabled]}
        onPress={onIncrease}
        disabled={rate >= SPEED_MAX}
        accessibilityRole="button"
        accessibilityLabel="Tambah kecepatan"
        activeOpacity={0.65}
      >
        <Text style={[tapS.btnText, rate >= SPEED_MAX && tapS.btnTextDisabled]}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const tapS = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
  },
  btnTextDisabled: {
    color: 'rgba(255,255,255,0.2)',
  },
  rateText: {
    minWidth: 72,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 28,
    letterSpacing: 1,
  },
})


// ── Camera Screen ────────────────────────────────────────────────────────────

export default function CameraScreen() {
  // Layar kamera saja yang perlu tetap terang (bukan app-wide) — halaman lain boleh tidur.
  useKeepAwake()
  const { cameraRef, state: camState, error: camError, startCamera, captureFrame } =
    useCamera()
  const { analyze, state: analyzeState, result, error: analyzeError, reset } =
    useAnalyze()
  const { speak, stop: stopTTS, speaking } = useTTS()
  const { say, rate: speechRate, setRate: setSpeechRate, autoSpeakPref } = useTts()
  const { tapMedium, resultReady, error: hapticError } = useHaptics()
  const { announce } = useAccessibility()
  const { data: drawerData, show: showDrawer, hide: hideDrawer, setSpeaking: setCtxSpeaking, registerCallbacks } = useDrawerContext()
  const { register: registerPindai, setLoading: setPindaiLoading, mode: pindaiMode, toggleMode, canScan, scanDailyLimit, incrementScanCount } = usePindaiContext()
  const { token, visionStatus } = useAuth()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()

  // Gate auto-suara: pakai autoSpeakPref jika sudah diset user (onboarding baru).
  // Fallback ke visionStatus untuk user lama yang belum lewat layar tts-preference.
  const autoSpeak = useCallback((text: string, opts?: { rate?: number }) => {
    const shouldSpeak = autoSpeakPref !== null ? autoSpeakPref : visionStatus !== 'tidak_ada'
    if (shouldSpeak) speak(text, opts)
  }, [autoSpeakPref, visionStatus, speak])
  const tabBarHeight = TAB_CONTENT_HEIGHT + insets.bottom

  const [trackBox, setTrackBox] = useState<LocalizerBox | null>(null)
  const [uangResult, setUangResult] = useState<RupiahPrediction | null>(null)
  const uangResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ukuran view kamera (onLayout) + frame sumber (dari UangDetector) — dipakai buat
  // koreksi cover-crop overlay bbox (lihat mapBoxToView di bawah).
  const [cameraViewSize, setCameraViewSize] = useState<{ w: number; h: number } | null>(null)
  const [uangFrameSize, setUangFrameSize] = useState<{ w: number; h: number } | null>(null)
  // Ref paralel ke uangFrameSize state di atas — dibaca dari captureRupiahThumbnail
  // (bukan state) supaya deps callback itu tetap [] dan frame processor TIDAK
  // di-re-create saat dimensi frame pertama kali diketahui (UangDetector.tsx
  // sengaja menjaga identitas frame processor stabil sejak mount; deps state
  // di sini dulu bikin churn sekali tepat di momen deteksi pertama — audit).
  const uangFrameSizeRef = useRef<{ w: number; h: number } | null>(null)
  const uangDetectorRef = useRef<UangDetectorHandle>(null)
  const cameraLockRef = useRef(false)
  const analyzeStateRef = useRef(analyzeState)

  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'info' } | null>(null)
  const [rateLimitUntil, setRateLimitUntil] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState('')
  const [speedExpanded, setSpeedExpanded] = useState(false)
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [uangState, setUangState] = useState<UangDetectorState>('loading')
  const [uangError, setUangError] = useState<string | null>(null)
  const [uangRetryKey, setUangRetryKey] = useState(0)
  const uangAutoRetryCountRef = useRef(0)
  const [torch, setTorch] = useState(false)
  const [qrResult, setQrResult] = useState<{ value: string; isUrl: boolean } | null>(null)
  const qrLockRef = useRef(false)
  const speechRateRef = useRef(1.0)
  const lastUriRef = useRef<string | null>(null)
  const analyzeStartRef = useRef<number>(0)
  const [isOnline, setIsOnline] = useState(true)
  const [justCameOnline, setJustCameOnline] = useState(false)
  const wasOnlineRef = useRef(true)
  const onlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [appActive, setAppActive] = useState(true)

  // Mode uang jalankan 2 model TFLite terus-menerus — pause begitu app di
  // background atau drawer hasil terbuka, supaya tidak boros baterai/panas percuma.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active')
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    speechRateRef.current = speechRate
  }, [speechRate])

  useEffect(() => {
    analyzeStateRef.current = analyzeState
  }, [analyzeState])

  // Clear tracking box saat keluar mode uang
  useEffect(() => {
    if (pindaiMode !== 'uang') {
      setTrackBox(null)
      setUangFrameSize(null)
    }
  }, [pindaiMode])

  // Callback dari UangDetector — jalan di JS thread (via runOnJS), frame processor
  // real-time jalan terus di worklet selama mode uang aktif (bukan snapshot).
  const handleUangBox = useCallback((box: LocalizerBox | null, frameW: number, frameH: number) => {
    setTrackBox(box)
    uangFrameSizeRef.current = { w: frameW, h: frameH }
    setUangFrameSize(prev => (prev && prev.w === frameW && prev.h === frameH) ? prev : { w: frameW, h: frameH })
  }, [])

  // Snapshot + crop best-effort setelah nominal terdeteksi — dipanggil di JS thread
  // (bukan worklet), jadi ada jeda ~1-2 frame vs box yang diklasifikasi. Trade-off yang
  // diterima: crop pakai koordinat box yang sama persis dipakai classifier, cuma
  // pikselnya diambil sedikit belakangan lewat takeSnapshot() alih-alih transfer
  // buffer piksel mentah lintas worklet->JS thread (lebih berisiko, belum pernah dicoba).
  const captureRupiahThumbnail = useCallback(async (box: LocalizerBox): Promise<string | undefined> => {
    try {
      const snap = await uangDetectorRef.current?.takeSnapshot({ quality: 80 })
      if (!snap) return undefined
      const rawUri = snap.path.startsWith('file://') ? snap.path : `file://${snap.path}`
      const upright = await ImageManipulator.manipulateAsync(rawUri, [], { format: ImageManipulator.SaveFormat.JPEG })
      // TEMP DEBUG — verifikasi asumsi bahwa takeSnapshot() punya aspect ratio SAMA
      // dengan frame processor (uangFrameSize). Kalau beda, crop thumbnail melenceng
      // dari bbox yang ditampilkan. Hapus log ini setelah dikonfirmasi sama; kalau
      // ternyata beda, baru tulis koreksi center-crop (jangan ditulis sebelum terbukti).
      const frameSize = uangFrameSizeRef.current
      if (frameSize) {
        const snapRatio = upright.width / upright.height
        const frameRatio = frameSize.w / frameSize.h
        if (Math.abs(snapRatio - frameRatio) > 0.02) {
          console.warn('[captureRupiahThumbnail] aspect ratio MISMATCH', {
            snapshot: `${upright.width}x${upright.height}`,
            frameProcessor: `${frameSize.w}x${frameSize.h}`,
            snapRatio, frameRatio,
          })
        }
      }
      const rect = computeCropRect(box, upright.width, upright.height, THUMBNAIL_CROP_MARGIN)
      if (!rect) return upright.uri
      const cropped = await ImageManipulator.manipulateAsync(
        upright.uri,
        [{ crop: { originX: rect.x, originY: rect.y, width: rect.width, height: rect.height } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      )
      return cropped.uri
    } catch (e) {
      console.warn('[captureRupiahThumbnail]', e instanceof Error ? e.message : String(e))
      return undefined
    }
  }, [])

  const handleUangNominal = useCallback((labelIdx: number, score: number, box: LocalizerBox) => {
    const pred = buildRupiahPrediction(labelIdx, score)
    if (!pred) return
    incrementScanCount()
    resultReady()
    autoSpeak(pred.textLengkap, { rate: speechRateRef.current })
    setUangResult(pred)
    if (uangResultTimerRef.current) clearTimeout(uangResultTimerRef.current)
    uangResultTimerRef.current = setTimeout(() => setUangResult(null), 5000)
    if (token) {
      captureRupiahThumbnail(box).then(imageUri => {
        saveMemory(token, {
          category: 'rupiah',
          text: pred.text,
          confidence: pred.confidence,
          imageUri,
        }).then(res => {
          if (res.rateLimitUntil) {
            setRateLimitUntil(res.rateLimitUntil)
            setCountdown(formatCountdown(res.rateLimitUntil))
            AsyncStorage.setItem(SCAN_LIMIT_KEY, res.rateLimitUntil.toISOString())
          }
        })
      })
    }
  }, [token, incrementScanCount, resultReady, autoSpeak, captureRupiahThumbnail])

  const handleUangState = useCallback((state: UangDetectorState, error: string | null) => {
    setUangState(state)
    setUangError(error)
    if (state === 'ready') uangAutoRetryCountRef.current = 0
  }, [])

  const handleUangRetry = useCallback(() => {
    setUangRetryKey(k => k + 1)
  }, [])

  // Auto-recover kalau model/kamera error — user tidak perlu tap manual untuk
  // glitch sesaat. Setelah UANG_AUTO_RETRY_MAX percobaan gagal, baru tampilkan
  // tombol "Coba lagi" manual (banner sudah selalu tampil, tombolnya yang digate).
  useEffect(() => {
    if (uangState !== 'error') return
    if (uangAutoRetryCountRef.current >= UANG_AUTO_RETRY_MAX) return
    const t = setTimeout(() => {
      uangAutoRetryCountRef.current += 1
      handleUangRetry()
    }, 1500)
    return () => clearTimeout(t)
  }, [uangState, uangError, handleUangRetry])

  // Load rate limit dari storage saat mount
  useEffect(() => {
    AsyncStorage.getItem(SCAN_LIMIT_KEY).then(val => {
      if (!val) return
      const until = new Date(val)
      if (until.getTime() > Date.now()) {
        setRateLimitUntil(until)
        setCountdown(formatCountdown(until))
      } else {
        AsyncStorage.removeItem(SCAN_LIMIT_KEY)
      }
    })
  }, [])

  // Mainkan chime saat app pertama buka
  useEffect(() => {
    let sound: Audio.Sound | null = null
    Audio.Sound.createAsync(
      require('../../assets/chrysalyn-cheerful-traditional-harp-positive-ui-alert-540977.mp3'),
      { volume: 0.7 },
    ).then(({ sound: s }) => {
      sound = s
      s.playAsync()
    }).catch(() => {})
    return () => { sound?.unloadAsync() }
  }, [])

  // Deteksi koneksi internet via ping backend — cuma banner online/offline
  // (bukan fitur inti), jadi berhenti total saat app di background supaya
  // tidak bangunin radio terus-menerus percuma.
  useEffect(() => {
    if (!appActive) return
    const ping = async () => {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 3000)
        await fetch(`${serviceConfig.authUrl}/config`, { signal: ctrl.signal })
        clearTimeout(t)
        if (!wasOnlineRef.current) {
          wasOnlineRef.current = true
          setIsOnline(true)
          setJustCameOnline(true)
          if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current)
          onlineTimerRef.current = setTimeout(() => setJustCameOnline(false), 5000)
        }
      } catch {
        if (wasOnlineRef.current) {
          wasOnlineRef.current = false
          setIsOnline(false)
          setJustCameOnline(false)
          if (onlineTimerRef.current) { clearTimeout(onlineTimerRef.current); onlineTimerRef.current = null }
        }
      }
    }
    ping()
    const interval = setInterval(ping, 5_000)
    return () => {
      clearInterval(interval)
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current)
    }
  }, [appActive])

  // Saat limit dinonaktifkan (0), bersihkan rate limit yang tersimpan
  useEffect(() => {
    if (scanDailyLimit === 0) {
      setRateLimitUntil(null)
      setCountdown('')
      AsyncStorage.removeItem(SCAN_LIMIT_KEY)
    }
  }, [scanDailyLimit])

  // Update countdown setiap menit, bersihkan saat expired
  useEffect(() => {
    if (!rateLimitUntil) return
    setCountdown(formatCountdown(rateLimitUntil))
    const id = setInterval(() => {
      if (rateLimitUntil.getTime() <= Date.now()) {
        setRateLimitUntil(null)
        setCountdown('')
        AsyncStorage.removeItem(SCAN_LIMIT_KEY)
        clearInterval(id)
      } else {
        setCountdown(formatCountdown(rateLimitUntil))
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [rateLimitUntil])

  const showMsg = useCallback((text: string, type: 'error' | 'info' = 'error') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }, [])

  useEffect(() => {
    startCamera()
    announce('ELIOR siap.')
  }, [])

  useEffect(() => {
    if (camError) { showMsg(camError); announce(camError) }
  }, [camError])

  useEffect(() => {
    if (analyzeError) {
      hapticError()
      showMsg(analyzeError)
      announce(analyzeError)
      autoSpeak(analyzeError, { rate: speechRateRef.current })
    }
  }, [analyzeError])

  // Sync speaking state to drawer context
  useEffect(() => { setCtxSpeaking(speaking) }, [speaking, setCtxSpeaking])

  useEffect(() => {
    if (analyzeState === 'success' && result) {
      incrementScanCount()
      resultReady()
      autoSpeak(result.text, { rate: speechRateRef.current })
      showDrawer({
        category: result.category,
        text: result.text,
        confidence: result.confidence,
        imageUri: lastUriRef.current ?? undefined,
        bbox: result.bbox,
        durationMs: analyzeStartRef.current > 0 ? Date.now() - analyzeStartRef.current : undefined,
      })

      // Simpan ke memori (best-effort) — skip kalau tidak ada deteksi valid
      const failureTexts = ['Uang tidak terdeteksi', 'Tidak ada teks yang terdeteksi']
      if (token && !failureTexts.includes(result.text)) {
        saveMemory(token, {
          category: result.category,
          text: result.text,
          confidence: result.confidence,
          ocrText: result.category === 'ocr' ? result.text : undefined,
          imageUri: lastUriRef.current ?? undefined,
        }).then(res => {
          if (res.rateLimitUntil) {
            setRateLimitUntil(res.rateLimitUntil)
            setCountdown(formatCountdown(res.rateLimitUntil))
            AsyncStorage.setItem(SCAN_LIMIT_KEY, res.rateLimitUntil.toISOString())
          }
        })
      }
    }
  }, [analyzeState, result])

  const handleBarcode = useCallback((data: string) => {
    if (qrLockRef.current || pindaiMode !== 'qr') return
    const value = data.trim()
    if (!value) return
    qrLockRef.current = true
    const isUrl = /^(https?:\/\/|www\.)/i.test(value)
    resultReady()
    setQrResult({ value, isUrl })
    const spoken = isUrl ? `Tautan terdeteksi. ${value}` : `Kode QR. ${value}`
    announce(spoken)
    autoSpeak(spoken, { rate: speechRateRef.current })
  }, [pindaiMode, resultReady, announce, autoSpeak])

  const handleOpenQr = useCallback(() => {
    if (!qrResult) return
    const url = qrResult.value.startsWith('www.') ? `https://${qrResult.value}` : qrResult.value
    Linking.openURL(url).catch(() => showMsg('Tidak dapat membuka tautan'))
  }, [qrResult, showMsg])

  const handleCloseQr = useCallback(() => {
    setQrResult(null)
    qrLockRef.current = false
    stopTTS()
  }, [stopTTS])

  const handleCloseUangResult = useCallback(() => {
    if (uangResultTimerRef.current) clearTimeout(uangResultTimerRef.current)
    setUangResult(null)
  }, [])

  useEffect(() => {
    return () => { if (uangResultTimerRef.current) clearTimeout(uangResultTimerRef.current) }
  }, [])

  const handleCapture = useCallback(async () => {
    if (analyzeState === 'loading') return
    if (!canScan) {
      const msg = `Batas scan harian (${scanDailyLimit}) tercapai. Coba lagi besok.`
      showMsg(msg)
      announce(msg)
      autoSpeak(msg, { rate: speechRateRef.current })
      return
    }
    if (pindaiMode === 'objek' && scanDailyLimit > 0 && rateLimitUntil && rateLimitUntil.getTime() > Date.now()) {
      const msg = `Limit scan objek tercapai. Tersedia lagi dalam ${formatCountdown(rateLimitUntil)}`
      showMsg(msg)
      announce(msg)
      return
    }
    if (pindaiMode === 'objek' && !isOnline) {
      // Mode objek butuh backend — jangan buang waktu ambil gambar kalau sudah
      // tahu offline dari ping loop; kasih tahu langsung (TTS + visual).
      hapticError()
      const msg = 'Anda sedang offline. Mode objek butuh koneksi internet.'
      showMsg(msg)
      announce(msg)
      autoSpeak(msg, { rate: speechRateRef.current })
      return
    }
    if (pindaiMode === 'uang') return  // realtime detection handles uang mode
    if (pindaiMode === 'qr') {
      tapMedium()
      announce('Arahkan kamera ke kode QR')
      autoSpeak('Arahkan kamera ke kode QR', { rate: speechRateRef.current })
      return
    }
    stopTTS()
    hideDrawer()
    reset()
    setTrackBox(null)
    tapMedium()
    announce('Memindai...')
    autoSpeak('Memindai', { rate: speechRateRef.current })
    cameraLockRef.current = true
    const frame = await captureFrame()
    cameraLockRef.current = false
    if (!frame) {
      hapticError()
      showMsg('Tidak dapat mengambil gambar dari kamera')
      announce('Tidak dapat mengambil gambar dari kamera')
      return
    }
    lastUriRef.current = frame.uri
    analyzeStartRef.current = Date.now()
    await analyze(frame.base64, frame.uri, pindaiMode)
  }, [analyzeState, pindaiMode, isOnline, stopTTS, reset, captureFrame, analyze, tapMedium, announce])

  const handleRepeatFrom = useCallback((fromText: string) => {
    speak(fromText, { rate: speechRateRef.current })
  }, [speak])

  const handleFlip = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'))
  }, [])

  useEffect(() => {
    registerCallbacks({ stop: stopTTS, repeatFrom: handleRepeatFrom })
  }, [stopTTS, handleRepeatFrom, registerCallbacks])

  useEffect(() => {
    registerPindai({ scan: handleCapture, flip: handleFlip })
  }, [registerPindai, handleCapture, handleFlip])

  // Sync loading state to PindaiBar
  useEffect(() => {
    setPindaiLoading(analyzeState === 'loading')
  }, [analyzeState, setPindaiLoading])

  // Announce connectivity change via TTS
  const connAnnouncedRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (connAnnouncedRef.current === null) {
      connAnnouncedRef.current = isOnline
      return
    }
    if (connAnnouncedRef.current === isOnline) return
    connAnnouncedRef.current = isOnline
    say(isOnline ? 'Terhubung kembali' : 'Tidak ada koneksi internet', { force: true })
  }, [isOnline, say])

  const isMountedRef = useRef(false)
  useEffect(() => {
    // Reset state QR tiap ganti mode
    setQrResult(null)
    qrLockRef.current = false
    if (!isMountedRef.current) { isMountedRef.current = true; return }
    // Cut TTS lama tanpa syarat — autoSpeak() no-op kalau autoSpeakPref/visionStatus
    // mematikan auto-suara, jadi stop tidak boleh cuma jadi efek samping speak() baru.
    stopTTS()
    const label = pindaiMode === 'uang' ? 'Mode uang' : pindaiMode === 'baca' ? 'Mode baca' : pindaiMode === 'objek' ? 'Mode objek' : 'Mode QR'
    showMsg(label, 'info')
    const speech = pindaiMode === 'qr'
      ? `${label}. ${QR_WARNING}`
      : label
    autoSpeak(speech, { rate: speechRateRef.current })
  }, [pindaiMode])

  const facingMountedRef = useRef(false)
  useEffect(() => {
    if (!facingMountedRef.current) { facingMountedRef.current = true; return }
    const label = facing === 'front' ? 'Kamera depan' : 'Kamera belakang'
    showMsg(label, 'info')
    autoSpeak(label, { rate: speechRateRef.current })
  }, [facing])

  const handleSpeedDown = useCallback(() => {
    const next = parseFloat(Math.max(SPEED_MIN, speechRateRef.current - SPEED_STEP).toFixed(1))
    setSpeechRate(next)
    say(`Kecepatan ${next.toFixed(1).replace('.', ',')}`, { force: true })
  }, [setSpeechRate, say])

  const handleSpeedUp = useCallback(() => {
    const next = parseFloat(Math.min(SPEED_MAX, speechRateRef.current + SPEED_STEP).toFixed(1))
    setSpeechRate(next)
    say(`Kecepatan ${next.toFixed(1).replace('.', ',')}`, { force: true })
  }, [setSpeechRate, say])

  const isLoading = analyzeState === 'loading'

  const statusText = isLoading
    ? 'Memindai...'
    : result && analyzeState === 'success'
    ? CATEGORY_SHORT[result.category] ?? ''
    : ''

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.eliorTitle}>Elior</Text>
          {statusText.length > 0 && (
            <Text style={styles.statusText}>{statusText}</Text>
          )}
        </View>

        {/* Divider */}
        <View style={styles.headerDivider} />

        {/* Flash + Speed row */}
        <View style={styles.controlRow}>
          {/* Flash */}
          <TouchableOpacity
            style={[styles.controlBtn, torch && styles.controlBtnActive]}
            onPress={() => { say(!torch ? 'Senter nyala' : 'Senter mati'); setTorch(t => !t) }}
            accessibilityRole="button"
            accessibilityLabel={torch ? 'Senter mati' : 'Senter nyala'}
          >
            <Octicons
              name={(torch ? 'sparkle-fill' : 'sparkle') as any}
              size={16}
              color={torch ? '#ffffff' : 'rgba(255,255,255,0.5)'}
            />
            <Text style={[styles.controlBtnLabel, torch && styles.controlBtnLabelActive]}>
              Senter
            </Text>
          </TouchableOpacity>

          {/* Speed */}
          <TouchableOpacity
            style={[styles.controlBtn, speedExpanded && styles.controlBtnActive]}
            onPress={() => {
              const next = !speedExpanded
              setSpeedExpanded(next)
              say(next ? `Kecepatan Baca ${speechRate.toFixed(1).replace('.', ',')}` : 'Tutup kecepatan', { force: true })
            }}
            accessibilityRole="button"
            accessibilityLabel={`Kecepatan Baca ${speechRate.toFixed(1)}x`}
          >
            <Ionicons
              name={'speedometer-outline' as IoniconName}
              size={16}
              color={speedExpanded ? colors.text : 'rgba(255,255,255,0.5)'}
            />
            <Text style={[styles.controlBtnLabel, speedExpanded && styles.controlBtnLabelActive]}>
              Kecepatan Baca
            </Text>
            <Text style={styles.speedBtnRate}>{speechRate.toFixed(1)}×</Text>
          </TouchableOpacity>
        </View>

        {speedExpanded && (
          <>
            <View style={styles.sliderDivider} />
            <SpeedTapControl
              rate={speechRate}
              onDecrease={handleSpeedDown}
              onIncrease={handleSpeedUp}
            />
          </>
        )}

      </View>

      {/* ── Camera area ── */}
      <View
        style={styles.cameraArea}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setCameraViewSize(prev => (prev && prev.w === width && prev.h === height) ? prev : { w: width, h: height })
        }}
      >
        {camState === 'active' && pindaiMode === 'uang' && isFocused && (
          <UangDetector
            ref={uangDetectorRef}
            key={uangRetryKey}
            facing={facing}
            torch={torch}
            speaking={speaking}
            isActive={appActive && !drawerData && isFocused}
            onBox={handleUangBox}
            onNominal={handleUangNominal}
            onStateChange={handleUangState}
          />
        )}
        {camState === 'active' && pindaiMode !== 'uang' && isFocused && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={torch}
            accessible={false}
            importantForAccessibility="no"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={
              pindaiMode === 'qr' && !qrResult
                ? ({ data }) => handleBarcode(data)
                : undefined
            }
          />
        )}

        {isLoading && <View style={styles.loadingOverlay} />}

        {/* ── Localizer tracking box (mode uang, live) ── */}
        {pindaiMode === 'uang' && trackBox && (() => {
          const mapped = mapBoxToView(trackBox, uangFrameSize, cameraViewSize)
          return (
            <View
              pointerEvents="none"
              style={[
                styles.trackBox,
                {
                  left: `${mapped.left * 100}%`,
                  top: `${mapped.top * 100}%`,
                  width: `${mapped.width * 100}%`,
                  height: `${mapped.height * 100}%`,
                },
              ]}
            >
              <Text style={styles.trackBoxLabel}>{Math.round(trackBox.confidence * 100)}%</Text>
            </View>
          )
        })()}

        {/* ── QR safety warning (floating, di atas kamera, tidak menutupi pengaturan) ── */}
        {pindaiMode === 'qr' && (
          <View
            style={styles.qrWarning}
            pointerEvents="none"
            accessibilityRole="alert"
            accessibilityLabel={QR_WARNING}
          >
            <Ionicons name={'warning-outline' as IoniconName} size={16} color="#000000" />
            <Text style={styles.qrWarningText}>{QR_WARNING}</Text>
          </View>
        )}

        {/* ── Model loading banner (mode uang) ── */}
        {pindaiMode === 'uang' && uangState === 'loading' && (
          <View style={styles.modelBanner} pointerEvents="none">
            <Ionicons name={'cloud-download-outline' as IoniconName} size={13} color="#ffffff" />
            <Text style={styles.modelBannerText}>Memuat model deteksi uang...</Text>
          </View>
        )}
        {pindaiMode === 'uang' && uangState === 'error' && (
          <View style={[styles.modelBanner, styles.modelBannerError]} pointerEvents="box-none">
            <Ionicons name={'warning-outline' as IoniconName} size={13} color="#ff9500" />
            <Text style={[styles.modelBannerText, styles.modelBannerErrorText]}>
              {uangAutoRetryCountRef.current < UANG_AUTO_RETRY_MAX
                ? 'Mencoba lagi otomatis...'
                : (uangError ?? 'Gagal memuat model')}
            </Text>
            {uangAutoRetryCountRef.current >= UANG_AUTO_RETRY_MAX && (
              <TouchableOpacity onPress={() => { uangAutoRetryCountRef.current = 0; handleUangRetry() }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.modelBannerRetry}>Coba lagi</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Connectivity banner ── */}
        {!isOnline && (
          <View style={styles.connBanner} pointerEvents="none">
            <Ionicons name={'cloud-offline-outline' as IoniconName} size={13} color="rgba(255,255,255,0.5)" />
            <Text style={styles.connText}>Tidak ada koneksi internet</Text>
          </View>
        )}
        {isOnline && justCameOnline && (
          <View style={[styles.connBanner, styles.connBannerOnline]} pointerEvents="none">
            <Ionicons name={'cloud-done-outline' as IoniconName} size={13} color="#00c853" />
            <Text style={[styles.connText, styles.connTextOnline]}>Terhubung kembali</Text>
          </View>
        )}

        {/* ── Rate limit banner ── */}
        {pindaiMode === 'objek' && scanDailyLimit > 0 && rateLimitUntil && rateLimitUntil.getTime() > Date.now() && (
          <View style={styles.rateLimitBanner} pointerEvents="none">
            <Ionicons name={'time-outline' as IoniconName} size={13} color="#ff9500" />
            <Text style={styles.rateLimitText}>
              Limit scan objek tercapai · Tersedia dalam {countdown}
            </Text>
          </View>
        )}

        {/* ── QR floating pill (ala Google Lens) ── */}
        {qrResult && (
          <View style={styles.qrFloatWrap} pointerEvents="box-none">
            <View style={styles.qrFloat}>
              <TouchableOpacity
                style={styles.qrFloatMain}
                onPress={qrResult.isUrl ? handleOpenQr : undefined}
                disabled={!qrResult.isUrl}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  qrResult.isUrl
                    ? `Tautan ${qrResult.value}, ketuk untuk buka`
                    : `Kode QR: ${qrResult.value}`
                }
              >
                <View style={styles.qrFloatIcon}>
                  <Ionicons
                    name={(qrResult.isUrl ? 'link' : 'qr-code') as IoniconName}
                    size={18}
                    color="#1a1a1a"
                  />
                </View>
                <View style={styles.qrFloatTextWrap}>
                  <Text style={styles.qrFloatTop}>
                    {qrResult.isUrl ? 'Ketuk untuk buka' : 'Kode QR'}
                  </Text>
                  <Text style={styles.qrFloatValue} numberOfLines={1}>{qrResult.value}</Text>
                </View>
                {qrResult.isUrl && (
                  <Ionicons name={'open-outline' as IoniconName} size={18} color="#1a73e8" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qrFloatClose}
                onPress={handleCloseQr}
                accessibilityRole="button"
                accessibilityLabel="Tutup, pindai lagi"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={'close' as IoniconName} size={18} color="#5f6368" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Uang result floating pill (auto-close 5s), ala QR pill ── */}
        {uangResult && (
          <View style={styles.qrFloatWrap} pointerEvents="box-none">
            <View style={styles.qrFloat}>
              <View style={styles.qrFloatMain}>
                <View style={styles.qrFloatIcon}>
                  <Ionicons name={'cash-outline' as IoniconName} size={18} color="#1a1a1a" />
                </View>
                <View style={styles.qrFloatTextWrap}>
                  <Text style={styles.qrFloatTop}>Terdeteksi · {uangResult.confidencePercent}</Text>
                  <Text style={styles.qrFloatValue} numberOfLines={1}>{uangResult.text}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.qrFloatClose}
                onPress={handleCloseUangResult}
                accessibilityRole="button"
                accessibilityLabel="Tutup hasil deteksi uang"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={'close' as IoniconName} size={18} color="#5f6368" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Spacer for absolute tab bar */}
      <View style={{ height: tabBarHeight }} />

      {/* Message banner — centered in camera area */}
      {msg && (
        <View
          style={[styles.msgOverlay, { bottom: tabBarHeight + PINDAI_BAR_H }]}
          pointerEvents="none"
        >
          <View
            style={[styles.msgBanner, msg.type === 'info' && styles.msgBannerInfo]}
            accessible
            accessibilityLiveRegion="assertive"
            accessibilityLabel={msg.text}
          >
            <EliorText variant="caption" style={[styles.msgText, msg.type === 'info' && styles.msgTextInfo]}>{msg.text}</EliorText>
          </View>
        </View>
      )}


    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Header ──
  header: {
    backgroundColor: colors.bg,
    zIndex: 10,
  },
  titleSection: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  eliorTitle: {
    fontFamily: 'Telma-Medium',
    fontSize: 36,
    color: colors.text,
    letterSpacing: 4,
  },
  statusText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
  },
  controlBtnActive: {
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  controlBtnLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  controlBtnLabelActive: {
    color: colors.text,
  },
  speedBtnRate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    letterSpacing: 1,
  },
  sliderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: spacing.md,
  },
  qrWarning: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 30,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  qrWarningText: {
    flex: 1,
    color: '#000000',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.2,
  },

  // ── Camera ──
  cameraArea: {
    flex: 1,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  rateLimitBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,149,0,0.15)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,149,0,0.4)',
    zIndex: 30,
  },
  rateLimitText: {
    flex: 1,
    fontSize: 11,
    color: '#ff9500',
    letterSpacing: 0.3,
  },

  // ── Error banner ──
  msgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  msgBanner: {
    backgroundColor: 'rgba(255,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.4)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  msgText: {
    color: '#ff8080',
  },
  msgBannerInfo: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  msgTextInfo: {
    color: 'rgba(255,255,255,0.85)',
  },

  // ── QR floating pill (ala Google Lens) ──
  qrFloatWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  qrFloat: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '90%',
    backgroundColor: '#ffffff',
    borderRadius: radius.full,
    paddingLeft: 6,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    gap: spacing.xs,
    // floating shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  qrFloatMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  qrFloatIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFloatTextWrap: {
    flex: 1,
    gap: 1,
  },
  qrFloatTop: {
    color: '#5f6368',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  qrFloatValue: {
    color: '#1a1a1a',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  qrFloatClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Model loading / error banner ──
  modelBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    zIndex: 30,
  },
  modelBannerError: {
    backgroundColor: 'rgba(255,149,0,0.12)',
    borderBottomColor: 'rgba(255,149,0,0.35)',
  },
  modelBannerText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
  },
  modelBannerErrorText: {
    color: '#ff9500',
  },
  modelBannerRetry: {
    fontSize: 11,
    color: '#ff9500',
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },

  // ── Connectivity banner ──
  connBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(70,70,70,0.9)',
    zIndex: 28,
  },
  connBannerOnline: {
    backgroundColor: 'rgba(0,40,15,0.9)',
  },
  connText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
  },
  connTextOnline: {
    color: '#00c853',
  },
  trackBox: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 8,
  },
  trackBoxLabel: {
    position: 'absolute',
    top: -22,
    left: -3,
    backgroundColor: '#00FF88',
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
})
