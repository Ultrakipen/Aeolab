"use client";
import { useState } from "react";
import { apiBase } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import { getScoreTextLabel } from "@/lib/scoreLabels";

interface AdDefenseGuide {
  situation_summary?: string;
  risk_level?: string;
  // steps는 신규 구조화 형식(2026-09-02), description은 그 이전 저장된 가이드용
  // 하위호환 — steps가 있으면 체크리스트형 목록으로, 없으면 description을 문단으로 렌더링
  organic_strategies?: Array<{ title: string; summary?: string; steps?: string[]; description?: string; priority: string }>;
  content_actions?: string[];
  schema_recommendations?: string[];
  timeline?: string;
}

interface AdDefenseResult {
  id?: string;
  business_name: string;
  current_score: number;
  chatgpt_mentioned: boolean;
  chatgpt_measured?: boolean;
  exposure_freq: number;
  sample_size?: number;
  // global_channel_score는 다음 비교용 원시 점수 — 화면에 숫자로 직접 표시하지 않는다
  // (점수 표시 텍스트전용 원칙). momentum 텍스트 레이블만 사용할 것.
  momentum?: "improved" | "declined" | "steady" | null;
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

const MOMENTUM_LABELS: Record<string, { text: string; className: string }> = {
  improved: { text: "지난 가이드 대비 개선 중", className: "text-emerald-700 bg-emerald-50" },
  declined: { text: "지난 가이드 대비 다소 낮아짐", className: "text-amber-700 bg-amber-50" },
  steady: { text: "지난 가이드 대비 변화 적음", className: "text-gray-600 bg-gray-100" },
};

// "현재 상황" 3칸이 ChatGPT 카드만 상태별 배경색이 있고 나머지 2칸은 항상 회색이라
// 한 줄 안에서 시각 언어가 일관되지 않던 문제 수정(2026-09-02) — 나머지 2칸도 같은
// 방식(상태 반영 배경색)으로 통일. 임계값은 DashboardHeroCard.getStage()와 동일(75/55/30).
function scoreStatusBg(score: number): string {
  if (score >= 75) return "bg-emerald-50";
  if (score >= 55) return "bg-blue-50";
  if (score >= 30) return "bg-amber-50";
  return "bg-gray-50";
}
function geminiExposureBg(freq: number, sampleSize: number): string {
  if (sampleSize <= 0) return "bg-gray-50";
  const ratio = freq / sampleSize;
  if (ratio >= 0.3) return "bg-emerald-50";
  if (ratio > 0) return "bg-amber-50";
  return "bg-red-50";
}

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
  lastResultByBiz = {},
  initialBizId,
}: {
  businesses: Array<{ id: string; name: string }>;
  lastScanByBiz?: Record<string, string>;
  lastResultByBiz?: Record<string, { result: AdDefenseResult; checklistDone: number[]; generatedAt: string }>;
  initialBizId?: string;
}) {
  const startBizId = initialBizId ?? businesses[0]?.id ?? "";
  const [bizId, setBizId] = useState(startBizId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdDefenseResult | null>(lastResultByBiz[startBizId]?.result ?? null);
  const [resultSavedAt, setResultSavedAt] = useState<string | null>(lastResultByBiz[startBizId]?.generatedAt ?? null);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(
    new Set(lastResultByBiz[startBizId]?.checklistDone ?? [])
  );
  const [error, setError] = useState("");

  const lastScanDate = lastScanByBiz[bizId];
  const scanDays = lastScanDate ? daysAgo(lastScanDate) : null;

  function handleBizChange(nextBizId: string) {
    setBizId(nextBizId);
    setError("");
    // 사업장 전환 시 이전 사업장 결과가 그대로 남아있으면(라벨 없이) 다른 사업장의
    // 가이드로 오인될 수 있어, 전환한 사업장의 저장된 결과(없으면 빈 화면)로 교체
    setResult(lastResultByBiz[nextBizId]?.result ?? null);
    setResultSavedAt(lastResultByBiz[nextBizId]?.generatedAt ?? null);
    setCheckedItems(new Set(lastResultByBiz[nextBizId]?.checklistDone ?? []));
  }

  async function toggleCheck(index: number) {
    if (!result?.id) return;
    const next = new Set(checkedItems);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setCheckedItems(next);
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      await fetch(`${apiBase}/api/guide/${result.id}/checklist`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ done: [...next] }),
      });
    } catch {
      // 체크 상태는 이미 낙관적으로 반영됨 — 저장 실패해도 화면 경험은 유지, 재체크 시 재시도됨
    }
  }

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
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const code = body?.detail?.code;
        const message = body?.detail?.message;
        if (code === "AD_DEFENSE_LIMIT_EXCEEDED") {
          setError(`이번 달 AI 광고 대비 가이드 생성 한도(${body.detail.limit ?? ""}회)를 초과했습니다. 요금제 페이지에서 업그레이드하세요.`);
        } else if (code === "AD_DEFENSE_GENERATION_IN_PROGRESS") {
          setError("이미 가이드 생성이 진행 중입니다. 완료 후 다시 시도해주세요.");
        } else if (message) {
          setError(message);
        } else {
          throw new Error("API 오류");
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setResult(data);
      setResultSavedAt(null); // 방금 생성한 결과 — "저장된 결과" 배지 미노출
      setCheckedItems(new Set()); // 새로 생성된 가이드 — 이전 체크 상태 이월 안 함
    } catch {
      setError("가이드 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
    <div className="max-w-3xl">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">AI 광고 대비 가이드</h1>
      <p className="text-base text-gray-500 mb-5">
        이미 도입되어 확대되고 있는 ChatGPT 광고 속 유기적 AI 노출을 유지하는 전략을 제공합니다.
      </p>

      {/* 배경 설명 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
        <p className="text-sm text-blue-800 leading-relaxed">
          <span className="font-semibold">왜 지금 대비해야 할까요?</span>{" "}
          ChatGPT 광고는 2026년 8월 11일부터 한국에서도 노출이 시작됐습니다(무료·Go 등급 사용자 대상).
          유료 광고가 AI 답변 아래 "Sponsored" 카드로 끼어들 수 있는 만큼, 지금 유기적 노출 경쟁력을
          높여두면 광고 없이도 AI 검색 상위에 지속 노출될 수 있습니다.
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
            onChange={(e) => handleBizChange(e.target.value)}
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
    </div>

      {result && (
        // PC(lg 1024px+)에서는 화면 폭을 활용해 좌(핵심 전략)/우(참고 자료) 2단으로 배치.
        // 그 아래 화면폭에서는 기존처럼 세로 1단 스택(2026-09-02 재설계 — 이전엔 1400px
        // 화면에서도 본문이 항상 ~660px 단일 컬럼이라 오른쪽이 여백으로 낭비되고 있었음)
        <div className="lg:grid lg:grid-cols-[1.65fr_1fr] lg:gap-6 lg:items-start">
        <div className="min-w-0">
          {/* 현황 요약 */}
          <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="text-base font-semibold text-gray-700">현재 상황</h2>
              {resultSavedAt && (
                <span className="text-sm text-gray-500">
                  마지막 생성 결과 · {formatScanDate(resultSavedAt)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className={`text-center p-4 rounded-xl ${scoreStatusBg(result.current_score)}`}>
                <div className="text-lg md:text-xl font-bold text-gray-900">{getScoreTextLabel(result.current_score)}</div>
                <div className="text-sm text-gray-500 mt-1">AI 노출 상태</div>
              </div>
              <div className={`text-center p-4 rounded-xl ${result.sample_size === 0 ? "bg-gray-50" : geminiExposureBg(result.exposure_freq, result.sample_size ?? 0)}`}>
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
            {(result.guide.risk_level || result.momentum) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.guide.risk_level && (
                  <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${RISK_COLORS[result.guide.risk_level] ?? "bg-gray-100"}`}>
                    광고 리스크: {RISK_LABELS[result.guide.risk_level] ?? result.guide.risk_level}
                  </span>
                )}
                {result.momentum && MOMENTUM_LABELS[result.momentum] && (
                  <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${MOMENTUM_LABELS[result.momentum].className}`}>
                    {MOMENTUM_LABELS[result.momentum].text}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* 유기적 전략 */}
          {result.guide.organic_strategies && (
            <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-700">유기적 노출 강화 전략</h2>
                {result.id && (
                  <span className="text-sm text-gray-500">
                    {checkedItems.size}/{result.guide.organic_strategies.length} 실행 완료
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {result.guide.organic_strategies.map((s, i) => (
                  <label
                    key={i}
                    className={`flex gap-3 border-l-4 pl-4 py-2.5 ${PRIORITY_COLORS[s.priority] ?? "border-l-gray-300"} ${result.id ? "cursor-pointer" : ""}`}
                  >
                    {result.id && (
                      <input
                        type="checkbox"
                        checked={checkedItems.has(i)}
                        onChange={() => toggleCheck(i)}
                        className="mt-1 w-5 h-5 shrink-0 accent-blue-600"
                      />
                    )}
                    <div className="min-w-0">
                      <p className={`text-base font-semibold ${checkedItems.has(i) ? "text-gray-400 line-through" : "text-gray-900"}`}>{s.title}</p>
                      {/* steps(신규, 배열)가 있으면 실제 목록으로 렌더링 — 없으면(과거 저장된
                          가이드) description 문단을 그대로 표시(하위호환, 2026-09-02) */}
                      {s.steps && s.steps.length > 0 ? (
                        <>
                          {s.summary && (
                            <p className={`text-sm mt-0.5 leading-relaxed ${checkedItems.has(i) ? "text-gray-400" : "text-gray-600"}`}>{s.summary}</p>
                          )}
                          <ul className="mt-1.5 space-y-1">
                            {s.steps.map((step, si) => (
                              <li key={si} className={`text-sm leading-relaxed flex gap-1.5 ${checkedItems.has(i) ? "text-gray-400" : "text-gray-600"}`}>
                                <span className="shrink-0">·</span>{step}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        s.description && (
                          <p className={`text-sm mt-0.5 leading-relaxed ${checkedItems.has(i) ? "text-gray-400" : "text-gray-600"}`}>{s.description}</p>
                        )
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 참고 자료 — PC에서는 오른쪽 사이드 컬럼, 그 아래에서는 세로로 이어짐 */}
        <div className="space-y-4">
          {/* 콘텐츠 액션 + 스키마 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
            {result.guide.content_actions && (
              <section className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-700 mb-3">즉시 실행 액션</h2>
                <ul className="space-y-2.5">
                  {result.guide.content_actions.map((a, i) => (
                    <li key={i} className="text-sm md:text-base text-gray-700 flex gap-2 leading-relaxed">
                      <span className="text-blue-600 shrink-0 mt-0.5">→</span>{a}
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
                      <span className="text-green-700 shrink-0 mt-0.5">✓</span>{r}
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
        </div>
        </div>
      )}
    </div>
  );
}
