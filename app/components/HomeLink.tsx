import Link from "next/link";

// Sits at the right end of a page's header row so there's always a way home,
// not just one level up. Placement is the container's job — a space-between
// flex row on simple headers, the existing right-hand group on busy ones.
export function HomeLink({ role }: { role: "trainer" | "client" }) {
  // Trainers get the sticky top nav from app/trainer/layout.tsx instead, so a
  // second Home link a few pixels away would just be noise.
  if (role === "trainer") return null;
  return (
    <Link
      href="/client"
      style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
    >
      🏠 Home
    </Link>
  );
}
