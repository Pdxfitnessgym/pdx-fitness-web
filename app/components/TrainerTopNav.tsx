"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The handful of places a trainer jumps between constantly. Hidden on the
// dashboard itself, which already has the full Navigate grid.
const ITEMS = [
  { label: "Home", href: "/trainer", icon: "🏠" },
  { label: "Clients", href: "/trainer/clients", icon: "👥" },
  { label: "Programs", href: "/trainer/programs", icon: "📋" },
  { label: "Calendar", href: "/trainer/calendar", icon: "📅" },
];

export function TrainerTopNav() {
  const pathname = usePathname();
  if (pathname === "/trainer") return null;

  function isActive(href: string) {
    if (href === "/trainer") return false;
    return pathname.startsWith(href);
  }

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                minHeight: 44, textDecoration: "none", padding: "6px 4px",
                borderBottom: active ? "2px solid #1B68B4" : "2px solid transparent",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? "#1B68B4" : "#6B7A8D" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
