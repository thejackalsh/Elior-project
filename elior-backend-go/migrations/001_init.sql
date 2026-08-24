-- Migration 001 — skema dasar ELIOR
-- Idempotent: aman dijalankan berulang.
--
-- Kolom yang ditambahkan migrasi berikutnya SENGAJA tidak dibuat di sini,
-- biar urutan migrasi tetap jujur:
--   002 → users.vision_status, scan_history.image_url, tabel feedback & reports
--   004 → tabel app_settings
--
-- ID di-generate aplikasi (uuid.New() di Go), bukan default database.

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY,
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT,                            -- NULL untuk akun Google-only
    google_id     TEXT,
    last_active   TIMESTAMPTZ,
    open_count    INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- user_id PRIMARY KEY: dibutuhkan ON CONFLICT (user_id) di endpoint ban admin.
CREATE TABLE IF NOT EXISTS user_meta (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_banned  BOOLEAN     NOT NULL DEFAULT false,
    notes      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_history (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT        NOT NULL,               -- 'object' | 'rupiah' | 'baca'
    text       TEXT,
    ocr_text   TEXT,
    confidence DOUBLE PRECISION,                   -- 0..1, divalidasi di handler
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk query yang sering dipakai: rate limit harian & daftar riwayat.
CREATE INDEX IF NOT EXISTS idx_scan_history_user    ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created ON scan_history(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user      ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
