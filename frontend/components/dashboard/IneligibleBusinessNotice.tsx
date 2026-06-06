"use client";

import Link from "next/link";

interface Props {
  category: string;
  categoryLabel: string;
  eligibility: "active" | "likely" | "inactive";
  isFranchise?: boolean;
}

export function IneligibleBusinessNotice({ categoryLabel, eligibility, isFranchise = false }: Props) {
  if (eligibility === "active") return null;

  const isInactive = eligibility === "inactive";

  if (isInactive || isFranchise) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-5">
        <p className="text-sm font-bold text-blue-800 mb-3">
          {isFranchise ? "프랜차이즈 가맹점" : `${categoryLabel} 업종`} — 지금 바로 할 것
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 bg-white rounded-lg px-3 py-2.5 border border-blue-100">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">네이버 스마트플레이스 완성도 높이기</p>
              <p className="text-sm text-gray-600 mt-0.5">소개글·사진·소식 등록 → 네이버 검색 상위노출 핵심</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-white rounded-lg px-3 py-2.5 border border-blue-100">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">네이버 AI탭 대비 콘텐츠 준비</p>
              <p className="text-sm text-gray-600 mt-0.5">자연어 질문형 키워드를 소개글에 포함하면 AI탭 노출 가능성 상승</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 bg-white rounded-lg px-3 py-2.5 border border-gray-200">
            <span className="w-5 h-5 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-700">ChatGPT·Gemini·Google AI — 장기 준비</p>
              <p className="text-sm text-gray-500 mt-0.5">Google 비즈니스 프로필 등록 후 수 주~수개월 소요. 지금부터 콘텐츠 축적</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href="/guide"
            className="flex-1 text-center text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors"
          >
            개선 가이드 보기 →
          </Link>
          <Link
            href="/guide/chatgpt-search"
            className="flex-1 text-center text-sm font-medium text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
          >
            글로벌 AI 가이드
          </Link>
        </div>
        <p className="mt-3 text-xs text-gray-400 leading-relaxed">
          {isFranchise
            ? "네이버 AI 브리핑은 프랜차이즈 가맹점을 현재 지원하지 않습니다(출처: 네이버 스마트플레이스 공식 안내)."
            : `${categoryLabel} 업종은 네이버 AI 브리핑 대상이 아닙니다. 네이버 검색 노출과 AI탭이 핵심 경로입니다.`}
        </p>
      </div>
    );
  }

  /* likely 업종 */
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 md:p-5">
      <p className="text-sm font-bold text-indigo-800 mb-2">
        {categoryLabel} 업종 — AI 브리핑 확대 예정 · 지금 준비하세요
      </p>
      <div className="space-y-1.5 text-sm text-gray-700">
        <p>✅ 네이버 AI탭 — 모든 업종 대상 대화형 검색 지원</p>
        <p>✅ 네이버 블로그·일반 검색 — 지금도 최적화 가능</p>
        <p>🔮 AI 브리핑 — 업종 확대 시 즉시 자동 활성화</p>
        <p>🎯 ChatGPT·Gemini·Google AI — 글로벌 채널 데이터 축적 중</p>
      </div>
      <Link
        href={`/guide/ai-tab`}
        className="mt-3 inline-block text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
      >
        AI탭 가이드 열기 →
      </Link>
    </div>
  );
}
