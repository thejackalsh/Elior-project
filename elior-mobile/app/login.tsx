import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LogBox,
} from 'react-native'

LogBox.ignoreLogs([
  'RNGoogleSignIn',
  'getTokens',
  'GoogleSignIn',
])
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { Svg, Path } from 'react-native-svg'
import { colors, spacing, radius } from '../constants/theme'
import { apiGoogleLogin } from '../services/authService'
import { useAuth } from '../contexts/AuthContext'
import { serviceConfig } from '../config'

GoogleSignin.configure({
  webClientId: serviceConfig.googleWebClientId,
  scopes: ['profile', 'email'],
})

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { setAuth } = useAuth()

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      await GoogleSignin.hasPlayServices()
      await GoogleSignin.signOut().catch(() => {})
      const result = await GoogleSignin.signIn()
      if (result.type === 'cancelled') return
      const { accessToken } = await GoogleSignin.getTokens()

      const user = await apiGoogleLogin(accessToken)
      await setAuth(user.access_token, user.user_id, user.name)

      if (user.is_new) {
        router.replace({ pathname: '/permission-camera', params: { jwt: user.access_token } })
      } else {
        router.replace('/(tabs)/camera')
      }
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        GoogleSignin.signOut().catch(() => {})
        return
      }
      if (e.code === statusCodes.IN_PROGRESS) return
      // Pesan dari Google SDK bisa bahasa Inggris — tampilkan hanya pesan yang sudah diterjemahkan
      const raw: string = e?.message ?? ''
      const isIndonesian = raw.includes('dinonaktifkan') || raw.includes('ditutup') || raw.includes('Pendaftaran')
      setError(isIndonesian ? raw : 'Login gagal. Periksa koneksi internet dan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.appTitle}>Elior</Text>
        <Text style={styles.tagline}>Asisten visual untuk{'\n'}kehidupan sehari-hari</Text>
      </View>

      {/* Bottom actions */}
      <View style={styles.bottom}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Google button */}
        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.btnDisabled]}
          onPress={handleGoogle}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Lanjutkan dengan Google"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <>
              <GoogleGLogo />
              <Text style={styles.googleBtnText}>Lanjutkan dengan Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.terms}>
          Dengan melanjutkan, kamu menyetujui{' '}
          <Text style={styles.link} onPress={() => router.push('/privacy')}>
            Kebijakan Privasi
          </Text>
          {' '}kami.
        </Text>
      </View>
    </View>
  )
}

function GoogleGLogo() {
  return (
    <View style={logoStyle.wrap}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <Path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <Path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        />
        <Path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </Svg>
    </View>
  )
}

const logoStyle = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  appTitle: {
    fontFamily: 'Telma-Medium',
    fontSize: 96,
    color: colors.text,
    includeFontPadding: false,
    lineHeight: 100,
  },
  tagline: {
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 24,
  },
  bottom: {
    gap: spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: '#ff6060',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.full,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.bg,
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  terms: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    letterSpacing: 0.2,
    paddingHorizontal: spacing.md,
  },
  link: {
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
})
