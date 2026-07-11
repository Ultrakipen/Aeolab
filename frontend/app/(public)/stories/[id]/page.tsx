import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
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

const CATEGORY_LABELS: Record<string, string> = {
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

async function fetchStory(id: string): Promise<StoryItem | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/stories/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const story = await fetchStory(id);

  if (!story) notFound();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            성공 사례 목록
          </Link>
          {/* 카테고리·지역 배지 */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
              {CATEGORY_LABELS[story.category] ?? story.category}
            </span>
            {story.region && (
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {story.region}
              </span>
            )}
            {story.score_delta !== null && story.score_delta > 0 && (
              <span className="text-sm font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                노출 향상
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight break-keep">
            {story.title}
          </h1>
          <p className="text-sm text-gray-500 mt-2">{formatDate(story.published_at)}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6">
        {/* 점수 전후 비교 카드 */}
        {(story.score_before !== null || story.score_after !== null) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-800 mb-4">점수 변화</h2>
            <div className="flex items-center justify-center gap-4 md:gap-8">
              {/* Before */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">시작 전</p>
                <p className="text-2xl font-black text-gray-500">
                  {story.score_before !== null ? getScoreTextLabel(story.score_before) : "—"}
                </p>
              </div>

              {/* 화살표 */}
              <div className="flex flex-col items-center gap-1">
                <ChevronRight className="w-8 h-8 text-blue-300" />
                {story.score_delta !== null && story.score_delta > 0 && (
                  <span className="text-sm font-bold text-emerald-600">향상</span>
                )}
              </div>

              {/* After */}
              <div className="text-center">
                <p className="text-sm text-emerald-600 font-medium mb-1">30일 후</p>
                <p className="text-2xl font-black text-emerald-600">
                  {story.score_after !== null ? getScoreTextLabel(story.score_after) : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 본문 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-800 mb-4">상세 내용</h2>
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {story.body}
          </div>
          {story.display_name && !story.is_anonymous && (
            <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-50">
              — {story.display_name}
            </p>
          )}
        </div>

        {/* 뒤로가기 + CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로 돌아가기
          </Link>
          <Link
            href="/delivery"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors sm:ml-auto"
          >
            나도 신청하기 →
          </Link>
        </div>
      </div>
      <SiteFooter activePage="/stories" />
    </main>
  );
}
