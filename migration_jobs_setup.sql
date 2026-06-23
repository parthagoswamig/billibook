-- ============================================================
-- SQL Schema Update for Migration Jobs (Phase 2)
-- Supabase Dashboard > SQL Editor > New Query > paste > Run
-- ============================================================

CREATE TABLE IF NOT EXISTS migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_software text NOT NULL,
  import_type text NOT NULL,
  file_name text NOT NULL,
  total_records integer DEFAULT 0,
  imported_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  status text DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'rolled_back')),
  imported_ids jsonb DEFAULT '[]'::jsonb, -- Stores {"customers": ["uuid", ...], "products": ["uuid", ...], "invoices": ["uuid", ...]}
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to make script re-runnable
DROP POLICY IF EXISTS "own migration jobs select" ON migration_jobs;
DROP POLICY IF EXISTS "own migration jobs insert" ON migration_jobs;
DROP POLICY IF EXISTS "own migration jobs update" ON migration_jobs;
DROP POLICY IF EXISTS "own migration jobs delete" ON migration_jobs;

-- Create Policies
CREATE POLICY "own migration jobs select" ON migration_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own migration jobs insert" ON migration_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own migration jobs update" ON migration_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own migration jobs delete" ON migration_jobs FOR DELETE USING (auth.uid() = user_id);
