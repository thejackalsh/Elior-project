import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, radius } from '../../constants/theme'
import { useAuth } from '../../contexts/AuthContext'
import { useTts } from '../../contexts/TtsContext'
import { ConfirmModal } from '../../components/ui'
import { MemoryDetailModal } from '../../components/ui/MemoryDetailModal'
import { fetchMemories, deleteMemory, memoryImageUrl, isMemoriesDirty, clearMemoriesDirty, loadCachedMemories, saveCachedMemories, UnauthorizedError, type MemoryItem } from '../../services/memory'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']
type CategoryFilter = 'all' | 'ocr' | 'rupiah' | 'object'

const TAB_CONTENT_HEIGHT = 56
const CACHE_MS = 2 * 60 * 1000 // 2 menit

const CATEGORY_LABEL: Record<string, string> = {
  ocr: 'Teks',
  rupiah: 'Rupiah',
  object: 'Objek',
}

const CATEGORY_ICON: Record<string, IoniconName> = {
  ocr: 'document-text-outline',
  rupiah: 'cash-outline',
  object: 'cube-outline',
}

const FILTER_OPTIONS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'ocr', label: 'Teks' },
  { key: 'object', label: 'Objek' },
  { key: 'rupiah', label: 'Rupiah' },
]

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  )
}

function dateSectionTitle(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(d, today)) return 'Hari ini'
  if (sameDay(d, yesterday)) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Section { title: string; data: MemoryItem[] }

function groupByDate(items: MemoryItem[]): Section[] {
  const map = new Map<string, MemoryItem[]>()
  for (const item of items) {
    const key = dateSectionTitle(item.created_at)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }))
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Baru saja'
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

interface CardProps {
  item: MemoryItem
  selectMode: boolean
  selected: boolean
  onPress: (item: MemoryItem) => void
  onLongPress: (item: MemoryItem) => void
  onDelete: (item: MemoryItem) => void
}

