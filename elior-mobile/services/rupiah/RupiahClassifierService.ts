// Classifier stage-2: baca nominal dari crop bbox localizer. Model + tensor prep
// dipanggil langsung dari frame processor (lihat components/UangDetector.tsx) —
// file ini cuma konstanta + decode + label mapping, murni tanpa I/O supaya aman
// dipanggil di worklet.
//
// Classifier v15: mobilenetv4_conv_medium + CBAM, input [1,3,256,256] NCHW,
// output [1,11] softmax (softmax sudah di-graph), 11 kelas. Preproc match training
// crop_and_letterbox (notebook v14 cell 17): crop bbox +12% margin, letterbox
// ke 256 pad 114, ImageNet normalize.
//
// ponytail: two-pass coin_preprocess (CLAHE/adaptiveThreshold, lihat coinPreprocess.ts)
// TIDAK disambungkan ke live frame-processor path — fitur itu masih di belakang
// ENABLE_COIN_PASS=false karena belum lolos parity gate JS-vs-cv2, dan CLAHE di
// worklet adalah pekerjaan terpisah. Live path selalu pakai pass-1 (crop asli).

export type RupiahLabel =
  | 'Rp100000_kertas' | 'Rp10000_kertas' | 'Rp1000_kertas' | 'Rp1000_koin'
  | 'Rp20000_kertas'  | 'Rp2000_kertas'  | 'Rp50000_kertas' | 'Rp5000_kertas'
  | 'Rp500_koin' | 'Rp100_koin' | 'Rp200_koin'

export interface RupiahPrediction {
  text: string
  textLengkap: string
  nominal: number
  nominalText: string
  bentuk: 'kertas' | 'koin'
  warna: string[]
  warnaText: string
  label: RupiahLabel
  confidence: number
  confidencePercent: string
}

export const CLASSIFIER_IMG_SIZE = 256
export const CLASSIFIER_PAD = 114
export const CLASSIFIER_CROP_MARGIN = 0.12

const CLASS_LABELS: RupiahLabel[] = [
  'Rp100_koin',
  'Rp200_koin',
  'Rp500_koin',
  'Rp1000_koin',
  'Rp1000_kertas',
  'Rp2000_kertas',
  'Rp5000_kertas',
  'Rp10000_kertas',
  'Rp20000_kertas',
  'Rp50000_kertas',
  'Rp100000_kertas',
]

const DISPLAY: Record<RupiahLabel, string> = {
  Rp100_koin:      'Rp100 koin',
  Rp200_koin:      'Rp200 koin',
  Rp500_koin:      'Rp500 koin',
  Rp1000_koin:     'Rp1.000 koin',
  Rp1000_kertas:   'Rp1.000 kertas',
  Rp2000_kertas:   'Rp2.000 kertas',
  Rp5000_kertas:   'Rp5.000 kertas',
  Rp10000_kertas:  'Rp10.000 kertas',
  Rp20000_kertas:  'Rp20.000 kertas',
  Rp50000_kertas:  'Rp50.000 kertas',
  Rp100000_kertas: 'Rp100.000 kertas',
}

const TERBILANG: Record<RupiahLabel, string> = {
  Rp100_koin:      'Seratus rupiah koin',
  Rp200_koin:      'Dua ratus rupiah koin',
  Rp500_koin:      'Lima ratus rupiah koin',
  Rp1000_koin:     'Seribu rupiah koin',
  Rp1000_kertas:   'Seribu rupiah kertas',
  Rp2000_kertas:   'Dua ribu rupiah',
  Rp5000_kertas:   'Lima ribu rupiah',
  Rp10000_kertas:  'Sepuluh ribu rupiah',
  Rp20000_kertas:  'Dua puluh ribu rupiah',
  Rp50000_kertas:  'Lima puluh ribu rupiah',
  Rp100000_kertas: 'Seratus ribu rupiah',
}

const NOMINAL: Record<RupiahLabel, number> = {
  Rp100_koin:      100,
  Rp200_koin:      200,
  Rp500_koin:      500,
  Rp1000_koin:     1000,
  Rp1000_kertas:   1000,
  Rp2000_kertas:   2000,
  Rp5000_kertas:   5000,
  Rp10000_kertas:  10000,
  Rp20000_kertas:  20000,
  Rp50000_kertas:  50000,
  Rp100000_kertas: 100000,
}

const WARNA: Record<RupiahLabel, string[]> = {
  Rp100_koin:      ['silver'],
  Rp200_koin:      ['silver'],
  Rp500_koin:      ['silver'],
  Rp1000_koin:     ['emas', 'silver'],
  Rp1000_kertas:   ['abu-abu', 'hijau'],
  Rp2000_kertas:   ['abu-abu', 'hijau'],
  Rp5000_kertas:   ['coklat', 'hijau'],
  Rp10000_kertas:  ['ungu'],
  Rp20000_kertas:  ['hijau'],
  Rp50000_kertas:  ['biru'],
  Rp100000_kertas: ['merah'],
}

/**
 * Majority vote dari 3 klasifikasi frame berturut — kurangi salah baca sesaat
 * (motion blur, sudut pandang) dibanding argmax 1-shot. Null kalau 3 label beda
 * (tidak ada mayoritas) — caller reset buffer & ulang voting dari frame berikutnya.
 */
export function majorityVote(a: number, b: number, c: number): number | null {
  'worklet'
  if (a === b) return a
  if (a === c) return a
  if (b === c) return b
  return null
}

/** Decode output softmax [1,11] → top-1 index (argmax). Aman dipanggil di worklet. */
export function decodeClassifier(output: Float32Array): { labelIdx: number; score: number } | null {
  'worklet'
  if (output.length < 11) return null
  let maxIdx = 0
  let maxScore = output[0]
  for (let i = 1; i < output.length; i++) {
    if (output[i] > maxScore) { maxScore = output[i]; maxIdx = i }
  }
  return { labelIdx: maxIdx, score: maxScore }
}

/** Map labelIdx (dari decodeClassifier, hasil runOnJS) → prediction lengkap. JS-thread only. */
export function buildRupiahPrediction(labelIdx: number, score: number): RupiahPrediction | null {
  const label = CLASS_LABELS[labelIdx]
  if (!label) return null
  const nominal = NOMINAL[label]
  const bentuk  = label.includes('koin') ? 'koin' : 'kertas'
  const warna   = WARNA[label]
  return {
    text:              DISPLAY[label],
    textLengkap:       TERBILANG[label],
    nominal,
    nominalText:       `Rp${nominal.toLocaleString('id-ID')}`,
    bentuk,
    warna,
    warnaText:         warna.join(', '),
    label,
    confidence:        score,
    confidencePercent: `${Math.round(score * 100)}%`,
  }
}
