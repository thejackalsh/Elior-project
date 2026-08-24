import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react'

export interface DrawerData {
  category: string
  text: string
  confidence?: number
  imageUri?: string
  bbox?: [number, number, number, number]
  durationMs?: number
}

interface DrawerCallbacks {
  stop: () => Promise<void>
  repeatFrom: (text: string) => void
}

interface DrawerContextValue {
  data: DrawerData | null
  drawKey: number
  speaking: boolean
  show: (d: DrawerData) => void
  hide: () => void
  setSpeaking: (s: boolean) => void
  registerCallbacks: (cbs: DrawerCallbacks) => void
  onStopTTS: () => void
  onRepeatFrom: (text: string) => void
}

const DrawerContext = createContext<DrawerContextValue>(null!)

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DrawerData | null>(null)
  const [drawKey, setDrawKey] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const cbsRef = useRef<DrawerCallbacks | null>(null)

  const show = useCallback((d: DrawerData) => {
    setData(d)
    setDrawKey((k) => k + 1)
  }, [])

  const hide = useCallback(() => {
    setData(null)
  }, [])

  const registerCallbacks = useCallback((cbs: DrawerCallbacks) => {
    cbsRef.current = cbs
  }, [])

  const onStopTTS = useCallback(() => {
    cbsRef.current?.stop()
  }, [])

  const onRepeatFrom = useCallback((text: string) => {
    cbsRef.current?.repeatFrom(text)
  }, [])

  const value = useMemo(
    () => ({ data, drawKey, speaking, show, hide, setSpeaking, registerCallbacks, onStopTTS, onRepeatFrom }),
    [data, drawKey, speaking, show, hide, setSpeaking, registerCallbacks, onStopTTS, onRepeatFrom],
  )

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  )
}

export const useDrawerContext = () => useContext(DrawerContext)
