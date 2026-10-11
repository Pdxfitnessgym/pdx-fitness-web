-- Merge duplicate exercise_library rows onto the one that now has a demo video.
-- Run in Supabase dashboard -> SQL Editor. Check the two SELECTs before committing.
--
--   Single-Arm Dumbbell Row  -> Single arm dumbbell row   (has video, 7 workout uses)
--   Seated Cable Row         -> Cable Seated Row          (has video, 6 workout uses)
--   Machine Row              -> Cable Seated Row          (unused, 0 sets logged)
--
-- set_logs point at exercises.id, not at the library row, so every logged set,
-- weight and PR survives the repoint. The FK is ON DELETE SET NULL, so the only
-- thing a delete could lose is the library link itself.

begin;

update exercises set exercise_library_id = (select id from exercise_library where name = 'Single arm dumbbell row')
where exercise_library_id = (select id from exercise_library where name = 'Single-Arm Dumbbell Row');

update exercises set exercise_library_id = (select id from exercise_library where name = 'Cable Seated Row')
where exercise_library_id in (select id from exercise_library where name in ('Seated Cable Row', 'Machine Row'));

-- expect 0
select count(*) as should_be_zero
from exercises e join exercise_library el on el.id = e.exercise_library_id
where el.name in ('Single-Arm Dumbbell Row', 'Seated Cable Row', 'Machine Row');

-- expect 36
select count(*) as should_be_36
from set_logs sl join exercises e on e.id = sl.exercise_id
join exercise_library el on el.id = e.exercise_library_id
where el.name in ('Single arm dumbbell row', 'Cable Seated Row');

delete from exercise_library where name in ('Single-Arm Dumbbell Row', 'Seated Cable Row', 'Machine Row');
update exercise_library set name = 'Seated Cable Row' where name = 'Cable Seated Row';

commit;
-- If either count was wrong, run: rollback;
