"use client";

import { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";

interface VisitDeltaResponse {
  show: boolean;
  days_away?: number;
  score_before?: number;
  score_now?: number;
  delta?: number;
  has_new_scan?: boolean;
}

interface Props {
  bizId: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function VisitDeltaBanner({ bizId }: Props) {
  const [data, setData] = useState<VisitDeltaResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bizId) return;

    // 오늘 날짜 기준 dismiss 상태 확인
    const dismissKey = `visit_delta_dismissed_${bizId}`;
    const dismissedDate = localStorage.getItem(dismissKey);
    const today = new Date().toISOString().split("T")[0];
    if (dismissedDate === today) {
      setDismissed(true);
      return;
    }

    // 항상 API 호출 — 백엔드가 DB로 방문 기록 관리 (첫 방문 초기화 포함)
    getSafeSession()
      .then((session) => {
        const token = session?.access_token;
        if (!token) return null;
        return fetch(`${BACKEND}/api/report/visit-delta/${bizId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : null));
      })
      .catch(() => null)
      .then((json: VisitDeltaResponse | null) => {
        if (json?.show) setData(json);
        setLoading(false);
      });
  }, [bizId]);

  if (dismissed) return null;
  if (loading) return <div className="h-0 mb-0" />;
  if (!data || !data.show) return null;

  const { days_away, score_before, score_now, delta } = data;
  const isPositive = (delta ?? 0) > 0;
  const isNegative = (delta ?? 0) < 0;

  const handleDismiss = () => {
    const dismissKey = `visit_delta_dismissed_${bizId}`;
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem(dismissKey, today);
    setDismissed(true);
  };

  return (
    <div
      className={`relative flex items-start gap-3 rounded-xl border px-4 py-3 mb-4 ${
        isPositive
          ? "bg-green-50 border-green-200"
          : isNegative
          ? "bg-orange-50 border-orange-200"
          : "bg-blue-50 border-blue-200"
      }`}
    >
      {/* 아이콘 */}
      <div className="shrink-0 mt-0.5">
        {isPositive ? (
          <TrendingUp className="w-5 h-5 text-green-600" />
        ) : isNegative ? (
          <TrendingDown className="w-5 h-5 text-orange-500" />
        ) : null}
      </div>

      {/* 텍스트 + CTA */}
      <div className="flex-1 min-w-0">
        {isPositive && (
          <p className="text-sm font-semibold text-green-800">
            {days_away ?? "?"}일 만에 오셨네요! 그동안 AI 노출 점수가{" "}
            <span className="text-green-700 font-bold">
              +{(delta ?? 0).toFixed(1)}점
            </span>{" "}
            올랐어요
          </p>
        )}
        {isNegative && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-sm font-semibold text-orange-800">
              {days_away ?? "?"}일 만에 오셨네요. 점수가{" "}
              <span className="text-orange-700 font-bold">
                {(delta ?? 0).toFixed(1)}점
              </span>{" "}
              내려갔습니다.
            </p>
            <Link
              href="/dashboard"
              className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-900 transition-colors"
            >
              지금 스캔해보세요 →
            </Link>
          </div>
        )}
        {/* 점수 보조 정보 */}
        {score_before !== undefined && score_now !== undefined && (
          <p className="text-sm text-gray-500 mt-0.5">
            이전 점수: {score_before.toFixed(1)} → 현재:{" "}
            <span
              className={
                isPositive
                  ? "text-green-700 font-semibold"
                  : isNegative
                  ? "text-orange-700 font-semibold"
                  : "text-gray-700 font-semibold"
              }
            >
              {score_now.toFixed(1)}
            </span>
          </p>
        )}
      </div>

      {/* X 닫기 버튼 */}
      <button
        onClick={handleDismiss}
        aria-label="배너 닫기"
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
