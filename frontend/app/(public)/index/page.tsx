import Link from "next/link";
import { TrendingUp, ArrowRight, BarChart2 } from "lucide-react";

export const metadata = {
  title: "업종별 AI 검색 노출 현황 — AEOlab",
  description: "음식점·카페·미용 등 업종별 AI 검색 노출 평균 점수를 확인하세요.",
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface CategorySummary {
  category: string;
  label: string;
  avg_score: number;
  top25_score: number;
  bottom25_score: number;
  sample_count: number;
}

interface IndexSummaryResponse {
  categories: CategorySummary[];
  updated_at?: string;
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
  restaurant: "음식점",
  cafe: "카페",
  beauty: "미용·헤어",
  hospital: "병원·의원",
  academy: "학원·교육",
  legal: "법률·세무",
  fitness: "운동·헬스",
  pet: "반려동물",
  shopping: "쇼핑몰",
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-blue-600";
  if (score >= 35) return "text-amber-600";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-green-50 border-green-200";
  if (score >= 50) return "bg-blue-50 border-blue-200";
  if (score >= 35) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

async function fetchIndexSummary(): Promise<IndexSummaryResponse | null> {
  try {
    const res = await fetch(`${BACKEND}/api/public/index/summary`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PublicIndexPage() {
  const data = await fetchIndexSummary();
  const categories = data?.categories ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/" className="text-lg font-bold text-blue-600">AEOlab</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">AI 노출 현황</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            업종별 AI 검색 노출 현황
          </h1>
          <p className="text-base md:text-lg text-gray-500">
            AEOlab에 등록된 실제 사업장 데이터를 분석한 업종별 AI 검색 노출 지수입니다.
            <span className="inline-flex items-center gap-1 ml-1 text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              분기별 업데이트
            </span>
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* 상단 CTA 배너 */}
        <div className="mb-8 bg-blue-600 rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold text-white mb-1">내 가게 AI 노출 점수는?</h2>
            <p className="text-sm text-blue-100">
              업종 평균과 비교해 내 가게가 AI 검색에서 어떤 위치인지 무료로 확인하세요.
            </p>
          </div>
          <Link
            href="/trial"
            className="inline-flex items-center gap-2 bg-white text-blue-600 font-bold text-sm md:text-base px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors shrink-0"
          >
            무료로 확인하기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 업종 카드 그리드 */}
        {categories.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 md:p-16 text-center shadow-sm">
            <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-700 mb-2">데이터를 수집 중입니다</h2>
            <p className="text-base text-gray-500">
              곧 업종별 AI 검색 노출 현황이 공개됩니다.
              지금 내 가게 점수를 먼저 확인해 보세요.
            </p>
            <Link
              href="/trial"
              className="inline-flex items-center gap-2 mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              무료 체험하기 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.category}
                className={`border rounded-2xl p-4 md:p-5 shadow-sm ${scoreBg(cat.avg_score)}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-base font-bold text-gray-900">
                    {cat.label || CATEGORY_LABEL_MAP[cat.category] || cat.category}
                  </h3>
                  <span className="text-sm text-gray-500 bg-white/70 px-2 py-0.5 rounded-full border border-gray-200 shrink-0">
                    {cat.sample_count}개 분석
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-0.5">업종 평균 AI 노출 점수</div>
                  <div className={`text-3xl md:text-4xl font-bold ${scoreColor(cat.avg_score)}`}>
                    {Math.round(cat.avg_score)}
                    <span className="text-base font-normal text-gray-400 ml-1">/ 100</span>
                  </div>
                </div>

                <div className="flex gap-3 mb-4">
                  <div className="flex-1 bg-white/60 rounded-xl p-2.5 text-center">
                    <div className="text-base font-bold text-green-600">{Math.round(cat.top25_score)}</div>
                    <div className="text-sm text-gray-500 mt-0.5">상위 25%</div>
                  </div>
                  <div className="flex-1 bg-white/60 rounded-xl p-2.5 text-center">
                    <div className="text-base font-bold text-gray-500">{Math.round(cat.bottom25_score)}</div>
                    <div className="text-sm text-gray-500 mt-0.5">하위 25%</div>
                  </div>
                </div>

                <Link
                  href="/trial"
                  className="inline-flex w-full items-center justify-center gap-1.5 bg-white hover:bg-blue-50 text-blue-600 font-semibold text-sm px-4 py-2.5 rounded-xl border border-blue-200 transition-colors"
                >
                  내 가게는? <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* 데이터 출처 안내 */}
        <div className="mt-8 bg-gray-100 border border-gray-200 rounded-2xl p-4 md:p-5 text-center">
          <p className="text-sm text-gray-500">
            AEOlab이 집계한 실제 사업장 데이터 기반 (분기별 업데이트, 개인정보 비포함)
          </p>
          {data?.updated_at && (
            <p className="text-sm text-gray-400 mt-1">
              최근 업데이트: {new Date(data.updated_at).toLocaleDateString("ko-KR")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
