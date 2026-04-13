"use client";

import Link from "next/link";

interface TrialScanEntry {
  scanned_at: string;
  unified_score: number;
  track1_score: number;
  growth_stage: string;
  score_breakdown: Record<string, number>;
}

interface TimelineEntry {
  scanned_at: string;
  unified_score: number;
  track1_score: number;
  growth_stage: string;
  score_breakdown: Record<string, number>;
  delta: number;
}

interface GrowthDriver {
  label: string;
  key: string;
  delta: number;
  current: number;
}

interface GrowthReport {
  business_name: string;
  category: string;
  region: string;
  plan: string;
  days_active: number;
  trial_scan: TrialScanEntry | null;
  timeline: TimelineEntry[];
  summary: {
    start_score: number;
    current_score: number;
    total_delta: number;
    start_grade: string;
    current_grade: string;
    start_stage: string;
    current_stage: string;
    scan_count: number;
  };
  growth_drivers: GrowthDriver[];
  next_goal: {
    target_score: number;
    target_grade: string;
    gap: number;
    action: string;
  };
  locked: boolean;
}

interface Props {
  data: GrowthReport;
}

function scoreToGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    survival: "생존기",
    stable: "안정기",
    growth: "성장기",
    dominant: "지배기",
  };
  return map[stage] ?? stage;
}

function stageBadgeColor(stage: string): string {
  const map: Record<string, string> = {
    survival: "bg-red-100 text-red-700",
    stable: "bg-amber-100 text-amber-700",
    growth: "bg-blue-100 text-blue-700",
    dominant: "bg-green-100 text-green-700",
  };
  return map[stage] ?? "bg-gray-100 text-gray-700";
}

