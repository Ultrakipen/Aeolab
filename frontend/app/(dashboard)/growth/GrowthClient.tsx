"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { trackKakaoShareClick } from "@/lib/analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { getScoreTextLabel } from "@/lib/scoreLabels";
import { CATEGORY_LABEL } from "@/lib/categories";

// 행동 타입별 색상
const ACTION_COLORS: Record<string, string> = {
  faq_registered: "#10b981",
  review_replied: "#3b82f6",
  intro_updated: "#f59e0b",
  post_updated: "#8b5cf6",
  keyword_added: "#06b6d4",
};
const DEFAULT_ACTION_COLOR = "#9ca3af";

function getActionColor(actionType: string): string {
  return ACTION_COLORS[actionType] ?? DEFAULT_ACTION_COLOR;
}

interface HistoryEntry {
  scanned_at?: string;
  score_date?: string;
  unified_score: number;
  track1_score: number;
  track2_score: number;
  exposure_freq?: number;
  sample_size?: number;
  rank_in_category?: number;
  total_in_category?: number;
  weekly_change?: number;
}

interface BenchmarkData {
  avg_score: number;
  top10_score: number;
  my_score: number;
  rank_percentile: number;
  fallbackLabel?: string;
}

interface ActionLog {
  action_type: string;
  action_label: string;
  action_date: string;
  score_before: number | null;
  score_after: number | null;
}

interface Props {
  businessName: string;
  category: string;
  region: string;
  historyData: HistoryEntry[];
  growthCardUrl: string | null;
  benchmarkData: BenchmarkData | null;
  actionLogs?: ActionLog[];
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "–";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return "날짜 없음";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "날짜 없음";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateKo(iso: string | null | undefined): string {
  if (!iso) return "날짜 없음";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "날짜 없음";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 커스텀 툴팁
interface TooltipPayload {
  value: number;
  dataKey: string;
  name: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[140px]">
      <p className="text-gray-400 text-sm mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-0.5">
          <span style={{ color: p.color }} className="font-medium text-sm">{p.name}</span>
          <span className="font-bold text-gray-800">{getScoreTextLabel(Math.round(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export default function GrowthClient({
  businessName,
  category,
  region,
  historyData,
  growthCardUrl,
  benchmarkData,
  actionLogs = [],
}: Props) {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const hasMyScan = historyData.length > 0;

  // 차트용 데이터 변환
  const chartData = historyData.map((entry) => ({
    date: formatDateShort(entry.scanned_at ?? entry.score_date),
    fullDate: formatDateFull(entry.scanned_at ?? entry.score_date),
    score: Math.round(entry.unified_score * 10) / 10,
    naverScore: Math.round(entry.track1_score * 10) / 10,
    globalScore: Math.round((entry.track2_score ?? 0) * 10) / 10,
  }));

  // 최신 스코어 / 첫 스코어
  const latest = historyData[historyData.length - 1];
  const first = historyData[0];
  const currentScore = latest ? Math.round(latest.unified_score) : 0;
  const firstScore = first ? Math.round(first.unified_score) : 0;
  const totalDelta = latest && first ? Math.round((latest.unified_score - first.unified_score) * 10) / 10 : 0;

  // weekly_change (최신 기록 기준)
  const latestWeeklyChange = latest?.weekly_change ?? null;

  // exposure_freq / sample_size (최신 기록 기준)
  const latestExposureFreq = latest?.exposure_freq ?? null;
  const latestSampleSize = latest?.sample_size ?? null;

  // rank_in_category / total_in_category (최신 기록 기준)
  const latestRank = latest?.rank_in_category ?? null;
  const latestTotal = latest?.total_in_category ?? null;

  // 이번 달 / 지난 달 최고 점수
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastYear = lastMonthDate.getFullYear();

  const thisMonthScores = historyData.filter((e) => {
    const d = new Date(e.scanned_at ?? e.score_date ?? "");
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const lastMonthScores = historyData.filter((e) => {
    const d = new Date(e.scanned_at ?? e.score_date ?? "");
    return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
  });

  const thisMonthBest = thisMonthScores.length > 0
    ? Math.round(Math.max(...thisMonthScores.map((e) => e.unified_score)))
    : null;
  const lastMonthBest = lastMonthScores.length > 0
    ? Math.round(Math.max(...lastMonthScores.map((e) => e.unified_score)))
    : null;
  const monthDelta =
    thisMonthBest !== null && lastMonthBest !== null
      ? thisMonthBest - lastMonthBest
      : null;

  // 성장 카드 카카오 공유 핸들러 (currentScore 이후 선언)
  const handleGrowthShare = useCallback(async () => {
    if (!growthCardUrl) return;

    trackKakaoShareClick({ score: currentScore });

    const shareUrl = `https://aeolab.co.kr/share/growth?img=${encodeURIComponent(growthCardUrl)}&biz=${encodeURIComponent(businessName)}`;
    const trialUrl = "https://aeolab.co.kr/trial?ref=growth_share";
    const title = `${businessName} AI 검색 노출 성장 리포트`;
    const description = "이달 가게 AI 노출 성장 기록 · AEOlab";

    // 1) Kakao SDK
    try {
      if (
        typeof window !== "undefined" &&
        window.Kakao &&
        window.Kakao.isInitialized() &&
        window.Kakao.Share
      ) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title,
            description,
            imageUrl: growthCardUrl,
            imageWidth: 600,
            imageHeight: 400,
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
          buttons: [
            {
              title: "내 가게도 무료 진단",
              link: { mobileWebUrl: trialUrl, webUrl: trialUrl },
            },
          ],
        });
        return;
      }
    } catch {
      // SDK 실패 → fallback
    }

    // 2) navigator.share
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: description, url: shareUrl });
        return;
      }
    } catch {
      // 취소 또는 미지원 → 클립보드
    }

    // 3) 클립보드 폴백
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareToast("링크가 클립보드에 복사되었습니다");
      window.setTimeout(() => setShareToast(null), 2200);
    } catch {
      setShareToast("공유에 실패했습니다. 링크를 직접 복사해 주세요.");
      window.setTimeout(() => setShareToast(null), 2200);
    }
  }, [growthCardUrl, businessName, currentScore]);

