"use client";
import { useState } from "react";
import { apiBase } from "@/lib/api";

import { CATEGORY_GROUPS, CATEGORY_LABEL } from "@/lib/categories";

interface StartupReport {
  category: string;
  region: string;
  competitor_count: number;
  avg_competitor_score: number;
  competition_level: string;
  competition_level_color: string;
  competition_level_score: number;
  top_competitors: Array<{ name: string; score: number; exposure_freq: number }>;
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

export default function StartupPage() {
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
      const res = await fetch(`${apiBase}/api/startup/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">창업 시장 분석</h1>
      <p className="text-sm text-gray-500 mb-6">업종·지역 AI 노출 경쟁 강도 + 진입 전략 (창업 패키지 전용)</p>

      {/* 입력 폼 */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">업종</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORY_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">지역</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예: 서울 강남"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">예정 사업장명 (선택)</label>
          <input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="예: 강남 홍길동 식당"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "분석 중..." : "시장 분석 시작"}
        </button>
      </section>

      {/* 결과 */}
      {report && (
        <>
          {/* 경쟁 강도 */}
          <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">시장 현황</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">{report.competitor_count}</div>
                <div className="text-xs text-gray-500 mt-1">등록 사업장</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">{report.avg_competitor_score}</div>
                <div className="text-xs text-gray-500 mt-1">평균 AI 점수</div>
              </div>
              <div className={`text-center p-3 rounded-xl border ${LEVEL_COLORS[report.competition_level_color] ?? "bg-gray-50"}`}>
                <div className="text-lg font-bold">{report.competition_level}</div>
                <div className="text-xs mt-1">경쟁 강도</div>
              </div>
            </div>

            {report.top_competitors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">상위 경쟁사</p>
                <div className="space-y-2">
                  {report.top_competitors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{i + 1}. {c.name}</span>
                      <span className="text-gray-500">{c.score}점 (노출 {c.exposure_freq}/100)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 진입 전략 */}
          {report.strategy && (
            <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">AI 진입 전략</h2>
              {report.strategy.entry_strategy && (
                <p className="text-sm text-gray-700 mb-4">{report.strategy.entry_strategy}</p>
              )}
              {report.strategy.key_actions && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">핵심 액션</p>
                  <ul className="space-y-1">
                    {report.strategy.key_actions.map((a, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-blue-500 shrink-0">→</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.strategy.ai_optimization_tips && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">AI 최적화 팁</p>
                  <ul className="space-y-1">
                    {report.strategy.ai_optimization_tips.map((t, i) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-green-500 shrink-0">✓</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.strategy.risk_factors && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">주의사항</p>
                  <ul className="space-y-1">
                    {report.strategy.risk_factors.map((r, i) => (
                      <li key={i} className="text-sm text-orange-700 flex gap-2">
                        <span className="shrink-0">⚠</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.strategy.estimated_time_to_visibility && (
                <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
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
