"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Lightbulb, AlertCircle } from "lucide-react";

interface AICoverage {
  naver: boolean;
  chatgpt: boolean;
  google: boolean;
}

interface Competitor {
  name: string;
  score: number;
  rank: number;
  me: boolean;
  ai: AICoverage;
}

interface SampleData {
  region: string;
  category: string;
  badge: string;
  query: string;
  chatgptTemplate: string;
  naverActiveCategory: boolean;
  likelyCategory?: boolean;  // LIKELY: 2026년 AI탭 확장 예정 업종
  competitors: Competitor[];
  myWeakness: string;
  advice: string;
  adviceSub: string;
}

type CardTab = 0 | 1 | 2;

const SAMPLES: SampleData[] = [
  {
    region: "강남구 역삼동",
    category: "카페",
    badge: "AI 미노출",
    query: "강남 역삼동 카페 추천해줘, 분위기 좋은 곳으로",
    chatgptTemplate:
      "강남 역삼동에서 분위기 좋은 카페를 추천해드릴게요.\n\n{0}은 스페셜티 원두와 모던한 인테리어로 유명하고, {1}은 넓은 공간과 편안한 좌석이 장점입니다. {2}은 커피 맛이 뛰어나 커피 마니아들에게 인기가 많습니다.",
    naverActiveCategory: true,
    competitors: [
      { name: "블루보틀 강남점", score: 82, rank: 1, me: false, ai: { naver: true,  chatgpt: true,  google: true  } },
      { name: "커피빈 역삼점",   score: 73, rank: 2, me: false, ai: { naver: true,  chatgpt: true,  google: false } },
      { name: "테라로사 역삼점", score: 64, rank: 3, me: false, ai: { naver: true,  chatgpt: false, google: false } },
      { name: "내 카페",         score: 28, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소식 발행 0건 · 방문자리뷰 14건 · 대표사진 3장",
    advice: "3위 테라로사보다 AI 노출 격차 36 차이입니다.",
    adviceSub: "소식 1건 발행 + 소개글 메뉴·분위기 키워드 강화하면 네이버 AI가 내 카페를 찾기 시작합니다.",
  },
  {
    region: "마포구 연남동",
    category: "한식당",
    badge: "순위 위험",
    query: "연남동 한식 맛집 추천해줘, 점심으로 먹을 곳",
    chatgptTemplate:
      "연남동에서 한식 점심으로 좋은 맛집을 추천해드릴게요.\n\n{0}은 정갈한 한식 백반으로 유명하고, {1}은 손수 만든 칼국수가 일품입니다. {2}은 현지인들이 자주 찾는 가정식 식당입니다.",
    naverActiveCategory: true,
    competitors: [
      { name: "연남동 백반집", score: 78, rank: 1, me: false, ai: { naver: true,  chatgpt: true,  google: true  } },
      { name: "할매손칼국수", score: 69, rank: 2, me: false, ai: { naver: true,  chatgpt: true,  google: false } },
      { name: "연남식당",     score: 61, rank: 3, me: false, ai: { naver: true,  chatgpt: false, google: false } },
      { name: "내 식당",      score: 33, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소식 업데이트 없음 · 방문자리뷰 28건 · 단체예약 정보 없음",
    advice: "3위보다 AI 노출 격차 28 차이입니다.",
    adviceSub: "소개글에 '단체예약·주차 가능' 추가 시 네이버 AI탭 노출 가능성이 높아집니다.",
  },
  {
    region: "서초구 방배동",
    category: "미용실",
    badge: "AI 미노출",
    query: "방배동 헤어샵 커트 잘하는 곳 추천해줘",
    chatgptTemplate:
      "방배동에서 커트 잘하는 헤어샵을 추천해드릴게요.\n\n{0}은 전문 스타일리스트가 많아 만족도가 높고, {1}은 다양한 헤어 케어 서비스로 인기가 많습니다. {2}은 개인 맞춤형 스타일링으로 유명합니다.",
    naverActiveCategory: false,
    likelyCategory: true,
    competitors: [
      { name: "준오헤어 방배점", score: 84, rank: 1, me: false, ai: { naver: false, chatgpt: true,  google: true  } },
      { name: "이철헤어 방배점", score: 76, rank: 2, me: false, ai: { naver: false, chatgpt: true,  google: false } },
      { name: "박준뷰티랩",      score: 68, rank: 3, me: false, ai: { naver: false, chatgpt: false, google: false } },
      { name: "내 헤어샵",       score: 31, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 키워드 부족 · 리뷰 답변률 12% · 시술 카테고리 1개",
    advice: "3위 박준뷰티랩보다 AI 노출 격차 37 차이입니다.",
    adviceSub: "소개글 키워드 다양화 + 리뷰 답변률 개선 시 네이버 AI탭 노출 가능성이 높아집니다. ChatGPT·Google AI는 구글 비즈니스 프로필 등록이 핵심입니다.",
  },
  {
    region: "성남시 분당구",
    category: "피부과",
    badge: "순위 위험",
    query: "분당 피부과 추천해줘, 레이저 시술 잘하는 곳",
    chatgptTemplate:
      "분당에서 레이저 시술 잘하는 피부과를 추천해드릴게요.\n\n{0}은 최신 레이저 장비를 갖추고 피부 전문의가 직접 상담합니다. {1}은 다양한 시술 옵션으로 인기가 많습니다.",
    naverActiveCategory: false,
    competitors: [
      { name: "연세닥터스 피부과", score: 81, rank: 1, me: false, ai: { naver: false, chatgpt: true,  google: true  } },
      { name: "프리미어 피부과",   score: 74, rank: 2, me: false, ai: { naver: false, chatgpt: true,  google: false } },
      { name: "서울 피부과",       score: 66, rank: 3, me: false, ai: { naver: false, chatgpt: false, google: false } },
      { name: "내 피부과",         score: 42, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 부족 · 진료 시간 미등록 · 영수증리뷰 0건",
    advice: "3위보다 AI 노출 격차 24 차이입니다.",
    adviceSub: "소개글 강화 + 진료 시간 등록 시 네이버 AI탭 노출 가능성이 높아집니다. ChatGPT·Google AI는 구글 비즈니스 프로필 등록이 핵심입니다.",
  },
  {
    region: "송파구 잠실동",
    category: "헬스장",
    badge: "AI 미노출",
    query: "잠실 헬스장 추천해줘, 시설 좋은 곳으로",
    chatgptTemplate:
      "잠실에서 시설 좋은 헬스장을 추천해드릴게요.\n\n{0}은 넓은 공간과 최신 기구를 갖추고 있고, {1}은 PT 프로그램이 다양하고 전문적입니다.",
    naverActiveCategory: false,
    likelyCategory: true,
    competitors: [
      { name: "스포애니 잠실점", score: 79, rank: 1, me: false, ai: { naver: false, chatgpt: true,  google: true  } },
      { name: "바디프로필 짐",   score: 72, rank: 2, me: false, ai: { naver: false, chatgpt: true,  google: false } },
      { name: "파워짐 잠실",     score: 61, rank: 3, me: false, ai: { naver: false, chatgpt: false, google: false } },
      { name: "내 헬스장",       score: 26, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 없음 · PT 정보 없음 · 운영시간 미등록",
    advice: "3위 파워짐보다 AI 노출 격차 35 차이입니다.",
    adviceSub: "운영시간·PT 정보 소개글에 추가 시 네이버 AI탭 노출 가능성이 높아집니다.",
  },
  {
    region: "노원구 중계동",
    category: "영어학원",
    badge: "순위 위험",
    query: "중계동 초등 영어학원 추천해줘, 잘 가르치는 곳",
    chatgptTemplate:
      "중계동에서 초등학생에게 좋은 영어학원을 추천해드릴게요.\n\n{0}은 체계적인 레벨 관리로 유명하고, {1}은 원어민 교사 수업이 강점입니다. {2}은 오랜 역사와 검증된 커리큘럼이 특징입니다.",
    naverActiveCategory: false,
    competitors: [
      { name: "YBM 중계캠퍼스",  score: 83, rank: 1, me: false, ai: { naver: false, chatgpt: true,  google: true  } },
      { name: "청담러닝 중계점", score: 77, rank: 2, me: false, ai: { naver: false, chatgpt: true,  google: false } },
      { name: "폴리어학원",      score: 69, rank: 3, me: false, ai: { naver: false, chatgpt: false, google: false } },
      { name: "내 영어학원",     score: 37, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 부족 · 수강 후기 8건 · 학년별 커리큘럼 없음",
    advice: "3위보다 AI 노출 격차 32 차이입니다.",
    adviceSub: "학년별 커리큘럼 소개글에 추가 시 네이버 AI탭 노출 가능성이 높아집니다. ChatGPT·Google AI는 구글 비즈니스 프로필 등록이 핵심입니다.",
  },
];

const INDUSTRY_AVG_SCORE = 51;

// ────────────────────────────────────────────────
// renderHighlighted: {0},{1},{2} → <mark> 강조
// dangerouslySetInnerHTML 절대 사용 안 함
// ────────────────────────────────────────────────
function renderHighlighted(template: string, names: string[]): React.ReactNode[] {
  const parts = template.split(/(\{[0-9]\})/g);
  return parts.map((part, idx) => {
    const match = part.match(/^\{([0-9])\}$/);
    if (match) {
      const nameIdx = parseInt(match[1], 10);
      const name = names[nameIdx] ?? part;
      return (
        <mark
          key={idx}
          className="bg-yellow-100 text-yellow-900 rounded px-0.5 font-semibold not-italic"
        >
          {name}
        </mark>
      );
    }
    // 줄바꿈 처리
    return part.split("\n").map((line, lineIdx, arr) => (
      <React.Fragment key={`${idx}-${lineIdx}`}>
        {line}
        {lineIdx < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

// ────────────────────────────────────────────────
// AIPlatformDots — 네이버(PRIMARY) + ChatGPT/Google(SECONDARY)
// ────────────────────────────────────────────────
function AIPlatformDots({ ai }: { ai: AICoverage }) {
  return (
    <span
      className="flex items-center gap-[3px] shrink-0"
      aria-label={`네이버${ai.naver ? "노출" : "미노출"} ChatGPT${ai.chatgpt ? "노출" : "미노출"} Google${ai.google ? "노출" : "미노출"}`}
    >
      {/* 네이버 — PRIMARY: 크고 눈에 띄게 */}
      <span className={`w-3 h-3 rounded-full border ${ai.naver ? "bg-emerald-500 border-emerald-600" : "bg-gray-200 border-gray-300"}`} />
      {/* ChatGPT — SECONDARY */}
      <span className={`w-2 h-2 rounded-full ${ai.chatgpt ? "bg-orange-400" : "bg-gray-200"}`} />
      {/* Google — SECONDARY */}
      <span className={`w-2 h-2 rounded-full ${ai.google ? "bg-blue-400" : "bg-gray-200"}`} />
    </span>
  );
}

// ────────────────────────────────────────────────
// CompetitorRow
// ────────────────────────────────────────────────
function CompetitorRow({ item, nextRankScore }: { item: Competitor; nextRankScore?: number }) {
  const exposureGap = nextRankScore !== undefined ? nextRankScore - item.score : 0;
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${
      item.me ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-100"
    }`}>
      <span className={`text-sm font-bold w-4 text-center shrink-0 ${item.me ? "text-red-500" : "text-gray-400"}`}>
        {item.rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${item.me ? "text-red-700" : "text-gray-700"}`}>
          {item.name}
          {item.me && <span className="ml-1 text-xs text-red-400 font-normal">(내 가게)</span>}
        </p>
        {item.me && exposureGap > 0 && (
          <p className="text-sm text-gray-500 leading-tight">{item.rank - 1}위까지 {exposureGap} 차이</p>
        )}
        <div className="relative w-full mt-1 pb-5">
          <div className="relative w-full bg-gray-200 rounded-full h-1.5">
            <div
              aria-hidden
              className="absolute top-[-2px] bottom-[-2px] w-px bg-gray-500 opacity-60"
              style={{ left: `${INDUSTRY_AVG_SCORE}%` }}
            />
            <div
              className={`h-1.5 rounded-full ${item.me ? "bg-red-400" : "bg-blue-500"}`}
              style={{ width: `${item.score}%` }}
            />
          </div>
          <span
            aria-hidden
            className="absolute text-xs leading-none text-gray-400 whitespace-nowrap"
            style={{ left: `${INDUSTRY_AVG_SCORE}%`, transform: "translateX(-50%)", top: "9px" }}
          >
            평균
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <p className={`text-sm font-bold leading-tight ${item.me ? "text-red-600" : "text-blue-600"}`}>
          {item.score}
        </p>
        <AIPlatformDots ai={item.ai} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Tab 0: AIResponsePanel
// ────────────────────────────────────────────────
function AIResponsePanel({ sample }: { sample: SampleData }) {
  const nonMe = sample.competitors.filter((c) => !c.me);
  const myComp = sample.competitors.find((c) => c.me)!;
  const naverMentioned = nonMe.filter((c) => c.ai.naver).slice(0, 2);

  return (
    <div className="space-y-3">
      {/* 질문 버블 */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 bg-blue-400 rounded-full inline-block" />
          사용자가 AI에게 물어봅니다
          <span className="ml-auto normal-case font-normal text-gray-400">(예시)</span>
        </p>
        <div className="inline-block bg-blue-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-bl-sm font-medium max-w-[90%]">
          &ldquo;{sample.query}&rdquo;
        </div>
      </div>

      {/* 네이버 AI 브리핑 — PRIMARY: naverActiveCategory true이고 naverMentioned 있을 때만 */}
      {sample.naverActiveCategory && naverMentioned.length > 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 bg-[#03c75a] text-white text-sm font-black rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              N
            </span>
            <div>
              <span className="text-sm font-bold text-emerald-800">네이버 AI 브리핑</span>
              <span className="ml-2 text-xs bg-emerald-200 text-emerald-800 font-semibold px-1.5 py-0.5 rounded-full">핵심 채널</span>
            </div>
            <span className="text-xs text-gray-400 ml-auto">(예시)</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {naverMentioned.map((c, i) => (
              <span key={c.name}>
                {i > 0 && ", "}
                <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5 font-semibold not-italic">
                  {c.name}
                </mark>
              </span>
            ))}
            {" "}이(가) &lsquo;{sample.region.split(" ").slice(-1)[0]} {sample.category} 추천&rsquo; 쿼리에 AI 브리핑으로 노출됨
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-100">
            <span>❌</span>
            <span>{myComp.name}는 AI 브리핑에 미노출</span>
          </div>
        </div>
      )}

      {/* LIKELY 업종 배지 */}
      {!sample.naverActiveCategory && sample.likelyCategory && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <p className="text-xs font-bold text-amber-800">
            ⚡ 네이버 AI탭 2026년 확장 예정 업종
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            현재는 ChatGPT·Gemini·Google AI 노출이 핵심 채널입니다. 네이버 AI탭 베타(전체 확대 진행 중, 네이버 공식) 노출도 추적합니다.
          </p>
        </div>
      )}

      {/* ChatGPT 응답 — SECONDARY */}
      <div className={`bg-gray-50 border rounded-xl p-3.5 ${sample.naverActiveCategory ? "border-gray-200" : "border-gray-200"}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 bg-[#10a37f] text-white text-xs font-bold rounded-md flex items-center justify-center flex-shrink-0" style={{fontSize: "9px"}}>
            GPT
          </span>
          <span className="text-sm font-bold text-gray-700">ChatGPT 답변</span>
          {!sample.naverActiveCategory && (
            <span className="ml-1 text-xs bg-orange-100 text-orange-700 font-semibold px-1.5 py-0.5 rounded-full">핵심 채널</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">50회 질의 기반 (예시)</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {renderHighlighted(sample.chatgptTemplate, nonMe.map((c) => c.name))}
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-100">
          <span>❌</span>
          <span>{myComp.name}는 AI 응답에 포함되지 않음</span>
        </div>
        <p className="text-sm text-gray-400 mt-1.5">
          * ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 검색 결과와 다를 수 있습니다
        </p>
      </div>

      {/* AEOlab 가치 제안 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
        <p className="text-sm font-bold text-blue-800 mb-1">AEOlab이 하는 일</p>
        <p className="text-sm text-blue-700 leading-relaxed">
          {myComp.name}가 위 AI 추천에 포함되도록 — 무엇이 부족한지 진단하고 개선 방향을 찾아드립니다.
        </p>
      </div>

      <Link
        href="/trial"
        className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
      >
        내 가게 AI 추천 현황 무료 진단하기 →
      </Link>
      <p className="text-sm text-gray-400 text-center">가입 불필요 · 신용카드 필요 없음</p>
    </div>
  );
}

// ────────────────────────────────────────────────
// Tab 1: ComparisonPanel
// ────────────────────────────────────────────────
function ComparisonPanel({ sample }: { sample: SampleData }) {
  const me = sample.competitors.find((c) => c.me);
  const first = sample.competitors.find((c) => c.rank === 1);
  const exposureGap = first && me ? first.score - me.score : 0;

  return (
    <div className="space-y-3">
      {/* 범례 — 네이버 PRIMARY 강조 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">AI 추천 현황 비교 <span className="text-gray-400">(예시)</span></p>
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 inline-block" />
            <span className="text-emerald-700 font-bold">네이버</span>
          </span>
          <span className="flex items-center gap-1 opacity-70">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            <span className="text-orange-500">GPT</span>
          </span>
          <span className="flex items-center gap-1 opacity-70">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span className="text-blue-400">구글</span>
          </span>
        </span>
      </div>

      <div className="space-y-1.5">
        {sample.competitors.map((item) => (
          <CompetitorRow
            key={item.name}
            item={item}
            nextRankScore={
              item.me && item.rank > 1
                ? sample.competitors.find((c) => c.rank === item.rank - 1)?.score
                : undefined
            }
          />
        ))}
      </div>

      {/* 갭 칩 */}
      {exposureGap > 0 && (
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-sm font-bold text-red-700">1위와 AI 노출 격차 {exposureGap}</p>
          <p className="text-sm text-red-500 ml-auto">{exposureGap}% 차이</p>
        </div>
      )}

      {/* 조언 박스 */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
        <div className="flex items-start gap-1.5">
          <Lightbulb size={13} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm text-amber-800 font-medium break-keep">{sample.advice}</p>
            <p className="text-sm text-amber-600 mt-0.5 break-keep">{sample.adviceSub}</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-400 leading-relaxed">
        Gemini·ChatGPT 각 50회 (총 100회) 질의 기반 · 업종 평균 {INDUSTRY_AVG_SCORE} (추정) · 2026.05
        <br />
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────
// Tab 2: ScoreExplainPanel
// ────────────────────────────────────────────────
function ScoreExplainPanel({ sample }: { sample: SampleData }) {
  const me = sample.competitors.find((c) => c.me);
  const myScore = me?.score ?? 30;
  const afterScore = 72;

  const exposureItems = [
    { label: "스마트플레이스 완성도", weight: 25, color: "bg-blue-400", desc: "정보 완성도·사진·운영시간" },
    { label: "지역 검색 순위",        weight: 30, color: "bg-emerald-400", desc: "키워드별 노출 순위" },
    { label: "소식·리뷰 활성도",      weight: 25, color: "bg-orange-400", desc: "리뷰 수·답변률·최근 소식" },
    { label: "소개글·키워드",         weight: 20, color: "bg-purple-400", desc: "소개 문구·핵심 키워드" },
  ];

  return (
    <div className="space-y-4">
      {/* 노출 현황 미터 */}
      <div>
        <p className="text-xs font-bold text-gray-500 mb-2">AI 브리핑 노출 현황 분석</p>
        <div
          className="relative h-5 rounded-full overflow-hidden"
          style={{ background: "linear-gradient(to right, #fee2e2, #fef9c3, #d1fae5)" }}
          role="img"
          aria-label={`내 가게 현재 AI 노출 현황 ${myScore}`}
        >
          {/* 내 가게 포인터 (빨간) */}
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${myScore}%`, transform: "translateX(-50%)" }}
          >
            <div className="w-0.5 h-full bg-red-500 opacity-80" />
          </div>
          {/* After 포인터 (초록) */}
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${afterScore}%`, transform: "translateX(-50%)" }}
          >
            <div className="w-0.5 h-full bg-green-600 opacity-80" />
          </div>
        </div>
        {/* Before / After 비교 */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-center">
            <p className="text-sm text-red-500 font-semibold mb-0.5">현재 (Before)</p>
            <p className="text-2xl font-extrabold text-red-600">{myScore}</p>
            <p className="text-sm text-red-400 mt-0.5">AI 미추천 구간</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 text-center">
            <p className="text-sm text-green-600 font-semibold mb-0.5">개선 후 (After)</p>
            <p className="text-2xl font-extrabold text-green-600">{afterScore}+</p>
            <p className="text-sm text-green-500 mt-0.5">AI 추천 시작 구간</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">위 수치는 예시입니다. 실제 진단 결과는 내 가게에 따라 다릅니다.</p>
      </div>

      {/* 4가지 노출 요소 */}
      <div>
        <p className="text-sm font-bold text-gray-500 mb-2">AI 추천을 결정하는 4가지 요소</p>
        <div className="space-y-2">
          {exposureItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
              <span className="text-sm text-gray-700 flex-1">{item.label}</span>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{item.weight}%</span>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/how-it-works"
        className="flex items-center justify-center gap-2 py-2.5 border border-blue-200 text-blue-600 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors"
      >
        전체 동작 원리 보기 →
      </Link>
    </div>
  );
}

// ────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────
interface Props {
  variant: "pc" | "mobile" | "fullwidth" | "compact";
}

export default function HeroSampleCard({ variant }: Props) {
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<CardTab>(0);

  useEffect(() => {
    if (variant !== "pc") return;
    const t = setInterval(() => {
      setIdx((p) => (p + 1) % SAMPLES.length);
      setTab(0);
    }, 6000);
    return () => clearInterval(t);
  }, [variant]);

  const sample = SAMPLES[idx];
  const me = sample.competitors.find((c) => c.me);
  const first = sample.competitors.find((c) => c.rank === 1);
  const scoreGap = first && me ? first.score - me.score : 0;

  // ── PC variant: 3탭 카드 ──
  if (variant === "pc") {
    return (
      <div className="hidden lg:block">
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-full">
          {/* 카드 상단 예시 배지 */}
          <div className="flex items-center justify-between px-5 pt-3 pb-0">
            <span className="text-xs font-semibold text-gray-600">
              {sample.region} &middot; {sample.category}
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full border border-gray-200">예시 데이터</span>
          </div>
          {/* 3탭 헤더 */}
          <div className="flex border-b border-gray-100 mt-2">
            {(
              [
                { icon: "💬", label: "AI 추천 응답", sub: "실제 답변 확인" },
                { icon: "📊", label: "경쟁사 비교", sub: "노출 현황" },
                { icon: "🎯", label: "노출 기준", sub: "4가지 요소" },
              ] as const
            ).map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTab(i as CardTab)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 px-2 text-xs font-bold border-b-2 transition-all ${
                  tab === i
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="text-base">{t.icon}</span>
                <span>{t.label}</span>
                <span className={`text-xs font-normal ${tab === i ? "text-blue-400" : "text-gray-300"}`}>{t.sub}</span>
              </button>
            ))}
          </div>

          {/* 패널 */}
          <div className="p-5 min-h-[340px]">
            {tab === 0 && <AIResponsePanel sample={sample} />}
            {tab === 1 && <ComparisonPanel sample={sample} />}
            {tab === 2 && <ScoreExplainPanel sample={sample} />}
          </div>

          {/* 업종 탭 네비게이터 */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-t border-gray-100 overflow-x-auto">
            <span className="text-xs text-gray-400 shrink-0 mr-1">업종 예시:</span>
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setIdx(i); setTab(0); }}
                aria-label={s.category}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all shrink-0 ${
                  i === idx
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {s.category}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── compact: 랜딩 티저용 — 점수+핵심발견+CTA만 ──
  if (variant === "compact") {
    const compactGap = first && me ? first.score - me.score : 0;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 w-full max-w-2xl mx-auto" style={{ boxShadow: "0 2px 4px -1px rgba(0,0,0,0.04),0 8px 16px -4px rgba(0,100,255,0.08)" }}>
        {/* 업종 선택 탭 */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="text-xs text-gray-400 self-center mr-0.5">업종 예시:</span>
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                i === idx
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {s.category}
            </button>
          ))}
        </div>

        {/* 점수 + 지역 */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-gray-500">
              {sample.region} · {sample.category}{" "}
              <span className="text-gray-400">(예시)</span>
            </p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">우리 동네 AI 노출 현황</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-black text-red-500 leading-none">{me?.score ?? 28}</p>
            <p className="text-xs text-gray-400">/ 100점</p>
          </div>
        </div>

        {/* 진행바 */}
        <div className="relative w-full bg-gray-100 rounded-full h-2 mb-3">
          <div className="h-2 rounded-full bg-red-400 transition-all" style={{ width: `${me?.score ?? 28}%` }} />
          <div className="absolute top-0 bottom-0 w-px bg-gray-500 opacity-40" style={{ left: `${INDUSTRY_AVG_SCORE}%` }} />
          <span className="absolute text-xs text-gray-400 leading-none" style={{ left: `${INDUSTRY_AVG_SCORE}%`, transform: "translateX(-50%)", top: "10px" }}>
            평균
          </span>
        </div>

        {/* 핵심 발견 2개 */}
        <div className="space-y-1.5 mb-4 mt-5">
          {compactGap > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <span className="shrink-0">⚠</span>
              <span>경쟁사 1위 대비 <strong>{compactGap}점</strong> 뒤처짐</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
            <span className="shrink-0">✦</span>
            <span>{sample.myWeakness.split(" · ")[0]}</span>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/trial"
          className="block text-center py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
        >
          내 가게 무료 진단하기 →
        </Link>
        <p className="text-center mt-2">
          <Link href="/demo" className="text-xs text-blue-500 hover:underline hover:text-blue-600">
            전체 데모 보기 →
          </Link>
        </p>
        <p className="text-sm text-gray-400 text-center mt-1.5">
          위 수치는 예시입니다. 실제 결과는 가게마다 다릅니다.
        </p>
      </div>
    );
  }

  // ── mobile / fullwidth: 기존 단일 컬럼 구조 유지 ──
  const industryTabs = (
    <div className="mb-2.5">
      <p className="text-sm text-gray-400 mb-1.5">업종별 예시 보기</p>
      <div className="flex flex-wrap gap-1.5">
        {SAMPLES.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${
              idx === i
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {s.category}
          </button>
        ))}
      </div>
    </div>
  );

  const cardContent = (
    <>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 break-keep">
            {sample.region} · AI 추천 현황 <span className="text-gray-400">(예시)</span>
          </p>
          <p className="text-sm font-bold text-gray-900">우리 동네 경쟁 현황</p>
        </div>
        <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-1 rounded-full border border-red-100 shrink-0">
          {sample.badge}
        </span>
      </div>

      {/* 범례 — 네이버 PRIMARY 강조 */}
      <div className="flex items-center justify-end gap-2 text-xs font-semibold mb-1.5">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 inline-block" />
          <span className="text-emerald-700 font-bold">네이버</span>
        </span>
        <span className="flex items-center gap-1 opacity-70">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          <span className="text-orange-500">GPT</span>
        </span>
        <span className="flex items-center gap-1 opacity-70">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          <span className="text-blue-400">구글</span>
        </span>
      </div>
      <div className="space-y-1.5 mb-2">
        {sample.competitors.map((item) => (
          <CompetitorRow
            key={item.name}
            item={item}
            nextRankScore={
              item.me && item.rank > 1
                ? sample.competitors.find((c) => c.rank === item.rank - 1)?.score
                : undefined
            }
          />
        ))}
      </div>

      {scoreGap > 0 && (
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
          <p className="text-sm font-bold text-red-700">1위와 AI 노출 격차 {scoreGap}</p>
          <p className="text-sm text-red-500 ml-auto">{scoreGap}% 차이</p>
        </div>
      )}

      {me && (
        <div className="bg-red-50/60 border border-red-100 rounded-xl px-3 py-2 mb-2">
          <div className="flex items-center gap-1 mb-0.5">
            <AlertCircle size={13} className="text-red-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-red-500 font-semibold">내 가게 진단</p>
          </div>
          <p className="text-sm text-red-700 font-medium break-keep">{sample.myWeakness}</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2.5">
        <div className="flex items-start gap-1.5">
          <Lightbulb size={13} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm text-amber-800 font-medium break-keep">{sample.advice}</p>
            <p className="text-sm text-amber-600 mt-0.5">{sample.adviceSub}</p>
          </div>
        </div>
      </div>

      <Link
        href="/trial"
        className="block text-center py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        우리 동네 AI 추천 현황 확인하기 →
      </Link>
      <p className="text-sm text-gray-500 mt-1.5 text-center">
        업종 평균 {INDUSTRY_AVG_SCORE} (추정) · Full 스캔 기준 · 2026.05 (예시)
      </p>
      <p className="text-sm text-gray-500 mt-0.5 text-center leading-relaxed">
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>
    </>
  );

  if (variant === "fullwidth") {
    return (
      <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-full max-w-2xl mx-auto">
        {/* 카드 상단 예시 배지 */}
        <div className="flex items-center justify-between px-5 pt-3 pb-0">
          <span className="text-xs font-semibold text-gray-600">
            {sample.region} &middot; {sample.category}
          </span>
          <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full border border-gray-200">예시 데이터</span>
        </div>
        {/* 3탭 헤더 */}
        <div className="flex border-b border-gray-100 mt-2">
          {(
            [
              { icon: "💬", label: "AI 추천 응답", sub: "실제 답변 확인" },
              { icon: "📊", label: "경쟁사 비교", sub: "노출 현황" },
              { icon: "🎯", label: "노출 기준", sub: "4가지 요소" },
            ] as const
          ).map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setTab(i as CardTab)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 px-2 text-xs font-bold border-b-2 transition-all ${
                tab === i
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
              <span className={`text-xs font-normal ${tab === i ? "text-blue-400" : "text-gray-300"}`}>{t.sub}</span>
            </button>
          ))}
        </div>
        {/* 패널 */}
        <div className="p-5 min-h-[340px]">
          {tab === 0 && <AIResponsePanel sample={sample} />}
          {tab === 1 && <ComparisonPanel sample={sample} />}
          {tab === 2 && <ScoreExplainPanel sample={sample} />}
        </div>
        {/* 업종 탭 네비게이터 */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-t border-gray-100 overflow-x-auto">
          <span className="text-xs text-gray-400 shrink-0 mr-1">업종 예시:</span>
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setIdx(i); setTab(0); }}
              aria-label={s.category}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all shrink-0 ${
                i === idx
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {s.category}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // mobile
  return (
    <div className="lg:hidden bg-white rounded-xl p-4 border border-gray-100 shadow-md mt-4">
      {industryTabs}
      {cardContent}
    </div>
  );
}