const MemoryCard = React.memo(function MemoryCard({ item, selectMode, selected, onPress, onLongPress, onDelete }: CardProps) {
  const { say } = useTts()
  const uri = memoryImageUrl(item.image_url)
  const label = CATEGORY_LABEL[item.category] ?? item.category
  const pct = item.confidence != null ? `${Math.round(item.confidence * 100)}%` : null

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${item.text}. Ketuk untuk ${selectMode ? 'pilih' : 'buka'}`}
    >
      {/* Checkbox overlay */}
      {selectMode && (
        <View style={styles.checkOverlay}>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Ionicons name={'checkmark' as IoniconName} size={12} color="#000" />}
          </View>
        </View>
      )}

      {uri ? (
        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" resizeMethod="resize" />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name={CATEGORY_ICON[item.category] ?? 'image-outline'} size={22} color="rgba(255,255,255,0.2)" />
        </View>
      )}

      <View style={styles.cardBody}>
        {/* Category chip */}
        <View style={styles.chipRow}>
          <View style={styles.chip}>
            <Ionicons name={CATEGORY_ICON[item.category] ?? 'image-outline'} size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.chipText}>{label}</Text>
          </View>
          {pct && <Text style={styles.cardConfidence}>{pct}</Text>}
        </View>
        <Text style={styles.cardText} numberOfLines={2}>{item.text}</Text>
        <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
      </View>

      {!selectMode && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => { say(`Hapus memori ${label}`, {}); onDelete(item) }}
          accessibilityRole="button"
          accessibilityLabel={`Hapus memori ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={'trash-bin-outline' as IoniconName} size={18} color="rgba(255,96,96,0.7)" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}, (prev, next) => (
  prev.item.id === next.item.id &&
  prev.selectMode === next.selectMode &&
  prev.selected === next.selected
))

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets()
  const tabBarHeight = TAB_CONTENT_HEIGHT + insets.bottom
  const { token, clearAuth } = useAuth()

  const { say } = useTts()

  const [items, setItems] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all')

  const lastFetchRef = useRef<number>(0)
  const cacheReadyRef = useRef(false)

  // Single delete
  const [pendingDelete, setPendingDelete] = useState<MemoryItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Detail modal
  const [detailItem, setDetailItem] = useState<MemoryItem | null>(null)

  // Select mode
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)

  // Stable ref so callbacks don't change when selectMode changes
  const selectModeRef = useRef(selectMode)
  selectModeRef.current = selectMode

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items
    return items.filter(it => it.category === activeFilter)
  }, [items, activeFilter])

  const sections = useMemo(() => groupByDate(filteredItems), [filteredItems])
  const allIds = useMemo(() => filteredItems.map((it) => it.id), [filteredItems])
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!token) { setLoading(false); return }
    if (mode === 'refresh') setRefreshing(true)
    setError(null)
    try {
      const data = await fetchMemories(token)
      setItems(data)
      lastFetchRef.current = Date.now()
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        await clearAuth()
      } else {
        setError('Gagal memuat memori. Tarik untuk coba lagi.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  // Muat cache disk sekali di awal supaya tab Memori langsung tampil sesuatu
  // walau offline / baru buka app (state in-memory items hilang tiap restart).
  useEffect(() => {
    loadCachedMemories().then((cached) => {
      if (cached.length > 0) {
        setItems(cached)
        setLoading(false)
      }
      cacheReadyRef.current = true
    })
  }, [])

  // Simpan ke disk tiap items berubah (hasil fetch/delete) — tapi tunggu cache
  // awal selesai dibaca dulu, supaya state kosong awal tidak menimpa cache lama.
  useEffect(() => {
    if (!cacheReadyRef.current) return
    saveCachedMemories(items)
  }, [items])

  // Cache: skip fetch jika data baru diambil dalam 2 menit terakhir — kecuali
  // ada scan baru (dirty flag dari saveMemory) yang wajib tampil segera.
  useFocusEffect(useCallback(() => {
    if (isMemoriesDirty()) {
      clearMemoriesDirty()
      load('initial')
      return
    }
    const now = Date.now()
    if (now - lastFetchRef.current < CACHE_MS && items.length > 0) return
    load('initial')
  }, [load]))

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const handleCardPress = useCallback((item: MemoryItem) => {
    if (selectModeRef.current) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.has(item.id) ? next.delete(item.id) : next.add(item.id)
        return next
      })
    } else {
      setDetailItem(item)
    }
  }, [])

  const handleCardLongPress = useCallback((item: MemoryItem) => {
    if (!selectModeRef.current) {
      setSelectMode(true)
      setSelectedIds(new Set([item.id]))
      say('Mode pilih aktif. Ketuk item lain untuk pilih lebih banyak.', {})
    }
  }, [say])

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSel = allIds.length > 0 && allIds.every((id) => prev.has(id))
      say(allSel ? 'Semua dibatalkan' : `Semua dipilih. ${allIds.length} item.`, {})
      return allSel ? new Set() : new Set(allIds)
    })
  }, [allIds, say])

  const handleFilterChange = useCallback((f: CategoryFilter) => {
    setActiveFilter(f)
    const label = FILTER_OPTIONS.find(o => o.key === f)?.label ?? 'Semua'
    say(`Filter ${label}`, {})
  }, [say])

  // Single delete
  const handleConfirmDelete = useCallback(async () => {
    if (!token || !pendingDelete) return
    setDeleting(true)
    try {
      await deleteMemory(token, pendingDelete.id)
      setItems((prev) => prev.filter((it) => it.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch {
      setError('Gagal menghapus memori.')
    } finally {
      setDeleting(false)
    }
  }, [token, pendingDelete])

  // Bulk delete
  const handleConfirmBulkDelete = useCallback(async () => {
    if (!token || selectedIds.size === 0) return
    setDeleting(true)
    try {
      await Promise.all([...selectedIds].map((id) => deleteMemory(token, id)))
      setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)))
      exitSelectMode()
      setPendingBulkDelete(false)
    } catch {
      setError('Gagal menghapus beberapa memori.')
    } finally {
      setDeleting(false)
    }
  }, [token, selectedIds, exitSelectMode])

  return (
    <View style={[styles.container, { paddingBottom: tabBarHeight }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        {selectMode ? (
          <View style={styles.selectHeader}>
            {/* Cancel */}
            <TouchableOpacity
              onPress={() => { say('Batal pilih', {}); exitSelectMode() }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Batal pilih"
            >
              <Ionicons name={'close' as IoniconName} size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            {/* Count */}
            <Text style={styles.selectCount}>
              {selectedIds.size > 0 ? `${selectedIds.size} dipilih` : 'Pilih item'}
            </Text>

            {/* Select all */}
            <TouchableOpacity
              style={styles.selectAllBtn}
              onPress={handleToggleSelectAll}
              accessibilityRole="checkbox"
              accessibilityLabel={allSelected ? 'Batal pilih semua' : 'Pilih semua'}
            >
              <View style={[styles.checkbox, allSelected && styles.checkboxSelected]}>
                {allSelected && <Ionicons name={'checkmark' as IoniconName} size={12} color="#000" />}
              </View>
              <Text style={styles.selectAllLabel}>Semua</Text>
            </TouchableOpacity>

            {/* Delete selected */}
            <TouchableOpacity
              style={[styles.deleteSelectedBtn, selectedIds.size === 0 && styles.deleteSelectedBtnDisabled]}
              onPress={() => {
                if (selectedIds.size > 0) {
                  say(`Hapus ${selectedIds.size} item`, {})
                  setPendingBulkDelete(true)
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Hapus ${selectedIds.size} item`}
              disabled={selectedIds.size === 0}
            >
              <Ionicons name={'trash-bin-outline' as IoniconName} size={16} color={selectedIds.size > 0 ? '#ff6060' : 'rgba(255,96,96,0.3)'} />
              {selectedIds.size > 0 && (
                <Text style={styles.deleteSelectedLabel}>Hapus</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.pageTitle}>Memori</Text>
        )}
      </View>

      {/* ── Filter bar ── */}
      {!selectMode && (
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterBtn, activeFilter === opt.key && styles.filterBtnActive]}
              onPress={() => handleFilterChange(opt.key)}
              accessibilityRole="button"
              accessibilityLabel={`Filter ${opt.label}${activeFilter === opt.key ? ', aktif' : ''}`}
            >
              <Text style={[styles.filterBtnText, activeFilter === opt.key && styles.filterBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="rgba(255,255,255,0.3)" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemoryCard
              item={item}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onPress={handleCardPress}
              onLongPress={handleCardLongPress}
              onDelete={setPendingDelete}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderWrap}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          contentContainerStyle={filteredItems.length === 0 ? styles.listEmpty : styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          initialNumToRender={8}
          windowSize={7}
          maxToRenderPerBatch={8}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor="rgba(255,255,255,0.4)"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={'images-outline' as IoniconName} size={36} color="rgba(255,255,255,0.12)" />
              <Text style={styles.emptyTitle}>{error ?? 'Belum ada memori'}</Text>
              {!error && <Text style={styles.emptySubtitle}>Hasil pindai akan tersimpan di sini</Text>}
            </View>
          }
        />
      )}

      <MemoryDetailModal item={detailItem} onClose={() => setDetailItem(null)} />

      {/* Single delete */}
      <ConfirmModal
        visible={pendingDelete != null}
        title="Hapus Memori"
        message="Memori ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmLabel={deleting ? 'Menghapus...' : 'Hapus'}
        cancelLabel="Batal"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {/* Bulk delete */}
      <ConfirmModal
        visible={pendingBulkDelete}
        title={`Hapus ${selectedIds.size} Memori`}
        message={`${selectedIds.size} memori akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel={deleting ? 'Menghapus...' : `Hapus ${selectedIds.size}`}
        cancelLabel="Batal"
        danger
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setPendingBulkDelete(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pageTitle: {
    fontFamily: 'Telma-Medium',
    fontSize: 36,
    color: colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },

  // ── Filter bar ──
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'transparent',
  },
  filterBtnActive: {
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterBtnText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  filterBtnTextActive: {
    color: colors.text,
  },

  // ── Select mode header ──
  selectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectCount: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    letterSpacing: 0.3,
    marginLeft: spacing.xs,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectAllLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  deleteSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,96,96,0.3)',
  },
  deleteSelectedBtnDisabled: {
    borderColor: 'rgba(255,96,96,0.1)',
  },
  deleteSelectedLabel: {
    color: '#ff6060',
    fontSize: 13,
    letterSpacing: 0.3,
  },

  // ── Checkbox ──
  checkOverlay: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    zIndex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  listEmpty: {
    flexGrow: 1,
  },

  // ── Section header ──
  sectionHeaderWrap: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    marginTop: spacing.sm,
  },
  sectionHeaderText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Card ──
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: spacing.xs,
  },
  cardSelected: {
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: '#000',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardBody: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardConfidence: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    letterSpacing: 1,
  },
  cardText: {
    color: colors.text,
    fontSize: 14,
    letterSpacing: 0.2,
    lineHeight: 19,
  },
  cardTime: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  deleteBtn: {
    alignSelf: 'center',
    padding: spacing.sm,
  },

  // ── Empty ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
    letterSpacing: 1.5,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.12)',
    fontSize: 11,
    letterSpacing: 1,
  },
})
