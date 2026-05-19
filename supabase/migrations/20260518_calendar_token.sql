ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendar_token uuid DEFAULT gen_random_uuid();
UPDATE profiles SET calendar_token = gen_random_uuid() WHERE calendar_token IS NULL;
