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
import { colors, spacing, radius, fonts } from '../constants/theme'
import { useTts } from '../contexts/TtsContext'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const PRIVACY_TTS = [
  'Kebijakan Privasi.',
  'Aplikasi Elior menghormati privasi pengguna dan berkomitmen melindungi data pribadi sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi.',
  'Satu. Data yang kami kumpulkan: nama lengkap dan alamat email untuk identifikasi akun; riwayat pindai; serta log penggunaan untuk peningkatan layanan.',
  'Dua. Tujuan penggunaan data: menjalankan autentikasi akun, menyimpan riwayat pindai, meningkatkan akurasi model, dan penelitian akademik.',
  'Tiga. Berbagi data: data tidak dijual. Data dapat dibagikan ke layanan komputasi awan dan Google Cloud Vision atau ML Kit untuk pemrosesan gambar.',
  'Empat. Keamanan data: password disimpan sebagai hash bcrypt, token akses memakai JWT dengan masa berlaku 30 hari.',
  'Lima. Hak kamu: mengakses data, menghapus riwayat pindai satu per satu melalui menu Memori, serta menghapus akun dengan menghubungi email kevin@elior.my.id.',
  'Enam. Retensi data: data akun disimpan selama akun aktif. Penghapusan akun menghapus seluruh data terkait secara permanen.',
  'Tujuh. Kontak: pertanyaan dapat disampaikan melalui email kevin@elior.my.id.',
].join(' ')

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

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

export default function PrivacyScreen() {
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
        <Text style={styles.pageTitle}>Kebijakan Privasi</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Terakhir diperbarui: Juni 2025</Text>
        <Para>
          Aplikasi Elior menghormati privasi pengguna dan berkomitmen melindungi
          data pribadi sesuai Undang-Undang No. 27 Tahun 2022 tentang
          Perlindungan Data Pribadi (UU PDP).
        </Para>

        <Section title="1. Data yang Kami Kumpulkan">
          <Para>Kami mengumpulkan data berikut saat kamu menggunakan Elior:</Para>
          <BulletItem>
            <Text style={styles.bold}>Nama lengkap dan alamat email</Text> — untuk
            identifikasi akun.
          </BulletItem>
          <BulletItem>
            <Text style={styles.bold}>Riwayat pindai</Text> — hasil deteksi mata
            uang dan objek yang kamu simpan.
          </BulletItem>
          <BulletItem>
            <Text style={styles.bold}>Log penggunaan</Text> — jenis fitur yang
            digunakan, untuk keperluan peningkatan layanan.
          </BulletItem>
        </Section>

        <Section title="2. Tujuan Penggunaan Data">
          <BulletItem>Menjalankan layanan autentikasi akun.</BulletItem>
          <BulletItem>
            Menyimpan dan menampilkan riwayat pindai di perangkatmu.
          </BulletItem>
          <BulletItem>
            Meningkatkan akurasi dan performa model deteksi.
          </BulletItem>
          <BulletItem>
            Penelitian akademik dalam rangka pengembangan tugas akhir.
          </BulletItem>
        </Section>

        <Section title="3. Berbagi Data dengan Pihak Ketiga">
          <Para>
            Data kamu tidak dijual atau dibagikan kepada pihak ketiga untuk
            keperluan komersial. Data dapat dibagikan kepada:
          </Para>
          <BulletItem>
            Layanan komputasi awan (server) sebagai infrastruktur penyimpanan
            data dengan keamanan terenkripsi.
          </BulletItem>
          <BulletItem>
            Google Cloud Vision / ML Kit untuk pemrosesan gambar secara
            lokal atau melalui API (tidak menyimpan gambar secara permanen).
          </BulletItem>
        </Section>

        <Section title="4. Keamanan Data">
          <Para>
            Password disimpan dalam bentuk hash (bcrypt) dan tidak dapat dibaca
            dalam bentuk teks biasa. Token akses menggunakan JWT dengan masa
            berlaku 30 hari.
          </Para>
        </Section>

        <Section title="5. Hak Kamu sebagai Pengguna">
          <Para>Sesuai UU PDP, kamu berhak untuk:</Para>
          <BulletItem>
            <Text style={styles.bold}>Mengakses</Text> data yang kami simpan tentang
            kamu.
          </BulletItem>
          <BulletItem>
            <Text style={styles.bold}>Menghapus</Text> riwayat pindai satu per satu
            melalui menu Memori.
          </BulletItem>
          <BulletItem>
            <Text style={styles.bold}>Menghapus akun</Text> beserta seluruh data
            terkait dengan menghubungi kami melalui email{' '}
            <Text style={styles.bold}>kevin@elior.my.id</Text>.
          </BulletItem>
        </Section>

        <Section title="6. Retensi Data">
          <Para>
            Data akun disimpan selama akun aktif. Data riwayat pindai dapat
            dihapus kapan saja oleh pengguna. Untuk penghapusan akun beserta
            seluruh data terkait secara permanen, silakan menghubungi email{' '}
            <Text style={styles.bold}>kevin@elior.my.id</Text>.
          </Para>
        </Section>

        <Section title="7. Kontak">
          <Para>
            Pertanyaan mengenai kebijakan privasi ini dapat disampaikan melalui
            email: kevin@elior.my.id
          </Para>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Dengan mendaftar, kamu menyatakan telah membaca dan menyetujui
            kebijakan privasi ini.
          </Text>
        </View>
      </ScrollView>

      {/* ── Tombol Bacakan fix di bawah (tidak ikut scroll) ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={styles.bacakanBtn}
          onPress={() => say(PRIVACY_TTS, { force: true })}
          accessibilityRole="button"
          accessibilityLabel="Bacakan kebijakan privasi"
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
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  pageTitle: {
    fontFamily: 'Telma-Medium',
    fontSize: 26,
    letterSpacing: 1,
    color: colors.text,
    includeFontPadding: false,
  },
  lastUpdated: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
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
    fontFamily: 'Telma-Medium',
    fontSize: 16,
    letterSpacing: 1,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.label,
    fontSize: 13,
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
  footer: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 18,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
})
