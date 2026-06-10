import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Handle token_hash flow (password reset emails)
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (!error) {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  if (code) {
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code);

    if (type === "recovery") {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }

    if (user) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("role, is_approved")
        .eq("id", user.id)
        .single();

      if (!existing) {
        const role = (user.user_metadata?.role as string) ?? "client";
        const isAdmin = user.email === "pdxfitnessgym@gmail.com";
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email!,
          full_name: (user.user_metadata?.full_name as string) ?? "",
          role,
          is_approved: role !== "trainer" || isAdmin,
        });
        const dest = role === "trainer" ? "/pending-approval" : "/client";
        return NextResponse.redirect(new URL(dest, request.url));
      }

      if (existing.role === "trainer" && !existing.is_approved) {
        return NextResponse.redirect(new URL("/pending-approval", request.url));
      }

      return NextResponse.redirect(new URL(existing.role === "trainer" ? "/trainer" : "/client", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
