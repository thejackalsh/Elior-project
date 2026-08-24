// Self-check coinPreprocess (jalankan: npx tsx services/rupiah/coinPreprocess.selfcheck.ts).
// Cek invariant, BUKAN parity cv2 (parity gate #2b = bandingkan output vs cv2 di notebook).
import { coinPreprocess } from './coinPreprocess'
import assert from 'node:assert'

const SIZE = 64 // kelipatan 8 (tile CLAHE)

function fill(size: number, fn: (x: number, y: number) => [number, number, number]): Uint8Array {
  const rgba = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b] = fn(x, y)
    const i = (y * size + x) * 4
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255
  }
  return rgba
}

// Parity note: cv2 LAB L(gray-114)=123 (diverifikasi), JS≈122 → match ±1 LSB.
// Konsekuensi: is_padding (|L-114|<=3) TIDAK pernah kena utk pad-114, di cv2 MAUPUN JS
// (|123-114|=9>3). Jadi all-pad diperlakukan valid di kedua sisi (faithful), bukan null.

// 1) all-pad: jalan tanpa throw (bukan null — konsisten cv2), output null|buffer.
const allPad = fill(SIZE, () => [114, 114, 114])
const padOut = coinPreprocess(allPad, SIZE)
assert.ok(padOut === null || padOut.length === SIZE * SIZE * 4, 'all-pad: null atau buffer valid')

// 2) Disc terang di tengah, bg gelap → kalau non-null, tiap piksel non-mask WAJIB 114.
const cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.3
const disc = fill(SIZE, (x, y) => {
  const d = Math.hypot(x - cx, y - cy)
  return d < r ? [230, 210, 90] : [30, 30, 30] // koin terang / bg gelap
})
const out = coinPreprocess(disc, SIZE)
if (out !== null) {
  const n = SIZE * SIZE
  let masked = 0
  for (let i = 0; i < n; i++) {
    const j = i * 4
    const same = out[j] === disc[j] && out[j + 1] === disc[j + 1] && out[j + 2] === disc[j + 2]
    const isBg = out[j] === 114 && out[j + 1] === 114 && out[j + 2] === 114
    // invariant: output = input asli ATAU dipaksa jadi 114 (bg). Tidak ada nilai lain.
    assert.ok(same || isBg, `piksel ${i} bukan input asli maupun bg-114`)
    if (isBg && !same) masked++
  }
  console.log(`disc: masked ${masked}/${n} piksel jadi bg-114`)
} else {
  console.log('disc: null (mask ratio di luar [0.15,1]) — acceptable, caller fallback')
}

console.log('coinPreprocess self-check OK')
