"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Mail } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
    });
    if (error) {
      if (error.message?.includes("security purposes") || error.message?.includes("rate") || error.status === 429) {
        setError("잠시 후 다시 시도해주세요. (60초에 1회만 요청 가능)");
      } else {
        setError("이메일 발송에 실패했습니다. 다시 시도해주세요.");
      }
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  };

  if (done) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm text-center">
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm">
              <Mail className="w-10 h-10 text-blue-400 mx-auto mb-4" strokeWidth={1.5} />
              <h2 className="text-lg font-bold text-gray-900 mb-2">이메일을 확인해주세요</h2>
              <p className="text-base text-gray-500 mb-6">
                <span className="font-medium text-gray-700">{email}</span>으로<br />
                비밀번호 재설정 링크를 발송했습니다.
              </p>
              <Link
                href="/login"
                className="block w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors"
              >
                로그인 페이지로
              </Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold text-blue-600">AEOlab</Link>
            <p className="text-base text-gray-500 mt-2">비밀번호 찾기</p>
          </div>
          <form onSubmit={handleReset} className="bg-white rounded-xl p-6 shadow-sm space-y-5">
            <h1 className="text-xl font-bold text-gray-900 text-center">비밀번호 재설정</h1>
            <p className="text-base text-gray-500">
              가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
            </p>
            <div>
              <label className="block text-base font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                placeholder="가입한 이메일 주소"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-base text-red-600">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {loading ? "발송 중..." : "재설정 링크 발송"}
            </button>
          </form>
          <p className="text-center text-base text-gray-500 mt-4">
            <Link href="/login" className="text-blue-600 hover:underline">로그인으로 돌아가기</Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
