"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ThumbsUp, ThumbsDown, RefreshCw, Star } from "lucide-react";

const ADMIN_PROXY = "/api/admin-proxy";

const PERIOD_OPTIONS = [
  { label: "7일", value: "7" },
  { label: "30일", value: "30" },
  { label: "전체", value: "all" },
] as const;

// D.I.A. 점수 분포 타입
interface DiaBin {
  range: string;
  count: number;
}

interface DiaStats {
  period_days: number;
  total_guides: number;
  bins: DiaBin[];
  avg_score: number | null;
  regenerated_count: number;
  regenerated_success_rate: number | null;
}

const DIA_BIN_COLORS: Record<string, string> = {
  "90-100": "bg-green-500",
  "70-89":  "bg-yellow-400",
  "<70":    "bg-red-400",
};

const DIA_BIN_TEXT: Record<string, string> = {
  "90-100": "text-green-700 dark:text-green-300",
  "70-89":  "text-yellow-700 dark:text-yellow-300",
  "<70":    "text-red-700 dark:text-red-300",
};

function DiaBinBar({ bin, max }: { bin: DiaBin; max: number }) {
  const pct = max > 0 ? Math.round((bin.count / max) * 100) : 0;
  const colorClass = DIA_BIN_COLORS[bin.range] ?? "bg-blue-400";
  const textClass = DIA_BIN_TEXT[bin.range] ?? "text-blue-700 dark:text-blue-300";
  return (
    <div className="flex items-center gap-3">
      <span className={`w-14 text-sm font-medium shrink-0 ${textClass}`}>{bin.range}</span>
      <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right shrink-0">
        {bin.count}
      </span>
    </div>
  );
}

type Period = (typeof PERIOD_OPTIONS)[number]["value"];

interface EventSummary {
  good: number;
  bad: number;
}

interface SummaryData {
  summary: Record<string, EventSummary>;
}

const EVENT_LABELS: Record<string, string> = {
  scan_completed: "스캔 완료",
  guide_generated: "가이드 생성",
  delivery_completed: "대행 완료",
  general: "일반",
};

function getLabel(key: string): string {
  return EVENT_LABELS[key] ?? key;
}

