import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { apiUpdateVisionStatus, type VisionStatus } from '../services/authService'
import { useAuth } from '../contexts/AuthContext'
import { useTts } from '../contexts/TtsContext'
import { useTTS } from '../hooks/useTTS'
import { ServiceFactory } from '../services/ServiceFactory'

const OPTIONS: { value: VisionStatus; label: string; desc: string; keywords: string[] }[] = [
  {
    value: 'tidak_ada',
    label: 'Normal',
    desc: 'Penglihatan saya normal',
    keywords: ['normal', 'biasa', 'baik', 'oke'],
  },
  {
    value: 'low_vision',
    label: 'Penglihatan Lemah',
    desc: 'Penglihatan saya terbatas',
    keywords: ['lemah', 'kurang', 'terbatas', 'low', 'penglihatan lemah'],
  },
  {
    value: 'buta_total',
    label: 'Tunanetra',
    desc: 'Saya tidak dapat melihat sama sekali',
    keywords: ['tunanetra', 'buta', 'total', 'tidak bisa melihat'],
  },
]

export default function VisionStatusScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { jwt } = useLocalSearchParams<{ jwt: string }>()
  const { token, updateProfile } = useAuth()
  const { speak, speaking } = useTTS()
  const { setEnabled, setAutoSpeakPref } = useTts()
  const [saving, setSaving] = useState<VisionStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const sttRef = useRef(ServiceFactory.stt())
  const prevSpeakingRef = useRef(false)

  useEffect(() => {
    const stt = sttRef.current

    stt.onResult((text) => {
      const lower = text.toLowerCase()
      const match = OPTIONS.find(opt =>
        opt.keywords.some(kw => lower.includes(kw))
      )
      if (match) handleSelect(match.value)
    })
    stt.onStart(() => setListening(true))
    stt.onEnd(() => setListening(false))
    stt.onError(() => setListening(false))

    speak(
      'Bagaimana kondisi penglihatanmu? Ucapkan: Normal, Penglihatan lemah, atau Tunanetra.',
      { force: true },
    )

    return () => { stt.destroy() }
  }, [])

  // Auto-start STT setelah TTS selesai bicara
  useEffect(() => {
    if (prevSpeakingRef.current && !speaking && saving === null) {
      sttRef.current.startListening('id-ID')
    }
    prevSpeakingRef.current = speaking
  }, [speaking])

  const handleSelect = async (value: VisionStatus) => {
    const authToken = token ?? jwt
    if (!authToken || saving) return
    sttRef.current.stopListening()
    setSaving(value)
    setError(null)
    try {
      await apiUpdateVisionStatus(authToken, value)
      await updateProfile({ visionStatus: value })
      if (value === 'buta_total' || value === 'low_vision') {
        setEnabled(true)
        setAutoSpeakPref(true)
      }
      router.replace('/tts-preference')
    } catch (e: any) {
      const raw: string = e?.message ?? ''
      const isNetwork = raw.toLowerCase().includes('network') || raw.toLowerCase().includes('failed') || raw.toLowerCase().includes('connection')
      setError(isNetwork ? 'Tidak dapat terhubung. Periksa koneksi internet.' : (raw || 'Gagal menyimpan. Coba lagi.'))
      setSaving(null)
    }
  }

  const handleRetry = () => {
    sttRef.current.startListening('id-ID')
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.headingBlock}>
        <Text style={styles.heading}>Kategori</Text>
        <Text style={styles.subheading}>
          Membantu kami menyesuaikan pengalaman untukmu.
        </Text>
      </View>

      <View style={styles.options}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.optionBtn}
            onPress={() => handleSelect(opt.value)}
            disabled={saving != null}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${opt.label}. ${opt.desc}`}
          >
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionDesc}>{opt.desc}</Text>
            </View>
            {saving === opt.value && <ActivityIndicator size="small" color={colors.text} />}
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
            disabled={saving != null}
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
    justifyContent: 'space-between',
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
  },
  errorText: {
    marginTop: spacing.lg,
    fontSize: 13,
    color: '#ff6060',
    letterSpacing: 0.3,
    textAlign: 'center',
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
