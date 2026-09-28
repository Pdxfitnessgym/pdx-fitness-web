-- The exercise library is now gym-wide: anyone signed in can see and use every
-- exercise, whoever added it. Previously a trainer saw only master entries plus
-- their own, so Tarah's 17 and Tip's 13 were invisible to each other.
--
-- Editing deliberately stays with whoever created it (and the admin for master
-- entries), so trainers can't overwrite each other's work.
drop policy if exists "exercise_library: read" on exercise_library;
drop policy if exists "exercise_library: read system" on exercise_library;
drop policy if exists "exercise_library: read via visible exercise" on exercise_library;

create policy "exercise_library: everyone reads"
on exercise_library for select
to authenticated
using (true);
