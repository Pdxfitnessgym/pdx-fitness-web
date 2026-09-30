import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExerciseLibraryBrowser, type Ex } from "@/app/components/ExerciseLibraryBrowser";

export default async function ExerciseLibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercises } = await supabase
    .from("exercise_library")
    .select("*")
    .order("name");

  // Shared gym library: master entries, then everything any trainer has added
  const master = (exercises?.filter(e => e.trainer_id === null) ?? []) as Ex[];
  const mine = (exercises?.filter(e => e.trainer_id !== null) ?? []) as Ex[];

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Exercise Library</div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>{master.length + mine.length} exercises · shared across the gym</div>
          </div>
          <Link href="/trainer/exercises/new" style={btnStyle}>+ Add Exercise</Link>
        </div>
      </div>

      <ExerciseLibraryBrowser master={master} mine={mine} myId={user.id} />
    </div>
  );
}

const btnStyle: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-block" };