function GoodBadBar({
  good,
  bad,
  total,
}: {
  good: number;
  bad: number;
  total: number;
}) {
  const goodPct = total > 0 ? Math.round((good / total) * 100) : 0;
  const badPct = total > 0 ? 100 - goodPct : 0;
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${goodPct}%` }}
        />
        <div
          className="h-full bg-red-400 transition-all"
          style={{ width: `${badPct}%` }}
        />
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right shrink-0">
        {goodPct}%
      </span>
    </div>
  );
}

export default function AdminFeedbackClient() {
  const [period, setPeriod] = useState<Period>("30");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // D.I.A. 통계 상태
  const [diaStats, setDiaStats] = useState<DiaStats | null>(null);
  const [diaLoading, setDiaLoading] = useState(false);
  const [diaError, setDiaError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ path: "api/feedback/summary" });
      if (period !== "all") params.set("days", period);
      const res = await fetch(`${ADMIN_PROXY}?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError("관리자 권한이 필요합니다. /admin에서 로그인하세요.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadDia = useCallback(async () => {
    setDiaLoading(true);
    setDiaError("");
    try {
      const daysParam = period === "all" ? "90" : period;
      const params = new URLSearchParams({ path: "admin/dia-stats", days: daysParam });
      const res = await fetch(`${ADMIN_PROXY}?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          setDiaError("관리자 권한이 필요합니다.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setDiaStats(json);
    } catch (e) {
      setDiaError(e instanceof Error ? e.message : "D.I.A. 데이터를 불러오지 못했습니다.");
    } finally {
      setDiaLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
    loadDia();
  }, [load, loadDia]);

  const entries = data
    ? Object.entries(data.summary).sort((a, b) => {
        const ta = a[1].good + a[1].bad;
        const tb = b[1].good + b[1].bad;
        return tb - ta;
      })
    : [];

  const chartData = entries.map(([key, val]) => ({
    name: getLabel(key),
    긍정: val.good,
    부정: val.bad,
  }));

  const totalGood = entries.reduce((s, [, v]) => s + v.good, 0);
  const totalBad = entries.reduce((s, [, v]) => s + v.bad, 0);
  const totalAll = totalGood + totalBad;

  return (
    <>
      {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              피드백 현황
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
              이벤트별 만족도 집계
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 기간 필터 */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {PERIOD_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    period === value
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="새로고침"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading && !data && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* 빈 데이터 */}
        {!loading && !error && data && entries.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center shadow-sm">
            <p className="text-base font-medium text-gray-600 dark:text-gray-300">
              아직 피드백 데이터가 없습니다
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              사용자가 피드백을 제출하면 여기에 표시됩니다.
            </p>
          </div>
        )}

        {/* 요약 카드 */}
        {entries.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                {
                  label: "전체 응답",
                  value: totalAll,
                  color: "text-gray-900 dark:text-gray-100",
                },
                {
                  label: "긍정 (좋아요)",
                  value: totalGood,
                  color: "text-green-600 dark:text-green-400",
                },
                {
                  label: "부정 (별로)",
                  value: totalBad,
                  color: "text-red-500 dark:text-red-400",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm"
                >
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    {item.label}
                  </div>
                  <div className={`text-2xl font-bold ${item.color}`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* 이벤트별 카드 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm mb-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                이벤트별 만족도
              </h2>
              <div className="space-y-4">
                {entries.map(([key, val]) => {
                  const total = val.good + val.bad;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {getLabel(key)}
                        </span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                            {val.good}
                          </span>
                          <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                            <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />
                            {val.bad}
                          </span>
                          <span className="text-gray-500 dark:text-gray-500">
                            총 {total}건
                          </span>
                        </div>
                      </div>
                      <GoodBadBar
                        good={val.good}
                        bad={val.bad}
                        total={total}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 막대 차트 */}
            {chartData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  이벤트별 긍정·부정 비교
                </h2>
                <div className="h-56 md:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                      />
                      <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "13px" }}
                      />
                      <Bar dataKey="긍정" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="부정" fill="#f87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {/* D.I.A. 점수 분포 카드 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" aria-hidden="true" />
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                D.I.A. 가이드 품질 점수 분포
              </h2>
            </div>
            <button
              onClick={loadDia}
              disabled={diaLoading}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="D.I.A. 통계 새로고침"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${diaLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {diaError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-3 text-sm text-red-700 dark:text-red-300">
              {diaError}
            </div>
          )}

          {diaLoading && !diaStats && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {diaStats && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
              {/* 요약 수치 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: "집계 가이드",
                    value: diaStats.total_guides === 0 ? "데이터 없음" : `${diaStats.total_guides}건`,
                    color: "text-gray-900 dark:text-gray-100",
                  },
                  {
                    label: "평균 점수",
                    value: diaStats.avg_score !== null ? `${diaStats.avg_score}점` : "N/A",
                    color:
                      diaStats.avg_score !== null && diaStats.avg_score >= 90
                        ? "text-green-600 dark:text-green-400"
                        : diaStats.avg_score !== null && diaStats.avg_score >= 70
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-500 dark:text-red-400",
                  },
                  {
                    label: "재생성 건수",
                    value: `${diaStats.regenerated_count}건`,
                    color: diaStats.regenerated_count > 0 ? "text-orange-600 dark:text-orange-400" : "text-gray-900 dark:text-gray-100",
                  },
                  {
                    label: "재생성 성공률",
                    value:
                      diaStats.regenerated_success_rate !== null
                        ? `${diaStats.regenerated_success_rate}%`
                        : "N/A",
                    color:
                      diaStats.regenerated_success_rate !== null && diaStats.regenerated_success_rate >= 80
                        ? "text-green-600 dark:text-green-400"
                        : "text-yellow-600 dark:text-yellow-400",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                  >
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                      {item.label}
                    </div>
                    <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* 구간별 막대 */}
              {diaStats.total_guides > 0 ? (
                <div className="space-y-2.5">
                  {diaStats.bins.map((bin) => (
                    <DiaBinBar
                      key={bin.range}
                      bin={bin}
                      max={diaStats.total_guides}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-4">
                  아직 D.I.A. 점수가 기록된 가이드가 없습니다.
                  <br />
                  <span className="text-sm">가이드 생성 후 tools_json.dia_score 필드가 저장되면 표시됩니다.</span>
                </p>
              )}

              <p className="text-sm text-gray-500 dark:text-gray-500 mt-3">
                최근 {diaStats.period_days}일 기준 · 90점+ 초회 통과 · 70~89점 조건부 통과 · 70점 미만 재생성 트리거
              </p>
            </div>
          )}
        </div>
    </>
  );
}
