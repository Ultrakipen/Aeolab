"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { searchBusiness } from "@/lib/api";
import type { BusinessSearchResult } from "@/types";

export function mapKakaoCategory(kakaoCategory: string): string {
  const cat = kakaoCategory.toLowerCase();
  if (cat.includes("음식") || cat.includes("한식") || cat.includes("양식") || cat.includes("일식") || cat.includes("중식") || cat.includes("분식")) return "restaurant";
  if (cat.includes("카페") || cat.includes("커피") || cat.includes("디저트")) return "cafe";
  if (cat.includes("치킨") || cat.includes("닭")) return "chicken";
  if (cat.includes("고기") || cat.includes("갈비") || cat.includes("삼겹")) return "bbq";
  if (cat.includes("미용") || cat.includes("헤어") || cat.includes("미장")) return "beauty";
  if (cat.includes("네일")) return "nail";
  if (cat.includes("병원") || cat.includes("의원") || cat.includes("클리닉")) return "hospital";
  if (cat.includes("치과")) return "dental";
  if (cat.includes("한의")) return "oriental";
  if (cat.includes("약국")) return "pharmacy";
  if (cat.includes("피부")) return "skincare";
  if (cat.includes("학원") || cat.includes("교습")) return "academy";
  if (cat.includes("영어") || cat.includes("어학")) return "language";
  if (cat.includes("코딩") || cat.includes("컴퓨터")) return "coding";
  if (cat.includes("법") || cat.includes("변호") || cat.includes("법무")) return "law";
  if (cat.includes("세무") || cat.includes("회계")) return "tax";
  if (cat.includes("부동산")) return "realestate";
  if (cat.includes("헬스") || cat.includes("피트니스") || cat.includes("gym")) return "fitness";
  if (cat.includes("요가") || cat.includes("필라테스")) return "yoga";
  if (cat.includes("사진") || cat.includes("스튜디오")) return "photo";
  if (cat.includes("반려") || cat.includes("애견") || cat.includes("펫")) return "pet";
  if (cat.includes("동물병원")) return "vet";
  if (cat.includes("꽃") || cat.includes("플라워")) return "flower";
  if (cat.includes("쇼핑") || cat.includes("마트") || cat.includes("편의점")) return "shop";
  if (cat.includes("숙박") || cat.includes("호텔") || cat.includes("펜션")) return "accommodation";
  return "other";
}

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
    onSelect(result);
  };

  const sourceBadge = (source: BusinessSearchResult["source"]) => {
    if (source === "kakao") return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">카카오</span>
    );
    if (source === "naver") return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">네이버</span>
    );
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">네이버+카카오</span>
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
              ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              : <Search className="w-4 h-4 text-gray-400" />
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
        <p className="text-sm text-gray-400 mt-1.5 ml-1">
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
                    <div className="text-sm text-gray-400 mt-0.5">{r.category}</div>
                  )}
                  {(r.review_count > 0 || r.avg_rating > 0) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.avg_rating > 0 && <span className="text-sm text-amber-600">★ {r.avg_rating.toFixed(1)}</span>}
                      {r.review_count > 0 && <span className="text-sm text-gray-400">리뷰 {r.review_count}개</span>}
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
