"use client";

import { useState } from "react";

interface Props {
  businessName: string;
  category: string;
  track1Score: number;
  track2Score: number;
  growthStage: string;
  missingKeywords: string[];
  hasFaq: boolean;
  hasRecentPost: boolean;
  hasIntro: boolean;
  isSmartPlace: boolean;
  blogMentions: number;
  faqCopyText?: string | null;
  pioneerKeywords?: string[];
  reviewCopyText?: string;
  selectedTags?: string[];
  region?: string;
}

interface Problem {
  text: string;
  impact: string;
  priority: number;
}

interface Solution {
  num: number;
  title: string;
  time: string;
  tag: string;
  copyText: string | null;
  hint: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors ${
        copied
          ? "bg-gray-600 text-white"
          : "bg-green-600 hover:bg-green-700 text-white"
      }`}
    >
      {copied ? "✓ 복사됐습니다!" : label}
    </button>
  );
}

// 한국어 조사 처리 유틸리티 (은/는)
function iSubject(name: string): string {
  if (!name) return "내 가게는";
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}은(는)`;
  return (code - 0xac00) % 28 !== 0 ? `${name}은` : `${name}는`;
}

// ── 섹션 A: 소개글 초안 자동 생성 ──
const CATEGORY_INTRO: Record<string, string> = {
  food: "맛있는 음식",
  cafe: "편안한 카페",
  beauty: "전문 미용 서비스",
  health: "건강 케어 서비스",
  education: "전문 교육",
  professional: "전문 서비스",
  shopping: "다양한 상품",
  living: "생활 편의 서비스",
  culture: "문화 체험",
  accommodation: "편안한 숙박",
};

function buildIntroText(
  businessName: string,
  category: string,
  tags: string[],
  region: string,
  missingKws: string[]
): string {
  const base = CATEGORY_INTRO[category] ?? "전문 서비스";
  const tagStr = tags.slice(0, 2).join(", ");
  const kwStr = missingKws.slice(0, 2).join(", ");
  const regionStr = region ? `${region} ` : "";
  return `${regionStr}${businessName || "저희 가게"}는 ${tagStr ? `${tagStr} 전문 ` : ""}${base}을 제공합니다. ${kwStr ? `${kwStr} 등 ` : ""}고객 만족을 위해 최선을 다하고 있습니다. 편하게 방문해 주세요!`;
}

