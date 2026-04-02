"use client";
import { useState } from "react";
import { apiBase } from "@/lib/api";

interface AdDefenseGuide {
  situation_summary?: string;
  risk_level?: string;
  organic_strategies?: Array<{ title: string; description: string; priority: string }>;
  content_actions?: string[];
  schema_recommendations?: string[];
  timeline?: string;
}

interface AdDefenseResult {
  business_name: string;
  current_score: number;
  chatgpt_mentioned: boolean;
  exposure_freq: number;
  guide: AdDefenseGuide;
}

const RISK_COLORS: Record<string, string> = {
  low: "text-green-700 bg-green-50",
  medium: "text-yellow-700 bg-yellow-50",
  high: "text-red-700 bg-red-50",
};

const RISK_LABELS: Record<string, string> = { low: "낮음", medium: "보통", high: "높음" };
const PRIORITY_COLORS: Record<string, string> = {
  high: "border-l-red-500", medium: "border-l-yellow-500", low: "border-l-gray-300",
};

export function AdDefenseClient({ businesses }: { businesses: Array<{ id: string; name: string }> }) {
  const [bizId, setBizId] = useState(businesses[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdDefenseResult | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!bizId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${apiBase}/api/guide/ad-defense/${bizId}`,
        { method: "POST", credentials: "include" }
      );
      if (res.status === 403) {
        setError("Basic 이상의 구독이 필요합니다.");
        return;
      }
      if (!res.ok) throw new Error("API 오류");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("가이드 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">ChatGPT 광고 대응 가이드</h1>
      <p className="text-sm text-gray-500 mb-6">
        ChatGPT SearchGPT 광고 도입 시 유기적 AI 노출을 유지하는 전략을 제공합니다.
      </p>

      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">사업장 선택</label>
          <select
            value={bizId}
            onChange={(e) => setBizId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading || !bizId}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "가이드 생성 중..." : "광고 대응 가이드 생성"}
        </button>
      </section>

      {result && (
        <>
          {/* 현황 요약 */}
          <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">현재 상황</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">{result.current_score.toFixed(0)}</div>
                <div className="text-sm text-gray-500 mt-1">AI 점수</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <div className="text-2xl font-bold text-gray-900">{result.exposure_freq}</div>
                <div className="text-sm text-gray-500 mt-1">Gemini 노출(/100)</div>
              </div>
              <div className={`text-center p-3 rounded-xl ${result.chatgpt_mentioned ? "bg-green-50" : "bg-red-50"}`}>
                <div className={`text-lg font-bold ${result.chatgpt_mentioned ? "text-green-700" : "text-red-700"}`}>
                  {result.chatgpt_mentioned ? "언급됨" : "미언급"}
                </div>
                <div className="text-sm text-gray-500 mt-1">ChatGPT</div>
              </div>
            </div>

            {result.guide.situation_summary && (
              <p className="text-sm text-gray-700">{result.guide.situation_summary}</p>
            )}
            {result.guide.risk_level && (
              <div className="mt-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${RISK_COLORS[result.guide.risk_level] ?? "bg-gray-100"}`}>
                  광고 리스크: {RISK_LABELS[result.guide.risk_level] ?? result.guide.risk_level}
                </span>
              </div>
            )}
          </section>

          {/* 유기적 전략 */}
          {result.guide.organic_strategies && (
            <section className="bg-white rounded-2xl p-6 shadow-sm mb-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">유기적 노출 강화 전략</h2>
              <div className="space-y-3">
                {result.guide.organic_strategies.map((s, i) => (
                  <div
                    key={i}
                    className={`border-l-4 pl-3 py-1 ${PRIORITY_COLORS[s.priority] ?? "border-l-gray-300"}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{s.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 콘텐츠 액션 + 스키마 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {result.guide.content_actions && (
              <section className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">즉시 실행 액션</h2>
                <ul className="space-y-2">
                  {result.guide.content_actions.map((a, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-blue-500 shrink-0">→</span>{a}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.guide.schema_recommendations && (
              <section className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Schema 권장사항</h2>
                <ul className="space-y-2">
                  {result.guide.schema_recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-green-500 shrink-0">✓</span>{r}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {result.guide.timeline && (
            <section className="bg-blue-50 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-blue-700 mb-2">실행 로드맵</h2>
              <p className="text-sm text-blue-700">{result.guide.timeline}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
