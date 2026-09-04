"use client";

interface NaverCompetitor {
  rank: number;
  name: string;
  address?: string;
}

interface KeywordRank {
  query: string;
  rank: number | null;
  exposed: boolean;
}

interface Props {
  businessName: string;
  searchQuery?: string;
  myRank?: number | null;
  blogCount: number;
  topCompetitorName?: string | null;
  topCompetitorBlogCount?: number;
  naverCompetitors?: NaverCompetitor[];
  blogSearchQuery?: string;
  compBlogSearchQuery?: string;
  keywordRanks?: KeywordRank[];
}

export default function TrialCompetitorGapCard({
  businessName,
  searchQuery,
  myRank,
  blogCount,
  topCompetitorName,
  topCompetitorBlogCount,
  naverCompetitors,
  blogSearchQuery,
  compBlogSearchQuery,
  keywordRanks,
}: Props) {
  if (!naverCompetitors?.length && !topCompetitorName && !keywordRanks?.length) return null;

  // 카테고리 검색어(공백 없고 짧은 것)는 숨기고 속성 키워드만 표시
  const attributeRanks = (keywordRanks || []).filter(
    (r) => r.query.includes(" ") && r.query.split(" ").length >= 2
  );

  // 1500건 초과 시 바 그래프 상한선 적용 (부풀린 수치로 바가 압도되는 것 방지)
  const cappedCompBlog = Math.min(topCompetitorBlogCount ?? 0, 1500);
  const maxBlog = Math.max(blogCount, cappedCompBlog, 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 shadow-sm">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🏆</span>
          <p className="text-sm font-bold text-gray-800">네이버 검색 노출 현황</p>
        </div>
      </div>

      {/* 내 키워드 노출 현황 (속성 키워드별 순위) */}
      {attributeRanks.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">내 입력 키워드 순위</p>
          <div className="space-y-2">
            {attributeRanks.map((kr, i) => {
              // "창원 단체 예약 가능 맛집" → "단체 예약 가능 맛집" (지역명 제거해서 표시)
              const displayQuery = kr.query.split(" ").slice(1).join(" ") || kr.query;
              return (
                <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                  kr.exposed ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-100"
                }`}>
                  <div>
                    <p className="text-sm font-medium text-gray-700">&ldquo;{displayQuery}&rdquo; 검색</p>
                    <p className="text-sm text-gray-600 mt-0.5">네이버 지역 검색</p>
                  </div>
                  {kr.exposed && kr.rank ? (
                    <span className="text-sm font-bold text-green-700 shrink-0 ml-2">{kr.rank}위 노출</span>
                  ) : (
                    <span className="text-sm font-bold text-red-700 shrink-0 ml-2">20위 밖</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 같은 업종 경쟁사 현황 */}
      {naverCompetitors && naverCompetitors.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">같은 업종 경쟁 현황</p>
            {searchQuery && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">&ldquo;{searchQuery}&rdquo; 기준</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2 leading-relaxed">
            업종 전체 기준 경쟁사입니다. 내 가게 특화 키워드 노출은 위 &lsquo;내 입력 키워드 순위&rsquo;를 확인하세요.
          </p>
        </div>
      )}

      {/* 네이버 검색 순위 */}
      {naverCompetitors && naverCompetitors.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {naverCompetitors.slice(0, 5).map((comp) => {
            const isMe = businessName
              ? comp.name.includes(businessName) || businessName.includes(comp.name)
              : comp.rank === myRank;
            return (
              <div
                key={comp.rank}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isMe ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  comp.rank === 1 ? "bg-yellow-300 text-yellow-900"
                  : comp.rank === 2 ? "bg-gray-300 text-gray-700"
                  : comp.rank === 3 ? "bg-orange-200 text-orange-800"
                  : "bg-white text-gray-600 border border-gray-200"
                }`}>
                  {comp.rank}
                </span>
                <span className={`text-sm font-medium flex-1 truncate max-w-[120px] sm:max-w-[200px] ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                  {comp.name}
                  {isMe && <span className="ml-1.5 text-sm bg-blue-600 text-white px-1.5 py-0.5 rounded-full">내 가게</span>}
                </span>
              </div>
            );
          })}
          {!myRank && (
            <p className="text-sm text-red-700 mt-1 px-1">내 가게가 상위 20위 안에 없습니다</p>
          )}
        </div>
      )}

      {/* 블로그 후기 비교 */}
      {topCompetitorName && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
          <p className="text-sm font-bold text-red-700 mb-2">블로그 후기 격차</p>

          {/* 측정 방식 항상 안내 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2">
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong className="text-gray-600">측정 방식</strong> — 네이버 블로그 API에서 &ldquo;지역 + 가게명&rdquo;을 검색한 총 결과 수입니다.
              검색어에 지역명이 포함되어 해당 지역 결과를 우선 수집하며, 가게 후기뿐 아니라 해당 키워드가 포함된 모든 포스트가 합산됩니다.
              경쟁사는 같은 업종(예: 음식점) 기준으로 선택되며 세부 업종은 다를 수 있습니다.
            </p>
          </div>

          {/* 임계값별 경고 */}
          {(topCompetitorBlogCount ?? 0) > 50000 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>측정 불가</strong> — 경쟁사 상호명이 음식 카테고리명과 동일하여 특정 가게 기준으로 측정할 수 없습니다. 정식 스캔에서 더 정확한 비교를 제공합니다.
              </p>
            </div>
          ) : (topCompetitorBlogCount ?? 0) > 1500 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>참고용 추정치</strong> — 1,500건을 초과해 동명 가게·일반 언급 포스트가 합산됐을 가능성이 있습니다.
                정확한 후기 수와 다를 수 있으니 방향성 참고용으로만 활용하세요.
              </p>
            </div>
          ) : null}

          {(topCompetitorBlogCount ?? 0) <= 50000 && (
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="text-blue-700 font-semibold">내 가게</span>
                  <span className="text-blue-700 font-bold">{blogCount}건</span>
                </div>
                <div className="w-full bg-white rounded-full h-2.5">
                  <div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${Math.round((blogCount / maxBlog) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="text-gray-600 font-semibold truncate max-w-[160px]">{topCompetitorName} (1위)</span>
                  <span className="text-gray-700 font-bold shrink-0">
                    {(topCompetitorBlogCount ?? 0) > 1500
                      ? `${(topCompetitorBlogCount ?? 0).toLocaleString()}건 (추정)`
                      : `${(topCompetitorBlogCount ?? 0).toLocaleString()}건`}
                  </span>
                </div>
                <div className="w-full bg-white rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-gray-400"
                    style={{ width: `${Math.round((cappedCompBlog / maxBlog) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="pt-1 space-y-0.5">
                {blogSearchQuery && (
                  <p className="text-sm text-gray-600">내 가게: 블로그 &ldquo;{blogSearchQuery}&rdquo; 검색 결과</p>
                )}
                {compBlogSearchQuery && (
                  <p className="text-sm text-gray-600">경쟁사: 블로그 &ldquo;{compBlogSearchQuery}&rdquo; 검색 결과</p>
                )}
              </div>
            </div>
          )}

          {(topCompetitorBlogCount ?? 0) <= 50000 && (topCompetitorBlogCount ?? 0) > blogCount && (
            <p className="text-sm text-red-700 mt-2">
              {(topCompetitorBlogCount ?? 0) > 1500
                ? <>경쟁사 블로그 언급이 <strong>훨씬 많습니다</strong> — 가게명에 지역·업종 키워드가 포함돼 합산 부풀림 가능성 있음</>
                : <>1위보다 <strong>{(topCompetitorBlogCount ?? 0) - blogCount}건</strong> 적습니다</>}
              {" "}— 리뷰 답변에 키워드를 넣으면 좁힐 수 있습니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}
