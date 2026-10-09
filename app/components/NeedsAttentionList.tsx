"use client";
import { useState } from "react";
import Link from "next/link";

const COLLAPSED = 3;

export type AttentionItem = { clientId: string; name: string; reason: string; severity: number };

export function NeedsAttentionList({ items }: { items: AttentionItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, COLLAPSED);
  const hidden = items.length - shown.length;

  return (
    <>
      {shown.map((f, i) => (
        <Link
          key={`${f.clientId}-${f.reason}`}
          href={`/trainer/clients/${f.clientId}`}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", textDecoration: "none", borderTop: i === 0 ? "none" : "1px solid #F4F7FA" }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: f.severity >= 4 ? "#EF4444" : f.severity === 3 ? "#F59E0B" : "#9CA3AF" }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{f.name}</span>
            <span style={{ display: "block", fontSize: 12, color: "#6B7A8D" }}>{f.reason}</span>
          </span>
          <span style={{ color: "#9CA3AF", fontSize: 18 }}>›</span>
        </Link>
      ))}

      {items.length > COLLAPSED && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ width: "100%", padding: "11px", borderTop: "1px solid #F4F7FA", background: "#FFFBEB", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#92400E" }}
        >
          {expanded ? "Show less ▲" : `Show ${hidden} more ▼`}
        </button>
      )}
    </>
  );
}
