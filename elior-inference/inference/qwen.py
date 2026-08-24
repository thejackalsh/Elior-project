import numpy as np
import torch
import cv2
from PIL import Image
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info

MODEL_ID = "Qwen/Qwen2.5-VL-3B-Instruct"

# ponytail: CPU tetap jalan tapi ~30-60 detik per gambar — fp16 tidak didukung
# di CPU jadi turun ke fp32. GPU wajib kalau butuh respons cepat.
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

# ZeroGPU: load CPU di module level, pindah ke device target di dalam fungsi
_processor = AutoProcessor.from_pretrained(
    MODEL_ID,
    min_pixels=256 * 28 * 28,
    max_pixels=512 * 28 * 28,
)
_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    MODEL_ID,
    torch_dtype=DTYPE,
    low_cpu_mem_usage=True,
)
_model.eval()


# System prompt: konteks asistif + aturan gaya (ringkas, faktual, grounded, anti-halusinasi).
# Plus contoh gaya (style exemplar) untuk anchor panjang & bahasa output.
SYSTEM_PROMPT = (
    "Kamu adalah teman yang membantu pengguna tunanetra di Indonesia melihat dunia lewat kamera. "
    "Deskripsikan apa yang ada di gambar dengan bahasa Indonesia yang hangat, santai, dan informatif — seperti menjelaskan ke teman, bukan laporan teknis. "

    "Kalau ada merek atau logo yang terbaca, sebutkan. Kalau tidak terlihat, bilang mereknya tidak kelihatan. "
    "Sebutkan warna yang dominan. Kalau ada tulisan yang terbaca di gambar, bacakan isinya. "
    "Beri nama objek yang spesifik sesuai yang terlihat — misalnya jenis remote, jenis minuman, jenis kendaraan — bukan nama generik. "
    "Gunakan istilah yang lazim dipakai sehari-hari di Indonesia. "
    "Kalau ada orang, ceritakan sedang apa mereka. Bedakan apakah itu orang nyata, foto, atau lukisan. "
    "Kalau latar belakang memberikan konteks (di jalan, di taman, di dalam ruangan), sebutkan dengan ringan. "

    "Maksimal 2-3 kalimat. Jangan mengarang hal yang tidak terlihat. "
    "Kalau ada ketidakpastian, boleh pakai 'sepertinya' atau 'kayaknya'. "

    "Contoh gaya: 'Ini botol Aqua 600ml, bening dengan tutup biru. Kayaknya lagi di dapur atau meja makan.' "
    "Contoh gaya: 'Remote AC putih, sepertinya Daikin atau Panasonic — ada tombol suhu dan mode.' "
    "Contoh gaya: 'Seorang wanita berbaju merah sedang menari di atas panggung.' "
    "Contoh gaya: 'Mereknya tidak kelihatan, tapi ini seperti kotak kardus cokelat biasa.'"
)


def caption(img_bgr: np.ndarray, prompt: str = "") -> str:
    if next(_model.parameters()).device.type != DEVICE:
        _model.to(DEVICE)

    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb)

    # Grounding: label YOLO dimasukkan sebagai anchor (retrieval dari detektor).
    if prompt:
        text_content = (
            f"Objek yang terdeteksi: {prompt}. "
            "Deskripsikan gambar ini untuk pengguna tunanetra secara ringkas dan grounded pada objek tersebut."
        )
    else:
        text_content = "Deskripsikan gambar ini untuk pengguna tunanetra secara ringkas dan jelas."

    messages = [
        {"role": "system", "content": [{"type": "text", "text": SYSTEM_PROMPT}]},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": pil_img},
                {"type": "text", "text": text_content},
            ],
        },
    ]

    text = _processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = _processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    ).to(DEVICE, DTYPE)

    with torch.no_grad():
        generated_ids = _model.generate(
            **inputs,
            max_new_tokens=80,        # naik dari 40 — kalimat tidak kepotong
            do_sample=False,
            repetition_penalty=1.1,   # hindari loop/pengulangan
        )

    trimmed = [
        out[len(inp):] for inp, out in zip(inputs.input_ids, generated_ids)
    ]
    result = _processor.batch_decode(
        trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )[0].strip()

    return result if result else "Tidak dapat mendeskripsikan gambar"
