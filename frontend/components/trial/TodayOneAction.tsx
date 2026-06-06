"use client";

import { useState } from "react";
import { Zap, Clock, AlertTriangle } from "lucide-react";

interface TodayOneActionProps {
  isSmartPlace: boolean;
  missingKws: string[];
  hasFaq: boolean;
  inBriefing: boolean | null;
  faqText: string | null;
  selectedTags: string[];
  categoryLabel: string;
  userGroup?: string;
  category?: string;
  isLoggedIn?: boolean;
  onDismissKw?: (kw: string) => void;
}

interface Action {
  title: string;
  desc: string;
  copy?: string;
  copyLabel?: string;
  time: string;
  primary?: boolean;
}

function p(word: string, jong: "은는" | "을를" | "이가"): string {
  if (!word) return jong[1];
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return jong[1];
  return (code - 0xac00) % 28 !== 0 ? jong[0] : jong[1];
}

function getBusinessWord(category?: string): string {
  const menuCats = ["restaurant", "cafe", "bakery", "bar", "accommodation"];
  const programCats = ["fitness", "yoga", "pet"];
  const lessonCats = ["education", "tutoring"];
  if (category && menuCats.includes(category)) return "메뉴";
  if (category && programCats.includes(category)) return "프로그램";
  if (category && lessonCats.includes(category)) return "수업";
  return "서비스";
}

