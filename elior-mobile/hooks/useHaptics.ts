import { useCallback } from 'react'
import * as Haptics from 'expo-haptics'

export function useHaptics() {
  // Short tap — trigger confirmed
  const tapLight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  // Scan triggered
  const tapMedium = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }, [])

  // Result ready — double pulse
  const resultReady = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    }, 120)
  }, [])

  // Error — long warning
  const error = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  }, [])

  // Success
  const success = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [])

  return { tapLight, tapMedium, resultReady, error, success }
}
