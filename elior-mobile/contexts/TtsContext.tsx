import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { AccessibilityInfo } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ServiceFactory } from '../services/ServiceFactory'

const STORAGE_KEY = '@elior_tts_enabled'
const RATE_KEY = '@elior_tts_rate'
const AUTO_SPEAK_KEY = '@elior_tts_autospeak'
const tts = ServiceFactory.tts()

export const RATE_MIN = 0.5
export const RATE_MAX = 10.0
export const RATE_STEP = 0.2

interface TtsContextValue {
  /** Apakah TTS umpan-balik tombol aktif. */
  enabled: boolean
  setEnabled: (v: boolean) => void
  /** Kecepatan bicara global (tersimpan). */
  rate: number
  setRate: (r: number) => void
  /** Preferensi suara-otomatis hasil pindai. null = belum diset (user lama, fallback ke visionStatus). */
  autoSpeakPref: boolean | null
  setAutoSpeakPref: (v: boolean) => void
  /** Bacakan teks; selalu memotong (cut) suara sebelumnya. No-op bila dinonaktifkan. */
  say: (text: string, opts?: { rate?: number; force?: boolean }) => void
  /** Hentikan suara yang sedang berjalan. */
  stop: () => void
}

const TtsCtx = createContext<TtsContextValue | null>(null)

export function TtsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true)
  const [rate, setRateState] = useState(1.0)
  const [autoSpeakPref, setAutoSpeakPrefState] = useState<boolean | null>(null)
  const talkbackRef = useRef(false)
  const rateRef = useRef(1.0)

  // Muat preferensi tersimpan
  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, RATE_KEY, AUTO_SPEAK_KEY]).then((entries) => {
      const map = Object.fromEntries(entries)
      if (map[STORAGE_KEY] != null) setEnabledState(map[STORAGE_KEY] === '1')
      const r = parseFloat(map[RATE_KEY] ?? '')
      if (!Number.isNaN(r)) { setRateState(r); rateRef.current = r }
      if (map[AUTO_SPEAK_KEY] != null) setAutoSpeakPrefState(map[AUTO_SPEAK_KEY] === '1')
    })
  }, [])

  const setRate = useCallback((r: number) => {
    const clamped = Math.min(RATE_MAX, Math.max(RATE_MIN, parseFloat(r.toFixed(1))))
    setRateState(clamped)
    rateRef.current = clamped
    AsyncStorage.setItem(RATE_KEY, String(clamped))
  }, [])

  // Pantau status TalkBack — bila aktif, biarkan TalkBack yang membaca (hindari dobel)
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((a) => { talkbackRef.current = a })
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (a) => {
      talkbackRef.current = a
    })
    return () => sub.remove()
  }, [])

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v)
    AsyncStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    if (!v) {
      // Beri tahu sekali bahwa suara dimatikan, lalu hentikan
      if (!talkbackRef.current) {
        tts.stop().finally(() => {
          tts.speak('Suara tombol dimatikan', { locale: 'id-ID', rate: rateRef.current, pitch: 1.0 })
        })
      } else {
        AccessibilityInfo.announceForAccessibility('Suara tombol dimatikan')
      }
    }
  }, [])

  const enabledRef = useRef(enabled)
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  const say = useCallback((text: string, opts?: { rate?: number; force?: boolean }) => {
    if (!text) return
    if (!opts?.force && !enabledRef.current) return
    if (talkbackRef.current) {
      AccessibilityInfo.announceForAccessibility(text)
      return
    }
    // Potong suara sebelumnya, lalu bacakan yang baru
    tts.stop().finally(() => {
      tts.speak(text, { locale: 'id-ID', rate: opts?.rate ?? rateRef.current, pitch: 1.0 })
    })
  }, [])

  const setAutoSpeakPref = useCallback((v: boolean) => {
    setAutoSpeakPrefState(v)
    AsyncStorage.setItem(AUTO_SPEAK_KEY, v ? '1' : '0')
  }, [])

  const stop = useCallback(() => { tts.stop() }, [])

  const value = useMemo<TtsContextValue>(
    () => ({ enabled, setEnabled, rate, setRate, autoSpeakPref, setAutoSpeakPref, say, stop }),
    [enabled, setEnabled, rate, setRate, autoSpeakPref, setAutoSpeakPref, say, stop],
  )

  return (
    <TtsCtx.Provider value={value}>
      {children}
    </TtsCtx.Provider>
  )
}

export function useTts(): TtsContextValue {
  const ctx = useContext(TtsCtx)
  if (!ctx) throw new Error('useTts must be used within TtsProvider')
  return ctx
}
