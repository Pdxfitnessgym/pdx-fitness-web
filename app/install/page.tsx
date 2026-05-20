"use client";
import { useState } from "react";
import Link from "next/link";

type Tab = "iphone" | "android" | "desktop";

const STEPS: Record<Tab, { title: string; body: React.ReactNode }[]> = {
  iphone: [
    {
      title: "Open PDX Fitness in Safari",
      body: (
        <>
          Make sure you&apos;re viewing this page in <strong>Safari</strong> (not Chrome or another browser).
          The URL bar should show <strong>pdx-fitness.vercel.app</strong>.
        </>
      ),
    },
    {
      title: "Tap the Share button",
      body: (
        <>
          Look for the share icon at the bottom of Safari — a box with an arrow pointing up:{" "}
          <span style={{ fontSize: 18 }}>⬆️</span>. On iOS 16+ it&apos;s at the{" "}
          <strong>bottom center</strong> of the screen. On older iPhones it&apos;s at the top right.
        </>
      ),
    },
    {
      title: 'Scroll down and tap "Add to Home Screen"',
      body: (
        <>
          In the share sheet, scroll down and look for the{" "}
          <strong>⊕ Add to Home Screen</strong> option. Tap it.
        </>
      ),
    },
    {
      title: 'Tap "Add" to confirm',
      body: (
        <>
          A preview will appear with the app name and icon. Tap <strong>Add</strong> in the top-right
          corner to install it. PDX Fitness will appear on your home screen like a real app.
        </>
      ),
    },
  ],
  android: [
    {
      title: "Open PDX Fitness in Chrome",
      body: (
        <>
          Make sure you&apos;re using <strong>Google Chrome</strong>. Other browsers may work but Chrome
          gives the best experience on Android.
        </>
      ),
    },
    {
      title: "Tap the three-dot menu",
      body: (
        <>
          Tap the <strong>⋮</strong> menu icon in the top-right corner of Chrome to open the browser
          options menu.
        </>
      ),
    },
    {
      title: 'Tap "Add to Home screen"',
      body: (
        <>
          Look for <strong>Add to Home screen</strong> in the menu list. Tap it. You may also see an
          install banner appear at the bottom of the screen automatically — tap that too.
        </>
      ),
    },
    {
      title: "Confirm the install",
      body: (
        <>
          A dialog will appear. Tap <strong>Add</strong> or <strong>Install</strong> to confirm.
          PDX Fitness will appear on your home screen and in your app drawer.
        </>
      ),
    },
  ],
  desktop: [
    {
      title: "Open PDX Fitness in Chrome or Edge",
      body: (
        <>
          Use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> for the best desktop
          install experience.
        </>
      ),
    },
    {
      title: "Look for the install icon in the address bar",
      body: (
        <>
          In the URL bar, look for a <strong>⊕</strong> or computer icon on the right side. Click it
          to install PDX Fitness as a desktop app.
        </>
      ),
    },
    {
      title: 'Click "Install"',
      body: (
        <>
          A small prompt will appear. Click <strong>Install</strong> to confirm. PDX Fitness will open
          in its own window without browser controls — just like a native app.
        </>
      ),
    },
  ],
};

const PUSH_STEPS: Record<Tab, { title: string; body: React.ReactNode }[]> = {
  iphone: [
    {
      title: "Open PDX Fitness from your home screen",
      body: "Push notifications on iPhone only work when you launch the app from the home screen icon — not from Safari directly.",
    },
    {
      title: 'Tap "Allow" when prompted',
      body: "The first time you open the app, it will ask for permission to send notifications. Tap Allow.",
    },
    {
      title: "Stay up to date",
      body: "You'll receive alerts for new workouts, trainer messages, announcements, and check-in feedback.",
    },
  ],
  android: [
    {
      title: "Open the installed app",
      body: "Launch PDX Fitness from your home screen or app drawer.",
    },
    {
      title: 'Tap "Allow" when prompted',
      body: "Android will ask for notification permission. Tap Allow to enable push alerts.",
    },
    {
      title: "Stay up to date",
      body: "You'll get notified about new workouts, trainer messages, announcements, and check-in responses.",
    },
  ],
  desktop: [
    {
      title: "Open the installed app",
      body: "Launch PDX Fitness from your desktop or Start menu.",
    },
    {
      title: "Allow notifications in your browser",
      body: "When prompted by the browser, click Allow to enable push notifications.",
    },
    {
      title: "Stay up to date",
      body: "Desktop alerts will appear in your system notification tray for messages and updates.",
    },
  ],
};

