"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic (월 9,900원)",
  pro: "Pro (월 29,900원)",
  biz: "Biz (월 79,900원)",
  startup: "창업 패키지 (3개월 39,900원)",
};

function SignupForm() {
  const router = useRouter();
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

  // 이메일 인증 발송 완료 화면
  if (done) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <Mail className="w-10 h-10 text-blue-400 mx-auto mb-4" strokeWidth={1.5} />
            <h2 className="text-lg font-bold text-gray-900 mb-2">이메일을 확인해주세요</h2>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-medium text-gray-700">{email}</span>으로<br />
              인증 링크를 발송했습니다.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              링크를 클릭하면 자동으로 로그인됩니다.<br />
              메일이 오지 않으면 스팸함을 확인해주세요.
            </p>
            {planParam && amountParam && (
              <div className="bg-blue-50 text-blue-700 text-xs rounded-xl p-3 mb-4">
                인증 완료 후 <strong>{PLAN_LABELS[planParam]}</strong> 결제가 진행됩니다.
              </div>
            )}
            <Link
              href="/login"
              className="block w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              로그인 페이지로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-blue-600">AEOlab</Link>
          <p className="text-gray-500 mt-2">회원가입</p>
          {planParam && PLAN_LABELS[planParam] && (
            <div className="mt-2 bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full inline-block">
              {PLAN_LABELS[planParam]} 가입
            </div>
          )}
        </div>

        <form onSubmit={handleSignup} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 * (8자 이상)</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="8자 이상 입력"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 *</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                passwordConfirm && password !== passwordConfirm
                  ? "border-red-400"
                  : "border-gray-300"
              }`}
              placeholder="비밀번호를 다시 입력"
            />
            {passwordConfirm && password !== passwordConfirm && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms && agreePrivacy && agreeMarketing}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  setAgreePrivacy(e.target.checked);
                  setAgreeMarketing(e.target.checked);
                }}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm font-semibold text-gray-800">전체 동의</span>
            </label>

            <div className="border-t border-gray-200" />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700 flex-1">
                <span className="text-blue-600 font-medium">[필수]</span>{" "}
                <Link href="/terms" target="_blank" className="underline hover:text-blue-600">
                  이용약관
                </Link>{" "}
                동의
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700 flex-1">
                <span className="text-blue-600 font-medium">[필수]</span>{" "}
                <Link href="/privacy" target="_blank" className="underline hover:text-blue-600">
                  개인정보처리방침
                </Link>{" "}
                동의
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeMarketing}
                onChange={(e) => setAgreeMarketing(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                <span className="text-gray-400 font-medium">[선택]</span>{" "}
                AI 노출 분석 리포트·서비스 소식 수신 동의
              </span>
            </label>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "가입 중..." : planParam ? "가입 후 결제하기" : "무료로 시작하기"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">로그인</Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <SignupForm />
    </Suspense>
  );
}
