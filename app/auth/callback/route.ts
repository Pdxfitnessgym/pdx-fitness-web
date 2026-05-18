import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
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

    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code);

    if (user) {
      // ensure profile exists (creates it from metadata if missing)
      const { data: existing } = await supabase.from("profiles").select("role").eq("id", user.id).single();

      if (!existing) {
        await supabase.from("profiles").insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name ?? "",
          role: user.user_metadata?.role ?? "client",
        });
      }

      const role = existing?.role ?? user.user_metadata?.role ?? "client";
      return NextResponse.redirect(new URL(role === "trainer" ? "/trainer" : "/client", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
