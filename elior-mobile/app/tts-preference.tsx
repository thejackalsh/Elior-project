import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { useTts } from '../contexts/TtsContext'
import { useTTS } from '../hooks/useTTS'
import { ServiceFactory } from '../services/ServiceFactory'

const OPTIONS = [
  {
    value: true,
    label: 'Ya, aktifkan',
    desc: 'Hasil pindai dibacakan otomatis setelah setiap scan',
  },
  {
    value: false,
    label: 'Tidak, lewati',
    desc: 'Putar suara manual lewat tombol di layar hasil',
  },
]

const YES_WORDS = ['ya', 'iya', 'aktifkan', 'aktif', 'mau', 'bisa', 'setuju']
const NO_WORDS = ['tidak', 'jangan', 'lewati', 'skip', 'nggak', 'enggak']

export default function TtsPreferenceScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { setAutoSpeakPref } = useTts()
  const { speak, speaking } = useTTS()
  const [listening, setListening] = useState(false)
  const sttRef = useRef(ServiceFactory.stt())
  const prevSpeakingRef = useRef(false)

  useEffect(() => {
    const stt = sttRef.current

    stt.onResult((text) => {
      const lower = text.toLowerCase()
      if (YES_WORDS.some(w => lower.includes(w))) {
        handleChoice(true)
      } else if (NO_WORDS.some(w => lower.includes(w))) {
        handleChoice(false)
      }
    })
    stt.onStart(() => setListening(true))
    stt.onEnd(() => setListening(false))
    stt.onError(() => setListening(false))

    speak('Apakah kamu ingin hasil pindai dibacakan otomatis? Ucapkan ya atau tidak.', { force: true })

    return () => { stt.destroy() }
  }, [])

  // Auto-start STT setelah TTS selesai bicara
  useEffect(() => {
    if (prevSpeakingRef.current && !speaking) {
      sttRef.current.startListening('id-ID')
    }
    prevSpeakingRef.current = speaking
  }, [speaking])

  const handleChoice = (value: boolean) => {
    sttRef.current.stopListening()
    setAutoSpeakPref(value)
    router.replace('/onboarding')
  }

  const handleRetry = () => {
    sttRef.current.startListening('id-ID')
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.headingBlock}>
        <Text style={styles.heading}>Suara Otomatis</Text>
        <Text style={styles.subheading}>
          Pilih apakah hasil pindai langsung dibacakan setiap kali kamu memindai.
        </Text>
      </View>

      <View style={styles.options}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={String(opt.value)}
            style={styles.optionBtn}
            onPress={() => handleChoice(opt.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label}. ${opt.desc}`}
          >
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sttStatus}>
        {listening ? (
          <>
            <Ionicons name="mic" size={18} color={colors.text} />
            <Text style={styles.sttHint}>Mendengarkan...</Text>
          </>
        ) : (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={handleRetry}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Coba lagi dengan suara"
          >
            <Ionicons name="mic-outline" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.retryTxt}>Coba lagi dengan suara</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  headingBlock: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  heading: {
    fontFamily: 'Telma-Medium',
    fontSize: 40,
    letterSpacing: 4,
    color: colors.text,
  },
  subheading: {
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    lineHeight: 22,
  },
  options: {
    gap: spacing.md,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  optionTextWrap: {
    flex: 1,
    gap: 4,
  },
  optionLabel: {
    fontFamily: fonts.label,
    fontSize: 18,
    color: colors.text,
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  sttStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    minHeight: 40,
  },
  sttHint: {
    fontSize: 13,
    color: colors.text,
    letterSpacing: 0.5,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryTxt: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.5,
  },
})
