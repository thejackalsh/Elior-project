import { serviceConfig } from '../config'
import { NativeSTTProvider } from './stt/NativeSTTProvider'
import { GoogleCloudSTTProvider } from './stt/GoogleCloudSTTProvider'
import { ExpoSpeechProvider } from './tts/ExpoSpeechProvider'
import { GoogleCloudTTSProvider } from './tts/GoogleCloudTTSProvider'
import { ReactNativeTTSProvider } from './tts/ReactNativeTTSProvider'
import { MLKitOCRProvider } from './ocr/MLKitOCRProvider'
import { GoogleCloudVisionProvider } from './ocr/GoogleCloudVisionProvider'
import { AnalyzeService } from './analyze/AnalyzeService'
import type { ISpeechToText } from './stt/ISpeechToText'
import type { ITextToSpeech } from './tts/ITextToSpeech'
import type { IOCRService } from './ocr/IOCRService'

export const ServiceFactory = {
  stt(): ISpeechToText {
    if (serviceConfig.stt === 'google-cloud') {
      return new GoogleCloudSTTProvider(serviceConfig.googleSttKey)
    }
    return new NativeSTTProvider()
  },

  tts(): ITextToSpeech {
    if (serviceConfig.tts === 'google-cloud') {
      return new GoogleCloudTTSProvider(serviceConfig.googleTtsKey)
    }
    if (serviceConfig.tts === 'rn-tts') {
      return new ReactNativeTTSProvider()
    }
    return new ExpoSpeechProvider()
  },

  ocr(): IOCRService {
    if (serviceConfig.ocr === 'google-cloud') {
      return new GoogleCloudVisionProvider(serviceConfig.googleVisionKey)
    }
    return new MLKitOCRProvider()
  },

  analyze(): AnalyzeService {
    return new AnalyzeService(serviceConfig.backendUrl)
  },
}
