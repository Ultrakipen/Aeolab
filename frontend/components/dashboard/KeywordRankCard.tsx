"use client";

import { useState } from "react";
import { Search, Loader2, RefreshCw, Download, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { getSafeSession } from "@/lib/supabase/client";
import { trackKeywordMeasureStart, trackKeywordMeasureComplete } from "@/lib/analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";

type KeywordRankData = {
  pc_rank?: number | null;
  mobile_rank?: number | null;
  place_rank?: number | null;
  measured_at?: string;
  search_query?: string;
  error?: string;
};

// keyword-trend 엔드포인트 응답 타입
type KeywordTrendItem = {
  keyword: string;
  trend: { period: string; ratio: number }[];
  monthly_volume?: number | null;
};

type KeywordTrendResponse = {
  keywords: KeywordTrendItem[];
  category: string;
  region: string;
  period: string;
  available: boolean;
};

// 차트 데이터: period별로 키워드들의 ratio를 병합
type ChartDataPoint = {
  period: string;
  [keyword: string]: string | number;
};

type KeywordRanksMap = Record<string, KeywordRankData>;
type KeywordRanksRaw = Record<string, unknown>;

interface KeywordRankCardProps {
  bizId: string;
  /** businesses.keywords (등록된 키워드 리스트) */
  keywords: string[];
  /** 마지막 scan_results.keyword_ranks (없으면 빈 객체) */
  initialKeywordRanks?: KeywordRanksRaw | null;
  /** 사용자 그룹 (가중치 표시용) */
  userGroup?: "ACTIVE" | "LIKELY" | "INACTIVE";
  /** 현재 활성 플랜 — CSV 다운로드 Pro+ 게이트 */
  plan?: string;
  /** 사업장 지역 — 측정 조건 예시 동적 생성용 */
  region?: string;
}

function isKeywordRankData(v: unknown): v is KeywordRankData {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 순위에 따라 점수·색상 매핑 (작업 지침 #7: 임의 수치 금지 — 측정 데이터만 표시) */
function rankBadge(rank: number | null | undefined): {
  text: string;
  cls: string;
} {
  if (!rank || rank <= 0) return { text: "미노출", cls: "text-gray-400 bg-gray-50" };
  if (rank === 1) return { text: "1위", cls: "text-emerald-700 bg-emerald-100 font-bold" };
  if (rank <= 3) return { text: `${rank}위`, cls: "text-emerald-700 bg-emerald-50" };
  if (rank <= 10) return { text: `${rank}위`, cls: "text-amber-700 bg-amber-50" };
  if (rank <= 20) return { text: `${rank}위`, cls: "text-orange-700 bg-orange-50" };
  return { text: `${rank}위 이하`, cls: "text-gray-500 bg-gray-50" };
}

const PRO_PLANS = ["pro", "biz", "enterprise", "startup"];

function isProPlan(plan?: string): boolean {
  return PRO_PLANS.includes((plan ?? "").toLowerCase());
}

// Recharts 커스텀 Tooltip
const TrendTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="text-sm">
          {entry.name}: {entry.value.toFixed(1)}
        </p>
      ))}
    </div>
  );
};

const LINE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

