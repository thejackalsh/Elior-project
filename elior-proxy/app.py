import os
import json
import logging

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("elior-proxy")

# Upstream Gradio. Default menunjuk ke container `inference` di docker-compose.
# Kalau diarahkan ke HuggingFace Space, HF_TOKEN wajib diisi — token disimpan di
# sisi server (env/Space Secret) dan TIDAK pernah dikirim ke mobile.
GRADIO_URL = os.environ.get("GRADIO_SPACE_URL", "http://inference:7860").rstrip("/")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
TIMEOUT = 200.0

# Upstream lokal tidak perlu autentikasi; hanya Space HuggingFace yang butuh token.
NEEDS_TOKEN = "hf.space" in GRADIO_URL or "huggingface.co" in GRADIO_URL

app = FastAPI(title="ELIOR Inference Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    image: str            # base64
    mode: str = "rupiah"  # "rupiah" | "object"


class AnalyzeResponse(BaseModel):
    text: str
    category: str
    confidence: float | None = None
    bbox: list[float] | None = None


def _auth_headers() -> dict:
    # Token PRO → request authenticated → quota ZeroGPU 40 menit/hari (bukan anonim 2 menit)
    return {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}


def _parse_sse(raw: str) -> dict | None:
    """Ambil event 'complete' dari SSE Gradio, decode data[0]."""
    payload = None
    for block in raw.split("\n\n"):
        evt = data = ""
        for line in block.split("\n"):
            if line.startswith("event:"):
                evt = line[6:].strip()
            elif line.startswith("data:"):
                data = line[5:].strip()
        if evt == "error":
            return None
        if evt == "complete" and data:
            payload = data
        elif data and data != "null":
            payload = data
    if not payload or payload == "null":
        return None
    arr = json.loads(payload)
    return arr[0] if arr else None


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "ELIOR Inference Proxy",
        "upstream": GRADIO_URL,
        "authed": bool(HF_TOKEN),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest):
    if NEEDS_TOKEN and not HF_TOKEN:
        log.error("Upstream HuggingFace tapi HF_TOKEN kosong — request akan anonim (429)")
        raise HTTPException(status_code=500, detail="Server belum dikonfigurasi (token)")

    headers = _auth_headers()
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            # Step 1 — submit job, dapat event_id
            post = await client.post(
                f"{GRADIO_URL}/gradio_api/call/analyze",
                headers={**headers, "Content-Type": "application/json"},
                json={"data": [body.image, body.mode]},
            )
            post.raise_for_status()
            event_id = post.json().get("event_id")
            if not event_id:
                raise HTTPException(status_code=502, detail="Upstream tidak kasih event_id")

            # Step 2 — ambil hasil (stream nutup saat job selesai)
            get = await client.get(
                f"{GRADIO_URL}/gradio_api/call/analyze/{event_id}",
                headers={**headers, "Accept": "text/event-stream"},
            )
            get.raise_for_status()
            out = _parse_sse(get.text)
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Server tidak merespons, coba lagi")
        except httpx.HTTPError as e:
            log.error("upstream error: %s", e)
            raise HTTPException(status_code=502, detail="Gagal hubungi server inference")

    if not out or not isinstance(out.get("text"), str):
        raise HTTPException(status_code=502, detail="Server gagal memproses gambar")

    return AnalyzeResponse(
        text=out["text"],
        category=out.get("category", body.mode),
        confidence=out.get("confidence"),
        bbox=out.get("bbox"),
    )


if __name__ == "__main__":
    import uvicorn
    # 7860 = default HF Space. Lokal pakai PORT=7861 supaya tidak bentrok dengan
    # container/proses inference yang juga memakai 7860.
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
