import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import { colors, spacing, radius, fonts } from '../constants/theme'
import { useTts } from '../contexts/TtsContext'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface FeatureItem {
  title: string
  desc: string
  points: string[]
}

const FEATURES: FeatureItem[] = [
  {
    title: 'Deteksi Uang Rupiah',
    desc: 'Arahkan kamera ke uang, Elior menyebutkan nominalnya dengan suara — langsung di perangkat, tanpa menunggu.',
    points: [
      '7 uang kertas + 2 koin (Rp500 & Rp1.000), Tahun Emisi 2022',
      'Ditenagai model deteksi gambar, berjalan di perangkat',
      'Hasil dibacakan otomatis lewat suara',
    ],
  },
  {
    title: 'Pembacaan Teks (OCR)',
    desc: 'Baca kemasan produk, papan petunjuk, struk, atau dokumen cetak hanya dengan mengarahkan kamera.',
    points: [
      'Model OCR berjalan di perangkat, sepenuhnya offline',
      'Urutan baca dirapikan otomatis',
      'Cocok untuk teks Bahasa Indonesia',
    ],
  },
  {
    title: 'Deskripsi Objek & Pemandangan',
    desc: 'Elior menjelaskan apa yang ada di depan kamu dalam kalimat utuh Bahasa Indonesia, bukan sekadar nama benda.',
    points: [
      'Memadukan model deteksi objek + model bahasa visual',
      'Deskripsi kontekstual, bukan sekadar label',
    ],
  },
  {
    title: 'Pindai Kode QR',
    desc: 'Deteksi kode QR secara langsung dan buka tautannya dengan mudah, dipandu suara di setiap langkah.',
    points: [
      'Deteksi langsung dari kamera',
      'Membacakan isi & membuka tautan',
      'Tanpa perlu aplikasi tambahan',
    ],
  },
]

const INTRO = 'Elior membantu penyandang tunanetra mengenali uang, membaca teks, dan memahami lingkungan sekitar — semua dibacakan dengan suara dalam Bahasa Indonesia.'

const STEPS: { title: string; desc: string }[] = [
  {
    title: 'Pilih mode',
    desc: 'Tekan satu tombol untuk berganti mode: Objek, Uang, QR, atau Baca Teks.',
  },
  {
    title: 'Arahkan & pindai',
    desc: 'Arahkan kamera ke sasaran, lalu tekan tombol Pindai.',
  },
  {
    title: 'Dengar hasilnya',
    desc: 'Elior membacakan hasil dengan suara dalam Bahasa Indonesia, otomatis.',
  },
]

function Para({ children }: { children: React.ReactNode }) {
  return <Text style={styles.para}>{children}</Text>
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={[styles.para, styles.bulletText]}>{children}</Text>
    </View>
  )
}

const FULL_TEXT = [
  'Tentang Elior.',
  'Teknologi Asistif Berbasis AI.',
  INTRO,
  'Fitur.',
  ...FEATURES.map((f) => `${f.title}. ${f.desc} ${f.points.join('. ')}.`),
  'Cara penggunaan.',
  ...STEPS.map((s, i) => `Langkah ${i + 1}. ${s.title}. ${s.desc}`),
].join(' ')

function FeatureBlock({ item }: { item: FeatureItem }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{item.title}</Text>
      <Para>{item.desc}</Para>
      {item.points.map((p) => (
        <BulletItem key={p}>{p}</BulletItem>
      ))}
    </View>
  )
}

export default function TentangScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { say, stop } = useTts()

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header (chevron + judul sejajar) ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => { stop(); say('Profil'); router.back() }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Kembali ke Profil"
        >
          <Ionicons name={'chevron-back' as IoniconName} size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Tentang Elior</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.tagline}>Teknologi Asistif Berbasis AI</Text>
        <Para>
          <Text style={styles.bold}>Elior</Text> membantu penyandang tunanetra
          mengenali uang, membaca teks, dan memahami lingkungan sekitar — semua
          dibacakan dengan suara dalam Bahasa Indonesia.
        </Para>

        <Text style={styles.groupLabel}>FITUR</Text>
        {FEATURES.map((item) => (
          <FeatureBlock key={item.title} item={item} />
        ))}

        <Text style={styles.groupLabel}>CARA PENGGUNAAN</Text>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {i + 1}. {s.title}
            </Text>
            <Para>{s.desc}</Para>
          </View>
        ))}

        <Text style={styles.versionInfo}>
          Versi {Constants.expoConfig?.version ?? '-'} · Runtime {Updates.runtimeVersion ?? '-'}
          {Updates.isEmbeddedLaunch
            ? ' · Build APK'
            : Updates.updateId
              ? ` · OTA ${Updates.updateId.slice(0, 8)}`
              : ''}
        </Text>
      </ScrollView>

      {/* ── Tombol Bacakan fix di bawah (tidak ikut scroll) ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={styles.bacakanBtn}
          onPress={() => say(FULL_TEXT, { force: true })}
          accessibilityRole="button"
          accessibilityLabel="Bacakan tentang Elior"
        >
          <Ionicons name={'volume-high-outline' as IoniconName} size={18} color={colors.bg} />
          <Text style={styles.bacakanTxt}>Bacakan</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  pageTitle: {
    fontFamily: 'Telma-Medium',
    fontSize: 26,
    letterSpacing: 1,
    color: colors.text,
    includeFontPadding: false,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  bacakanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.text,
  },
  bacakanTxt: {
    color: colors.bg,
    fontSize: 16,
    letterSpacing: 1,
    fontFamily: 'Telma-Medium',
  },
  tagline: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  groupLabel: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginTop: spacing.xl,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.label,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  para: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  bold: {
    color: colors.text,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  bullet: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
  },
  versionInfo: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
