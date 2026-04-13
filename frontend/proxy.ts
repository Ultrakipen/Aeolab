import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const protectedPaths = [
    "/dashboard", "/guide", "/schema", "/history",
    "/competitors", "/settings", "/startup", "/ad-defense",
    "/onboarding", "/growth", "/review-inbox", "/preview",
    "/notices", "/faq",
  ];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  const pathname = request.nextUrl.pathname;

  // 비로그인 사용자 → 보호 경로 접근 시 /login 리다이렉트
  if (!session && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
      redirectResponse.cookies.set(name, value, rest);
    });
    return redirectResponse;
  }

  // 로그인된 사용자 → /login, /signup 접근 시 /dashboard 리다이렉트
  if (session && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // layout.tsx 서버 컴포넌트에서 현재 pathname 접근 가능하도록 헤더 전달
  supabaseResponse.headers.set("x-pathname", pathname);

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/guide/:path*",
    "/schema/:path*",
    "/history/:path*",
    "/competitors/:path*",
    "/settings/:path*",
    "/startup/:path*",
    "/ad-defense/:path*",
    "/onboarding/:path*",
    "/onboarding",
    "/growth/:path*",
    "/review-inbox/:path*",
    "/preview/:path*",
    "/notices/:path*",
    "/faq/:path*",
    "/login",
    "/signup",
    // public 경로도 포함 — 세션 쿠키 갱신 및 서버 컴포넌트에서 user 조회 정상 동작
    "/",
    "/pricing",
    "/pricing/:path*",
    "/trial",
    "/trial/:path*",
    "/demo",
    "/demo/:path*",
  ],
};
