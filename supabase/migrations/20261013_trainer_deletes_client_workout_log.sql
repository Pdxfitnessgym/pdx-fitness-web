-- A client who opens a workout and walks away leaves an in-progress log behind.
-- It sits on their dashboard as "In Progress" forever and the trainer has no
-- way to clear it. Let a coach delete their own client's logs (the gym admin
-- too), which cascades to the set_logs underneath.
--
-- Deliberately not limited to unfinished sessions: a trainer also needs to
-- scrap a session logged against the wrong client or the wrong workout, and
-- the UI confirms what a completed one would take with it.
drop policy if exists "workout_logs: trainer deletes client log" on workout_logs;

create policy "workout_logs: trainer deletes client log"
on workout_logs for delete
to authenticated
using (is_my_client(client_id) or is_gym_admin());
