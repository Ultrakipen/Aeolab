"use client";

import type { ReactNode } from "react";
import { Check, X, ArrowRight, Minus, AlertTriangle } from "lucide-react";

interface NaverTrackCardProps {
  track1Score: number;
  inBriefing: boolean | null;
  isSmartPlace: boolean;
  blogCount: number;
  hasFaq: boolean;
  hasIntro: boolean;
  userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise";
  businessName: string;
}

function getBriefingBadge(
  inBriefing: boolean | null,
  isSmartPlace: boolean,
  userGroup: string,
): { label: string; colorClass: string; icon: ReactNode } {
  if (userGroup === "INACTIVE" || userGroup === "franchise") {
    return {
      label: "네이버 AI 브리핑 비대상",
      colorClass: "bg-amber-100 text-amber-800 border border-amber-300",
      icon: <Minus className="w-4 h-4" />,
    };
  }
  if (!isSmartPlace) {
    return {
      label: "스마트플레이스 미등록",
      colorClass: "bg-red-100 text-red-800 border border-red-300",
      icon: <X className="w-4 h-4" />,
    };
  }
  if (inBriefing === true) {
    return {
      label: "노출 중",
      colorClass: "bg-green-100 text-green-800 border border-green-300",
      icon: <Check className="w-4 h-4" />,
    };
  }
  if (inBriefing === false) {
    return {
      label: "미노출",
      colorClass: "bg-red-100 text-red-800 border border-red-300",
      icon: <X className="w-4 h-4" />,
    };
  }
  // null — 무료 체험에서 미측정
  return {
    label: "무료 체험 미포함",
    colorClass: "bg-blue-50 text-blue-700 border border-blue-200",
    icon: <ArrowRight className="w-4 h-4" />,
  };
}

function getDeficiencyMessage(
  inBriefing: boolean | null,
  isSmartPlace: boolean,
  hasFaq: boolean,
  blogCount: number,
  userGroup: string,
): string | null {
  if (userGroup === "INACTIVE" || userGroup === "franchise") {
    return "이 업종은 네이버 AI 브리핑 대상이 아닙니다. 네이버 AI탭(모든 업종 베타)과 GPT/Gemini 개선 방안을 함께 실행하세요.";
  }
  if (!isSmartPlace) {
    return "스마트플레이스 미등록 → 네이버 AI 브리핑 노출 불가. 아래 할 일에서 등록 방법을 확인하세요.";
  }
  if (inBriefing === true) {
    return null; // 노출 중이면 결핍 메시지 없음
  }
  if (inBriefing === false && !hasFaq) {
    return "소개글에 Q&A가 없습니다. AI 브리핑 인용 후보 경로 중 가장 먼저 채워야 할 항목입니다.";
  }
  if (inBriefing === false && hasFaq && blogCount < 3) {
    return "Q&A는 있지만 블로그 언급이 부족합니다. 리뷰 요청으로 외부 신뢰 신호를 쌓으세요.";
  }
  if (inBriefing === null && isSmartPlace) {
    return null; // 별도 파란 안내 박스로 처리 (아래 render 참조)
  }
  return null;
}

