import { logout } from "@/app/actions/auth";
import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 32px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#1B68B4", marginBottom: 10 }}>Awaiting Approval</div>
        <div style={{ color: "#6B7A8D", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
          Your trainer account is under review. Once approved by admin, you'll have full access to the trainer dashboard.
        </div>
        <form action={logout}>
          <button
            type="submit"
            style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 700, fontSize: 15, border: "1px solid #E2EAF0", cursor: "pointer" }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
