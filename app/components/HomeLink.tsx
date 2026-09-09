import Link from "next/link";

// Sits at the right end of a page's header row so there's always a way home,
// not just one level up. Placement is the container's job — a space-between
// flex row on simple headers, the existing right-hand group on busy ones.
export function HomeLink({ role }: { role: "trainer" | "client" }) {
  return (
    <Link
      href={role === "trainer" ? "/trainer" : "/client"}
      style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
    >
      🏠 Home
    </Link>
  );
}
