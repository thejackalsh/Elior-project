import { useState, useCallback, useRef } from 'react'
import { AccessibilityInfo } from 'react-native'
import { ServiceFactory } from '../services/ServiceFactory'
import { useTts } from '../contexts/TtsContext'

const ttsService = ServiceFactory.tts()

export function useTTS() {
  const { enabled, rate: contextRate } = useTts()
  const [speaking, setSpeaking] = useState(false)
  const isTalkBackActiveRef = useRef(false)

  // Keep TalkBack status updated
  AccessibilityInfo.isScreenReaderEnabled().then((active) => {
    isTalkBackActiveRef.current = active
  })

  const speak = useCallback(async (text: string, opts?: { rate?: number; force?: boolean }) => {
    if (!opts?.force && !enabled) return
    if (isTalkBackActiveRef.current) {
      AccessibilityInfo.announceForAccessibility(text)
      return
    }

    // Potong suara sebelumnya agar setiap pemanggilan langsung mengganti TTS lama
    await ttsService.stop()

    setSpeaking(true)
    try {
      await ttsService.speak(text, {
        locale: 'id-ID',
        rate: opts?.rate ?? contextRate,
        pitch: 1.0,
        onDone: () => setSpeaking(false),
      })
    } catch {
      setSpeaking(false)
    }
  }, [enabled, contextRate])

  const stop = useCallback(async () => {
    await ttsService.stop()
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking }
}