  // 표시할 이력 (최신 5개 또는 전체)
  const displayHistory = showAllHistory ? [...historyData].reverse() : [...historyData].reverse().slice(0, 5);

  // 차트 x축에 있는 날짜 집합 (ReferenceLine x 매칭용)
  const chartDateSet = new Set(chartData.map((d) => d.date));

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">

      {/* 헤더 */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📈</span>
          <span>내 가게 성장 기록</span>
        </h1>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          {region} · {categoryLabel} · AI 스캔 결과를 기반으로 내 가게가 얼마나 성장했는지 확인하세요
        </p>
        <p className="text-sm text-gray-400 mt-1">
          측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다
        </p>
        {/* 업종 내 순위 배지 */}
        {latestRank !== null && latestTotal !== null && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
              🏆 {categoryLabel} 업종 중 {latestRank}위 / {latestTotal}곳
            </span>
          </div>
        )}
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 전체 AI 노출 상태 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <p className="text-sm font-medium text-gray-500 mb-3">전체 AI 노출 상태</p>
          {historyData.length >= 2 ? (
            <>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-sm text-gray-400">{getScoreTextLabel(firstScore)}</span>
                <span className="text-gray-300">→</span>
                {(() => {
                  const lbl = getScoreTextLabel(currentScore)
                  const cls = currentScore >= 75 ? 'text-emerald-600' : currentScore >= 55 ? 'text-blue-600' : currentScore >= 30 ? 'text-amber-600' : 'text-gray-400'
                  return <span className={`text-lg font-bold ${cls}`}>{lbl}</span>
                })()}
              </div>
              {totalDelta !== 0 && (
                <p className={`text-sm font-semibold ${totalDelta > 0 ? "text-blue-600" : "text-red-500"}`}>
                  {totalDelta > 0 ? "↑ 첫 스캔 대비 개선됨" : "↓ 첫 스캔 대비 하락"}
                </p>
              )}
              {latestWeeklyChange !== null && latestWeeklyChange !== 0 && (
                <p className={`text-sm font-semibold mt-1 ${latestWeeklyChange > 0 ? "text-emerald-600" : "text-red-400"}`}>
                  이번 주 {latestWeeklyChange > 0 ? "↑ 상승" : "↓ 하락"}
                </p>
              )}
              <p className="text-sm text-gray-400 mt-1">첫 스캔부터 현재까지</p>
            </>
          ) : (
            <>
              {(() => {
                const lbl = getScoreTextLabel(currentScore)
                const cls = currentScore >= 75 ? 'text-emerald-600' : currentScore >= 55 ? 'text-blue-600' : currentScore >= 30 ? 'text-amber-600' : 'text-gray-400'
                return <p className={`text-lg font-bold mb-1 ${cls}`}>{lbl}</p>
              })()}
              {latestWeeklyChange !== null && latestWeeklyChange !== 0 && (
                <p className={`text-sm font-semibold mb-1 ${latestWeeklyChange > 0 ? "text-emerald-600" : "text-red-400"}`}>
                  이번 주 {latestWeeklyChange > 0 ? "↑ 상승" : "↓ 하락"}
                </p>
              )}
              <p className="text-sm text-gray-400 mt-1">스캔 2회 이상부터 변화 추적</p>
            </>
          )}
          {latestExposureFreq !== null && (
            <div className="mt-2 bg-blue-50 rounded-lg px-3 py-1.5">
              <p className="text-sm font-semibold text-blue-700">
                {latestSampleSize ?? 100}번 중 <span className="text-base">{Math.round(latestExposureFreq)}</span>번 노출
              </p>
            </div>
          )}
        </div>

