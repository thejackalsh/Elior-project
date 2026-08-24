import TextRecognition from '@react-native-ml-kit/text-recognition'
import type { IOCRService, OCRResult } from './IOCRService'

// Filter karakter noise: single char, simbol saja, atau terlalu pendek
function isValidLine(text: string): boolean {
  const t = text.trim()
  if (t.length < 2) return false
  // Minimal satu huruf alfanumerik
  return /[a-zA-Z0-9]/.test(t)
}

type Framed = { frame?: { left: number; top: number; width: number; height: number } }

/**
 * Urutkan elemen sesuai reading-order manusia: atas→bawah, lalu kiri→kanan.
 * Pakai center-Y (bukan top) agar teks ukuran berbeda tetap dikelompokkan benar.
 * Tolerance = 50% dari tinggi terbesar antara dua elemen.
 */
function readingOrder<T extends Framed>(items: T[]): T[] {
  const framed = items.filter((i): i is T & { frame: NonNullable<T['frame']> } => !!i.frame)
  const unframed = items.filter((i) => !i.frame)
  if (framed.length < 2) return items

  const byCenterY = [...framed].sort((a, b) => {
    const aCY = a.frame.top + a.frame.height / 2
    const bCY = b.frame.top + b.frame.height / 2
    return aCY - bCY
  })

  const rows: (typeof byCenterY)[] = []
  for (const it of byCenterY) {
    const itCY = it.frame.top + it.frame.height / 2
    const last = rows[rows.length - 1]
    if (last) {
      const ref = last[0]
      const refCY = ref.frame.top + ref.frame.height / 2
      const tol = Math.max(ref.frame.height, it.frame.height) * 0.5
      if (Math.abs(itCY - refCY) <= tol) {
        last.push(it)
        continue
      }
    }
    rows.push([it])
  }

  const ordered = rows.flatMap((row) => row.sort((a, b) => a.frame.left - b.frame.left))
  return [...ordered, ...unframed]
}

function formatText(result: Awaited<ReturnType<typeof TextRecognition.recognize>>): string {
  if (!result.blocks?.length) return result.text ?? ''

  // Flatten semua lines dari semua blocks, sort global sekali.
  // Ini lebih akurat daripada sort blocks dulu lalu sort lines per block,
  // karena blocks ML Kit bisa overlap secara vertikal.
  const allLines = result.blocks.flatMap((b) => b.lines ?? [])

  if (allLines.length === 0) {
    return readingOrder(result.blocks)
      .map((b) => b.text.trim())
      .filter(isValidLine)
      .join('\n')
  }

  return readingOrder(allLines)
    .map((l) => l.text.trim())
    .filter(isValidLine)
    .join('\n')
}

export class MLKitOCRProvider implements IOCRService {
  async recognize(imageUri: string): Promise<OCRResult> {
    const result = await TextRecognition.recognize(imageUri)

    if (!result.text?.trim()) {
      return { text: '', blocks: [] }
    }

    return {
      text: formatText(result),
      blocks: result.blocks?.map((b) => ({
        text: b.text,
        frame: b.frame
          ? {
              x: b.frame.left,
              y: b.frame.top,
              width: b.frame.width,
              height: b.frame.height,
            }
          : undefined,
      })),
    }
  }
}
