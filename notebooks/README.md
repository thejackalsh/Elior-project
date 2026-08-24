# Notebooks — ELIOR

Notebook training/evaluasi model yang dipakai di aplikasi ELIOR. Semuanya dijalankan di Kaggle (GPU T4/P100).

## Isi

| Notebook | Model | Dipakai di produksi |
|---|---|---|
| `localizer-mobilenetv4-singleclass-v4.ipynb` | MobileNetV4 localizer, single-class bbox uang | ✅ `elior-mobile/assets/models/localizer_v4.tflite` |
| `classifier-mobilenetv4-rupiah-v16.ipynb` | MobileNetV4 classifier nominal rupiah, 11 kelas | ✅ `elior-mobile/assets/models/classifier_v16.tflite` |
| `classifier-mobilenetv4-rupiah-v16b.ipynb` | Varian v16 (eksperimen tuning) | ❌ pembanding |
| `project-finale-yolov11-common-objectv3.ipynb` | YOLOv11n deteksi objek umum (COCO) | ✅ `arkhangelos/elior-yolo` → `yolov11n_coco_best.pt` |
| `project-finale-yolov12-common-objectv3.ipynb` | YOLOv12n deteksi objek umum | ❌ pembanding |
| `project-finale-yolov11-yolov12-common-object.ipynb` | Perbandingan YOLOv11 vs YOLOv12 | ❌ evaluasi |
| `qwen2.5-3B-Finetune-QLoRA-Image-Captioning.ipynb` | Qwen2.5-VL-3B fine-tune QLoRA, caption Bahasa Indonesia | ✅ pipeline caption `elior-inference` |
| `image-captioning-bahasa-indonesia-blip-2-fine-tu.ipynb` | BLIP-2 fine-tune, caption Bahasa Indonesia | ❌ pendekatan sebelum Qwen — `arkhangelos/blip2-elior-fp16` |

Alur mode uang di aplikasi: **localizer v4** (cari bbox) → crop → **classifier v16** (tentukan nominal). Dua-duanya jalan on-device, tidak menyentuh server.

Alur mode objek: **YOLOv11n** (deteksi + label) → **Qwen2.5-VL-3B** (caption berbahasa Indonesia, di-grounding pakai label YOLO).

## API key

Semua API key sudah **dikosongkan** dari notebook ini. Isi sendiri sebelum menjalankan:

```python
RF_KEY = ''           # app.roboflow.com → Settings → API Keys → Private API Key
KAGGLE_USERNAME = ''  # kaggle.com → Settings → API → Create New Token → field "username" di kaggle.json
KAGGLE_KEY = ''       # dari kaggle.json yang sama, field "key"
```

Di Kaggle, lebih aman lewat Secrets daripada hardcode:

```python
from kaggle_secrets import UserSecretsClient
RF_KEY = UserSecretsClient().get_secret('RF_API_KEY')
```

**Jangan commit nilai key-nya.** Kalau tidak sengaja ke-commit, langsung revoke: Roboflow → Settings → API Keys, Kaggle → Settings → API → Expire Token.

## Dataset

Path `/kaggle/input/datasets/<username>/...` di notebook menunjuk ke dataset Kaggle penulis. Ganti dengan dataset kamu sendiri, atau attach dataset yang sama lewat Kaggle UI.