// ── 섹션 B: 업종별 FAQ Q&A 5쌍 ──
const FAQ_TEMPLATES: Record<string, Array<{ q: string; a: string }>> = {
  food: [
    { q: "영업시간이 어떻게 되나요?", a: "[오전 11시 ~ 오후 10시]에 운영합니다. 라스트오더는 [오후 9시 30분]입니다." },
    { q: "예약이 가능한가요?", a: "네, 전화 또는 네이버 예약으로 가능합니다. [단체 예약은 최소 3일 전] 연락 부탁드립니다." },
    { q: "주차가 되나요?", a: "[가게 앞 무료 주차 5대] 가능합니다. 주말엔 인근 공영주차장 이용을 권장합니다." },
    { q: "포장·배달 되나요?", a: "포장은 가능합니다. 배달은 [배달의민족, 쿠팡이츠]를 통해 이용하실 수 있습니다." },
    { q: "어떤 메뉴가 인기 있나요?", a: "[대표 메뉴명]이 가장 인기 있습니다. 계절 한정 메뉴도 운영하고 있으니 방문 전 확인해 주세요." },
  ],
  cafe: [
    { q: "영업시간이 어떻게 되나요?", a: "[오전 9시 ~ 오후 10시] 운영합니다. 주말에는 [오전 8시]부터 오픈합니다." },
    { q: "좌석 예약이 가능한가요?", a: "[그룹 스터디룸 2개]는 사전 예약 가능합니다. 일반 좌석은 선착순 이용입니다." },
    { q: "주차가 되나요?", a: "[건물 지하 주차장] 이용 가능합니다. 음료 1잔 이상 구매 시 [1시간 무료]입니다." },
    { q: "반려동물 동반이 가능한가요?", a: "[소형 반려동물]은 케이지에 넣고 입장 가능합니다. 테라스 좌석 우선 안내드립니다." },
    { q: "대표 메뉴를 추천해 주세요.", a: "[시그니처 라떼]와 [홈메이드 케이크]를 추천합니다. 계절 음료도 인기가 많습니다." },
  ],
  beauty: [
    { q: "예약 없이 방문 가능한가요?", a: "워크인 방문도 가능하지만, 원활한 서비스를 위해 [전화 또는 네이버 예약]을 권장합니다." },
    { q: "어떤 서비스를 제공하나요?", a: "[컷, 염색, 펌, 트리트먼트] 등 다양한 헤어 서비스를 제공합니다." },
    { q: "가격표를 알 수 있을까요?", a: "컷 [3만원~], 염색 [8만원~], 펌 [10만원~]부터 시작합니다. 자세한 가격은 방문 상담 후 안내드립니다." },
    { q: "주차가 가능한가요?", a: "[건물 앞 무료 주차] 가능합니다. 이용 시 프런트에 말씀해 주세요." },
    { q: "어린이도 이용 가능한가요?", a: "네, 어린이 커트도 진행합니다. [보호자 동반] 시 방문해 주세요." },
  ],
  health: [
    { q: "진료 시간이 어떻게 되나요?", a: "[평일 오전 9시 ~ 오후 6시], 토요일 [오전 9시 ~ 오후 1시] 진료합니다. 공휴일은 휴진입니다." },
    { q: "예약 없이 방문 가능한가요?", a: "당일 예약 가능합니다. [네이버 예약 또는 전화] 후 방문하시면 대기 시간을 줄일 수 있습니다." },
    { q: "주차가 되나요?", a: "[건물 내 주차장] 이용 가능합니다. 진료 시 [2시간 무료] 주차 지원합니다." },
    { q: "건강보험이 적용되나요?", a: "대부분의 진료에 건강보험이 적용됩니다. 비급여 항목은 상담 시 별도 안내드립니다." },
    { q: "초진 시 어떻게 준비해야 하나요?", a: "신분증과 건강보험증을 지참해 주세요. 기존 진단서나 처방전이 있으면 가져오시면 도움이 됩니다." },
  ],
  education: [
    { q: "수강 연령대는 어떻게 되나요?", a: "[초등학생 ~ 고등학생] 대상으로 수업을 진행합니다. 상담 후 레벨에 맞는 반을 안내드립니다." },
    { q: "체험 수업이 가능한가요?", a: "네, [1회 무료 체험 수업]을 운영합니다. 전화 또는 방문 상담 후 신청 가능합니다." },
    { q: "수업 시간표는 어떻게 되나요?", a: "[평일 오후 2시 ~ 오후 9시], 토요일 [오전 9시 ~ 오후 3시] 운영합니다. 개인 일정에 맞는 반 배정이 가능합니다." },
    { q: "소규모 수업인가요?", a: "[1:1 개인 또는 최대 5명 소그룹] 수업으로 진행됩니다. 집중적인 피드백이 가능합니다." },
    { q: "교재비 등 추가 비용이 있나요?", a: "수강료에 [교재비 포함]입니다. 별도 추가 비용은 없습니다." },
  ],
  default: [
    { q: "운영 시간이 어떻게 되나요?", a: "[운영 시간을 입력하세요]. 공휴일 운영 여부는 네이버 플레이스에서 확인하실 수 있습니다." },
    { q: "예약이 필요한가요?", a: "[예약 방법을 입력하세요]. 급하신 경우 전화로 당일 예약도 가능합니다." },
    { q: "주차가 가능한가요?", a: "[주차 정보를 입력하세요]. 가까운 공영주차장 이용도 안내드릴 수 있습니다." },
    { q: "어떤 서비스를 제공하나요?", a: "[주요 서비스를 2~3가지 입력하세요]. 상세 내용은 전화 또는 방문 상담으로 안내드립니다." },
    { q: "처음 방문할 때 준비할 게 있나요?", a: "[필요한 준비물을 입력하세요]. 궁금한 점은 방문 전 언제든지 연락해 주세요." },
  ],
};

