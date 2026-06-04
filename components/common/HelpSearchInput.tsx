"use client";

/**
 * HelpSearchInput — FAQ 검색 드롭다운 컴포넌트
 * /api/faq/search?q= 엔드포인트 호출
 *
 * Props:
 *   onQuery         — 검색어 확정 시 호출 (GA4 등)
 *   onResultClick   — 결과 클릭 시 호출 (faqId, category)
 *   onNoResult      — 결과 0건 시 호출
 *   showFallback    — true일 때 결과 없음 → /support 링크 표시 (default: false)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
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
  showFallback?: boolean;
  onQuery?: (q: string) => void;
  onResultClick?: (faqId: number, category: string) => void;
  onNoResult?: (q: string) => void;
}

export default function HelpSearchInput({
  placeholder = "도움말 검색...",
  maxResults = 10,
  className = "",
  showFallback = false,
  onQuery,
  onResultClick,
  onNoResult,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FaqResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false); // 마지막 검색 완료 여부
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
        setSearched(false);
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
        setSearched(true);

        // 결과 있으면 드롭다운 열기
        if (items.length > 0) {
          setOpen(true);
          setActiveIndex(-1);
        } else {
          setOpen(false);
          onNoResult?.(trimmed);
        }

        // 쿼리 이벤트 (결과 유무 관계없이 발화)
        onQuery?.(trimmed);
      } catch {
        setResults([]);
        setSearched(true);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [maxResults, onQuery, onNoResult]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setSearched(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  }

  function handleClear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    setSearched(false);
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
      const item = results[activeIndex];
      if (item) {
        onResultClick?.(item.id, item.category);
      }
      setOpen(false);
    }
  }

  const CATEGORY_LABELS: Record<string, string> = {
    general: "서비스 이용",
    pricing: "요금제",
    scan: "스캔",
    guide: "개선 가이드",
  };

  // 결과 없음 + fallback 노출 조건: 검색 완료 + 빈 결과 + query 있음 + showFallback=true
  const showNoResultFallback =
    showFallback && searched && query.trim().length > 0 && results.length === 0 && !loading;

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
              onClick={() => {
                onResultClick?.(item.id, item.category);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors ${
                idx === activeIndex
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
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

      {/* 결과 없음 fallback */}
      {showNoResultFallback && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 px-4 py-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            찾는 답변이 없으신가요?
          </p>
          <Link
            href="/support"
            className="text-sm font-medium text-blue-600 hover:underline"
            onClick={() => setOpen(false)}
          >
            Q&A 게시판에 문의하기 →
          </Link>
        </div>
      )}
    </div>
  );
}
