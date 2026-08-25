"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Announcement = {
  id: string;
  content: string;
  photo_url: string | null;
  created_at: string;
  group_id: string | null;
};

type Group = { id: string; name: string; emoji: string | null };

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data }, { data: g }] = await Promise.all([
      supabase
        .from("posts")
        .select("id, content, photo_url, created_at, group_id")
        .eq("post_type", "announcement")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("groups")
        .select("id, name, emoji")
        .eq("trainer_id", user.id)
        .order("name"),
    ]);
    setAnnouncements(data ?? []);
    setGroups(g ?? []);
    setLoading(false);
  }

  async function post() {
    if (!content.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("posts").insert({
      author_id: user.id,
      content: content.trim(),
      post_type: "announcement",
      group_id: groupId || null,
    });
    setContent("");
    await load();
    setSaving(false);
  }

  const targetGroup = groups.find(g => g.id === groupId);
  function groupLabel(id: string | null) {
    if (!id) return null;
    const g = groups.find(x => x.id === id);
    return g ? `${g.emoji ?? "👥"} ${g.name}` : "👥 Group";
  }

  async function deleteAnnouncement(id: string) {
    const supabase = createClient();
    await supabase.from("posts").delete().eq("id", id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    setConfirmDeleteId(null);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Announcements</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>Post updates to everyone, or just one group, on their home screen</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Compose */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827", marginBottom: 10 }}>New Announcement</div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Share a gym update, schedule change, motivation, class info..."
            rows={4}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6, marginBottom: 12 }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Send to</label>
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none", marginBottom: 12 }}
          >
            <option value="">Everyone</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.emoji ?? "👥"} {g.name}</option>
            ))}
          </select>
          {groups.length === 0 && (
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: -6, marginBottom: 12 }}>
              <Link href="/trainer/groups" style={{ color: "#2DC4B8" }}>Create a group →</Link> to send announcements to only some clients.
            </div>
          )}

          <button
            onClick={post}
            disabled={!content.trim() || saving}
            style={{ width: "100%", padding: "13px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: content.trim() ? "pointer" : "default", opacity: !content.trim() || saving ? 0.5 : 1 }}
          >
            {saving ? "Posting..." : targetGroup ? `📢 Post to ${targetGroup.name}` : "📢 Post to All Clients"}
          </button>
        </div>

        {/* Past announcements */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
        ) : !announcements.length ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "40px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📢</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No announcements yet</div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>Posts will appear here and on all client home screens</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Posted</div>
            {announcements.map(a => (
              <div key={a.id} style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: "#0D1827", lineHeight: 1.6, marginBottom: 8 }}>{a.content}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 5, padding: "2px 8px", background: a.group_id ? "#EBF9F8" : "#EBF4FF", color: a.group_id ? "#0F766E" : "#1B68B4" }}>
                        {groupLabel(a.group_id) ?? "🌐 Everyone"}
                      </span>
                      <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmDeleteId(a.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 16, padding: 4, flexShrink: 0 }}
                  >🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 320, width: "100%" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1827", marginBottom: 8 }}>Delete announcement?</div>
            <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 20 }}>This will remove it from all client home screens immediately.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", fontWeight: 600, fontSize: 14, cursor: "pointer", color: "#0D1827" }}>Cancel</button>
              <button onClick={() => deleteAnnouncement(confirmDeleteId)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#DC2626", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#fff" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
