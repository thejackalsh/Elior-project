import React, { useEffect, useRef } from 'react'
import { Pressable, Animated, StyleSheet } from 'react-native'
import { colors } from '../../constants/theme'

const TRACK_W = 48
const TRACK_H = 28
const THUMB = 18
const PAD = (TRACK_H - THUMB) / 2 // thumb tertanam di dalam track

interface Props {
  value: boolean
  onValueChange: (v: boolean) => void
  accessibilityLabel?: string
}

export function EliorSwitch({ value, onValueChange, accessibilityLabel }: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start()
  }, [value, anim])

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, TRACK_W - THUMB - PAD],
  })
  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.55)'],
  })

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.text,
  },
})
