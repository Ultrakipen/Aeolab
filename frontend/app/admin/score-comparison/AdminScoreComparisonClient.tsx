"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── 타입 정의 ─────────────────────────────────────────────────────────────────
interface GroupStats {
  count: number;
  v30_avg: number | null;
  v31_avg: number | null;
  diff_avg: number | null;
  diff_stddev: number | null;
}

interface OutlierRow {
  biz_id: string;
  biz_name: string;
  category: string;
  v30: number;
  v31: number;
  diff: number;
}

interface ScatterPoint {
  v30: number;
  v31: number;
  user_group: string;
}

interface ComparisonResponse {
  total_scans: number;
  groups: {
    ACTIVE: GroupStats;
    LIKELY: GroupStats;
    INACTIVE: GroupStats;
  };
  outliers: OutlierRow[];
  scatter: ScatterPoint[];
  safety_diagnosis: "green" | "yellow" | "red";
  diagnosis_reason: string;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────────
const ADMIN_PROXY = "/api/admin-proxy";
const PERIOD_OPTIONS = [
  { value: 7,  label: "7일" },
  { value: 30, label: "30일" },
  { value: 60, label: "60일" },
  { value: 90, label: "90일" },
] as const;

const GROUP_LABELS: Record<string, string> = {
  ACTIVE: "ACTIVE (음식점·카페·숙박)",
  LIKELY: "LIKELY (미용·피트니스·반려)",
  INACTIVE: "INACTIVE (법무·교육·쇼핑 등, 프랜차이즈 포함)",
};

const GROUP_COLORS: Record<string, string> = {
  ACTIVE: "#10b981",
  LIKELY: "#6366f1",
  INACTIVE: "#f59e0b",
};

const DIAGNOSIS_CONFIG = {
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    border: "border-emerald-300 dark:border-emerald-700",
    title: "text-emerald-800 dark:text-emerald-200",
    badge: "bg-emerald-700 text-white",
    badgeText: "활성화 권장",
    icon: "✓",
    iconColor: "text-emerald-700",
  },
  yellow: {
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-300 dark:border-amber-700",
    title: "text-amber-800 dark:text-amber-200",
    badge: "bg-amber-700 text-white",
    badgeText: "추가 모니터링 필요",
    icon: "!",
    iconColor: "text-amber-700",
  },
  red: {
    bg: "bg-rose-50 dark:bg-rose-950",
    border: "border-rose-300 dark:border-rose-700",
    title: "text-rose-800 dark:text-rose-200",
    badge: "bg-rose-700 text-white",
    badgeText: "활성화 보류 권장",
    icon: "✗",
    iconColor: "text-rose-700",
  },
};

