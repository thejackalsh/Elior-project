import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, Mask, Rect as SvgRect } from 'react-native-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTTS } from '../../hooks/useTTS'
import { useTts } from '../../contexts/TtsContext'
import { PINDAI_BAR_H, spacing, radius, fonts, colors } from '../../constants/theme'

export const TOUR_KEY = '@elior_tour_shown'

const TAB_H = 56
const SPOT_PAD = 10

interface SpotRect {
  x: number
  y: number
  w: number
  h: number
}

interface TourStep {
  key: string
  title: string
  desc: string
  spoken: string
}

const STEPS: TourStep[] = [
  {
    key: 'pindai',
    title: 'Tombol Pindai',
    desc: 'Ketuk sekali untuk mulai memindai. Tunggu hingga panel hasil muncul dari bawah.',
    spoken: 'Tombol Pindai ada di tengah bar bawah. Ketuk sekali untuk mulai memindai. Tunggu hingga hasil muncul.',
  },
  {
    key: 'mode',
    title: 'Tombol Mode',
    desc: 'Ketuk berulang untuk berganti mode:\nObjek · Uang · QR · Baca',
    spoken: 'Tombol Mode ada di kiri bar bawah. Ketuk berulang untuk berganti mode. Objek untuk mendeskripsikan benda. Uang untuk mengenali rupiah. Q R untuk memindai kode. Baca untuk membaca teks.',
  },
  {
    key: 'flip',
    title: 'Balik Kamera',
    desc: 'Ketuk untuk beralih antara kamera belakang dan kamera depan.',
    spoken: 'Tombol balik kamera ada di kanan bar bawah. Ketuk untuk beralih antara kamera belakang dan depan.',
  },
  {
    key: 'senter',
    title: 'Senter',
    desc: 'Ketuk untuk menyalakan LED agar objek terlihat jelas di kondisi gelap. Ketuk lagi untuk mematikan.',
    spoken: 'Tombol Senter ada di kiri atas layar. Ketuk untuk menyalakan LED agar objek terlihat jelas di kondisi gelap.',
  },
  {
    key: 'kecepatan',
    title: 'Kecepatan Baca',
    desc: 'Ketuk untuk membuka slider kecepatan suara. Tombol volume HP juga bisa mengubah kecepatan saat slider terbuka.',
    spoken: 'Tombol Kecepatan Baca ada di kanan atas. Ketuk untuk membuka slider. Tombol volume H P juga bisa mengubah kecepatan saat slider terbuka.',
  },
  {
    key: 'memori',
    title: 'Tab Memori',
    desc: 'Ketuk untuk melihat riwayat hasil pindai. Ketuk kartu untuk detail gambar. Tekan lama kartu untuk masuk mode pilih dan hapus.',
    spoken: 'Tab Memori ada di kiri bawah. Ketuk untuk melihat riwayat hasil pindai. Tekan dan tahan kartu untuk masuk mode pilih, lalu hapus.',
  },
  {
    key: 'profil',
    title: 'Tab Profil',
    desc: 'Aktifkan atau matikan suara tombol, atur kecepatan bicara. Setelah mencoba semua fitur, isi Masukan untuk membantu pengembangan.',
    spoken: 'Tab Profil ada di kanan bawah. Aktifkan atau matikan suara tombol. Atur kecepatan bicara. Setelah mencoba semua fitur, buka Profil dan isi Masukan.',
  },
  {
    key: 'hasil',
    title: 'Panel Hasil Pindai',
    desc: 'Setelah memindai, panel muncul dari bawah. Ketuk "Buka Hasil" untuk teks lengkap, "Putar Suara" untuk memutar ulang, panah ← → untuk berpindah per kalimat.',
    spoken: 'Panel hasil muncul dari bawah setelah memindai. Ketuk Buka Hasil untuk teks lengkap. Ketuk Putar Suara untuk memutar ulang. Gunakan panah kiri kanan untuk berpindah antar kalimat.',
  },
  {
    key: 'laporkan',
    title: 'Laporkan Hasil',
    desc: 'Di panel hasil, ketuk "Laporkan" di pojok kanan atas jika hasil pindai tidak tepat.',
    spoken: 'Di panel hasil ada tombol Laporkan di pojok kanan atas. Jika hasil pindai tidak tepat, ketuk untuk melaporkan kepada pengembang.',
  },
]

