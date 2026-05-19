CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('weight', 'body_fat', 'strength', 'custom')),
  title text NOT NULL,
  start_value numeric,
  target_value numeric,
  exercise_name text,
  target_date date,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients manage own goals"
  ON goals FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Trainers read client goals"
  ON goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles tr
      JOIN profiles cl ON cl.trainer_id = tr.id
      WHERE tr.id = auth.uid()
        AND tr.role = 'trainer'
        AND cl.id = goals.client_id
    )
  );
