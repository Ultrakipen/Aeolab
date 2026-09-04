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
}

const ITEMS: ShowcaseItem[] = [
  { desktopFile: "01_dashboard.png", desktopWidth: 1440, desktopHeight: 17944, mobileFile: "01_dashboard_mobile.png", mobileWidth: 390, mobileHeight: 27223, title: "대시보드", desc: "네이버·글로벌 AI 노출 현황, 오늘 할 일, 키워드 검색 순위를 한눈에 봅니다." },
  { desktopFile: "02_competitors.png", desktopWidth: 1440, desktopHeight: 5074, mobileFile: "02_competitors_mobile.png", mobileWidth: 390, mobileHeight: 2396, title: "경쟁사 관리", desc: "주변 경쟁 가게와 AI 노출·리뷰·소개글 완성도를 항목별로 비교합니다." },
  { desktopFile: "03_history.png", desktopWidth: 1440, desktopHeight: 9404, mobileFile: "03_history_mobile.png", mobileWidth: 390, mobileHeight: 8469, title: "변화 기록", desc: "스캔할 때마다 AI 노출 상태가 어떻게 바뀌었는지 시점별로 기록합니다." },
  { desktopFile: "04_growth.png", desktopWidth: 1440, desktopHeight: 3780, mobileFile: "04_growth_mobile.png", mobileWidth: 390, mobileHeight: 4388, title: "성장 리포트", desc: "AI 노출 점수 변화, 내가 한 행동과 결과, 업종 내 위치를 정리해 보여줍니다." },
  { desktopFile: "05_guide.png", desktopWidth: 1440, desktopHeight: 6075, mobileFile: "05_guide_mobile.png", mobileWidth: 390, mobileHeight: 8608, title: "개선 가이드", desc: "지금 바로 실행 가능한 개선 방법을 AI가 사업장별로 맞춤 제시합니다." },
  { desktopFile: "06_blog_analysis.png", desktopWidth: 1440, desktopHeight: 8441, mobileFile: "06_blog_analysis_mobile.png", mobileWidth: 390, mobileHeight: 13286, title: "블로그 진단", desc: "블로그가 AI 브리핑에 얼마나 인용되는지, 키워드 커버리지와 포스팅 상세 분석을 제공합니다." },
  { desktopFile: "07_schema.png", desktopWidth: 1440, desktopHeight: 1405, mobileFile: "07_schema_mobile.png", mobileWidth: 390, mobileHeight: 1786, title: "소개글·콘텐츠", desc: "AI 검색 등록 코드(JSON-LD)와 스마트플레이스 소개글 초안을 자동 생성합니다." },
  { desktopFile: "08_review_inbox.png", desktopWidth: 1440, desktopHeight: 900, mobileFile: "08_review_inbox_mobile.png", mobileWidth: 390, mobileHeight: 1007, title: "리뷰 답변", desc: "손님 리뷰를 붙여넣으면 업종 키워드를 포함한 답변 초안을 만들어 줍니다." },
];

export function ShowcaseTabs() {
  const [active, setActive] = useState(0);
  const item = ITEMS[active];

  return (
    <div>
      {/* 탭 바 — 모바일은 가로 스크롤 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {ITEMS.map((t, i) => (
          <button
            key={t.desktopFile}
            onClick={() => setActive(i)}
            className={`shrink-0 text-sm md:text-base font-semibold px-3.5 py-2 rounded-xl border-2 transition-colors whitespace-nowrap ${
              active === i
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>

      {/* 선택된 화면 */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg md:text-xl font-black text-gray-900">{item.title}</h2>
          <p className="text-sm md:text-base text-gray-600 mt-1">{item.desc}</p>
        </div>

        {/* 모바일: 실제 모바일 레이아웃 캡처를 원본 크기로 표시 (모바일 화면 폭과 거의 일치해 스크롤 불필요) */}
        <div className="md:hidden flex justify-center">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/showcase/${item.mobileFile}`}
              width={item.mobileWidth}
              height={item.mobileHeight}
              alt={`AEOlab ${item.title} 모바일 화면`}
              className="block w-full h-auto"
            />
          </div>
        </div>

        {/* 데스크톱: 페이지 폭 제한을 벗어나 뷰포트 전체 폭으로 표시, 별도 박스 스크롤 없이 페이지 자체가 스크롤됨 */}
        <div className="hidden md:block relative left-1/2 right-1/2 -mx-[50vw] w-screen">
          <div className="flex justify-center px-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/showcase/${item.desktopFile}`}
                width={item.desktopWidth}
                height={item.desktopHeight}
                alt={`AEOlab ${item.title} 실제 화면`}
                className="block max-w-none"
              />
            </div>
          </div>
        </div>

        <div className="text-center mt-3">
          <a
            href={`/showcase/${item.desktopFile}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline text-sm font-semibold text-indigo-600 hover:underline"
          >
            새 창에서 원본 크기로 보기 ↗
          </a>
          <a
            href={`/showcase/${item.mobileFile}`}
            target="_blank"
            rel="noopener noreferrer"
            className="md:hidden text-sm font-semibold text-indigo-600 hover:underline"
          >
            새 창에서 원본 크기로 보기 ↗
          </a>
        </div>
      </section>
    </div>
  );
}
