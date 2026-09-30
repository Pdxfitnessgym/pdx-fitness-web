-- "From Your Gym" on the client's Start a Workout page has always been empty:
-- clients could only read a standalone workout that was already assigned to
-- them, so the shared on-demand shelf was unreachable by definition.
-- Non-private standalone workouts are the gym's public shelf — any signed-in
-- member may browse them and their exercises. Private one-offs are unaffected.
create policy "workouts: member reads shared on-demand"
on workouts for select
to authenticated
using (is_standalone and not is_private);

create policy "exercises: member reads shared on-demand"
on exercises for select
to authenticated
using (exists (
  select 1 from workouts w
  where w.id = exercises.workout_id and w.is_standalone and not w.is_private
));