// 업종별 리뷰 요청 문자 초안
const REVIEW_TEXT_TEMPLATES: Record<string, string> = {
  food: "안녕하세요! 오늘 방문해 주셔서 감사합니다 :) 맛있게 드셨나요? 바쁘신 와중에 죄송하지만, 네이버에 짧은 후기 한 줄만 남겨주시면 정말 큰 힘이 됩니다. 음식 맛, 분위기, 직원 친절 중 하나라도 괜찮아요. 감사합니다!",
  cafe: "안녕하세요! 오늘 저희 카페 이용해 주셔서 감사합니다. 음료와 공간이 마음에 드셨다면 네이버 플레이스에 짧은 후기 남겨주시면 정말 감사하겠습니다. 분위기, 커피 맛, 편의시설 중 편하신 내용으로 남겨주세요 :)",
  beauty: "안녕하세요! 오늘 방문해 주셔서 감사합니다. 스타일이 마음에 드셨으면 좋겠습니다! 네이버에 짧은 후기 한 줄 남겨주시면 정말 큰 힘이 됩니다. 시술 만족도, 직원 실력, 위생 상태 중 편하신 내용으로 부탁드립니다.",
  health: "안녕하세요. 내원해 주셔서 감사합니다. 진료가 도움이 되셨으면 좋겠습니다. 가능하시면 네이버 플레이스에 짧은 방문 후기 남겨주시면 감사하겠습니다. 대기시간, 친절도, 치료 효과 등 편하신 내용 한 줄이면 충분합니다.",
  education: "안녕하세요! 오늘 수업 어떠셨나요? 도움이 되셨으면 좋겠습니다. 네이버에 짧은 후기 남겨주시면 정말 큰 힘이 됩니다. 수업 방식, 선생님 설명, 수강 효과 중 편하신 내용 한 줄이면 충분합니다. 감사합니다!",
};

function getReviewText(category: string, businessName: string, missingKws: string[]): string {
  const base = REVIEW_TEXT_TEMPLATES[category] ?? "안녕하세요! 오늘 방문해 주셔서 감사합니다. 네이버에 짧은 후기 한 줄만 남겨주시면 정말 큰 힘이 됩니다. 감사합니다!";
  const kwHint = missingKws.length > 0
    ? ` (${missingKws.slice(0, 2).join(", ")} 관련 내용을 언급해 주시면 더욱 좋습니다)`
    : "";
  return base + kwHint;
}

