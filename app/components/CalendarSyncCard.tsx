"use client";
import { useEffect, useState } from "react";

export function CalendarSyncCard() {
  const [calToken, setCalToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/subscribe")
      .then(r => r.json())
      .then(d => setCalToken(d.token ?? null))
      .catch(() => {});
  }, []);

  function calUrl(scheme: "webcal" | "https") {
    if (!calToken) return "";
    return `${scheme}://${window.location.host}/api/calendar/${calToken}`;
  }

  function copyUrl() {
    if (!calToken) return;
    navigator.clipboard.writeText(calUrl("https"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!calToken) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0", marginTop: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>Sync sessions to your calendar</div>
      <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 16 }}>
        Your training sessions with your trainer, kept up to date. Add it once — tapping again just adds a duplicate calendar.
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7A8D", marginBottom: 6 }}>Your calendar URL</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", fontSize: 11, color: "#374151", wordBreak: "break-all", fontFamily: "monospace" }}>
            {calUrl("webcal")}
          </div>
          <button
            onClick={copyUrl}
            style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 10, background: copied ? "#10B981" : "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <a
          href={calUrl("webcal")}
          style={{ padding: "14px 16px", borderRadius: 12, background: "#000", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}
        >
          <span style={{ fontSize: 22 }}>📅</span>
          <div>
            <div>Add to Apple Calendar</div>
            <div style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>Subscribe once — it updates on its own</div>
          </div>
        </a>

        <div style={{ background: "#F4F7FA", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827", marginBottom: 8 }}>Manual subscription (Apple or Google)</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", lineHeight: 1.7 }}>
            1. Tap <strong>Copy</strong> above<br />
            2. <strong>Apple:</strong> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste the URL<br />
            <strong>Google:</strong> calendar.google.com → Other calendars + → From URL → paste
          </div>
        </div>
      </div>
    </div>
  );
}
