import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isCalendarFeed = pathname.startsWith("/api/calendar/") && !pathname.endsWith("/subscribe");
  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname === "/" || isCalendarFeed;
  const isPendingPage = pathname.startsWith("/pending-approval");

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && (isPublic || isPendingPage)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_approved")
      .eq("id", user.id)
      .single();

    if (profile?.role === "trainer" && !profile.is_approved) {
      if (!isPendingPage) return NextResponse.redirect(new URL("/pending-approval", request.url));
      return supabaseResponse;
    }

    if (isPublic) {
      const dest = profile?.role === "trainer" ? "/trainer" : "/client";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (user && pathname.startsWith("/trainer")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_approved")
      .eq("id", user.id)
      .single();

    if (profile?.role === "trainer" && !profile.is_approved) {
      return NextResponse.redirect(new URL("/pending-approval", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-|apple-touch).*)"],
};
