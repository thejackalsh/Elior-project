import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImageManipulator from 'expo-image-manipulator'
import { serviceConfig } from '../config'
import type { AnalyzeCategory } from './analyze/AnalyzeService'

const base = serviceConfig.authUrl
const MEMORIES_CACHE_KEY = '@elior_memories_cache_v1'

export interface MemoryItem {
  id: string
  category: AnalyzeCategory
  text: string
  ocr_text: string | null
  confidence: number | null
  image_url: string | null
  created_at: string
}

interface SaveArgs {
  category: AnalyzeCategory
  text: string
  confidence?: number
  ocrText?: string
  imageUri?: string
}

/** Ubah path relatif ("/uploads/..") jadi URL penuh untuk <Image>. */
export function memoryImageUrl(path: string | null): string | null {
  if (!path) return null
  return path.startsWith('http') ? path : `${base}${path}`
}

async function uploadImage(token: string, category: AnalyzeCategory, uri: string): Promise<string | null> {
  // Foto kamera full-res (2-5 MB) dipakai sebagai thumbnail 64px (list) dan
  // gambar detail (modal, layar HP). 720p cukup tajam untuk keduanya dan jauh
  // lebih kecil dari 1080p — kurangi payload + biaya decode saat scroll list
  // tanpa crop (resize width saja, aspect ratio terjaga).
  const small = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 720 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  )
  const form = new FormData()
  // RN FormData file shape
  form.append('image', { uri: small.uri, name: 'scan.jpg', type: 'image/jpeg' } as any)
  const res = await fetch(`${base}/uploads/${category}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.image_url ?? null
}

export interface SaveMemoryResult {
  rateLimitUntil?: Date
}

// Write (saveMemory, dipanggil dari camera.tsx) dan read (memories.tsx list state)
// tidak berbagi store — flag module-level ini jadi titik sambung satu-satunya,
// dipakai memories.tsx buat tahu ada scan baru dan bypass cache 2 menitnya.
let memoriesDirty = false
export function isMemoriesDirty(): boolean { return memoriesDirty }
export function clearMemoriesDirty(): void { memoriesDirty = false }

/**
 * Simpan hasil scan ke memori (history) — upload foto dulu (best-effort),
 * lalu POST metadata. Tidak melempar error agar tidak ganggu UX scan.
 * Mengembalikan rateLimitUntil jika kuota harian habis.
 */
export async function saveMemory(token: string, args: SaveArgs): Promise<SaveMemoryResult> {
  try {
    let imageUrl: string | null = null
    if (args.imageUri) {
      try {
        imageUrl = await uploadImage(token, args.category, args.imageUri)
      } catch {
        // upload gagal (offline dll) — tetap simpan teks tanpa foto
      }
    }
    const res = await fetch(`${base}/history`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: args.category,
        text: args.text,
        confidence: args.confidence ?? null,
        ocr_text: args.ocrText ?? null,
        image_url: imageUrl,
      }),
    })
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      const resetAt = (body as any).reset_at
        ? new Date((body as any).reset_at)
        : new Date(Date.now() + 24 * 60 * 60 * 1000)
      return { rateLimitUntil: resetAt }
    }
    if (res.ok) memoriesDirty = true
    return {}
  } catch {
    return {}
  }
}

export class UnauthorizedError extends Error {
  constructor() { super('Sesi berakhir. Silakan login ulang.') }
}

/** List memori tersimpan terakhir (disk) — dipakai supaya tab Memori langsung
 *  tampil sesuatu saat app baru dibuka offline, sebelum fetch network selesai. */
export async function loadCachedMemories(): Promise<MemoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(MEMORIES_CACHE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCachedMemories(items: MemoryItem[]): void {
  AsyncStorage.setItem(MEMORIES_CACHE_KEY, JSON.stringify(items)).catch(() => {})
}

export async function fetchMemories(token: string): Promise<MemoryItem[]> {
  const res = await fetch(`${base}/history`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error('Gagal memuat memori')
  return res.json()
}

export async function clearMemories(token: string): Promise<void> {
  await fetch(`${base}/history`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function deleteMemory(token: string, id: string): Promise<void> {
  const res = await fetch(`${base}/history/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Gagal menghapus memori')
}
