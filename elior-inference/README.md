---
title: ELIOR Inference
emoji: 👁
colorFrom: indigo
colorTo: purple
sdk: gradio
sdk_version: 5.9.1
hardware: zero-gpu
pinned: false
license: mit
app_port: 7860
---

# ELIOR Inference API

Gradio + YOLOv11 + Qwen2.5-VL inference server untuk aplikasi ELIOR (tunanetra).

## Arsitektur

```
Mobile Camera (Android)
        │
        ├── mode: rupiah → SSD MobileNetV4 on-device (tidak ke server)
        │
        ├── mode: baca   → ML Kit OCR on-device (tidak ke server)
        │
        └── mode: object → POST ke HF ZeroGPU
                │
                ▼
┌──────────────────────────────────────────────┐
│           ELIOR Inference (HF ZeroGPU)        │
│                                               │
│  YOLOv11n (COCO)                             │
│       │  deteksi objek + bounding box         │
│       ▼                                       │
│  Qwen2.5-VL-3B-Instruct                      │
│       │  caption Bahasa Indonesia             │
│       ▼                                       │
│  {text, confidence, bbox}                     │
└──────────────────────────────────────────────┘
        │
        ▼
  ResultDrawer Mobile
```

### Qwen2.5-VL Internal

```
Image → Visual Encoder (ViT-based, dynamic resolution)
              │
              ▼  visual tokens
         Qwen2.5 LLM
              │
              ▼
         Teks Bahasa Indonesia
```

Tidak ada Q-Former bottleneck. Visual tokens masuk langsung ke attention LLM.

## Mode

| Mode | Diproses di | Model |
|------|-------------|-------|
| `object` | HF ZeroGPU (server) | YOLOv11n COCO + Qwen2.5-VL-3B |
| `rupiah` | On-device (Android) | SSD MobileNetV4 TFLite |
| `baca` | On-device (Android) | ML Kit OCR |

## API

### Request

```json
{
  "data": ["<base64>", "object"]
}
```

Endpoint: `POST /gradio_api/call/analyze`

### Response

```json
{
  "text": "deskripsi dalam Bahasa Indonesia",
  "category": "object",
  "confidence": 0.95,
  "bbox": [x1, y1, x2, y2]
}
```

Mode `rupiah` selalu dikembalikan sebagai:
```json
{ "text": "Deteksi rupiah dilakukan di perangkat", "category": "rupiah", "confidence": null, "bbox": null }
```

## Struktur

```
app.py                  ← Gradio router + @spaces.GPU
inference/
  __init__.py           ← export object_detect, qwen, utils
  utils.py              ← decode_image, letterbox, is_too_dark
  object_detect.py      ← YOLOv11n COCO detection
  qwen.py               ← Qwen2.5-VL-3B-Instruct captioning
```

Server-side rupiah classifier (`inference/rupiah.py`) dan BLIP-2 captioning (`inference/blip2.py`, `dequantize_blip2.py`) sudah dihapus — deteksi rupiah 100% on-device, deskripsi objek pakai Qwen2.5-VL (bukan BLIP-2).