export default function NaverTrackCard({
  track1Score,
  inBriefing,
  isSmartPlace,
  blogCount,
  hasFaq,
  hasIntro,
  userGroup,
  businessName,
}: NaverTrackCardProps) {
  const isGlobal = userGroup === "INACTIVE" || userGroup === "franchise";

  const bgClass = isGlobal
    ? "bg-amber-50 border-amber-200"
    : "bg-blue-50 border-blue-200";

  const badge = getBriefingBadge(inBriefing, isSmartPlace, userGroup);
  const deficiency = getDeficiencyMessage(
    inBriefing,
    isSmartPlace,
    hasFaq,
    blogCount,
    userGroup,
  );

  const score = Math.round(track1Score);
  // DualTrackCard와 동일한 5단계 척도 (25/45/65/80)
  const scoreColorClass =
    score >= 80
      ? "text-emerald-600"
      : score >= 65
        ? "text-blue-600"
        : score >= 45
          ? "text-amber-600"
          : score >= 25
            ? "text-orange-500"
            : "text-red-500";

  const isNonBriefing = isGlobal || userGroup === "LIKELY";

  return (
    <div className={`rounded-xl border px-4 md:px-5 py-4 mb-4 ${bgClass}`}>

      {/* 비대상 업종 최상단 명시 배너 */}
      {isNonBriefing && (
        <div className="flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-xl px-3 py-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          <p className="text-sm font-bold text-amber-900 break-keep">
            {userGroup === "LIKELY"
              ? "현재 네이버 AI 브리핑 공식 대상 업종이 아닙니다 (확대 검토 중) — AI탭은 지금도 가능"
              : "이 업종은 네이버 AI 브리핑 대상이 아닙니다 — AI탭은 모든 업종 가능"}
          </p>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-0.5">
            {isNonBriefing ? "네이버 플레이스 현황" : "네이버 AI 브리핑"}
          </p>
          <p className="text-sm text-gray-600 leading-snug break-keep">
            {businessName}의 네이버 노출 현황
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm text-gray-500 mb-0.5">네이버 점수</p>
          <p className={`text-2xl font-black ${scoreColorClass}`}>
            {score}
            <span className="text-sm font-normal text-gray-400">/100</span>
          </p>
        </div>
      </div>

      {/* 브리핑 노출 상태 배지 — ACTIVE만 표시 */}
      {!isNonBriefing && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm font-medium text-gray-600">브리핑 상태:</span>
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${badge.colorClass}`}
          >
            <span aria-hidden="true">{badge.icon}</span>
            {badge.label}
          </span>
        </div>
      )}

      {/* 핵심 결핍 메시지 */}
      {deficiency && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-sm font-semibold text-red-800 leading-relaxed break-keep">
            {deficiency}
          </p>
        </div>
      )}

      {/* ACTIVE: 정식 스캔 안내 */}
      {inBriefing === null && userGroup === "ACTIVE" && isSmartPlace && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-sm text-blue-700 leading-relaxed break-keep">
            정식 스캔에서는 네이버 AI 브리핑 노출 여부를 실시간으로 직접 확인합니다.
          </p>
        </div>
      )}

      {/* LIKELY: 대체 채널 안내 */}
      {userGroup === "LIKELY" && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-sm text-blue-700 leading-relaxed break-keep">
            스마트플레이스 정보를 잘 갖추면 네이버 플레이스 노출과 ChatGPT·Gemini의 가게 인식에 도움이 됩니다.
          </p>
        </div>
      )}

      {/* 노출 중인 경우 긍정 메시지 */}
      {inBriefing === true && !isGlobal && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-sm font-semibold text-green-800 leading-relaxed break-keep">
            현재 네이버 AI 브리핑에 노출되고 있습니다. 소식 업데이트로 순위를 유지하세요.
          </p>
        </div>
      )}

      {/* INACTIVE/franchise 안내 */}
      {isGlobal && (
        <div className="bg-amber-100 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-sm font-semibold text-amber-900 leading-relaxed break-keep">
            이 업종의 주요 노출 채널은 네이버 AI탭(모든 업종 베타) + ChatGPT·Gemini입니다. 아래 섹션에서 개선 방법을 확인하세요.
          </p>
        </div>
      )}

      {/* INACTIVE/franchise 업종: 블로그 카운트 + 네이버 검색 노출 안내 */}
      {isGlobal && isSmartPlace && (
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${
                blogCount >= 10
                  ? "bg-green-100 text-green-700"
                  : blogCount > 0
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {blogCount >= 10 ? (
                <Check className="w-4 h-4" />
              ) : blogCount > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}{" "}
              블로그 {blogCount}건
            </span>
            <span
              className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${
                hasIntro ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              {hasIntro ? <Check className="w-4 h-4" /> : <Minus className="w-4 h-4" />} 소개글
            </span>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed break-keep">
            {blogCount < 10
              ? "블로그 포스팅을 늘리면 네이버 AI 브리핑 대상 업종이 아니어도 네이버 지역 검색 노출 가능성이 높아집니다."
              : `블로그 ${blogCount}건 확인됨 — 블로그 언급이 많을수록 네이버 검색 상위 노출 가능성이 높아집니다.`}
          </p>
        </div>
      )}

      {/* 이미지 완성도 힌트 (isSmartPlace이고 ACTIVE/LIKELY인 경우) */}
      {isSmartPlace && !isGlobal && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${hasFaq ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
          >
            {hasFaq ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />} 소개글 Q&A
          </span>
          <span
            className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${hasIntro ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
          >
            {hasIntro ? <Check className="w-4 h-4" /> : <Minus className="w-4 h-4" />} 소개글
          </span>
          <span
            className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full ${blogCount >= 3 ? "bg-green-100 text-green-700" : blogCount > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}
          >
            {blogCount >= 3 ? <Check className="w-4 h-4" /> : blogCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <X className="w-4 h-4" />} 블로그{" "}
            {blogCount}건
          </span>
        </div>
      )}

      {/* 다음 행동 안내 */}
      {!isGlobal && (
        <p className="text-sm text-blue-700 font-medium mt-3 leading-relaxed break-keep">
          → 아래 &lsquo;오늘 할 일&rsquo; 섹션에서 개선 방법을 확인하세요.
        </p>
      )}

      {/* 면책 문구 */}
      <p className="text-sm text-gray-400 mt-3 leading-relaxed">
        업종별 가중치로 계산된 네이버 점수입니다.
      </p>
    </div>
  );
}
