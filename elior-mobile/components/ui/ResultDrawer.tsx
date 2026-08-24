import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  colors,
  spacing,
  radius,
  DRAWER_PEEK_H,
  DRAWER_FULL_TOP,
} from '../../constants/theme'
import { useAuth } from '../../contexts/AuthContext'
import { useAccessibility } from '../../hooks/useAccessibility'
import { submitReport } from '../../services/feedback'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const { height: SCREEN_H } = Dimensions.get('window')

type SnapLevel = 'full' | 'peek'

function snapH(level: SnapLevel, totalH: number): number {
  if (level === 'full') return totalH - DRAWER_FULL_TOP
  return DRAWER_PEEK_H
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const CATEGORY_LABEL: Record<string, string> = {
  ocr: 'Teks OCR',
  rupiah: 'Uang Rupiah',
  object: 'Deskripsi Objek',
}

interface ResultDrawerProps {
  category: string
  text: string
  confidence?: number
  imageUri?: string
  bbox?: [number, number, number, number]
  durationMs?: number
  speaking: boolean
  bottomOffset: number
  initialSnap?: SnapLevel
  onSnapChange?: (snap: SnapLevel) => void
  onStopTTS: () => void
  onRepeatFrom: (text: string) => void
  onClose: () => void
}

export function ResultDrawer({
  category,
  text,
  confidence,
  imageUri,
  bbox,
  durationMs,
  speaking,
  bottomOffset,
  initialSnap = 'full',
  onSnapChange,
  onStopTTS,
  onRepeatFrom,
}: ResultDrawerProps) {
  const totalH = SCREEN_H - bottomOffset

  const [snap, setSnap] = useState<SnapLevel>(initialSnap)
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0)
  const [imgLayout, setImgLayout] = useState<{ width: number; height: number } | null>(null)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'done'>('idle')
  const { token } = useAuth()
  const { announce } = useAccessibility()

  const handleReport = useCallback(async () => {
    if (!token || reportState !== 'idle') return
    setReportState('sending')
    try {
      await submitReport(token, { category, text, confidence })
      setReportState('done')
      announce('Laporan terkirim. Terima kasih')
    } catch {
      setReportState('idle')
      announce('Gagal mengirim laporan')
    }
  }, [token, reportState, category, text, confidence, announce])

  const heightAnim = useRef(new Animated.Value(snapH(initialSnap, SCREEN_H - bottomOffset))).current
  const snapRef = useRef<SnapLevel>(initialSnap)
  const scrollRef = useRef<ScrollView>(null)
  const sentenceYs = useRef<number[]>([])

  const sentences = splitSentences(text)
  const multiSentence = sentences.length > 1

  const animateTo = useCallback(
    (level: SnapLevel) => {
      snapRef.current = level
      setSnap(level)
      onSnapChange?.(level)
      Animated.spring(heightAnim, {
        toValue: snapH(level, totalH),
        tension: 60,
        friction: 12,
        useNativeDriver: false,
      }).start()
    },
    [totalH, heightAnim, onSnapChange]
  )

  // Animate to initialSnap on mount
  useEffect(() => { animateTo(initialSnap) }, [])

  useEffect(() => {
    const y = sentenceYs.current[activeSentenceIdx]
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 40), animated: true })
  }, [activeSentenceIdx])

  const handlePlay = () => onRepeatFrom(sentences.slice(activeSentenceIdx).join(' '))
  const isPeek = snap === 'peek'

  // Map bbox from cropped-640x640 space back to display image space
  const bboxStyle = bbox && imgLayout
    ? {
        left:   bbox[0] * imgLayout.width,
        top:    bbox[1] * imgLayout.height,
        width:  (bbox[2] - bbox[0]) * imgLayout.width,
        height: (bbox[3] - bbox[1]) * imgLayout.height,
      }
    : null

  return (
    <Animated.View
      style={[styles.drawer, { bottom: bottomOffset, height: heightAnim }]}
    >
      {/* ── Top bar: Buka/Tutup tap button ── */}
      <View style={styles.peekStrip}>
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => animateTo(isPeek ? 'full' : 'peek')}
          accessibilityRole="button"
          accessibilityLabel={isPeek ? 'Buka hasil' : 'Tutup hasil'}
        >
          <Text style={styles.toggleTxt}>{isPeek ? 'Buka Hasil' : 'Tutup Hasil'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.category}>
          {CATEGORY_LABEL[category] ?? category.toUpperCase()}
        </Text>
        {confidence != null && (
          <Text style={styles.confidence}>{Math.round(confidence * 100)}%</Text>
        )}
        {durationMs != null && (
          <Text style={styles.duration}>{(durationMs / 1000).toFixed(1)}s</Text>
        )}

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={styles.reportBtn}
          onPress={handleReport}
          disabled={reportState !== 'idle'}
          accessibilityRole="button"
          accessibilityLabel={reportState === 'done' ? 'Hasil sudah dilaporkan' : 'Laporkan hasil salah'}
        >
          <Ionicons
            name={(reportState === 'done' ? 'checkmark-circle-outline' : 'flag-outline') as IoniconName}
            size={14}
            color={reportState === 'done' ? '#66cc88' : 'rgba(255,255,255,0.5)'}
          />
          <Text style={[styles.reportTxt, reportState === 'done' && styles.reportTxtDone]}>
            {reportState === 'done' ? 'Dilaporkan' : reportState === 'sending' ? 'Mengirim...' : 'Laporkan'}
          </Text>
        </TouchableOpacity>
      </View>

      {!isPeek && (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Image + bbox + trash ── */}
          {imageUri && (
            <View style={styles.imageContainer}>
              <View
                style={styles.imageWrap}
                onLayout={(e: LayoutChangeEvent) => {
                  const { width, height } = e.nativeEvent.layout
                  setImgLayout({ width, height })
                }}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
                {bboxStyle && (
                  <View style={[styles.bboxOverlay, bboxStyle]} />
                )}
              </View>
            </View>
          )}

          {/* ── Text sentences ── */}
          {sentences.map((s, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setActiveSentenceIdx(i)}
              onLayout={(e) => { sentenceYs.current[i] = e.nativeEvent.layout.y }}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={`Kalimat ${i + 1}: ${s}`}
            >
              <Text
                style={[
                  styles.sentenceText,
                  i === activeSentenceIdx && styles.sentenceTextActive,
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Bottom bar ── */}
      {!isPeek && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.navArrowBtn, (!multiSentence || activeSentenceIdx === 0) && styles.navArrowDisabled]}
            onPress={() => setActiveSentenceIdx((i) => Math.max(0, i - 1))}
            disabled={!multiSentence || activeSentenceIdx === 0}
            accessibilityRole="button"
            accessibilityLabel="Kalimat sebelumnya"
          >
            <Ionicons
              name={"chevron-back" as IoniconName}
              size={24}
              color={!multiSentence || activeSentenceIdx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.audioBtn}
            onPress={speaking ? onStopTTS : handlePlay}
            accessibilityRole="button"
            accessibilityLabel={speaking ? 'Hentikan suara' : `Putar dari kalimat ${activeSentenceIdx + 1}`}
          >
            <Ionicons
              name={(speaking ? 'stop' : 'play') as IoniconName}
              size={13}
              color={colors.text}
            />
            <Text style={styles.audioBtnTxt}>
              {speaking ? 'Hentikan' : 'Putar Suara'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navArrowBtn, (!multiSentence || activeSentenceIdx === sentences.length - 1) && styles.navArrowDisabled]}
            onPress={() => setActiveSentenceIdx((i) => Math.min(sentences.length - 1, i + 1))}
            disabled={!multiSentence || activeSentenceIdx === sentences.length - 1}
            accessibilityRole="button"
            accessibilityLabel="Kalimat berikutnya"
          >
            <Ionicons
              name={"chevron-forward" as IoniconName}
              size={24}
              color={!multiSentence || activeSentenceIdx === sentences.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)'}
            />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 30,
    overflow: 'hidden',
  },

  peekStrip: {
    height: DRAWER_PEEK_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.sm,
  },
  toggleTxt: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  category: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  confidence: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    letterSpacing: 1,
  },
  duration: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    letterSpacing: 1,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
  },
  reportTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  reportTxtDone: {
    color: '#66cc88',
  },

  // ── Image + bbox ──
  imageContainer: {
    width: '100%',
    marginBottom: spacing.md,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  bboxOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 4,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 80,
    gap: 2,
  },
  sentenceText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 15,
    lineHeight: 26,
    letterSpacing: 0.3,
    paddingVertical: 4,
  },
  sentenceTextActive: {
    color: colors.text,
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  navArrowBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowDisabled: {
    opacity: 0.25,
  },
  audioBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBtnTxt: {
    color: colors.text,
    fontSize: 11,
    letterSpacing: 1.5,
  },
})
