-- Workouts were readable only by the trainer who owns the program, so a coach
-- (or the gym admin) looking at a client on someone else's program saw blank
-- workout names in their history and in the dashboard activity feed.
create or replace function public.can_see_program(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id is not null and exists (
    select 1 from public.client_programs cp
    where cp.program_id = p_id
      and (public.is_my_client(cp.client_id) or public.is_gym_admin())
  );
$$;

create policy "workouts: trainer sees client program"
on workouts for select
to authenticated
using (can_see_program(program_id));

create policy "exercises: trainer sees client program"
on exercises for select
to authenticated
using (exists (
  select 1 from workouts w
  where w.id = exercises.workout_id and can_see_program(w.program_id)
));
