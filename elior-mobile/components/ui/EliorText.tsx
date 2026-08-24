import React from 'react'
import { Text, TextStyle, StyleSheet, StyleProp, TextProps } from 'react-native'
import { colors, fonts } from '../../constants/theme'

type TextVariant = 'display' | 'heading' | 'subheading' | 'body' | 'caption'

interface EliorTextProps extends Omit<TextProps, 'style'> {
  variant?: TextVariant
  children: React.ReactNode
  style?: StyleProp<TextStyle>
}

const variantStyles: Record<TextVariant, TextStyle> = {
  display: {
    fontFamily: 'Telma-Medium',
    fontSize: 52,
    letterSpacing: 4,
    lineHeight: 64,
  },
  heading: {
    fontFamily: fonts.label,
    fontSize: 24,
    letterSpacing: 1,
    lineHeight: 32,
  },
  subheading: {
    fontFamily: fonts.label,
    fontSize: 14,
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    letterSpacing: 0.3,
    lineHeight: 18,
    color: colors.textSecondary,
  },
}

export function EliorText({ variant = 'body', children, style, ...rest }: EliorTextProps) {
  return (
    <Text style={[styles.base, variantStyles[variant], style]} {...rest}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
  },
})
