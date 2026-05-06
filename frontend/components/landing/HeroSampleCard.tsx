"use client";

import { useState, useEffect } from "react";
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
  competitors: Competitor[];
  myWeakness: string;
  advice: string;
  adviceSub: string;
}

const SAMPLES: SampleData[] = [
  {
    region: "강남구 역삼동",
    category: "카페",
    badge: "AI 미노출",
    competitors: [
      { name: "블루보틀 강남점", score: 82, rank: 1, me: false, ai: { naver: true,  chatgpt: true,  google: true  } },
      { name: "커피빈 역삼점",   score: 73, rank: 2, me: false, ai: { naver: true,  chatgpt: true,  google: false } },
      { name: "테라로사 역삼점", score: 64, rank: 3, me: false, ai: { naver: true,  chatgpt: false, google: false } },
      { name: "내 카페",         score: 28, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 Q&A 0건 · 방문자리뷰 14건 · 대표사진 3장",
    advice: "3위 테라로사보다 36점 낮습니다.",
    adviceSub: "소개글 Q&A 2개만 추가하면 네이버 AI가 내 카페를 찾기 시작합니다.",
  },
  {
    region: "마포구 연남동",
    category: "한식당",
    badge: "순위 위험",
    competitors: [
      { name: "연남동 백반집", score: 78, rank: 1, me: false, ai: { naver: true,  chatgpt: true,  google: true  } },
      { name: "할매손칼국수", score: 69, rank: 2, me: false, ai: { naver: true,  chatgpt: true,  google: false } },
      { name: "연남식당",     score: 61, rank: 3, me: false, ai: { naver: true,  chatgpt: false, google: false } },
      { name: "내 식당",      score: 33, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 Q&A 1건 · 방문자리뷰 28건 · 단체예약 정보 없음",
    advice: "3위보다 28점 낮습니다.",
    adviceSub: "소개글에 '단체예약·주차 가능' 추가 시 ChatGPT 언급이 시작됩니다.",
  },
  {
    region: "서초구 방배동",
    category: "미용실",
    badge: "AI 미노출",
    competitors: [
      { name: "준오헤어 방배점", score: 84, rank: 1, me: false, ai: { naver: true,  chatgpt: true,  google: true  } },
      { name: "이철헤어 방배점", score: 76, rank: 2, me: false, ai: { naver: true,  chatgpt: true,  google: false } },
      { name: "박준뷰티랩",      score: 68, rank: 3, me: false, ai: { naver: true,  chatgpt: false, google: false } },
      { name: "내 헤어샵",       score: 31, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 Q&A 0건 · 리뷰 답변률 12% · 시술 카테고리 1개",
    advice: "3위 박준뷰티랩보다 37점 낮습니다.",
    adviceSub: "소개글 Q&A 2개 추가 시 네이버 AI 브리핑 인용 후보가 됩니다.",
  },
  {
    region: "성남시 분당구",
    category: "피부과",
    badge: "순위 위험",
    competitors: [
      { name: "연세닥터스 피부과", score: 81, rank: 1, me: false, ai: { naver: false, chatgpt: true,  google: true  } },
      { name: "프리미어 피부과",   score: 74, rank: 2, me: false, ai: { naver: false, chatgpt: true,  google: false } },
      { name: "서울 피부과",       score: 66, rank: 3, me: false, ai: { naver: false, chatgpt: false, google: false } },
      { name: "내 피부과",         score: 42, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 Q&A 2건 · 진료 시간 미등록 · 영수증리뷰 0건",
    advice: "3위보다 24점 낮습니다.",
    adviceSub: "소개글 Q&A 5개 추가 시 ChatGPT·Google AI 노출 가능성이 높아집니다.",
  },
  {
    region: "송파구 잠실동",
    category: "헬스장",
    badge: "AI 미노출",
    competitors: [
      { name: "스포애니 잠실점", score: 79, rank: 1, me: false, ai: { naver: false, chatgpt: true,  google: true  } },
      { name: "바디프로필 짐",   score: 72, rank: 2, me: false, ai: { naver: false, chatgpt: true,  google: false } },
      { name: "파워짐 잠실",     score: 61, rank: 3, me: false, ai: { naver: false, chatgpt: false, google: false } },
      { name: "내 헬스장",       score: 26, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 Q&A 0건 · PT 정보 없음 · 운영시간 미등록",
    advice: "3위 파워짐보다 35점 낮습니다.",
    adviceSub: "운영시간·PT·주차 소개글 Q&A 3개 추가 시 ChatGPT·Gemini AI 노출 가능성이 높아집니다.",
  },
  {
    region: "노원구 중계동",
    category: "영어학원",
    badge: "순위 위험",
    competitors: [
      { name: "YBM 중계캠퍼스",  score: 83, rank: 1, me: false, ai: { naver: false, chatgpt: true,  google: true  } },
      { name: "청담러닝 중계점", score: 77, rank: 2, me: false, ai: { naver: false, chatgpt: true,  google: false } },
      { name: "폴리어학원",      score: 69, rank: 3, me: false, ai: { naver: false, chatgpt: false, google: false } },
      { name: "내 영어학원",     score: 37, rank: 4, me: true,  ai: { naver: false, chatgpt: false, google: false } },
    ],
    myWeakness: "소개글 Q&A 1건 · 수강 후기 8건 · 학년별 커리큘럼 없음",
    advice: "3위보다 32점 낮습니다.",
    adviceSub: "커리큘럼 소개글 Q&A 5개 추가 시 ChatGPT·Google AI 노출 가능성이 높아집니다.",
  },
];

const INDUSTRY_AVG_SCORE = 51;

function AIPlatformDots({ ai }: { ai: AICoverage }) {
  return (
    <span
      className="flex items-center gap-[3px] shrink-0"
      aria-label={`네이버${ai.naver ? "노출" : "미노출"} ChatGPT${ai.chatgpt ? "노출" : "미노출"} Google${ai.google ? "노출" : "미노출"}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${ai.naver   ? "bg-emerald-500" : "bg-gray-200"}`} />
      <span className={`w-2.5 h-2.5 rounded-full ${ai.chatgpt ? "bg-orange-400"  : "bg-gray-200"}`} />
      <span className={`w-2.5 h-2.5 rounded-full ${ai.google  ? "bg-blue-400"    : "bg-gray-200"}`} />
    </span>
  );
}

function CompetitorRow({ item, nextRankScore }: { item: Competitor; nextRankScore?: number }) {
  const scoreGap = nextRankScore !== undefined ? nextRankScore - item.score : 0;
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${
      item.me ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-100"
    }`}>
      <span className={`text-base font-bold w-4 text-center shrink-0 ${item.me ? "text-red-500" : "text-gray-400"}`}>
        {item.rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-base font-semibold truncate ${item.me ? "text-red-700" : "text-gray-700"}`}>
          {item.name}
          {item.me && <span className="ml-1 text-xs text-red-400 font-normal">(내 가게)</span>}
        </p>
        {item.me && scoreGap > 0 && (
          <p className="text-sm text-gray-500 leading-tight">+{scoreGap}점 → {item.rank - 1}위 진입 가능</p>
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
        <p className={`text-base font-bold leading-tight ${item.me ? "text-red-600" : "text-blue-600"}`}>
          {item.score}
        </p>
        <AIPlatformDots ai={item.ai} />
      </div>
    </div>
  );
}

interface Props {
  variant: "pc" | "mobile" | "fullwidth";
}

export default function HeroSampleCard({ variant }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (variant !== "pc") return;
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % SAMPLES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [variant]);

  const sample = SAMPLES[idx];
  const me = sample.competitors.find((c) => c.me);
  const first = sample.competitors.find((c) => c.rank === 1);
  const scoreGap = first && me ? first.score - me.score : 0;

  // PC variant: 자동 순환 도트 + 2컬럼 레이아웃
  if (variant === "pc") {
    return (
      <div className="hidden lg:block">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full">
          {/* 진행 도트 + 현재 업종·지역 */}
          <div className="flex items-center gap-1.5 mb-3">
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`p-1 rounded-full transition-all duration-300 ${
                  idx === i ? "w-7 h-4" : "w-4 h-4"
                }`}
                aria-label={s.category}
              >
                <span className={`block rounded-full transition-all duration-300 ${
                  idx === i ? "w-5 h-2 bg-blue-500" : "w-2 h-2 bg-gray-200 hover:bg-gray-300"
                }`} />
              </button>
            ))}
            <span className="text-xs text-gray-500 ml-1">
              {sample.category} · {sample.region}
            </span>
          </div>

          {/* 2컬럼 본문 */}
          <div className="grid grid-cols-[1fr_190px] gap-4 items-start">
            {/* 좌: 경쟁 순위 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500">AI 노출 순위 (실제 스캔 샘플)</p>
                <span className="flex items-center gap-1 text-xs font-semibold pr-0.5">
                  <span className="text-emerald-600">네이버</span>
                  <span className="text-orange-400">GPT</span>
                  <span className="text-blue-400">구글</span>
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
              <div className="mt-2 space-y-0.5">
                {me && me.score < INDUSTRY_AVG_SCORE && (
                  <p className="text-sm text-red-400">
                    내 가게 {me.score}점 — 업종 평균보다 {INDUSTRY_AVG_SCORE - me.score}점 낮음
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  Gemini·ChatGPT 각 100회 질의 (Full 스캔 기준) · 평균 {INDUSTRY_AVG_SCORE}점
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
                  측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
                </p>
              </div>
            </div>

            {/* 우: 진단·조언 */}
            <div className="flex flex-col gap-2">
              <span className="inline-flex self-start text-xs bg-red-50 text-red-600 font-semibold px-2.5 py-1 rounded-full border border-red-100">
                {sample.badge}
              </span>

              {/* 갭 + 진단 통합 */}
              {scoreGap > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
                  <p className="text-base font-bold text-red-700 mb-1.5">1위와 {scoreGap}점 차이</p>
                  <p className="text-sm text-red-600 break-keep leading-relaxed">{sample.myWeakness}</p>
                </div>
              )}

              {/* 조언 */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                <p className="text-sm font-semibold text-amber-700 mb-1.5 flex items-center gap-1">
                  <Lightbulb size={13} aria-hidden="true" />개선 방법
                </p>
                <p className="text-sm text-amber-800 break-keep leading-relaxed">{sample.adviceSub}</p>
              </div>

              <Link
                href="/trial"
                className="block text-center py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors mt-1"
              >
                내 가게 순위 확인하기 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // mobile / fullwidth: 기존 단일 컬럼 구조 유지 (탭, CTA 버튼, 모든 박스 유지)
  const industryTabs = (
    <div className="flex flex-wrap gap-1.5 mb-2.5">
      {SAMPLES.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setIdx(i)}
          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
            idx === i
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
          }`}
        >
          {s.category}
        </button>
      ))}
    </div>
  );

  const cardContent = (
    <>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 break-keep">
            {sample.region} · AI 노출 순위 (실제 스캔 샘플)
          </p>
          <p className="text-sm font-bold text-gray-900">우리 동네 경쟁 현황</p>
        </div>
        <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-1 rounded-full border border-red-100 shrink-0">
          {sample.badge}
        </span>
      </div>

      <div className="flex items-center justify-end gap-1.5 text-xs font-semibold mb-1.5">
        <span className="text-emerald-600">네이버</span>
        <span className="text-orange-400">GPT</span>
        <span className="text-blue-400">구글</span>
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
          <p className="text-sm font-bold text-red-700">1위와 {scoreGap}점 차이</p>
          <p className="text-sm text-red-500 ml-auto">AI 노출 {scoreGap}% 격차</p>
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
        우리 동네 실제 순위 확인하기 →
      </Link>
      <p className="text-xs text-gray-500 mt-1.5 text-center">
        업종 평균 {INDUSTRY_AVG_SCORE}점 (추정) · Full 스캔 기준 · 2026.04
      </p>
      <p className="text-xs text-gray-500 mt-0.5 text-center leading-relaxed">
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>
    </>
  );

  if (variant === "fullwidth") {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 md:p-6 w-full max-w-2xl mx-auto mt-2">
        {industryTabs}
        {cardContent}
      </div>
    );
  }

  // mobile
  return (
    <div className="lg:hidden bg-white rounded-2xl p-4 border border-gray-100 shadow-md mt-4">
      {industryTabs}
      {cardContent}
    </div>
  );
}
