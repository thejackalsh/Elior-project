import React, { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as MediaLibrary from 'expo-media-library'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { useTTS } from '../hooks/useTTS'

export default function PermissionGalleryScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { jwt, existing } = useLocalSearchParams<{ jwt: string; existing?: string }>()
  const { speak } = useTTS()
  useEffect(() => {
    speak(
      'Elior dapat menyimpan foto hasil pindai ke galeri. Ketuk Izinkan Galeri, atau Lewati jika tidak diperlukan.',
      { force: true },
    )
  }, [])

  const goNext = () => {
    if (existing === '1') {
      router.replace('/(tabs)/camera')
    } else {
      router.replace({ pathname: '/setup-name', params: { jwt } })
    }
  }

  const handleAllow = async () => {
    await MediaLibrary.requestPermissionsAsync()
    goNext()
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="images-outline" size={72} color={colors.text} />
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>Akses Galeri</Text>
        <Text style={styles.desc}>
          Elior dapat menyimpan foto hasil pindai ke galeri ponselmu sebagai catatan. Izin ini opsional.
        </Text>
        <Text style={styles.step}>3 / 3</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.allowBtn}
          onPress={handleAllow}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Izinkan akses galeri"
        >
          <Text style={styles.allowTxt}>Izinkan Galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={goNext}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Lewati izin galeri"
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
