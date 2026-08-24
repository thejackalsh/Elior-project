// Port coin_preprocess (notebook v14 cell 19) ke pure JS (no cv2 di RN).
// Input : RGBA uint8 (size*size*4), letterboxed crop pad 114.
// Output: RGBA uint8 termask (bg → 114) atau null → caller fallback ke crop asli.
//
// PARITY WARNING: CLAHE, RGB→LAB, adaptiveThreshold sulit dibikin identik dgn cv2.
// Modul ini WAJIB lolos parity gate (JS vs cv2, plan verifikasi #2b) sebelum
// dipakai. Sampai itu, RupiahClassifierService.ENABLE_COIN_PASS = false.
//
// Param exact match cell 19: clahe_clip=2.0, tile 8×8, pad_tol=3, block=35, C=5,
// min_mask_ratio=0.15, max_mask_ratio=1.0.

const PAD = 114
const PAD_TOL = 3
const CLAHE_CLIP = 2.0
const CLAHE_TILES = 8
const ADAPT_BLOCK = 35
const ADAPT_C = 5
const MIN_MASK_RATIO = 0.15
const MAX_MASK_RATIO = 1.0

// ── RGB → CIELAB L channel (8-bit, cv2 convention: L = L*·255/100) ────────────

function srgbToLinear(c: number): number {
  const x = c / 255
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

function labL(rgba: Uint8Array, n: number): Float32Array {
  const L = new Float32Array(n)
  const Yn = 1.0
  for (let i = 0; i < n; i++) {
    const r = srgbToLinear(rgba[i * 4])
    const g = srgbToLinear(rgba[i * 4 + 1])
    const b = srgbToLinear(rgba[i * 4 + 2])
    const Y = 0.212671 * r + 0.715160 * g + 0.072169 * b
    const t = Y / Yn
    const fy = t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
    const Lstar = 116 * fy - 16 // 0..100
    L[i] = Lstar * 255 / 100
  }
  return L
}

// ── CLAHE (clipLimit=2.0, tileGridSize=8×8) ──────────────────────────────────

function clahe(L: Float32Array, size: number): Float32Array {
  const tiles = CLAHE_TILES
  const ts = size / tiles // 32 for 256
  const tileArea = ts * ts
  const clipLimit = Math.max(1, Math.floor((CLAHE_CLIP * tileArea) / 256))

  // Per-tile mapping LUT (tiles*tiles LUTs of 256).
  const luts = new Array<Uint8Array>(tiles * tiles)
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const hist = new Uint32Array(256)
      const y0 = ty * ts, x0 = tx * ts
      for (let y = 0; y < ts; y++) {
        const row = (y0 + y) * size + x0
        for (let x = 0; x < ts; x++) {
          hist[Math.min(255, Math.max(0, Math.round(L[row + x])))]++
        }
      }
      // clip + redistribute excess uniformly
      let excess = 0
      for (let i = 0; i < 256; i++) if (hist[i] > clipLimit) { excess += hist[i] - clipLimit; hist[i] = clipLimit }
      const inc = Math.floor(excess / 256)
      let rem = excess - inc * 256
      for (let i = 0; i < 256; i++) hist[i] += inc
      for (let i = 0; i < 256 && rem > 0; i++, rem--) hist[i]++
      // CDF → LUT
      const lut = new Uint8Array(256)
      let cdf = 0
      const scale = 255 / tileArea
      for (let i = 0; i < 256; i++) { cdf += hist[i]; lut[i] = Math.min(255, Math.round(cdf * scale)) }
      luts[ty * tiles + tx] = lut
    }
  }

  // Bilinear interp between tile-center LUTs.
  const out = new Float32Array(L.length)
  for (let y = 0; y < size; y++) {
    const gy = (y - ts / 2) / ts
    let ty0 = Math.floor(gy)
    let fy = gy - ty0
    if (ty0 < 0) { ty0 = 0; fy = 0 }
    if (ty0 >= tiles - 1) { ty0 = tiles - 2; fy = 1 }
    const ty1 = ty0 + 1
    for (let x = 0; x < size; x++) {
      const gx = (x - ts / 2) / ts
      let tx0 = Math.floor(gx)
      let fx = gx - tx0
      if (tx0 < 0) { tx0 = 0; fx = 0 }
      if (tx0 >= tiles - 1) { tx0 = tiles - 2; fx = 1 }
      const tx1 = tx0 + 1
      const v = Math.min(255, Math.max(0, Math.round(L[y * size + x])))
      const a = luts[ty0 * tiles + tx0][v]
      const b = luts[ty0 * tiles + tx1][v]
      const c = luts[ty1 * tiles + tx0][v]
      const d = luts[ty1 * tiles + tx1][v]
      const top = a * (1 - fx) + b * fx
      const bot = c * (1 - fx) + d * fx
      out[y * size + x] = top * (1 - fy) + bot * fy
    }
  }
  return out
}

// ── Separable Gaussian blur (reflect-101 border) ─────────────────────────────

