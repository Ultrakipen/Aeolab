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

function getStage(score: number): { label: string; tagBg: string; bar: string; bg: string; message: string; borderColor: string } {
  if (score >= 70) return {
    label: "안정 궤도",
    tagBg: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    bg: "bg-blue-50",
    borderColor: "border-blue-200",
    message: "경쟁 가게 대비 AI 검색 노출이 잘 되어 있습니다.",
  };
  if (score >= 50) return {
    label: "성장 진행 중",
    tagBg: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    bg: "bg-blue-50",
    borderColor: "border-blue-200",
    message: "기반이 갖춰져 있습니다. 개선 항목 2~3가지 보완으로 노출을 더 늘릴 수 있습니다.",
  };
  if (score >= 30) return {
    label: "성장 준비 중",
    tagBg: "bg-amber-100 text-amber-700",
    bar: "bg-amber-400",
    bg: "bg-amber-50",
    borderColor: "border-amber-200",
    message: "핵심 항목 몇 가지를 보완하면 AI 검색 노출이 빠르게 늘어납니다.",
  };
  return {
    label: "시작 단계",
    tagBg: "bg-slate-100 text-slate-600",
    bar: "bg-slate-400",
    bg: "bg-slate-50",
    borderColor: "border-slate-200",
    message: "AI 검색 최적화를 지금 시작하면 경쟁 가게보다 먼저 자리 잡을 수 있습니다.",
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bizId } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/report/share/${bizId}`, { cache: "no-store" });
    if (res.ok) {
      const d: ShareData = await res.json();
      const stage = getStage(d.score);
      return {
        title: `${d.business_name} AI 검색 — ${stage.label} — AEOlab`,
        description: `${d.region} ${d.business_name}의 AI 검색 노출 현황: ${stage.label}. ${stage.message}`,
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

  const stage = getStage(data.score);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-start justify-center p-4 py-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* 헤더 */}
          <div className="bg-blue-600 px-6 py-4 text-center">
            <p className="text-blue-200 text-sm mb-0.5 font-medium">AI 검색 노출 현황</p>
            <h1 className="text-white text-xl font-bold leading-tight">{data.business_name}</h1>
            <p className="text-blue-300 text-sm">{data.region}</p>
          </div>

          {/* 성장 단계 */}
          <div className="px-6 pt-5 pb-3 text-center">
            <span className={`inline-block text-base font-bold px-4 py-1.5 rounded-full mb-2 ${stage.tagBg}`}>
              {stage.label}
            </span>
            <p className="text-gray-600 text-sm leading-relaxed">{stage.message}</p>
            {/* 진행 바 */}
            <div className="mt-3 mb-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${stage.bar} transition-all duration-700`}
                  style={{ width: `${Math.min(data.score, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">현재 {data.score.toFixed(0)}점 기준</p>
            </div>
          </div>

          {/* 핵심 수치 */}
          <div className={`mx-4 mb-4 px-4 py-3 rounded-xl border ${stage.bg} ${stage.borderColor}`}>
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

          {/* 성장 단계 기준 — 접기/펼치기 */}
          <div className="border-t border-gray-100 px-5 py-3">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm text-blue-600 font-medium list-none select-none">
                <span>성장 단계 기준 및 계산 방법</span>
                <span className="text-gray-500 group-open:rotate-180 transition-transform duration-200 text-sm">▼</span>
              </summary>
              <div className="mt-3 space-y-2">
                {([
                  { label: "안정 궤도",    range: "70점 이상", desc: "경쟁 가게 대비 AI 노출 우위", bg: "bg-blue-50 border-blue-200" },
                  { label: "성장 진행 중", range: "50~69점",   desc: "기반 갖춤, 보완으로 노출 확대 가능", bg: "bg-blue-50 border-blue-100" },
                  { label: "성장 준비 중", range: "30~49점",   desc: "핵심 항목 보완 시 빠른 개선 가능", bg: "bg-amber-50 border-amber-200" },
                  { label: "시작 단계",    range: "0~29점",    desc: "AI 최적화 시작이 필요합니다", bg: "bg-slate-50 border-slate-200" },
                ]).map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${item.bg} ${stage.label === item.label ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <span className="font-bold text-slate-700 shrink-0 min-w-[72px]">{item.label}</span>
                    <span className="text-gray-500 text-sm shrink-0">{item.range}</span>
                    <span className="text-gray-600 text-sm">{item.desc}</span>
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
