"use client";

import { useState } from "react";
import Link from "next/link";
import { apiBase } from "@/lib/api";

export type AiInfoTabStatus = "not_visible" | "off" | "on" | "disabled" | "unknown";

interface Props {
  bizId: string;
  accessToken: string;
  currentStatus: AiInfoTabStatus;
  eligibility: "active" | "likely" | "inactive";
  explanation: string;
  onUpdated?: () => void;
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
  explanation,
  onUpdated,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<AiInfoTabStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);

  // 비대상 업종은 이 카드 표시 불필요 — IneligibleBusinessNotice가 대신 안내
  if (eligibility === "inactive") return null;

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

  return (
    <div className="rounded-lg border bg-white p-4 md:p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl" aria-hidden="true">{current.icon}</span>
        <div className="flex-1">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1">
            AI 브리핑 노출 설정
          </h3>
          <span className={`inline-block px-2 py-1 rounded border text-sm font-medium ${current.color}`}>
            {current.label}
          </span>
        </div>
      </div>

      <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
        {explanation}
      </p>

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
            &quot;AI 정보&quot; 탭이 안 보이면 &quot;메뉴 없음&quot;을 선택하세요. 비대상 업종일 가능성이 높습니다.
          </p>
          <Link
            href="/guide/ai-info-tab"
            className="inline-block mt-3 text-sm md:text-base text-blue-700 hover:underline font-medium"
          >
            자세한 가이드 보기 &rarr;
          </Link>
        </div>
      </details>

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
    </div>
  );
}
