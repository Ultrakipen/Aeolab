"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 반복 영역 건너뛰기(WCAG 2.4.1 · KWCAG) — 키보드·스크린리더 사용자가 헤더·사이드바 메뉴를 지나치지 않고 본문(`<main>`)으로 이동한다.
 * 화면에서는 숨겨져 있다가 Tab으로 포커스를 받을 때만 나타난다.
 * 랜딩(`/`)은 자체 건너뛰기 링크(`#main-content`)가 있어 중복을 피하려고 렌더하지 않는다.
 *
 * 링크의 대상 요소가 실제로 있어야 보조 도구(axe의 skip-link 규칙 포함)가 올바른 건너뛰기 링크로 인식한다.
 * 대시보드·체험처럼 `<main>`이 마운트 이후에 그려지는 화면이 있어(한 번만 찾으면 못 찾음 — 2026-11-09 라이브 점검에서
 * 첫 수정이 이 화면들에는 효과가 없었음) `<main>`이 나타날 때까지 DOM 변화를 지켜보고, 이미 다른 id가 있으면 그 id를 대상으로 쓴다.
 */
export default function SkipToContent() {
  const pathname = usePathname();
  const [target, setTarget] = useState("main-content");

  useEffect(() => {
    if (pathname === "/") return;
    const apply = () => {
      const main = document.querySelector("main");
      if (!main) return false;
      if (!main.id) main.id = "main-content";
      setTarget(main.id);
      return true;
    };
    if (apply()) return;
    const mo = new MutationObserver(() => {
      if (apply()) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const t = window.setTimeout(() => mo.disconnect(), 15000);
    return () => {
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, [pathname]);

  if (pathname === "/") return null;

  return (
    <a
      href={`#${target}`}
      onClick={(e) => {
        const main = document.querySelector("main");
        if (!main) return;
        e.preventDefault();
        if (!main.id) main.id = "main-content";
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
