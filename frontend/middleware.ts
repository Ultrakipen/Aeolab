import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // x-pathname을 요청 헤더에 추가 — 서버 컴포넌트에서 headers()로 읽으려면
  // 응답 헤더가 아닌 요청 헤더에 설정해야 함
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser()는 항상 서버에서 JWT 검증 — getSession()의 "insecure" 경고 없음
  // Invalid Refresh Token 등 에러는 catch로 비로그인 처리
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    user = null;
  }

  const protectedPaths = [
    "/dashboard", "/guide", "/schema", "/history",
    "/competitors", "/settings", "/startup", "/ad-defense",
    "/onboarding", "/growth", "/review-inbox", "/preview",
    "/notices", "/support",
  ];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  const pathname = request.nextUrl.pathname;

  // 비로그인 사용자 → 보호 경로 접근 시 /login 리다이렉트
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
      redirectResponse.cookies.set(name, value, rest);
    });
    return redirectResponse;
  }

  // 로그인된 사용자 → /login, /signup 접근 시 /dashboard 리다이렉트
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 로그인된 사용자가 대시보드 진입 시 사업장 등록 여부 확인 (layout blocking 방지)
  if (user && isProtected && !pathname.startsWith("/onboarding")) {
    try {
      const [bizRes, profileRes] = await Promise.all([
        supabase
          .from("businesses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("onboarding_done")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const bizCount = bizRes.count ?? 0;
      const onboardingDone = profileRes.data?.onboarding_done ?? false;
      if (bizCount === 0 && !onboardingDone) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
          redirectResponse.cookies.set(name, value, rest);
        });
        return redirectResponse;
      }
    } catch {
      // 조회 실패 시 통과 (layout에서 재처리)
    }
  }

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
    "/support/:path*",
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