function getSpot(
  key: string,
  SW: number,
  SH: number,
  IT: number,
  IB: number,
): SpotRect | null {
  const tabH = TAB_H + IB
  const pindaiTop = SH - tabH - PINDAI_BAR_H

  // PindaiBar layout: paddingHorizontal=16, gap=8, mode=72w, scan=flex1, flip=52w
  const PM = 16
  const G = 8
  const modeW = 72
  const flipW = 52
  const scanX = PM + modeW + G
  const scanW = SW - PM - modeW - G - flipW - G - PM

  // Camera header controlRow: marginHorizontal=16, gap=8, each btn=flex1
  const btnH = 44
  const halfBtnW = (SW - 32 - G) / 2
  // controlRow y: insets.top + headerPaddingTop(8) + titleSection(~60) + divider(1) + rowMarginTop(8)
  const ctrlY = IT + 77

  switch (key) {
    case 'pindai':
      return { x: scanX, y: pindaiTop, w: scanW, h: PINDAI_BAR_H }
    case 'mode':
      return { x: PM, y: pindaiTop, w: modeW, h: PINDAI_BAR_H }
    case 'flip':
      return { x: SW - PM - flipW, y: pindaiTop, w: flipW, h: PINDAI_BAR_H }
    case 'senter':
      return { x: PM, y: ctrlY, w: halfBtnW, h: btnH }
    case 'kecepatan':
      return { x: PM + halfBtnW + G, y: ctrlY, w: halfBtnW, h: btnH }
    case 'memori':
      return { x: 0, y: SH - tabH, w: SW / 3, h: tabH }
    case 'profil':
      return { x: (SW * 2) / 3, y: SH - tabH, w: SW / 3, h: tabH }
    default:
      return null
  }
}

