CREATE TABLE IF NOT EXISTS scheduled_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fire_at timestamptz NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE scheduled_push ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own scheduled_push" ON scheduled_push FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS scheduled_push_fire_at_idx ON scheduled_push (fire_at) WHERE cancelled = false;