const TAB_ICONS: Record<Tab, string> = {
  iphone: "📱",
  android: "🤖",
  desktop: "💻",
};

const TAB_LABELS: Record<Tab, string> = {
  iphone: "iPhone",
  android: "Android",
  desktop: "Desktop",
};

export default function InstallPage() {
  const [tab, setTab] = useState<Tab>("iphone");

  return (
    <div style={{ minHeight: "100dvh", background: "#0D1827", color: "#fff", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 0" }}>
        <Link href="/client" style={{ fontSize: 13, color: "#2DC4B8", textDecoration: "none", fontWeight: 600 }}>
          ← Back to App
        </Link>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 24px 0" }}>
        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 14 }}>
            Install PDX Fitness<br />on your phone
          </div>
          <div style={{ fontSize: 16, color: "#94A3B8", lineHeight: 1.65 }}>
            Add PDX Fitness to your home screen as a real app. Opens fullscreen and lets you receive
            push notifications when your trainer sends a message, posts an announcement, or responds
            to your check-in.
          </div>
        </div>

        {/* Tab selector */}
        <div style={{ background: "#1E293B", borderRadius: 16, padding: 6, display: "flex", gap: 4, marginBottom: 24 }}>
          {(["iphone", "android", "desktop"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "12px 8px",
                borderRadius: 12,
                border: "none",
                background: tab === t ? "#1B68B4" : "transparent",
                color: tab === t ? "#fff" : "#64748B",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 22 }}>{TAB_ICONS[t]}</span>
              <span>{TAB_LABELS[t]}</span>
            </button>
          ))}
        </div>

        {/* iPhone Safari warning */}
        {tab === "iphone" && (
          <div style={{ background: "#1C1600", border: "1.5px solid #78540A", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: "#FCD34D", lineHeight: 1.6 }}>
              <strong style={{ color: "#F59E0B" }}>Important:</strong> on iPhone, you <strong>must use Safari</strong>. Chrome and other browsers can&apos;t install PDX Fitness to the home screen.
            </div>
          </div>
        )}

        {/* Android Chrome notice */}
        {tab === "android" && (
          <div style={{ background: "#001A0D", border: "1.5px solid #166534", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: "#86EFAC", lineHeight: 1.6 }}>
              <strong style={{ color: "#4ADE80" }}>Tip:</strong> use <strong>Google Chrome</strong> for the smoothest install experience on Android.
            </div>
          </div>
        )}

        {/* Install steps */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
          How to Install
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {STEPS[tab].map((step, i) => (
            <div
              key={i}
              style={{
                background: "#1E293B",
                borderRadius: 16,
                padding: "18px 18px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1B68B4, #2DC4B8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 16,
                color: "#fff",
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#F1F5F9", marginBottom: 6 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.65 }}>
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#1E293B", marginBottom: 28 }} />

        {/* Push notifications section */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          Push Notifications
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
          Never miss an update from your trainer
        </div>
        <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.65, marginBottom: 16 }}>
          Once installed, enable push notifications to get alerts for trainer messages, announcements, new workouts, and check-in feedback — all delivered instantly to your phone.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {PUSH_STEPS[tab].map((step, i) => (
            <div
              key={i}
              style={{
                background: "#1E293B",
                borderRadius: 16,
                padding: "18px 18px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#0F2A1A",
                border: "2px solid #2DC4B8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 16,
                color: "#2DC4B8",
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#F1F5F9", marginBottom: 6 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.65 }}>
                  {typeof step.body === "string" ? step.body : step.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* What you'll get */}
        <div style={{ background: "linear-gradient(135deg, #1B68B4 0%, #2DC4B8 100%)", borderRadius: 20, padding: "22px 22px" }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 14 }}>
            You&apos;ll get notified for:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { icon: "💬", label: "New messages from your trainer" },
              { icon: "📢", label: "Trainer announcements" },
              { icon: "🏋️", label: "New workouts added to your program" },
              { icon: "📋", label: "Check-in feedback from your trainer" },
              { icon: "🏆", label: "Challenge updates and milestones" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
