"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface GlobalAiActionCardProps {
  track2Score: number;
  chatgptMentioned: boolean | undefined;
  chatgptSampleSize: number;
  geminiExposureFreq: number | undefined;
  blogCount: number;
  hasWebsite: boolean | null;
  missingKeywords: string[];
  businessName: string;
  category: string;
  region: string;
  userGroup: string;
}

interface Action {
  id: string;
  title: string;
  timeLabel: string;
  effectLabel: string;
  description: string;
  copyText: string | null;
  copyLabel: string | null;
  externalLink: string | null;
  externalLinkLabel: string | null;
  isSubscriptionCta: boolean;
  subscriptionCtaLabel: string | null;
}

// 업종별 리뷰 요청 문자 (AIProblemDiagnosis의 REVIEW_TEXT_TEMPLATES와 동일 패턴)
const REVIEW_TEXT_TEMPLATES: Record<string, string> = {
  restaurant: "안녕하세요! 오늘 방문해 주셔서 감사합니다 :) 맛있게 드셨나요? 바쁘신 와중에 죄송하지만, 네이버에 짧은 후기 한 줄만 남겨주시면 정말 큰 힘이 됩니다. 음식 맛, 분위기, 직원 친절 중 하나라도 괜찮아요. 감사합니다!",
  cafe: "안녕하세요! 오늘 저희 카페 이용해 주셔서 감사합니다. 음료와 공간이 마음에 드셨다면 네이버 플레이스에 짧은 후기 남겨주시면 정말 감사하겠습니다. 분위기, 커피 맛, 편의시설 중 편하신 내용으로 남겨주세요 :)",
  bakery: "안녕하세요! 오늘 방문해 주셔서 감사합니다 :) 빵이 마음에 드셨으면 좋겠습니다! 네이버에 짧은 후기 한 줄 남겨주시면 정말 큰 힘이 됩니다. 감사합니다!",
  beauty: "안녕하세요! 오늘 방문해 주셔서 감사합니다. 스타일이 마음에 드셨으면 좋겠습니다! 네이버에 짧은 후기 한 줄 남겨주시면 정말 큰 힘이 됩니다. 시술 만족도, 직원 실력, 위생 상태 중 편하신 내용으로 부탁드립니다.",
  medical: "안녕하세요. 내원해 주셔서 감사합니다. 진료가 도움이 되셨으면 좋겠습니다. 가능하시면 네이버 플레이스에 짧은 방문 후기 남겨주시면 감사하겠습니다.",
  education: "안녕하세요! 오늘 수업 어떠셨나요? 도움이 되셨으면 좋겠습니다. 네이버에 짧은 후기 남겨주시면 정말 큰 힘이 됩니다. 수업 방식, 선생님 설명, 수강 효과 중 편하신 내용 한 줄이면 충분합니다. 감사합니다!",
};

function getReviewText(category: string, businessName: string): string {
  const base =
    REVIEW_TEXT_TEMPLATES[category] ??
    "안녕하세요! 오늘 방문해 주셔서 감사합니다. 네이버에 짧은 후기 한 줄만 남겨주시면 정말 큰 힘이 됩니다. 감사합니다!";
  return base;
}

// 한국어 조사 자동 선택
function p(word: string, jong: "은는" | "을를" | "이가"): string {
  if (!word) return jong[1];
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return jong[1];
  return (code - 0xac00) % 28 !== 0 ? jong[0] : jong[1];
}