function gaussianKernel(ksize: number, sigma: number): Float32Array {
  const s = sigma > 0 ? sigma : 0.3 * ((ksize - 1) * 0.5 - 1) + 0.8
  const k = new Float32Array(ksize)
  const c = (ksize - 1) / 2
  let sum = 0
  for (let i = 0; i < ksize; i++) { const d = i - c; k[i] = Math.exp(-(d * d) / (2 * s * s)); sum += k[i] }
  for (let i = 0; i < ksize; i++) k[i] /= sum
  return k
}

function reflect101(i: number, n: number): number {
  if (n === 1) return 0
  while (i < 0 || i >= n) { if (i < 0) i = -i; if (i >= n) i = 2 * (n - 1) - i }
  return i
}

function sepBlur(src: Float32Array, size: number, ksize: number, sigma: number): Float32Array {
  const k = gaussianKernel(ksize, sigma)
  const c = (ksize - 1) / 2
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0
      for (let j = 0; j < ksize; j++) acc += k[j] * src[y * size + reflect101(x + j - c, size)]
      tmp[y * size + x] = acc
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0
      for (let j = 0; j < ksize; j++) acc += k[j] * tmp[reflect101(y + j - c, size) * size + x]
      out[y * size + x] = acc
    }
  }
  return out
}

// ── adaptiveThreshold GAUSSIAN, THRESH_BINARY (block=35, C=5) ─────────────────
// dst = src > (gaussianMean - C) ? 255 : 0

function adaptiveThresholdGaussian(src: Float32Array, size: number): Uint8Array {
  const mean = sepBlur(src, size, ADAPT_BLOCK, 0)
  const out = new Uint8Array(src.length)
  for (let i = 0; i < src.length; i++) out[i] = src[i] > mean[i] - ADAPT_C ? 255 : 0
  return out
}

// ── Morphology (5×5 rect) dilate/erode, close = dilate×n then erode×n ─────────

function morph(mask: Uint8Array, size: number, dilate: boolean): Uint8Array {
  const r = 2 // 5×5
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = dilate ? 0 : 255
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= size) { if (!dilate) hit = 0; continue }
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= size) { if (!dilate) hit = 0; continue }
          const v = mask[yy * size + xx]
          if (dilate && v) { hit = 255; dy = r; break }
          if (!dilate && !v) { hit = 0; dy = r; break }
        }
      }
      out[y * size + x] = hit
    }
  }
  return out
}

function morphClose(mask: Uint8Array, size: number, iterations: number): Uint8Array {
  let m = mask
  for (let i = 0; i < iterations; i++) m = morph(m, size, true)
  for (let i = 0; i < iterations; i++) m = morph(m, size, false)
  return m
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function coinPreprocess(rgba: Uint8Array, size: number): Uint8Array | null {
  const n = size * size
  const L = labL(rgba, n)

  // valid = ~padding (piksel 114 dari letterbox)
  const valid = new Uint8Array(n)
  let validCount = 0
  for (let i = 0; i < n; i++) {
    const isPad =
      Math.abs(L[i] - PAD) <= PAD_TOL &&
      Math.abs(rgba[i * 4] - PAD) <= PAD_TOL &&
      Math.abs(rgba[i * 4 + 1] - PAD) <= PAD_TOL &&
      Math.abs(rgba[i * 4 + 2] - PAD) <= PAD_TOL
    if (!isPad) { valid[i] = 1; validCount++ }
  }
  if (validCount < 0.1 * n) return null

  const enhanced = clahe(L, size)
  const blur = sepBlur(enhanced, size, 5, 0)
  let mask = adaptiveThresholdGaussian(blur, size)
  for (let i = 0; i < n; i++) if (!valid[i]) mask[i] = 0

  // Polarity: center vs border pakai L asli
  let cSum = 0, cN = 0, bSum = 0, bN = 0
  const lo = Math.floor(size / 3), hi = Math.floor((2 * size) / 3)
  for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) { cSum += L[y * size + x]; cN++ }
  for (let i = 0; i < n; i++) if (valid[i]) { bSum += L[i]; bN++ }
  const centerMean = cN ? cSum / cN : 0
  const borderMean = bN ? bSum / bN : cSum / Math.max(cN, 1)
  if (centerMean < borderMean) {
    for (let i = 0; i < n; i++) mask[i] = valid[i] ? (255 - mask[i]) : 0
  }

  mask = morphClose(mask, size, 2)
  for (let i = 0; i < n; i++) if (!valid[i]) mask[i] = 0

  let maskCount = 0
  for (let i = 0; i < n; i++) if (mask[i]) maskCount++
  const ratio = maskCount / Math.max(validCount, 1)
  if (ratio < MIN_MASK_RATIO || ratio > MAX_MASK_RATIO) return null

  const out = new Uint8Array(rgba.length)
  out.set(rgba)
  for (let i = 0; i < n; i++) {
    if (!mask[i]) { out[i * 4] = PAD; out[i * 4 + 1] = PAD; out[i * 4 + 2] = PAD }
  }
  return out
}
