"use client";

import { useState } from "react";

interface CaseData {
  id: string;
  name: string;
  label: string;
  region: string;
  category: string;
  years: string;
  question: string;
  before: {
    exposure: number;
    score: number;
    gaps: number;
    problems: string[];
  };
  actions: string[];
  after: {
    exposure: number;
    score: number;
    weeks: number;
  };
  reasons: string[];
}

const CASES: CaseData[] = [
  {
    id: "restaurant",
    name: "박**",
    label: "음식점 사장님",
    region: "창원",
    category: "치킨집",
    years: "운영 20년",
    question: "네이버 별점이 4.3인데 ChatGPT에 우리 가게가 왜 안 나오죠?",
    before: {
      exposure: 3,
      score: 32,
      gaps: 14,
      problems: [
        "스마트플레이스 사진 3장, 메뉴 미등록",
        "리뷰 12개 — 답글 0개",
        "지역+업종 키워드 14개 공백",
      ],
    },
    actions: [
      "메뉴·가격 스마트플레이스 등록",
      "리뷰 답글에 '창원 치킨배달, 성산구 야식' 자연 삽입",
      "FAQ 10개 등록 (주차, 포장할인, 배달시간 등)",
    ],
    after: {
      exposure: 19,
      score: 47,
      weeks: 4,
    },
    reasons: [
      "지역+업종 키워드 조합 (창원 치킨배달·성산구 야식) 7개 적용",
      "소개글 Q&A 10개 적용으로 AI 인용 후보 경로 확보",
      "리뷰 답글에 키워드 자연 삽입으로 콘텐츠 밀도 증가",
    ],
  },
  {
    id: "cafe",
    name: "이**",
    label: "카페 사장님",
    region: "김해",
    category: "브런치 카페",
    years: "오픈 8개월",
    question: "인스타 팔로워가 800명인데 왜 손님이 안 오나요?",
    before: {
      exposure: 0,
      score: 21,
      gaps: 18,
      problems: [
        "스마트플레이스 운영시간 오류",
        "시그니처 메뉴·가격 정보 없음",
        "위치 키워드 18개 공백",
      ],
    },
    actions: [
      "스마트플레이스 운영시간·메뉴판·대표사진 완성",
      "'율하 카페, 김해 디저트카페, 김해 데이트 카페' 키워드 보강",
      "시그니처 음료 블로그 포스팅 2개",
    ],
    after: {
      exposure: 13,
      score: 39,
      weeks: 4,
    },
    reasons: [
      "운영시간·메뉴판 완성으로 AI가 신뢰할 수 있는 정보 구조 확보",
      "위치 키워드 3종 조합 (율하+김해+데이트카페) 적용",
      "블로그 포스팅 2개로 외부 콘텐츠 신호 생성",
    ],
  },
  {
    id: "beauty",
    name: "최**",
    label: "미용실 원장님",
    region: "부산 서면",
    category: "헤어샵",
    years: "운영 12년",
    question: "단골은 있는데 신규 고객이 6개월째 안 늘어요",
    before: {
      exposure: 5,
      score: 38,
      gaps: 11,
      problems: [
        "시술 종류 미세분화 없음 (염색만 등록)",
        "가격 정보 미등록",
        "네이버 예약 미연동",
      ],
    },
    actions: [
      "시술 종류 상세화 (발레아쥬·이염·클리닉 각각 별도 등록)",
      "가격대 정보 스마트플레이스 등록",
      "네이버 예약 시스템 연동",
    ],
    after: {
      exposure: 21,
      score: 54,
      weeks: 4,
    },
    reasons: [
      "시술 세분화 (발레아쥬·이염·클리닉)로 롱테일 키워드 커버리지 확장",
      "가격대 공개로 AI 정보 완성도 상승",
      "네이버 예약 연동으로 AI가 '예약 가능 가게'로 분류",
    ],
  },
];

const TAB_LABELS: Record<string, string> = {
  restaurant: "음식점",
  cafe: "카페",
  beauty: "미용실",
};

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      />
    </div>
  );
}

