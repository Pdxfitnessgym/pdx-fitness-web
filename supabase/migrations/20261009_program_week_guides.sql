-- A program's weekly guide page: the one-pager a client reads before the week
-- starts (phase, focus, what's coming, the day-by-day table, goal/tip/milestone).
-- Workouts already live in `workouts`; this is the narrative around them, which
-- until now only existed in a PDF handed out separately.
create table public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week_number int not null check (week_number >= 1),
  phase text,
  title text,
  focus text,
  glance text,
  -- [{ "day": "Monday", "workout": "Lower Body Strength", "details": "Workout A" }, ...]
  schedule jsonb not null default '[]'::jsonb,
  goal text,
  tip text,
  milestone text,
  unique (program_id, week_number)
);

alter table public.program_weeks enable row level security;

-- Mirrors the policies on `programs`: the owner edits, assigned clients read,
-- gym-shared programs are readable by members, and a coach or the gym admin can
-- read a week for a client they're responsible for.
create policy "program_weeks: owner manage"
on program_weeks for all
to authenticated
using (exists (select 1 from programs p where p.id = program_weeks.program_id and p.trainer_id = auth.uid()))
with check (exists (select 1 from programs p where p.id = program_weeks.program_id and p.trainer_id = auth.uid()));

create policy "program_weeks: client reads assigned"
on program_weeks for select
to authenticated
using (exists (
  select 1 from client_programs cp
  where cp.program_id = program_weeks.program_id
    and cp.client_id = auth.uid()
    and cp.is_active
));

create policy "program_weeks: members read shared"
on program_weeks for select
to authenticated
using (exists (select 1 from programs p where p.id = program_weeks.program_id and p.is_shared));

create policy "program_weeks: trainer reads client program"
on program_weeks for select
to authenticated
using (can_see_program(program_id) or is_gym_admin());
