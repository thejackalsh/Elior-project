---
title: ELIOR Inference
emoji: 👁
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# ELIOR Inference API

FastAPI backend for ELIOR — YOLOv11m Rupiah detection.

## Endpoint

- `GET /` — health check
- `POST /analyze` — base64 image → denomination text
