"use client";

import { useState } from "react";

interface ShowcaseItem {
  desktopFile: string;
  desktopWidth: number;
  desktopHeight: number;
  mobileFile: string;
  mobileWidth: number;
  mobileHeight: number;
  title: string;
  desc: string;
  howTo?: string;
}

const ITEMS: ShowcaseItem[] = [
  {
    desktopFile: "01_dashboard.png",
    desktopWidth: 1440,
    desktopHeight: 17944,
    mobileFile: "01_dashboard_mobile.png",
    mobileWidth: 390,
    mobileHeight: 27223,
    title: "대시보드",
    desc: "네이버·ChatGPT·Gemini·Google 노출 현황, 오늘 바로 할 일, 검색 순위를 한눈에 볼 수 있습니다.",
    howTo:
      "가장 먼저 보이는 화면입니다. 상단에 오늘 가장 중요한 개선 항목이 하나 표시됩니다. 아래로 내리면 AI별 노출 상황과 경쟁사 현황을 확인할 수 있습니다.",
  },
  {
    desktopFile: "02_competitors.png",
    desktopWidth: 1440,
    desktopHeight: 5074,
    mobileFile: "02_competitors_mobile.png",
    mobileWidth: 390,
    mobileHeight: 2396,
    title: "경쟁사 관리",
    desc: "주변 경쟁 가게와 AI 노출·리뷰·소개글 완성도를 항목별로 비교합니다.",
    howTo:
      "경쟁 가게를 직접 추가하거나 추천 목록에서 선택할 수 있습니다. 어떤 항목이 뒤처지는지 한눈에 확인하고, 개선 우선순위를 정하는 데 씁니다.",
  },
  {
    desktopFile: "03_history.png",
    desktopWidth: 1440,
    desktopHeight: 9404,
    mobileFile: "03_history_mobile.png",
    mobileWidth: 390,
    mobileHeight: 8469,
    title: "변화 기록",
    desc: "측정할 때마다 AI 노출 상태가 어떻게 바뀌었는지 시점별로 기록합니다.",
    howTo:
      "스마트플레이스 소개글을 바꾸거나 리뷰가 쌓인 날짜를 기록에 남길 수 있습니다. 어떤 행동을 했을 때 AI 노출이 달라졌는지 확인할 수 있습니다.",
  },
  {
    desktopFile: "04_growth.png",
    desktopWidth: 1440,
    desktopHeight: 3780,
    mobileFile: "04_growth_mobile.png",
    mobileWidth: 390,
    mobileHeight: 4388,
    title: "성장 리포트",
    desc: "AI 노출 변화, 내가 한 행동과 결과, 업종 내 위치를 정리해 보여줍니다.",
    howTo:
      "이번 달 내 가게가 얼마나 개선됐는지, 같은 업종에서 어느 위치인지 확인할 수 있습니다. 다음 달 목표를 세우는 데 참고합니다.",
  },
  {
    desktopFile: "05_guide.png",
    desktopWidth: 1440,
    desktopHeight: 6075,
    mobileFile: "05_guide_mobile.png",
    mobileWidth: 390,
    mobileHeight: 8608,
    title: "개선 가이드",
    desc: "지금 바로 실행 가능한 개선 방법을 AI가 사업장별로 맞춤 제시합니다.",
    howTo:
      "가이드 생성 버튼을 누르면 내 가게 현황을 분석해 이번 달 집중해야 할 개선 항목 3~5가지를 구체적으로 제시합니다. 체크리스트로 진행 상황을 관리할 수 있습니다.",
  },
  {
    desktopFile: "06_blog_analysis.png",
    desktopWidth: 1440,
    desktopHeight: 8441,
    mobileFile: "06_blog_analysis_mobile.png",
    mobileWidth: 390,
    mobileHeight: 13286,
    title: "블로그 진단",
    desc: "네이버 블로그에 내 가게가 얼마나 자주 언급되는지, 주요 검색어별 글 수를 확인합니다.",
    howTo:
      "블로그 글이 AI 브리핑·AI탭에 소개될 수 있는 중요한 자료입니다. 어떤 검색어로 쓴 블로그 글이 많은지, 어떤 검색어가 부족한지 파악할 수 있습니다.",
  },
  {
    desktopFile: "07_schema.png",
    desktopWidth: 1440,
    desktopHeight: 1405,
    mobileFile: "07_schema_mobile.png",
    mobileWidth: 390,
    mobileHeight: 1786,
    title: "소개글·콘텐츠",
    desc: "스마트플레이스 소개글 초안과, 홈페이지에 붙여넣을 AI가 읽기 쉽게 정리한 코드를 자동 생성합니다.",
    howTo:
      "소개글 초안은 사업장 정보를 입력하면 AI가 네이버 AI 브리핑에 소개되기 좋은 형태로 작성해 줍니다. 자체 홈페이지가 있으면 AI 인식 코드를 붙여넣어 ChatGPT·Gemini가 내 가게 정보를 더 정확히 읽도록 도울 수 있습니다.",
  },
  {
    desktopFile: "08_review_inbox.png",
    desktopWidth: 1440,
    desktopHeight: 900,
    mobileFile: "08_review_inbox_mobile.png",
    mobileWidth: 390,
    mobileHeight: 1007,
    title: "리뷰 답변",
    desc: "손님 리뷰를 붙여넣으면 업종 검색어를 포함한 답변 초안을 만들어 줍니다.",
    howTo:
      "리뷰 답변에 업종·지역 관련 검색어를 자연스럽게 포함하면 네이버 검색 노출에 도움이 될 수 있습니다. 초안을 수정해 바로 네이버에 등록할 수 있습니다.",
  },
];