function stageBadgeColorInner(stage: string): string {
  const map: Record<string, string> = {
    survival: "bg-red-50 text-red-600",
    stable: "bg-amber-50 text-amber-600",
    growth: "bg-blue-50 text-blue-600",
    dominant: "bg-green-50 text-green-600",
  };
  return map[stage] ?? "bg-gray-50 text-gray-600";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface TimelineRowProps {
  date: string;
  score: number;
  grade: string;
  stage: string;
  delta: number | null;
  isTrial: boolean;
  isCurrent: boolean;
}

function TimelineRow({ date, score, grade, stage, delta, isTrial, isCurrent }: TimelineRowProps) {
  const dotClass = isTrial
    ? "w-3 h-3 bg-amber-400 rotate-45 rounded-sm shrink-0"
    : isCurrent
    ? "w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-200 shrink-0"
    : "w-3 h-3 rounded-full bg-blue-400 shrink-0";

  return (
    <div className="flex items-start gap-4 pb-5 last:pb-0">
      <div className="relative z-10 mt-0.5 flex items-center justify-center w-7 h-7 shrink-0">
        <div className={dotClass} />
      </div>

      <div
        className={`flex-1 min-w-0 pb-4 border-b border-gray-100 last:border-0 ${
          isCurrent ? "rounded-xl bg-green-50 border border-green-100 p-3 -ml-1" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">{date}</span>
          {isTrial && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              체험 스캔 (가입 전)
            </span>
          )}
          {isCurrent && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              ← 현재
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
          <span
            className={`text-2xl md:text-3xl font-bold ${
              isCurrent ? "text-green-700" : isTrial ? "text-amber-600" : "text-blue-600"
            }`}
          >
            {score}점
          </span>
          <span className="text-sm font-medium text-gray-500">{grade}등급</span>
          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${stageBadgeColorInner(stage)}`}>
            {stageLabel(stage)}
          </span>

          {delta !== null && delta !== 0 && (
            <span
              className={`text-sm font-semibold ${
                delta > 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}점{delta > 0 ? " ↑" : " ↓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LockedTimelinePlaceholder() {
  return (
    <div className="pl-11 space-y-3 py-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 opacity-40 select-none">
          <div className="w-3 h-3 rounded-full bg-blue-300 shrink-0" />
          <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function GrowthClient({ data }: Props) {
  const { summary, next_goal, growth_drivers, timeline, trial_scan, locked } = data;

  const maxDelta = Math.max(...growth_drivers.map((d) => Math.abs(d.delta)), 1);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📈</span>
            <span>{data.business_name} 성장 리포트</span>
          </h1>
        </div>
        <p className="text-sm md:text-base text-gray-500 mt-1">
          {data.region} · {data.category} · 가입{" "}
          <span className="font-medium text-gray-700">{data.days_active}일</span>째
        </p>
      </div>

      {/* 섹션 A: 핵심 변화 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 카드 1 — 점수 성장 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5 border border-gray-100">
          <p className="text-sm text-gray-500 font-medium mb-3">점수 성장</p>
          <div className="flex items-end gap-2 mb-1">
            <span className="text-3xl md:text-4xl font-bold text-gray-400">
              {Math.round(summary.start_score)}
            </span>
            <span className="text-lg text-gray-400 mb-1">→</span>
            <span className="text-3xl md:text-4xl font-bold text-blue-600">
              {Math.round(summary.current_score)}
            </span>
            <span className="text-base text-gray-500 mb-1">점</span>
          </div>
          {summary.total_delta !== 0 && (
            <div
              className={`text-sm font-semibold mb-2 ${
                summary.total_delta > 0 ? "text-blue-600" : "text-red-500"
              }`}
            >
              {summary.total_delta > 0 ? "+" : ""}
              {summary.total_delta.toFixed(1)}점{" "}
              {summary.total_delta > 0 ? "↑" : "↓"}
            </div>
          )}
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{summary.start_grade}</span>등급 →{" "}
            <span className="font-medium text-blue-700">{summary.current_grade}</span>등급
          </div>
        </div>

        {/* 카드 2 — 성장 단계 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5 border border-gray-100">
          <p className="text-sm text-gray-500 font-medium mb-3">성장 단계</p>
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${stageBadgeColor(summary.start_stage)}`}>
              {stageLabel(summary.start_stage)}
            </span>
            <span className="text-gray-400">→</span>
            <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${stageBadgeColor(summary.current_stage)}`}>
              {stageLabel(summary.current_stage)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            스캔 <span className="font-semibold text-gray-700">{summary.scan_count}회</span> 완료
          </p>
        </div>

        {/* 카드 3 — 다음 목표 */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-5 border border-gray-100">
          <p className="text-sm text-gray-500 font-medium mb-3">다음 목표</p>
          <div className="mb-1">
            <span className="text-2xl md:text-3xl font-bold text-amber-600">
              {next_goal.target_grade}
            </span>
            <span className="text-base text-gray-500 ml-1">등급까지</span>
          </div>
          <p className="text-sm font-semibold text-amber-700 mb-2">
            {next_goal.gap.toFixed(1)}점 남음
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">{next_goal.action}</p>
        </div>
      </div>

      {/* 섹션 B: 성장 타임라인 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-100">
          <h2 className="text-base md:text-lg font-semibold text-gray-800">성장 타임라인</h2>
          <p className="text-sm text-gray-400 mt-0.5">스캔할 때마다 기록이 쌓입니다</p>
        </div>

        <div className="px-4 md:px-6 py-5">
          {locked && (
            <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-blue-800 mb-1">
                🔒 구독하면 성장 기록이 쌓입니다
              </p>
              <p className="text-sm text-blue-600 mb-3">
                구독 후 스캔할 때마다 여기에 기록이 추가됩니다
              </p>
              <Link
                href="/pricing"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Basic 구독 시작 → 9,900원/월
              </Link>
            </div>
          )}

          <div className="relative">
            {/* 세로 연결선 */}
            <div className="absolute left-3.5 top-4 bottom-4 w-px bg-gray-200" />

            <div className="space-y-0">
              {trial_scan && (
                <TimelineRow
                  date={formatDate(trial_scan.scanned_at)}
                  score={Math.round(trial_scan.unified_score)}
                  grade={scoreToGrade(trial_scan.unified_score)}
                  stage={trial_scan.growth_stage}
                  delta={null}
                  isTrial={true}
                  isCurrent={false}
                />
              )}

              {locked ? (
                <LockedTimelinePlaceholder />
              ) : timeline.length === 0 ? (
                <div className="pl-10 py-4 text-sm text-gray-400">
                  아직 구독 후 스캔 기록이 없습니다. 대시보드에서 첫 스캔을 실행해보세요.
                </div>
              ) : (
                timeline.map((entry, idx) => (
                  <TimelineRow
                    key={entry.scanned_at}
                    date={formatDate(entry.scanned_at)}
                    score={Math.round(entry.unified_score)}
                    grade={scoreToGrade(entry.unified_score)}
                    stage={entry.growth_stage}
                    delta={entry.delta}
                    isTrial={false}
                    isCurrent={idx === timeline.length - 1}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 섹션 C: 성장 드라이버 분석 */}
      {!locked && growth_drivers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">
            무엇이 점수를 올렸나?
          </h2>
          <p className="text-sm text-gray-400 mb-5">항목별 점수 변화량</p>

          <div className="space-y-4">
            {growth_drivers.map((driver) => {
              const barWidth =
                Math.abs(driver.delta) > 0
                  ? Math.round((Math.abs(driver.delta) / maxDelta) * 100)
                  : 4;
              const isPositive = driver.delta > 0;
              const isNeutral = Math.abs(driver.delta) < 0.1;

              return (
                <div key={driver.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm md:text-base font-medium text-gray-700">
                      {driver.label}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        isNeutral
                          ? "text-gray-400"
                          : isPositive
                          ? "text-blue-600"
                          : "text-red-500"
                      }`}
                    >
                      {isNeutral
                        ? "변화 없음"
                        : `${isPositive ? "+" : ""}${driver.delta.toFixed(1)}점`}
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isNeutral ? "bg-gray-300" : isPositive ? "bg-blue-500" : "bg-red-400"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 섹션 D: 다음 단계 가이드 CTA */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-base md:text-lg font-semibold text-blue-900 mb-1">
            🎯 {next_goal.target_grade}등급 달성을 위해 지금 바로 할 수 있는 것
          </h2>
          <p className="text-sm md:text-base text-blue-700 leading-relaxed">
            {next_goal.action}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/guide"
            className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            AI 개선 가이드 보기 →
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl border border-gray-200 transition-colors"
          >
            대시보드로
          </Link>
        </div>
      </div>
    </div>
  );
}
