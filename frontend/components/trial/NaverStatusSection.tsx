"use client";

import { CheckCircle2, XCircle, AlertTriangle, MapPin, Image as ImageIcon, Star, BookOpen } from "lucide-react";

export interface NaverCompetitor {
  rank: number;
  name: string;
  address?: string;
}

export interface NaverStatusSectionProps {
  businessName: string;
  searchQuery?: string;
  myRank?: number | null;
  isSmartPlace: boolean;
  naverCompetitors?: NaverCompetitor[];
  hasIntro: boolean;
  hasRecentPost: boolean;
  hasFaq: boolean;
  photoCount?: number;
  visitorReviewCount?: number;
  avgRating?: number;
  briefingCategory: "active" | "likely" | "inactive";
  inBriefing: boolean | null;
  blogCount: number;
  topCompetitorName?: string | null;
  topCompetitorBlogCount?: number;
}

function CheckRow({
  label,
  ok,
  okNote,
  failNote,
  value,
}: {
  label: string;
  ok: boolean;
  okNote?: string;
  failNote: string;
  value?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="shrink-0 mt-0.5">
        {ok ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{label}</span>
          {value && (
            <span className="text-sm text-slate-500">{value}</span>
          )}
        </div>
        {!ok && (
          <p className="text-sm text-slate-500 mt-0.5 leading-snug break-keep">{failNote}</p>
        )}
        {ok && okNote && (
          <p className="text-sm text-green-700 mt-0.5 leading-snug break-keep">{okNote}</p>
        )}
      </div>
    </div>
  );
}

export default function NaverStatusSection({
  businessName,
  searchQuery,
  myRank,
  isSmartPlace,
  naverCompetitors,
  hasIntro,
  hasRecentPost,
  hasFaq,
  photoCount,
  visitorReviewCount,
  avgRating,
  briefingCategory,
  inBriefing,
  blogCount,
  topCompetitorName,
  topCompetitorBlogCount,
}: NaverStatusSectionProps) {
  const topFive = (naverCompetitors ?? []).slice(0, 5);
  const myRankNum = myRank ?? null;
  const inTop5 = myRankNum !== null && myRankNum <= 5;
  const inTop20 = myRankNum !== null && myRankNum <= 20;

  // 블록 A: 순위 안내 문구
  function rankExplanation() {
    if (!isSmartPlace) {
      return "스마트플레이스에 등록하지 않으면 네이버 지역 검색에 나타나지 않습니다.";
    }
    if (!inTop20) {
      return "이 키워드 검색 상위 20위에 없습니다 — 소개글·소식·리뷰를 보강하면 순위가 올라갑니다.";
    }
    if (!inTop5) {
      return "소개글·소식·리뷰가 부족하면 순위가 밀립니다.";
    }
    return null;
  }

  const explanation = rankExplanation();

  // 블로그 막대 너비 계산
  const compBlogCount = topCompetitorBlogCount ?? 0;
  const maxBlog = Math.max(blogCount, compBlogCount, 1);
  const myBarPct = Math.round((blogCount / maxBlog) * 100);
  const compBarPct = Math.round((compBlogCount / maxBlog) * 100);

  return (
    <div className="space-y-3 mb-4">

      {/* ── 블록 A: 네이버 검색 위치 ─────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-sm font-bold text-slate-500 tracking-wide uppercase">
            네이버 지역검색 위치
          </p>
          {searchQuery && (
            <p className="text-base font-bold text-slate-800 mt-0.5">
              &quot;{searchQuery}&quot; 검색 결과
            </p>
          )}
        </div>

        <div className="px-4 pt-3 pb-2">
          {topFive.length > 0 ? (
            <ol className="space-y-1.5">
              {topFive.map((comp) => {
                const isMe = comp.rank === myRankNum ||
                  comp.name === businessName ||
                  (myRankNum !== null && comp.rank === myRankNum);
                return (
                  <li
                    key={comp.rank}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      isMe
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-slate-50"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black ${
                        isMe
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {comp.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? "text-blue-800" : "text-slate-700"}`}>
                        {comp.name}
                        {isMe && (
                          <span className="ml-2 text-xs font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                            내 가게
                          </span>
                        )}
                      </p>
                      {comp.address && (
                        <p className="text-sm text-slate-400 truncate mt-0.5">{comp.address}</p>
                      )}
                    </div>
                  </li>
                );
              })}
              {/* 내 가게가 5위 밖이지만 20위 내인 경우 */}
              {myRankNum !== null && myRankNum > 5 && myRankNum <= 20 && (
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 bg-amber-50 border border-amber-200">
                  <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black bg-amber-400 text-white">
                    {myRankNum}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">
                      {businessName}
                      <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                        내 가게 ({myRankNum}위)
                      </span>
                    </p>
                  </div>
                </li>
              )}
              {/* 20위 밖 */}
              {!inTop20 && isSmartPlace && (
                <li className="flex items-center gap-3 rounded-lg px-3 py-2 bg-red-50 border border-red-200">
                  <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black bg-red-400 text-white">
                    ?
                  </span>
                  <p className="text-sm font-semibold text-red-700">
                    {businessName} — 상위 20위 밖
                  </p>
                </li>
              )}
            </ol>
          ) : !isSmartPlace ? (
            <div className="flex items-center gap-3 rounded-lg px-3 py-3 bg-red-50 border border-red-200">
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm font-semibold text-red-700">
                {businessName} — 검색 결과에 없음 (스마트플레이스 미등록)
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg px-3 py-3 bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-sm font-semibold text-amber-700">
                검색 결과 상위 20위 밖입니다
              </p>
            </div>
          )}

          {explanation && (
            <div className="mt-3 flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600 leading-snug break-keep">{explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 블록 B: 스마트플레이스 현황 체크리스트 ──────────── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-sm font-bold text-slate-500 tracking-wide uppercase">
            스마트플레이스 페이지 완성도
          </p>
        </div>
        <div className="px-4 py-1 divide-y divide-slate-100">
          <CheckRow
            label="스마트플레이스 등록"
            ok={isSmartPlace}
            okNote="네이버 지역 검색에 표시됩니다"
            failNote="등록하면 지역 검색에 표시됩니다 — naver.me/smartplace에서 무료 등록"
          />
          <CheckRow
            label="소개글"
            ok={hasIntro}
            okNote="AI가 인용할 텍스트가 있습니다"
            failNote="AI 브리핑이 인용할 텍스트가 없습니다 — 가게 특징·키워드를 200자 이상 작성하세요"
          />
          <CheckRow
            label="최근 소식"
            ok={hasRecentPost}
            okNote="신선도 점수가 높아집니다"
            failNote="소식이 없으면 신선도 점수가 낮아집니다 — 월 1회 이상 소식을 게시하세요"
          />
          {photoCount !== undefined && (
            <CheckRow
              label="사진"
              ok={photoCount >= 30}
              value={`${photoCount}장`}
              okNote="충분한 사진이 등록되어 있습니다"
              failNote={`30장 이상 권장, 현재 ${photoCount}장 — 음식·매장 사진을 추가로 올리세요`}
            />
          )}
          {(visitorReviewCount !== undefined || avgRating !== undefined) && (
            <div className="flex items-center gap-3 py-2.5">
              <Star className="w-5 h-5 text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">방문자 리뷰</span>
                  {visitorReviewCount !== undefined && (
                    <span className="text-sm text-slate-500">{visitorReviewCount.toLocaleString()}건</span>
                  )}
                  {avgRating !== undefined && (
                    <span className="text-sm text-slate-500">★ {avgRating.toFixed(1)}</span>
                  )}
                </div>
                {visitorReviewCount !== undefined && visitorReviewCount < 30 && (
                  <p className="text-sm text-slate-500 mt-0.5 leading-snug break-keep">
                    리뷰가 30건 미만입니다 — 방문 후 리뷰 요청 문자를 활용해 빠르게 늘리세요
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 블록 C: AI 브리핑 (ACTIVE/LIKELY만) ─────────────── */}
      {briefingCategory !== "inactive" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-bold text-slate-500 tracking-wide uppercase">
              네이버 AI 브리핑
            </p>
          </div>
          <div className="px-4 py-3">
            {briefingCategory === "active" && inBriefing === null && (
              <div className="flex items-start gap-3 bg-blue-50 rounded-lg px-3 py-3 border border-blue-200">
                <span className="text-lg shrink-0">🔒</span>
                <div>
                  <p className="text-sm font-semibold text-blue-800">체험 스캔에서는 AI 브리핑 실측 미포함</p>
                  <p className="text-sm text-blue-700 mt-0.5 leading-snug break-keep">
                    구독 후 정식 스캔에서 네이버 AI 브리핑 실측 결과(노출 여부·인용 문장)를 확인하세요
                  </p>
                </div>
              </div>
            )}
            {briefingCategory === "active" && inBriefing === true && (
              <div className="flex items-start gap-3 bg-green-50 rounded-lg px-3 py-3 border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">AI 브리핑에 노출 중입니다</p>
                  <p className="text-sm text-green-700 mt-0.5 leading-snug break-keep">
                    소개글·소식·리뷰를 꾸준히 유지하면 노출이 지속됩니다
                  </p>
                </div>
              </div>
            )}
            {briefingCategory === "active" && inBriefing === false && (
              <div className="space-y-2">
                <div className="flex items-start gap-3 bg-red-50 rounded-lg px-3 py-3 border border-red-200">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-red-700">현재 AI 브리핑에 나오지 않습니다</p>
                </div>
                <div className="bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-200">
                  <p className="text-sm font-semibold text-amber-800 mb-1">가장 빠른 개선 방법</p>
                  {!hasIntro ? (
                    <p className="text-sm text-amber-700 leading-snug break-keep">
                      소개글을 작성하세요 — AI가 인용할 텍스트가 필요합니다.
                      가게 특징·메뉴·키워드를 200자 이상 작성하면 2~4주 내 변화가 나타납니다.
                    </p>
                  ) : blogCount < 10 ? (
                    <p className="text-sm text-amber-700 leading-snug break-keep">
                      블로그 언급을 늘리세요 — 리뷰 요청·이벤트로 블로그 포스팅을 유도하면
                      AI 브리핑 인용 확률이 높아집니다.
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 leading-snug break-keep">
                      소식을 꾸준히 업데이트하세요 — 월 1~2회 이상 게시하면
                      신선도 점수가 올라 AI 브리핑 노출 가능성이 높아집니다.
                    </p>
                  )}
                </div>
              </div>
            )}
            {briefingCategory === "likely" && (
              <div className="space-y-2">
                <div className="flex items-start gap-3 bg-blue-50 rounded-lg px-3 py-3 border border-blue-200">
                  <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-blue-800">
                    이 업종은 AI 브리핑 확대 준비 중 (2026년 확대 예정)
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                  <p className="text-sm text-slate-600 leading-snug break-keep">
                    지금 소개글·소식을 완성해두면 업종 확대 시 즉시 노출에 유리합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 블록 D: 경쟁사 블로그 격차 ──────────────────────── */}
      {topCompetitorName && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-sm font-bold text-slate-500 tracking-wide uppercase">
              블로그 언급 격차
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              네이버 블로그 검색에서 가게명이 등장한 포스팅 수 — 많을수록 AI 인용 가능성 높음
            </p>
          </div>
          <div className="px-4 py-3 space-y-3">
            {/* 내 가게 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-blue-700 truncate max-w-[60%]">
                  내 가게
                </span>
                <span className="text-sm font-bold text-slate-700">{blogCount.toLocaleString()}건</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${myBarPct}%` }}
                />
              </div>
            </div>
            {/* 경쟁사 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-600 truncate max-w-[60%]">
                  1위 경쟁사 ({topCompetitorName})
                </span>
                <span className="text-sm font-bold text-slate-700">
                  {compBlogCount.toLocaleString()}건
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full bg-slate-400 transition-all duration-700"
                  style={{ width: `${compBarPct}%` }}
                />
              </div>
            </div>
            {compBlogCount > blogCount && (
              <div className="flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2.5 border border-amber-200">
                <BookOpen className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-700 leading-snug break-keep">
                    경쟁사보다 {(compBlogCount - blogCount).toLocaleString()}건 적습니다
                  </p>
                  <p className="text-sm text-amber-600 leading-snug break-keep mt-0.5">
                    → 방문 손님께 블로그 후기 요청 + 이벤트 진행으로 포스팅을 늘리면 AI 노출 가능성이 높아집니다
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 leading-relaxed break-keep">
              · 가게명이 일반 명사와 유사한 경우 관련 없는 포스팅이 일부 포함될 수 있습니다
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
