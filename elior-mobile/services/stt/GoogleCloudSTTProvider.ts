import type { ISpeechToText } from './ISpeechToText'

// Stub — implement post-production
// Set EXPO_PUBLIC_STT_PROVIDER=google-cloud + fill EXPO_PUBLIC_GOOGLE_STT_KEY
export class GoogleCloudSTTProvider implements ISpeechToText {
  constructor(private readonly apiKey: string) {}

  async startListening(_locale = 'id-ID'): Promise<void> {
    throw new Error('GoogleCloudSTTProvider not implemented. Use native for development.')
  }

  async stopListening(): Promise<void> {}
  onResult(_cb: (text: string) => void): void {}
  onError(_cb: (err: Error) => void): void {}
  onStart(_cb: () => void): void {}
  onEnd(_cb: () => void): void {}
  destroy(): void {}
}
