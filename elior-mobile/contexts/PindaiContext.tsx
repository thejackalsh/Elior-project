import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { serviceConfig } from '../config'

export type PindaiMode = 'uang' | 'baca' | 'objek' | 'qr'

const ALL_MODES: PindaiMode[] = ['objek', 'uang', 'qr', 'baca']
const SCAN_COUNT_KEY = 'scan_count_v1'
const MODE_KEY = '@elior_last_mode'

interface PindaiCallbacks {
  scan: () => void
  flip: () => void
}

interface PindaiContextValue {
  register: (cbs: PindaiCallbacks) => void
  scan: () => void
  flip: () => void
  isLoading: boolean
  setLoading: (v: boolean) => void
  mode: PindaiMode
  toggleMode: () => void
  enabledModes: PindaiMode[]
  scanDailyLimit: number
  scanCount: number
  canScan: boolean
  incrementScanCount: () => void
}

const PindaiContext = createContext<PindaiContextValue>(null!)

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function PindaiProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setLoading] = useState(false)
  const [mode, setMode] = useState<PindaiMode>('objek')
  const [enabledModes, setEnabledModes] = useState<PindaiMode[]>(ALL_MODES)
  const [scanDailyLimit, setScanDailyLimit] = useState(10)
  const [scanCount, setScanCount] = useState(0)
  const cbsRef = useRef<PindaiCallbacks | null>(null)
  const enabledRef = useRef<PindaiMode[]>(ALL_MODES)

  const loadScanCount = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SCAN_COUNT_KEY)
      if (raw) {
        const { date, count } = JSON.parse(raw)
        if (date === todayStr()) {
          setScanCount(count)
          return
        }
      }
      setScanCount(0)
    } catch {}
  }, [])

  const fetchConfig = useCallback(() => {
    fetch(`${serviceConfig.authUrl}/config`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: { modes: Record<PindaiMode, boolean>; scan_daily_limit?: number }) => {
        const active = ALL_MODES.filter(m => data.modes[m] !== false)
        if (active.length > 0) {
          enabledRef.current = active
          setEnabledModes(active)
          // Koreksi mode langsung — batch dengan setEnabledModes agar 1 render
          setMode(prev => {
            if (active.includes(prev)) return prev
            const next = active.includes('objek') ? 'objek' : active[0]
            AsyncStorage.setItem(MODE_KEY, next).catch(() => {})
            return next
          })
        }
        if (typeof data.scan_daily_limit === 'number') {
          setScanDailyLimit(data.scan_daily_limit)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadScanCount()
    fetchConfig()
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        loadScanCount()
        fetchConfig()
      }
    })
    return () => sub.remove()
  }, [])

  const incrementScanCount = useCallback(async () => {
    setScanCount(prev => {
      const next = prev + 1
      AsyncStorage.setItem(SCAN_COUNT_KEY, JSON.stringify({ date: todayStr(), count: next })).catch(() => {})
      return next
    })
  }, [])

  const register = useCallback((cbs: PindaiCallbacks) => {
    cbsRef.current = cbs
  }, [])

  const scan = useCallback(() => cbsRef.current?.scan(), [])
  const flip = useCallback(() => cbsRef.current?.flip(), [])

  const toggleMode = useCallback(() => {
    setMode(current => {
      const enabled = enabledRef.current
      if (enabled.length <= 1) return enabled[0] ?? current
      const idx = enabled.indexOf(current)
      const next = enabled[(idx + 1) % enabled.length]
      AsyncStorage.setItem(MODE_KEY, next).catch(() => {})
      return next
    })
  }, [])

  const canScan = scanDailyLimit === 0 || scanCount < scanDailyLimit

  const value = useMemo(
    () => ({
      register, scan, flip, isLoading, setLoading, mode, toggleMode, enabledModes,
      scanDailyLimit, scanCount, canScan, incrementScanCount,
    }),
    [register, scan, flip, isLoading, setLoading, mode, toggleMode, enabledModes, scanDailyLimit, scanCount, canScan, incrementScanCount],
  )

  return (
    <PindaiContext.Provider value={value}>
      {children}
    </PindaiContext.Provider>
  )
}

export const usePindaiContext = () => useContext(PindaiContext)
