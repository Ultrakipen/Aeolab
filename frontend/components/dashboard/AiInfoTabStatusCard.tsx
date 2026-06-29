"use client";

import { useState } from "react";
import Link from "next/link";
import { apiBase } from "@/lib/api";

export type AiInfoTabStatus = "not_visible" | "off" | "on" | "disabled" | "unknown";

// M3 사전 작업: Q2 광고 도입 감지 시 true로 변경 → 광고/자연 배지 즉시 활성화
// 트리거: docs/remaining_tasks_v1.0.md §9-C 수동 모니터링 명령으로 광고 감지 후 변경
const NAVER_AD_IN_BRIEFING_ACTIVE = true;

interface Props {
  bizId: string;
  accessToken: string;
  currentStatus: AiInfoTabStatus;
  eligibility: "active" | "likely" | "inactive";
  /** AI탭은 업종 무관 항상 "beta" — get_ai_tab_eligibility() 반환값 */
  aiTabEligibility?: "beta";
  explanation: string;
  onUpdated?: () => void;
  /** 최근 스캔의 naver_result.ad_only — 광고 영역 노출 여부 (M3 사전 작업) */
  adOnly?: boolean;
}

const STATUS_LABELS: Record<AiInfoTabStatus, { label: string; color: string; icon: string }> = {
  on:          { label: "ON 상태 (정상)",          color: "text-green-700 bg-green-50 border-green-200",  icon: "✅" },
  off:         { label: "OFF 상태 (즉시 변경 필요)", color: "text-red-700 bg-red-50 border-red-200",       icon: "🚨" },
  disabled:    { label: "비활성 (조건 미달)",        color: "text-amber-700 bg-amber-50 border-amber-200", icon: "⚠️" },
  not_visible: { label: "메뉴 없음 (비대상 업종)",   color: "text-gray-600 bg-gray-50 border-gray-200",   icon: "ℹ️" },
  unknown:     { label: "아직 확인 안함",           color: "text-blue-700 bg-blue-50 border-blue-200",    icon: "❓" },
};

