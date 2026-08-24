import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { colors, spacing, radius } from '../../constants/theme'
import { useAuth } from '../../contexts/AuthContext'
import { useTts } from '../../contexts/TtsContext'
import { EliorSwitch } from '../../components/ui/EliorSwitch'
import { SpeedSlider } from '../../components/ui/SpeedSlider'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { PromptModal } from '../../components/ui/PromptModal'
import { serviceConfig } from '../../config'
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'
const TAB_CONTENT_HEIGHT = 56

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: IoniconName
  label: string
  value?: string
  onPress?: () => void
  danger?: boolean
}) {
  const { say } = useTts()
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={() => {
        say(value != null ? `${label}. ${value}` : label)
        onPress?.()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={18}
        color={danger ? '#ff6060' : 'rgba(255,255,255,0.4)'}
        style={styles.settingIcon}
      />
      <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>
        {label}
      </Text>
      {value != null && (
        <Text style={styles.settingValue}>{value}</Text>
      )}
      {onPress && value == null && (
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
      )}
    </TouchableOpacity>
  )
}

function TtsSwitchRow() {
  const { enabled, setEnabled, say } = useTts()
  return (
    <View style={styles.settingRow}>
      <Ionicons
        name={'volume-high-outline' as IoniconName}
        size={18}
        color="rgba(255,255,255,0.4)"
        style={styles.settingIcon}
      />
      <Text style={styles.settingLabel}>Suara Tombol (TTS)</Text>
      <EliorSwitch
        value={enabled}
        onValueChange={(v) => {
          setEnabled(v)
          // Umpan balik suara saat menyalakan (paksa walau state baru saja berubah)
          if (v) say('Suara tombol aktif', { force: true })
        }}
        accessibilityLabel="Suara tombol TTS"
      />
    </View>
  )
}

function SpeedSettingRow({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { rate, setRate, say } = useTts()
  return (
    <View style={styles.speedSetting}>
      <TouchableOpacity
        style={styles.settingRow}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`Kecepatan Bicara ${rate.toFixed(1)} kali. ${active ? 'Ketuk untuk tutup pengaturan kecepatan' : 'Ketuk untuk buka pengaturan kecepatan'}`}
      >
        <Ionicons
          name={'speedometer-outline' as IoniconName}
          size={18}
          color="rgba(255,255,255,0.4)"
          style={styles.settingIcon}
        />
        <Text style={styles.settingLabel}>Kecepatan Bicara</Text>
        <Text style={styles.settingValue}>{rate.toFixed(1)}×</Text>
        <Ionicons
          name={active ? ('chevron-up' as IoniconName) : ('chevron-down' as IoniconName)}
          size={14}
          color="rgba(255,255,255,0.3)"
        />
      </TouchableOpacity>
      {active && (
        <SpeedSlider
          rate={rate}
          onChange={(r) => { setRate(r); say(`Kecepatan ${r.toFixed(1).replace('.', ',')}`, { force: true }) }}
        />
      )}
    </View>
  )
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = TAB_CONTENT_HEIGHT + insets.bottom
  const router = useRouter()
  const { name, email, token, updateProfile, clearAuth } = useAuth()
  const { say } = useTts()
  const [speedActive, setSpeedActive] = useState(false)

  const handleSpeedToggle = useCallback(() => {
    setSpeedActive(v => {
      const next = !v
      say(next ? 'Mode atur kecepatan aktif.' : 'Mode atur kecepatan nonaktif.')
      return next
    })
  }, [say])

  // Auto-close speed panel saat navigasi ke tab lain
  useFocusEffect(useCallback(() => {
    return () => setSpeedActive(false)
  }, []))

  const [logoutVisible, setLogoutVisible] = useState(false)
  const [editNameVisible, setEditNameVisible] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Ambil profil terbaru (nama + email) dari server saat layar dibuka
  useEffect(() => {
    if (!token) return
    let active = true
    fetch(`${serviceConfig.authUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}))
          if ((body as any).code === 'akun_dibanned') {
            clearAuth()
            router.replace('/login')
          }
          return null
        }
        return res.ok ? res.json() : null
      })
      .then(data => {
        if (active && data) updateProfile({ name: data.name, email: data.email })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [token])

  const handleLogoutConfirm = async () => {
    setLogoutVisible(false)
    await clearAuth()
    router.replace('/login')
  }

  const handleSaveName = useCallback(async (newName: string) => {
    if (!token) return
    setSavingName(true)
    setNameError(null)
    try {
      const res = await fetch(`${serviceConfig.authUrl}/users/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error('gagal')
      const data = await res.json()
      await updateProfile({ name: data.name })
      setEditNameVisible(false)
    } catch {
      setNameError('Gagal menyimpan nama. Coba lagi.')
    } finally {
      setSavingName(false)
    }
  }, [token, updateProfile])

  return (
    <View style={[styles.container, { paddingBottom: tabBarHeight }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.pageTitle}>Profil</Text>
        </View>

        {/* ── User card ── */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => { say('Ubah nama'); setNameError(null); setEditNameVisible(true) }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Profil ${name ?? ''}. Ketuk untuk ubah nama`}
        >
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{name ?? '—'}</Text>
            {email != null && <Text style={styles.userEmail}>{email}</Text>}
          </View>
          <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* ── Aksesibilitas ── */}
        <SectionLabel title="AKSESIBILITAS" />
        <View style={styles.settingGroup}>
          <TtsSwitchRow />
          <View style={styles.rowDivider} />
          <SpeedSettingRow active={speedActive} onToggle={handleSpeedToggle} />
        </View>

        {/* ── Aplikasi ── */}
        <SectionLabel title="APLIKASI" />
        <View style={styles.settingGroup}>
          <SettingRow
            icon="information-circle-outline"
            label="Tentang Elior"
            onPress={() => router.push('/tentang')}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="code-slash-outline"
            label="Versi"
            value={APP_VERSION}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="globe-outline"
            label="Bahasa"
            value="Indonesia"
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Kebijakan Privasi"
            onPress={() => router.push('/privacy')}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Masukan"
            onPress={() => router.push('/feedback')}
          />
        </View>

        {/* ── Akun ── */}
        <SectionLabel title="AKUN" />
        <View style={styles.settingGroup}>
          <SettingRow
            icon="log-out-outline"
            label="Keluar"
            onPress={() => setLogoutVisible(true)}
            danger
          />
        </View>
      </ScrollView>

      {/* ── Modals ── */}
      <ConfirmModal
        visible={logoutVisible}
        title=""
        message="Yakin ingin keluar dari akun?"
        confirmLabel="Keluar"
        cancelLabel="Batal"
        danger
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutVisible(false)}
      />

      <PromptModal
        visible={editNameVisible}
        title={nameError ?? 'Ubah Nama'}
        placeholder="Nama kamu"
        initialValue={name ?? ''}
        confirmLabel="Simpan"
        cancelLabel="Batal"
        saving={savingName}
        onConfirm={handleSaveName}
        onCancel={() => setEditNameVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingBottom: spacing.lg,
  },
  pageTitle: {
    fontFamily: 'Telma-Medium',
    fontSize: 36,
    color: colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  speedSetting: {
    paddingBottom: spacing.sm,
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userName: {
    color: colors.text,
    fontSize: 16,
    letterSpacing: 1,
  },
  userEmail: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  settingGroup: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: spacing.sm,
  },
  settingIcon: {
    width: 20,
  },
  settingLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  settingLabelDanger: {
    color: '#ff6060',
  },
  settingValue: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: spacing.md + 20 + spacing.sm,
  },
})
