-- Create app_visits table to track website and mobile app visits
CREATE TABLE IF NOT EXISTS app_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  platform TEXT NOT NULL DEFAULT 'web', -- 'web' or 'app'
  session_id TEXT NOT NULL,
  user_agent TEXT
);

-- Index for fast date-based queries
CREATE INDEX IF NOT EXISTS idx_app_visits_created_at ON app_visits(created_at);
CREATE INDEX IF NOT EXISTS idx_app_visits_platform ON app_visits(platform);
CREATE INDEX IF NOT EXISTS idx_app_visits_session ON app_visits(session_id);

-- Allow anyone (even unauthenticated) to INSERT visits
ALTER TABLE app_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visits"
  ON app_visits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read visit counts"
  ON app_visits FOR SELECT
  USING (true);