export default function AIProblemDiagnosis({
  businessName,
  category,
  track1Score,
  track2Score,
  missingKeywords,
  hasFaq,
  hasRecentPost,
  hasIntro,
  isSmartPlace,
  blogMentions,
  faqCopyText,
  pioneerKeywords,
  reviewCopyText,
  selectedTags = [],
  region = "",
}: Props) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [showAllFaq, setShowAllFaq] = useState(false);

  // ── 1. 문제 목록 자동 생성 ──
  const rawProblems: Problem[] = [];

  if (!isSmartPlace) {
    rawProblems.push({
      text: "네이버 스마트플레이스 미등록",
      impact: "AI가 가게를 인식할 기반 정보 없음",
      priority: 1,
    });
  }

  if (!hasFaq && isSmartPlace) {
    rawProblems.push({
      text: "소개글 Q&A 섹션 없음",
      impact: "소개글 안 Q&A는 AI 브리핑 인용 후보 경로 중 하나 — 미확보 상태",
      priority: 1,
    });
  }

  if (track1Score < 40) {
    rawProblems.push({
      text: `네이버 AI 브리핑 노출 준비 미흡 (${track1Score}점)`,
      impact: "손님이 '근처 맛집 추천' 검색 시 내 가게가 안 나옴",
      priority: 2,
    });
  }

  if (missingKeywords.length > 0) {
    rawProblems.push({
      text: `'${missingKeywords[0]}' 등 추천 키워드 ${missingKeywords.length}개 미적용`,
      impact: "이 키워드로 들어오는 손님이 내 가게를 못 찾을 수 있음",
      priority: 2,
    });
  }

  if (blogMentions === 0) {
    rawProblems.push({
      text: "블로그 언급 없음",
      impact: "AI가 신뢰하는 외부 콘텐츠 없어 추천 확률 낮음",
      priority: 3,
    });
  }

  if (!hasIntro && isSmartPlace) {
    rawProblems.push({
      text: "스마트플레이스 소개글 없음",
      impact: "키워드 기반 영구 노출 기회 놓침",
      priority: 3,
    });
  }

  if (track2Score < 40) {
    rawProblems.push({
      text: `ChatGPT·구글 AI 노출 미흡 (${track2Score}점)`,
      impact: "ChatGPT·구글에서 '추천 맛집' 검색 시 내 가게가 안 나옴",
      priority: 2,
    });
  }

  // priority 오름차순 정렬, 최대 4개
  const problems = rawProblems
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);

  // ── 2. 해결 방안 자동 생성 ──
  const solutions: Solution[] = [];

  if (!hasFaq || !isSmartPlace) {
    solutions.push({
      num: 1,
      title: "소개글에 Q&A 추가",
      time: "5분",
      tag: "즉시 효과",
      copyText: faqCopyText ?? null,
      hint: "소개글 하단 Q&A가 AI 브리핑 인용 후보로 가장 효과적입니다",
    });
  }

  if (missingKeywords.length > 0 && solutions.length < 3) {
    solutions.push({
      num: solutions.length + 1,
      title: "핵심 키워드 소개글 추가",
      time: "3분",
      tag: "영구 효과",
      copyText: missingKeywords.slice(0, 3).join(", ") + " 전문",
      hint: "소개글에 추가하면 AI가 이 키워드로 내 가게를 연결",
    });
  }

  if (blogMentions === 0 && solutions.length < 3) {
    solutions.push({
      num: solutions.length + 1,
      title: "블로그 후기 1건 요청",
      time: "2분",
      tag: "신뢰도 향상",
      copyText: reviewCopyText || getReviewText(category, businessName, missingKeywords),
      hint: "AI가 외부 블로그 언급을 신뢰 신호로 인식",
    });
  }

  if (pioneerKeywords && pioneerKeywords.length > 0 && solutions.length < 3) {
    solutions.push({
      num: solutions.length + 1,
      title: "선점 키워드 소개글 등록",
      time: "3분",
      tag: "경쟁자 없음",
      copyText: `${pioneerKeywords.slice(0, 2).join(", ")} 전문점`,
      hint: "아직 경쟁 가게가 등록하지 않은 키워드 — 먼저 등록하면 AI 조건 검색에서 독점 노출",
    });
  }

  // 문제도 없고 해결 방안도 없으면 렌더링하지 않음
  if (problems.length === 0 && solutions.length === 0) return null;

  // ── 3. 한 줄 결론 자동 생성 ──
  const conclusion =
    problems.length >= 3
      ? `${iSubject(businessName)} 소개글 Q&A 추가와 키워드 정리만 해도 AI 브리핑 인용 후보 가능성이 크게 높아집니다`
      : track1Score >= 60
      ? "네이버 AI 브리핑 기반은 잘 갖춰져 있습니다. 글로벌 AI 노출을 높이면 더 많은 손님이 찾아옵니다"
      : "AI 브리핑 노출을 막는 핵심 이유를 파악했습니다. 위 순서대로 진행하세요";

  // ── 소개글 초안 생성 여부 판단 ──
  const showIntroSection = isSmartPlace && !hasIntro;
  const introText = buildIntroText(businessName, category, selectedTags, region, missingKeywords);

  // ── FAQ 템플릿 선택 ──
  const faqList = FAQ_TEMPLATES[category] ?? FAQ_TEMPLATES["default"];
  const showFaqSection = true; // 항상 표시 (AI 브리핑 핵심 경로)

  // ── 리뷰 요청 문자 ──
  const reviewDraftText = reviewCopyText || getReviewText(category, businessName, missingKeywords);

  // 전체 FAQ 텍스트 (복사용)
  const allFaqText = faqList.map((f) => `Q. ${f.q}\nA. ${f.a}`).join("\n\n");

  return (
    <div className="bg-white border-2 border-gray-900 rounded-2xl overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gray-900 text-white px-5 py-4">
        <p className="text-sm text-gray-500 mb-1">AI 노출 진단 결과 — {businessName}</p>
        <h2 className="text-lg font-bold">지금 AI에 안 나오는 이유 + 오늘 당장 할 것</h2>
      </div>

      {/* 섹션 1: 현재 문제 */}
      {problems.length > 0 && (
        <div className="px-4 md:px-5 pt-5 pb-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-3">
            1 현재 상태 — 핵심 문제 {problems.length}가지
          </p>
          <div className="space-y-2">
            {problems.map((p, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 bg-red-50 rounded-xl border border-red-100"
              >
                <span className="text-red-500 text-base shrink-0">❌</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.text}</p>
                  <p className="text-sm text-gray-500 mt-0.5">→ {p.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 섹션 2: 해결 방안 */}
      {solutions.length > 0 && (
        <div className="px-4 md:px-5 pt-4 pb-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-3">
            2 오늘 바로 할 것 (순서대로)
          </p>
          <div className="space-y-3">
            {solutions.map((s) => (
              <div
                key={s.num}
                className="bg-green-50 rounded-xl border border-green-200 p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-green-700">
                      🔥 {s.num}.
                    </span>
                    <p className="text-base font-bold text-gray-900">{s.title}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span className="text-sm bg-green-600 text-white px-2 py-0.5 rounded-full">
                      {s.time}
                    </span>
                    <span className="text-sm bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {s.tag}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-green-700 mb-2">{s.hint}</p>
                {s.copyText && (
                  <>
                    {s.copyText.includes("[") && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 text-sm text-amber-700">
                        ⚠️ <strong>[ ] 괄호 안</strong>은 내 가게 정보로 바꾼 후 사용하세요
                      </div>
                    )}
                    <div className="bg-white rounded-lg border border-green-200 px-3 py-2 mb-2">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {s.copyText}
                      </p>
                    </div>
                    <CopyButton text={s.copyText} label="✅ 복사해서 바로 사용" />
                  </>
                )}
                {!s.copyText && !hasFaq && isSmartPlace && s.num === 1 && (
                  <a
                    href="https://smartplace.naver.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 underline mt-1"
                  >
                    스마트플레이스 소개글 수정하러 가기 →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 섹션 A: 소개글 초안 */}
      {showIntroSection && (
        <div className="px-4 md:px-5 pt-4 pb-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-1">
            스마트플레이스 소개글 초안 — 바로 붙여넣으세요
          </p>
          <p className="text-sm text-gray-500 mb-3">
            아래 텍스트를 복사해 스마트플레이스 &gt; 기본 정보 &gt; 소개 에 붙여넣으세요.
            [ ] 부분만 실제 정보로 바꾸면 됩니다.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 text-sm text-amber-700">
            ⚠️ <strong>[ ] 괄호 안</strong>을 실제 가게 정보로 바꾼 후 사용하세요
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 px-4 py-3 mb-3">
            <p className="text-sm text-gray-800 leading-relaxed">{introText}</p>
          </div>
          <CopyButton text={introText} label="✅ 소개글 복사하기" />
        </div>
      )}

      {/* 섹션 B: FAQ Q&A 5쌍 */}
      {showFaqSection && (
        <div className="px-4 md:px-5 pt-4 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <p className="text-sm font-bold text-gray-500">
              소개글에 포함할 Q&amp;A 예시 5쌍
            </p>
            <span className="text-sm bg-green-600 text-white px-2 py-0.5 rounded-full">AI 브리핑 인용 후보 경로</span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            소개글(업체정보 → 소개글)에 아래 Q&amp;A를 자연스럽게 포함하세요.
            [ ] 부분을 실제 정보로 바꿔 등록하세요.
          </p>

          {/* FAQ 네이버 바로가기 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-blue-700 font-medium">스마트플레이스에서 바로 등록하기</p>
            <a
              href="https://smartplace.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-blue-600 underline whitespace-nowrap"
            >
              smartplace.naver.com →
            </a>
          </div>

          {/* 전체 복사 버튼 */}
          <div className="mb-3">
            <CopyButton text={allFaqText} label="✅ FAQ 5쌍 전체 복사" />
          </div>

          {/* 아코디언 FAQ 목록 */}
          <div className="space-y-2">
            {faqList.map((faq, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-800 pr-2">
                    Q{idx + 1}. {faq.q}
                  </span>
                  <span className="text-gray-500 shrink-0 text-lg leading-none">
                    {openFaqIdx === idx ? "−" : "+"}
                  </span>
                </button>
                {openFaqIdx === idx && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    {faq.a.includes("[") && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-2 text-sm text-amber-700">
                        ⚠️ <strong>[ ] 부분</strong>을 실제 정보로 바꿔주세요
                      </div>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed mb-2">{faq.a}</p>
                    <CopyButton text={`Q. ${faq.q}\nA. ${faq.a}`} label="이 Q&A 복사" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {!showAllFaq && (
            <button
              onClick={() => setShowAllFaq(true)}
              className="mt-2 text-sm text-blue-600 underline"
            >
              더 많은 FAQ 보기 →
            </button>
          )}
        </div>
      )}

      {/* 섹션 C: 리뷰 요청 문자 초안 */}
      <div className="px-4 md:px-5 pt-4 pb-4 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-500 mb-1">
          손님에게 보내는 리뷰 요청 문자 초안
        </p>
        <p className="text-sm text-gray-500 mb-3">
          방문 후 손님에게 카카오톡·문자로 보내세요. 리뷰가 쌓이면 AI 추천 확률이 높아집니다.
        </p>
        {reviewDraftText.includes("[") && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 text-sm text-amber-700">
            ⚠️ <strong>[ ] 괄호 안</strong>은 내 가게 정보로 바꾼 후 사용하세요
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-3">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
            {reviewDraftText}
          </p>
        </div>
        <CopyButton text={reviewDraftText} label="✅ 문자 초안 복사하기" />
      </div>

      {/* 섹션 3: 한 줄 결론 */}
      <div className="px-4 md:px-5 py-4 bg-blue-50">
        <p className="text-sm font-bold text-blue-700 mb-1">💬 핵심 결론</p>
        <p className="text-base text-gray-800 font-medium">&ldquo;{conclusion}&rdquo;</p>
      </div>
    </div>
  );
}
