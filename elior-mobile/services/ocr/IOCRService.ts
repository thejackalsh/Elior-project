export interface OCRBlock {
  text: string
  frame?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface OCRResult {
  text: string
  blocks?: OCRBlock[]
  confidence?: number
}

export interface IOCRService {
  recognize(imageUri: string): Promise<OCRResult>
}
