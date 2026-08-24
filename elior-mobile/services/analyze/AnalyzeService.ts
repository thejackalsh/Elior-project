export type AnalyzeCategory = 'ocr' | 'rupiah' | 'object'
export type AnalyzeMode = 'rupiah' | 'object'

export interface AnalyzeResult {
  text: string
  category: AnalyzeCategory
  confidence?: number
  bbox?: [number, number, number, number]  // [x1, y1, x2, y2] normalized 0-1
}

/**
 * Proxy backend (elior-backend/inference) megang HF token PRO server-side dan
 * forward ke Gradio ZeroGPU Space ber-auth. Mobile cukup POST tunggal, tanpa token.
 *   POST /analyze  body {image, mode} -> {text, category, confidence, bbox}
 */
export class AnalyzeService {
  constructor(private readonly baseUrl: string) {}

  async analyze(imageBase64: string, mode: AnalyzeMode = 'rupiah'): Promise<AnalyzeResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 200_000)

    const root = this.baseUrl.replace(/\/+$/, '')

    try {
      const res = await fetch(`${root}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, mode }),
        signal: controller.signal,
      })
      if (!res.ok) {
        // Proxy kirim {detail: "..."} pada error → pakai pesan itu kalau ada
        console.log('[AnalyzeService] /analyze HTTP', res.status)
        let detail = 'Server sedang bermasalah. Coba lagi nanti.'
        try {
          const body = await res.json()
          if (body?.detail) detail = body.detail
        } catch {}
        throw new Error(detail)
      }

      const out = (await res.json()) as Partial<AnalyzeResult>
      if (!out || typeof out.text !== 'string') {
        throw new Error('Format respons server tidak dikenali')
      }
      return {
        text: out.text,
        category: out.category ?? 'object',
        confidence: out.confidence ?? undefined,
        bbox: out.bbox ?? undefined,
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Server lambat merespons (GPU sedang dimuat), coba lagi')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }
}