export function TourOverlay({ onDone }: { onDone: () => void }) {
  const { width: SW, height: SH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { speak, stop } = useTTS()
  const { autoSpeakPref, say } = useTts()
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const spot = getSpot(current.key, SW, SH, insets.top, insets.bottom)

  const hl: SpotRect | null = spot
    ? { x: spot.x - SPOT_PAD, y: spot.y - SPOT_PAD, w: spot.w + SPOT_PAD * 2, h: spot.h + SPOT_PAD * 2 }
    : null

  // Tooltip position: above target if target is in bottom half, below if in top half
  const TOOLTIP_EST_H = 210
  const TOOLTIP_H_MARGIN = 16
  const ARROW_SIZE = 10

  let tooltipTop: number
  let arrowSide: 'top' | 'bottom' | 'none' = 'none'

  if (!spot) {
    tooltipTop = (SH - TOOLTIP_EST_H) / 2
  } else if (spot.y > SH / 2) {
    tooltipTop = (hl ? hl.y : spot.y) - TOOLTIP_H_MARGIN - TOOLTIP_EST_H - ARROW_SIZE
    arrowSide = 'bottom'
  } else {
    tooltipTop = (hl ? hl.y + hl.h : spot.y + spot.h) + TOOLTIP_H_MARGIN + ARROW_SIZE
    arrowSide = 'top'
  }
  tooltipTop = Math.max(
    insets.top + 8,
    Math.min(tooltipTop, SH - TOOLTIP_EST_H - insets.bottom - 8),
  )

  // Arrow horizontal offset within tooltip (centered on highlighted element)
  const tooltipLeftMargin = 16
  const hlCenterX = hl ? hl.x + hl.w / 2 : SW / 2
  const arrowLeft = Math.max(
    20,
    Math.min(hlCenterX - tooltipLeftMargin - ARROW_SIZE / 2, SW - tooltipLeftMargin * 2 - 20),
  )

  useEffect(() => {
    if (autoSpeakPref) speak(current.spoken)
    return () => { stop() }
  }, [step, autoSpeakPref])

  const handleDone = useCallback(async () => {
    stop()
    await AsyncStorage.setItem(TOUR_KEY, '1')
    onDone()
  }, [stop, onDone])

  const handleNext = useCallback(() => {
    stop()
    if (isLast) { handleDone(); return }
    setStep(s => s + 1)
  }, [isLast, handleDone, stop])

  const handlePrev = useCallback(() => {
    stop()
    setStep(s => Math.max(0, s - 1))
  }, [stop])

  return (
    <Pressable style={[StyleSheet.absoluteFill, styles.root]} onPress={() => { say(isLast ? 'Selesai' : 'Lanjut'); handleNext() }}>
      {/* SVG backdrop with spotlight cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SW} height={SH}>
          <Defs>
            <Mask id="tourMask">
              <SvgRect x={0} y={0} width={SW} height={SH} fill="white" />
              {hl && (
                <SvgRect
                  x={hl.x}
                  y={hl.y}
                  width={hl.w}
                  height={hl.h}
                  rx={16}
                  fill="black"
                />
              )}
            </Mask>
          </Defs>
          <SvgRect
            x={0}
            y={0}
            width={SW}
            height={SH}
            fill="rgba(0,0,0,0.83)"
            mask="url(#tourMask)"
          />
        </Svg>
      </View>

      {/* Highlight ring around target */}
      {hl && (
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            { left: hl.x, top: hl.y, width: hl.w, height: hl.h },
          ]}
        />
      )}

      {/* Arrow pointer (shadcn-style rotated square) */}
      {arrowSide === 'top' && (
        <View
          pointerEvents="none"
          style={[styles.arrow, styles.arrowTop, { top: tooltipTop - ARROW_SIZE, left: arrowLeft }]}
        />
      )}
      {arrowSide === 'bottom' && (
        <View
          pointerEvents="none"
          style={[styles.arrow, styles.arrowBottom, { top: tooltipTop + TOOLTIP_EST_H - ARROW_SIZE / 2, left: arrowLeft }]}
        />
      )}

      {/* Tooltip card — stop propagation agar tap tombol tidak trigger next dari Pressable root */}
      <View style={[styles.tooltip, { top: tooltipTop }]} onStartShouldSetResponder={() => true}>
        <View style={styles.tooltipHeader}>
          <Text style={styles.tooltipTitle}>{current.title}</Text>
          <Text style={styles.stepNum}>{step + 1} / {STEPS.length}</Text>
        </View>
        <Text style={styles.tooltipDesc}>{current.desc}</Text>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { say('Kembali'); handlePrev() }}
              accessibilityRole="button"
              accessibilityLabel="Kembali"
            >
              <Text style={styles.backTxt}>‹</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => { say('Lewati'); handleDone() }}
            accessibilityRole="button"
            accessibilityLabel="Lewati panduan"
          >
            <Text style={styles.skipTxt}>Lewati</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => { say(isLast ? 'Selesai' : 'Lanjut'); handleNext() }}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Mulai pakai Elior' : 'Lanjut'}
          >
            <Text style={styles.nextTxt}>{isLast ? 'Mulai' : 'Lanjut'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    zIndex: 200,
  },
  highlight: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#111111',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing.lg,
    gap: spacing.sm,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  stepNum: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 2,
  },
  tooltipTitle: {
    fontFamily: 'Telma-Medium',
    fontSize: 22,
    color: colors.text,
    letterSpacing: 2,
  },
  tooltipDesc: {
    fontFamily: fonts.label,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 22,
    lineHeight: 26,
  },
  skipBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipTxt: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
  },
  nextBtn: {
    flex: 2,
    height: 44,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextTxt: {
    fontFamily: fonts.label,
    fontSize: 13,
    color: colors.bg,
    letterSpacing: 2,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  // Shadcn-style arrow: rotated square, same bg + partial border
  arrow: {
    position: 'absolute',
    width: 10,
    height: 10,
    backgroundColor: '#111111',
    zIndex: 201,
  },
  arrowTop: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    transform: [{ rotate: '45deg' }],
  },
  arrowBottom: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    transform: [{ rotate: '45deg' }],
  },
})
