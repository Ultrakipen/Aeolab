import { Metadata } from "next";
import Link from "next/link";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ShareData {
  business_name: string;
  category: string;
  region: string;
  score: number;
  grade: string;
  gemini_frequency: number;
  scanned_at: string;
}

interface Props {
  params: Promise<{ bizId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bizId } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/report/share/${bizId}`, { cache: "no-store" });
    if (res.ok) {
      const d: ShareData = await res.json();
      return {
        title: `${d.business_name} AI 검색 점수 ${d.score.toFixed(0)}점 — AEOlab`,
        description: `${d.region} ${d.business_name}의 AI 검색 노출 점수: ${d.score.toFixed(0)}점 (등급 ${d.grade}).`,
        openGraph: {
          images: [`${BACKEND}/api/report/share-card/${bizId}`],
        },
      };
    }
  } catch {}
  return { title: "AEOlab — AI 검색 분석 결과" };
}

export default async function SharePage({ params }: Props) {
  const { bizId } = await params;

  let data: ShareData | null = null;
  let fetchError = false;

  try {
    const res = await fetch(`${BACKEND}/api/report/share/${bizId}`, { cache: "no-store" });
    if (res.ok) {
      data = await res.json();
    } else {
      fetchError = true;
    }
  } catch {
    fetchError = true;
  }

  if (fetchError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">분석 결과를 찾을 수 없습니다.</p>
          <Link href="/" className="text-blue-600 hover:underline text-sm">AEOlab 홈으로</Link>
        </div>
      </div>
    );
  }

  const gradeColor: Record<string, string> = {
    A: "text-green-600", B: "text-blue-600", C: "text-yellow-600", D: "text-red-500",
  };
  const gradeDesc: Record<string, string> = {
    A: "최상위 노출 상태", B: "양호한 노출 상태",
    C: "개선이 필요한 상태", D: "즉시 개선 필요",
  };
  const cardImageUrl = `${BACKEND}/api/report/share-card/${bizId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="bg-blue-600 px-6 py-5 text-center">
            <p className="text-blue-200 text-xs mb-1 font-medium">AI 검색 노출 점수</p>
            <h1 className="text-white text-2xl font-bold">{data.business_name}</h1>
            <p className="text-blue-300 text-sm mt-1">{data.region}</p>
          </div>

          {/* 점수 */}
          <div className="px-6 py-8 text-center">
            <div className="text-7xl font-black text-slate-900">{data.score.toFixed(0)}</div>
            <div className="text-slate-400 text-lg -mt-1">점</div>
            <div className={`text-4xl font-bold mt-2 ${gradeColor[data.grade] ?? "text-slate-600"}`}>
              등급 {data.grade}
            </div>
            <p className="text-gray-500 text-sm mt-1">{gradeDesc[data.grade]}</p>
          </div>

          {/* 통계 */}
          <div className="border-t border-gray-100 px-6 py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Gemini AI 노출 빈도</span>
              <span className="font-semibold text-slate-700">{data.gemini_frequency.toFixed(0)}회 / 100</span>
            </div>
            {data.scanned_at && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">분석일</span>
                <span className="font-semibold text-slate-700">{data.scanned_at.slice(0, 10)}</span>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="px-6 pb-6 pt-2 flex flex-col gap-3">
            <a
              href={cardImageUrl}
              download={`${data.business_name}_AI점수.png`}
              className="flex items-center justify-center w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium text-sm transition-colors"
            >
              이미지 저장 (카카오톡 공유용)
            </a>
            <Link
              href="/trial"
              className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              내 가게도 무료로 분석하기
            </Link>
          </div>
        </div>

        <p className="text-center text-blue-300/60 text-xs mt-5">
          powered by{" "}
          <Link href="/" className="underline hover:text-white">AEOlab</Link>
          {" "}— AI 검색 사업장 성장 플랫폼
        </p>
      </div>
    </div>
  );
}
