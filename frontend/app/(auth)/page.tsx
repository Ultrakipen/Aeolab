"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic (월 9,900원)",
  startup: "창업 패키지 (월 12,900원)",
  pro: "Pro (월 18,900원)",
  biz: "Biz (월 39,900원)",
};

function SignupForm() {
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") ?? "";
  const amountParam = searchParams.get("amount") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setError("필수 약관에 동의해주세요.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/dashboard`,
        data: { marketing_agreed: agreeMarketing },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    setDone(true);
  };

  const handleResend = async () => {
    setResending(true);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResendDone(true);
    setTimeout(() => setResendDone(false), 10000);
  };

  // 이메일 인증 발송 완료 화면
  if (done) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Mail className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">이메일을 확인해주세요</h2>
            <p className="text-base text-gray-600 mb-2">
              <span className="font-medium text-gray-900 break-all">{email}</span>
            </p>
            <p className="text-base text-gray-500 mb-2">으로 인증 링크를 발송했습니다.</p>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              링크를 클릭하면 자동으로 로그인됩니다.<br />
              메일이 오지 않으면 스팸함을 확인해주세요.
            </p>
            {resendDone ? (
              <p className="text-sm text-green-600 font-medium mb-4">✓ 인증 메일을 다시 발송했습니다.</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-blue-500 hover:underline disabled:opacity-50 mb-4"
              >
                {resending ? "발송 중..." : "인증 메일 재발송"}
              </button>
            )}
            {planParam && amountParam && (
              <div className="bg-blue-50 text-blue-700 text-base rounded-xl p-4 mb-5">
                인증 완료 후 <strong>{PLAN_LABELS[planParam]}</strong> 결제가 진행됩니다.
              </div>
            )}
            <Link
              href="/login"
              className="block w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors"
            >
              로그인 페이지로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-blue-600">AEOlab</Link>
          <p className="text-base text-gray-500 mt-2">AI 검색 노출 관리 서비스</p>
          {planParam && PLAN_LABELS[planParam] && (
            <div className="mt-3 bg-blue-50 text-blue-700 text-sm px-4 py-2 rounded-full inline-block font-medium">
              {PLAN_LABELS[planParam]} 가입
            </div>
          )}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSignup} className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
          <h1 className="text-xl font-bold text-gray-900 text-center">회원가입</h1>

          <div>
            <label className="block text-base font-medium text-gray-700 mb-1.5">
              이메일 <span className="text-blue-600">*</span>
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-gray-700 mb-1.5">
              비밀번호 <span className="text-blue-600">*</span>
              <span className="text-sm font-normal text-gray-400 ml-1">(8자 이상)</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상 입력"
              className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-gray-700 mb-1.5">
              비밀번호 확인 <span className="text-blue-600">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호를 다시 입력"
              className={`w-full border rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 ${
                passwordConfirm && password !== passwordConfirm
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
            />
            {passwordConfirm && password !== passwordConfirm && (
              <p className="text-base text-red-500 mt-1.5">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          {/* 약관 동의 */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3.5 bg-gray-50">
            {/* 전체 동의 */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms && agreePrivacy && agreeMarketing}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  setAgreePrivacy(e.target.checked);
                  setAgreeMarketing(e.target.checked);
                }}
                className="w-5 h-5 accent-blue-600 shrink-0"
              />
              <span className="text-base font-semibold text-gray-800">전체 동의</span>
            </label>

            <div className="border-t border-gray-200" />

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-5 h-5 accent-blue-600 shrink-0"
              />
              <span className="text-base text-gray-700 flex-1">
                <span className="text-blue-600 font-medium">[필수]</span>{" "}
                <Link href="/terms" target="_blank" className="underline hover:text-blue-600">
                  이용약관
                </Link>{" "}
                동의
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="w-5 h-5 accent-blue-600 shrink-0"
              />
              <span className="text-base text-gray-700 flex-1">
                <span className="text-blue-600 font-medium">[필수]</span>{" "}
                <Link href="/privacy" target="_blank" className="underline hover:text-blue-600">
                  개인정보처리방침
                </Link>{" "}
                동의
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeMarketing}
                onChange={(e) => setAgreeMarketing(e.target.checked)}
                className="w-5 h-5 accent-blue-600 shrink-0"
              />
              <span className="text-base text-gray-700 leading-snug">
                <span className="text-gray-400 font-medium">[선택]</span>{" "}
                AI 노출 분석 리포트·서비스 소식 수신 동의
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-base text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50"
          >
            {loading ? "가입 중..." : planParam ? "가입 후 결제하기" : "무료로 시작하기"}
          </button>
        </form>

        {/* 하단 링크 */}
        <p className="text-center text-base text-gray-500 mt-5">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            로그인
          </Link>
        </p>
        <p className="text-center mt-3">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 홈으로
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
