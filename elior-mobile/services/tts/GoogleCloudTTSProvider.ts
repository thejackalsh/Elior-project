import type { ITextToSpeech, TTSOptions } from './ITextToSpeech'

// Stub — implement post-production
// Voice: id-ID-Wavenet-A, set EXPO_PUBLIC_TTS_PROVIDER=google-cloud
export class GoogleCloudTTSProvider implements ITextToSpeech {
  constructor(private readonly apiKey: string) {}

  async speak(_text: string, _opts?: TTSOptions): Promise<void> {
    throw new Error('GoogleCloudTTSProvider not implemented. Use expo for development.')
  }

  async stop(): Promise<void> {}
  async isSpeaking(): Promise<boolean> { return false }
  async requestAudioFocus(): Promise<void> {}
  async releaseAudioFocus(): Promise<void> {}
}
