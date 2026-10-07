"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Search, Trophy, ArrowRight, Info, BarChart2, Loader2, ChevronDown } from "lucide-react";
import { FLAT_CATEGORY_GROUPS, FLAT_CATEGORY_MAP } from "@/lib/categories";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// ── 지역 목록 ─────────────────────────────────────────────────────────
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

// ── score_band 색상 ───────────────────────────────────────────────────
function scoreBandStyle(band: string): string {
  if (band === "상위 10%")
    return "bg-yellow-50 text-yellow-700 border border-yellow-200";
  if (band === "상위 30%")
    return "bg-blue-50 text-blue-700 border border-blue-200";
  if (band === "상위 50%")
    return "bg-green-50 text-green-700 border border-green-200";
  if (band === "상위 70%")
    return "bg-gray-50 text-gray-600 border border-gray-200";
  return "bg-gray-100 text-gray-600 border border-gray-200";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-yellow-400 text-white font-bold text-sm shrink-0">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-400 text-white font-bold text-sm shrink-0">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-amber-700 text-white font-bold text-sm shrink-0">
        3
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm shrink-0">
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
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="md:grid md:grid-cols-[300px_1fr] md:gap-6 md:items-start">

        {/* ─── 왼쪽: 조회 폼 (PC에서 sticky) ─── */}
        <div className="md:sticky md:top-24 mb-6 md:mb-0">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4 break-keep">
              업종과 지역을 선택하면<br className="hidden sm:block" /> 익명 랭킹을 확인할 수 있습니다.
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
                  className="w-full appearance-none border border-gray-300 rounded-xl px-4 py-3 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              </div>
            </div>

            {/* 지역 입력 */}
            <div className="mb-5">
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
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {showRegionSuggestions && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {REGION_SUGGESTIONS.map((group) => (
                      <div key={group.group}>
                        <div className="px-3 py-1.5 text-sm font-semibold text-gray-600 bg-gray-50 sticky top-0">
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
              <p className="text-sm text-gray-500 mt-1.5">
                시·구·동 또는 지역명+동네 이름 입력 (예: 서울 홍대, 대전 유성)
              </p>
            </div>

            <button
              type="button"
              onClick={handleSearch}
              disabled={!selectedCategory || !region.trim() || loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500 text-white font-semibold text-sm py-3 rounded-xl transition-colors min-h-[48px]"
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
        </div>

        {/* ─── 오른쪽: 결과 ─── */}
        <div>
          {/* 에러 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* 로딩 상태 */}
          {loading && (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-600">데이터를 불러오는 중입니다...</p>
            </div>
          )}

          {/* 결과 */}
          {result && !loading && (
            <div className="space-y-4">
              {/* 결과 헤더 */}
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base md:text-lg font-bold text-gray-900 break-keep">
                  {FLAT_CATEGORY_MAP[result.category]?.label ?? result.category}
                  <span className="text-gray-500 font-normal mx-1.5">·</span>
                  {result.region}
                </h2>
                {!result.insufficient_data && result.entries.length > 0 && (
                  <span className="text-sm text-gray-500 shrink-0">
                    상위 {result.entries.length}곳
                  </span>
                )}
              </div>

              {/* 데이터 부족 */}
              {result.insufficient_data ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-12 text-center shadow-sm">
                  <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-base font-semibold text-gray-700 mb-2">데이터 수집 중</p>
                  <p className="text-sm text-gray-600 break-keep">
                    {result.message ??
                      "아직 이 지역·업종의 사업장 데이터가 충분히 모이지 않았습니다. 더 모이면 공개됩니다."}
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
                  <p className="text-sm text-gray-600">아직 공개된 랭킹 데이터가 없습니다.</p>
                </div>
              ) : (
                /* 랭킹 카드 리스트 */
                <div className="space-y-2">
                  {/* 상위 3개 강조 카드 */}
                  {result.entries.slice(0, 3).map((entry) => (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-4 bg-white border rounded-2xl px-5 py-4 shadow-sm ${
                        entry.rank === 1 ? "border-yellow-200" : "border-gray-200"
                      }`}
                    >
                      <RankBadge rank={entry.rank} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.rank <= 3 && (
                            <Trophy
                              className={`w-4 h-4 shrink-0 ${
                                entry.rank === 1
                                  ? "text-yellow-400"
                                  : entry.rank === 2
                                  ? "text-gray-400"
                                  : "text-amber-700"
                              }`}
                            />
                          )}
                          <span className="text-base font-semibold text-gray-900">
                            {entry.rank}위 사업장
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          AI 검색 노출 수준이 가장 높은 익명 사업장입니다.
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-sm font-semibold px-3 py-1 rounded-full ${scoreBandStyle(entry.score_band)}`}
                      >
                        {entry.score_band}
                      </span>
                    </div>
                  ))}

                  {/* 4위 이하 — 더 간결한 카드 */}
                  {result.entries.length > 3 && (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                      {result.entries.slice(3).map((entry, i) => (
                        <div
                          key={entry.rank}
                          className={`flex items-center gap-3 px-5 py-3.5 ${
                            i < result.entries.length - 4 ? "border-b border-gray-50" : ""
                          }`}
                        >
                          <RankBadge rank={entry.rank} />
                          <span className="flex-1 text-sm text-gray-700">
                            {entry.rank}위 사업장
                          </span>
                          <span
                            className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${scoreBandStyle(entry.score_band)}`}
                          >
                            {entry.score_band}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 백분위 설명 */}
              {!result.insufficient_data && result.entries.length > 0 && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 md:p-4">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm md:text-sm text-gray-700 leading-relaxed break-keep">
                    <strong className="font-semibold">상위 몇 %</strong>인지는 같은 업종·지역에서 내 위치를 나타냅니다.
                    예를 들어 &lsquo;상위 10%&rsquo;는 100명 중 10등 안에 들 만큼 AI 노출이 잘 되는 사업장입니다.
                    측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다. 사업장명·식별 정보는 포함되지 않습니다.
                  </p>
                </div>
              )}

              {/* 면책 */}
              {!result.insufficient_data && result.entries.length > 0 && (
                <p className="text-sm text-gray-400 leading-relaxed break-keep">
                  이 랭킹은 AEOlab 측정 시점 익명 집계 데이터입니다.
                </p>
              )}

              {/* 하단 CTA */}
              <div className="bg-blue-600 rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-base font-bold text-white mb-1 break-keep">
                    {categoryLabel ? `${categoryLabel} 업종` : "우리 업종"}에서 내 순위는?
                  </p>
                  <p className="text-sm text-blue-100">
                    무료 체험으로 AI 검색 노출을 진단하세요.
                  </p>
                </div>
                <Link
                  href="/trial"
                  className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold text-sm px-5 py-3 rounded-xl hover:bg-blue-50 transition-colors shrink-0 min-h-[48px] justify-center"
                >
                  무료로 진단하기 <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* 초기 상태 */}
          {!result && !loading && !error && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 md:p-10 text-center shadow-sm">
              <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-base text-gray-700 font-semibold mb-1">업종·지역을 선택 후 조회하세요</p>
              <p className="text-sm text-gray-500 break-keep">
                가게 이름과 점수는 공개되지 않으며, 순위와 상위 몇 %인지만 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
