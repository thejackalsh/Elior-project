import Tts from 'react-native-tts'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ITextToSpeech, TTSOptions } from './ITextToSpeech'

const GOOGLE_TTS = 'com.google.android.tts'
const INSTALL_PROMPTED_KEY = 'tts_google_install_prompted'

export class ReactNativeTTSProvider implements ITextToSpeech {
  private initialized = false
  private speaking = false
  private finishListener: (() => void) | null = null
  private selectedVoiceId: string | null = null

  private async init(): Promise<void> {
    if (this.initialized) return

    // 1. Paksa engine Google TTS — panggil LANGSUNG tanpa cek Tts.engines()
    //    dulu. engines() pakai PackageManager.queryIntentServices() yang bisa
    //    gagal diam-diam nemuin com.google.android.tts di device ter-lock OEM
    //    (Android 11+ package-visibility), yang dulu bikin engine gak pernah
    //    dipaksa & app pasrah ke default OS (kadang male). Kalau device
    //    beneran gak punya Google TTS, baru prompt install sekali.
    try {
      await Tts.setDefaultEngine(GOOGLE_TTS)
    } catch {
      const prompted = await AsyncStorage.getItem(INSTALL_PROMPTED_KEY)
      if (!prompted) {
        await AsyncStorage.setItem(INSTALL_PROMPTED_KEY, '1')
        await Tts.requestInstallEngine().catch(() => {})
      }
    }

    // 2. Pilih voice id-ID offline kualitas tertinggi — TANPA heuristik gender.
    //    Sama seperti app versi paling awal (commit c2551ed): di Google TTS,
    //    voice id-ID kualitas-teratas defaultnya female. Heuristik keyword
    //    (idf/idd/…) yang dulu dipakai justru bikin regresi ke suara male di
    //    sebagian device, jadi dihapus.
    try {
      await Tts.setDefaultLanguage('id-ID').catch(() => {})
      const voices = await Tts.voices()
      const idVoices = voices.filter(v => v.language?.toLowerCase().startsWith('id'))

      if (__DEV__) {
        console.log('[TTS] id voices:', idVoices.map(v => `${v.id} net=${v.networkConnectionRequired} notInstalled=${v.notInstalled} q=${v.quality}`))
      }

      // App wajib bisa bicara offline (fitur inti utk tunanetra) — jangan pernah
      // pilih voice yang networkConnectionRequired (bikin TTS bisu total offline).
      // Prioritas: lokal terpasang → lokal (perlu download data), keduanya
      // diurutkan kualitas tertinggi.
      const localVoices = idVoices.filter(v => !v.networkConnectionRequired)
      const byQuality = (a: { quality?: number }, b: { quality?: number }) => (b.quality ?? 0) - (a.quality ?? 0)
      const best = [...localVoices.filter(v => !v.notInstalled)].sort(byQuality)[0]
               ?? [...localVoices].sort(byQuality)[0]

      if (best) {
        this.selectedVoiceId = best.id
        if (best.notInstalled) {
          await Tts.requestInstallData().catch(() => {})
        }
        await Tts.setDefaultVoice(best.id).catch(() => {})
        if (__DEV__) console.log('[TTS] selected voice:', best.id, 'q=', best.quality)
      } else if (__DEV__) {
        console.warn('[TTS] no offline id-ID voice found; using engine default')
      }
    } catch {
      // Gagal enumerasi voice — pakai default engine id-ID
    }

    this.initialized = true
  }

  async speak(text: string, opts: TTSOptions = {}): Promise<void> {
    await this.init()
    const { rate = 0.9, pitch = 1.0, onDone } = opts

    try {
      await Tts.setDefaultRate(rate, true)
      await Tts.setDefaultPitch(pitch)
      // Re-apply voice tiap speak supaya tidak hilang setelah app resume
      if (this.selectedVoiceId) {
        await Tts.setDefaultVoice(this.selectedVoiceId).catch(() => {})
      }
    } catch {}

    // Bersihkan listener lama sebelum tambah yang baru
    if (this.finishListener) {
      Tts.removeAllListeners('tts-finish')
      Tts.removeAllListeners('tts-cancel')
      Tts.removeAllListeners('tts-error')
      this.finishListener = null
    }

    return new Promise((resolve) => {
      this.speaking = true

      const finish = () => {
        this.speaking = false
        this.finishListener = null
        Tts.removeAllListeners('tts-finish')
        Tts.removeAllListeners('tts-cancel')
        Tts.removeAllListeners('tts-error')
        onDone?.()
        resolve()
      }

      this.finishListener = finish
      Tts.addEventListener('tts-finish', finish)
      Tts.addEventListener('tts-cancel', finish)
      Tts.addEventListener('tts-error', finish)

      try {
        Tts.speak(text)
      } catch {
        finish()
      }
    })
  }

  async stop(): Promise<void> {
    this.speaking = false
    this.finishListener = null
    Tts.removeAllListeners('tts-finish')
    Tts.removeAllListeners('tts-cancel')
    Tts.removeAllListeners('tts-error')
    try {
      await Tts.stop()
    } catch {}
  }

  async isSpeaking(): Promise<boolean> {
    return this.speaking
  }

  async requestAudioFocus(): Promise<void> {}
  async releaseAudioFocus(): Promise<void> {}
}
