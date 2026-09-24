-- Clients need the library row (video / YouTube / instructions) for any exercise
-- they can already see in an assigned workout. The subquery runs under the
-- caller's exercises RLS, so this only exposes rows linked to visible exercises.
create policy "exercise_library: read via visible exercise"
  on public.exercise_library for select
  using (exists (
    select 1 from public.exercises e where e.exercise_library_id = exercise_library.id
  ));
