"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/common/SiteFooter";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        setError("이메일 인증이 완료되지 않았습니다. 받은편지함의 인증 링크를 클릭해주세요.");
      } else if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (error.message.includes("Too many requests")) {
        setError("잠시 후 다시 시도해주세요. (요청이 너무 많습니다)");
      } else {
        setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-blue-600">AEOlab</Link>
          <p className="text-base text-gray-500 mt-2">AI 검색 노출 관리 서비스</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
          <h1 className="text-xl font-bold text-gray-900 text-center">로그인</h1>

          <div>
            <label className="block text-base font-medium text-gray-700 mb-1.5">이메일</label>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-base font-medium text-gray-700">비밀번호</label>
              <Link href="/reset-password" className="text-sm text-blue-500 hover:underline">
                비밀번호 찾기
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
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
            className="w-full bg-blue-600 text-white py-4 rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 mt-1 flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* 하단 링크 */}
        <p className="text-center text-base text-gray-500 mt-5">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-blue-600 font-medium hover:underline">
            무료 회원가입
          </Link>
        </p>
        <p className="text-center mt-3">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← 홈으로
          </Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
