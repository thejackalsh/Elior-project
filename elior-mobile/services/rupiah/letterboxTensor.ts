// Worklet-safe letterbox + ImageNet-normalize math, shared by localizer (stage-1)
// dan classifier (stage-2). Dipanggil dari dalam frame processor (react-native-vision-camera),
// jadi tidak boleh pakai ImageManipulator/jpeg-js — cuma math murni di atas typed array
// hasil `vision-camera-resize-plugin`.

const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]
const ZERO = [0, 0, 0]
const ONE = [1, 1, 1]

export interface NormBox {
  cx: number
  cy: number
  w: number
  h: number
}

/** Hitung ukuran resize yang jaga aspect ratio (sisi terpanjang = target). */
export function computeLetterboxFit(srcW: number, srcH: number, target: number): { nw: number; nh: number; scale: number } {
  'worklet'
  const scale = target / Math.max(srcW, srcH)
  const nw = Math.max(1, Math.round(srcW * scale))
  const nh = Math.max(1, Math.round(srcH * scale))
  return { nw, nh, scale }
}

/**
 * pixels = HWC RGB uint8 (dari resize-plugin, ukuran nw*nh*3), sudah di-resize proporsional.
 * Tempel di tengah kanvas target×target (pad abu-abu 114), lalu normalize ImageNet →
 * Float32Array planar CHW siap masuk model.
 *
 * normalize=false: skip ImageNet mean/std (cuma /255 RGB) — dipakai untuk model yang
 * sudah memanggang normalisasi ke dalam graph ekspor sendiri (localizer v4). Kalau
 * dipakai untuk model yang TIDAK bake normalisasi (classifier), input jadi salah
 * kontrak — GAGAL SENYAP, bbox/skor cuma jadi sampah tanpa error apa pun.
 */
export function packLetterboxTensor(
  pixels: Uint8Array, nw: number, nh: number, target: number, pad: number,
  normalize = true,
): Float32Array {
  'worklet'
  const m = normalize ? MEAN : ZERO
  const s = normalize ? STD : ONE
  const size = target * target
  const tensor = new Float32Array(3 * size)
  const padNorm = pad / 255.0
  for (let c = 0; c < 3; c++) {
    const base = c * size
    const fillVal = (padNorm - m[c]) / s[c]
    for (let i = 0; i < size; i++) tensor[base + i] = fillVal
  }
  const padX = (target - nw) >> 1
  const padY = (target - nh) >> 1
  for (let y = 0; y < nh; y++) {
    const srcRow = y * nw * 3
    const dstRow = (y + padY) * target + padX
    for (let x = 0; x < nw; x++) {
      const s0 = srcRow + x * 3
      const d = dstRow + x
      tensor[0 * size + d] = (pixels[s0]     / 255.0 - m[0]) / s[0]
      tensor[1 * size + d] = (pixels[s0 + 1] / 255.0 - m[1]) / s[1]
      tensor[2 * size + d] = (pixels[s0 + 2] / 255.0 - m[2]) / s[2]
    }
  }
  return tensor
}

/**
 * Balikkan box hasil decode (fraksi relatif kanvas letterbox target×target) ke
 * fraksi relatif gambar sumber (srcW×srcH) sebelum di-resize+pad.
 */
export function inverseLetterboxBox(box: NormBox, nw: number, nh: number, target: number, srcW: number, srcH: number): NormBox {
  'worklet'
  const padX = (target - nw) >> 1
  const padY = (target - nh) >> 1
  // Skala isotropik ASLI dari computeLetterboxFit — bukan nw/srcW, karena nw dan nh
  // dibulatkan independen (Math.round), jadi nw/srcW ≠ nh/srcH sampai ~1px skew.
  const scale = target / Math.max(srcW, srcH)

  const px = box.cx * target - padX
  const py = box.cy * target - padY
  const pw = box.w * target
  const ph = box.h * target

  return {
    cx: Math.min(1, Math.max(0, (px / scale) / srcW)),
    cy: Math.min(1, Math.max(0, (py / scale) / srcH)),
    w:  Math.min(1, Math.max(0, (pw / scale) / srcW)),
    h:  Math.min(1, Math.max(0, (ph / scale) / srcH)),
  }
}

export type RotationDeg = '0deg' | '90deg' | '180deg' | '270deg'

/**
 * Balikkan box dari fraksi UPRIGHT (counter-rotated) ke fraksi RAW frame
 * (pre-rotasi). resize-plugin native pipeline: crop → scale → rotate, jadi
 * crop rect harus dihitung di ruang RAW, bukan ruang upright.
 * Rotasi = clockwise, sesuai libyuv ARGBRotate (lihat ResizePlugin.cpp).
 */
export function inverseOrientationBox(box: NormBox, rotation: RotationDeg): NormBox {
  'worklet'
  if (rotation === '0deg') return box
  if (rotation === '180deg') return { cx: 1 - box.cx, cy: 1 - box.cy, w: box.w, h: box.h }
  if (rotation === '90deg') return { cx: box.cy, cy: 1 - box.cx, w: box.h, h: box.w }
  return { cx: 1 - box.cy, cy: box.cx, w: box.h, h: box.w } // 270deg
}

/**
 * Crop rect piksel (clamped ke frame) dari box fraksi + margin. Pakai Math.trunc
 * (bukan Math.round) supaya identik bit-per-bit dengan int() di training
 * crop_and_letterbox (classifier v16 cell 21) — konsistensi crop antara training
 * dan inference penting karena posisi crop langsung menentukan input classifier.
 */
export function computeCropRect(box: NormBox, frameW: number, frameH: number, margin: number): { x: number; y: number; width: number; height: number } | null {
  'worklet'
  const bwM = Math.min(box.w * (1 + 2 * margin), 1)
  const bhM = Math.min(box.h * (1 + 2 * margin), 1)

  const x1 = Math.max(0, Math.trunc((box.cx - bwM / 2) * frameW))
  const y1 = Math.max(0, Math.trunc((box.cy - bhM / 2) * frameH))
  const x2 = Math.min(frameW, Math.trunc((box.cx + bwM / 2) * frameW))
  const y2 = Math.min(frameH, Math.trunc((box.cy + bhM / 2) * frameH))
  const width = x2 - x1
  const height = y2 - y1
  if (width < 1 || height < 1) return null
  return { x: x1, y: y1, width, height }
}