        {/* 네이버 AI 검색 노출도 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <p className="text-sm font-medium text-gray-500 mb-3">네이버 AI 검색 노출도</p>
          {latest ? (
            <>
              {(() => {
                const s = latest.track1_score
                const lbl = getScoreTextLabel(s)
                const cls = s >= 75 ? 'text-emerald-600' : s >= 55 ? 'text-blue-600' : s >= 30 ? 'text-amber-600' : 'text-gray-400'
                return <p className={`text-lg font-bold mb-1 ${cls}`}>{lbl}</p>
              })()}
              <p className="text-sm text-gray-400 mt-1">
                스마트플레이스 기반 네이버 AI 노출 수준입니다
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">스캔 후 표시됩니다</p>
          )}
        </div>

        {/* ChatGPT·Gemini 노출도 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
          <p className="text-sm font-medium text-gray-500 mb-3">ChatGPT·Gemini 노출도</p>
          {latest ? (
            <>
              {(() => {
                const s = latest.track2_score ?? 0
                const lbl = getScoreTextLabel(s)
                const cls = s >= 75 ? 'text-purple-600' : s >= 55 ? 'text-purple-500' : s >= 30 ? 'text-amber-600' : 'text-gray-400'
                return <p className={`text-lg font-bold mb-1 ${cls}`}>{lbl}</p>
              })()}
              <p className="text-sm text-gray-400 mt-1">
                Gemini·ChatGPT가 현재 이 사업장을 인식하는 수준입니다
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">스캔 후 표시됩니다</p>
          )}
        </div>
      </div>

      {/* 섹션 1: AI 노출 점수 변화 차트 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">AI 노출 점수 변화</h2>
        <p className="text-sm text-gray-400 mb-5">
          최근 30일 동안 내 가게가 AI에 노출되는 정도가 어떻게 변했는지 보여줍니다
        </p>

        {chartData.length >= 2 ? (
          <>
            <div className="w-full h-56 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 30, 55, 75, 100]}
                    tickFormatter={(v: number) => v === 75 ? '양호' : v === 55 ? '보통' : v === 30 ? '주의 필요' : ''}
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                    formatter={(value) => (
                      <span style={{ color: "#374151", fontSize: "12px" }}>{value}</span>
                    )}
                  />
                  {/* 행동 수직 마커 */}
                  {actionLogs.map((log, i) => {
                    const xVal = formatDateShort(log.action_date);
                    if (!chartDateSet.has(xVal)) return null;
                    return (
                      <ReferenceLine
                        key={i}
                        x={xVal}
                        stroke={getActionColor(log.action_type)}
                        strokeDasharray="4 2"
                        strokeWidth={1.5}
                        label={{
                          value: "✓",
                          fontSize: 10,
                          fill: getActionColor(log.action_type),
                          position: "top",
                        }}
                      />
                    );
                  })}
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#6b7280"
                    strokeWidth={2.0}
                    dot={{ fill: "#6b7280", r: 3 }}
                    activeDot={{ r: 5 }}
                    name="전체 통합 점수"
                    strokeDasharray="5 3"
                  />
                  <Line
                    type="monotone"
                    dataKey="naverScore"
                    stroke="#3b82f6"
                    strokeWidth={2.0}
                    dot={{ fill: "#3b82f6", r: 3 }}
                    activeDot={{ r: 5, fill: "#2563eb" }}
                    name="네이버 AI 노출"
                  />
                  <Line
                    type="monotone"
                    dataKey="globalScore"
                    stroke="#8b5cf6"
                    strokeWidth={2.0}
                    dot={{ fill: "#8b5cf6", r: 3 }}
                    activeDot={{ r: 5, fill: "#7c3aed" }}
                    name="글로벌 AI 노출"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 행동 타임라인 목록 (차트 아래) */}
            {actionLogs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">행동 이력</p>
                <div className="space-y-1.5">
                  {actionLogs.slice(0, 5).map((log, i) => {
                    const scoreDelta =
                      log.score_after !== null && log.score_before !== null
                        ? Math.round((log.score_after - log.score_before) * 10) / 10
                        : null;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getActionColor(log.action_type) }}
                        />
                        <span className="text-gray-400 shrink-0 text-sm">{formatDateKo(log.action_date)}</span>
                        <span className="text-gray-700 font-medium">{log.action_label}</span>
                        {scoreDelta !== null && (
                          <span className={`text-sm font-semibold ${scoreDelta > 0 ? "text-emerald-600" : scoreDelta < 0 ? "text-red-500" : "text-gray-400"}`}>
                            {scoreDelta > 0 ? "↑ 점수 상승" : scoreDelta < 0 ? "↓ 점수 하락" : "변화 없음"}
                          </span>
                        )}
                        {scoreDelta === null && log.score_after === null && (
                          <span className="text-sm text-gray-300">(7일 후 효과 측정)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : chartData.length === 1 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <p className="text-sm font-semibold text-gray-700">
              현재 AI 노출: <span className="text-blue-600 text-base font-bold">{getScoreTextLabel(chartData[0].score)}</span>
            </p>
            <p className="text-sm text-gray-400">
              스캔을 1회 더 하면 노출 변화 추이가 그래프로 나타납니다.
            </p>
            <Link
              href="/dashboard"
              className="mt-2 text-sm text-blue-600 font-semibold underline"
            >
              대시보드에서 AI 스캔 하기 →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <span className="text-4xl">📊</span>
            <p className="text-sm font-semibold text-gray-700">아직 스캔 기록이 없습니다</p>
            <p className="text-sm text-gray-400">대시보드에서 AI 스캔을 시작해 보세요.</p>
            <Link
              href="/dashboard"
              className="mt-2 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              대시보드로 이동 →
            </Link>
          </div>
        )}
      </div>

      {/* 섹션: 내가 한 행동 기록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">내가 한 행동 기록</h2>
        <p className="text-sm text-gray-400 mb-4">
          가이드에서 체크한 항목들이 여기에 기록됩니다. 7일 후 점수 변화를 자동으로 측정합니다.
        </p>
        {actionLogs.length > 0 ? (
          <div className="space-y-3">
            {actionLogs.map((log, i) => {
              const scoreDelta =
                log.score_after !== null && log.score_before !== null
                  ? Math.round((log.score_after - log.score_before) * 10) / 10
                  : null;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50"
                >
                  <span
                    className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                    style={{ backgroundColor: getActionColor(log.action_type) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">{log.action_label}</span>
                      {scoreDelta !== null && (
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${scoreDelta > 0 ? "bg-emerald-100 text-emerald-700" : scoreDelta < 0 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                          {scoreDelta > 0 ? "↑ 상승" : scoreDelta < 0 ? "↓ 하락" : "변화 없음"}
                        </span>
                      )}
                      {log.score_after === null && (
                        <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">측정 대기 중</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{formatDateFull(log.action_date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
            <p className="text-sm text-gray-400">가이드 체크박스를 체크하면 여기에 기록됩니다</p>
            <Link
              href="/guide"
              className="mt-2 inline-block text-sm text-blue-600 font-semibold underline"
            >
              개선 가이드 보기 →
            </Link>
          </div>
        )}
      </div>

      {/* 섹션 2: 업종 평균 대비 내 위치 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">
          우리 업종에서 내 위치
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          같은 업종의 다른 가게들과 비교했을 때 내 가게의 AI 노출 수준입니다
        </p>

        {benchmarkData ? (
          <div className="space-y-4">
            {/* 폴백 배지 */}
            {benchmarkData.fallbackLabel && (
              <div className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-sm px-2.5 py-1 rounded-full">
                참고: {benchmarkData.fallbackLabel}
              </div>
            )}
            {/* 게이지 바 */}
            <div className="space-y-3">
              {/* 내 가게 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-blue-700">⭐ 내 가게</span>
                  <span className="text-sm font-bold text-blue-700">{getScoreTextLabel(benchmarkData.my_score)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.max((benchmarkData.my_score / 100) * 100, 4)}%` }}
                  />
                </div>
              </div>

              {/* 업종 평균 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">업종 평균</span>
                  <span className="text-sm font-semibold text-gray-600">{getScoreTextLabel(benchmarkData.avg_score)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-400 rounded-full transition-all"
                    style={{ width: `${Math.max((benchmarkData.avg_score / 100) * 100, 4)}%` }}
                  />
                </div>
              </div>

              {/* 상위 10% */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">상위 10% 가게</span>
                  <span className="text-sm font-semibold text-gray-600">{getScoreTextLabel(benchmarkData.top10_score)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.max((benchmarkData.top10_score / 100) * 100, 4)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 결과 메시지
                — my_score/avg_score 둘 중 하나라도 0이면 "측정 없음"이지 실제 비교 결과가 아님(falsy-zero)
                — 위 게이지의 텍스트 레이블(양호/보통/주의 필요/시작 전)이 같으면 실제 점수가 달라도
                  "같은 등급인데 왜 높다는거지"로 읽혀 모순처럼 보이므로, 레이블이 같을 땐 우열을 단정하지 않음 */}
            {!hasMyScan || benchmarkData.my_score <= 0 || benchmarkData.avg_score <= 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-gray-700">
                  아직 비교할 측정 데이터가 부족합니다
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  스캔을 실행하면 업종 평균과 비교한 내 위치를 확인할 수 있습니다.
                </p>
              </div>
            ) : getScoreTextLabel(benchmarkData.my_score) === getScoreTextLabel(benchmarkData.avg_score) ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-gray-700">
                  업종 평균과 비슷한 수준입니다
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  가이드의 개선 방법을 실천하면 격차를 벌릴 수 있습니다.
                </p>
              </div>
            ) : benchmarkData.my_score >= benchmarkData.avg_score ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-blue-800">
                  업종 평균보다 높습니다 ✓
                </p>
                <p className="text-sm text-blue-600 mt-0.5">
                  꾸준히 유지하면 상위 가게에 가까워집니다.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">
                    업종 평균보다 낮습니다
                  </p>
                  <p className="text-sm text-amber-600 mt-0.5">
                    가이드를 따라 하면 평균에 가까워질 수 있습니다.
                  </p>
                </div>
                <Link
                  href="/guide"
                  className="text-sm text-amber-700 font-semibold underline shrink-0"
                >
                  개선 가이드 보기 →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">
              아직 비교할 업종 데이터가 충분하지 않습니다.
            </p>
            <p className="text-sm text-gray-300 mt-1">더 많은 가게가 등록될수록 정확해집니다.</p>
          </div>
        )}
      </div>

      {/* 섹션 3: 이번 달 성과 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">이번 달 성과</h2>
        <p className="text-sm text-gray-400 mb-5">
          이번 달 가장 높은 점수와 지난달을 비교합니다
        </p>

        {thisMonthBest !== null ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex-1 text-center">
                <p className="text-sm text-blue-500 font-medium mb-1">이번 달 최고 상태</p>
                <p className={`text-lg font-bold ${thisMonthBest >= 75 ? 'text-emerald-600' : thisMonthBest >= 55 ? 'text-blue-600' : thisMonthBest >= 30 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {getScoreTextLabel(thisMonthBest)}
                </p>
              </div>
              {lastMonthBest !== null && (
                <>
                  <span className="text-2xl text-gray-300 hidden sm:block">→</span>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 flex-1 text-center">
                    <p className="text-sm text-gray-400 font-medium mb-1">지난달 최고 상태</p>
                    <p className="text-lg font-bold text-gray-500">{getScoreTextLabel(lastMonthBest)}</p>
                  </div>
                </>
              )}
            </div>

            {monthDelta !== null && (
              monthDelta > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <p className="text-sm font-semibold text-green-800">
                    지난달보다 개선됐습니다!
                  </p>
                </div>
              ) : monthDelta < 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm font-semibold text-amber-800 flex-1">
                    지난달보다 낮아졌습니다. 가이드를 확인해 보세요.
                  </p>
                  <Link href="/guide" className="text-sm text-amber-700 font-semibold underline shrink-0">
                    가이드 보기 →
                  </Link>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-600">지난달과 같은 수준을 유지하고 있습니다.</p>
                </div>
              )
            )}

            {lastMonthBest === null && (
              <p className="text-sm text-gray-400">지난달 스캔 기록이 없어 비교할 수 없습니다.</p>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">이번 달 아직 스캔 기록이 없습니다.</p>
            <Link
              href="/dashboard"
              className="mt-3 inline-block text-sm text-blue-600 font-semibold underline"
            >
              대시보드에서 AI 스캔 하기 →
            </Link>
          </div>
        )}
      </div>

      {/* 섹션 4: 개선 전·후 비교 이미지 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">개선 전·후 비교</h2>
        <p className="text-sm text-gray-400 mb-5">
          스캔을 반복할수록 내 가게의 변화를 사진으로 기록합니다
        </p>

        {growthCardUrl ? (
          <div>
            <img
              src={growthCardUrl}
              alt="개선 전후 비교 이미지"
              className="w-full max-w-sm mx-auto rounded-xl shadow-md"
            />
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={growthCardUrl}
                download="aeolab-growth-card.png"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                이미지 다운로드
              </a>
              <div className="relative">
                <button
                  type="button"
                  onClick={handleGrowthShare}
                  aria-label="카카오톡으로 성장 카드 공유"
                  className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  카톡으로 공유
                </button>
                {shareToast && (
                  <div
                    role="status"
                    className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] whitespace-nowrap bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg shadow-lg z-50"
                  >
                    {shareToast}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center border border-dashed border-gray-200 rounded-xl">
            <span className="text-4xl">🖼</span>
            <p className="text-sm font-semibold text-gray-600">아직 비교 이미지가 없습니다</p>
            <p className="text-sm text-gray-400">
              첫 스캔 후 1주일 뒤 자동으로 생성됩니다.
            </p>
          </div>
        )}
      </div>

      {/* 섹션 5: 스캔 기록 목록 */}
      {historyData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">스캔 기록</h2>
          <p className="text-sm text-gray-400 mb-5">AI 스캔을 할 때마다 점수가 기록됩니다</p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 text-gray-400 font-medium text-sm">날짜</th>
                  <th className="text-right py-2 pr-3 text-gray-400 font-medium text-sm">전체 상태</th>
                  <th className="text-right py-2 pr-3 text-gray-400 font-medium text-sm">네이버 AI</th>
                  <th className="text-right py-2 pr-3 text-gray-400 font-medium text-sm">글로벌 AI</th>
                  <th className="text-right py-2 pr-3 text-gray-400 font-medium text-sm">노출 빈도</th>
                  <th className="text-right py-2 text-gray-400 font-medium text-sm">주간 변화</th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.map((entry, idx) => {
                  const isLatest = idx === 0;
                  const weeklyChange = entry.weekly_change ?? null;
                  const expFreq = entry.exposure_freq ?? null;
                  return (
                    <tr
                      key={entry.scanned_at ?? entry.score_date ?? String(idx)}
                      className={`border-b border-gray-50 last:border-0 ${isLatest ? "bg-blue-50" : ""}`}
                    >
                      <td className="py-3 pr-3 text-gray-600">
                        <span className="whitespace-nowrap">{formatDateFull(entry.scanned_at ?? entry.score_date)}</span>
                        {isLatest && (
                          <span className="ml-2 text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            최신
                          </span>
                        )}
                      </td>
                      <td className={`py-3 pr-3 text-right font-bold text-sm ${isLatest ? "text-blue-600" : "text-gray-600"}`}>
                        {getScoreTextLabel(entry.unified_score)}
                      </td>
                      <td className="py-3 pr-3 text-right text-blue-500 font-medium text-sm">
                        {getScoreTextLabel(entry.track1_score)}
                      </td>
                      <td className="py-3 pr-3 text-right text-purple-500 font-medium text-sm">
                        {getScoreTextLabel(entry.track2_score ?? 0)}
                      </td>
                      <td className="py-3 pr-3 text-right text-gray-500 text-sm">
                        {expFreq !== null ? `${Math.round(expFreq)}회 / ${entry.sample_size ?? 100}` : "–"}
                      </td>
                      <td className={`py-3 text-right font-semibold text-sm ${weeklyChange === null ? "text-gray-300" : weeklyChange > 2 ? "text-emerald-600" : weeklyChange < -2 ? "text-red-500" : "text-gray-400"}`}>
                        {weeklyChange === null ? "–" : weeklyChange > 2 ? "↑ 상승" : weeklyChange < -2 ? "↓ 하락" : "— 유지"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {historyData.length > 5 && (
            <button
              onClick={() => setShowAllHistory((prev) => !prev)}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showAllHistory
                ? "접기 ▲"
                : `전체 ${historyData.length}개 기록 보기 ▼`}
            </button>
          )}
        </div>
      )}

      {/* CTA: 가이드 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-blue-900 mb-2">
          점수를 올리고 싶다면?
        </h2>
        <p className="text-sm md:text-base text-blue-700 leading-relaxed mb-4">
          AI 개선 가이드에서 오늘 바로 할 수 있는 방법을 확인해 보세요.
          스마트플레이스 소개글 안 Q&A 추가, 리뷰 답변 방법 등을 단계별로 안내합니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/guide"
            className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold px-5 py-3 rounded-xl transition-colors min-h-[44px]"
          >
            AI 개선 가이드 보기 →
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 text-base font-semibold px-5 py-3 rounded-xl border border-gray-200 transition-colors min-h-[44px]"
          >
            대시보드로
          </Link>
        </div>
      </div>
    </div>
  );
}
