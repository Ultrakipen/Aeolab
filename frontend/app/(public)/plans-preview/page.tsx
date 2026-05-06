"use client";

import Link from "next/link";
import { useState } from "react";

// ────────────────────────────────────────────────────────────
// 업종별 Mock 데이터
// ────────────────────────────────────────────────────────────
type CategoryKey = "restaurant" | "cafe" | "beauty" | "academy";
type PlanKey = "basic" | "pro" | "startup";

interface MockData {
  name: string;
  competitors: string[];
  missing_keywords: string[];
  platform_counts: Record<string, number>;
  top_competitor_count: number;
  review_sample: string;
  track1: number;
  track2: number;
  unified: number;
  stage: string;
  stage_color: string;
  top_biz_score: number;
  avg_score: number;
  avg_reviews: number;
  briefing_ratio: number;
  market_timing: string;
  market_timing_color: string;
  competition_level: string;
  competition_color: string;
  top10_score: number;
  top_biz_strengths: string[];
  top_biz_weaknesses: string[];
  entry_strategy: string[];
  condition_queries: Array<{ query: string; found: boolean }>;
}

const MOCK_DATA: Record<CategoryKey, MockData> = {
  restaurant: {
    name: "우리동네 한식당",
    competitors: ["맛있는 김치찌개", "할머니 순대국", "원조 갈비탕", "골목식당", "청기와 밥집", "한솥 도시락", "향토 설렁탕", "미가 한정식", "뚝배기 집", "촌닭발"],
    missing_keywords: ["혼밥 가능", "주차 있음", "포장 됩니다"],
    platform_counts: { naver: 31, gemini: 28, chatgpt: 0, claude: 0, google: 0 },
    top_competitor_count: 58,
    review_sample: "밥이 맛있고 반찬이 깔끔해요",
    track1: 42,
    track2: 28,
    unified: 37,
    stage: "안정기",
    stage_color: "bg-amber-100 text-amber-700",
    top_biz_score: 58,
    avg_score: 51,
    avg_reviews: 87,
    briefing_ratio: 23,
    market_timing: "기회 있음",
    market_timing_color: "text-emerald-700 bg-emerald-50",
    competition_level: "중간",
    competition_color: "text-amber-700 bg-amber-50",
    top10_score: 72,
    top_biz_strengths: ["리뷰 312개 + FAQ 8개 등록 → AI 브리핑 자주 인용됨", "스마트플레이스 소개글 최적화 완료"],
    top_biz_weaknesses: ["블로그 콘텐츠가 전혀 없음 → 공략 가능", "ChatGPT·구글 AI에 정보 없음"],
    entry_strategy: [
      "오픈 초기 리뷰 50개 집중 수집 → AI는 리뷰 수가 많은 가게를 신뢰도 높은 정보로 처리합니다",
      "스마트플레이스 소개글 안 Q&A 8개 이상 추가 (오픈일부터) → 경쟁 가게 1위가 소개글 Q&A로 AI 브리핑 인용 후보가 자주 됩니다",
      "'혼밥', '주차', '포장' 키워드를 소개글에 포함 → 이 지역에서 가장 많이 검색되는 조건입니다",
    ],
    condition_queries: [
      { query: "혼밥 가능한 한식당 알려줘", found: false },
      { query: "점심 빠른 한식당 추천해줘", found: true },
      { query: "주차 있는 근처 식당", found: false },
      { query: "가성비 좋은 한식당", found: true },
      { query: "포장 되는 한식당 알려줘", found: false },
    ],
  },
  cafe: {
    name: "카페 온기",
    competitors: ["스튜디오 봄봄", "커피 한잔", "달빛카페", "카페 라온", "브루잉 서울", "콩다방", "하루 카페", "씨앗 커피", "모닝 브루", "카페 달"],
    missing_keywords: ["노트북 가능", "콘센트 있음", "조용한 카페"],
    platform_counts: { naver: 19, gemini: 22, chatgpt: 0, claude: 0, google: 5 },
    top_competitor_count: 61,
    review_sample: "분위기 좋고 커피 맛있어요",
    track1: 38,
    track2: 32,
    unified: 34,
    stage: "안정기",
    stage_color: "bg-amber-100 text-amber-700",
    top_biz_score: 61,
    avg_score: 47,
    avg_reviews: 102,
    briefing_ratio: 19,
    market_timing: "기회 있음",
    market_timing_color: "text-emerald-700 bg-emerald-50",
    competition_level: "높음",
    competition_color: "text-red-700 bg-red-50",
    top10_score: 75,
    top_biz_strengths: ["인스타그램 연동 + 사진 리뷰 268개", "노트북 가능, 콘센트 있음 소개글 Q&A"],
    top_biz_weaknesses: ["저녁 이후 운영 정보 없음", "주차 정보가 빠져 있음"],
    entry_strategy: [
      "오픈 첫 달에 사진 리뷰 30개 이상 확보 → 카페는 시각적 신뢰도가 핵심입니다",
      "'노트북 가능', '콘센트 있음', '조용한' 키워드를 소개글 Q&A에 추가 → 재택·학생 손님의 조건 검색에서 우선 노출",
      "인스타그램 링크를 스마트플레이스에 연결 → AI가 소셜 신호를 가시성 점수에 반영합니다",
    ],
    condition_queries: [
      { query: "노트북 쓸 수 있는 카페 알려줘", found: false },
      { query: "조용한 카페 추천해줘", found: false },
      { query: "콘센트 있는 카페", found: false },
      { query: "분위기 좋은 카페", found: true },
      { query: "혼자 가기 좋은 카페", found: true },
    ],
  },
  beauty: {
    name: "헤어림 미용실",
    competitors: ["예쁨 헤어", "트렌드 살롱", "봄봄 헤어", "미소 헤어샵", "스타일 헤어", "뷰티 컷", "솔직 미용실", "아이린 헤어", "스타일 팩토리", "헤어 라운지"],
    missing_keywords: ["남성 커트", "당일 예약", "주차 가능"],
    platform_counts: { naver: 27, gemini: 15, chatgpt: 0, claude: 0, google: 3 },
    top_competitor_count: 54,
    review_sample: "원장님이 꼼꼼하게 해주세요",
    track1: 45,
    track2: 18,
    unified: 36,
    stage: "안정기",
    stage_color: "bg-amber-100 text-amber-700",
    top_biz_score: 54,
    avg_score: 43,
    avg_reviews: 64,
    briefing_ratio: 17,
    market_timing: "안정",
    market_timing_color: "text-blue-700 bg-blue-50",
    competition_level: "중간",
    competition_color: "text-amber-700 bg-amber-50",
    top10_score: 69,
    top_biz_strengths: ["당일 예약 가능 소개글 Q&A + 카카오톡 예약 연동", "남성 전용 커트 메뉴 명시"],
    top_biz_weaknesses: ["리뷰 답변이 전혀 없음 → AI 신호 약함", "블로그 게시물 2년째 없음"],
    entry_strategy: [
      "카카오톡 채널 연동 예약 + '당일 예약 가능' 소개글 Q&A 추가 → 즉흥 방문 손님의 조건 검색 우선 노출",
      "리뷰에 키워드 답변 달기 → AI가 사장님 답변도 인용합니다. 답변에 '남성 커트', '주차 가능' 포함",
      "시술 전후 사진 리뷰 유도 → 헤어는 시각적 신뢰도가 예약 전환율에 직결됩니다",
    ],
    condition_queries: [
      { query: "당일 예약 되는 미용실", found: false },
      { query: "남성 커트 잘하는 곳", found: false },
      { query: "주차 되는 미용실 추천", found: false },
      { query: "가격 합리적인 헤어샵", found: true },
      { query: "친절한 미용실 알려줘", found: true },
    ],
  },
  academy: {
    name: "성공 영어학원",
    competitors: ["우리 수학학원", "탑 영어", "미래 학원", "강남 국어", "스마트 영어", "논술 왕", "사고력 수학", "독서 논술", "창의 영재", "알파 학원"],
    missing_keywords: ["성인반 있음", "무료 체험", "1대1 수업"],
    platform_counts: { naver: 12, gemini: 18, chatgpt: 0, claude: 8, google: 0 },
    top_competitor_count: 49,
    review_sample: "선생님이 친절하고 설명을 잘 해요",
    track1: 30,
    track2: 35,
    unified: 32,
    stage: "생존기",
    stage_color: "bg-red-100 text-red-700",
    top_biz_score: 49,
    avg_score: 38,
    avg_reviews: 41,
    briefing_ratio: 12,
    market_timing: "기회 있음",
    market_timing_color: "text-emerald-700 bg-emerald-50",
    competition_level: "낮음",
    competition_color: "text-emerald-700 bg-emerald-50",
    top10_score: 65,
    top_biz_strengths: ["무료 체험 수업 소개글 Q&A → AI에 자주 인용됨", "수업 후기 블로그 월 2편 운영"],
    top_biz_weaknesses: ["성인반 정보가 전혀 없음", "가격 정보가 없어 문의 전환율 낮음"],
    entry_strategy: [
      "'무료 체험 가능', '1대1 수업', '성인반 운영' 키워드를 소개글 Q&A에 추가 → 전화 문의 전 AI가 먼저 답합니다",
      "수업 후기 블로그 월 2편 → 학원은 정보 신뢰도가 등록 결정에 영향, AI가 블로그 내용을 학원 신호로 처리",
      "가격 범위를 소개글에 명시 → '저렴한 영어학원' 조건 검색에서 우선 노출됩니다",
    ],
    condition_queries: [
      { query: "성인 영어 학원 추천해줘", found: false },
      { query: "무료 체험 있는 영어학원", found: false },
      { query: "1대1 수업 되는 학원", found: false },
      { query: "초등 영어 학원 알려줘", found: true },
      { query: "저렴한 영어 학원", found: false },
    ],
  },
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  restaurant: "음식점",
  cafe: "카페",
  beauty: "미용실",
  academy: "학원",
};

