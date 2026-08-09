"use client";

import { useState } from "react";

interface ShowcaseItem {
  file: string;
  width: number;
  height: number;
  title: string;
  desc: string;
}

const ITEMS: ShowcaseItem[] = [
  { file: "01_dashboard.png", width: 1440, height: 4914, title: "대시보드", desc: "네이버·글로벌 AI 노출 현황, 오늘 할 일, 키워드 검색 순위를 한눈에 봅니다." },
  { file: "02_competitors.png", width: 1440, height: 5074, title: "경쟁사 관리", desc: "주변 경쟁 가게와 AI 노출·리뷰·소개글 완성도를 항목별로 비교합니다." },
  { file: "03_history.png", width: 1440, height: 9404, title: "변화 기록", desc: "스캔할 때마다 AI 노출 상태가 어떻게 바뀌었는지 시점별로 기록합니다." },
  { file: "04_growth.png", width: 1440, height: 3780, title: "성장 리포트", desc: "AI 노출 점수 변화, 내가 한 행동과 결과, 업종 내 위치를 정리해 보여줍니다." },
  { file: "05_guide.png", width: 1440, height: 4999, title: "개선 가이드", desc: "지금 바로 실행 가능한 개선 방법을 AI가 사업장별로 맞춤 제시합니다." },
  { file: "06_blog_analysis.png", width: 1440, height: 6239, title: "블로그 진단", desc: "블로그가 AI 브리핑에 얼마나 인용되는지, 키워드 커버리지와 포스팅 상세 분석을 제공합니다." },
  { file: "07_schema.png", width: 1440, height: 1405, title: "소개글·콘텐츠", desc: "AI 검색 등록 코드(JSON-LD)와 스마트플레이스 소개글 초안을 자동 생성합니다." },
  { file: "08_review_inbox.png", width: 1440, height: 900, title: "리뷰 답변", desc: "손님 리뷰를 붙여넣으면 업종 키워드를 포함한 답변 초안을 만들어 줍니다." },
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
            key={t.file}
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
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 mb-3">
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900">{item.title}</h2>
            <p className="text-sm md:text-base text-gray-500 mt-1">{item.desc}</p>
          </div>
          <a
            href={`/showcase/${item.file}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-indigo-600 hover:underline shrink-0"
          >
            새 창에서 원본 크기로 보기 ↗
          </a>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-auto max-h-[75vh]">
          {/* 실제 제품과 동일한 글자 크기로 보이도록 축소 없이 원본 픽셀 그대로 표시 — 좌우·상하 스크롤로 탐색 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/showcase/${item.file}`}
            width={item.width}
            height={item.height}
            alt={`AEOlab ${item.title} 실제 화면`}
            className="block max-w-none"
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">실제 제품과 동일한 글자 크기로 표시됩니다 · 좌우·상하로 스크롤해 전체 화면을 확인하세요</p>
      </section>
    </div>
  );
}
