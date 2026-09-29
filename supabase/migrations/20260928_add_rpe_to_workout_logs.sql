-- How hard the client rated the session, 1 (very easy) to 10 (max effort).
-- Nullable: rating is optional, so a skipped rating stays empty rather than
-- being guessed at.
alter table workout_logs add column if not exists rpe smallint;
alter table workout_logs drop constraint if exists workout_logs_rpe_range;
alter table workout_logs add constraint workout_logs_rpe_range
  check (rpe is null or rpe between 1 and 10);
