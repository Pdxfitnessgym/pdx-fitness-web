-- completed_at should be nullable; it's set when the workout is finished,
-- not when it's created (which caused all client workout log inserts to fail)
ALTER TABLE workout_logs ALTER COLUMN completed_at DROP NOT NULL;
