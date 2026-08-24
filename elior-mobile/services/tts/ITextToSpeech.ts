export interface TTSOptions {
  locale?: string
  pitch?: number
  rate?: number
  onDone?: () => void
}

export interface ITextToSpeech {
  speak(text: string, opts?: TTSOptions): Promise<void>
  stop(): Promise<void>
  isSpeaking(): Promise<boolean>
  requestAudioFocus(): Promise<void>
  releaseAudioFocus(): Promise<void>
}
