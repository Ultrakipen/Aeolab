"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const CATEGORY_OPTIONS = [
  { value: "restaurant", label: "음식점" },
  { value: "cafe", label: "카페" },
  { value: "bakery", label: "베이커리" },
  { value: "bar", label: "바/술집" },
  { value: "beauty", label: "미용" },
  { value: "nail", label: "네일" },
  { value: "medical", label: "의료" },
  { value: "pharmacy", label: "약국" },
  { value: "fitness", label: "헬스" },
  { value: "yoga", label: "요가" },
  { value: "pet", label: "반려동물" },
  { value: "education", label: "교육" },
  { value: "tutoring", label: "학원" },
  { value: "legal", label: "법률" },
  { value: "realestate", label: "부동산" },
  { value: "interior", label: "인테리어" },
  { value: "auto", label: "자동차" },
  { value: "cleaning", label: "청소" },
  { value: "shopping", label: "쇼핑" },
  { value: "fashion", label: "패션" },
  { value: "photo", label: "사진" },
  { value: "video", label: "영상" },
  { value: "design", label: "디자인" },
  { value: "accommodation", label: "숙박" },
  { value: "other", label: "기타" },
];

const COOLDOWN_SECONDS = 3;

export default function KeywordToolPage() {
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleGenerate = async () => {
    if (!businessName.trim()) {
      setError("비즈니스명을 입력해주세요.");
      return;
    }
    if (cooldown > 0 || loading) return;

    setLoading(true);
    setError(null);
    setKeywords([]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/businesses/keyword-suggest-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_name: businessName.trim(), category }),
      });

      if (res.status === 429) {
        setError("잠시 후 다시 시도해주세요. (분당 3회 제한)");
        startCooldown();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "키워드 생성에 실패했습니다.");
      }

      const data = await res.json();
      const kws: string[] = data.keywords ?? [];
      setKeywords(kws);
      startCooldown();
    } catch (err: unknown) {
      setError((err as Error).message ?? "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleGenerate();
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">무료 키워드 생성기</h1>
          </div>
          <p className="text-sm md:text-base text-gray-500">
            비즈니스명과 업종만 입력하면 AI가 SEO 키워드 5개를 추천합니다
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* 입력 폼 카드 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6 mb-6">
          <div className="space-y-4">
            {/* 비즈니스명 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                비즈니스명
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 강남 파스타 이탈리안"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder:text-gray-400"
              />
            </div>

            {/* 업종 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                업종
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition bg-white"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 오류 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={loading || cooldown > 0 || !businessName.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  키워드 생성 중...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  {cooldown}초 후 다시 생성 가능
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  키워드 생성
                </>
              )}
            </button>

            {/* Rate limit 안내 */}
            <p className="text-sm text-gray-400 text-center">
              분당 3회 생성 가능 · 생성 후 {COOLDOWN_SECONDS}초 대기
            </p>
          </div>
        </div>

        {/* 결과 */}
        {keywords.length > 0 && (
          <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5 md:p-6 mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">
              추천 키워드
              <span className="ml-2 text-sm font-normal text-gray-400">{keywords.length}개</span>
            </h2>
            <div className="flex flex-wrap gap-2 mb-5">
              {keywords.map((kw, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-full border border-blue-100"
                >
                  {kw}
                </span>
              ))}
            </div>

            {/* CTA 박스 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm font-bold text-gray-900 mb-1">
                구독하면 최대 10개 키워드 + 순위 추적
              </p>
              <p className="text-sm text-gray-500 mb-3">
                매주 키워드 순위 자동 측정 · 상승/하락 알림 · 경쟁사 비교
              </p>
              <Link
                href="/pricing"
                className="inline-block px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
              >
                구독 시작하기 →
              </Link>
            </div>
          </div>
        )}

        {/* 하단 도구 링크 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">다른 무료 도구</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tools/ad-cost-calculator"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
            >
              광고비 절감 계산기
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/trial"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
            >
              무료 AI 노출 진단
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
