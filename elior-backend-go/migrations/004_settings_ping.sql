-- Global app settings (rate limit dll configurable dari panel)
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO app_settings (key, value) VALUES ('scan_daily_limit', '10')
ON CONFLICT (key) DO NOTHING;

-- User activity tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
