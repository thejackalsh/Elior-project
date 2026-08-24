import {
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition'
import type {
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition'
import type { ISpeechToText } from './ISpeechToText'

export class NativeSTTProvider implements ISpeechToText {
  private resultCb: ((text: string) => void) | null = null
  private errorCb: ((err: Error) => void) | null = null
  private startCb: (() => void) | null = null
  private endCb: (() => void) | null = null
  private subs: Array<{ remove(): void }> = []

  async startListening(locale = 'id-ID'): Promise<void> {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!perm.granted) {
      this.errorCb?.(new Error('Izin mikrofon ditolak'))
      return
    }

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (e: ExpoSpeechRecognitionResultEvent) => {
        const transcript = e.results?.[0]?.transcript
        if (transcript) this.resultCb?.(transcript)
      }),
      ExpoSpeechRecognitionModule.addListener('error', (e: ExpoSpeechRecognitionErrorEvent) => {
        this.errorCb?.(new Error(e.message ?? 'STT error'))
      }),
      ExpoSpeechRecognitionModule.addListener('start', () => {
        this.startCb?.()
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        this.endCb?.()
        this._removeSubs()
      }),
    )

    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: false,
      continuous: false,
    })
  }

  async stopListening(): Promise<void> {
    ExpoSpeechRecognitionModule.stop()
  }

  onResult(cb: (text: string) => void): void { this.resultCb = cb }
  onError(cb: (err: Error) => void): void { this.errorCb = cb }
  onStart(cb: () => void): void { this.startCb = cb }
  onEnd(cb: () => void): void { this.endCb = cb }

  destroy(): void {
    ExpoSpeechRecognitionModule.stop()
    this._removeSubs()
    this.resultCb = null
    this.errorCb = null
    this.startCb = null
    this.endCb = null
  }

  private _removeSubs(): void {
    this.subs.forEach((s) => s.remove())
    this.subs = []
  }
}