export default function KeywordRankCard({
  bizId,
  keywords,
  initialKeywordRanks,
  userGroup,
  plan,
  region,
}: KeywordRankCardProps) {
  const [ranks, setRanks] = useState<KeywordRanksMap>(() => {
    if (!initialKeywordRanks || typeof initialKeywordRanks !== "object") return {};
    const out: KeywordRanksMap = {};
    for (const [k, v] of Object.entries(initialKeywordRanks)) {
      if (k.startsWith("_")) continue;
      if (isKeywordRankData(v)) out[k] = v as KeywordRankData;
    }
    return out;
  });
  const [scanning, setScanning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>("");
  const [lastMeasuredAt, setLastMeasuredAt] = useState<string | null>(() => {
    const ctx = initialKeywordRanks?._context;
    if (ctx && typeof ctx === "object" && "scanned_at" in ctx) {
      const v = (ctx as Record<string, unknown>).scanned_at;
      return typeof v === "string" ? v : null;
    }
    return null;
  });

  // 30일 추이 그래프 상태
  const [trendOpen, setTrendOpen] = useState(false);
  const [trendData, setTrendData] = useState<KeywordTrendResponse | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartKeywords, setChartKeywords] = useState<string[]>([]);

  const hasData = Object.keys(ranks).length > 0;
  const canDownload = isProPlan(plan);

  const fetchTrend = async () => {
    if (trendData || trendLoading) return;
    setTrendLoading(true);
    setTrendError(false);
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      const res = await fetch(`${BACKEND}/api/report/keyword-trend/${bizId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: KeywordTrendResponse = await res.json();
      setTrendData(json);

      // 차트 데이터 변환: period 기준으로 키워드별 ratio 병합
      if (json.available && json.keywords && json.keywords.length > 0) {
        const allPeriods = Array.from(
          new Set(json.keywords.flatMap((kw) => kw.trend.map((t) => t.period)))
        ).sort();
        const merged: ChartDataPoint[] = allPeriods.map((period) => {
          const point: ChartDataPoint = { period: period.slice(0, 7) }; // YYYY-MM
          for (const kw of json.keywords) {
            const t = kw.trend.find((x) => x.period === period);
            point[kw.keyword] = t ? Math.round(t.ratio * 10) / 10 : 0;
          }
          return point;
        });
        setChartData(merged);
        setChartKeywords(json.keywords.map((kw) => kw.keyword));
      }
    } catch {
      setTrendError(true);
    } finally {
      setTrendLoading(false);
    }
  };

  const handleTrendToggle = () => {
    const next = !trendOpen;
    setTrendOpen(next);
    if (next && !trendData && !trendLoading) {
      fetchTrend();
    }
  };

  const downloadCsv = async () => {
    if (!canDownload) {
      alert("Pro 플랜부터 가능합니다.");
      return;
    }
    setDownloading(true);
    setError("");
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      const res = await fetch(`${BACKEND}/api/report/keyword-rank-csv/${bizId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 403) {
        alert("Pro 플랜부터 가능합니다.");
        return;
      }
      if (!res.ok) throw new Error(`다운로드 실패 (HTTP ${res.status})`);
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      const filename = match ? decodeURIComponent(match[1]) : `keyword_rank_${bizId}.csv`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "다운로드 실패";
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const triggerScan = async () => {
    if (!keywords || keywords.length === 0) {
      setError("등록된 키워드가 없습니다. 사업장 정보에서 키워드 3개 이상 추가하세요.");
      return;
    }
    setScanning(true);
    setError("");
    trackKeywordMeasureStart(bizId);
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      const res = await fetch(`${BACKEND}/api/scan/keyword-rank`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ biz_id: bizId }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const detailMsg =
          typeof detail?.detail === "string"
            ? detail.detail
            : `측정 실패 (HTTP ${res.status})`;
        throw new Error(detailMsg);
      }
      const data = await res.json();
      setRanks(data.keyword_ranks || {});
      setLastMeasuredAt(data.measured_at || new Date().toISOString());
      const hasError = Boolean(data.fallback || (data.errors && data.errors.length > 0));
      trackKeywordMeasureComplete(
        typeof data.avg_rank === "number" ? data.avg_rank : null,
        Object.keys(data.keyword_ranks || {}).length,
        hasError,
      );
      if (hasError) {
        const errMsgs = (data.errors || [])
          .slice(0, 2)
          .map((e: unknown) => (typeof e === "string" ? e : JSON.stringify(e)));
        setError(`일부 키워드 측정 실패: ${errMsgs.join(", ")}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "측정 중 오류";
      setError(msg);
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-blue-600" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">네이버 키워드 검색 노출</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              내가 입력한 키워드의 PC·모바일·플레이스 1페이지 순위
              {userGroup && (
                <span className="ml-1.5 inline-flex px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                  {userGroup === "INACTIVE" ? "글로벌 AI 중심" : userGroup === "LIKELY" ? "AI 브리핑 확대 예정" : "네이버 AI 브리핑"} 가중치{" "}
                  {userGroup === "INACTIVE" ? "35%" : userGroup === "LIKELY" ? "30%" : "25%"}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {hasData && (
            <button
              type="button"
              onClick={downloadCsv}
              disabled={downloading || !canDownload}
              title={!canDownload ? "Pro 플랜부터 가능" : "CSV 다운로드"}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              CSV
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={triggerScan}
          disabled={scanning || keywords.length === 0}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> 측정 중 (~30초)
            </>
          ) : hasData ? (
            <>
              <RefreshCw className="w-4 h-4" /> 다시 측정
            </>
          ) : (
            "측정 시작"
          )}
        </button>
      </div>

      {/* 측정 조건 안내 */}
      <div className="mb-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-sm text-blue-800 space-y-1">
        <p className="font-semibold text-blue-900">측정 조건</p>
        <ul className="space-y-0.5 text-blue-700">
          <li>· <span className="font-medium">검색어</span>: 지역명 + 키워드 자동 조합{region && keywords.length > 0 ? ` (예: "${region} ${keywords[0]}")` : ""} — 아래 표에 실제 검색어 표시</li>
          <li>· <span className="font-medium">검색 위치</span>: 서울 기준 서버 IP (비로그인, 개인화 없음)</li>
          <li>· <span className="font-medium">순위 범위</span>: 각 채널 상위 20위 이내 — 20위 밖이면 &apos;미노출&apos; 표시</li>
          <li>· <span className="font-medium">PC</span> = 네이버 PC 통합검색 &nbsp;·&nbsp; <span className="font-medium">모바일</span> = 네이버 모바일 통합검색 &nbsp;·&nbsp; <span className="font-medium">플레이스</span> = 네이버 플레이스 탭</li>
        </ul>
      </div>

      {/* 빈 상태 (작업 지침 #7) */}
      {!hasData && !scanning && keywords.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-700 font-medium">아직 측정 데이터 없음</p>
          <p className="text-sm text-gray-500 mt-1">
            "측정 시작" 버튼을 누르면 등록된 키워드 {keywords.length}개의 순위를 측정합니다.
          </p>
        </div>
      )}

      {/* 키워드 미등록 */}
      {keywords.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm text-amber-800 font-medium">등록된 키워드 없음</p>
          <p className="text-sm text-amber-700 mt-1">
            사업장 설정에서 검색 키워드 3개 이상을 등록하세요.
          </p>
        </div>
      )}

      {/* 결과 표 — PC와 모바일 분리 표시 */}
      {hasData && (
        <>
          {/* PC 화면 (md+): 표 형태 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm uppercase">
                  <th className="text-left py-2 font-medium">키워드</th>
                  <th className="text-center py-2 font-medium">PC</th>
                  <th className="text-center py-2 font-medium">모바일</th>
                  <th className="text-center py-2 font-medium">플레이스</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ranks).map(([kw, data]) => {
                  const pc = rankBadge(data.pc_rank);
                  const mob = rankBadge(data.mobile_rank);
                  const pl = rankBadge(data.place_rank);
                  const displayKw = data.search_query || kw;
                  return (
                    <tr key={kw} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 font-medium text-gray-800 truncate max-w-xs">
                        {displayKw}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-1 text-xs sm:text-sm rounded ${pc.cls}`}>
                          {pc.text}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-1 text-xs sm:text-sm rounded ${mob.cls}`}>
                          {mob.text}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-1 text-xs sm:text-sm rounded ${pl.cls}`}>
                          {pl.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 화면: 카드 형태 */}
          <div className="md:hidden space-y-2">
            {Object.entries(ranks).map(([kw, data]) => {
              const pc = rankBadge(data.pc_rank);
              const mob = rankBadge(data.mobile_rank);
              const pl = rankBadge(data.place_rank);
              const displayKw = data.search_query || kw;
              return (
                <div key={kw} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-medium text-gray-800 text-sm mb-2 truncate">{displayKw}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">PC</p>
                      <span className={`inline-block px-2 py-1 text-sm rounded ${pc.cls}`}>
                        {pc.text}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">모바일</p>
                      <span className={`inline-block px-2 py-1 text-sm rounded ${mob.cls}`}>
                        {mob.text}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">플레이스</p>
                      <span className={`inline-block px-2 py-1 text-sm rounded ${pl.cls}`}>
                        {pl.text}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 모바일 CSV 버튼 — 풀 너비 */}
      {hasData && (
        <div className="md:hidden mt-3">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={downloading || !canDownload}
            title={!canDownload ? "Pro 플랜부터 가능" : "CSV 다운로드"}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {canDownload ? "CSV 다운로드" : "CSV 다운로드 (Pro 플랜부터)"}
          </button>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <p className="text-sm text-amber-700 mt-3 px-2 py-1.5 bg-amber-50 rounded">
          {error}
        </p>
      )}

      {/* 측정 시점 + 면책 문구 (§5.3) */}
      {(lastMeasuredAt || hasData) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {lastMeasuredAt && (
            <p className="text-sm text-gray-600">
              마지막 측정: {new Date(lastMeasuredAt).toLocaleString("ko-KR")}
            </p>
          )}
          <p className="text-sm text-gray-600">
            ※ 키워드 순위는 측정 시점·기기·검색 환경에 따라 달라질 수 있습니다.
            AEOlab은 서울 기준 비로그인 PC/모바일로 측정합니다.
          </p>
          <p className="text-sm text-blue-700 font-medium">
            플레이스 탭 순위가 오를수록 네이버 AI 브리핑·AI탭 노출 가능성도 함께 높아집니다.
          </p>
        </div>
      )}

      {/* 30일 키워드 검색량 추이 — 접기/펼치기 */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={handleTrendToggle}
          className="w-full flex items-center justify-between gap-2 text-left px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-800">30일 검색량 추이</span>
            <span className="text-sm text-gray-400 hidden sm:inline">네이버 DataLab 기준</span>
          </div>
          {trendOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          )}
        </button>

        {trendOpen && (
          <div className="mt-2">
            {/* 로딩 */}
            {trendLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                추이 데이터 불러오는 중…
              </div>
            )}

            {/* 에러 */}
            {!trendLoading && trendError && (
              <p className="text-sm text-amber-700 py-3 px-2 bg-amber-50 rounded-lg">
                추이 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
              </p>
            )}

            {/* 데이터 없음 */}
            {!trendLoading && !trendError && trendData && !trendData.available && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
                <p className="text-sm text-gray-700 font-medium">30일 추이 데이터 수집 중</p>
                <p className="text-sm text-gray-500 mt-1 break-keep">
                  네이버 DataLab 연동 후 키워드 데이터가 누적되면 추이 그래프가 표시됩니다.
                </p>
              </div>
            )}

            {/* 그래프 */}
            {!trendLoading && !trendError && trendData?.available && chartData.length > 0 && (
              <div>
                {/* PC 그래프 */}
                <div className="hidden md:block">
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }}
                      />
                      {chartKeywords.map((kw, idx) => (
                        <Line
                          key={kw}
                          type="monotone"
                          dataKey={kw}
                          stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 모바일 그래프 */}
                <div className="md:hidden">
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                      <XAxis
                        dataKey="period"
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <Tooltip content={<TrendTooltip />} />
                      {chartKeywords.map((kw, idx) => (
                        <Line
                          key={kw}
                          type="monotone"
                          dataKey={kw}
                          stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  {/* 모바일: 범례 별도 표시 */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {chartKeywords.map((kw, idx) => (
                      <span key={kw} className="flex items-center gap-1 text-sm text-gray-600">
                        <span
                          className="inline-block w-3 h-0.5 rounded"
                          style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                        />
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 면책 문구 */}
                <p className="mt-2 text-sm text-gray-400 break-keep leading-snug">
                  검색 순위는 기기·지역·로그인 상태에 따라 다를 수 있습니다. 위 그래프는 네이버 DataLab 기준 상대 검색량 추이입니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
