-- Editing was split three ways: your own entries, master entries (admin only),
-- and another trainer's (nobody at all). The gym admin couldn't fix a
-- colleague's exercise, and no trainer could fix a master one.
-- One shared library, one rule: any trainer may edit or remove any exercise.
-- Clients stay read-only.
drop policy if exists "exercise_library: trainer update" on exercise_library;
drop policy if exists "exercise_library: trainer delete" on exercise_library;
drop policy if exists "exercise_library: admin update global" on exercise_library;
drop policy if exists "exercise_library: admin delete global" on exercise_library;

create policy "exercise_library: trainers edit"
on exercise_library for update
to authenticated
using (is_trainer())
with check (is_trainer());

create policy "exercise_library: trainers delete"
on exercise_library for delete
to authenticated
using (is_trainer());
