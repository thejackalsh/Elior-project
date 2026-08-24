import { useState, useCallback } from 'react'
import { ServiceFactory } from '../services/ServiceFactory'
import type { AnalyzeResult } from '../services/analyze/AnalyzeService'

export type AnalyzeState = 'idle' | 'loading' | 'success' | 'error'

const ocrService = ServiceFactory.ocr()
const analyzeService = ServiceFactory.analyze()

// Minimum chars untuk dianggap teks valid — filter noise ML Kit
const MIN_OCR_LENGTH = 3

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>('idle')
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (base64: string, uri: string, mode: 'uang' | 'baca' | 'objek' = 'uang') => {
    setState('loading')
    setError(null)
    setResult(null)

    try {
      // Mode baca → ML Kit OCR only, skip backend
      if (mode === 'baca') {
        const ocr = await ocrService.recognize(uri)
        if (ocr.text.trim().length >= MIN_OCR_LENGTH) {
          const data: AnalyzeResult = { text: ocr.text.trim(), category: 'ocr' }
          setResult(data)
          setState('success')
          return data
        }
        const data: AnalyzeResult = { text: 'Tidak ada teks yang terdeteksi', category: 'ocr' }
        setResult(data)
        setState('success')
        return data
      }

      // Mode objek → backend COCO object detection
      if (mode === 'objek') {
        const data = await analyzeService.analyze(base64, 'object')
        setResult(data)
        setState('success')
        return data
      }

      // Mode uang: deteksi realtime ditangani langsung di camera.tsx (localizer loop).
      const data: AnalyzeResult = { text: 'Gunakan mode kamera untuk deteksi uang', category: 'rupiah' }
      setResult(data)
      setState('success')
      return data

    } catch (err) {
      let msg = 'Analisis gagal'
      if (err instanceof Error) {
        const lower = err.message.toLowerCase()
        if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed') || lower.includes('abort') || lower.includes('connection')) {
          msg = 'Tidak dapat terhubung ke server. Periksa koneksi internet.'
        } else if (lower.includes('lambat') || lower.includes('server') || lower.includes('format') || lower.includes('respons')) {
          msg = err.message
        } else {
          msg = 'Analisis gagal. Coba lagi.'
        }
      }
      setError(msg)
      setState('error')
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setResult(null)
    setError(null)
  }, [])

  return { analyze, state, result, error, reset }
}
