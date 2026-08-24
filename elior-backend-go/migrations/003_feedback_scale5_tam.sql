-- Migration 003 — feedback scale 3→5, tambah kolom TAM (manfaat, niat_pakai)
-- Idempotent: aman dijalankan berulang.

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS manfaat    INTEGER;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS niat_pakai INTEGER;
