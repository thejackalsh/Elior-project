import React, { useEffect, useState } from 'react'
import { Redirect, useRouter } from 'expo-router'
import { View } from 'react-native'
import { Camera } from 'expo-camera'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../constants/theme'

const DEV_BYPASS_AUTH = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === 'true'

export default function Index() {
  const { token, loading } = useAuth()
  const router = useRouter()
  const [permChecked, setPermChecked] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!DEV_BYPASS_AUTH && !token) { setPermChecked(true); return }

    Camera.getCameraPermissionsAsync().then(({ granted }) => {
      if (!granted) {
        router.replace({ pathname: '/permission-camera', params: { jwt: token ?? '', existing: '1' } })
      } else {
        router.replace('/(tabs)/camera')
      }
      setPermChecked(true)
    })
  }, [loading, token])

  if (loading || !permChecked) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }

  if (!DEV_BYPASS_AUTH && !token) {
    return <Redirect href="/login" />
  }

  return <View style={{ flex: 1, backgroundColor: colors.bg }} />
}
