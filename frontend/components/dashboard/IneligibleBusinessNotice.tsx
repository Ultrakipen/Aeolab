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
    const label = isFranchise ? "프랜차이즈 가맹점" : `${categoryLabel} 업종`;
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        {/* 메시지 반복 제거 — '네이버 검색·플레이스가 핵심'은 상단 Hero가 유일 소스.
            이 카드는 실행 리스트(①②③④)만 담당해 같은 말 4회→2회로 축소 (점검 기준 #4) */}
        <p className="text-sm md:text-base font-bold text-green-900 mb-2.5 break-keep">
          📍 {label} — 네이버 노출 키우려면 지금 바로 할 것
        </p>
        <ul className="space-y-1 mb-3">
          <li className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-green-600 font-bold shrink-0">①</span>
            <span><strong>스마트플레이스 소개글·사진·소식</strong> 업데이트 → 플레이스탭 상위 노출</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-green-600 font-bold shrink-0">②</span>
            <span><strong>블로그 정기 발행</strong> (주 1~2회) → 네이버 검색 상위 노출 + <strong>'정보형 AI 브리핑'</strong> 인용 후보</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-green-500 font-bold shrink-0">③</span>
            <span><strong>AI탭 콘텐츠 준비</strong> — 자연어 질문형 키워드를 소개글에 포함</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-500">
            <span className="text-gray-400 font-bold shrink-0">④</span>
            <span>ChatGPT·Gemini — Google 비즈니스 프로필 등록 후 장기 준비</span>
          </li>
        </ul>
        <Link
          href="/guide"
          className="inline-block text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
        >
          개선 가이드 보기 →
        </Link>
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
