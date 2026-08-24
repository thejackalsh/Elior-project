import React, { useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { colors, spacing, radius, fonts } from '../../constants/theme'
import { useTts } from '../../contexts/TtsContext'

interface ConfirmModalProps {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Ya',
  cancelLabel = 'Batal',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { say } = useTts()

  // Bacakan judul + pesan saat dialog muncul
  useEffect(() => {
    if (visible) say(title ? `${title}. ${message}` : message)
  }, [visible, title, message, say])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel} accessibilityLabel="Tutup dialog">
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.centerer} pointerEvents="box-none">
        <BlurView intensity={20} tint="dark" style={styles.card}>
          <View style={styles.cardInner}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text style={styles.message}>{message}</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { say(cancelLabel); onCancel() }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, danger && styles.confirmDanger]}
                onPress={() => { say(confirmLabel); onConfirm() }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
              >
                <Text style={[styles.confirmText, danger && styles.confirmTextDanger]}>
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centerer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardInner: {
    padding: spacing.lg,
    backgroundColor: 'rgba(10,10,10,0.7)',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.label,
    fontSize: 16,
    letterSpacing: 0.5,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.2,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.md,
  },
  confirmDanger: {
    backgroundColor: '#ff6060',
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.bg,
    letterSpacing: 0.3,
  },
  confirmTextDanger: {
    color: '#ffffff',
  },
})
