"use client";
import { usePushNotifications } from "@/app/hooks/usePushNotifications";

export function NotificationBanner() {
  const { permission, subscribed, loading, supported, subscribe, unsubscribe } = usePushNotifications();

  if (!supported || permission === "denied") return null;
  if (subscribed) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #1B68B4, #2DC4B8)",
      borderRadius: 14,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 16,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Enable Notifications</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
          Stay updated on workouts & client activity
        </div>
      </div>
      <button
        onClick={subscribe}
        disabled={loading}
        style={{
          background: "#fff",
          color: "#1B68B4",
          border: "none",
          borderRadius: 10,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {loading ? "…" : "Turn On"}
      </button>
    </div>
  );
}
