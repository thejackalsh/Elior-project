import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Camera } from 'expo-camera'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { useTTS } from '../hooks/useTTS'

export default function PermissionCameraScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { jwt } = useLocalSearchParams<{ jwt: string }>()
  const { speak } = useTTS()
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle')

  useEffect(() => {
    speak(
      'Elior membutuhkan akses kamera untuk memindai objek. Ketuk Izinkan Kamera untuk melanjutkan.',
      { force: true },
    )
  }, [])

  const handleAllow = async () => {
    const result = await Camera.requestCameraPermissionsAsync()
    if (result.granted) {
      setStatus('granted')
      router.replace({ pathname: '/permission-mic', params: { jwt } })
    } else {
      setStatus('denied')
      speak('Akses kamera ditolak. Kamera dibutuhkan untuk memindai. Ketuk Coba Lagi.', { force: true })
    }
  }

  const handleSkip = () => {
    router.replace({ pathname: '/permission-mic', params: { jwt } })
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="camera-outline" size={72} color={colors.text} />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>Akses Kamera</Text>
        <Text style={styles.desc}>
          Elior membutuhkan kamera untuk memindai dan mengenali objek, uang, teks, dan kode QR di sekitarmu.
        </Text>
        <Text style={styles.step}>1 / 3</Text>
      </View>

      {status === 'denied' && (
        <Text style={styles.errorText}>
          Izin ditolak. Kamera wajib untuk fitur utama Elior.
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.allowBtn}
          onPress={handleAllow}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Izinkan akses kamera"
        >
          <Text style={styles.allowTxt}>
            {status === 'denied' ? 'Coba Lagi' : 'Izinkan Kamera'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Lewati untuk sekarang"
        >
          <Text style={styles.skipTxt}>Lewati</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: 'Telma-Medium',
    fontSize: 32,
    color: colors.text,
    letterSpacing: 3,
    textAlign: 'center',
  },
  desc: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    lineHeight: 23,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  step: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: 13,
    color: '#ff6060',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  allowBtn: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  allowTxt: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 2,
  },
  skipBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  skipTxt: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  },
})