// ─── 그룹 통계 카드 컴포넌트 ────────────────────────────────────────────────────
function GroupCard({ groupKey, stats }: { groupKey: string; stats: GroupStats }) {
  if (!stats || stats.count === 0) {
    return (
      <div className="rounded-xl border p-4 md:p-5 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: GROUP_COLORS[groupKey] ?? "#6b7280" }}
          />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
            {GROUP_LABELS[groupKey] ?? groupKey}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-600">데이터 없음</p>
      </div>
    );
  }
  const diff = stats.diff_avg ?? 0;
  const isSignificant = Math.abs(diff) >= 5;
  const diffColor = diff > 0
    ? "text-emerald-700 dark:text-emerald-400"
    : diff < 0
    ? "text-rose-700 dark:text-rose-400"
    : "text-gray-600";
  const diffSign = diff > 0 ? "+" : "";

  return (
    <div className={`rounded-xl border p-4 md:p-5 ${
      isSignificant
        ? "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-700"
        : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: GROUP_COLORS[groupKey] ?? "#6b7280" }}
        />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
          {GROUP_LABELS[groupKey] ?? groupKey}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-600">사업장 수</span>
          <div className="font-bold text-gray-900 dark:text-gray-100">{stats.count}개</div>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-600">평균 변화량</span>
          <div className={`font-bold text-lg ${diffColor}`}>{diffSign}{diff.toFixed(1)}점</div>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-600">v3.0 평균</span>
          <div className="font-semibold text-gray-800 dark:text-gray-200">{(stats.v30_avg ?? 0).toFixed(1)}</div>
        </div>
        <div>
          <span className="text-gray-600 dark:text-gray-600">v3.1 평균</span>
          <div className="font-semibold text-gray-800 dark:text-gray-200">{(stats.v31_avg ?? 0).toFixed(1)}</div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <span className="text-gray-600 dark:text-gray-600 text-sm">표준편차: {(stats.diff_stddev ?? 0).toFixed(1)}</span>
      </div>
    </div>
  );
}

// ─── 산점도 툴팁 ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScatterPoint }[] }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const diff = d.v31 - d.v30;
  const diffSign = diff > 0 ? "+" : "";
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg text-sm">
      <p className="text-gray-600 dark:text-gray-600 mb-1">{GROUP_LABELS[d.user_group] ?? d.user_group}</p>
      <p className="text-gray-800 dark:text-gray-200">v3.0: <strong>{d.v30.toFixed(1)}</strong></p>
      <p className="text-gray-800 dark:text-gray-200">v3.1: <strong>{d.v31.toFixed(1)}</strong></p>
      <p className={`font-bold ${diff >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
        변화: {diffSign}{diff.toFixed(1)}점
      </p>
    </div>
  );
}

// ─── 메인 클라이언트 컴포넌트 ──────────────────────────────────────────────────
export function AdminScoreComparisonClient({ isAdmin }: { isAdmin: boolean }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllOutliers, setShowAllOutliers] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${ADMIN_PROXY}?path=api/admin/score-comparison&days=${d}`
      );
      if (!res.ok) {
        if (res.status === 403) {
          setError("관리자 권한이 필요합니다.");
          return;
        }
        if (res.status === 404) {
          setData(null);
          setError("__empty__");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load(days);
  }, [isAdmin, days, load]);

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-sm max-w-sm w-full text-center">
          <p className="text-gray-600 dark:text-gray-300 text-base">관리자만 접근할 수 있습니다.</p>
          <Link href="/admin" className="mt-4 inline-block text-blue-600 dark:text-blue-400 text-sm hover:underline">
            관리자 페이지로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  // 빈 상태 (Shadow 데이터 없음)
  if (error === "__empty__" || (data && data.total_scans === 0)) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">점수 모델 v3.1 비교</h1>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">
            아직 v3.1 Shadow 데이터가 없습니다
          </h2>
          <p className="text-gray-600 dark:text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
            Supabase SQL Editor에서 v3.1 Shadow 컬럼 ALTER를 실행하고,
            30일 자동 스캔이 쌓인 후 다시 확인해 주세요.
          </p>
          <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-600 dark:text-gray-600 font-mono">
              ALTER TABLE scan_results<br />
              &nbsp;&nbsp;ADD COLUMN IF NOT EXISTS track1_score_v31 FLOAT,<br />
              &nbsp;&nbsp;ADD COLUMN IF NOT EXISTS track2_score_v31 FLOAT,<br />
              &nbsp;&nbsp;ADD COLUMN IF NOT EXISTS unified_score_v31 FLOAT;
            </p>
          </div>
        </div>
      </div>
    );
  }

  const diag = data ? DIAGNOSIS_CONFIG[data.safety_diagnosis] : null;
  const visibleOutliers = data?.outliers
    ? (showAllOutliers ? data.outliers : data.outliers.slice(0, 20))
    : [];

  // 그룹별 scatter 분리
  const scatterByGroup: Record<string, ScatterPoint[]> = {};
  if (data?.scatter) {
    for (const pt of data.scatter) {
      if (!scatterByGroup[pt.user_group]) scatterByGroup[pt.user_group] = [];
      scatterByGroup[pt.user_group].push(pt);
    }
  }

  return (
    <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              점수 모델 v3.1 비교
            </h1>
          </div>
          {/* 기간 필터 */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {error && error !== "__empty__" && (
          <div className="bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-700 rounded-xl p-4 text-rose-700 dark:text-rose-300 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && !loading && (
          <>
            {/* 1. 안전 진단 박스 */}
            {diag && (
              <div className={`rounded-xl border-2 p-5 md:p-6 ${diag.bg} ${diag.border}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                  <div className={`text-2xl font-black ${diag.iconColor}`}>{diag.icon}</div>
                  <h2 className={`text-lg md:text-xl font-bold ${diag.title}`}>
                    안전 진단: {data.safety_diagnosis.toUpperCase()}
                  </h2>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${diag.badge}`}>
                    {diag.badgeText}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${diag.title}`}>{data.diagnosis_reason}</p>
                <p className="text-sm text-gray-600 dark:text-gray-600 mt-2">
                  분석 대상: <strong>{data.total_scans}</strong>건 ({days}일 기준)
                </p>
              </div>
            )}

            {/* 2. 그룹별 통계 카드 */}
            <div>
              <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">
                그룹별 평균 변화량
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {(["ACTIVE", "LIKELY", "INACTIVE"] as const).map((key) => (
                  <GroupCard key={key} groupKey={key} stats={data.groups[key]} />
                ))}
              </div>
            </div>

            {/* 3. 산점도 */}
            {data.scatter.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                  v3.0 vs v3.1 산점도
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  대각선(y=x) 기준으로 위는 v3.1 상승, 아래는 하락
                </p>
                <div className="overflow-x-auto" tabIndex={0}>
                  <ResponsiveContainer width="100%" height={340} minWidth={320}>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        type="number"
                        dataKey="v30"
                        domain={[0, 100]}
                        label={{ value: "v3.0 점수", position: "insideBottom", offset: -10, fontSize: 12 }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="v31"
                        domain={[0, 100]}
                        label={{ value: "v3.1 점수", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
                        tick={{ fontSize: 11 }}
                      />
                      {/* y=x 참고선 */}
                      <ReferenceLine
                        segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                        stroke="#9ca3af"
                        strokeDasharray="6 3"
                        label={{ value: "y = x", position: "insideTopLeft", fontSize: 10, fill: "#9ca3af" }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={32} iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      {Object.entries(scatterByGroup).map(([grp, pts]) => (
                        <Scatter
                          key={grp}
                          name={GROUP_LABELS[grp] ?? grp}
                          data={pts}
                          fill={GROUP_COLORS[grp] ?? "#6b7280"}
                          fillOpacity={0.7}
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 4. Outlier 표 */}
            {data.outliers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
                <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                  이상 변동 사업장 (차이 ±20 이상)
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-600 mb-4">
                  총 {data.outliers.length}건, 차이 큰 순 정렬
                </p>
                <div className="overflow-x-auto" tabIndex={0}>
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        {["사업장명", "업종", "v3.0", "v3.1", "변화량"].map((h) => (
                          <th
                            key={h}
                            className="text-left py-2 pr-3 text-gray-600 dark:text-gray-600 font-medium text-sm uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOutliers.map((row) => {
                        const diffSign = row.diff > 0 ? "+" : "";
                        const diffColor = row.diff > 0
                          ? "text-emerald-700 dark:text-emerald-400 font-bold"
                          : "text-rose-700 dark:text-rose-400 font-bold";
                        return (
                          <tr
                            key={row.biz_id}
                            className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                          >
                            <td className="py-2.5 pr-3 text-gray-800 dark:text-gray-200 font-medium max-w-[160px] truncate">
                              {row.biz_name}
                            </td>
                            <td className="py-2.5 pr-3 text-gray-600 dark:text-gray-600">{row.category}</td>
                            <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">{row.v30.toFixed(1)}</td>
                            <td className="py-2.5 pr-3 text-gray-700 dark:text-gray-300">{row.v31.toFixed(1)}</td>
                            <td className={`py-2.5 ${diffColor}`}>
                              {diffSign}{row.diff.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {data.outliers.length > 20 && !showAllOutliers && (
                  <button
                    onClick={() => setShowAllOutliers(true)}
                    className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    더보기 ({data.outliers.length - 20}건)
                  </button>
                )}
              </div>
            )}

            {/* 5. v3.1 라이브 적용 안내 배너 (2026-07-10: SCORE_MODEL_VERSION=v3_1 서버 전환 완료로
                "활성화 유도" UI → 현황 안내로 교체. 아래 비교값은 이제 v3.1(라이브) vs v3.1(shadow)
                동일 포뮬러 비교이므로 diff가 항상 0에 가까운 것이 정상 — 회귀 없음을 나타냄 */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-700 rounded-xl p-4 md:p-6">
              <h2 className="text-base font-bold text-blue-800 dark:text-blue-200 mb-2">
                v3.1은 이미 라이브 적용 중입니다
              </h2>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                서버 <code className="text-sm bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">SCORE_MODEL_VERSION=v3_1</code>로
                전환 완료되어 위 &quot;v3.0 평균&quot;/&quot;v3.1 평균&quot;은 실제로는 라이브 점수와
                동일 포뮬러의 shadow 재계산값을 비교한 것입니다. diff가 0에 가까울수록 정상(회귀 없음)이며,
                차기 모델 버전(v3.2 등) 전환 검토 시 이 페이지를 다시 활용할 수 있습니다.
              </p>
            </div>
          </>
        )}
    </div>
  );
}