export function AiInfoTabStatusCard({
  bizId,
  accessToken,
  currentStatus,
  eligibility,
  aiTabEligibility,
  explanation,
  onUpdated,
  adOnly,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AiInfoTabStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);

  // AI탭은 모든 업종 가능(beta) — INACTIVE여도 카드를 표시하되 안내 톤 분기
  // 단, aiTabEligibility prop이 없고 eligibility가 inactive일 때는 기존처럼 숨김
  // (하위 호환: DashboardInsightZone에서 aiTabEligibility 전달 후 제거 가능)
  if (eligibility === "inactive" && aiTabEligibility !== "beta") return null;

  const handleChange = async (newStatus: AiInfoTabStatus) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/businesses/${bizId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ai_info_tab_status: newStatus }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setStatus(newStatus);
      onUpdated?.();
    } catch {
      setError("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const current = STATUS_LABELS[status];

  // INACTIVE 업종은 "아직 확인 안함" 배지 대신 비대상 안내로 덮어쓰기
  const displayBadge =
    eligibility === "inactive"
      ? { label: "플레이스형 AI 브리핑 비대상 업종", color: "text-gray-500 bg-gray-50 border-gray-200", icon: "ℹ️" }
      : current;

  // 업종별 안내 톤 분기
  const eligibilityBanner =
    eligibility === "active" ? (
      <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
        AI 브리핑 + AI탭 양면 최적화 대상 업종입니다. 아래에서 AI 정보 탭 상태를 확인·설정하세요.
      </div>
    ) : eligibility === "likely" ? (
      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
        AI탭 우선 최적화 업종입니다. AI 브리핑은 네이버 확대 정책에 따라 추가될 예정입니다.
      </div>
    ) : eligibility === "inactive" ? (
      <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <strong>플레이스형 네이버 AI 브리핑 비대상 업종입니다.</strong>{" "}
        단, 블로그·콘텐츠가 갖춰지면 <strong>'정보형 AI 브리핑'</strong>에 노출될 수 있습니다. <strong>AI탭은 업종 공식 제한 없음</strong> — 정식 출시됐으며 모든 업종이 노출될 수 있습니다.
        ChatGPT·Gemini 글로벌 AI 채널 최적화도 함께 진행하세요.
      </div>
    ) : null;

  return (
    <div className="rounded-xl border bg-white p-4 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl" aria-hidden="true">{displayBadge.icon}</span>
        <div className="flex-1">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-0.5">
            네이버 AI 브리핑 노출 설정
          </h3>
          {eligibility !== "inactive" && (
            <p className="text-sm text-gray-500 mb-1.5">
              스마트플레이스 &gt; <strong className="text-gray-700">&quot;AI 정보&quot; 탭</strong> 토글로 ON/OFF 변경
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block px-2 py-1 rounded border text-sm font-medium ${displayBadge.color}`}>
              {displayBadge.label}
            </span>
            {/* M3 광고/자연 구분 배지 — INACTIVE 업종에는 표시 안 함 */}
            {NAVER_AD_IN_BRIEFING_ACTIVE && adOnly !== undefined && eligibility !== "inactive" && (
              adOnly ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded border text-sm font-medium bg-gray-100 border-gray-300 text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                  광고 영역 (점수 0점)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded border text-sm font-medium bg-green-50 border-green-300 text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  자연 영역
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {eligibilityBanner}

      {explanation && (
        <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
          {explanation}
        </p>
      )}

      {eligibility !== "inactive" && (
      <details className="mb-4">
        <summary className="text-sm md:text-base font-medium text-blue-700 cursor-pointer hover:text-blue-900 select-none">
          확인 방법 보기 (1분)
        </summary>
        <div className="mt-3 p-3 md:p-4 bg-blue-50 rounded text-sm md:text-base text-gray-700 leading-relaxed">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>smartplace.naver.com 로그인</li>
            <li>&quot;내 업체정보&quot; 또는 &quot;업체정보&quot; 메뉴 클릭</li>
            <li>&quot;AI 정보&quot; 탭 클릭</li>
            <li>&quot;AI 브리핑 노출하기&quot; 토글 → ON</li>
          </ol>
          <p className="mt-2 text-amber-700 font-medium">
            &quot;AI 정보&quot; 탭이 안 보이면 &quot;메뉴 없음&quot;을 선택하세요.
            리뷰 수 부족·조건 미충족이거나, 확대 예상 업종이면 향후 추가됩니다.
          </p>
          <Link
            href="/guide/ai-info-tab"
            className="inline-block mt-3 text-sm md:text-base text-blue-700 hover:underline font-medium"
          >
            자세한 가이드 보기 &rarr;
          </Link>
        </div>
      </details>
      )}

      {eligibility !== "inactive" && (
      <div className="space-y-2">
        <label htmlFor={`ai-info-tab-${bizId}`} className="block text-sm md:text-base font-medium text-gray-900">
          확인하신 상태:
        </label>
        <select
          id={`ai-info-tab-${bizId}`}
          value={status}
          onChange={(e) => handleChange(e.target.value as AiInfoTabStatus)}
          disabled={saving}
          className="w-full p-2.5 md:p-3 border rounded text-sm md:text-base bg-white disabled:opacity-60"
        >
          <option value="unknown">아직 확인 안함</option>
          <option value="on">메뉴 있고 ON 상태</option>
          <option value="off">메뉴 있고 OFF 상태 (즉시 변경 필요!)</option>
          <option value="disabled">메뉴 있는데 비활성 (회색)</option>
          <option value="not_visible">&quot;AI 정보&quot; 메뉴가 보이지 않음</option>
        </select>
        {saving && <p className="text-sm text-gray-500">저장 중...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      )}
    </div>
  );
}
