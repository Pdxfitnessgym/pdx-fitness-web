"use client";
import { useRouter } from "next/navigation";

const NEW_PROGRAM = "__new__";

export function ProgramSelect({ programs }: { programs: { id: string; name: string; duration_weeks: number }[] }) {
  const router = useRouter();

  return (
    <select
      name="program_id"
      required
      onChange={e => { if (e.target.value === NEW_PROGRAM) router.push("/trainer/programs/new"); }}
      style={{ width: "100%", padding: "13px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" }}
    >
      <option value="">Select a program…</option>
      {programs.map(p => (
        <option key={p.id} value={p.id}>{p.name} ({p.duration_weeks}wk)</option>
      ))}
      <option value={NEW_PROGRAM}>＋ Add New Program</option>
    </select>
  );
}
