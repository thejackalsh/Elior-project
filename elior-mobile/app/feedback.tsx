import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { useAuth } from '../contexts/AuthContext'
import { useAccessibility } from '../hooks/useAccessibility'
import { useTts } from '../contexts/TtsContext'
import { submitFeedback, type Scale5, type FeedbackInput } from '../services/feedback'

const PETUNJUK = 'Halaman Masukan. Beri nilai satu sampai lima untuk tiap pertanyaan. Satu berarti paling rendah, lima berarti paling tinggi. Ketuk pertanyaan untuk mendengarnya kembali.'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type QKey = 'navigasi' | 'kemudahan' | 'kualitas' | 'akurasi' | 'manfaat' | 'niat_pakai'

interface Question {
  key: QKey
  question: string
  labelMin: string
  labelMax: string
}

const QUESTIONS: Question[] = [
  {
    key: 'navigasi',
    question: 'Seberapa mudah berpindah antar bagian aplikasi?',
    labelMin: 'Sangat sulit',
    labelMax: 'Sangat mudah',
  },
  {
    key: 'kemudahan',
    question: 'Seberapa mudah aplikasi ini digunakan secara keseluruhan?',
    labelMin: 'Sangat sulit',
    labelMax: 'Sangat mudah',
  },
  {
    key: 'kualitas',
    question: 'Bagaimana kualitas dan kestabilan aplikasi?',
    labelMin: 'Sangat buruk',
    labelMax: 'Sangat baik',
  },
  {
    key: 'akurasi',
    question: 'Seberapa akurat hasil deteksi (uang, teks, objek)?',
    labelMin: 'Sangat tidak akurat',
    labelMax: 'Sangat akurat',
  },
  {
    key: 'manfaat',
    question: 'Aplikasi ini membantu saya dalam kehidupan sehari-hari.',
    labelMin: 'Sangat tidak setuju',
    labelMax: 'Sangat setuju',
  },
  {
    key: 'niat_pakai',
    question: 'Saya akan terus menggunakan aplikasi ini ke depannya.',
    labelMin: 'Sangat tidak setuju',
    labelMax: 'Sangat setuju',
  },
]

const SCALE: Scale5[] = [1, 2, 3, 4, 5]

export default function FeedbackScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { token } = useAuth()
  const { announce } = useAccessibility()
  const { say, stop } = useTts()

  // Bacakan petunjuk pengisian saat layar dibuka
  useEffect(() => { say(PETUNJUK) }, [say])

  const speakQuestion = (q: Question) =>
    say(`${q.question}. Skala satu sampai lima. Satu berarti ${q.labelMin}, lima berarti ${q.labelMax}.`)

  const [answers, setAnswers] = useState<Record<QKey, Scale5 | undefined>>({
    navigasi: undefined, kemudahan: undefined, kualitas: undefined,
    akurasi: undefined, manfaat: undefined, niat_pakai: undefined,
  })
  const [komentar, setKomentar] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasAnswer = Object.values(answers).some((v) => v != null) || komentar.trim().length > 0

  const handleSubmit = async () => {
    if (!token || !hasAnswer || saving) return
    setSaving(true)
    setError(null)
    const payload: FeedbackInput = {
      navigasi:   answers.navigasi,
      kemudahan:  answers.kemudahan,
      kualitas:   answers.kualitas,
      akurasi:    answers.akurasi,
      manfaat:    answers.manfaat,
      niat_pakai: answers.niat_pakai,
      komentar:   komentar.trim() || undefined,
    }
    try {
      await submitFeedback(token, payload)
      announce('Terima kasih atas masukanmu')
      router.back()
    } catch (e: any) {
      const raw: string = e?.message ?? ''
      const isNetwork = raw.toLowerCase().includes('network') || raw.toLowerCase().includes('failed') || raw.toLowerCase().includes('connection')
      setError(isNetwork ? 'Tidak dapat terhubung. Periksa koneksi internet.' : (raw || 'Gagal mengirim masukan. Coba lagi.'))
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity
          onPress={() => { stop(); say('Profil'); router.back() }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Kembali ke Profil"
        >
          <Ionicons name={'chevron-back' as IoniconName} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Masukan</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>Bantu kami memperbaiki Elior. Jawab seperlunya.</Text>

        {QUESTIONS.map((q) => (
          <View key={q.key} style={styles.questionBlock}>
            <View style={styles.questionRow}>
              <Text style={styles.questionText}>{q.question}</Text>
              <TouchableOpacity
                style={styles.speakBtn}
                onPress={() => speakQuestion(q)}
                accessibilityRole="button"
                accessibilityLabel={`Bacakan: ${q.question}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={'volume-high-outline' as IoniconName} size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.scaleRow}>
              {SCALE.map((n) => {
                const selected = answers[q.key] === n
                const meaning = n === 1 ? q.labelMin : n === 5 ? q.labelMax : `nilai ${n}`
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.scaleBtn, selected && styles.scaleBtnSelected]}
                    onPress={() => { say(meaning); setAnswers((a) => ({ ...a, [q.key]: n })) }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${q.question} — nilai ${n}`}
                  >
                    <Text style={[styles.scaleNum, selected && styles.scaleNumSelected]}>{n}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={styles.scaleLegend}>
              <Text style={styles.legendText}>{q.labelMin}</Text>
              <Text style={styles.legendText}>{q.labelMax}</Text>
            </View>
          </View>
        ))}

        <View style={styles.questionBlock}>
          <Text style={styles.questionText}>Saran atau masalah (opsional)</Text>
          <TextInput
            style={styles.komentar}
            value={komentar}
            onChangeText={setKomentar}
            placeholder="Tulis di sini..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            maxLength={500}
            selectionColor={colors.text}
            accessibilityLabel="Saran atau masalah"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, (!hasAnswer || saving) && styles.submitDisabled]}
          onPress={() => { say('Kirim'); handleSubmit() }}
          disabled={!hasAnswer || saving}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Kirim masukan"
        >
          <Text style={styles.submitText}>{saving ? 'Mengirim...' : 'Kirim'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    padding: spacing.xs,
  },
  title: {
    fontFamily: 'Telma-Medium',
    fontSize: 26,
    color: colors.text,
    letterSpacing: 1,
    includeFontPadding: false,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  intro: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  questionBlock: {
    gap: spacing.xs,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    letterSpacing: 0.2,
    lineHeight: 20,
  },
  speakBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  scaleBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  scaleBtnSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  scaleNum: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scaleNumSelected: {
    color: colors.bg,
    fontWeight: '700',
  },
  scaleLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  legendText: {
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  komentar: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    letterSpacing: 0.2,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    color: '#ff6060',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 2,
  },
})
