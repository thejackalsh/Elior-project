import type { IOCRService, OCRResult } from './IOCRService'

// Stub — implement post-production
// Set EXPO_PUBLIC_OCR_PROVIDER=google-cloud + fill EXPO_PUBLIC_GOOGLE_VISION_KEY
export class GoogleCloudVisionProvider implements IOCRService {
  constructor(private readonly apiKey: string) {}

  async recognize(_imageUri: string): Promise<OCRResult> {
    throw new Error('GoogleCloudVisionProvider not implemented. Use mlkit for development.')
  }
}
