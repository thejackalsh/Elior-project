-- Migration 002 — onboarding (vision_status), feedback survei, reports
-- Idempotent: aman dijalankan berulang.
--
-- CATATAN: tabel `feedback` LAMA punya skema beda (category/message/rating).
-- Kode baru pakai survei 4-skor (navigasi/kemudahan/kualitas/akurasi/komentar).
-- Strategi: rename feedback lama -> feedback_legacy (data tetap aman), buat feedback baru.

-- 1. Status penglihatan user (onboarding) — 'buta_total' | 'low_vision' | 'tidak_ada'
ALTER TABLE users ADD COLUMN IF NOT EXISTS vision_status TEXT;

-- 2. Foto memori (sudah ada; aman diulang)
ALTER TABLE scan_history ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Log pemakaian fitur (tabel sudah ada — pastikan index)
CREATE INDEX IF NOT EXISTS idx_usage_logs_category ON usage_logs(category);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created  ON usage_logs(created_at);

-- 4. Rename feedback lama HANYA jika masih skema lama (punya 'message', belum 'navigasi')
DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='feedback' AND column_name='message'
     ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='feedback' AND column_name='navigasi'
     )
  THEN
    ALTER TABLE feedback RENAME TO feedback_legacy;
  END IF;
END $$;

-- 5. Feedback survei baru (skala 3-titik: 1=Sulit, 2=Cukup, 3=Mudah; NULL=tak dijawab)
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  navigasi   INT,
  kemudahan  INT,
  kualitas   INT,
  akurasi    INT,
  komentar   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Laporan hasil scan salah (tombol "Laporkan" di drawer hasil) — tabel baru
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
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