function buildActions(props: GlobalAiActionCardProps): Action[] {
  const {
    track2Score,
    chatgptMentioned,
    blogCount,
    hasWebsite,
    missingKeywords,
    businessName,
    category,
    region,
    userGroup,
  } = props;
  const isGlobalFocus = userGroup === "INACTIVE" || userGroup === "franchise";

  const candidates: Array<{ action: Action; score: number }> = [];

  // 액션 1: Google 비즈니스 프로필 등록 (항상 포함)
  candidates.push({
    action: {
      id: "google_biz",
      title: "Google 비즈니스 프로필 등록",
      timeLabel: "10분",
      effectLabel: "즉시~1개월 (추정)",
      description:
        "Google 비즈니스 프로필은 ChatGPT가 사용하는 Bing 검색과 Gemini 실시간 검색 연동 모두에서 참조됩니다. business.google.com 무료 등록이 글로벌 AI 노출의 첫 단계입니다.",
      copyText: null,
      copyLabel: null,
      externalLink: "https://business.google.com",
      externalLinkLabel: "→ business.google.com 바로가기",
      isSubscriptionCta: false,
      subscriptionCtaLabel: null,
    },
    score: 10,
  });

  // 액션 1-B: Bing Places 등록 (INACTIVE/franchise 우선 — ChatGPT가 Bing 실시간 검색 사용)
  if (isGlobalFocus) {
    candidates.push({
      action: {
        id: "bing_places",
        title: "Bing Places 비즈니스 등록",
        timeLabel: "10분",
        effectLabel: "수일~2주 (Bing 인덱싱 후)",
        description:
          "ChatGPT는 로컬 검색 시 Bing을 실시간으로 검색합니다. Bing Places에 등록하면 ChatGPT가 가게 정보(이름·위치·업종·영업시간)를 직접 참조합니다.",
        copyText: null,
        copyLabel: null,
        externalLink: "https://www.bing.com/places",
        externalLinkLabel: "→ Bing Places 바로가기",
        isSubscriptionCta: false,
        subscriptionCtaLabel: null,
      },
      score: 9.5,
    });
  }

  // 액션 2: 구조화 콘텐츠 작성 (missingKeywords 기반 동적)
  const keyword = missingKeywords.length > 0 ? missingKeywords[0] : null;
  if (keyword && !chatgptMentioned) {
    const copyText = `Q. ${keyword}${p(keyword, "은는")} 어떤 특징이 있나요?\nA. ${businessName}의 ${keyword}${p(keyword, "을를")} 직접 경험해 보세요. 궁금한 점은 네이버 채팅 또는 전화로 편하게 문의해 주세요.`;
    candidates.push({
      action: {
        id: "structured_content",
        title: `'${keyword}' 정보 구조화 작성`,
        timeLabel: "5분",
        effectLabel: "1~3개월 (추정)",
        description: `ChatGPT·Gemini는 '${keyword}'처럼 명확한 Q&A 형식 텍스트를 인용합니다. 홈페이지·소개글에 아래 문구를 추가하세요.`,
        copyText,
        copyLabel: "Q&A 문구 복사하기",
        externalLink: null,
        externalLinkLabel: null,
        isSubscriptionCta: false,
        subscriptionCtaLabel: null,
      },
      score: 9,
    });
  } else if (!keyword && !chatgptMentioned) {
    const CATEGORY_KO: Record<string, string> = {
      restaurant: "음식점", cafe: "카페", bakery: "베이커리", bar: "주점",
      beauty: "미용실", nail: "네일샵", medical: "의원", pharmacy: "약국",
      fitness: "피트니스", yoga: "요가원", pet: "반려동물", education: "교육",
      tutoring: "학원", legal: "법무", realestate: "부동산", interior: "인테리어",
      auto: "자동차", cleaning: "청소", shopping: "쇼핑", fashion: "패션",
      photo: "사진", video: "영상", design: "디자인", accommodation: "숙박",
      other: "업체",
    };
    const fallbackKw = CATEGORY_KO[category] ?? "업체";
    const copyText = `Q. ${businessName}${p(businessName, "은는")} 어떤 곳인가요?\nA. ${businessName}${p(businessName, "은는")} ${fallbackKw} 전문으로 운영하고 있습니다. 궁금한 점은 네이버 채팅 또는 전화로 편하게 문의해 주세요.`;
    candidates.push({
      action: {
        id: "structured_content_fallback",
        title: "업종 키워드 구조화 작성",
        timeLabel: "5분",
        effectLabel: "1~3개월 (추정)",
        description:
          "ChatGPT·Gemini는 명확한 Q&A 형식 텍스트를 인용합니다. 홈페이지·소개글에 아래 문구를 추가하세요.",
        copyText,
        copyLabel: "Q&A 문구 복사하기",
        externalLink: null,
        externalLinkLabel: null,
        isSubscriptionCta: false,
        subscriptionCtaLabel: null,
      },
      score: 9,
    });
  }

  // 액션 3: 블로그·외부 콘텐츠 확보 (blogCount=0)
  if (blogCount === 0) {
    const reviewText = getReviewText(category, businessName);
    candidates.push({
      action: {
        id: "blog_content",
        title: "블로그·외부 콘텐츠 확보",
        timeLabel: "2분 (리뷰 요청 문자 발송)",
        effectLabel: "2~4개월 (추정)",
        description:
          "ChatGPT는 로컬 검색 시 Bing을 실시간으로 검색합니다. 구글 리뷰·외부 블로그 후기를 확보하면 Bing 인덱스에 포함되어 ChatGPT 노출 가능성이 높아집니다. 네이버 리뷰·블로그는 네이버 AI 브리핑·AI탭에 효과적입니다.",
        copyText: reviewText,
        copyLabel: "리뷰 요청 문자 복사하기",
        externalLink: null,
        externalLinkLabel: null,
        isSubscriptionCta: false,
        subscriptionCtaLabel: null,
      },
      score: 8,
    });
  } else if (hasWebsite === true) {
    // 액션 4: 홈페이지 메타태그 최적화 (hasWebsite=true)
    const regionStr = region ? region : "지역";
    const copyText = `<title>${businessName} — ${regionStr} ${category} 전문</title>\n<meta name="description" content="${regionStr} ${businessName}. ${category} 전문. 영업시간·위치·예약 안내.">`;
    candidates.push({
      action: {
        id: "meta_tag",
        title: "홈페이지 메타태그 최적화",
        timeLabel: "30분",
        effectLabel: "1~2개월 (추정)",
        description: `홈페이지가 있다면 <title>, <meta description>에 '${businessName} ${regionStr} ${category}' 키워드를 포함하면 Google AI와 ChatGPT 인용 가능성이 높아집니다.`,
        copyText,
        copyLabel: "메타태그 코드 복사하기",
        externalLink: null,
        externalLinkLabel: null,
        isSubscriptionCta: false,
        subscriptionCtaLabel: null,
      },
      score: 7,
    });
  }

  // 액션 5: JSON-LD 스키마 마크업 (track2Score<40)
  if (track2Score < 40) {
    candidates.push({
      action: {
        id: "json_ld",
        title: "AI가 내 가게를 정확히 인식하도록 구조화 등록",
        timeLabel: "자동 생성",
        effectLabel: "1~2개월 (추정)",
        description:
          "가게 이름·주소·업종·운영시간을 AI가 이해하는 형식으로 등록하면 ChatGPT·Google AI 인용 정확도가 높아집니다. AEOlab Basic 플랜에서 자동으로 생성해 드립니다.",
        copyText: null,
        copyLabel: null,
        externalLink: "/pricing",
        externalLinkLabel: null,
        isSubscriptionCta: true,
        subscriptionCtaLabel: "→ Basic 플랜에서 자동 생성 (첫 달 4,950원)",
      },
      score: 6,
    });
  }

  // 점수 내림차순 상위 3개
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.action);
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      // fallback: textarea execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) {
          setState("copied");
          setTimeout(() => setState("idle"), 2500);
        } else {
          setState("failed");
          setTimeout(() => setState("idle"), 2500);
        }
      } catch {
        setState("failed");
        setTimeout(() => setState("idle"), 2500);
      }
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors ${
        state === "copied"
          ? "bg-emerald-500 text-white"
          : state === "failed"
            ? "bg-amber-500 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
      }`}
    >
      {state === "copied" ? <><Check className="w-4 h-4" aria-hidden="true" /> 복사됨!</> : state === "failed" ? "복사 실패" : label}
    </button>
  );
}

function ActionCard({
  action,
  index,
}: {
  action: Action;
  index: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      {/* 제목 + 배지 */}
      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-black text-blue-600">{index + 1}.</span>
          <p className="text-sm md:text-base font-bold text-gray-900">{action.title}</p>
        </div>
        <div className="flex gap-1.5 shrink-0 flex-wrap">
          <span className="text-sm bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
            소요 {action.timeLabel}
          </span>
          <span className="text-sm bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
            효과 {action.effectLabel}
          </span>
        </div>
      </div>

      {/* 설명 */}
      <p className="text-sm text-gray-600 leading-relaxed mb-3 break-keep">
        {action.description}
      </p>

      {/* 복사 문구 미리보기 */}
      {action.copyText && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 mb-3">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {action.copyText}
          </p>
        </div>
      )}

      {/* 액션 버튼 */}
      {action.copyText && action.copyLabel && (
        <CopyButton text={action.copyText} label={action.copyLabel} />
      )}
      {action.externalLink && !action.isSubscriptionCta && action.externalLinkLabel && (
        <a
          href={action.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 underline"
        >
          {action.externalLinkLabel}
        </a>
      )}
      {action.externalLink && !action.isSubscriptionCta && !action.externalLinkLabel && (
        <a
          href={action.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 underline"
        >
          {action.externalLink} →
        </a>
      )}
      {action.isSubscriptionCta && action.subscriptionCtaLabel && (
        <a
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors"
        >
          {action.subscriptionCtaLabel}
        </a>
      )}
    </div>
  );
}

export default function GlobalAiActionCard({
  track2Score,
  chatgptMentioned,
  chatgptSampleSize,
  geminiExposureFreq,
  blogCount,
  hasWebsite,
  missingKeywords,
  businessName,
  category,
  region,
  userGroup,
}: GlobalAiActionCardProps) {
  const isGlobal = userGroup === "INACTIVE" || userGroup === "franchise";

  const actions = buildActions({
    track2Score,
    chatgptMentioned,
    chatgptSampleSize,
    geminiExposureFreq,
    blogCount,
    hasWebsite,
    missingKeywords,
    businessName,
    category,
    region,
    userGroup,
  });

  const score = Math.round(track2Score);
  const scoreColorClass =
    score >= 70
      ? "text-green-600"
      : score >= 40
        ? "text-blue-600"
        : "text-red-500";
  const scoreLabel =
    score >= 80 ? "우수" : score >= 65 ? "양호" : score >= 45 ? "보통" : score >= 25 ? "미흡" : "시작 단계";

  const chatgptLabel =
    chatgptMentioned === true
      ? "언급됨"
      : chatgptMentioned === false
        ? "미언급"
        : "측정 중";

  const geminiLabel =
    geminiExposureFreq !== undefined
      ? geminiExposureFreq > 0
        ? `노출 ${geminiExposureFreq}회`
        : "미노출"
      : "Basic 플랜에서 50회 측정";

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 md:px-5 py-4 mb-4 shadow-sm">
      {/* INACTIVE/franchise 강조 배지 */}
      {isGlobal && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-4">
          <p className="text-sm font-semibold text-blue-800 leading-relaxed break-keep">
            이 업종의 주요 노출 채널입니다. 아래 방법으로 ChatGPT·Gemini·Google AI 노출을 높이세요.
          </p>
        </div>
      )}

      {/* 헤더 — Track2 점수 + 측정 요약 */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-0.5">
            ChatGPT·Gemini·Google AI
          </p>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <span
              className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
                chatgptMentioned === true
                  ? "bg-green-100 text-green-700"
                  : chatgptMentioned === false
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              ChatGPT {chatgptSampleSize}회 → {chatgptLabel}
            </span>
            <span className="text-sm bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
              Gemini: {geminiLabel}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm text-gray-500 mb-0.5">AI 노출 현황</p>
          <p className={`text-2xl font-black ${scoreColorClass}`}>
            {scoreLabel}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 mb-4" />

      {/* 섹션 제목 */}
      <p className="text-sm md:text-base font-bold text-gray-800 mb-3">
        {isGlobal
          ? `ChatGPT·Gemini·Google AI 노출 개선 방법 ${actions.length}가지`
          : `이 점수를 높이는 방법 ${actions.length}가지`}
      </p>

      {/* 액션 카드 목록 — 모바일 단열 / PC 3열 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {actions.map((action, i) => (
          <ActionCard key={action.id} action={action} index={i} />
        ))}
      </div>

      {/* 면책 문구 */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-sm text-gray-500 leading-relaxed">
          ※ ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
          Gemini는 구글 비즈니스 프로필 개선 후 2~4주 내 반영 시작(안정화 3~6개월), ChatGPT는 3개월~1년 소요됩니다. 결과는 보장되지 않습니다.
        </p>
      </div>
    </div>
  );
}
