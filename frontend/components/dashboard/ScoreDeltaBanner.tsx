"use client";
import { useEffect, useState } from "react";
import { Clock, RefreshCw, TrendingUp, X } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ChangedItem {
  key: string;
  label: string;
  old_score: number;
  new_score: number;
  weighted_delta: number;
  source: "추정";
}

interface ScoreDeltaData {
  measured_score: number | null;
  measured_at: string | null;
  estimated_score: number | null;
  delta: number | null;
  changed_items: ChangedItem[];
  next_auto_scan: string;
  manual_scan_remaining: number;
  manual_scan_daily_limit: number;
  note: string;
}

interface Props {
  bizId: string;
  accessToken: string;
}

function formatNextScan(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = Math.round((d.getTime() - now.getTime()) / 3600000);
    const hh = d.getHours().toString().padStart(2, "0");
    if (diffH <= 1) return "곧";
    if (diffH < 24) return `오늘 ${hh}:00`;
    return `내일 ${hh}:00`;
  } catch {
    return "새벽 02:00";
  }
}

export function ScoreDeltaBanner({ bizId, accessToken }: Props) {
  const [data, setData] = useState<ScoreDeltaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!accessToken || !bizId) { setLoading(false); return; }
    fetch(`${BACKEND}/api/report/score-delta/${bizId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ScoreDeltaData | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bizId, accessToken]);

  // 로딩 중이거나 닫혔으면 렌더 안 함 — 내용 없는 배너는 스켈레톤도 불필요
  if (dismissed || loading || !data) return null;

  const positiveChanges = (data.changed_items ?? []).filter(
    (i) => i.weighted_delta > 0
  );
  if (positiveChanges.length === 0 || (data.delta ?? 0) <= 0) return null;

  const nextScanLabel = formatNextScan(data.next_auto_scan);
  const remaining = data.manual_scan_remaining ?? 0;
  const dailyLimit = data.manual_scan_daily_limit ?? 0;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-5 relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-indigo-300 hover:text-indigo-500"
        aria-label="닫기"
      >
        <X size={15} />
      </button>

      {/* 헤더 */}
      <div className="flex items-center gap-1.5 mb-2 pr-6">
        <TrendingUp size={14} className="text-indigo-500 shrink-0" />
        <p className="text-sm font-semibold text-indigo-800">
          프로필 변경사항이 감지됐습니다 — 다음 측정에 반영됩니다
        </p>
      </div>

      {/* 변경 항목 배지 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {positiveChanges.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-1 text-sm bg-white border border-indigo-200 text-indigo-700 rounded-full px-2.5 py-0.5"
          >
            {item.label}
            <span className="text-emerald-600 font-semibold">↑</span>
          </span>
        ))}
      </div>

      {/* 하단: 예상 점수 + 다음 자동 측정 + 잔여 횟수 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {data.delta !== null && data.delta > 0 && (
            <span className="text-sm text-indigo-700 font-medium">
              {data.delta >= 5
                ? "눈에 띄는 개선 예상"
                : data.delta >= 2
                ? "개선 예상"
                : "소폭 개선 예상"}
              <span className="text-xs text-gray-400 ml-1">(추정)</span>
            </span>
          )}
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Clock size={12} />
            자동 측정 {nextScanLabel}
          </span>
        </div>

        {dailyLimit > 0 && (
          <span className="text-sm text-gray-500 flex items-center gap-1 shrink-0">
            <RefreshCw size={12} />
            {remaining > 0
              ? `오늘 ${remaining}/${dailyLimit}회 측정 가능`
              : `오늘 측정 한도 소진 — 자동 측정 ${nextScanLabel}`}
          </span>
        )}
      </div>

      {/* 면책 문구 */}
      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
        키워드 커버리지·AI 브리핑 노출은 마지막 스캔 기준이며 실제 점수는 측정 후 확정됩니다.
      </p>
    </div>
  );
}
