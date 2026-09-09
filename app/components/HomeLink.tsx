import Link from "next/link";

// Sits beside a page's contextual back link so there's always a way home,
// not just one level up. Both render inline, so they share a row.
export function HomeLink({ role }: { role: "trainer" | "client" }) {
  return (
    <Link
      href={role === "trainer" ? "/trainer" : "/client"}
      style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 600, textDecoration: "none", marginLeft: 14 }}
    >
      🏠 Home
    </Link>
  );
}
