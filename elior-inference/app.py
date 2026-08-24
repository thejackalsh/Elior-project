import logging
import time
import traceback

import os


class _NoopSpaces:
    """Pengganti modul `spaces` di luar HuggingFace ZeroGPU — @GPU jadi no-op."""

    @staticmethod
    def GPU(*_args, **_kwargs):  # noqa: N802
        return lambda fn: fn


# ponytail: `spaces` cuma ada di HF ZeroGPU. Set ELIOR_ZEROGPU=0 (dipakai
# docker-compose) untuk memaksa mode lokal; selain itu coba impor apa adanya.
if os.getenv("ELIOR_ZEROGPU", "auto").lower() in ("0", "false", "off"):
    spaces = _NoopSpaces
else:
    try:
        import spaces
    except ImportError:
        spaces = _NoopSpaces

import gradio as gr
from inference import object_detect, qwen
from inference.utils import decode_image, letterbox, is_too_dark

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
log = logging.getLogger("elior")


def _core(img_bgr, mode: str) -> dict:
    if is_too_dark(img_bgr):
        log.info("[core] gelap")
        return {"text": "Pencahayaan terlalu gelap, arahkan ke cahaya",
                "category": mode, "confidence": None, "bbox": None}

    h_orig, w_orig = img_bgr.shape[:2]
    log.info("[core] mode=%s %dx%d", mode, w_orig, h_orig)

    if mode == "object":
        img_lb, scale, x_off, y_off = letterbox(img_bgr)
        t = time.time()
        result = object_detect.predict(img_lb, scale, x_off, y_off, w_orig, h_orig)
        log.info("[core] yolo-obj %.2fs → %s", time.time()-t,
                 result.get("labels_prompt") if result else None)
        if result is None:
            t = time.time()
            caption = qwen.caption(img_bgr, "")
            log.info("[core] yolo-miss qwen %.2fs → %r", time.time()-t, caption)
            return {"text": caption, "category": "object", "confidence": None, "bbox": None}
        t = time.time()
        caption = qwen.caption(img_bgr, result["labels_prompt"])
        log.info("[core] qwen %.2fs → %r", time.time()-t, caption)
        return {"text": f"Terdeteksi {result['labels_prompt']}. {caption}",
                "category": "object",
                "confidence": result["confidence"], "bbox": result["bbox"]}

    else:
        return {"text": "Deteksi rupiah dilakukan di perangkat",
                "category": "rupiah", "confidence": None, "bbox": None}


@spaces.GPU(duration=120)
def analyze(image_b64: str, mode: str) -> dict:
    t0 = time.time()
    log.info("=== START mode=%s len=%d ===", mode, len(image_b64 or ""))
    try:
        if not image_b64:
            return {"text": "Tidak ada gambar", "category": mode,
                    "confidence": None, "bbox": None}
        img_bgr = decode_image(image_b64)
        if img_bgr is None:
            return {"text": "Gambar tidak valid", "category": mode,
                    "confidence": None, "bbox": None}
        out = _core(img_bgr, (mode or "rupiah").lower())
        log.info("=== DONE %.2fs %r ===", time.time()-t0, out.get("text"))
        return out
    except Exception as e:
        log.error("=== ERROR %.2fs: %s\n%s ===", time.time()-t0, e, traceback.format_exc())
        return {"text": "Terjadi kesalahan di server, coba lagi",
                "category": mode, "confidence": None, "bbox": None}


# gr.Interface — pola resmi ZeroGPU docs, bukan hidden btn.click
demo = gr.Interface(
    fn=analyze,
    inputs=[
        gr.Textbox(label="image_b64"),
        gr.Textbox(label="mode", value="rupiah"),
    ],
    outputs=gr.JSON(label="result"),
    title="ELIOR Inference",
    description="POST /gradio_api/call/analyze  body: {\"data\": [\"<base64>\", \"rupiah|object\"]}",
    api_name="analyze",
    css=".gradio-container{display:none!important}",
)

if __name__ == "__main__":
    demo.queue().launch(server_name="0.0.0.0", server_port=7860)
