import React from 'react'
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native'
import { BlurView } from 'expo-blur'
import { colors, radius, spacing } from '../../constants/theme'

interface GlassCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  intensity?: number
  padding?: number
}

export function GlassCard({
  children,
  style,
  intensity = 15,
  padding = spacing.md,
}: GlassCardProps) {
  return (
    <BlurView intensity={intensity} tint="dark" style={[styles.blur, style]}>
      <View style={[styles.inner, { padding }]}>
        {children}
      </View>
    </BlurView>
  )
}

const styles = StyleSheet.create({
  blur: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
})
