"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Program = { id: string; name: string; description: string | null; duration_weeks: number; workout_count: number };

export default function ProgramsPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data } = await supabase
      .from("programs")
      .select("id, name, description, duration_weeks, workouts(count)")
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: false });
    setPrograms((data ?? []).map((p: any) => ({ ...p, workout_count: p.workouts?.[0]?.count ?? 0 })));
    setLoading(false);
  }

  function startEdit(p: Program, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(p.id);
    setEditName(p.name);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    setSaving(true);
    const supabase = createClient();
    await supabase.from("programs").update({ name: editName.trim() }).eq("id", id);
    setPrograms(programs.map(p => p.id === id ? { ...p, name: editName.trim() } : p));
    setEditingId(null);
    setSaving(false);
  }

  async function confirmDelete(id: string) {
    const supabase = createClient();
    await supabase.from("programs").delete().eq("id", id);
    setPrograms(programs.filter(p => p.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Programs</div>
          </div>
          <Link href="/trainer/programs/new" style={btnStyle}>+ New Program</Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
        ) : !programs.length ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 6 }}>No programs yet</div>
            <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 20 }}>Create your first program to assign to clients</div>
            <Link href="/trainer/programs/new" style={btnStyle}>+ Create Program</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {programs.map(p => (
              <div key={p.id} style={{ ...cardStyle, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingId === p.id ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEdit(p.id); if (e.key === "Escape") setEditingId(null); }}
                          autoFocus
                          style={{ flex: 1, fontSize: 17, fontWeight: 700, color: "#0D1827", padding: "6px 10px", borderRadius: 8, border: "2px solid #2DC4B8", background: "#F4F7FA", outline: "none" }}
                        />
                        <button onClick={() => saveEdit(p.id)} disabled={saving} style={{ padding: "6px 14px", borderRadius: 8, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: "6px 10px", borderRadius: 8, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 13, border: "1px solid #E2EAF0", cursor: "pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Link href={`/trainer/programs/${p.id}`} style={{ fontSize: 17, fontWeight: 700, color: "#0D1827", textDecoration: "none" }}>{p.name}</Link>
                        <button onClick={e => startEdit(p, e)} title="Edit name" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9CA3AF", fontSize: 14, lineHeight: 1 }}>✏️</button>
                      </div>
                    )}
                    {p.description && <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 6 }}>{p.description}</div>}
                    <div style={{ fontSize: 12, color: "#6B7A8D" }}>
                      {p.duration_weeks} weeks · {p.workout_count} workouts
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <Link href={`/trainer/programs/${p.id}`} style={{ fontSize: 20, color: "#2DC4B8", textDecoration: "none" }}>→</Link>
                    <button
                      onClick={e => { e.preventDefault(); setConfirmDeleteId(p.id); }}
                      title="Delete program"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9CA3AF", fontSize: 16, lineHeight: 1 }}
                    >🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 340, width: "100%" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1827", marginBottom: 8 }}>Delete program?</div>
            <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 20 }}>
              This will delete <strong>{programs.find(p => p.id === confirmDeleteId)?.name}</strong> and all its workouts. This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#0D1827" }}>Cancel</button>
              <button onClick={() => confirmDelete(confirmDeleteId)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#DC2626", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#fff" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0",
};
const btnStyle: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff",
  fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-block",
};
