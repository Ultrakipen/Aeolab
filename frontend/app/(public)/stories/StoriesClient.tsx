"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";
import { getScoreTextLabel } from "@/lib/scoreLabels";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface StoryItem {
  id: string;
  category: string;
  region: string;
  title: string;
  body: string;
  score_before: number | null;
  score_after: number | null;
  score_delta: number | null;
  is_anonymous: boolean;
  display_name: string | null;
  published_at: string;
  view_count: number;
}

interface StoriesResponse {
  items: StoryItem[];
  total: number;
  page: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  "": "전체",
  restaurant: "음식점",
  cafe: "카페",
  bakery: "베이커리",
  bar: "바/술집",
  beauty: "미용",
  nail: "네일",
  medical: "의료",
  pharmacy: "약국",
  fitness: "헬스",
  yoga: "요가",
  pet: "반려동물",
  education: "교육",
  tutoring: "학원",
  legal: "법률",
  realestate: "부동산",
  interior: "인테리어",
  auto: "자동차",
  cleaning: "청소",
  shopping: "쇼핑",
  fashion: "패션",
  photo: "사진",
  video: "영상",
  design: "디자인",
  accommodation: "숙박",
  other: "기타",
};

const FILTER_CATEGORIES = ["", "restaurant", "cafe", "bakery", "beauty", "accommodation", "education", "other"];

const PER_PAGE = 12;

function EmptyState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500"
    >
      <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-base font-medium text-gray-600">아직 등록된 성공 사례가 없습니다.</p>
      <p className="text-sm text-gray-400 mt-1">첫 번째 성공 사례를 기다리고 있습니다.</p>
    </div>
  );
}

export default function StoriesClient() {
  const [items, setItems] = useState<StoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PER_PAGE);

  const fetchStories = useCallback(async (cat: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE) });
      if (cat) params.set("category", cat);
      const res = await fetch(`${BACKEND_URL}/api/stories?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
      const data: StoriesResponse = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("성공 사례를 불러오는 중 오류가 발생했습니다.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories(category, page);
  }, [category, page, fetchStories]);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setPage(1);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Link>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">고객 성공 사례</h1>
          <p className="text-sm md:text-base text-gray-500">AEOlab 대행 서비스 30일 결과 — 실제 고객 사례</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-6 md:mb-8">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={[
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                category === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50",
              ].join(" ")}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* 오류 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-4/5 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-full mb-1" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="grid grid-cols-1">
            <EmptyState />
          </div>
        ) : (
          <>
            {/* 사례 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {items.map((story) => (
                <Link
                  key={story.id}
                  href={`/stories/${story.id}`}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition-all flex flex-col"
                >
                  {/* 상단: 카테고리 + 점수 변화 */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                        {CATEGORY_LABELS[story.category] ?? story.category}
                      </span>
                      {story.region && (
                        <span className="text-sm text-gray-500">{story.region}</span>
                      )}
                    </div>
                    {story.score_delta !== null && story.score_delta > 0 && (
                      <span className="shrink-0 text-sm font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        노출 향상
                      </span>
                    )}
                  </div>

                  {/* 제목 */}
                  <h2 className="text-base font-bold text-gray-900 mb-2 line-clamp-2 flex-1">
                    {story.title}
                  </h2>

                  {/* 본문 미리보기 */}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                    {story.body}
                  </p>

                  {/* 하단: 점수 전후 + 날짜 */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                    {story.score_before !== null && story.score_after !== null ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-gray-400">{getScoreTextLabel(story.score_before)}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <span className="font-bold text-emerald-600">{getScoreTextLabel(story.score_after)}</span>
                      </div>
                    ) : (
                      <span />
                    )}
                    <span className="text-sm text-gray-400">{formatDate(story.published_at)}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  이전
                </button>
                <span className="text-sm text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  다음
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* 하단 CTA */}
        <div className="mt-12 text-center py-10 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-base font-bold text-gray-900 mb-1">나도 성공 사례 주인공이 될 수 있어요</p>
          <p className="text-sm text-gray-500 mb-4">30일 대행 서비스로 AI 검색 노출을 높여보세요</p>
          <Link
            href="/delivery"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            대행 서비스 신청하기 →
          </Link>
        </div>
      </div>
      <SiteFooter activePage="/stories" />
    </main>
  );
}