function ActionCard({
  action,
  index,
  isLoggedIn,
  onDismissKw,
  missingKws,
}: {
  action: Action;
  index: number;
  isLoggedIn?: boolean;
  onDismissKw?: (kw: string) => void;
  missingKws?: string[];
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    if (!action.copy) return;
    try {
      await navigator.clipboard.writeText(action.copy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = action.copy;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 3000);
      }
    }
  };

  return (
    <div
      className={`rounded-xl p-4 md:p-5 ${
        action.primary
          ? "bg-white border-2 border-emerald-400 shadow-sm"
          : "bg-emerald-50 border border-emerald-200"
      }`}
    >
      {/* 액션 제목 + 순번 */}
      <div className="flex items-start gap-3 mb-2">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5 ${
            action.primary ? "bg-emerald-600 text-white" : "bg-emerald-200 text-emerald-700"
          }`}
        >
          {index + 1}
        </span>
        <p className="text-base md:text-lg font-bold text-emerald-900 leading-snug break-keep flex-1">
          {action.title}
        </p>
        <span className="text-sm text-emerald-600 shrink-0 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {action.time}
        </span>
      </div>

      {/* 설명 */}
      <p className="text-sm md:text-base text-emerald-800 leading-relaxed mb-3 break-keep pl-9">
        {action.desc}
      </p>

      {/* 복사 문구 */}
      {action.copy && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3 ml-9">
          {action.copyLabel === "Q&A 문구 복사" && (
            <p className="flex items-center gap-1.5 text-sm text-amber-700 mb-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              복사 후 [ ] 괄호 안 내용을 내 가게에 맞게 수정하세요
            </p>
          )}
          <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-line break-keep">
            {action.copy}
          </p>
        </div>
      )}

      {/* 버튼 */}
      <div className="flex flex-col sm:flex-row gap-2 pl-9">
        {action.copy && (
          <button
            onClick={handleCopy}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
              copied
                ? "bg-emerald-500 text-white"
                : copyFailed
                ? "bg-amber-500 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {copied ? "✓ 복사됨!" : copyFailed ? "직접 선택 후 복사하세요" : action.copyLabel}
          </button>
        )}
        {action.primary && (
          <a
            href={isLoggedIn ? "/dashboard" : "/signup?redirect=/dashboard"}
            className="flex-1 text-center py-2.5 rounded-lg font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all"
          >
            {isLoggedIn ? "이렇게 따라하기" : "무료 가입 후 따라하기"}
          </a>
        )}
        {onDismissKw && missingKws && missingKws.length > 0 && (index === 1 || index === 2) && (
          <button
            onClick={() => onDismissKw(missingKws[0])}
            className="flex-1 text-center py-2.5 rounded-lg text-sm font-medium text-emerald-700 border border-emerald-400 hover:bg-emerald-50 transition-colors"
          >
            이 키워드 건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}

export default function TodayOneAction({
  isSmartPlace,
  missingKws,
  hasFaq,
  inBriefing,
  faqText,
  selectedTags,
  categoryLabel,
  userGroup,
  category,
  isLoggedIn,
  onDismissKw,
}: TodayOneActionProps) {
  const isGlobalFocus = userGroup === "INACTIVE" || userGroup === "franchise";
  const bw = getBusinessWord(category);
  const [showAll, setShowAll] = useState(false);

  // ── 실행 가능한 액션 목록 구성 ──────────────────────────────────────
  const actions: Action[] = [];

  if (isGlobalFocus) {
    if (!isSmartPlace) {
      actions.push({
        title: "Google 비즈니스 프로필 등록하기",
        desc: "ChatGPT·Google AI는 구글 데이터를 기반으로 가게를 추천합니다. business.google.com 무료 등록만으로 글로벌 AI 노출 가능성이 즉시 높아집니다.",
        time: "10분",
        primary: true,
      });
    }
    if (missingKws.length > 0) {
      actions.push({
        title: `소개글에 '${missingKws[0]}' 관련 Q&A 추가하기`,
        desc: `ChatGPT·Gemini는 구조화된 텍스트를 학습합니다. '${missingKws[0]}' 관련 Q&A를 소개글이나 홈페이지에 추가하면 AI 인용 가능성이 높아집니다.`,
        copy:
          faqText ??
          `Q. ${missingKws[0]}에 대해 궁금한 점이 있어요.\nA. 저희 가게의 ${missingKws[0]} ${bw}에 대해 안내드립니다. 자세한 내용은 네이버 지도 채팅이나 전화로 문의해 주시면 친절하게 안내해 드리겠습니다.`,
        copyLabel: "Q&A 문구 복사",
        time: "5분",
        primary: !actions.length,
      });
    }
    actions.push({
      title: "Google 비즈니스 프로필 정보 완성하기",
      desc: "영업시간·카테고리·사진·설명을 완성하면 ChatGPT·Google AI에 인용될 가능성이 높아집니다. business.google.com에서 직접 수정하세요.",
      time: "10분",
      primary: !actions.length,
    });
    actions.push({
      title: "단골 고객에게 블로그 리뷰 부탁하기",
      desc: "네이버 AI 브리핑 대상은 아니지만, 블로그 포스팅·리뷰가 쌓이면 네이버 검색에서 가게가 더 많이 노출됩니다. 방문한 고객에게 네이버 블로그 리뷰를 부탁해 보세요.",
      time: "2분",
      primary: !actions.length,
    });
  } else {
    if (!isSmartPlace) {
      actions.push({
        title: "스마트플레이스 등록하기",
        desc: "네이버 지도·플레이스에 가게를 등록하면 네이버 AI 브리핑·검색 노출에 나올 수 있습니다. smartplace.naver.com에서 무료로 등록하세요.",
        time: "10분",
        primary: true,
      });
    }

    if (missingKws.length > 0 && !hasFaq) {
      const isActiveGroup = userGroup === "ACTIVE";
      actions.push({
        title: `소개글에 '${missingKws[0]}' Q&A 추가하기`,
        desc: isActiveGroup
          ? `스마트플레이스 → 업체정보 → 소개글에 '${missingKws[0]}' 관련 Q&A를 자연스럽게 포함하면 됩니다. 소개글 안의 Q&A 섹션이 네이버 AI 브리핑 인용 후보로 가장 효과적입니다.`
          : `스마트플레이스 → 업체정보 → 소개글에 '${missingKws[0]}' 관련 Q&A를 자연스럽게 포함하면 됩니다. 소개글 최적화는 네이버 AI탭 노출에 효과적입니다. ChatGPT·Gemini는 구글 비즈니스 프로필 등록이 더 직접적입니다.`,
        copy:
          faqText ??
          `Q. ${missingKws[0]}${p(missingKws[0], "은는")} 어떤가요?\nA. 저희 가게의 ${missingKws[0]} ${bw}${p(bw, "을를")} 경험해 보세요. 궁금한 점은 네이버 채팅으로 편하게 문의해 주세요.`,
        copyLabel: "Q&A 문구 복사",
        time: "5분",
        primary: !actions.length,
      });
    }

    if (missingKws.length > 0) {
      actions.push({
        title: `리뷰 답변에 '${missingKws[0]}' 언급하기`,
        desc: `최근 받은 리뷰에 답변할 때 '${missingKws[0]}'를 자연스럽게 포함하세요. 리뷰 답변 텍스트도 AI가 학습하는 콘텐츠입니다.`,
        copy: `소중한 리뷰 감사합니다. 앞으로도 ${missingKws[0]} 면에서 더 좋은 경험을 드리겠습니다. 또 방문해 주세요.`,
        copyLabel: "답변 문구 복사",
        time: "2분",
        primary: !actions.length,
      });
    }

    const isExposed = inBriefing === true;
    const safeTag =
      selectedTags[0] && selectedTags[0].length <= 5 && !selectedTags[0].includes(" ")
        ? selectedTags[0]
        : null;
    actions.push({
      title: isExposed
        ? "소식 업데이트로 AI 브리핑 노출 순위 유지하기"
        : "소식(포스팅) 1개 등록으로 최신성 점수 높이기",
      desc: isExposed
        ? "현재 AI 브리핑에 노출 중입니다. 주 1회 소식 작성으로 최신성 점수를 유지하면 노출 순위를 지킬 수 있습니다."
        : "스마트플레이스 → 소식 → 새 소식 작성으로 주 1회 업데이트하면 AI가 '운영 중'으로 인식해 네이버 AI 브리핑 노출 가능성이 높아집니다.",
      copy: safeTag
        ? `저희 ${categoryLabel}의 새 소식입니다.\n${safeTag} 관련 업데이트를 전해드립니다. 궁금하신 점은 네이버 채팅으로 문의해 주세요.`
        : `저희 ${categoryLabel}의 새 소식입니다.\n최근 업데이트된 내용을 안내드립니다. 방문해 주시는 모든 분께 감사드립니다.`,
      copyLabel: "소식 문구 복사",
      time: "5분",
      primary: !actions.length,
    });
  }

  // 첫 번째 항목이 primary 미설정 시 보정
  if (actions.length > 0 && !actions.some((a) => a.primary)) {
    actions[0] = { ...actions[0], primary: true };
  }

  return (
    <section className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 md:p-6 mb-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-emerald-600 shrink-0" />
        <p className="text-sm md:text-base font-semibold text-emerald-800">
          지금 바로 할 수 있는 개선 액션
        </p>
      </div>

      {/* 키워드 면책 박스 */}
      {missingKws.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-sm text-amber-800 leading-relaxed">
            아래 키워드는 <strong>업종 경쟁사 분석</strong>으로 자동 추출되었습니다. 내 가게에 해당하지 않는 항목은 건너뛰세요.
            구독 후 정식 스캔에서도 동일한 방식으로 제안되며, 관련 없는 키워드는 삭제할 수 있습니다.
          </p>
        </div>
      )}

      {/* 액션별 상세 카드 */}
      <div className="space-y-3">
        {(showAll ? actions : actions.slice(0, 1)).map((action, i) => (
          <ActionCard
            key={i}
            action={action}
            index={i}
            isLoggedIn={isLoggedIn}
            onDismissKw={onDismissKw}
            missingKws={missingKws}
          />
        ))}
        {!showAll && actions.length > 1 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-3 text-sm font-semibold text-emerald-700 border border-emerald-300 rounded-xl hover:bg-emerald-50 transition-colors"
          >
            나머지 {actions.length - 1}가지 개선 방법 더 보기 ↓
          </button>
        )}
      </div>
    </section>
  );
}
