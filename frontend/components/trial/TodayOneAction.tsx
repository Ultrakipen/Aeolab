"use client";

import { useState } from "react";

interface TodayOneActionProps {
  isSmartPlace: boolean;
  missingKws: string[];
  hasFaq: boolean;
  inBriefing: boolean | null;
  faqText: string | null;
  selectedTags: string[];
  categoryLabel: string;
  userGroup?: string; // 'ACTIVE' | 'LIKELY' | 'INACTIVE' | 'franchise'
}

/**
 * 오늘 5분 안에 할 일 (1개만) 섹션 (4섹션 구조의 섹션 3)
 *
 * - 큰 시각 위계: 헤더 text-xl md:text-2xl
 * - 상황 분기로 가장 효과적인 1개 행동만 노출
 * - 복사 버튼 + 가이드 링크
 *
 * (기존 ImmediateActionCard 로직 재활용 — 더 큰 시각 위계, 1개만)
 */
export default function TodayOneAction({
  isSmartPlace,
  missingKws,
  hasFaq,
  inBriefing,
  faqText,
  selectedTags,
  categoryLabel,
  userGroup,
}: TodayOneActionProps) {
  const [copied, setCopied] = useState(false);

  let actionTitle = "";
  let actionDesc = "";
  let actionCopy = "";
  let actionCopyLabel = "";

  const isGlobalFocus = userGroup === "INACTIVE" || userGroup === "franchise";

  if (isGlobalFocus) {
    // INACTIVE/franchise: 글로벌 AI 중심 조언
    if (!isSmartPlace) {
      actionTitle = "Google 비즈니스 프로필 등록하기";
      actionDesc =
        "ChatGPT·Google AI는 구글 데이터를 기반으로 가게를 추천합니다. business.google.com 무료 등록만으로 글로벌 AI 노출 가능성이 즉시 높아집니다. (10분 소요)";
    } else if (missingKws.length > 0) {
      actionTitle = `홈페이지·소개글에 '${missingKws[0]}' 정보 구조화하기`;
      actionDesc = `ChatGPT·Gemini는 구조화된 텍스트 정보를 학습합니다. '${missingKws[0]}' 관련 Q&A(가격·과정·위치)를 홈페이지나 스마트플레이스 소개글에 추가하면 AI 인용 가능성이 높아집니다.`;
      actionCopy =
        faqText ??
        `Q. ${missingKws[0]} 서비스는 어떻게 이용하나요?\nA. 저희는 ${missingKws[0]} 전문 서비스를 제공합니다. 위치: [주소], 연락처: [전화번호], 운영시간: [시간]을 확인 후 방문해 주세요.`;
      actionCopyLabel = "Q&A 문구 복사";
    } else {
      actionTitle = "Google 비즈니스 프로필 정보 완성하기";
      actionDesc =
        "Google 비즈니스 프로필의 영업시간·카테고리·사진·설명을 완성하면 ChatGPT·Google AI에 인용될 가능성이 높아집니다. (business.google.com)";
    }
  } else if (!isSmartPlace) {
    actionTitle = "스마트플레이스 등록부터 시작하세요";
    actionDesc =
      "네이버 지도·플레이스에 가게를 등록하면 네이버 AI 브리핑·검색 노출에 나올 수 있습니다. smartplace.naver.com에서 무료로 5분 안에 등록됩니다.";
  } else if (missingKws.length > 0 && !hasFaq) {
    actionTitle = `소개글에 '${missingKws[0]}' Q&A 추가하기`;
    actionDesc = `스마트플레이스 → 업체정보 → 소개글에 '${missingKws[0]}' 관련 Q&A를 자연스럽게 포함하면 됩니다. 소개글 안의 Q&A 섹션이 네이버 AI 브리핑 인용 후보로 가장 효과적인 경로입니다.`;
    actionCopy =
      faqText ??
      `Q. ${missingKws[0]} 관련해서 어떤 점이 좋나요?\nA. 저희 가게는 ${missingKws[0]} 서비스를 전문으로 하며, 고객 한 분 한 분께 최선을 다해 안내해 드립니다. 언제든 문의 주세요.`;
    actionCopyLabel = "Q&A 문구 복사";
  } else if (missingKws.length > 0) {
    actionTitle = `리뷰 답변에 '${missingKws[0]}' 키워드 넣기`;
    actionDesc = `최근 리뷰에 답변할 때 '${missingKws[0]}'라는 단어를 자연스럽게 포함하세요. AI는 리뷰 답변 텍스트도 학습합니다.`;
    actionCopy = `소중한 리뷰 감사합니다. ${missingKws[0]} 서비스를 더욱 발전시키겠습니다. 앞으로도 많은 이용 부탁드립니다.`;
    actionCopyLabel = "답변 문구 복사";
  } else if (inBriefing === false) {
    actionTitle = "소식(포스팅) 1개 등록으로 최신성 점수 높이기";
    actionDesc =
      "스마트플레이스 → 소식 → 새 소식 작성으로 주 1회 업데이트하면 AI가 '운영 중'으로 인식해 네이버 AI 브리핑 노출 가능성이 높아집니다.";
    actionCopy = `오늘의 소식: 저희 가게에서 ${selectedTags[0] ?? categoryLabel ?? "새로운 서비스"}를 준비했습니다. 더 좋은 서비스로 찾아뵙겠습니다.`;
    actionCopyLabel = "소식 문구 복사";
  } else {
    actionTitle = "스마트플레이스 소개글에 업종 키워드 추가하기";
    actionDesc =
      "소개글에 업종과 지역 키워드를 자연스럽게 포함하면 AI가 더 정확하게 가게를 파악합니다. 한 번만 수정해도 영구적으로 효과가 있습니다.";
  }

  const handleCopy = async () => {
    if (!actionCopy) return;
    try {
      await navigator.clipboard.writeText(actionCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 실패 무시
    }
  };

  return (
    <section className="bg-blue-600 text-white rounded-2xl p-5 md:p-7 mb-4 shadow-lg">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-2xl md:text-3xl">⚡</span>
          <p className="text-sm md:text-base font-semibold text-blue-200">오늘 5분 안에 할 일 (1개만)</p>
        </div>
        <span className="text-xs md:text-sm text-blue-100 font-medium bg-blue-700 px-2.5 py-1 rounded-full shrink-0">
          소요시간: 5~10분
        </span>
      </div>

      {/* 큰 액션 타이틀 */}
      <p className="text-xl md:text-2xl font-black text-white leading-snug mb-3 break-keep">
        {actionTitle}
      </p>

      {/* 설명 */}
      <p className="text-sm md:text-base text-blue-100 leading-relaxed mb-5 break-keep">
        {actionDesc}
      </p>

      {/* 액션 버튼들 */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {actionCopy && (
          <button
            onClick={handleCopy}
            className={`flex-1 py-3 md:py-3.5 rounded-xl font-bold text-sm md:text-base transition-all shadow-md ${
              copied ? "bg-emerald-400 text-white" : "bg-white text-blue-700 hover:bg-blue-50"
            }`}
          >
            {copied ? "✓ 복사됨!" : actionCopyLabel}
          </button>
        )}
        <a
          href="/guide"
          className="flex-1 text-center py-3 md:py-3.5 rounded-xl font-bold text-sm md:text-base bg-blue-500 hover:bg-blue-400 text-white transition-all"
        >
          이렇게 따라하기
          <span className="text-blue-200 font-normal text-xs md:text-sm ml-1">(로그인 필요)</span>
        </a>
      </div>

      {/* 더 자세히 안내 */}
      <p className="text-xs md:text-sm text-blue-200 italic leading-relaxed mt-4 break-keep">
        나머지 행동 가이드는 아래 &lsquo;더 자세히 보기&rsquo;에서 확인할 수 있습니다.
      </p>
    </section>
  );
}
