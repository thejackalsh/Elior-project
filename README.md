<div align="center">

<img src="elior-mobile/assets/app-icon.png" width="130" alt="ELIOR" />

# ELIOR

**Asisten penglihatan berbasis AI untuk tunanetra di Indonesia**

Kamera jadi mata. Deteksi objek, baca teks, kenali nominal rupiah — semua dinarasikan dalam Bahasa Indonesia.

<br/>

![Status](https://img.shields.io/badge/status-aktif-E0B374?style=for-the-badge&labelColor=0D0D0D)
![Platform](https://img.shields.io/badge/platform-Android-E0B374?style=for-the-badge&labelColor=0D0D0D)
![Lisensi](https://img.shields.io/badge/lisensi-MIT-E0B374?style=for-the-badge&labelColor=0D0D0D)

![React Native](https://img.shields.io/badge/React_Native-Expo-E0B374?style=flat-square&labelColor=0D0D0D)
![Go](https://img.shields.io/badge/Go-Gin-E0B374?style=flat-square&labelColor=0D0D0D)
![Next.js](https://img.shields.io/badge/Next.js-15-E0B374?style=flat-square&labelColor=0D0D0D)
![PyTorch](https://img.shields.io/badge/PyTorch-YOLOv11-E0B374?style=flat-square&labelColor=0D0D0D)
![TFLite](https://img.shields.io/badge/TFLite-MobileNetV4-E0B374?style=flat-square&labelColor=0D0D0D)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-E0B374?style=flat-square&labelColor=0D0D0D)

<br/>

**Mau langsung jalan tanpa install apa-apa?** → **[README-DOCKER.md](README-DOCKER.md)**

</div>

---

## Tentang

ELIOR membantu pengguna tunanetra memahami lingkungan sekitar lewat kamera ponsel. Empat mode utama, semuanya bersuara Bahasa Indonesia:

| Mode | Fungsi | Dijalankan di |
|:--|:--|:--|
| **Objek** | Deteksi objek + narasi deskriptif | Server (YOLOv11 → Qwen2.5-VL) |
| **Uang** | Kenali nominal rupiah (11 kelas, kertas + koin) | **On-device** (MobileNetV4 TFLite) |
| **Baca** | OCR teks dari kamera | **On-device** (ML Kit) |
| **Memori** | Simpan & putar ulang hasil pindaian | Server (PostgreSQL) |

Mode uang dan baca jalan penuh **tanpa internet** — pengguna tidak selalu punya koneksi stabil.

---

## Arsitektur

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#E0B374','primaryTextColor':'#0D0D0D','primaryBorderColor':'#8C6A3F','lineColor':'#E0B374','secondaryColor':'#2A2A2A','secondaryTextColor':'#E0B374','tertiaryColor':'#1A1A1A','tertiaryTextColor':'#E0B374','fontFamily':'ui-sans-serif, system-ui, sans-serif'}}}%%
flowchart TD
    M["elior-mobile<br/>React Native (Expo)"]

    M -->|"mode objek"| P["elior-proxy<br/>FastAPI :7861"]
    P -->|"forward"| I["elior-inference<br/>Gradio :7860"]
    I --> Y["YOLOv11n<br/>deteksi objek"]
    Y --> Q["Qwen2.5-VL-3B<br/>caption Bahasa Indonesia"]

    M -->|"auth · riwayat · config"| B["elior-backend-go<br/>Gin :8080"]
    B --> D[("PostgreSQL")]

    W["elior-web<br/>landing page :3000"]

    M -.->|"on-device, tanpa server"| R["MobileNetV4 TFLite<br/>localizer → classifier rupiah"]

    style M fill:#E0B374,stroke:#8C6A3F,color:#0D0D0D
    style R fill:#E0B374,stroke:#8C6A3F,color:#0D0D0D
    style D fill:#2A2A2A,stroke:#E0B374,color:#E0B374
```

**Kenapa ada proxy?** Aplikasi mobile tidak boleh memegang token HuggingFace. Proxy yang menyimpan token dan meneruskan permintaan; mobile hanya bicara ke proxy. Proxy juga menerjemahkan REST sederhana (`POST /analyze`) menjadi protokol Gradio yang dua langkah.

---

## Struktur Repo

| Folder | Isi | Stack |
|:--|:--|:--|
| [`elior-mobile/`](elior-mobile) | Aplikasi Android | React Native, Expo, Vision Camera, fast-tflite |
| [`elior-backend-go/`](elior-backend-go) | REST API — auth, riwayat, config | Go 1.22, Gin, pgx |
| [`elior-web/`](elior-web) | Landing page | Next.js 15, Tailwind |
| [`elior-inference/`](elior-inference) | Server inference objek | Gradio, YOLOv11, Qwen2.5-VL |
| [`elior-proxy/`](elior-proxy) | Proxy penyembunyi token | FastAPI, httpx |
| [`notebooks/`](notebooks) | Notebook training 8 model | PyTorch, Ultralytics, timm |

---

## Menjalankan Secara Lokal

> Dokumen ini untuk menjalankan tiap komponen **langsung di mesin** (tanpa Docker).
> Untuk jalan cepat pakai container, lihat **[README-DOCKER.md](README-DOCKER.md)**.

### Prasyarat

| Butuh | Versi | Untuk |
|:--|:--|:--|
| Node.js | 20+ | mobile, web |
| Go | 1.22 | backend |
| Python | 3.10+ | inference, proxy |
| PostgreSQL | 14+ | backend |
| Android Studio / perangkat Android | — | mobile |
| GPU NVIDIA ≥8GB | opsional | inference (tanpa GPU tetap jalan, tapi lambat) |

Tidak harus semua dijalankan sekaligus. Backend + mobile sudah cukup untuk mencoba mode uang dan baca.

---

### 1. Backend (Go)

```sh
cd elior-backend-go
cp .env.example .env
go mod download
go run .
```

Siapkan database dulu:

```sh
createdb eliordb
psql -d eliordb -f migrations/001_init.sql
psql -d eliordb -f migrations/002_onboarding_feedback.sql
psql -d eliordb -f migrations/003_feedback_scale5_tam.sql
psql -d eliordb -f migrations/004_settings_ping.sql
```

Isi `.env`:

```sh
DATABASE_URL=postgresql://postgres:password@localhost:5432/eliordb
DATABASE_SSL=false
JWT_SECRET=<minimal 32 karakter — openssl rand -hex 32>
ADMIN_EMAIL=kamu@example.com
UPLOAD_DIR=./uploads
PORT=8080
BIND_ADDR=127.0.0.1
ADMIN_BIND=
```

Cek jalan: `curl http://localhost:8080/` → `{"status":"ok"}`

> `ADMIN_BIND` kosong berarti server admin tidak dijalankan. Panel admin tidak disertakan di repo ini, tapi endpoint `/admin/*` tetap ada — isi `127.0.0.1:8081` kalau mau mengujinya.

---

### 2. Mobile (React Native / Expo)

```sh
cd elior-mobile
npm install
cp .env.example .env
npx expo run:android
```

> Pakai `expo run:android`, **bukan** Expo Go. Mode uang butuh native module (`react-native-vision-camera`, `react-native-fast-tflite`) yang tidak ada di Expo Go.

Emulator Android tidak mengenal `localhost` — itu merujuk ke emulator sendiri. Pakai `10.0.2.2`:

```sh
EXPO_PUBLIC_AUTH_URL=http://10.0.2.2:8080
EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:7861
```

HP fisik: ganti dengan IP LAN komputermu (`http://192.168.x.x:8080`).

Provider default (`native` STT, `rn-tts` TTS, `mlkit` OCR) jalan tanpa API key apa pun.

<details>
<summary><b>Google Sign-In (opsional)</b></summary>

Login email/password jalan tanpa setup tambahan. Kalau mau Google Sign-In, kamu perlu project Firebase sendiri:

1. Buka [console.firebase.google.com](https://console.firebase.google.com), buat project baru
2. **Add app → Android**, package name wajib `com.elior.mobile`
3. Daftarkan SHA-1 debug keystore-mu:
   ```sh
   keytool -list -v -keystore ~/.android/debug.keystore \
           -alias androiddebugkey -storepass android -keypass android
   ```
4. Download `google-services.json`, taruh di `elior-mobile/android/app/`
5. Aktifkan **Authentication → Sign-in method → Google**
6. Salin OAuth client ID (Web + Android) ke `.env`:
   ```sh
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
   ```

`google-services.json` sengaja tidak disertakan di repo — itu kredensial project Firebase, tiap orang harus punya sendiri.

</details>

---

### 3. Web (Next.js)

```sh
cd elior-web
npm install
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`.

---

### 4. Inference (Gradio + YOLO + Qwen)

```sh
cd elior-inference
pip install -r requirements.txt
ELIOR_ZEROGPU=0 python app.py
```

Jalan di `http://localhost:7860`.

Saat pertama dijalankan, model ter-download otomatis:

- **YOLOv11n** dari [`arkhangelos/elior-yolo`](https://huggingface.co/arkhangelos/elior-yolo) (~5MB)
- **Qwen2.5-VL-3B** dari HuggingFace Hub (~7GB)

> `ELIOR_ZEROGPU=0` mematikan jalur HuggingFace ZeroGPU — modul `spaces` hanya ada di HF Spaces.
>
> Tanpa GPU tetap jalan (otomatis turun ke CPU + fp32), tapi **~30-60 detik per gambar**. Dengan GPU ≥8GB, sekitar 2-4 detik.

---

### 5. Proxy (FastAPI)

```sh
cd elior-proxy
pip install -r requirements.txt
PORT=7861 GRADIO_SPACE_URL=http://localhost:7860 python app.py
```

Jalan di `http://localhost:7861`. `PORT=7861` penting — default-nya `7860`, sama dengan inference.

Uji:

```sh
curl -X POST http://localhost:7861/analyze \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64-gambar>","mode":"object"}'
```

Balasan:

```json
{ "text": "Terdeteksi laptop. Laptop hitam di atas meja kayu.",
  "category": "object", "confidence": 0.91, "bbox": [0.12, 0.30, 0.78, 0.85] }
```

`HF_TOKEN` hanya dibutuhkan kalau `GRADIO_SPACE_URL` diarahkan ke HuggingFace Space. Upstream lokal tidak perlu token.

---

## Model

| Model | Tugas | Diambil dari |
|:--|:--|:--|
| MobileNetV4 localizer v4 | Bounding box uang | `elior-mobile/assets/models/localizer_v4.tflite` (di repo) |
| MobileNetV4 classifier v16 | Nominal rupiah, 11 kelas | `elior-mobile/assets/models/classifier_v16.tflite` (di repo) |
| YOLOv11n | Deteksi objek umum (COCO) | [`arkhangelos/elior-yolo`](https://huggingface.co/arkhangelos/elior-yolo) |
| Qwen2.5-VL-3B | Caption Bahasa Indonesia | HuggingFace Hub |
| BLIP-2 (fine-tuned) | Caption — pendekatan sebelumnya | [`arkhangelos/blip2-elior-fp16`](https://huggingface.co/arkhangelos/blip2-elior-fp16) |

Dua model TFLite ikut di repo karena APK tidak bisa dibuild tanpanya (~35MB). Bobot besar lainnya (`.pt`, `.safetensors`) diambil dari HuggingFace saat runtime — tidak disimpan di git.

Notebook training ada di [`notebooks/`](notebooks). **API key di dalamnya sudah dikosongkan** — isi sendiri sebelum menjalankan.

---

## Alur Dua Tahap Mode Uang

Deteksi rupiah tidak memakai satu model, tapi dua yang berurutan — sepenuhnya on-device:

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#E0B374','primaryTextColor':'#0D0D0D','primaryBorderColor':'#8C6A3F','lineColor':'#E0B374','secondaryColor':'#2A2A2A','tertiaryColor':'#1A1A1A','fontFamily':'ui-sans-serif, system-ui, sans-serif'}}}%%
flowchart LR
    F["Frame kamera"] --> L["Localizer v4<br/>single-class bbox"]
    L --> C["Crop"]
    C --> K["Classifier v16<br/>11 kelas nominal"]
    K --> V["Majority vote<br/>antar frame"]
    V --> S["Suara:<br/>'Lima puluh ribu rupiah'"]

    style L fill:#E0B374,stroke:#8C6A3F,color:#0D0D0D
    style K fill:#E0B374,stroke:#8C6A3F,color:#0D0D0D
    style S fill:#E0B374,stroke:#8C6A3F,color:#0D0D0D
```

Berjalan lewat frame processor worklet (`useFrameProcessor` + `runAtTargetFps(10)`), bukan polling screenshot.

---

<div align="center">

**Dibangun untuk yang tidak bisa melihat, tapi tetap ingin tahu.**

</div>
