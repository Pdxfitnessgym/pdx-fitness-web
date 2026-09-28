-- A trainer could only see assignment rows they created themselves
-- (assigned_by = auth.uid()), so a workout a client built and self-assigned
-- was invisible to their coach — it never appeared on the client's page or in
-- the Log Workout picker.
create policy "assignments: trainer sees own clients"
on client_workout_assignments for all
to authenticated
using (is_my_client(client_id) or is_gym_admin())
with check (is_my_client(client_id) or is_gym_admin());

-- Standalone workouts were readable only when trainer_id matched exactly, so
-- gym admins couldn't see one-offs belonging to another trainer's client.
create or replace function public.can_see_client_workout(w_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_workout_assignments cwa
    where cwa.workout_id = w_id
      and (public.is_my_client(cwa.client_id) or public.is_gym_admin())
  );
$$;

create policy "workouts: trainer sees client standalone"
on workouts for select
to authenticated
using (is_standalone and can_see_client_workout(id));

create policy "exercises: trainer sees client standalone"
on exercises for select
to authenticated
using (can_see_client_workout(workout_id));
