-- ═══════════════════════════════════════════════════════════════════════════
-- ELIOR — skema database lengkap
--
-- Satu file, sekali jalan. Tidak ada urutan migrasi yang perlu diingat.
--   psql -d eliordb -f schema.sql
-- Docker menjalankannya otomatis saat container `db` pertama kali dibuat.
--
-- Idempotent: aman diulang, tidak menghapus data yang sudah ada.
-- ID di-generate aplikasi (uuid.New() di Go) untuk users/scan_history/
-- usage_logs; feedback dan reports memakai default database.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Pengguna ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT,                              -- NULL untuk akun Google-only
    google_id     TEXT,
    vision_status TEXT,                              -- 'buta_total' | 'low_vision' | 'tidak_ada'
    last_active   TIMESTAMPTZ,
    open_count    INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_id sebagai PRIMARY KEY: dibutuhkan ON CONFLICT (user_id) di endpoint ban.
CREATE TABLE IF NOT EXISTS user_meta (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_banned  BOOLEAN     NOT NULL DEFAULT false,
    notes      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Riwayat pindaian ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_history (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT        NOT NULL,                 -- 'object' | 'rupiah' | 'baca'
    text       TEXT,
    ocr_text   TEXT,
    confidence DOUBLE PRECISION,                     -- 0..1, divalidasi di handler
    image_url  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Feedback & laporan ─────────────────────────────────────────────────────
-- Survei skala 5 titik + dua item TAM (manfaat, niat_pakai). NULL = tak dijawab.
CREATE TABLE IF NOT EXISTS feedback (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    navigasi   INTEGER,
    kemudahan  INTEGER,
    kualitas   INTEGER,
    akurasi    INTEGER,
    manfaat    INTEGER,
    niat_pakai INTEGER,
    komentar   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Laporan hasil pindaian yang salah (tombol "Laporkan" di drawer hasil).
CREATE TABLE IF NOT EXISTS reports (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT NOT NULL,
    text       TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    image_url  TEXT,
    reason     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Pengaturan aplikasi ────────────────────────────────────────────────────
-- Dibaca GET /config oleh aplikasi mobile. Mode yang tidak ada barisnya
-- dianggap aktif, jadi baris di bawah sebenarnya opsional — ditulis eksplisit
-- supaya terlihat apa saja yang bisa diatur.
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES
    ('scan_daily_limit', '10'),   -- batas pindai mode objek per user per 24 jam
    ('mode_uang',        'true'),
    ('mode_baca',        'true'),
    ('mode_objek',       'true'),
    ('mode_qr',          'true')
ON CONFLICT (key) DO NOTHING;

-- ── Index ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_scan_history_user    ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created ON scan_history(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user      ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_category  ON usage_logs(category);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created   ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_created      ON reports(created_at);
