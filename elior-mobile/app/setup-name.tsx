import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { apiUpdateName } from '../services/authService'
import { ServiceFactory } from '../services/ServiceFactory'
import { useTTS } from '../hooks/useTTS'

export default function SetupNameScreen() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)

  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { jwt } = useLocalSearchParams<{ jwt: string }>()
  const { speak } = useTTS()
  const sttRef = useRef(ServiceFactory.stt())

  useEffect(() => {
    const stt = sttRef.current
    stt.onResult((text) => {
      setName(prev => {
        const trimmed = text.trim()
        return trimmed || prev
      })
    })
    stt.onStart(() => setListening(true))
    stt.onEnd(() => setListening(false))
    stt.onError(() => setListening(false))

    speak('Siapa namamu? Ketuk kolom nama dan ketik, atau ketuk tombol mikrofon untuk bicara.', { force: true })

    return () => { stt.destroy() }
  }, [])

  const handleMic = async () => {
    const stt = sttRef.current
    if (listening) {
      await stt.stopListening()
    } else {
      Keyboard.dismiss()
      await stt.startListening('id-ID')
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Nama harus diisi'); return }
    if (name.trim().length < 2) { setError('Nama terlalu pendek'); return }

    setLoading(true)
    setError(null)
    try {
      Keyboard.dismiss()
      await apiUpdateName(jwt, name.trim())
      router.replace({ pathname: '/vision-status', params: { jwt } })
    } catch (e: any) {
      const raw: string = e?.message ?? ''
      const isNetwork = raw.toLowerCase().includes('network') || raw.toLowerCase().includes('failed') || raw.toLowerCase().includes('connection')
      setError(isNetwork ? 'Tidak dapat terhubung. Periksa koneksi internet.' : (raw || 'Terjadi kesalahan. Coba lagi.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Siapa namamu?</Text>
          <Text style={styles.subheading}>
            Digunakan untuk menyapa kamu di aplikasi.
          </Text>
        </View>

        <BlurView intensity={12} tint="dark" style={styles.card}>
          <View style={styles.cardInner}>
            <View style={styles.field}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Masukkan namamu"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  autoFocus
                  accessibilityLabel="Nama lengkap"
                />
                <TouchableOpacity
                  style={[styles.micBtn, listening && styles.micBtnActive]}
                  onPress={handleMic}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={listening ? 'Berhenti mendengarkan' : 'Ucapkan nama'}
                >
                  <Ionicons
                    name={listening ? 'mic' : 'mic-outline'}
                    size={22}
                    color={listening ? colors.bg : colors.text}
                  />
                </TouchableOpacity>
              </View>
              {listening && (
                <Text style={styles.listeningHint}>Mendengarkan...</Text>
              )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Mulai"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.submitText}>Mulai</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
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
  card: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInner: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  listeningHint: {
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#ff6060',
    letterSpacing: 0.3,
  },
  submitBtn: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fonts.label,
    fontSize: 13,
    color: colors.bg,
    letterSpacing: 2,
  },
})
