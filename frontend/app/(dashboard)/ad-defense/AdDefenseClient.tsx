"use client";
import { useState } from "react";
import { apiBase } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import { getScoreTextLabel } from "@/lib/scoreLabels";

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
  chatgpt_measured?: boolean;
  exposure_freq: number;
  sample_size?: number;
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

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatScanDate(dateStr: string): string {
  const days = daysAgo(dateStr);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

export function AdDefenseClient({
  businesses,
  lastScanByBiz = {},
}: {
  businesses: Array<{ id: string; name: string }>;
  lastScanByBiz?: Record<string, string>;
}) {
  const [bizId, setBizId] = useState(businesses[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdDefenseResult | null>(null);
  const [error, setError] = useState("");

  const lastScanDate = lastScanByBiz[bizId];
  const scanDays = lastScanDate ? daysAgo(lastScanDate) : null;

  async function handleGenerate() {
    if (!bizId) return;
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
      const res = await fetch(
        `${apiBase}/api/guide/ad-defense/${bizId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.status === 403) {
        setError("Pro 이상 구독이 필요합니다. 요금제 페이지에서 업그레이드하세요.");
        setLoading(false);
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
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">AI 광고 대비 가이드</h1>
      <p className="text-base text-gray-500 mb-5">
        이미 도입되어 확대되고 있는 ChatGPT 광고 속 유기적 AI 노출을 유지하는 전략을 제공합니다.
      </p>

      {/* 배경 설명 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
        <p className="text-sm text-blue-800 leading-relaxed">
          <span className="font-semibold">왜 지금 대비해야 할까요?</span>{" "}
          ChatGPT에 광고가 도입되면 유료 광고가 AI 검색 결과를 밀어낼 수 있습니다.
          지금 유기적 노출 경쟁력을 높여두면 광고 없이도 AI 검색 상위에 지속 노출될 수 있습니다.
        </p>
      </div>

      {/* 사용 방법 3단계 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 mb-6">
        {[
          { step: "1", label: "사업장 선택", desc: "분석할 가게를 선택하세요" },
          { step: "2", label: "가이드 생성", desc: "AI가 10~20초 분석합니다" },
          { step: "3", label: "전략 실행", desc: "우선순위대로 실행하세요" },
        ].map(({ step, label, desc }) => (
          <div key={step} className="bg-white rounded-xl p-3 md:p-4 shadow-sm text-center">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-2">
              {step}
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-0.5">{label}</div>
            <div className="text-sm text-gray-500 leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      {/* 생성 폼 */}
      <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">사업장 선택</label>
          <select
            value={bizId}
            onChange={(e) => setBizId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* 스캔 신선도 */}
          <div className="mt-2">
            {scanDays === null ? (
              <p className="text-sm text-amber-700 flex items-center gap-1">
                <span>⚠</span>
                <span>
                  스캔 데이터 없음 —{" "}
                  <a href="/dashboard" className="underline hover:text-amber-700">스캔 먼저 실행</a>
                  하면 더 정확한 가이드가 만들어집니다
                </span>
              </p>
            ) : scanDays > 30 ? (
              <p className="text-sm text-amber-700 flex items-center gap-1">
                <span>⚠</span>
                <span>마지막 스캔 {formatScanDate(lastScanDate!)} — 재스캔하면 최신 데이터로 가이드가 개선됩니다</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <span>✓</span>
                <span>마지막 스캔 {formatScanDate(lastScanDate!)}</span>
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading || !bizId}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4 text-white shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          {loading ? "가이드 생성 중 (10~20초)..." : "광고 대응 가이드 생성"}
        </button>
      </section>

      {result && (
        <>
          {/* 현황 요약 */}
          <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
            <h2 className="text-base font-semibold text-gray-700 mb-3">현재 상황</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="text-lg md:text-xl font-bold text-gray-900">{getScoreTextLabel(result.current_score)}</div>
                <div className="text-sm text-gray-500 mt-1">AI 노출 상태</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                {result.sample_size === 0 ? (
                  <div className="text-lg md:text-xl font-bold text-gray-500">측정 실패</div>
                ) : (
                  <div className="text-2xl md:text-3xl font-bold text-gray-900">{result.exposure_freq}</div>
                )}
                <div className="text-sm text-gray-500 mt-1">
                  {result.sample_size === 0 ? "Gemini 언급 (이번 스캔 측정 안 됨)" : `Gemini 언급(/${result.sample_size ?? 50}회 중)`}
                </div>
              </div>
              {result.chatgpt_measured === false ? (
                <div className="text-center p-4 rounded-xl bg-gray-50">
                  <div className="text-lg md:text-xl font-bold text-gray-500">측정 실패</div>
                  <div className="text-sm text-gray-500 mt-1">ChatGPT</div>
                </div>
              ) : (
                <div className={`text-center p-4 rounded-xl ${result.chatgpt_mentioned ? "bg-green-50" : "bg-red-50"}`}>
                  <div className={`text-xl font-bold ${result.chatgpt_mentioned ? "text-green-700" : "text-red-700"}`}>
                    {result.chatgpt_mentioned ? "언급됨" : "미언급"}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">ChatGPT</div>
                </div>
              )}
            </div>

            {result.guide.situation_summary && (
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">{result.guide.situation_summary}</p>
            )}
            {result.guide.risk_level && (
              <div className="mt-3">
                <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${RISK_COLORS[result.guide.risk_level] ?? "bg-gray-100"}`}>
                  광고 리스크: {RISK_LABELS[result.guide.risk_level] ?? result.guide.risk_level}
                </span>
              </div>
            )}
          </section>

          {/* 유기적 전략 */}
          {result.guide.organic_strategies && (
            <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
              <h2 className="text-base font-semibold text-gray-700 mb-3">유기적 노출 강화 전략</h2>
              <div className="space-y-3">
                {result.guide.organic_strategies.map((s, i) => (
                  <div
                    key={i}
                    className={`border-l-4 pl-4 py-2 ${PRIORITY_COLORS[s.priority] ?? "border-l-gray-300"}`}
                  >
                    <p className="text-base font-semibold text-gray-900">{s.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{s.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 콘텐츠 액션 + 스키마 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {result.guide.content_actions && (
              <section className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-700 mb-3">즉시 실행 액션</h2>
                <ul className="space-y-2.5">
                  {result.guide.content_actions.map((a, i) => (
                    <li key={i} className="text-sm md:text-base text-gray-700 flex gap-2 leading-relaxed">
                      <span className="text-blue-500 shrink-0 mt-0.5">→</span>{a}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.guide.schema_recommendations && (
              <section className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-700 mb-3">AI 정보 등록 권장사항</h2>
                <ul className="space-y-2.5">
                  {result.guide.schema_recommendations.map((r, i) => (
                    <li key={i} className="text-sm md:text-base text-gray-700 flex gap-2 leading-relaxed">
                      <span className="text-green-500 shrink-0 mt-0.5">✓</span>{r}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {result.guide.timeline && (
            <section className="bg-blue-50 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-blue-700 mb-2">실행 로드맵</h2>
              <p className="text-sm text-blue-700">{result.guide.timeline}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
