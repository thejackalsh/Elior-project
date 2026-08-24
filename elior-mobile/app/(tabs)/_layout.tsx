import { Tabs, usePathname, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DrawerProvider, useDrawerContext } from '../../contexts/ResultDrawerContext'
import { PindaiProvider, usePindaiContext } from '../../contexts/PindaiContext'
import { useTts } from '../../contexts/TtsContext'
import { ResultDrawer, TourOverlay, TOUR_KEY } from '../../components/ui'
import { spacing, radius, PINDAI_BAR_H } from '../../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_CONTENT_HEIGHT = 56

const TABS = [
  { name: 'memories', label: 'Memori', icon: 'images' },
  { name: 'camera',   label: 'Kamera',   icon: 'camera' },
  { name: 'profile',  label: 'Profil',   icon: 'person' },
] as const

// ── Pindai bar — shown only on camera, sits above tab bar ──────────────────
function PindaiBar({ tabBarHeight }: { tabBarHeight: number }) {
  const { scan, flip, isLoading, mode, toggleMode } = usePindaiContext()

  return (
    <View style={[styles.pindaiBar, { bottom: tabBarHeight }]}>
      {/* Mode toggle — kiri */}
      <TouchableOpacity
        style={styles.pindaiModeBtn}
        onPress={toggleMode}
        accessibilityRole="button"
        accessibilityLabel={`Mode ${mode === 'uang' ? 'Uang' : mode === 'baca' ? 'Baca' : mode === 'objek' ? 'Objek' : 'QR'}, ketuk untuk ganti`}
      >
        <Text style={styles.pindaiModeTxt}>
          {mode === 'uang' ? 'Uang' : mode === 'baca' ? 'Baca' : mode === 'objek' ? 'Objek' : 'QR'}
        </Text>
      </TouchableOpacity>

      {/* Pindai — tengah */}
      <TouchableOpacity
        style={[styles.pindaiScanBtn, (isLoading || mode === 'uang') && styles.pindaiBtnDisabled]}
        onPress={scan}
        disabled={isLoading || mode === 'uang'}
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading || mode === 'uang' }}
        accessibilityLabel={
          mode === 'uang'
            ? 'Pindai tidak diperlukan, mode uang mendeteksi otomatis'
            : isLoading ? 'Sedang memindai' : 'Pindai'
        }
      >
        <Text style={styles.pindaiScanTxt}>
          {isLoading ? 'Memindai...' : 'Pindai'}
        </Text>
      </TouchableOpacity>

      {/* Flip — kanan */}
      <TouchableOpacity
        style={styles.pindaiFlipBtn}
        onPress={flip}
        accessibilityRole="button"
        accessibilityLabel="Balik kamera"
      >
        <Ionicons name={"camera-reverse-outline" as IoniconName} size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  )
}

// ── Tab bar ─────────────────────────────────────────────────────────────────
function CustomTabBar({ height, paddingBottom }: { height: number; paddingBottom: number }) {
  const pathname = usePathname()
  const { say } = useTts()

  return (
    <View style={[styles.tabBar, { height, paddingBottom }]}>
      {TABS.map((tab) => {
        const focused = pathname.includes(tab.name)
        const color = focused ? '#FFFFFF' : 'rgba(255,255,255,0.35)'

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabItem}
            onPress={() => { say(tab.label); router.navigate(`/(tabs)/${tab.name}` as any) }}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
          >
            <Ionicons
              name={(focused ? tab.icon : `${tab.icon}-outline`) as IoniconName}
              size={24}
              color={color}
            />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ── Main layout ─────────────────────────────────────────────────────────────
function TabsWithDrawer() {
  const { data, drawKey, speaking, hide, onStopTTS, onRepeatFrom } = useDrawerContext()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const isCamera = pathname.includes('camera')
  const prevIsCameraRef = useRef(isCamera)
  const [showTour, setShowTour] = useState<boolean>(false)

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY).then(val => {
      if (!val) setShowTour(true)
    })
  }, [])

  // Stop TTS when navigating away from camera
  useEffect(() => {
    if (prevIsCameraRef.current && !isCamera) {
      onStopTTS()
    }
    prevIsCameraRef.current = isCamera
  }, [isCamera, onStopTTS])

  // Stop TTS when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        onStopTTS()
      }
    })
    return () => sub.remove()
  }, [onStopTTS])

  const tabBarHeight = TAB_CONTENT_HEIGHT + insets.bottom
  // Drawer sits above both tab bar + pindai bar (when on camera)
  const drawerBottom = tabBarHeight + (isCamera ? PINDAI_BAR_H - 1 : 0)

  return (
    <View style={styles.root}>
      {/* Screens */}
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => null}
      >
        <Tabs.Screen name="memories" options={{ title: 'Memories' }} />
        <Tabs.Screen name="camera"   options={{ title: 'Kamera' }} />
        <Tabs.Screen name="profile"  options={{ title: 'Profil' }} />
      </Tabs>

      {/* Drawer: above pindai bar */}
      {data && isCamera && (
        <ResultDrawer
          key={drawKey}
          category={data.category}
          text={data.text}
          confidence={data.confidence}
          imageUri={data.imageUri}
          bbox={data.bbox}
          durationMs={data.durationMs}
          speaking={speaking}
          bottomOffset={drawerBottom}
          initialSnap='full'
          onStopTTS={onStopTTS}
          onRepeatFrom={onRepeatFrom}
          onClose={() => { onStopTTS(); hide() }}
        />
      )}

      {/* Pindai bar: above tab bar, only on camera */}
      {isCamera && <PindaiBar tabBarHeight={tabBarHeight} />}

      {/* Tab bar: always on top */}
      <CustomTabBar
        height={tabBarHeight}
        paddingBottom={insets.bottom + 6}
      />

      {/* Tour overlay: renders above everything on first launch */}
      {showTour && <TourOverlay onDone={() => setShowTour(false)} />}
    </View>
  )
}

export default function TabLayout() {
  return (
    <DrawerProvider>
      <PindaiProvider>
        <TabsWithDrawer />
      </PindaiProvider>
    </DrawerProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // ── Pindai bar ──
  pindaiBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PINDAI_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    zIndex: 40,
  },
  pindaiModeBtn: {
    width: 72,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pindaiModeTxt: {
    color: '#ffffff',
    fontSize: 11,
    letterSpacing: 1,
  },
  pindaiScanBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pindaiBtnDisabled: {
    opacity: 0.45,
  },
  pindaiScanTxt: {
    color: '#ffffff',
    fontSize: 15,
    letterSpacing: 3,
    fontFamily: 'Telma-Medium',
  },
  pindaiFlipBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tab bar ──
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    zIndex: 50,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 2,
  },
})
