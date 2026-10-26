import { createClient } from "@/lib/supabase/server";
import { getPublicOrigin } from "@/lib/publicOrigin";
import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * 인증 메일 링크 처리 (2026-10-26 신설)
 *
 * 메일 링크: {SiteURL}/auth/confirm?token_hash=...&type=email|recovery|email_change&next=/경로
 * - 기존 /auth/callback 은 PKCE 코드 교환이라 "가입한 브라우저의 쿠키"가 있어야만 성공했다.
 *   휴대폰 메일 앱·다른 브라우저에서 링크를 열면 실패(auth_callback_failed)하므로,
 *   쿠키 없이도 되는 token_hash 방식(verifyOtp)으로 처리한다(Supabase SSR 권장 방식).
 * - 성공 시 세션 쿠키가 설정되고 next 로 이동, 실패 시 로그인 화면에서 안내.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getPublicOrigin(request);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // open redirect 방지: 내부 경로만 허용
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_link_failed`);
}