export function ShowcaseTabs() {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);

  function handleSetActive(i: number) {
    setActive(i);
    setExpanded(false);
  }

  const item = ITEMS[active];
  // 이미지 표시 높이 상한 (스크롤 없이 탭 전체가 보이도록)
  const PREVIEW_HEIGHT = 640;

  return (
    <div className="flex flex-col md:flex-row md:gap-6 md:items-start">
      {/* ─── 왼쪽: 탭 목록 (PC에서 세로 목록) ─── */}
      <nav
        aria-label="화면 선택"
        className="md:w-44 md:shrink-0 mb-4 md:mb-0 md:sticky md:top-24"
      >
        {/* 모바일: 가로 스크롤 칩 */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:hidden" tabIndex={0}>
          {ITEMS.map((t, i) => (
            <button
              key={t.desktopFile}
              onClick={() => handleSetActive(i)}
              aria-current={active === i ? "true" : undefined}
              className={`shrink-0 text-sm font-semibold px-3.5 py-2 rounded-xl border-2 transition-colors whitespace-nowrap min-h-[44px] ${
                active === i
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>

        {/* PC: 세로 목록 */}
        <ul className="hidden md:flex flex-col gap-1">
          {ITEMS.map((t, i) => (
            <li key={t.desktopFile}>
              <button
                onClick={() => handleSetActive(i)}
                aria-current={active === i ? "true" : undefined}
                className={`w-full text-left text-sm font-semibold px-4 py-3 rounded-xl border-2 transition-colors min-h-[48px] ${
                  active === i
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ─── 오른쪽: 선택된 화면 ─── */}
      <section className="flex-1 min-w-0">
        <div className="mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">{item.title}</h2>
          <p className="text-sm md:text-base text-gray-600 mt-1 break-keep">{item.desc}</p>

          {item.howTo && (
            <details className="mt-3 group border border-gray-200 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 cursor-pointer list-none [&::-webkit-details-marker]:hidden min-h-[44px]">
                <span className="text-sm font-semibold text-gray-700">어떻게 쓰나요?</span>
                <span className="text-sm text-gray-500" aria-hidden="true">
                  <span className="group-open:hidden">＋</span>
                  <span className="hidden group-open:inline">－</span>
                </span>
              </summary>
              <div className="px-4 py-3 bg-white border-t border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed break-keep">{item.howTo}</p>
              </div>
            </details>
          )}
        </div>

        {/* 모바일 이미지 */}
        <div className="md:hidden">
          <div
            className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden relative ${
              !expanded ? `max-h-[${PREVIEW_HEIGHT}px]` : ""
            }`}
            style={!expanded ? { maxHeight: `${PREVIEW_HEIGHT}px` } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/showcase/${item.mobileFile}?v=20261008`}
              width={item.mobileWidth}
              height={item.mobileHeight}
              alt={`AEOlab ${item.title} 모바일 화면`}
              className="block w-full h-auto"
              loading="lazy"
            />
            {/* 그라데이션 페이드 — 이미지가 잘릴 때만 표시 */}
            {!expanded && item.mobileHeight > PREVIEW_HEIGHT && (
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/90 to-transparent pointer-events-none" />
            )}
          </div>
          {item.mobileHeight > PREVIEW_HEIGHT && (
            <div className="text-center mt-2 flex items-center justify-center gap-4">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                {expanded ? "접기 ↑" : "전체 화면 보기 ↓"}
              </button>
              <a
                href={`/showcase/${item.mobileFile}?v=20261008`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-gray-500 hover:underline"
              >
                새 창에서 보기 ↗
              </a>
            </div>
          )}
        </div>

        {/* 데스크톱 이미지 */}
        <div className="hidden md:block">
          <div
            className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden relative"
            style={!expanded ? { maxHeight: `${PREVIEW_HEIGHT}px` } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/showcase/${item.desktopFile}?v=20261008`}
              width={item.desktopWidth}
              height={item.desktopHeight}
              alt={`AEOlab ${item.title} 화면`}
              className="block w-full h-auto"
              loading="lazy"
            />
            {!expanded && item.desktopHeight > PREVIEW_HEIGHT && (
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/90 to-transparent pointer-events-none" />
            )}
          </div>
          {item.desktopHeight > PREVIEW_HEIGHT && (
            <div className="text-center mt-2 flex items-center justify-center gap-4">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                {expanded ? "접기 ↑" : "전체 화면 보기 ↓"}
              </button>
              <a
                href={`/showcase/${item.desktopFile}?v=20261008`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-gray-500 hover:underline"
              >
                새 창에서 보기 ↗
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
