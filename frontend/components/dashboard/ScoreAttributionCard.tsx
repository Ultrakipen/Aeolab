"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";

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

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0.5)
    return (
      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 text-sm font-bold">
        <TrendingUp size={13} /> +{delta.toFixed(1)}점
      </span>
    );
  if (delta < -0.5)
    return (
      <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 text-sm font-bold">
        <TrendingDown size={13} /> {delta.toFixed(1)}점
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-sm">
      <Minus size={13} /> 변화 없음
    </span>
  );
}

function DimBar({ change, maxAbs }: { change: DimensionChange; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.abs(change.weighted_contribution / maxAbs) * 100 : 0;
  const positive = change.delta > 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 text-gray-600 truncate shrink-0">{change.label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${positive ? "bg-green-400" : "bg-red-400"}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <span className={`w-16 text-right text-sm font-medium ${positive ? "text-green-700" : "text-red-600"}`}>
        {change.delta > 0 ? "+" : ""}{change.delta.toFixed(0)}점 기여
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

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-gray-400 shrink-0">{dateStr}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{item.action_label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <DeltaBadge delta={item.delta} />
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-3">
          <p className="text-sm text-gray-700 mt-3">{item.attribution_text}</p>

          {item.dimension_changes.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">점수 변화 원인</p>
              {item.dimension_changes.map((d) => (
                <DimBar key={d.dimension} change={d} maxAbs={maxAbs} />
              ))}
            </div>
          )}

          <div className="flex gap-4 text-sm text-gray-500 pt-1">
            <span>
              이전: <strong className="text-gray-700">{item.score_before.toFixed(1)}점</strong>
            </span>
            <span>→</span>
            <span>
              이후: <strong className="text-gray-700">{item.score_after.toFixed(1)}점</strong>
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
      <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-40 mb-3" />
        <div className="h-4 bg-gray-100 rounded w-full mb-2" />
        <div className="h-4 bg-gray-100 rounded w-3/4" />
      </div>
    );
  }

  if (!data) return null;

  const { attributions, total_attributed_gain, top_effective_action, message } = data;

  if (!attributions || attributions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-2">내 행동이 점수에 미친 영향</h3>
        <p className="text-sm text-gray-500">
          {message || "기록된 행동이 없습니다. 가이드를 실행하고 행동을 기록하면 효과를 확인할 수 있습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">내 행동이 점수에 미친 영향</h3>
          {/* 기간 선택 */}
          <div className="flex gap-1">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-1 rounded-lg text-sm font-medium transition-colors ${
                  days === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>

        {/* 요약 배너 */}
        {total_attributed_gain > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <TrendingUp className="text-green-600 shrink-0" size={18} />
            <div>
              <p className="text-sm font-semibold text-green-800">
                최근 {days}일간 +{total_attributed_gain.toFixed(1)}점 향상
              </p>
              {top_effective_action && (
                <p className="text-sm text-green-700 mt-0.5">
                  가장 효과적인 행동: <strong>{top_effective_action}</strong>
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

      {/* 푸터 */}
      <div className="px-5 pb-4 text-sm text-gray-400">
        재스캔 후 최신 효과를 확인할 수 있습니다.
      </div>
    </div>
  );
}
