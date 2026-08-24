import { serviceConfig } from '../config'
import type { AnalyzeCategory } from './analyze/AnalyzeService'

const base = serviceConfig.authUrl

// Skala 5-titik Likert: 1=Sangat buruk/tidak setuju ... 5=Sangat baik/setuju
export type Scale5 = 1 | 2 | 3 | 4 | 5

export interface FeedbackInput {
  navigasi?: Scale5
  kemudahan?: Scale5
  kualitas?: Scale5
  akurasi?: Scale5
  manfaat?: Scale5
  niat_pakai?: Scale5
  komentar?: string
}

export async function submitFeedback(token: string, input: FeedbackInput): Promise<void> {
  const res = await fetch(`${base}/feedback`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      navigasi:   input.navigasi   ?? null,
      kemudahan:  input.kemudahan  ?? null,
      kualitas:   input.kualitas   ?? null,
      akurasi:    input.akurasi    ?? null,
      manfaat:    input.manfaat    ?? null,
      niat_pakai: input.niat_pakai ?? null,
      komentar:   input.komentar   ?? null,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail ?? 'Gagal mengirim masukan')
  }
}

export interface ReportInput {
  category: AnalyzeCategory | string
  text: string
  confidence?: number
  imageUrl?: string
  reason?: string
}

export async function submitReport(token: string, input: ReportInput): Promise<void> {
  const res = await fetch(`${base}/reports`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category:   input.category,
      text:       input.text,
      confidence: input.confidence ?? null,
      image_url:  input.imageUrl   ?? null,
      reason:     input.reason     ?? null,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail ?? 'Gagal mengirim laporan')
  }
}
