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
    A: "text-green-500", B: "text-blue-500", C: "text-yellow-500", D: "text-red-500",
  };
  const gradeDesc: Record<string, string> = {
    A: "AI 검색 최상위 노출 상태", B: "AI가 자주 추천하는 상태",
    C: "AI 노출 개선이 필요한 상태", D: "AI가 거의 모르는 상태 — 즉시 개선 필요",
  };
  const gradeBg: Record<string, string> = {
    A: "bg-green-50 border-green-200", B: "bg-blue-50 border-blue-200",
    C: "bg-yellow-50 border-yellow-200", D: "bg-red-50 border-red-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-start justify-center p-4 py-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* 헤더 */}
          <div className="bg-blue-600 px-6 py-4 text-center">
            <p className="text-blue-200 text-sm mb-0.5 font-medium">AI 검색 노출 점수</p>
            <h1 className="text-white text-xl font-bold leading-tight">{data.business_name}</h1>
            <p className="text-blue-300 text-sm">{data.region}</p>
          </div>

          {/* 점수 + 등급 */}
          <div className="px-6 pt-5 pb-3 text-center">
            <div className="flex items-end justify-center gap-1">
              <span className="text-6xl font-black text-slate-900 leading-none">{data.score.toFixed(0)}</span>
              <span className="text-slate-400 text-lg mb-1">점</span>
            </div>
            <div className={`text-2xl font-bold mt-1 ${gradeColor[data.grade] ?? "text-slate-600"}`}>
              {data.grade}등급
            </div>
            <p className="text-gray-500 text-sm mt-0.5">{gradeDesc[data.grade]}</p>
          </div>

          {/* 핵심 수치 */}
          <div className={`mx-4 mb-4 px-4 py-3 rounded-xl border ${gradeBg[data.grade] ?? "bg-gray-50 border-gray-200"}`}>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Gemini AI 측정 노출 횟수</span>
              <span className="font-bold text-slate-800">{data.gemini_frequency.toFixed(0)}회</span>
            </div>
            {data.scanned_at && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">분석일</span>
                <span className="font-semibold text-slate-700">{data.scanned_at.slice(0, 10)}</span>
              </div>
            )}
          </div>

          {/* 등급 기준 — 접기/펼치기 */}
          <div className="border-t border-gray-100 px-5 py-3">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm text-blue-600 font-medium list-none select-none">
                <span>등급 기준 및 점수 계산 방법</span>
                <span className="text-gray-500 group-open:rotate-180 transition-transform duration-200 text-sm">▼</span>
              </summary>
              <div className="mt-3 space-y-2">
                {([
                  { grade: "A", range: "80~100점", label: "AI가 최우선 추천", desc: "경쟁사 대비 확실한 우위" },
                  { grade: "B", range: "60~79점", label: "AI가 자주 추천",   desc: "유지·강화가 필요합니다" },
                  { grade: "C", range: "40~59점", label: "AI가 가끔 언급",   desc: "키워드 강화가 필요합니다" },
                  { grade: "D", range: "0~39점",  label: "AI가 거의 모름",   desc: "정보 등록이 시급합니다" },
                ] as const).map((item) => (
                  <div
                    key={item.grade}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${gradeBg[item.grade] ?? ""} ${data.grade === item.grade ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <span className="font-bold text-slate-700 w-6 shrink-0">{item.grade}</span>
                    <span className="text-gray-500 text-sm shrink-0">{item.range}</span>
                    <span className="text-gray-600 text-sm">{item.label}</span>
                  </div>
                ))}
                <p className="text-sm text-gray-500 pt-1 leading-relaxed">
                  지역에서 &apos;{data.category} 추천&apos; 같은 질문을 AI에 100번 물었을 때 노출 빈도 + 리뷰·정보 완성도로 계산합니다.
                </p>
              </div>
            </details>
          </div>

          {/* 사업주 본인용 버튼 */}
          <div className="px-5 pt-3 pb-2 space-y-2">
            <a
              href={`${BACKEND}/api/report/share-card/${bizId}`}
              download={`${data.business_name}_AI점수.png`}
              className="flex items-center justify-center w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              이미지 저장 (카카오톡·문자 공유용)
            </a>
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              내 대시보드 바로가기
            </Link>
          </div>

          {/* 구분선 — 링크를 받은 분께 */}
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-sm text-gray-500 shrink-0">이 결과를 공유받으신 분께</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <Link
              href="/trial"
              className="flex items-center justify-center w-full border border-blue-200 text-blue-600 hover:bg-blue-50 py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              우리 가게 AI 검색 점수 무료로 받아보기 →
            </Link>
          </div>
        </div>

        <p className="text-center text-blue-300/60 text-sm mt-4">
          <Link href="/" className="underline hover:text-white">AEOlab</Link>
          {" "}— AI 검색 사업장 성장 플랫폼
        </p>
      </div>
    </div>
  );
}
