import * as Speech from 'expo-speech'
import type { ITextToSpeech, TTSOptions } from './ITextToSpeech'

export class ExpoSpeechProvider implements ITextToSpeech {
  private selectedVoice: string | undefined

  private async init(): Promise<void> {
    if (this.selectedVoice !== undefined) return
    try {
      const voices = await Speech.getAvailableVoicesAsync()
      const idVoices = voices.filter(v => v.language?.startsWith('id'))

      // Voice id-ID kualitas tertinggi — TANPA heuristik gender, sama seperti
      // ReactNativeTTSProvider (provider aktif). Lihat file itu untuk rationale.
      // ponytail: expo-speech's Voice.quality adalah enum string
      // ('Enhanced'/'Default'), bukan angka seperti react-native-tts — dan
      // tidak punya networkConnectionRequired. Provider ini dormant (default
      // is rn-tts) jadi tidak ditambah guard offline.
      const qScore = (v: Speech.Voice) => (v.quality === 'Enhanced' ? 1 : 0)
      const best = [...idVoices].sort((a, b) => qScore(b) - qScore(a))[0]

      if (__DEV__) {
        console.log('[TTS] id-ID voices:', idVoices.map(v => `${v.identifier} q=${v.quality}`))
        console.log('[TTS] selected:', best?.identifier)
      }

      this.selectedVoice = best?.identifier ?? ''
    } catch {
      this.selectedVoice = ''
    }
  }

  async requestAudioFocus(): Promise<void> {}
  async releaseAudioFocus(): Promise<void> {}

  async speak(text: string, opts: TTSOptions = {}): Promise<void> {
    await this.init()
    const { locale = 'id-ID', pitch = 1.0, rate = 0.9, onDone } = opts

    return new Promise((resolve) => {
      Speech.speak(text, {
        language: locale,
        voice: this.selectedVoice || undefined,
        pitch,
        rate,
        onDone: () => { onDone?.(); resolve() },
        onStopped: () => resolve(),
        onError: () => resolve(),
      })
    })
  }

  async stop(): Promise<void> {
    await Speech.stop()
  }

  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync()
  }
}
