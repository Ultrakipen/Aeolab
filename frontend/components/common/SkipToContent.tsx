"use client";

import { usePathname } from "next/navigation";

/**
 * 반복 영역 건너뛰기(WCAG 2.4.1 · KWCAG) — 키보드·스크린리더 사용자가 헤더·사이드바 메뉴를 지나치지 않고 본문(`<main>`)으로 이동한다.
 * 화면에서는 숨겨져 있다가 Tab으로 포커스를 받을 때만 나타난다.
 * 랜딩(`/`)은 자체 건너뛰기 링크(`#main-content`)가 있어 중복을 피하려고 렌더하지 않는다.
 * 페이지마다 main의 id가 달라서(없는 곳도 있음) 클릭 시 문서의 첫 `<main>`으로 포커스를 옮긴다.
 */
export default function SkipToContent() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <a
      href="#main-content"
      onClick={(e) => {
        const main = document.querySelector("main");
        if (!main) return;
        e.preventDefault();
        main.setAttribute("tabindex", "-1");
        main.style.outline = "none";
        main.focus();
        main.scrollIntoView({ block: "start" });
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-white focus:text-blue-700 focus:font-bold focus:text-sm focus:shadow-lg focus:ring-2 focus:ring-blue-600"
    >
      본문 바로가기
    </a>
  );
}
