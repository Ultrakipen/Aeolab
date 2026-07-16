"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Search, Trophy, ArrowRight, Info, BarChart2, Loader2, ChevronDown } from "lucide-react";
import { FLAT_CATEGORY_GROUPS, FLAT_CATEGORY_MAP } from "@/lib/categories";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ── 지역 목록 (시·구·동 단위) ─────────────────────────────────────────
const REGION_SUGGESTIONS: { group: string; items: string[] }[] = [
  {
    group: "서울",
    items: [
      "서울 강남", "서울 강서", "서울 마포", "서울 홍대",
      "서울 신촌", "서울 이태원", "서울 종로", "서울 성수",
      "서울 잠실", "서울 건대", "서울 노원", "서울 강동",
    ],
  },
  {
    group: "경기·인천",
    items: [
      "수원 팔달", "수원 영통", "성남 분당", "성남 판교",
      "고양 일산", "용인 수지", "부천 중동",
      "인천 부평", "인천 송도", "인천 구월",
    ],
  },
  {
    group: "부산·경남",
    items: [
      "부산 해운대", "부산 서면", "부산 남포동", "부산 광안리",
      "창원 성산", "김해 내외", "진주 상대",
    ],
  },
  {
    group: "대구·경북",
    items: ["대구 중구", "대구 수성구", "대구 달서구", "구미 선산", "포항 북구"],
  },
  {
    group: "광주·전라",
    items: ["광주 상무지구", "광주 충장로", "전주 덕진", "익산 중앙"],
  },
  {
    group: "대전·충청",
    items: ["대전 둔산", "대전 유성", "청주 상당", "천안 쌍용"],
  },
  {
    group: "기타",
    items: ["울산 남구", "제주 제주시", "제주 서귀포", "강릉 교동"],
  },
];

// ── 타입 ──────────────────────────────────────────────────────────────
interface RankingEntry {
  rank: number;
  score_band: string;
  category: string;
  region: string;
}

interface RankingResponse {
  category: string;
  region: string;
  insufficient_data: boolean;
  total_in_region?: number;
  message?: string;
  entries: RankingEntry[];
}

