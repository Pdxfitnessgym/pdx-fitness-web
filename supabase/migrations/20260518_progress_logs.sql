CREATE TABLE IF NOT EXISTS progress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at date NOT NULL DEFAULT CURRENT_DATE,
  weight_lbs numeric(5,1),
  body_fat_pct numeric(4,1),
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own logs"
  ON progress_logs FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Trainers read client logs"
  ON progress_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trainer'
        AND EXISTS (
          SELECT 1 FROM profiles p2
          WHERE p2.id = progress_logs.client_id
            AND p2.trainer_id = auth.uid()
        )
    )
  );

-- Storage bucket for progress photos (run manually in Supabase dashboard if bucket doesn't exist)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', true)
-- ON CONFLICT DO NOTHING;
