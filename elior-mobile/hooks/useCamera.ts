import { useRef, useState, useCallback } from 'react'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImageManipulator from 'expo-image-manipulator'

export type CameraState = 'idle' | 'starting' | 'active' | 'error'

export interface CapturedFrame {
  base64: string
  uri: string
  photoWidth: number
  photoHeight: number
}

export function useCamera() {
  const cameraRef = useRef<CameraView>(null)
  const [state, setState] = useState<CameraState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [permission, requestPermission] = useCameraPermissions()

  const startCamera = useCallback(async () => {
    setState('starting')
    setError(null)

    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) {
        setError('Izin kamera ditolak. Mohon izinkan akses kamera di pengaturan.')
        setState('error')
        return
      }
    }

    setState('active')
  }, [permission, requestPermission])

  const stopCamera = useCallback(() => {
    setState('idle')
  }, [])

  // Lightweight snapshot for realtime ML loop — no base64, no EXIF normalization
  const captureSnapshot = useCallback(async (): Promise<{ uri: string; photoWidth: number; photoHeight: number } | null> => {
    if (!cameraRef.current || state !== 'active') return null
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.6,
        skipProcessing: true,
      })
      if (!photo?.uri) return null
      return { uri: photo.uri, photoWidth: photo.width ?? 0, photoHeight: photo.height ?? 0 }
    } catch {
      return null
    }
  }, [state])

  // Returns base64 (for backend) + uri (for ML Kit) + photo dimensions for viewfinder crop
  const captureFrame = useCallback(async (): Promise<CapturedFrame | null> => {
    if (!cameraRef.current || state !== 'active') return null

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.9,
        skipProcessing: false,
      })
      if (!photo?.base64 || !photo.uri) return null
      // Bake EXIF rotation into pixels so display URI always tegak
      const normalized = await ImageManipulator.manipulateAsync(
        photo.uri, [], { format: ImageManipulator.SaveFormat.JPEG }
      )
      return {
        base64: photo.base64,
        uri: normalized.uri,
        photoWidth: normalized.width,
        photoHeight: normalized.height,
      }
    } catch {
      setError('Tidak dapat mengambil gambar dari kamera')
      return null
    }
  }, [state])

  return {
    cameraRef,
    state,
    error,
    permission,
    startCamera,
    stopCamera,
    captureFrame,
    captureSnapshot,
  }
}
