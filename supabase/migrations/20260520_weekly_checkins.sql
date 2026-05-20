CREATE TABLE IF NOT EXISTS weekly_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  weight_lbs numeric(5,1),
  energy_level smallint CHECK (energy_level BETWEEN 1 AND 5),
  sleep_quality smallint CHECK (sleep_quality BETWEEN 1 AND 5),
  stress_level smallint CHECK (stress_level BETWEEN 1 AND 5),
  workouts_completed smallint,
  nutrition_adherence smallint CHECK (nutrition_adherence BETWEEN 1 AND 5),
  notes text,
  photo_url text,
  trainer_notes text,
  trainer_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, week_start)
);

ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own checkins"
  ON weekly_checkins FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Trainers read and respond to client checkins"
  ON weekly_checkins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trainer'
        AND profiles.id = weekly_checkins.trainer_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'trainer'
        AND profiles.id = weekly_checkins.trainer_id
    )
  );