const PLATFORM_LABELS: Record<string, string> = {
  naver: "네이버 AI 브리핑",
  gemini: "Gemini (구글)",
  chatgpt: "ChatGPT",
  claude: "Claude AI",
  google: "Google AI",
};

// ────────────────────────────────────────────────────────────
// 잠금 카드 (블러 처리 + 오버레이)
// ────────────────────────────────────────────────────────────
function LockedCard({ title, planLabel, children }: {
  title: string;
  planLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3">{title}</h3>
      <div className="relative rounded-xl overflow-hidden">
        <div className="blur-[3px] pointer-events-none select-none opacity-60">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/75 rounded-xl">
          <span className="text-2xl">🔒</span>
          <span className="text-sm font-bold text-gray-700">{planLabel}</span>
          <Link href="/signup" className="text-sm text-indigo-600 font-semibold hover:underline">
            구독하면 바로 확인 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SVG 선 그래프
// ────────────────────────────────────────────────────────────
function TrendGraph({ days, annotation }: { days: number; annotation?: string }) {
  const scores30 = [29, 31, 30, 33, 35, 34, 36, 35, 37, 38, 37, 36, 38, 39, 37, 38, 40, 39, 38, 37, 39, 40, 41, 40, 39, 41, 42, 41, 40, 37];
  const scores60extra = [22, 24, 23, 25, 27, 26, 27, 28, 29, 28, 27, 29, 30, 32, 33, 32, 34, 35, 34, 36, 38, 39, 40, 42, 45, 47, 46, 44, 42, 40];
  const allScores = days === 90 ? [...scores60extra, ...scores30] : scores30;

  const w = 400;
  const h = 100;
  const minS = Math.min(...allScores) - 5;
  const maxS = Math.max(...allScores) + 5;

  const points = allScores.map((s, i) => {
    const x = (i / (allScores.length - 1)) * w;
    const y = h - ((s - minS) / (maxS - minS)) * h;
    return `${x},${y}`;
  });

  const lastX = w;
  const lastY = h - ((allScores[allScores.length - 1] - minS) / (maxS - minS)) * h;

  // 피크 위치 (90일 기준 25번째 = 성수기)
  const peakIdx = days === 90 ? 24 : -1;
  const peakX = peakIdx >= 0 ? (peakIdx / (allScores.length - 1)) * w : -1;
  const peakY = peakIdx >= 0 ? h - ((allScores[peakIdx] - minS) / (maxS - minS)) * h : -1;

  return (
    <div className="bg-gray-50 rounded-xl p-3 mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastX} cy={lastY} r="5" fill="#6366f1" />
        {peakIdx >= 0 && (
          <>
            <line x1={peakX} y1="0" x2={peakX} y2={h} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" />
            <circle cx={peakX} cy={peakY} r="5" fill="#f59e0b" />
            <text x={peakX + 6} y="14" fontSize="10" fill="#b45309" fontWeight="600">{annotation}</text>
          </>
        )}
      </svg>
      <div className="flex justify-between mt-1 text-sm text-gray-500">
        <span>{days === 90 ? "90일 전" : "30일 전"}</span>
        <span>오늘 37점</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 경쟁사 바 차트
// ────────────────────────────────────────────────────────────
function CompetitorBar({ name, score, max, isMine }: { name: string; score: number; max: number; isMine?: boolean }) {
  const pct = (score / max) * 100;
  return (
    <div className={`flex items-center gap-2 md:gap-3 mt-2 ${isMine ? "py-1" : ""}`}>
      <span className={`text-sm w-24 md:w-32 shrink-0 truncate ${isMine ? "font-bold text-indigo-700" : "text-gray-600"}`}>
        {isMine ? `★ ${name}` : name}
      </span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full ${isMine ? "bg-indigo-500" : "bg-gray-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-bold w-8 text-right ${isMine ? "text-indigo-700" : "text-gray-700"}`}>{score}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 기능 비교표
// ────────────────────────────────────────────────────────────
function ComparisonTable() {
  const rows = [
    { feature: "AI 7개 채널 노출 분석", basic: true, pro: true, startup: true },
    { feature: "없는 키워드 3개 제시", basic: true, pro: true, startup: true },
    { feature: "이번 주 행동 1가지 안내", basic: true, pro: true, startup: true },
    { feature: "자동 스캔 빈도", basic: "매일", pro: "주 3회 전체", startup: "매일" },
    { feature: "점수 추이 히스토리", basic: "30일", pro: "90일", startup: "90일" },
    { feature: "경쟁 가게 등록", basic: "3곳", pro: "5곳", startup: "5곳" },
    { feature: "가이드 생성/월", basic: "3회", pro: "10회", startup: "5회" },
    { feature: "조건 검색 분석", basic: false, pro: true, startup: false },
    { feature: "PDF·CSV 내보내기", basic: false, pro: true, startup: true },
    { feature: "창업 타이밍 지수", basic: false, pro: false, startup: true },
    { feature: "경쟁 가게 분석 리포트", basic: false, pro: false, startup: true },
    { feature: "AI 진입 전략", basic: false, pro: false, startup: true },
    { feature: "월 가격", basic: "9,900원", pro: "18,900원", startup: "12,900원" },
  ];

  const renderCell = (val: boolean | string) => {
    if (val === true) return <span className="text-emerald-600 font-bold text-base">✅</span>;
    if (val === false) return <span className="text-gray-500 text-base">❌</span>;
    return <span className="text-sm font-semibold text-gray-700">{val}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-3 font-semibold text-gray-700 w-48">기능</th>
            <th className="p-3 font-semibold text-gray-700 text-center">Basic<br /><span className="text-indigo-600">9,900원</span></th>
            <th className="p-3 font-bold text-indigo-700 text-center bg-indigo-50">Pro<br /><span className="text-indigo-600">18,900원</span></th>
            <th className="p-3 font-semibold text-gray-700 text-center">창업패키지<br /><span className="text-emerald-600">12,900원</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
              <td className="p-3 text-gray-700">{row.feature}</td>
              <td className="p-3 text-center">{renderCell(row.basic)}</td>
              <td className="p-3 text-center bg-indigo-50/30">{renderCell(row.pro)}</td>
              <td className="p-3 text-center">{renderCell(row.startup)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Basic 탭 콘텐츠
// ────────────────────────────────────────────────────────────
function BasicContent({ d }: { d: MockData }) {
  const maxScore = Math.max(d.top_biz_score, 70);
  const comp3 = d.competitors.slice(0, 3);
  const compScores = [d.top_biz_score, d.top_biz_score - 9, d.top_biz_score - 14];

  return (
    <div className="space-y-4">
      {/* 카드 1: AI 노출 현황 */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="text-base md:text-lg font-bold text-gray-900">AI가 내 가게를 알고 있나요?</h3>
          <span className={`text-sm font-bold px-2 py-1 rounded-full w-fit ${d.stage_color}`}>{d.stage}</span>
        </div>

        {/* 종합 점수 */}
        <div className="flex items-end gap-3 mb-4">
          <span className="text-4xl md:text-5xl font-black text-indigo-600">{d.unified}</span>
          <span className="text-base text-gray-500 mb-1">/ 100점</span>
        </div>

        {/* 채널 점수 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-sm text-blue-600 font-semibold mb-1">네이버 AI 채널</div>
            <div className="text-2xl font-black text-blue-700">{d.track1}점</div>
            <div className="text-sm text-blue-500 mt-0.5">스마트플레이스 기반</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <div className="text-sm text-purple-600 font-semibold mb-1">ChatGPT·구글 AI</div>
            <div className="text-2xl font-black text-purple-700">{d.track2}점</div>
            <div className="text-sm text-purple-500 mt-0.5">글로벌 AI 채널</div>
          </div>
        </div>

        {/* 경쟁 비교 배너 */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
          <p className="text-sm font-semibold text-red-700">
            경쟁 가게 평균은 {d.avg_score}점입니다. 지금 AI 검색에서 밀리고 있습니다.
          </p>
        </div>

        {/* AI 플랫폼별 결과 */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700 mb-2">AI 100번 검색 결과</p>
          {Object.entries(d.platform_counts).map(([platform, count]) => (
            <div key={platform} className="flex items-center gap-3">
              <span className={`text-base ${count > 0 ? "text-emerald-500" : "text-red-400"}`}>
                {count > 0 ? "✅" : "❌"}
              </span>
              <span className="text-sm text-gray-700 w-36 shrink-0">{PLATFORM_LABELS[platform]}</span>
              <span className={`text-sm font-bold ${count > 0 ? "text-emerald-700" : "text-red-600"}`}>
                {count > 0 ? `${count}번 나왔습니다` : "한 번도 안 나왔습니다"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-sm text-amber-800">
            AI가 손님에게 내 가게를 추천하려면 AI가 먼저 내 가게를 &apos;알아야&apos; 합니다.
            ChatGPT·구글 AI에는 아직 내 가게 정보가 없습니다.
          </p>
        </div>
      </div>

      {/* 카드 2: 없는 키워드 */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1">경쟁 가게는 갖고 있는데 내 가게엔 없는 키워드</h3>
        <p className="text-sm text-gray-500 mb-4">이 키워드가 없으면 AI 추천 목록에서 빠집니다</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {d.missing_keywords.map((kw) => (
            <span key={kw} className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-lg">
              {kw} ✕
            </span>
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-sm text-gray-700">
            손님이 AI에 &apos;<strong>{d.missing_keywords[0]}</strong> {d.name.includes("한식") ? "한식당" : d.name.includes("카페") ? "카페" : d.name.includes("헤어") ? "미용실" : "학원"} 알려줘&apos;라고 물으면
            이 키워드가 없는 가게는 추천 목록에서 빠집니다.
          </p>
        </div>

        <Link href="/signup" className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">
          가이드에서 해결 방법 보기 →
        </Link>
      </div>

      {/* 카드 3: 이번 주 행동 */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-3">이번 주 가장 효과 큰 행동 1가지</h3>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            소개글에 &apos;<strong>{d.missing_keywords[0]}</strong>&apos; 키워드를 포함한 Q&A 섹션을 추가하세요.
          </p>
          <p className="text-sm text-blue-700">
            소개글 안 Q&A는 AI 브리핑 인용 후보 경로 중 하나입니다.
            5분이면 됩니다. 가이드에서 복사해서 붙여넣기만 하면 됩니다.
          </p>
        </div>
      </div>

      {/* 카드 4: 경쟁 가게 비교 (3곳) */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-900">주변 경쟁 가게와 AI 노출 비교</h3>
          <span className="text-sm text-gray-500">Basic · 경쟁 가게 3곳까지</span>
        </div>
        <CompetitorBar name={d.name} score={d.unified} max={maxScore} isMine />
        {comp3.map((name, i) => (
          <CompetitorBar key={name} name={name} score={compScores[i]} max={maxScore} />
        ))}
        <div className="mt-4 bg-orange-50 rounded-xl p-3">
          <p className="text-sm text-orange-800">
            1위 경쟁 가게보다 <strong>{d.top_biz_score - d.unified}점 낮습니다.</strong>
            어떤 항목에서 차이가 나는지 6개 차원으로 분석해 드립니다.
          </p>
        </div>
      </div>

      {/* 카드 5: 30일 추이 */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
          <h3 className="text-base md:text-lg font-bold text-gray-900">내 가게 AI 노출 점수 변화</h3>
          <span className="text-sm text-gray-500">Basic · 최근 30일</span>
        </div>
        <TrendGraph days={30} />
        <p className="text-sm text-gray-500 mt-3">
          점수가 낮아지는 날 = 경쟁 가게가 올라가는 날입니다.
          변화가 생기면 원인을 파악해 빠르게 대응해야 합니다.
        </p>
      </div>

      {/* 잠금 섹션 */}
      <LockedCard title="손님이 조건으로 검색할 때 결과" planLabel="Pro 전용 · 손님이 실제로 검색하는 방식으로 분석">
        <div className="space-y-2 p-2">
          {[
            { q: `${d.missing_keywords[0]} ${d.name.includes("한식") ? "한식당" : "가게"} 알려줘`, found: false },
            { q: "점심 빠른 식당 추천해줘", found: true },
            { q: `${d.missing_keywords[1]} 근처 가게`, found: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={item.found ? "text-emerald-500" : "text-red-400"}>{item.found ? "✅" : "❌"}</span>
              <span className="text-sm text-gray-700">&quot;{item.q}&quot;</span>
            </div>
          ))}
        </div>
      </LockedCard>

      <LockedCard title="90일 장기 점수 추이" planLabel="Pro 전용 · 계절 패턴·이벤트 효과 파악">
        <div className="p-2">
          <TrendGraph days={90} annotation="성수기 +15점" />
        </div>
      </LockedCard>

      <LockedCard title="PDF 분석 리포트" planLabel="Pro 전용 · 인쇄·제출용 공식 보고서">
        <div className="p-3 border border-gray-200 rounded-xl text-center">
          <p className="text-sm font-bold text-gray-700">AI 노출 분석 리포트</p>
          <p className="text-sm text-gray-500 mt-1">2024년 12월 | {d.name} | 종합 {d.unified}점</p>
          <div className="mt-2 h-12 bg-gray-100 rounded-lg" />
        </div>
      </LockedCard>

      {/* CTA */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 md:p-8 text-center">
        <p className="text-lg md:text-xl font-black text-indigo-900 mb-1">Basic으로 시작하기 — 9,900원/월</p>
        <p className="text-sm text-indigo-600 mb-4">&quot;AI 분석 한 번에 커피값입니다&quot;</p>
        <Link href="/signup?plan=basic" className="inline-block bg-indigo-600 text-white font-bold text-base px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors">
          지금 구독하기 →
        </Link>
        <p className="text-sm text-gray-500 mt-3">30일 무료 체험 없이 바로 시작 · 언제든 해지 가능</p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Pro 탭 콘텐츠
// ────────────────────────────────────────────────────────────
function ProContent({ d }: { d: MockData }) {
  const maxScore = Math.max(d.top_biz_score, 70);
  const compScores = [d.top_biz_score, d.top_biz_score - 9, d.top_biz_score - 14, d.top_biz_score - 17, d.top_biz_score - 19, d.top_biz_score - 22, d.unified, d.unified - 3, d.unified - 6, d.unified - 10];
  const [foundCount] = [d.condition_queries.filter(q => !q.found).length];

  return (
    <div className="space-y-4">
      {/* Basic 카드 1~5 재사용 */}
      <BasicContent d={d} />

      {/* Pro 추가 카드 1: 조건 검색 분석 (잠금 해제) */}
      <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-2 py-0.5 rounded-full">Pro 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">손님이 &apos;AI야, ~한 가게 알려줘&apos;라고 물을 때</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">이런 검색에 내 가게가 나오는지 매주 확인합니다</p>

        <div className="space-y-2 mb-4">
          {d.condition_queries.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <span className={`text-base shrink-0 ${item.found ? "text-emerald-500" : "text-red-400"}`}>
                {item.found ? "✅" : "❌"}
              </span>
              <span className="text-sm text-gray-700 flex-1">&quot;{item.query}&quot;</span>
              <span className={`text-sm font-semibold shrink-0 ${item.found ? "text-emerald-600" : "text-red-500"}`}>
                {item.found ? "나옵니다" : "안 나옵니다"}
              </span>
            </div>
          ))}
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-sm font-semibold text-red-700">
            5개 검색 중 {foundCount}개에서 안 나옵니다.
            &apos;{d.missing_keywords.join(", ")}&apos; 키워드를 FAQ에 추가하면 해결됩니다.
          </p>
          <p className="text-sm text-red-600 mt-1">→ 가이드에서 바로 복사 가능한 문구를 드립니다</p>
        </div>
      </div>

      {/* Pro 추가 카드 2: 90일 추이 */}
      <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-2 py-0.5 rounded-full">Pro 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">90일 점수 변화 — 언제 올랐고 언제 내렸나</h3>
        </div>
        <TrendGraph days={90} annotation="성수기 +15점" />
        <p className="text-sm text-gray-500 mt-3">
          30일만 보면 놓치는 패턴이 있습니다.
          언제 집중 관리해야 하는지 90일 데이터로 파악합니다.
        </p>
      </div>

      {/* Pro 추가 카드 3: 경쟁 가게 5곳 */}
      <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-2 py-0.5 rounded-full">Pro 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">주변 경쟁 가게 5곳 전체 순위</h3>
        </div>
        {d.competitors.map((name, i) => (
          <CompetitorBar key={name} name={name} score={compScores[i] ?? d.unified - 5} max={maxScore} isMine={i === 6} />
        ))}
        <div className="mt-3 bg-orange-50 rounded-xl p-3">
          <p className="text-sm text-orange-800">지역 내 5곳 중 4위입니다. 1위까지 <strong>{d.top_biz_score - d.unified}점 차이</strong>입니다.</p>
        </div>
      </div>

      {/* Pro 추가 카드 4: PDF·CSV */}
      <div className="bg-white border-2 border-indigo-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-2 py-0.5 rounded-full">Pro 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">PDF·CSV 내보내기</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="flex-1 border border-indigo-200 text-indigo-700 font-semibold text-sm px-4 py-3 rounded-xl hover:bg-indigo-50 transition-colors">
            📄 PDF 분석 보고서 받기
          </button>
          <button className="flex-1 border border-indigo-200 text-indigo-700 font-semibold text-sm px-4 py-3 rounded-xl hover:bg-indigo-50 transition-colors">
            📊 엑셀로 데이터 내보내기
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">세무사·컨설턴트에게 제출하거나 직접 기록용으로 보관</p>
      </div>

      {/* 잠금: 창업패키지 전용 */}
      <LockedCard title="창업 시장 분석" planLabel="창업패키지 전용">
        <div className="p-3 bg-emerald-50 rounded-xl">
          <p className="text-sm font-semibold text-emerald-800">이 지역 한식당 창업 타이밍 → 기회 있음</p>
          <p className="text-sm text-emerald-700 mt-1">경쟁 강도: 중간 | AI 상위 10% 점수: 72점</p>
        </div>
      </LockedCard>

      {/* CTA */}
      <div className="bg-indigo-600 rounded-2xl p-5 md:p-8 text-center text-white">
        <p className="text-lg md:text-xl font-black mb-1">Pro로 업그레이드 — 18,900원/월</p>
        <p className="text-sm text-indigo-200 mb-4">Basic보다 월 8,000원 더. 조건 검색 분석 1개로 새 손님 1명 더 오면 본전입니다</p>
        <Link href="/signup?plan=pro" className="inline-block bg-white text-indigo-700 font-bold text-base px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors">
          지금 구독하기 →
        </Link>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 창업패키지 탭 콘텐츠
// ────────────────────────────────────────────────────────────
function StartupContent({ d, category }: { d: MockData; category: CategoryKey }) {
  const maxScore = Math.max(d.top_biz_score, 70);
  const comp3Scores = [d.top_biz_score, d.top_biz_score - 14, d.top_biz_score - 21];

  return (
    <div className="space-y-4">
      {/* 카드 1: 창업 타이밍 지수 */}
      <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-emerald-100 text-emerald-700 text-sm font-bold px-2 py-0.5 rounded-full">창업패키지 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">지금 이 업종·지역에서 창업하면 어떨까요?</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">AI 검색 데이터 기반 창업 타이밍 분석</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className={`rounded-xl p-3 text-center ${d.market_timing_color}`}>
            <div className="text-sm font-semibold mb-1">진입 타이밍</div>
            <div className="text-sm font-black">{d.market_timing} ↑</div>
          </div>
          <div className={`rounded-xl p-3 text-center ${d.competition_color}`}>
            <div className="text-sm font-semibold mb-1">경쟁 강도</div>
            <div className="text-sm font-black">{d.competition_level}</div>
          </div>
          <div className="rounded-xl p-3 text-center bg-indigo-50 text-indigo-700">
            <div className="text-sm font-semibold mb-1">상위 10% 점수</div>
            <div className="text-sm font-black">{d.top10_score}점</div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-sm text-emerald-800">
            지금 이 지역 {CATEGORY_LABELS[category]} 상위 10% 점수는 <strong>{d.top10_score}점</strong>입니다.
            지금 창업해서 6개월 안에 {d.top10_score}점 달성하면 상위 10%에 들 수 있습니다.
            현재 경쟁 강도는 &apos;{d.competition_level}&apos; — 너무 늦지 않았습니다.
          </p>
        </div>
      </div>

      {/* 카드 2: 운영 중 경쟁 가게 현황 */}
      <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-emerald-100 text-emerald-700 text-sm font-bold px-2 py-0.5 rounded-full">창업패키지 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">지금 이 지역에서 잘 되는 가게들의 공통점</h3>
        </div>

        <div className="space-y-4">
          {comp3Scores.map((score, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-800">{i + 1}위 {d.competitors[i]}</span>
                <span className="text-sm font-black text-gray-600">{score}점</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(score / maxScore) * 100}%` }} />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-emerald-700 font-semibold">강점: {d.top_biz_strengths[i % d.top_biz_strengths.length]}</p>
                <p className="text-sm text-red-600 font-semibold">약점: {d.top_biz_weaknesses[i % d.top_biz_weaknesses.length]}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <p className="text-sm text-emerald-800">
            1위 가게의 약점인 &apos;<strong>{d.top_biz_weaknesses[0]}</strong>&apos;을
            창업 초기에 집중하면 6개월 내 추월 가능합니다
          </p>
        </div>
      </div>

      {/* 카드 3: AI 기반 진입 전략 */}
      <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-emerald-100 text-emerald-700 text-sm font-bold px-2 py-0.5 rounded-full">창업패키지 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">AI가 추천하는 이 지역 창업 3대 전략</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Claude AI 분석 기반</p>

        <div className="space-y-3">
          {d.entry_strategy.map((strategy, i) => {
            const [title, desc] = strategy.split(" → ");
            return (
              <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                <span className="bg-indigo-600 text-white text-sm font-black w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  {desc && <p className="text-sm text-gray-500 mt-0.5">→ {desc}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 카드 4: 시장 현황 수치 */}
      <div className="bg-white border-2 border-emerald-200 rounded-xl shadow-sm p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-emerald-100 text-emerald-700 text-sm font-bold px-2 py-0.5 rounded-full">창업패키지 전용</span>
          <h3 className="text-base md:text-lg font-bold text-gray-900">이 지역 시장 현황</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-gray-700">{d.avg_score}점</div>
            <div className="text-sm text-gray-500 mt-0.5">업종 평균 AI 점수</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-gray-700">{d.avg_reviews}개</div>
            <div className="text-sm text-gray-500 mt-0.5">평균 리뷰 수</div>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-gray-700">{d.briefing_ratio}%</div>
            <div className="text-sm text-gray-500 mt-0.5">AI 브리핑 노출 비율</div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <p className="text-sm text-emerald-800">
            아직 <strong>{100 - d.briefing_ratio}%의 가게</strong>가 AI 브리핑에 안 나옵니다.
            먼저 최적화하면 유리합니다.
          </p>
        </div>
      </div>

      {/* 잠금 섹션 */}
      <LockedCard title="손님이 조건으로 검색할 때 결과" planLabel="Pro 전용">
        <div className="space-y-2 p-2">
          {d.condition_queries.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={item.found ? "text-emerald-500" : "text-red-400"}>{item.found ? "✅" : "❌"}</span>
              <span className="text-sm text-gray-700">&quot;{item.query}&quot;</span>
            </div>
          ))}
        </div>
      </LockedCard>

      {/* CTA */}
      <div className="bg-emerald-600 rounded-2xl p-5 md:p-8 text-center text-white">
        <p className="text-lg md:text-xl font-black mb-1">창업 준비 중이라면 창업패키지 — 12,900원/월</p>
        <p className="text-sm text-emerald-200 mb-4">창업 컨설팅 한 번 비용으로 6개월 AI 데이터 확보</p>
        <Link href="/signup?plan=startup" className="inline-block bg-white text-emerald-700 font-bold text-base px-6 py-3 rounded-xl hover:bg-emerald-50 transition-colors">
          지금 구독하기 →
        </Link>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────
export default function PlansPreviewPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("restaurant");
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("basic");

  const d = MOCK_DATA[selectedCategory];

  const categoryButtons: { key: CategoryKey; label: string; emoji: string }[] = [
    { key: "restaurant", label: "음식점", emoji: "🍚" },
    { key: "cafe", label: "카페", emoji: "☕" },
    { key: "beauty", label: "미용실", emoji: "✂️" },
    { key: "academy", label: "학원", emoji: "📚" },
  ];

  const planButtons: { key: PlanKey; label: string; price: string }[] = [
    { key: "basic", label: "Basic", price: "9,900원" },
    { key: "pro", label: "Pro", price: "18,900원" },
    { key: "startup", label: "창업패키지", price: "12,900원" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <Link href="/" className="text-indigo-600 font-bold text-sm">← AEOlab</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        {/* 상단 안내 */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
            손님이 AI에서 내 가게를 찾을 때
          </h1>
          <p className="text-sm md:text-base text-gray-500">
            어떤 결과를 볼 수 있는지 미리 확인하세요
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
            <span className="text-amber-600 text-sm font-semibold">실제 데모 데이터 · 구독 후 내 가게 분석 가능</span>
          </div>
        </div>

        {/* 업종 선택 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-sm font-bold text-gray-700 mb-3">업종 선택</p>
          <div className="grid grid-cols-4 gap-2">
            {categoryButtons.map(({ key, label, emoji }) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`flex flex-col items-center gap-1 p-2 md:p-3 rounded-xl text-sm font-semibold transition-colors border-2 ${
                  selectedCategory === key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100"
                }`}
              >
                <span className="text-xl">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 플랜 탭 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <p className="text-sm font-bold text-gray-700 mb-3">요금제별 분석 화면 미리보기</p>
          <div className="flex gap-2">
            {planButtons.map(({ key, label, price }) => (
              <button
                key={key}
                onClick={() => setSelectedPlan(key)}
                className={`flex-1 py-2 px-1 rounded-xl text-sm font-bold transition-colors border-2 ${
                  selectedPlan === key
                    ? key === "startup"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-indigo-600 text-white border-indigo-600"
                    : "bg-gray-50 text-gray-600 border-transparent hover:bg-gray-100"
                }`}
              >
                <div>{label}</div>
                <div className={`text-sm mt-0.5 ${selectedPlan === key ? "text-white/80" : "text-gray-500"}`}>{price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 선택된 사업장 정보 표시 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          <p className="text-sm text-gray-500">
            <strong className="text-gray-800">{d.name}</strong> ({CATEGORY_LABELS[selectedCategory]}) 기준 예시
          </p>
        </div>

        {/* 플랜별 콘텐츠 */}
        {selectedPlan === "basic" && <BasicContent d={d} />}
        {selectedPlan === "pro" && <ProContent d={d} />}
        {selectedPlan === "startup" && <StartupContent d={d} category={selectedCategory} />}

        {/* 기능 비교표 */}
        <div className="mt-8 bg-white border border-gray-100 rounded-2xl shadow-sm p-4 md:p-6">
          <h2 className="text-base md:text-lg font-black text-gray-900 mb-4 text-center">요금제별 기능 비교</h2>
          <ComparisonTable />
        </div>

        {/* 하단 CTA 3개 */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/signup?plan=basic" className="block bg-white border-2 border-indigo-200 text-indigo-700 font-bold text-sm text-center px-4 py-4 rounded-xl hover:bg-indigo-50 transition-colors">
            <div className="text-base font-black">Basic</div>
            <div className="text-indigo-600 font-black">9,900원/월</div>
            <div className="text-sm text-gray-500 mt-1">지금 시작하기 →</div>
          </Link>
          <Link href="/signup?plan=pro" className="block bg-indigo-600 text-white font-bold text-sm text-center px-4 py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md">
            <div className="text-base font-black">Pro</div>
            <div className="font-black">18,900원/월</div>
            <div className="text-sm text-indigo-200 mt-1">지금 시작하기 →</div>
          </Link>
          <Link href="/signup?plan=startup" className="block bg-white border-2 border-emerald-200 text-emerald-700 font-bold text-sm text-center px-4 py-4 rounded-xl hover:bg-emerald-50 transition-colors">
            <div className="text-base font-black">창업패키지</div>
            <div className="text-emerald-600 font-black">12,900원/월</div>
            <div className="text-sm text-gray-500 mt-1">지금 시작하기 →</div>
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">언제든 해지 가능 · 구독 후 즉시 이용</p>
      </div>
    </div>
  );
}
