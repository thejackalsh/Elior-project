import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { View, StyleSheet } from 'react-native'
import { ThemeProvider, DarkTheme } from '@react-navigation/native'
import { colors } from '../constants/theme'
import { IconPreferenceProvider } from '../contexts/IconPreferenceContext'
import { AuthProvider } from '../contexts/AuthContext'
import { TtsProvider } from '../contexts/TtsContext'

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg },
}

export default function RootLayout() {
  // Keep-awake dipindah ke camera.tsx (layar kamera) — di-scope, bukan app-wide,
  // supaya halaman lain (memori, profile, dll) boleh tidur normal.
  const [fontsLoaded] = useFonts({
    'LibreBaskerville-Regular': require('../assets/fonts/LibreBaskerville-Regular.ttf'),
    'Telma-Medium': require('../assets/fonts/Telma-Medium.ttf'),
  })

  if (!fontsLoaded) {
    return <View style={styles.bg} />
  }

  return (
    <ThemeProvider value={navTheme}>
      <AuthProvider>
        <TtsProvider>
        <IconPreferenceProvider>
          <View style={styles.root}>
            <StatusBar style="light" backgroundColor={colors.bg} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade',
              }}
            />
          </View>
        </IconPreferenceProvider>
        </TtsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  bg: {
    flex: 1,
    backgroundColor: colors.bg,
  },
})
