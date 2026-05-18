"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Convo = {
  id: string;
  name: string | null;
  is_group: boolean;
  lastMessage: string | null;
  lastAt: string | null;
  unread: boolean;
  members: { user_id: string; name: string }[];
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const COLORS = ["#1B68B4", "#2DC4B8", "#7C3AED", "#DB2777", "#D97706", "#059669"];
function avatarColor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

export default function TrainerMessagesPage() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchConvos = useCallback(async (uid: string) => {
    const supabase = createClient();
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", uid);

    if (!memberships?.length) { setLoading(false); return; }

    const convoIds = memberships.map(m => m.conversation_id);
    const lastReadMap: Record<string, string | null> = {};
    memberships.forEach(m => { lastReadMap[m.conversation_id] = m.last_read_at; });

    const [{ data: conversations }, { data: allMembers }, { data: lastMsgs }] = await Promise.all([
      supabase.from("conversations").select("id, name, is_group, created_at").in("id", convoIds),
      supabase.from("conversation_members").select("conversation_id, user_id, profiles!conversation_members_user_id_fkey(full_name)").in("conversation_id", convoIds),
      supabase.from("messages").select("conversation_id, content, created_at").in("conversation_id", convoIds).order("created_at", { ascending: false }),
    ]);

    const lastMsgByConvo: Record<string, { content: string; created_at: string }> = {};
    (lastMsgs ?? []).forEach(m => {
      if (!lastMsgByConvo[m.conversation_id]) lastMsgByConvo[m.conversation_id] = m;
    });

    const membersByConvo: Record<string, { user_id: string; name: string }[]> = {};
    (allMembers ?? []).forEach(m => {
      if (!membersByConvo[m.conversation_id]) membersByConvo[m.conversation_id] = [];
      const p = m.profiles as unknown as { full_name: string };
      membersByConvo[m.conversation_id].push({ user_id: m.user_id, name: p?.full_name ?? "Member" });
    });

    const mapped: Convo[] = (conversations ?? []).map(c => {
      const last = lastMsgByConvo[c.id];
      const lastRead = lastReadMap[c.id];
      const unread = !!last && (!lastRead || new Date(last.created_at) > new Date(lastRead));
      return {
        id: c.id,
        name: c.name,
        is_group: c.is_group,
        lastMessage: last?.content ?? null,
        lastAt: last?.created_at ?? c.created_at,
        unread,
        members: membersByConvo[c.id] ?? [],
      };
    }).sort((a, b) => new Date(b.lastAt!).getTime() - new Date(a.lastAt!).getTime());

    setConvos(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data: clientData } = await supabase.from("profiles").select("id, full_name").eq("trainer_id", user.id);
      setClients((clientData ?? []).map(c => ({ id: c.id, name: c.full_name ?? "Client" })));
      fetchConvos(user.id);
    });
  }, [fetchConvos]);

  async function createConvo() {
    if (!userId || selected.size === 0) return;
    setCreating(true);
    const supabase = createClient();
    const isGroup = selected.size > 1;
    const { data: convo } = await supabase
      .from("conversations")
      .insert({ is_group: isGroup, name: isGroup ? (groupName.trim() || "Group Chat") : null, created_by: userId })
      .select("id")
      .single();
    if (!convo) { setCreating(false); return; }

    const memberIds = [userId, ...Array.from(selected)];
    await supabase.from("conversation_members").insert(memberIds.map(uid => ({ conversation_id: convo.id, user_id: uid })));

    setShowNew(false);
    setSelected(new Set());
    setGroupName("");
    setCreating(false);
    window.location.href = `/trainer/messages/${convo.id}`;
  }

  function convoDisplayName(c: Convo) {
    if (c.is_group && c.name) return c.name;
    const others = c.members.filter(m => m.user_id !== userId);
    return others.map(m => m.name).join(", ") || "Chat";
  }

  function convoAvatar(c: Convo) {
    const name = convoDisplayName(c);
    return { initials: initials(name), color: avatarColor(name) };
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 20 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4", marginTop: 2 }}>Messages</div>
          </div>
          <button onClick={() => setShowNew(!showNew)} style={{ background: "#1B68B4", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            + New
          </button>
        </div>
      </div>

      {showNew && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2EAF0", padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827", marginBottom: 12 }}>Message a Client</div>
            {clients.length === 0 ? (
              <div style={{ fontSize: 14, color: "#9CA3AF" }}>No clients yet. Add clients first.</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {clients.map(c => (
                    <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={e => {
                          const next = new Set(selected);
                          e.target.checked ? next.add(c.id) : next.delete(c.id);
                          setSelected(next);
                        }}
                        style={{ width: 18, height: 18, accentColor: "#1B68B4" }}
                      />
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor(c.name), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                        {initials(c.name)}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#0D1827" }}>{c.name}</span>
                    </label>
                  ))}
                </div>
                {selected.size > 1 && (
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Group name (optional)"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
                  />
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowNew(false); setSelected(new Set()); }} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#6B7A8D" }}>Cancel</button>
                  <button onClick={createConvo} disabled={selected.size === 0 || creating} style={{ flex: 2, padding: "10px", borderRadius: 10, background: "#1B68B4", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#fff", opacity: selected.size === 0 || creating ? 0.5 : 1 }}>
                    {creating ? "Starting..." : selected.size > 1 ? "Create Group" : "Start Chat"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#6B7A8D" }}>Loading...</div>
        ) : convos.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827", marginBottom: 6 }}>No messages yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Tap + New to message a client directly.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {convos.map(c => {
              const av = convoAvatar(c);
              const displayName = convoDisplayName(c);
              return (
                <Link key={c.id} href={`/trainer/messages/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#fff", borderRadius: 14, textDecoration: "none", border: c.unread ? "2px solid #1B68B4" : "1px solid #E2EAF0" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: c.is_group ? "#F4F7FA" : av.color, border: c.is_group ? "2px solid #E2EAF0" : "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: c.is_group ? 20 : 16 }}>
                      {c.is_group ? "👥" : av.initials}
                    </div>
                    {c.unread && <div style={{ position: "absolute", top: 0, right: 0, width: 12, height: 12, borderRadius: "50%", background: "#1B68B4", border: "2px solid #fff" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div style={{ fontWeight: c.unread ? 800 : 600, fontSize: 15, color: "#0D1827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                      {c.lastAt && <div style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0, marginLeft: 8 }}>{timeAgo(c.lastAt)}</div>}
                    </div>
                    {c.lastMessage && <div style={{ fontSize: 13, color: c.unread ? "#1B68B4" : "#6B7A8D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: c.unread ? 600 : 400 }}>{c.lastMessage}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
