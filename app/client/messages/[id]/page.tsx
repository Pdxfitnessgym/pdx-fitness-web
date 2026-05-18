"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { use } from "react";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  senderName: string;
};

type Member = { user_id: string; name: string };

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const COLORS = ["#1B68B4", "#2DC4B8", "#7C3AED", "#DB2777", "#D97706", "#059669"];
function avatarColor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ClientChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [convoName, setConvoName] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);

      // Load conversation info
      const [{ data: convo }, { data: memberData }, { data: msgData }] = await Promise.all([
        supabase.from("conversations").select("name, is_group").eq("id", conversationId).single(),
        supabase.from("conversation_members").select("user_id, profiles!conversation_members_user_id_fkey(full_name)").eq("conversation_id", conversationId),
        supabase.from("messages").select("id, sender_id, content, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(100),
      ]);

      if (!convo) { window.location.href = "/client/messages"; return; }

      const memberList: Member[] = (memberData ?? []).map(m => {
        const p = m.profiles as unknown as { full_name: string };
        return { user_id: m.user_id, name: p?.full_name ?? "Member" };
      });
      setMembers(memberList);
      setIsGroup(convo.is_group);

      // Display name
      if (convo.is_group && convo.name) {
        setConvoName(convo.name);
      } else {
        const others = memberList.filter(m => m.user_id !== user.id);
        setConvoName(others.map(m => m.name).join(", ") || "Chat");
      }

      const nameMap: Record<string, string> = {};
      memberList.forEach(m => { nameMap[m.user_id] = m.name; });

      const mapped: Message[] = (msgData ?? []).map(m => ({
        id: m.id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        senderName: nameMap[m.sender_id] ?? "Member",
      }));
      setMessages(mapped);
      setLoading(false);

      // Mark as read
      supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", user.id).then(() => {});

      // Realtime subscription
      const channel = supabase
        .channel(`chat:${conversationId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        }, payload => {
          const m = payload.new as { id: string; sender_id: string; content: string; created_at: string };
          setMessages(prev => {
            if (prev.find(p => p.id === m.id)) return prev;
            return [...prev, { ...m, senderName: nameMap[m.sender_id] ?? "Member" }];
          });
          // Mark as read when new message arrives
          supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", user.id).then(() => {});
          setTimeout(() => scrollToBottom(), 50);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [conversationId, scrollToBottom]);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading, scrollToBottom]);

  async function sendMessage() {
    if (!input.trim() || !userId || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const supabase = createClient();
    await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: userId, content });
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Group consecutive messages by same sender
  const grouped = messages.reduce<{ sender_id: string; senderName: string; msgs: Message[] }[]>((acc, m) => {
    const last = acc[acc.length - 1];
    if (last && last.sender_id === m.sender_id) {
      last.msgs.push(m);
    } else {
      acc.push({ sender_id: m.sender_id, senderName: m.senderName, msgs: [m] });
    }
    return acc;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#F4F7FA" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "12px 16px", flexShrink: 0 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/client/messages" style={{ fontSize: 20, textDecoration: "none", color: "#6B7A8D", lineHeight: 1 }}>←</Link>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: isGroup ? "#F4F7FA" : avatarColor(convoName), border: isGroup ? "2px solid #E2EAF0" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isGroup ? 20 : 14, color: "#fff", fontWeight: 800 }}>
            {isGroup ? "👥" : initials(convoName)}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1827" }}>{convoName}</div>
            {isGroup && <div style={{ fontSize: 12, color: "#6B7A8D" }}>{members.length} members</div>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#6B7A8D" }}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
            <div style={{ fontSize: 14 }}>Say hello!</div>
          </div>
        ) : (
          grouped.map((group, gi) => {
            const isMe = group.sender_id === userId;
            return (
              <div key={gi} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && isGroup && (
                  <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 4, marginLeft: 44, fontWeight: 600 }}>{group.senderName}</div>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: isMe ? "row-reverse" : "row" }}>
                  {!isMe && (
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor(group.senderName), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                      {initials(group.senderName)}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: "72%", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    {group.msgs.map((m, mi) => (
                      <div key={m.id}>
                        <div style={{ background: isMe ? "#1B68B4" : "#fff", color: isMe ? "#fff" : "#0D1827", borderRadius: mi === 0 && !isMe ? "4px 18px 18px 18px" : mi === 0 && isMe ? "18px 4px 18px 18px" : 18, padding: "10px 14px", fontSize: 14, lineHeight: 1.45, border: isMe ? "none" : "1px solid #E2EAF0", wordBreak: "break-word" }}>
                          {m.content}
                        </div>
                        {mi === group.msgs.length - 1 && (
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3, textAlign: isMe ? "right" : "left" }}>{formatTime(m.created_at)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ background: "#fff", borderTop: "1px solid #E2EAF0", padding: "12px 16px 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none", resize: "none", lineHeight: 1.4, maxHeight: 100, fontFamily: "inherit" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{ width: 44, height: 44, borderRadius: "50%", background: input.trim() ? "#1B68B4" : "#E2EAF0", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke={input.trim() ? "#fff" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() ? "#fff" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
