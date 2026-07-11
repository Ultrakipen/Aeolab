"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { searchBusiness } from "@/lib/api";
import type { BusinessSearchResult } from "@/types";
import { mapNaverCategory } from "@/lib/categories";

// 하위 호환 — 기존 import { mapKakaoCategory } 사용처가 동작하도록 유지
export { mapNaverCategory as mapKakaoCategory };

interface Props {
  region: string;          // 폼에서 이미 채워진 지역값 (없으면 빈 문자열)
  onSelect: (result: BusinessSearchResult) => void;
}

export default function BusinessSearchDropdown({ region, onSelect }: Props) {
  const [localRegion, setLocalRegion] = useState(region);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 부모 폼에서 region이 바뀌면 로컬 상태도 동기화 (단, 사용자가 직접 수정 중이면 무시)
  useEffect(() => {
    if (region && !localRegion) setLocalRegion(region);
  }, [region]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q: string, r: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(false);
    try {
      const data = await searchBusiness(q.trim(), r.trim());
      setResults(data);
      setOpen(true);
      setSearched(true);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerSearch = (q: string, r: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q, r), 500);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    triggerSearch(val, localRegion);
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalRegion(val);
    if (query.trim().length >= 2) triggerSearch(query, val);
  };

  const handleSelect = (result: BusinessSearchResult) => {
    setQuery(result.name);
    setOpen(false);
    // localRegion을 결과에 포함해 전달 — 온보딩 폼의 region 자동 채움
    onSelect({ ...result, region: result.region || localRegion });
  };

  const sourceBadge = (source: BusinessSearchResult["source"]) => {
    if (source === "kakao") return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-sm font-medium bg-yellow-100 text-yellow-800">카카오</span>
    );
    if (source === "naver") return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-sm font-medium bg-green-100 text-green-800">네이버</span>
    );
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-sm font-medium bg-blue-100 text-blue-800">네이버+카카오</span>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 두 칸 검색: 지역 + 가게 이름 */}
      <div className="flex gap-2">
        {/* 지역 입력 */}
        <input
          type="text"
          value={localRegion}
          onChange={handleRegionChange}
          placeholder="지역"
          className="w-28 md:w-32 shrink-0 border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {/* 가게 이름 검색 */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {loading
              ? <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
              : <Search className="w-4 h-4 text-gray-500" />
            }
          </div>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            placeholder="가게 이름 검색"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* 검색 힌트 */}
      {!localRegion && !query && (
        <p className="text-sm text-gray-500 mt-1.5 ml-1">
          지역을 먼저 입력하면 더 정확하게 검색됩니다.
        </p>
      )}

      {/* 드롭다운 결과 */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {results.length > 0 ? (
              results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-base font-semibold text-gray-900">{r.name}</span>
                    {sourceBadge(r.source)}
                  </div>
                  <div className="text-sm text-gray-500">{r.address}</div>
                  {r.category && (
                    <div className="text-sm text-gray-500 mt-0.5">{r.category}</div>
                  )}
                  {(r.review_count > 0 || r.avg_rating > 0) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.avg_rating > 0 && <span className="text-sm text-amber-600">★ {r.avg_rating.toFixed(1)}</span>}
                      {r.review_count > 0 && <span className="text-sm text-gray-500">리뷰 {r.review_count}개</span>}
                    </div>
                  )}
                </button>
              ))
            ) : searched && (
              <div className="px-4 py-4 text-sm text-gray-500 text-center">
                검색 결과가 없습니다. 아래에 직접 입력하세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
