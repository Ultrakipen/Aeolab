"use client";

import { useState, useRef } from "react";
import { Sparkles, Loader2 } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const CATEGORY_OPTIONS = [
  { value: "restaurant", label: "음식점" },
  { value: "cafe", label: "카페" },
  { value: "bakery", label: "베이커리" },
  { value: "beauty", label: "미용·뷰티" },
  { value: "nail", label: "네일샵" },
  { value: "fitness", label: "헬스·운동" },
  { value: "yoga", label: "요가·필라테스" },
  { value: "medical", label: "병원·의원" },
  { value: "pharmacy", label: "약국" },
  { value: "pet", label: "반려동물" },
  { value: "education", label: "교육·학원" },
  { value: "legal", label: "법률" },
  { value: "realestate", label: "부동산" },
  { value: "interior", label: "인테리어" },
  { value: "accommodation", label: "숙박·펜션" },
  { value: "other", label: "기타" },
];

const COOLDOWN_S = 10;

export default function InlineKeywordWidget() {
  const [category, setCategory] = useState("restaurant");
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldown(COOLDOWN_S);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleGenerate = async () => {
    if (!name.trim() || loading || cooldown > 0) return;
    setLoading(true);
    setError(null);
    setKeywords([]);
    try {
      const params = new URLSearchParams({ business_name: name.trim(), category });
      const res = await fetch(`${BACKEND}/api/businesses/keyword-suggest-preview?${params}`);
      if (!res.ok) {
        if (res.status === 429) {
          setError("잠시 후 다시 시도해주세요 (요청 한도 초과)");
        } else {
          setError("키워드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
        return;
      }
      const data = await res.json();
      const raw: unknown[] = data?.keywords ?? data?.suggested_keywords ?? [];
      setKeywords(raw.map(String).filter(Boolean).slice(0, 10));
      startCooldown();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="px-4 py-10 md:py-14" style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
      <div className="max-w-[680px] mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-5">
          <span
            className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full mb-3"
            style={{ background: "#EFF6FF", color: "#1D4ED8" }}
          >
            <Sparkles size={13} /> 무료 · 가입 불필요
          </span>
          <h2
            className="text-xl md:text-2xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.5px" }}
          >
            내 사업장 키워드, AI가 바로 제안해드립니다
          </h2>
          <p className="text-sm mt-1.5 break-keep" style={{ color: "#475569" }}>
            업종과 가게 이름만 입력하면 네이버·AI 검색 노출에 맞는 키워드 추천
          </p>
        </div>

        {/* 입력 폼 */}
        <div className="bg-white rounded-xl border p-4 md:p-5 shadow-sm" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            {/* 업종 선택 */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: "#D1D5DB", color: "#1E293B", minWidth: "120px" }}
              aria-label="업종 선택"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 사업장명 입력 */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="사업장 이름 (예: 홍대 카페봄)"
              maxLength={40}
              className="flex-1 text-sm border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: "#D1D5DB", color: "#1E293B" }}
              aria-label="사업장 이름 입력"
            />

            {/* 생성 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={!name.trim() || loading || cooldown > 0}
              className="flex items-center justify-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: "#2563EB", whiteSpace: "nowrap" }}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> 생성 중</>
              ) : cooldown > 0 ? (
                `${cooldown}초 후 재시도`
              ) : (
                <><Sparkles size={14} /> 키워드 생성</>
              )}
            </button>
          </div>

          {/* 에러 */}
          {error && (
            <p className="text-sm text-red-500 mb-2">{error}</p>
          )}

          {/* 결과 */}
          {keywords.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: "#374151" }}>
                추천 키워드 {keywords.length}개
              </p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => navigator.clipboard.writeText(kw).catch(() => {})}
                    title="클릭하여 복사"
                    className="text-sm px-2.5 py-1 rounded-full transition-colors hover:bg-blue-100"
                    style={{ background: "#EFF6FF", color: "#1D4ED8" }}
                  >
                    {kw}
                  </button>
                ))}
              </div>
              <p className="text-sm mt-2" style={{ color: "#94A3B8" }}>
                키워드를 클릭하면 복사됩니다 · 더 많은 키워드와 상세 분석은 무료 진단에서 제공됩니다
              </p>
            </div>
          )}
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-sm mt-3 break-keep" style={{ color: "#64748B" }}>
          AI 학습 데이터 기반 추천 · 실제 검색 순위와 다를 수 있음
        </p>
      </div>
    </section>
  );
}
