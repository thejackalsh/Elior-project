import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as MediaLibrary from 'expo-media-library'
import * as FileSystem from 'expo-file-system/legacy'
import { colors, spacing, radius } from '../../constants/theme'
import { useTts } from '../../contexts/TtsContext'
import { memoryImageUrl, type MemoryItem } from '../../services/memory'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const { height: SCREEN_H } = Dimensions.get('window')
const CARD_H = Math.round(SCREEN_H * 0.7)

const CATEGORY_LABEL: Record<string, string> = {
  ocr: 'Teks OCR',
  rupiah: 'Uang Rupiah',
  object: 'Deskripsi Objek',
}

interface Props {
  item: MemoryItem | null
  onClose: () => void
}

export function MemoryDetailModal({ item, onClose }: Props) {
  const { say, stop, rate } = useTts()
  const [imageOpen, setImageOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const visible = item != null
  const uri = item ? memoryImageUrl(item.image_url) : null
  const label = item ? (CATEGORY_LABEL[item.category] ?? item.category) : ''

  const handleClose = () => {
    if (imageOpen) { setImageOpen(false); return }
    say('Tutup', { force: true })
    stop()
    onClose()
  }

  const handleBacakan = () => {
    if (item) {
      say('Membacakan', { force: true })
      say(item.text, { rate, force: true })
    }
  }

  const handleDownload = async () => {
    if (!uri || downloading) return
    setDownloading(true)
    try {
      let perm = await MediaLibrary.requestPermissionsAsync(false, ['photo'])
      if (!perm.granted && perm.canAskAgain) {
        say('Butuh izin galeri untuk menyimpan gambar.', { force: true })
        await new Promise<void>(r => setTimeout(r, 1200))
        perm = await MediaLibrary.requestPermissionsAsync(false, ['photo'])
      }
      if (!perm.granted) {
        say('Izin galeri tidak diberikan. Gambar tidak bisa disimpan.', { force: true })
        return
      }
      say('Mengunduh gambar', { force: true })
      const dest = `${FileSystem.cacheDirectory ?? ''}elior-${Date.now()}.jpg`
      const { uri: localUri } = await FileSystem.downloadAsync(uri, dest)
      await MediaLibrary.saveToLibraryAsync(localUri)
      say('Gambar tersimpan di galeri', { force: true })
    } catch {
      say('Gagal mengunduh gambar', { force: true })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleClose} accessibilityLabel="Tutup">
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      {/* Centered stack: card + floating close */}
      <View style={styles.centerer} pointerEvents="box-none">
        {/* ── Card ── */}
        <View style={styles.card}>
          {/* Gambar fix — tap untuk lihat penuh */}
          <TouchableOpacity
            style={styles.imageBox}
            activeOpacity={uri ? 0.85 : 1}
            disabled={!uri}
            onPress={() => {
              if (uri) {
                say('Lihat gambar penuh', { force: true })
                setImageOpen(true)
              }
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel="Gambar hasil. Ketuk untuk lihat penuh"
          >
            {uri ? (
              <Image source={{ uri }} style={styles.image} resizeMode="contain" />
            ) : (
              <Ionicons name={'image-outline' as IoniconName} size={40} color="rgba(255,255,255,0.2)" />
            )}
          </TouchableOpacity>

          {/* Meta */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{label}</Text>
            {item?.confidence != null && (
              <Text style={styles.metaConf}>{Math.round(item.confidence * 100)}%</Text>
            )}
          </View>

          {/* Teks scroll */}
          <ScrollView
            style={styles.textScroll}
            contentContainerStyle={styles.textContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.bodyText}>{item?.text}</Text>
          </ScrollView>

          {/* Tombol fix: Bacakan + Unduh */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.bacakanBtn}
              onPress={handleBacakan}
              accessibilityRole="button"
              accessibilityLabel="Bacakan hasil"
            >
              <Ionicons name={'volume-high-outline' as IoniconName} size={16} color={colors.bg} />
              <Text style={styles.bacakanTxt}>Bacakan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unduhBtn, !uri && styles.unduhBtnDisabled]}
              onPress={() => {
                say('Unduh gambar', { force: true })
                handleDownload()
              }}
              disabled={!uri}
              accessibilityRole="button"
              accessibilityLabel={uri ? 'Unduh gambar' : 'Gambar tidak tersedia'}
            >
              <Ionicons
                name={downloading ? ('hourglass-outline' as IoniconName) : ('download-outline' as IoniconName)}
                size={16}
                color={uri ? colors.text : 'rgba(255,255,255,0.3)'}
              />
              <Text style={[styles.unduhTxt, !uri && styles.unduhTxtDisabled]}>
                {downloading ? 'Mengunduh...' : 'Unduh'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tombol Tutup floating ── */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Tutup"
        >
          <Text style={styles.closeTxt}>Tutup</Text>
        </TouchableOpacity>
      </View>

      {/* ── Penampil gambar penuh ── */}
      {imageOpen && uri && (
        <View style={styles.imageViewer}>
          <TouchableWithoutFeedback onPress={() => setImageOpen(false)}>
            <View style={styles.imageViewerBackdrop} />
          </TouchableWithoutFeedback>
          <Image source={{ uri }} style={styles.imageFull} resizeMode="contain" />
          <View style={styles.imageViewerBar} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => {
                say('Simpan gambar', { force: true })
                handleDownload()
              }}
              accessibilityRole="button"
              accessibilityLabel="Simpan gambar ke galeri"
            >
              <Ionicons name={'download-outline' as IoniconName} size={16} color={colors.bg} />
              <Text style={styles.saveTxt}>Simpan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  centerer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: '100%',
    height: CARD_H,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  imageBox: {
    width: '100%',
    height: Math.round(CARD_H * 0.38),
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  metaConf: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    letterSpacing: 1,
  },
  textScroll: {
    flex: 1,
  },
  textContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bodyText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  // ── Actions ──
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  bacakanBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bacakanTxt: {
    color: colors.bg,
    fontSize: 15,
    fontFamily: 'Telma-Medium',
    letterSpacing: 1,
  },
  unduhBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unduhBtnDisabled: {
    borderColor: 'rgba(255,255,255,0.08)',
  },
  unduhTxt: {
    color: colors.text,
    fontSize: 13,
    letterSpacing: 1,
  },
  unduhTxtDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  // ── Floating close ──
  closeBtn: {
    width: '50%',
    height: 48,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    color: colors.text,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // ── Image viewer ──
  imageViewer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  imageFull: {
    width: '92%',
    height: '78%',
  },
  imageViewerBar: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.xl,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTxt: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
})
