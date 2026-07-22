"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SidebarSearchBox({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Mac 감지 — 서버(window 없음)와 클라이언트가 동일하게 false로 시작하고
  // 마운트 후 정확한 값으로 갱신. typeof window 직접 사용 시 SSR/클라이언트
  // 하이드레이션 불일치가 발생해 React가 서브트리를 강제 재조정함.
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac/i.test(navigator.platform));
  }, []);

  // Ctrl+K / Cmd+K 단축키로 포커스
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="mx-3 mb-3 relative flex items-center">
      <Search
        className="absolute left-2.5 w-4 h-4 text-gray-500 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="메뉴 검색"
        className="w-full pl-8 pr-10 py-2 text-[14px] rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-colors"
        aria-label="사이드바 메뉴 검색"
      />
      {/* 데스크톱 단축키 힌트 — lg+ 에서만 표시 */}
      {!value && (
        <span
          className="hidden lg:flex absolute right-2.5 items-center text-sm text-gray-500 font-mono bg-gray-100 rounded px-1 py-0.5 pointer-events-none select-none"
          aria-hidden="true"
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </span>
      )}
    </div>
  );
}
