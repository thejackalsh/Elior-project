// Localizer stage-1: cari bbox uang di frame kamera. Model + tensor prep dipanggil
// langsung dari frame processor (lihat components/UangDetector.tsx) — file ini cuma
// berisi konstanta + decode grid→box, murni tanpa I/O supaya aman dipanggil di worklet.

export interface LocalizerBox {
  cx: number
  cy: number
  w: number
  h: number
  confidence: number
}

export const LOCALIZER_IMG_SIZE = 224
export const LOCALIZER_GRID = 14
export const LOCALIZER_CONF_THRESHOLD = 0.5
// Terverifikasi cocok training: Models/localizer-mobilenetv4-singleclass-v3.ipynb (cell 9)
// pakai A.PadIfNeeded(..., value=(114,114,114)) — konsisten di v1/v2/v3.
export const LOCALIZER_PAD = 114

function clamp01(v: number): number {
  'worklet'
  return Math.min(1, Math.max(0, v))
}

/**
 * Decode output grid [1,14,14,5] → box confidence tertinggi (di atas threshold).
 * Channel 0 = objectness (sudah sigmoid di graph). Channel 1-4 = cx,cy,w,h SUDAH
 * ABSOLUT 0..1 relatif kanvas letterbox — model v4 mendekode grid-cell offset
 * ke koordinat absolut DI DALAM forward() (lihat RupiahLocalizer.forward():
 * cx = (sigmoid(tx) + grid_x) / S). JANGAN tambah offset grid manual di sini,
 * itu sudah dikerjakan model. Masih perlu inverseLetterboxBox sesudah ini
 * untuk konversi ke fraksi frame asli.
 * No NMS: single class, single object of interest.
 *
 * confThreshold parametrized supaya tier scheduling di UangDetector.tsx bisa
 * pakai gate longgar (IDLE_CONF_GATE) tanpa duplikasi fungsi ini.
 */
export function decodeLocalizer(output: Float32Array, confThreshold: number = LOCALIZER_CONF_THRESHOLD): LocalizerBox | null {
  'worklet'
  let bestIdx = -1
  let bestObj = -1
  const cells = LOCALIZER_GRID * LOCALIZER_GRID
  for (let i = 0; i < cells; i++) {
    const obj = output[i * 5]
    if (obj > bestObj) { bestObj = obj; bestIdx = i }
  }
  if (bestIdx < 0 || bestObj < confThreshold) return null

  const base = bestIdx * 5
  return {
    confidence: bestObj,
    cx: clamp01(output[base + 1]),
    cy: clamp01(output[base + 2]),
    w:  clamp01(output[base + 3]),
    h:  clamp01(output[base + 4]),
  }
}
