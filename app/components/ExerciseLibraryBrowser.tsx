"use client";
import { useState, useMemo } from "react";
import Link from "next/link";

export type Ex = {
  id: string; name: string; muscle_group: string | null; equipment: string | null;
  instructions: string | null; video_url: string | null; youtube_url: string | null;
  trainer_id: string | null;
};

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function matches(ex: Ex, q: string) {
  return (
    ex.name.toLowerCase().includes(q) ||
    (ex.muscle_group ?? "").toLowerCase().includes(q) ||
    (ex.equipment ?? "").toLowerCase().includes(q)
  );
}

export function ExerciseLibraryBrowser({ master, mine }: { master: Ex[]; mine: Ex[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const shownMaster = useMemo(() => (q ? master.filter(e => matches(e, q)) : master), [master, q]);
  const shownMine = useMemo(() => (q ? mine.filter(e => matches(e, q)) : mine), [mine, q]);
  const nothing = q !== "" && shownMaster.length === 0 && shownMine.length === 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "#9CA3AF", pointerEvents: "none" }}>🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, muscle group or equipment"
          style={{ width: "100%", padding: "13px 38px 13px 40px", borderRadius: 12, border: "1px solid #E2EAF0", background: "#fff", fontSize: 16, color: "#0D1827", outline: "none" }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#F4F7FA", border: "none", borderRadius: 8, width: 26, height: 26, cursor: "pointer", color: "#6B7A8D", fontSize: 13 }}
          >✕</button>
        )}
      </div>

      {nothing && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "32px 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div style={{ fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>Nothing matches “{query}”</div>
          <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 16 }}>Try a different word, or add it to your library.</div>
          <Link href="/trainer/exercises/new" style={btnStyle}>+ Add Exercise</Link>
        </div>
      )}

      {shownMaster.length > 0 && (
        <div>
          <SectionHeading label="Master Library" count={shownMaster.length} accent />
          <ExerciseList exercises={shownMaster} />
        </div>
      )}

      {!nothing && (
        <div>
          <SectionHeading label="My Exercises" count={shownMine.length} />
          {shownMine.length === 0 ? (
            q ? (
              <div style={{ ...cardStyle, color: "#9CA3AF", fontSize: 14, textAlign: "center" }}>
                None of your own exercises match.
              </div>
            ) : (
              <div style={{ ...cardStyle, textAlign: "center", padding: "32px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏋️</div>
                <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No personal exercises yet</div>
                <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 16 }}>Add your own exercises alongside the master library</div>
                <Link href="/trainer/exercises/new" style={btnStyle}>+ Add Exercise</Link>
              </div>
            )
          ) : (
            <ExerciseList exercises={shownMine} />
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ label, count, accent }: { label: string; count: number; accent?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent ? "#1B68B4" : "#6B7A8D", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 700, background: accent ? "#EBF4FF" : "#F4F7FA", color: accent ? "#1B68B4" : "#6B7A8D", padding: "2px 8px", borderRadius: 20 }}>{count}</div>
    </div>
  );
}

function ExerciseList({ exercises }: { exercises: Ex[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {exercises.map(ex => (
        <Link key={ex.id} href={`/trainer/exercises/${ex.id}`} style={{ ...cardStyle, display: "flex", gap: 14, alignItems: "center", textDecoration: "none" }}>
          {ex.video_url ? (
            <div style={{ width: 72, height: 72, borderRadius: 10, background: "#000", overflow: "hidden", flexShrink: 0 }}>
              <video src={ex.video_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />
            </div>
          ) : ex.youtube_url && getYouTubeId(ex.youtube_url) ? (
            <div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative" }}>
              <img src={`https://img.youtube.com/vi/${getYouTubeId(ex.youtube_url)}/mqdefault.jpg`} alt={ex.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>▶</div>
              </div>
            </div>
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 28 }}>💪</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{ex.name}</div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
              {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
            </div>
            {ex.instructions && (
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                {ex.instructions}
              </div>
            )}
          </div>
          <div style={{ color: "#9CA3AF", fontSize: 18, flexShrink: 0 }}>›</div>
        </Link>
      ))}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" };
const btnStyle: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-block" };
