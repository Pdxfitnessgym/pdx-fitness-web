"use client";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      style={{ fontSize: 13, color: "#6B7A8D", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
    >
      Sign out
    </button>
  );
}
