export interface ISpeechToText {
  startListening(locale?: string): Promise<void>
  stopListening(): Promise<void>
  onResult(cb: (text: string) => void): void
  onError(cb: (err: Error) => void): void
  onStart(cb: () => void): void
  onEnd(cb: () => void): void
  destroy(): void
}
