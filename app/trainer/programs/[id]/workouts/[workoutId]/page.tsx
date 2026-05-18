import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { addExercise, deleteExercise } from "@/app/actions/programs";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string; workoutId: string }> }) {
  const { id, workoutId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workout } = await supabase.from("workouts").select("*, programs(name, trainer_id)").eq("id", workoutId).single();
  if (!workout || (workout.programs as any)?.trainer_id !== user.id) redirect("/trainer/programs");

  const { data: exercises } = await supabase.from("exercises").select("*").eq("workout_id", workoutId).order("order");

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href={`/trainer/programs/${id}`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← {(workout.programs as any)?.name}</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{workout.name}</div>
          <div style={{ fontSize: 13, color: "#6B7A8D" }}>Week {workout.week_number} · {DAYS[workout.day_of_week]}</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        {/* Exercise list */}
        {exercises?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {exercises.map((ex, i) => (
              <div key={ex.id} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #E2EAF0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{i + 1}. {ex.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
                    {ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest
                    {ex.notes && <span> · <em>{ex.notes}</em></span>}
                  </div>
                </div>
                <form action={deleteExercise}>
                  <input type="hidden" name="id" value={ex.id} />
                  <input type="hidden" name="workout_id" value={workoutId} />
                  <input type="hidden" name="program_id" value={id} />
                  <button type="submit" style={{ background: "none", border: "none", cursor: "pointer", color: "#E2EAF0", fontSize: 18, padding: "4px 8px" }} title="Remove">✕</button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#6B7A8D", fontSize: 14 }}>No exercises yet — add one below</div>
        )}

        {/* Add exercise form */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #E2EAF0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 16 }}>+ Add Exercise</div>
          <form action={addExercise} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input type="hidden" name="workout_id" value={workoutId} />
            <input type="hidden" name="program_id" value={id} />
            <input name="name" required placeholder="Exercise name (e.g. Bench Press)" style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Sets</label>
                <input name="sets" type="number" min={1} defaultValue={3} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Reps</label>
                <input name="reps" placeholder="8-12" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Rest (sec)</label>
                <input name="rest_seconds" type="number" defaultValue={60} style={inputStyle} />
              </div>
            </div>
            <input name="notes" placeholder="Notes (optional)" style={inputStyle} />
            <button type="submit" style={btnStyle}>Add Exercise</button>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#6B7A8D", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0",
  background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none",
};
const btnStyle: React.CSSProperties = {
  padding: "13px", borderRadius: 12, background: "#2DC4B8", color: "#fff",
  fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
};
