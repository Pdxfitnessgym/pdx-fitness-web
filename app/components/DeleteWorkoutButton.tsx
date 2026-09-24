"use client";
import { deleteWorkout } from "@/app/actions/programs";

export function DeleteWorkoutButton({ workoutId, programId, name, exerciseCount }: { workoutId: string; programId: string; name: string; exerciseCount: number }) {
  return (
    <form
      action={deleteWorkout}
      onSubmit={e => {
        const msg = exerciseCount > 0
          ? `Delete "${name}" and its ${exerciseCount} exercises? Any client logs for this workout will also be removed.`
          : `Delete "${name}"?`;
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={workoutId} />
      <input type="hidden" name="program_id" value={programId} />
      <button type="submit" aria-label={`Delete ${name}`} style={{ background: "#fff", border: "1px solid #E2EAF0", borderRadius: 12, width: 48, height: "100%", minHeight: 48, cursor: "pointer", fontSize: 16, color: "#E05252" }}>
        🗑
      </button>
    </form>
  );
}
