"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function ClientNotesEditor({ clientId, initialNotes }: { clientId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(value: string) {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ client_notes: value || null }).eq("id", clientId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function onChange(value: string) {
    setNotes(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 1000);
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #E2EAF0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827" }}>Private Trainer Notes</div>
        <div style={{ fontSize: 12, color: saved ? "#10B981" : "#9CA3AF" }}>
          {saving ? "Saving..." : saved ? "✓ Saved" : "Auto-saves"}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={e => onChange(e.target.value)}
        placeholder={`Notes about this client — injuries, goals, preferences, things to remember...\n\nOnly you can see this.`}
        rows={12}
        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
      />
    </div>
  );
}