function CaseCard({ data }: { data: CaseData }) {
  const exposureDelta = data.after.exposure - data.before.exposure;
  const scoreDelta = data.after.score - data.before.score;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-base font-bold text-gray-900">{data.name}</span>
          <span className="bg-blue-100 text-blue-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {data.label}
          </span>
          <span className="text-sm text-gray-500">{data.region} · {data.category}</span>
        </div>
        <p className="text-sm text-gray-500">{data.years}</p>
      </div>

      {/* 실제 질문 말풍선 */}
      <div className="px-5 pt-4 pb-3">
        <div className="relative bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          {/* 말풍선 꼬리 */}
          <div className="absolute -top-2 left-5 w-4 h-4 bg-amber-50 border-l border-t border-amber-200 rotate-45" />
          <p className="text-sm text-amber-900 font-medium break-keep leading-relaxed relative z-10">
            &ldquo;{data.question}&rdquo;
          </p>
        </div>
      </div>

      {/* Before / After 영역 */}
      <div className="px-5 pb-5 space-y-4">

        {/* Before 진단 */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-red-700 uppercase tracking-wide">Before 진단</span>
            <div className="flex-1 h-px bg-red-200" />
          </div>

          {/* 수치 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{data.before.exposure}%</p>
              <p className="text-xs text-gray-500 mt-0.5 break-keep">AI 노출률</p>
            </div>
            <div className="text-center border-x border-red-100">
              <p className="text-xl font-bold text-red-600">{data.before.score}점</p>
              <p className="text-xs text-gray-500 mt-0.5">AEO 점수</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{data.before.gaps}개</p>
              <p className="text-xs text-gray-500 mt-0.5 break-keep">키워드 공백</p>
            </div>
          </div>
          <ScoreBar value={data.before.score} color="bg-red-400" />

          {/* 문제 목록 */}
          <ul className="mt-3 space-y-1.5">
            {data.before.problems.map((problem, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 break-keep">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {problem}
              </li>
            ))}
          </ul>
        </div>

        {/* 개선 조치 화살표 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            AEOlab 개선 조치
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 개선 액션 체크리스트 */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <ul className="space-y-2">
            {data.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-800 break-keep">
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                {action}
              </li>
            ))}
          </ul>
        </div>

        {/* After 결과 */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-emerald-700 uppercase tracking-wide">After 결과</span>
            <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {data.after.weeks}주 후
            </span>
            <div className="flex-1 h-px bg-emerald-200" />
          </div>

          {/* 수치 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-700">{data.after.exposure}%</p>
              <p className="text-xs text-gray-500 mt-0.5 break-keep">AI 노출률</p>
              <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                +{exposureDelta}%p 상승
              </p>
            </div>
            <div className="text-center border-l border-emerald-200">
              <p className="text-2xl font-bold text-emerald-700">{data.after.score}점</p>
              <p className="text-xs text-gray-500 mt-0.5">AEO 점수</p>
              <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                +{scoreDelta}점 향상
              </p>
            </div>
          </div>
          <ScoreBar value={data.after.score} color="bg-emerald-500" />
        </div>

        {/* AI에 뜬 이유 3가지 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-bold text-emerald-700 mb-2">AI에 뜬 이유 3가지</p>
          <ul className="space-y-1.5">
            {data.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 break-keep">
                <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {reason}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

export default function CaseStudySection() {
  const [activeTab, setActiveTab] = useState<string>("restaurant");

  const activeCase = CASES.find((c) => c.id === activeTab) ?? CASES[0];

  return (
    <section className="bg-gray-50 py-10 md:py-14 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">

        {/* 섹션 타이틀 */}
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 break-keep mb-2">
            실제로 이런 분들이 개선했습니다
          </h2>
          <p className="text-sm md:text-base text-gray-500 break-keep">
            결과가 아니라 &lsquo;왜 됐는지&rsquo;를 보여드립니다
          </p>
        </div>

        {/* 탭 버튼 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {CASES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                activeTab === c.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {TAB_LABELS[c.id]}
            </button>
          ))}
        </div>

        {/* 모바일: 탭 전환 단일 카드 */}
        <div className="md:hidden">
          <CaseCard data={activeCase} />
        </div>

        {/* PC: 3개 카드 나란히 */}
        <div className="hidden md:grid grid-cols-3 gap-5">
          {CASES.map((c) => (
            <div
              key={c.id}
              className={`transition-all duration-200 ${
                activeTab === c.id
                  ? "ring-2 ring-blue-400 ring-offset-2 rounded-2xl"
                  : "opacity-75 hover:opacity-90 cursor-pointer"
              }`}
              onClick={() => setActiveTab(c.id)}
            >
              <CaseCard data={c} />
            </div>
          ))}
        </div>

        {/* 하단 안내 문구 */}
        <p className="text-center text-sm text-gray-400 mt-6 break-keep">
          위 사례는 실제 분석 시나리오 기반 가상 페르소나입니다. 개별 결과는 업종·경쟁 강도에 따라 다를 수 있습니다.
        </p>

      </div>
    </section>
  );
}
