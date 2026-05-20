"use client";

/**
 * HelpSearchInput — FAQ 검색 드롭다운 컴포넌트
 * /api/faq/search?q= 엔드포인트 호출 (백엔드 작업 7에서 구현 예정)
 * 사이트 헤더 통합은 별도 세션에서 진행
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

interface FaqResult {
  id: number;
  question: string;
  answer: string;
  category: string;
}

interface Props {
  placeholder?: string;
  maxResults?: number;
  className?: string;
}

export default function HelpSearchInput({
  placeholder = "도움말 검색...",
  maxResults = 10,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FaqResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setOpen(false);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({ q: trimmed, limit: String(maxResults) });
        const res = await fetch(`${BACKEND}/api/faq/search?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items: FaqResult[] = data.items ?? [];
        setResults(items);
        setOpen(items.length > 0);
        setActiveIndex(-1);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [maxResults]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      // 선택된 항목 — 향후 FAQ 상세 페이지 링크 연결
      setOpen(false);
    }
  }

  const CATEGORY_LABELS: Record<string, string> = {
    general: "서비스 이용",
    pricing: "요금제",
    scan: "스캔",
    guide: "개선 가이드",
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* 입력창 */}
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          aria-label="FAQ 검색"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
        />
        {loading && (
          <div className="absolute right-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="검색어 지우기"
          >
            <X className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          </button>
        )}
      </div>

      {/* 드롭다운 결과 */}
      {open && results.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto"
        >
          {results.map((item, idx) => (
            <button
              key={item.id}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => setOpen(false)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors ${
                idx === activeIndex
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {item.question}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed">
                {item.answer}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
