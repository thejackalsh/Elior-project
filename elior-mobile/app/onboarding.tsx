import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { useTts } from '../contexts/TtsContext'
import { useTTS } from '../hooks/useTTS'
import { TOUR_KEY } from '../components/ui'

export const ONBOARDED_KEY = '@elior_onboarded'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface TourStep {
  icon: IoniconName
  badge?: string
  title: string
  desc: string
  spoken: string
}

const STEPS: TourStep[] = [
  {
    icon: 'cube-outline',
    badge: 'Butuh internet',
    title: 'Mode Objek',
    desc: 'Arahkan kamera ke benda apa saja — Elior akan mendeskripsikannya dengan kalimat lengkap. Cocok untuk mengenali makanan, produk, rambu, dan benda sehari-hari.\n\nMembutuhkan koneksi internet karena diproses di server.',
    spoken: 'Mode Objek. Arahkan kamera ke benda apa saja, Elior akan mendeskripsikannya. Cocok untuk mengenali makanan, produk, rambu, dan benda sehari-hari. Mode ini membutuhkan koneksi internet.',
  },
  {
    icon: 'text-outline',
    badge: 'Bisa offline',
    title: 'Mode Baca',
    desc: 'Arahkan ke teks — dokumen, label produk, brosur, menu — Elior akan membacakan isinya. Bekerja tanpa koneksi internet menggunakan teknologi pengenalan teks langsung di ponsel.',
    spoken: 'Mode Baca. Arahkan ke teks seperti dokumen, label, atau menu. Elior akan membacakannya. Mode ini bisa digunakan tanpa internet.',
  },
  {
    icon: 'qr-code-outline',
    badge: 'Bisa offline',
    title: 'Mode QR',
    desc: 'Pindai kode QR apa saja. Tautan akan dibacakan dan bisa langsung dibuka. Bekerja sepenuhnya di ponsel tanpa koneksi internet.',
    spoken: 'Mode Q R. Pindai kode Q R apa saja. Tautan akan dibacakan dan bisa langsung dibuka. Mode ini bisa digunakan tanpa internet.',
  },
  {
    icon: 'cash-outline',
    badge: 'Segera hadir',
    title: 'Mode Uang',
    desc: 'Akan mengenali nilai uang kertas Rupiah secara otomatis. Fitur ini sedang dalam pengembangan dan akan segera tersedia di pembaruan berikutnya.',
    spoken: 'Mode Uang. Fitur ini akan mengenali nilai uang kertas Rupiah secara otomatis. Saat ini masih dalam pengembangan dan akan segera hadir.',
  },
  {
    icon: 'images-outline',
    title: 'Riwayat Memori',
    desc: 'Setiap hasil pindai disimpan otomatis di tab Memori. Kamu bisa melihat kembali teks dan foto dari semua scan sebelumnya, serta menghapus yang tidak diperlukan.',
    spoken: 'Riwayat Memori. Setiap hasil pindai disimpan otomatis di tab Memori. Kamu bisa melihat kembali teks dan foto dari semua scan sebelumnya.',
  },
  {
    icon: 'accessibility-outline',
    title: 'Pengguna Tunanetra',
    desc: 'Jika kamu tidak dapat melihat layar sama sekali, aktifkan TalkBack di Pengaturan › Aksesibilitas › TalkBack. TalkBack adalah pembaca layar bawaan Android yang membacakan semua elemen antarmuka secara otomatis.',
    spoken: 'Untuk pengguna tunanetra. Aktifkan Talk Back di Pengaturan, Aksesibilitas, Talk Back. Talk Back adalah pembaca layar bawaan Android yang membacakan semua elemen antarmuka secara otomatis. Elior bekerja penuh bersama Talk Back.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Bantu Kami Berkembang',
    desc: 'Setelah mencoba semua fitur, buka tab Profil dan ketuk "Masukan". Pendapatmu sangat berarti untuk memperbaiki Elior — terutama dari pengguna langsung yang merasakan manfaatnya.',
    spoken: 'Bantu kami berkembang. Setelah mencoba semua fitur, buka tab Profil dan ketuk Masukan. Pendapatmu sangat berarti untuk memperbaiki Elior.',
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { speak, stop } = useTTS()
  const { autoSpeakPref, say } = useTts()
  const [step, setStep] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    if (autoSpeakPref) speak(current.spoken)
    return () => { stop() }
  }, [step, autoSpeakPref])

  const goToStep = (next: number) => {
    stop()
    say(next > step ? 'Lanjut' : 'Kembali')
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start()
    setStep(next)
  }

  const handleFinish = async () => {
    stop()
    say('Mulai')
    await AsyncStorage.setItem(ONBOARDED_KEY, '1')
    await AsyncStorage.removeItem(TOUR_KEY)
    router.replace('/(tabs)/camera')
  }

  const handleTap = () => {
    if (isLast) handleFinish()
    else goToStep(step + 1)
  }

  return (
    <Pressable
      style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
      onPress={handleTap}
      accessibilityRole="button"
      accessibilityLabel={isLast ? 'Mulai pakai Elior' : 'Ketuk untuk lanjut'}
    >
      {/* Step dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.iconWrap}>
          <Ionicons name={current.icon} size={64} color={colors.text} />
        </View>

        {current.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{current.badge}</Text>
          </View>
        )}

        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.desc}>{current.desc}</Text>

        <Text style={styles.stepLabel}>{step + 1} / {STEPS.length}</Text>
        {step === 0 && (
          <Text style={styles.tapHint}>Ketuk layar mana saja untuk lanjut</Text>
        )}
      </Animated.View>

      {/* Footer — hanya tombol Kembali jika bukan step pertama, dan Mulai di step terakhir */}
      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={(e) => { e.stopPropagation?.(); goToStep(step - 1) }}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke langkah sebelumnya"
          >
            <Ionicons name={'chevron-back' as IoniconName} size={20} color="rgba(255,255,255,0.5)" />
            <Text style={styles.backTxt}>Kembali</Text>
          </TouchableOpacity>
        )}
        {isLast && (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={(e) => { e.stopPropagation?.(); handleFinish() }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Mulai pakai Elior"
          >
            <Text style={styles.startTxt}>Mulai</Text>
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: colors.text,
    width: 18,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  badgeTxt: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'Telma-Medium',
    fontSize: 26,
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
    paddingHorizontal: spacing.sm,
  },
  stepLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 2,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 52,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnFull: {
    flex: 1,
  },
  nextTxt: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 2,
  },
  tapHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1.5,
    marginTop: spacing.sm,
  },
  backTxt: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  startBtn: {
    flex: 1,
    height: 52,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTxt: {
    fontFamily: fonts.label,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 2,
  },
})
