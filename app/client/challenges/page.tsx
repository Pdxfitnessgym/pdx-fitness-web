"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

type Challenge = {
  id: string; name: string; description: string | null; goal: string | null;
  cover_emoji: string; start_date: string; end_date: string;
  joined: boolean; checkedInToday: boolean; streak: number; totalCheckins: number;
  participantCount: number;
};

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...dates].sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split("T")[0];
  let streak = 0;
  let cursor = new Date(today);
  for (const d of sorted) {
    const cursorStr = cursor.toISOString().split("T")[0];
    if (d === cursorStr) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else if (d < cursorStr) break;
  }
  return streak;
}

export default function ClientChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [checkinNote, setCheckinNote] = useState<Record<string, string>>({});
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const fetchChallenges = useCallback(async (uid: string) => {
    const supabase = createClient();
    const [{ data: allChallenges }, { data: myParticipations }, { data: myCheckins }] = await Promise.all([
      supabase.from("challenges").select("id, name, description, goal, cover_emoji, start_date, end_date, challenge_participants(count)").eq("is_active", true).gte("end_date", today).order("start_date"),
      supabase.from("challenge_participants").select("challenge_id").eq("client_id", uid),
      supabase.from("challenge_checkins").select("challenge_id, checked_in_date").eq("client_id", uid),
    ]);

    const joinedIds = new Set((myParticipations ?? []).map(p => p.challenge_id));

    const mapped: Challenge[] = (allChallenges ?? []).map(c => {
      const myDates = (myCheckins ?? []).filter(ci => ci.challenge_id === c.id).map(ci => ci.checked_in_date);
      return {
        id: c.id, name: c.name, description: c.description, goal: c.goal,
        cover_emoji: c.cover_emoji, start_date: c.start_date, end_date: c.end_date,
        joined: joinedIds.has(c.id),
        checkedInToday: myDates.includes(today),
        streak: calcStreak(myDates),
        totalCheckins: myDates.length,
        participantCount: (c.challenge_participants?.[0] as any)?.count ?? 0,
      };
    });

    setChallenges(mapped);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchChallenges(user.id);
    });
  }, [fetchChallenges]);

  async function join(challengeId: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("challenge_participants").insert({ challenge_id: challengeId, client_id: userId });
    fetchChallenges(userId);
  }

  async function checkIn(challengeId: string) {
    if (!userId) return;
    setCheckingIn(challengeId);
    const supabase = createClient();
    const note = checkinNote[challengeId]?.trim() || null;
    await supabase.from("challenge_checkins").insert({ challenge_id: challengeId, client_id: userId, checked_in_date: today, note });
    setShowNoteFor(null);
    setCheckinNote(prev => ({ ...prev, [challengeId]: "" }));
    await fetchChallenges(userId);
    setCheckingIn(null);
  }

  const joined = challenges.filter(c => c.joined);
  const available = challenges.filter(c => !c.joined);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4" }}>Challenges</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#6B7A8D" }}>Loading challenges...</div>
        ) : (
          <>
            {/* My challenges */}
            {joined.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                  My Challenges
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {joined.map(c => {
                    const totalDays = Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000);
                    const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - new Date(today).getTime()) / 86400000));
                    const progress = Math.round(((totalDays - daysLeft) / totalDays) * 100);
                    return (
                      <div key={c.id} style={{ background: "#fff", borderRadius: 16, border: `2px solid ${c.checkedInToday ? "#2DC4B8" : "#E2EAF0"}`, overflow: "hidden" }}>
                        <Link href={`/client/challenges/${c.id}`} style={{ textDecoration: "none", display: "flex", gap: 14, alignItems: "center", padding: "14px 16px 10px" }}>
                          <div style={{ fontSize: 32 }}>{c.cover_emoji}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{c.name}</div>
                            <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, color: "#6B7A8D" }}>{daysLeft} days left</span>
                              {c.streak > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B" }}>🔥 {c.streak} streak</span>}
                              <span style={{ fontSize: 12, color: "#6B7A8D" }}>{c.totalCheckins} check-ins</span>
                            </div>
                          </div>
                          {c.checkedInToday && <span style={{ fontSize: 22 }}>✅</span>}
                        </Link>

                        {/* Progress bar */}
                        <div style={{ margin: "0 16px 10px", background: "#E2EAF0", borderRadius: 4, height: 5 }}>
                          <div style={{ background: "#2DC4B8", height: 5, borderRadius: 4, width: `${progress}%` }} />
                        </div>

                        {/* Check-in section */}
                        <div style={{ borderTop: "1px solid #F4F7FA", padding: "12px 16px" }}>
                          {c.checkedInToday ? (
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#2DC4B8", textAlign: "center" }}>✓ Checked in today — keep the streak going!</div>
                          ) : showNoteFor === c.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {c.goal && <div style={{ fontSize: 12, color: "#6B7A8D" }}>{c.goal}</div>}
                              <input
                                value={checkinNote[c.id] ?? ""}
                                onChange={e => setCheckinNote(prev => ({ ...prev, [c.id]: e.target.value }))}
                                placeholder="Add a note (optional)..."
                                autoFocus
                                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" }}
                              />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => setShowNoteFor(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6B7A8D" }}>Cancel</button>
                                <button onClick={() => checkIn(c.id)} disabled={checkingIn === c.id} style={{ flex: 2, padding: "10px", borderRadius: 10, background: "#2DC4B8", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff", opacity: checkingIn === c.id ? 0.6 : 1 }}>
                                  {checkingIn === c.id ? "Logging..." : "✓ Check In"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setShowNoteFor(c.id)} style={{ width: "100%", padding: "11px", borderRadius: 10, background: "#1B68B4", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                              ✓ Check In for Today
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available challenges */}
            {available.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                  Available to Join
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {available.map(c => {
                    const totalDays = Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000);
                    const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - new Date(today).getTime()) / 86400000));
                    return (
                      <div key={c.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2EAF0", padding: 16, display: "flex", gap: 14, alignItems: "center" }}>
                        <div style={{ fontSize: 32 }}>{c.cover_emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{c.name}</div>
                          {c.description && <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 3, lineHeight: 1.4 }}>{c.description}</div>}
                          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>{totalDays} days · {c.participantCount} joined · {daysLeft} days left</div>
                        </div>
                        <button onClick={() => join(c.id)} style={{ padding: "10px 16px", borderRadius: 10, background: "#1B68B4", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          Join
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {challenges.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827", marginBottom: 6 }}>No active challenges</div>
                <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer will post challenges here. Check back soon!</div>
              </div>
            )}
          </>
        )}
      </div>

      <ClientBottomNav />
    </div>
  );
}
