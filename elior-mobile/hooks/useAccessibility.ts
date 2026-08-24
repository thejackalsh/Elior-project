import { useEffect, useState, useCallback } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useAccessibility() {
  const [isTalkBackActive, setIsTalkBackActive] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsTalkBackActive)

    const sub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsTalkBackActive,
    )

    return () => sub.remove()
  }, [])

  const announce = useCallback(
    (message: string) => {
      AccessibilityInfo.announceForAccessibility(message)
    },
    [],
  )

  const announceLoud = useCallback(
    (message: string) => {
      // assertive — interrupt TalkBack immediately
      AccessibilityInfo.announceForAccessibilityWithOptions?.(message, {
        queue: false,
      })
    },
    [],
  )

  return { isTalkBackActive, announce, announceLoud }
}
