"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { showsScoreDeltaBadge } from "@/lib/actionLabel";
import { changeDirection, deltaDirection, effectText, EFFECT_NOTE } from "@/lib/changeDirection";

interface DimensionChange {
  dimension: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  weighted_contribution: number;
}

interface ActionAttribution {
  action_date: string;
  action_type: string;
  action_label: string;
  score_before: number;
  score_after: number;
  delta: number;
  dimension_changes: DimensionChange[];
  attribution_text: string;
}

interface AttributionReport {
  attributions: ActionAttribution[];
  total_attributed_gain: number;
  top_effective_action: string | null;
  period_start_score: number;
  period_end_score: number;
  message?: string;
}

interface Props {
  bizId: string;
  authToken: string;
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "양호";
  if (score >= 55) return "보통";
  if (score >= 30) return "주의 필요";
  return "시작 전";
}

// 행동 전·후 비교(2026-11-02): 예전 ±0.5점·±5점 단계("소폭 향상/크게 하락")는 같은 가게의 일간 점수 변화(중앙값 3~4점)보다 작아 측정 오차를 변화로 말했다 → 공용 규칙.
// 하락도 경고색(빨강)이 아닌 주황 — 그 행동 때문이라고 단정할 수 없는 측정 비교다.
function DeltaBadge({ before, after }: { before: number; after: number }) {
  const dir = changeDirection(before, after) ?? "flat";
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const tone = dir === "up" ? "text-green-700 bg-green-50 border-green-200 font-bold"
    : dir === "down" ? "text-amber-800 bg-amber-50 border-amber-200 font-bold"
    : "text-gray-600 bg-gray-50 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-sm ${tone}`}>
      <Icon size={13} /> {effectText(dir)}
    </span>
  );
}

function getContributionLabel(contribution: number, maxAbs: number): string {
  const ratio = maxAbs > 0 ? Math.abs(contribution / maxAbs) : 0;
  if (contribution > 0) {
    if (ratio > 0.6) return "높은 기여";
    if (ratio > 0.3) return "기여";
    return "소폭 기여";
  } else {
    if (ratio > 0.6) return "큰 영향";
    if (ratio > 0.3) return "영향";
    return "소폭 영향";
  }
}

function DimBar({ change, maxAbs }: { change: DimensionChange; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.abs(change.weighted_contribution / maxAbs) * 100 : 0;
  const positive = change.delta > 0;
  const contribLabel = getContributionLabel(change.weighted_contribution, maxAbs);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 text-gray-600 truncate shrink-0">{change.label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${positive ? "bg-green-400" : "bg-red-400"}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <span className={`w-20 text-right text-sm font-medium ${positive ? "text-green-700" : "text-red-700"}`}>
        {positive ? "+" : "-"}{contribLabel}
      </span>
    </div>
  );
}

function AttributionItem({ item }: { item: ActionAttribution }) {
  const [open, setOpen] = useState(false);
  const maxAbs = item.dimension_changes.length
    ? Math.max(...item.dimension_changes.map((d) => Math.abs(d.weighted_contribution)))
    : 1;

  const dateStr = item.action_date
    ? new Date(item.action_date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })
    : "";

  const beforeLabel = getScoreLabel(item.score_before);
  const afterLabel  = getScoreLabel(item.score_after);
  const sameLabel   = beforeLabel === afterLabel;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-gray-600 shrink-0">{dateStr}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{item.action_label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <DeltaBadge before={item.score_before} after={item.score_after} />
          {open ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-3">
          {/* attribution_text는 백엔드 생성 문자열 — 행동 설명만 표시 */}
          <p className="text-sm text-gray-700 mt-3 break-keep">
            {item.action_label} 실행 전후의 측정 결과를 비교한 것입니다.
            {item.dimension_changes.length > 0 && " 아래에서 AI별 변화를 참고하세요."}
          </p>

          {item.dimension_changes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">AI별 변화(참고)</p>
              {item.dimension_changes.map((d) => (
                <DimBar key={d.dimension} change={d} maxAbs={maxAbs} />
              ))}
            </div>
          )}

          <div className="flex gap-2 text-sm text-gray-600 pt-1 items-center">
            <span>
              이전: <strong className="text-gray-700">{beforeLabel}</strong>
            </span>
            <span>→</span>
            <span>
              이후: <strong className={sameLabel ? "text-gray-700" : item.delta > 0 ? "text-green-700" : "text-amber-700"}>
                {afterLabel}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoreAttributionCard({ bizId, authToken }: Props) {
  const [data, setData] = useState<AttributionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  useEffect(() => {
    if (!bizId || !authToken) return;
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/report/score-attribution/${bizId}?days=${days}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch((e) => { console.warn('[ScoreAttribution] fetch failed', e); setData(null); })
      .finally(() => setLoading(false));
  }, [bizId, authToken, days]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-40 mb-3" />
        <div className="h-4 bg-gray-100 rounded w-full mb-2" />
        <div className="h-4 bg-gray-100 rounded w-3/4" />
      </div>
    );
  }

  if (!data) return null;

  const { total_attributed_gain, top_effective_action, message } = data;
  // 시스템 자동 기록(점수 변화 로그·'추천됨'·경쟁사 상태)은 사용자가 한 행동이 아니라 '내 행동의 효과'에 섞여 보이면 안 된다(2026-11-02)
  const attributions = (data.attributions ?? []).filter((a) => showsScoreDeltaBadge(a.action_type));

  if (!attributions || attributions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-2">내 행동의 효과</h3>
        <p className="text-sm text-gray-600">
          {message || "기록된 행동이 없습니다. 가이드를 실행하고 행동을 기록하면 효과를 확인할 수 있습니다."}
        </p>
      </div>
    );
  }

  // 큰 변화(공용 규칙, 10점 이상)일 때만 요약 상자를 띄운다 — 예전 0.5점 초과는 측정 오차 범위였다
  const gainUp = deltaDirection(total_attributed_gain) === "up";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">내 행동의 효과</h3>
          <div className="flex gap-1">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
                  days === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>

        {gainUp && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <TrendingUp className="text-green-700 shrink-0" size={18} />
            <div>
              <p className="text-sm font-semibold text-green-800">
                최근 {days}일간 측정에서 상승이 확인됐습니다
              </p>
              {/* "가장 효과적인 행동"은 인과 단정이라 쓰지 않는다. 남은(사용자가 한) 행동 중에서만 보인다 */}
              {top_effective_action && attributions.some((a) => a.action_label === top_effective_action) && (
                <p className="text-sm text-green-700 mt-0.5 break-keep">
                  측정 변화가 가장 컸던 행동: <strong>{top_effective_action}</strong>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 행동 목록 */}
      <div className="p-5 space-y-3">
        {attributions.map((item, i) => (
          <AttributionItem key={`${item.action_date}-${i}`} item={item} />
        ))}
      </div>

      <div className="px-5 pb-4 text-sm text-gray-600 break-keep">
        <p>{EFFECT_NOTE}</p>
        <p className="mt-1">다시 측정 후 최신 비교를 확인할 수 있습니다.</p>
      </div>
    </div>
  );
}
