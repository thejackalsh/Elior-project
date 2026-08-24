import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, spacing, radius } from '../../constants/theme'
import { RATE_MIN, RATE_MAX, RATE_STEP } from '../../contexts/TtsContext'

interface Props {
  rate: number
  onChange: (r: number) => void
  min?: number
  max?: number
  step?: number
}

export function SpeedSlider({ rate, onChange, min = RATE_MIN, max = RATE_MAX, step = RATE_STEP }: Props) {
  const decrease = () => {
    const next = parseFloat(Math.max(min, rate - step).toFixed(1))
    onChange(next)
  }
  const increase = () => {
    const next = parseFloat(Math.min(max, rate + step).toFixed(1))
    onChange(next)
  }

  const atMin = rate <= min
  const atMax = rate >= max

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.btn, atMin && styles.btnDisabled]}
        onPress={decrease}
        disabled={atMin}
        accessibilityRole="button"
        accessibilityLabel="Kurangi kecepatan"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.65}
      >
        <Text style={[styles.btnText, atMin && styles.btnTextDisabled]}>−</Text>
      </TouchableOpacity>

      <Text style={styles.rateText}>{rate.toFixed(1)}×</Text>

      <TouchableOpacity
        style={[styles.btn, atMax && styles.btnDisabled]}
        onPress={increase}
        disabled={atMax}
        accessibilityRole="button"
        accessibilityLabel="Tambah kecepatan"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.65}
      >
        <Text style={[styles.btnText, atMax && styles.btnTextDisabled]}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'transparent',
  },
  btnText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 26,
  },
  btnTextDisabled: {
    color: 'rgba(255,255,255,0.2)',
  },
  rateText: {
    minWidth: 72,
    textAlign: 'center',
    color: colors.text,
    fontSize: 28,
    letterSpacing: 1,
  },
})
