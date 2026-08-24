export const serviceConfig = {
  stt: (process.env.EXPO_PUBLIC_STT_PROVIDER ?? 'native') as 'native' | 'google-cloud',
  tts: (process.env.EXPO_PUBLIC_TTS_PROVIDER ?? 'rn-tts') as 'expo' | 'google-cloud' | 'rn-tts',
  ocr: (process.env.EXPO_PUBLIC_OCR_PROVIDER ?? 'mlkit') as 'mlkit' | 'google-cloud',
  backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000',
  authUrl: process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://10.0.2.2:8000',
  googleSttKey: process.env.EXPO_PUBLIC_GOOGLE_STT_KEY ?? '',
  googleTtsKey: process.env.EXPO_PUBLIC_GOOGLE_TTS_KEY ?? '',
  googleVisionKey: process.env.EXPO_PUBLIC_GOOGLE_VISION_KEY ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
}