// ── score_band 색상 & 뱃지 스타일 ────────────────────────────────────
function scoreBandStyle(band: string): string {
  // 백엔드 _score_band()가 실제 반환하는 값: 상위 10%/30%/50%/70%, 하위 30%
  if (band === "상위 10%")
    return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  if (band === "상위 30%")
    return "bg-blue-50 text-blue-700 border border-blue-200";
  if (band === "상위 50%")
    return "bg-green-50 text-green-700 border border-green-200";
  if (band === "상위 70%")
    return "bg-gray-50 text-gray-600 border border-gray-200";
  return "bg-gray-100 text-gray-500 border border-gray-200";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-white font-bold text-sm shrink-0">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-white font-bold text-sm shrink-0">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600 text-white font-bold text-sm shrink-0">
        3
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm shrink-0">
      {rank}
    </span>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export default function RankingClient() {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [region, setRegion] = useState("");
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RankingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const regionRef = useRef<HTMLInputElement>(null);

  const categoryLabel =
    selectedCategory ? (FLAT_CATEGORY_MAP[selectedCategory]?.label ?? selectedCategory) : "";

  async function handleSearch() {
    if (!selectedCategory || !region.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const encodedCategory = encodeURIComponent(selectedCategory.trim());
      const encodedRegion = encodeURIComponent(region.trim());
      const res = await fetch(
        `${BACKEND_URL}/api/report/ranking-public/${encodedCategory}/${encodedRegion}`
      );
      if (!res.ok) {
        if (res.status === 404) {
          setError("해당 업종·지역 데이터를 찾을 수 없습니다.");
        } else if (res.status === 429) {
          setError("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
        } else {
          setError("조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        }
        return;
      }
      const data: RankingResponse = await res.json();
      setResult(data);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function selectRegion(r: string) {
    setRegion(r);
    setShowRegionSuggestions(false);
    regionRef.current?.focus();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">

      {/* ─── 조회 폼 ─── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-8 shadow-sm mb-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-5">
          업종과 지역을 선택하면 익명 랭킹을 확인할 수 있습니다.
        </h2>

        {/* 업종 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="category-select">
            업종
          </label>
          <div className="relative">
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none border border-gray-300 rounded-xl px-4 py-3 pr-10 text-sm md:text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">업종을 선택하세요</option>
              {FLAT_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.groupLabel} label={group.groupLabel}>
                  {group.items.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* 지역 입력 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="region-input">
            지역
          </label>
          <div className="relative">
            <input
              id="region-input"
              ref={regionRef}
              type="text"
              value={region}
              placeholder="예: 서울 강남, 부산 해운대"
              onChange={(e) => {
                setRegion(e.target.value);
                setShowRegionSuggestions(e.target.value.length === 0);
              }}
              onFocus={() => setShowRegionSuggestions(region.length === 0)}
              onBlur={() => setTimeout(() => setShowRegionSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowRegionSuggestions(false);
                  handleSearch();
                }
              }}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm md:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* 지역 추천 드롭다운 */}
            {showRegionSuggestions && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {REGION_SUGGESTIONS.map((group) => (
                  <div key={group.group}>
                    <div className="px-3 py-1.5 text-sm font-semibold text-gray-400 bg-gray-50 sticky top-0">
                      {group.group}
                    </div>
                    {group.items.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onMouseDown={() => selectRegion(r)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            시·구·동 단위로 입력하세요 (입력칸 클릭 시 주요 지역 목록 표시)
          </p>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          disabled={!selectedCategory || !region.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm md:text-base py-3 rounded-xl transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              조회 중...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              랭킹 조회하기
            </>
          )}
        </button>
      </div>

      {/* ─── 에러 메시지 ─── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ─── 결과 영역 ─── */}
      {result && (
        <div className="space-y-4">
          {/* 결과 헤더 */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base md:text-lg font-bold text-gray-900">
              {FLAT_CATEGORY_MAP[result.category]?.label ?? result.category}
              <span className="text-gray-400 font-normal mx-1.5">·</span>
              {result.region}
            </h2>
            {!result.insufficient_data && result.total_in_region != null && (
              <span className="text-sm text-gray-500 shrink-0">
                총 {result.total_in_region}개 사업장
              </span>
            )}
          </div>

          {/* 데이터 부족 */}
          {result.insufficient_data ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-12 text-center shadow-sm">
              <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-4" />
              <p className="text-base font-semibold text-gray-700 mb-2">데이터 수집 중</p>
              <p className="text-sm text-gray-500 break-keep">
                {result.message ??
                  "데이터 수집 중입니다. 해당 지역·업종의 사업장이 더 모이면 공개됩니다."}
              </p>
              <Link
                href="/trial"
                className="inline-flex items-center gap-1.5 mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                내 가게 먼저 분석하기 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : result.entries.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
              <p className="text-sm text-gray-500">아직 공개된 랭킹 데이터가 없습니다.</p>
            </div>
          ) : (
            /* 랭킹 리스트 */
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-500 w-16">순위</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-500">AI 노출 수준</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-500 hidden sm:table-cell">
                        업종 내 백분위
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.entries.map((entry) => (
                      <tr key={entry.rank} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <RankBadge rank={entry.rank} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {entry.rank <= 3 && (
                              <Trophy
                                className={`w-4 h-4 shrink-0 ${
                                  entry.rank === 1
                                    ? "text-yellow-400"
                                    : entry.rank === 2
                                    ? "text-gray-400"
                                    : "text-amber-600"
                                }`}
                              />
                            )}
                            <span className="text-sm md:text-base text-gray-700 font-medium">
                              {entry.rank}위 사업장
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                          <span
                            className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${scoreBandStyle(
                              entry.score_band
                            )}`}
                          >
                            {entry.score_band}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 모바일 — score_band 별도 표시 */}
              <div className="sm:hidden border-t border-gray-100 px-4 py-3 flex flex-wrap gap-2">
                {result.entries.map((entry) => (
                  <div key={entry.rank} className="flex items-center gap-1.5 text-sm">
                    <span className="text-gray-500">{entry.rank}위</span>
                    <span className={`px-2 py-0.5 rounded-full text-sm font-semibold ${scoreBandStyle(entry.score_band)}`}>
                      {entry.score_band}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 면책 문구 */}
          {!result.insufficient_data && result.entries.length > 0 && (
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 md:p-4">
              <Info className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
                이 랭킹은 AEOlab 스캔 시점의 익명 집계 데이터이며, 측정 시점·기기·로그인 상태에 따라
                달라질 수 있습니다. 사업장명·식별 정보는 포함되지 않습니다.
              </p>
            </div>
          )}

          {/* 하단 CTA */}
          <div className="bg-blue-600 rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-base font-bold text-white mb-1">
                {categoryLabel ? `${categoryLabel} 업종` : "우리 업종"}에서 내 순위는?
              </p>
              <p className="text-sm text-blue-100">
                무료 체험으로 AI 검색 노출을 진단하고 개선 방법을 확인하세요.
              </p>
            </div>
            <Link
              href="/trial"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold text-sm px-5 py-3 rounded-xl hover:bg-blue-50 transition-colors shrink-0"
            >
              무료로 진단하기 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ─── 초기 상태 안내 ─── */}
      {!result && !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 md:p-8 text-center">
          <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm md:text-base text-gray-500">
            업종과 지역을 선택한 후 조회 버튼을 눌러주세요.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            사업장명·점수 원본은 공개되지 않으며, 순위와 백분위만 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
