<div align="center">

<img src="elior-mobile/assets/app-icon.png" width="110" alt="ELIOR" />

# ELIOR — Panduan Docker

**Menjalankan seluruh sistem dengan container**

![Docker](https://img.shields.io/badge/Docker-Compose-E0B374?style=for-the-badge&labelColor=0D0D0D)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-E0B374?style=for-the-badge&labelColor=0D0D0D)
![GPU](https://img.shields.io/badge/GPU-opsional-E0B374?style=for-the-badge&labelColor=0D0D0D)

</div>

---

## Ringkasan

Empat dari lima komponen jalan di container. Yang tidak: **aplikasi mobile** — React Native butuh emulator/perangkat Android, tidak bisa headless di container. Mobile dijalankan di host dan menunjuk ke container lewat IP.

| Service | Port host | Profil | Isi |
|:--|:--|:--|:--|
| `db` | 5432 | default | PostgreSQL 16, skema ter-apply otomatis |
| `backend` | 8080 | default | API Go — auth, riwayat, config |
| `web` | 3000 | default | Landing page Next.js |
| `proxy` | 7861 | default | Proxy FastAPI → inference |
| `inference` | 7860 | `ai` | YOLOv11 + Qwen2.5-VL |

`inference` sengaja dipisah ke profil `ai` karena berat — Qwen2.5-VL-3B sekitar **7GB** ter-download saat pertama jalan.

---

## Prasyarat

| Butuh | Keterangan |
|:--|:--|
| Docker Desktop / Docker Engine | dengan Compose v2 (`docker compose`, bukan `docker-compose`) |
| Disk kosong | ~5GB tanpa AI, **~20GB** dengan AI |
| RAM | 4GB tanpa AI, 16GB disarankan dengan AI |
| GPU NVIDIA ≥8GB | **opsional** — tanpa GPU tetap jalan, hanya lambat |

Cek Docker siap:

```sh
docker compose version
```

---

## Langkah 1 — Konfigurasi

```sh
git clone https://github.com/thejackalsh/Elior-project.git
cd Elior-project
cp .env.example .env
```

Buka `.env`, isi minimal dua hal:

```sh
POSTGRES_PASSWORD=<bebas, tapi jangan kosong>
JWT_SECRET=<minimal 32 karakter>
```

Generate `JWT_SECRET`:

```sh
openssl rand -hex 32
```

> Backend **menolak start** kalau `JWT_SECRET` kurang dari 32 karakter. Itu disengaja — token yang ditandatangani secret pendek gampang dipalsukan.

---

## Langkah 2 — Jalankan tanpa AI

Paling ringan. Backend + database + landing page:

```sh
docker compose up -d db backend web
```

Tunggu sekitar 30 detik (build pertama lebih lama), lalu cek:

```sh
curl http://localhost:8080/          # {"status":"ok","service":"ELIOR Auth API"}
```

Buka `http://localhost:3000` untuk landing page.

### Coba API-nya

```sh
# Daftar akun
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Tester","email":"tester@example.com","password":"rahasia123"}'

# Simpan token dari balasan di atas
TOKEN=<isi access_token>

# Ambil profil
curl http://localhost:8080/users/me -H "Authorization: Bearer $TOKEN"
```

Skema database ter-apply otomatis saat container `db` pertama dibuat — file di `elior-backend-go/migrations/` (001 → 004) dijalankan berurutan.

> **Skema tidak ter-apply / ingin mengulang dari nol?**
> Skrip migrasi hanya jalan saat volume database masih kosong.
> ```sh
> docker compose down -v      # -v menghapus volume, DATA HILANG
> docker compose up -d db backend
> ```

---

## Langkah 3 — Jalankan dengan AI

Ada dua cara. **Pilih salah satu.**

### Cara A — Inference lokal (default, tidak butuh akun apa pun)

```sh
docker compose --profile ai up -d
```

Container `inference` akan mengunduh model saat start pertama:

- YOLOv11n dari [`arkhangelos/elior-yolo`](https://huggingface.co/arkhangelos/elior-yolo) — ~5MB
- Qwen2.5-VL-3B dari HuggingFace Hub — ~7GB

Pantau prosesnya:

```sh
docker compose logs -f inference
```

Siap ketika muncul `Running on local URL: http://0.0.0.0:7860`. Unduhan disimpan di volume `hfcache`, jadi container yang dibuat ulang tidak mengunduh lagi.

**Mengaktifkan GPU NVIDIA:**

1. Pasang [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
2. Buka `docker-compose.yml`, hapus komentar blok `deploy.resources` di service `inference`
3. `docker compose --profile ai up -d --force-recreate inference`

Verifikasi GPU kebaca:

```sh
docker compose exec inference python -c "import torch; print(torch.cuda.is_available())"
```

| | Waktu per gambar |
|:--|:--|
| GPU ≥8GB | 2–4 detik |
| CPU saja | 30–60 detik |

CPU tetap berfungsi penuh — kode otomatis turun ke fp32 saat CUDA tidak tersedia. Hanya lambat, bukan rusak.

---

### Cara B — Inference remote di HuggingFace Space **milikmu sendiri**

Kalau mesinmu tidak kuat, deploy `elior-inference/` sebagai Space-mu sendiri:

1. Buat Space baru di [huggingface.co/new-space](https://huggingface.co/new-space) — SDK **Gradio**, hardware **ZeroGPU** (butuh akun PRO) atau GPU berbayar
2. Push isi folder `elior-inference/` ke Space itu:
   ```sh
   cd elior-inference
   git init && git remote add space https://huggingface.co/spaces/<user>/<nama-space>
   git add -A && git commit -m "deploy elior inference"
   git push space main
   ```
3. Ambil token di [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (akses `read` cukup)
4. Isi di `.env`:
   ```sh
   GRADIO_SPACE_URL=https://<user>-<nama-space>.hf.space
   HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
   ```
5. Jalankan tanpa profil `ai` — proxy langsung menembak Space-mu:
   ```sh
   docker compose up -d --force-recreate proxy
   ```

> Space milik pembuat aplikasi **tidak dipakai dan tidak dibagikan**. Kalau ingin inference remote, deploy Space-mu sendiri. Dua model di HuggingFace yang disebut di dokumen ini adalah **repo model publik** — bebas diunduh, terpisah dari Space siapa pun.

---

## Langkah 4 — Uji jalur AI

```sh
curl http://localhost:7861/
```

```json
{ "status": "ok", "service": "ELIOR Inference Proxy",
  "upstream": "http://inference:7860", "authed": false }
```

`upstream` menunjukkan ke mana proxy menembak — berguna untuk memastikan konfigurasimu benar. `authed: false` normal untuk inference lokal (token hanya perlu untuk HuggingFace).

Kirim gambar:

```sh
# Linux / macOS
BASE64=$(base64 -w0 foto.jpg)

# Windows PowerShell
# $BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("foto.jpg"))

curl -X POST http://localhost:7861/analyze \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$BASE64\",\"mode\":\"object\"}"
```

Balasan:

```json
{ "text": "Terdeteksi laptop. Laptop hitam di atas meja kayu, layarnya menyala.",
  "category": "object", "confidence": 0.91, "bbox": [0.12, 0.30, 0.78, 0.85] }
```

`bbox` sudah dinormalisasi 0–1 terhadap ukuran gambar asli.

---

## Langkah 5 — Aplikasi mobile

Mobile **tidak** jalan di Docker. Dijalankan di host:

```sh
cd elior-mobile
npm install
cp .env.example .env
npx expo run:android
```

Isi `.env` menunjuk ke container. Emulator Android tidak mengenal `localhost` — itu merujuk ke emulator sendiri:

```sh
EXPO_PUBLIC_AUTH_URL=http://10.0.2.2:8080
EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:7861
```

HP fisik lewat USB/WiFi: ganti `10.0.2.2` dengan IP LAN komputermu (`ipconfig` / `ifconfig`), mis. `http://192.168.1.10:8080`. Pastikan firewall mengizinkan port 8080 dan 7861.

> Wajib `expo run:android`, **bukan** Expo Go. Mode uang memakai native module (`react-native-vision-camera`, `react-native-fast-tflite`) yang tidak tersedia di Expo Go.

Login email/password langsung bisa. Google Sign-In butuh project Firebase sendiri — lihat [README.md](README.md#2-mobile-react-native--expo).

### Mode uang tidak menyentuh server

Deteksi rupiah sepenuhnya on-device: `localizer_v4.tflite` mencari kotak uang, hasilnya di-crop, lalu `classifier_v16.tflite` menentukan nominal dari 11 kelas. Dua file itu ada di `elior-mobile/assets/models/`, ikut di repo. Jadi mode uang bisa diuji **tanpa backend maupun inference jalan**.

---

## Perintah Harian

```sh
docker compose ps                        # status semua service
docker compose logs -f backend           # ikuti log satu service
docker compose restart proxy             # restart satu service
docker compose down                      # hentikan (data tetap ada)
docker compose down -v                   # hentikan + HAPUS database & cache model
docker compose build --no-cache backend  # build ulang dari nol
```

---

## Troubleshooting

<details>
<summary><b>Port sudah dipakai</b> — <code>bind: address already in use</code></summary>

Cari pemakainya:

```sh
# Linux/macOS
lsof -i :8080
# Windows
netstat -ano | findstr :8080
```

Atau ubah port host di `docker-compose.yml` (`"8090:8080"` — kiri host, kanan container).
</details>

<details>
<summary><b>Backend mati terus / restart loop</b></summary>

```sh
docker compose logs backend
```

Penyebab tersering:

| Pesan | Sebab |
|:--|:--|
| `JWT_SECRET harus diset dan minimal 32 karakter` | `.env` belum diisi |
| `UPLOAD_DIR harus diset` | variabel hilang dari compose |
| `db connect: ...` | container `db` belum sehat — tunggu, atau `docker compose logs db` |
</details>

<details>
<summary><b>Tabel tidak ada</b> — <code>relation "users" does not exist</code></summary>

Skrip migrasi hanya jalan saat volume database masih kosong. Kalau volume sudah pernah dibuat sebelum migrasi lengkap:

```sh
docker compose down -v
docker compose up -d db backend
```

`-v` menghapus data. Untuk apply manual tanpa menghapus:

```sh
docker compose exec -T db psql -U elior -d eliordb < elior-backend-go/migrations/001_init.sql
```
</details>

<details>
<summary><b>Inference OOM / container terbunuh</b></summary>

Qwen2.5-VL-3B butuh ~7GB RAM (CPU) atau ~8GB VRAM (GPU).

- Docker Desktop: naikkan memory limit di **Settings → Resources** ke minimal 12GB
- Atau pakai **Cara B** (Space sendiri) supaya beban pindah ke server HuggingFace
</details>

<details>
<summary><b>Inference sangat lambat</b></summary>

Normal tanpa GPU — 30–60 detik per gambar. Cek CUDA kebaca:

```sh
docker compose exec inference python -c "import torch; print(torch.cuda.is_available())"
```

`False` padahal punya GPU NVIDIA? Berarti blok `deploy.resources` di `docker-compose.yml` masih dikomentari, atau nvidia-container-toolkit belum terpasang.
</details>

<details>
<summary><b>Proxy balas 500 "Server belum dikonfigurasi (token)"</b></summary>

`GRADIO_SPACE_URL` menunjuk ke `*.hf.space` tapi `HF_TOKEN` kosong. Isi token di `.env`, atau kembalikan ke inference lokal:

```sh
GRADIO_SPACE_URL=http://inference:7860
```

lalu `docker compose up -d --force-recreate proxy`.
</details>

<details>
<summary><b>Proxy balas 502 "Gagal hubungi server inference"</b></summary>

Container `inference` belum jalan. Profil `ai` tidak ikut `docker compose up` biasa:

```sh
docker compose --profile ai up -d inference
docker compose logs -f inference
```
</details>

<details>
<summary><b>Mobile tidak bisa konek ke backend</b></summary>

| Situasi | Alamat yang benar |
|:--|:--|
| Emulator Android | `http://10.0.2.2:8080` |
| HP fisik | `http://<IP-LAN-komputer>:8080` |
| `localhost` | ❌ selalu salah — merujuk ke perangkat itu sendiri |

Uji dari perangkat: buka `http://10.0.2.2:8080/` di browser HP/emulator. Harus muncul `{"status":"ok"}`.

Setelah mengubah `.env`, restart Metro bundler — `EXPO_PUBLIC_*` dibaca saat bundling, bukan runtime.
</details>

---

## Catatan Keamanan

Repo ini sengaja **tidak** memuat kredensial apa pun:

| Tidak ada di repo | Kamu harus menyediakan sendiri |
|:--|:--|
| `.env` | salin dari `.env.example` |
| `google-services.json` | buat project Firebase sendiri (opsional) |
| `eas.json` | hanya perlu kalau memakai EAS Build |
| Token HuggingFace | hanya perlu untuk inference remote |
| Bobot model besar | terunduh otomatis dari HuggingFace |

`.env` sudah masuk `.gitignore` — jangan pernah di-commit.

Konfigurasi bawaan ditujukan untuk **pengujian lokal**, bukan produksi: CORS terbuka (`*`), `DATABASE_SSL=false`, database ter-ekspos di port 5432.

---

<div align="center">

Ada masalah yang tidak tercakup di sini? Sertakan output `docker compose logs` saat melapor.

</div>
