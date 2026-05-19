"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Group = { id: string; name: string; emoji: string; description: string | null; member_count: number };
type Client = { id: string; full_name: string };

const EMOJI_OPTIONS = ["💪", "🔥", "⚡", "🏆", "🎯", "🌱", "🏋️", "🤸"];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("💪");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [groupsRes, clientsRes] = await Promise.all([
        supabase.from("groups").select("id, name, emoji, description").eq("trainer_id", user.id).order("created_at"),
        supabase.from("profiles").select("id, full_name").eq("trainer_id", user.id).order("full_name"),
      ]);

      const rawGroups = groupsRes.data ?? [];
      const groupIds = rawGroups.map((g: { id: string }) => g.id);

      let memberships: { group_id: string; user_id: string }[] = [];
      if (groupIds.length > 0) {
        const { data } = await supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds);
        memberships = data ?? [];
      }

      const membersMap: Record<string, string[]> = {};
      for (const m of memberships) {
        if (!membersMap[m.group_id]) membersMap[m.group_id] = [];
        membersMap[m.group_id].push(m.user_id);
      }

      const hydratedGroups: Group[] = rawGroups.map((g: { id: string; name: string; emoji: string; description: string | null }) => ({
        ...g,
        member_count: (membersMap[g.id] ?? []).length,
      }));

      setGroups(hydratedGroups);
      setClients(clientsRes.data ?? []);
      setGroupMembers(membersMap);
      setLoading(false);
    };
    load();
  }, []);

  const createGroup = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data, error } = await supabase
      .from("groups")
      .insert({ trainer_id: user.id, name: newName.trim(), emoji: newEmoji, description: newDesc.trim() || null })
      .select("id, name, emoji, description")
      .single();

    if (!error && data) {
      const newGroup: Group = { ...data, member_count: 0 };
      setGroups((prev) => [...prev, newGroup]);
      setGroupMembers((prev) => ({ ...prev, [data.id]: [] }));
    }

    setNewName("");
    setNewEmoji("💪");
    setNewDesc("");
    setSaving(false);
    setCreating(false);
  };

  const deleteGroup = async (groupId: string) => {
    const supabase = createClient();
    await supabase.from("groups").delete().eq("id", groupId);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (activeGroup?.id === groupId) setActiveGroup(null);
  };

  const toggleMember = async (groupId: string, userId: string, isMember: boolean) => {
    setAddingMember(true);
    const supabase = createClient();

    if (isMember) {
      await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
      setGroupMembers((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).filter((id) => id !== userId),
      }));
      setGroups((prev) =>
        prev.map((g) => g.id === groupId ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g)
      );
    } else {
      await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
      setGroupMembers((prev) => ({
        ...prev,
        [groupId]: [...(prev[groupId] ?? []), userId],
      }));
      setGroups((prev) =>
        prev.map((g) => g.id === groupId ? { ...g, member_count: g.member_count + 1 } : g)
      );
    }

    setAddingMember(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#6B7280", fontSize: 16 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", padding: "24px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/trainer" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#1B68B4", fontSize: 14, textDecoration: "none", marginBottom: 12 }}>
            ← Dashboard
          </Link>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#111827" }}>Community Groups</h1>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6B7280" }}>Create groups and manage members</p>
            </div>
            <button
              onClick={() => { setCreating(true); setActiveGroup(null); }}
              style={{
                background: "#2DC4B8",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              + New Group
            </button>
          </div>
        </div>

        {/* Create Form */}
        {creating && (
          <div style={{ background: "#fff", border: "1px solid #E2EAF0", borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#111827" }}>New Group</h2>

            {/* Emoji picker */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Emoji</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setNewEmoji(e)}
                    style={{
                      fontSize: 20,
                      background: newEmoji === e ? "#EBF4FF" : "#F4F7FA",
                      border: newEmoji === e ? "2px solid #1B68B4" : "2px solid transparent",
                      borderRadius: 8,
                      padding: "4px 8px",
                      cursor: "pointer",
                      lineHeight: 1.4,
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <input
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
                maxLength={2}
                placeholder="or type"
                style={{
                  width: 72,
                  padding: "8px 10px",
                  border: "1px solid #E2EAF0",
                  borderRadius: 8,
                  fontSize: 16,
                  outline: "none",
                  textAlign: "center",
                }}
              />
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Morning Warriors"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E2EAF0",
                  borderRadius: 8,
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Description <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What's this group about?"
                rows={2}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #E2EAF0",
                  borderRadius: 8,
                  fontSize: 15,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setCreating(false); setNewName(""); setNewEmoji("💪"); setNewDesc(""); }}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#F4F7FA",
                  border: "1px solid #E2EAF0",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#374151",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                disabled={saving || !newName.trim()}
                style={{
                  flex: 2,
                  padding: "10px",
                  background: saving || !newName.trim() ? "#93C5FD" : "#1B68B4",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: saving || !newName.trim() ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {groups.length === 0 && !creating && (
          <div style={{
            background: "#fff",
            border: "1px solid #E2EAF0",
            borderRadius: 14,
            padding: "48px 24px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No groups yet</p>
            <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>Create a group to organize your clients into communities</p>
          </div>
        )}

        {/* Groups list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((group) => {
            const isExpanded = activeGroup?.id === group.id;
            const members = groupMembers[group.id] ?? [];

            return (
              <div
                key={group.id}
                style={{
                  background: "#fff",
                  border: "1px solid #E2EAF0",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                {/* Group row */}
                <button
                  onClick={() => setActiveGroup(isExpanded ? null : group)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 20px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{group.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{group.name}</p>
                    {group.description && (
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.description}</p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: "#6B7280", whiteSpace: "nowrap", marginRight: 8 }}>{group.member_count} member{group.member_count !== 1 ? "s" : ""}</span>
                  <span style={{ color: "#9CA3AF", fontSize: 14, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                </button>

                {/* Expanded member management */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #E2EAF0", padding: "16px 20px" }}>
                    <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Members</p>

                    {clients.length === 0 ? (
                      <p style={{ fontSize: 14, color: "#9CA3AF", margin: "0 0 16px" }}>No clients yet</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
                        {clients.map((client) => {
                          const isMember = members.includes(client.id);
                          return (
                            <label
                              key={client.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "10px 12px",
                                borderRadius: 8,
                                cursor: addingMember ? "wait" : "pointer",
                                background: isMember ? "#F0FDF9" : "transparent",
                                transition: "background 0.15s",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isMember}
                                disabled={addingMember}
                                onChange={() => toggleMember(group.id, client.id, isMember)}
                                style={{ width: 16, height: 16, accentColor: "#2DC4B8", cursor: "pointer" }}
                              />
                              <span style={{ fontSize: 14, color: "#111827", fontWeight: isMember ? 600 : 400 }}>{client.full_name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => deleteGroup(group.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#EF4444",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "4px 0",
                      }}
                    >
                      Delete Group
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
