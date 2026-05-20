"use client";
import { usePathname } from "next/navigation";

const NAV = [
  {
    label: "Home",
    href: "/client",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "#1B68B4" : "none"} stroke={active ? "#1B68B4" : "#6B7A8D"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
  },
  {
    label: "Workouts",
    href: "/client/workouts",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#1B68B4" : "#6B7A8D"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4v16M18 4v16M2 8h4M18 8h4M2 16h4M18 16h4M6 12h12"/>
      </svg>
    ),
  },
  {
    label: "Messages",
    href: "/client/messages",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#1B68B4" : "#6B7A8D"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    label: "Progress",
    href: "/client/progress",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#1B68B4" : "#6B7A8D"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/client/profile",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#1B68B4" : "#6B7A8D"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export function ClientBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/client") return pathname === "/client";
    return pathname.startsWith(href);
  }

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#fff",
      borderTop: "1px solid #E2EAF0",
      paddingBottom: "env(safe-area-inset-bottom, 8px)",
      zIndex: 100,
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5, 1fr)" }}>
        {NAV.map(item => {
          const active = isActive(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 0 8px",
                textDecoration: "none",
                gap: 4,
              }}
            >
              {item.icon(active)}
              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 400,
                color: active ? "#1B68B4" : "#6B7A8D",
                letterSpacing: 0.2,
              }}>
                {item.label}
              </span>
              {active && (
                <div style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#1B68B4",
                  marginTop: -2,
                }} />
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
