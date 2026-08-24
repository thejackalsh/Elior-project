import React from 'react'
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  View,
} from 'react-native'
import type { AccessibilityRole } from 'react-native'
import { BlurView } from 'expo-blur'
import { EliorText } from './EliorText'
import { colors, radius, spacing } from '../../constants/theme'

type ButtonVariant = 'glass' | 'solid' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface EliorButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  style?: StyleProp<ViewStyle>
  labelStyle?: TextStyle
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  accessibilityLabel?: string
  accessibilityRole?: AccessibilityRole
  accessibilityHint?: string
  accessibilityState?: object
}

const sizeMap: Record<ButtonSize, { paddingH: number; paddingV: number }> = {
  sm: { paddingH: spacing.md, paddingV: spacing.sm },
  md: { paddingH: spacing.lg, paddingV: spacing.md },
  lg: { paddingH: spacing.xl, paddingV: spacing.md + 4 },
}

export function EliorButton({
  label,
  onPress,
  variant = 'glass',
  size = 'md',
  style,
  labelStyle,
  disabled,
  loading,
  icon,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  accessibilityState,
}: EliorButtonProps) {
  const { paddingH, paddingV } = sizeMap[size]
  const isDisabled = disabled || loading

  const content = (
    <View style={styles.row}>
      {icon && <View style={styles.icon}>{icon}</View>}
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <EliorText variant="subheading" style={[styles.label, labelStyle]}>
          {label}
        </EliorText>
      )}
    </View>
  )

  const a11y = { accessibilityLabel, accessibilityRole, accessibilityHint, accessibilityState } as const

  if (variant === 'glass') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.7}
        style={[styles.wrapper, isDisabled && styles.disabled, style]}
        {...a11y}
      >
        <BlurView intensity={20} tint="dark" style={styles.blur}>
          <View
            style={[
              styles.glassInner,
              { paddingHorizontal: paddingH, paddingVertical: paddingV },
            ]}
          >
            {content}
          </View>
        </BlurView>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.wrapper,
        styles.plain,
        { paddingHorizontal: paddingH, paddingVertical: paddingV },
        variant === 'solid' && styles.solid,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  blur: {
    width: '100%',
  },
  glassInner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  plain: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  solid: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    marginRight: 2,
  },
  label: {
    color: colors.text,
  },
  disabled: {
    opacity: 0.4,
  },
})
