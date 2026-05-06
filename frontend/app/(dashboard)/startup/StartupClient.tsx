"use client";
import { useState } from "react";
import { apiBase } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import { CATEGORY_GROUPS } from "@/lib/categories";

interface StartupReport {
  category: string;
  region: string;
  competitor_count: number;
  avg_competitor_score: number;
  competition_level: string;
  competition_level_color: string;
  competition_level_score: number;
  top_competitors: Array<{ name: string; score: number; exposure_freq: number }>;
  timing?: {
    timing_label: string;
    timing_color: string;
    opportunity_score: number;
    reasoning: string;
  };
  strategy: {
    entry_strategy?: string;
    key_actions?: string[];
    ai_optimization_tips?: string[];
    risk_factors?: string[];
    estimated_time_to_visibility?: string;
  };
}

const LEVEL_COLORS: Record<string, string> = {
  red: "text-red-600 bg-red-50 border-red-200",
  orange: "text-orange-600 bg-orange-50 border-orange-200",
  yellow: "text-yellow-700 bg-yellow-50 border-yellow-200",
  green: "text-green-700 bg-green-50 border-green-200",
};

export function StartupClient() {
  const [category, setCategory] = useState("restaurant");
  const [region, setRegion] = useState("");
  const [bizName, setBizName] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StartupReport | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!region.trim()) { setError("지역을 입력해주세요"); return; }
    setLoading(true);
    setError("");
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      if (!token) {
        setError("로그인이 필요합니다. 페이지를 새로고침 후 다시 시도해주세요.");
        setLoading(false);
        return;
      }
      const res = await fetch(`${apiBase}/api/startup/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, region: region.trim(), business_name: bizName.trim() }),
      });
      if (res.status === 403) {
        setError("창업 패키지(startup) 이상의 구독이 필요합니다.");
        return;
      }
      const data = await res.json();
      setReport(data);
    } catch {
      setError("분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">창업 시장 분석</h1>
      <p className="text-sm text-gray-500 mb-6">업종·지역 AI 노출 경쟁 강도 + 진입 전략 (창업 패키지 전용)</p>

      {/* 입력 폼 */}
      <section className="bg-white rounded-2xl p-4 md:p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">업종</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {CATEGORY_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>{g.emoji} {g.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">지역</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예: 서울 강남"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">예정 사업장명 (선택)</label>
          <input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="예: 강남 홍길동 식당"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px] w-full sm:w-auto"
        >
          {loading ? "분석 중..." : "시장 분석 시작"}
        </button>
      </section>

      {/* 결과 */}
      {report && (
        <>
          {/* 경쟁 강도 */}
          <section className="bg-white rounded-2xl p-4 md:p-6 shadow-sm mb-4">
            <h2 className="text-base font-semibold text-gray-700 mb-4">시장 현황</h2>
            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-4">
              <div className="text-center p-3 md:p-4 bg-gray-50 rounded-xl">
                <div className="text-xl md:text-2xl font-bold text-gray-900">{report.competitor_count}</div>
                <div className="text-sm text-gray-500 mt-1">등록 사업장</div>
              </div>
              <div className="text-center p-3 md:p-4 bg-gray-50 rounded-xl">
                <div className="text-xl md:text-2xl font-bold text-gray-900">{report.avg_competitor_score}</div>
                <div className="text-sm text-gray-500 mt-1">평균 AI 점수</div>
              </div>
              <div className={`text-center p-3 md:p-4 rounded-xl border ${LEVEL_COLORS[report.competition_level_color] ?? "bg-gray-50"}`}>
                <div className="text-base md:text-lg font-bold">{report.competition_level}</div>
                <div className="text-sm mt-1">경쟁 강도</div>
              </div>
            </div>

            {/* 창업 타이밍 지수 */}
          {report.timing && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-600 mb-2">창업 타이밍 지수</p>
              <div className={`rounded-xl p-4 ${report.timing.timing_color === "emerald" ? "bg-emerald-50 border border-emerald-200" : report.timing.timing_color === "blue" ? "bg-blue-50 border border-blue-200" : report.timing.timing_color === "red" ? "bg-red-50 border border-red-200" : report.timing.timing_color === "amber" ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base font-bold">{report.timing.timing_label}</span>
                  <span className="text-sm px-2 py-0.5 bg-white rounded-full font-medium">
                    기회지수 {report.timing.opportunity_score}점
                  </span>
                </div>
                <p className="text-sm md:text-base text-gray-600 leading-relaxed">{report.timing.reasoning}</p>
              </div>
            </div>
          )}

          {report.top_competitors.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">상위 경쟁사</p>
                <div className="space-y-2.5">
                  {report.top_competitors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm md:text-base text-gray-700 font-medium">{i + 1}. {c.name}</span>
                      <span className="text-sm text-gray-500">{c.score}점 (노출 {c.exposure_freq}/100)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 진입 전략 */}
          {report.strategy && (
            <section className="bg-white rounded-2xl p-4 md:p-6 shadow-sm mb-4">
              <h2 className="text-base font-semibold text-gray-700 mb-3">AI 진입 전략</h2>
              {report.strategy.entry_strategy && (
                <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">{report.strategy.entry_strategy}</p>
              )}
              {report.strategy.key_actions && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-600 mb-2">핵심 액션</p>
                  <ul className="space-y-2">
                    {report.strategy.key_actions.map((a, i) => (
                      <li key={i} className="text-sm md:text-base text-gray-700 flex gap-2 leading-relaxed">
                        <span className="text-blue-500 shrink-0 mt-0.5">→</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.strategy.ai_optimization_tips && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-600 mb-2">AI 최적화 팁</p>
                  <ul className="space-y-2">
                    {report.strategy.ai_optimization_tips.map((t, i) => (
                      <li key={i} className="text-sm md:text-base text-gray-700 flex gap-2 leading-relaxed">
                        <span className="text-green-500 shrink-0 mt-0.5">✓</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.strategy.risk_factors && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-600 mb-2">주의사항</p>
                  <ul className="space-y-2">
                    {report.strategy.risk_factors.map((r, i) => (
                      <li key={i} className="text-sm md:text-base text-orange-700 flex gap-2 leading-relaxed">
                        <span className="shrink-0 mt-0.5">⚠</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.strategy.estimated_time_to_visibility && (
                <div className="bg-blue-50 rounded-xl p-4 text-sm md:text-base text-blue-700">
                  예상 AI 노출 기간: {report.strategy.estimated_time_to_visibility}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
