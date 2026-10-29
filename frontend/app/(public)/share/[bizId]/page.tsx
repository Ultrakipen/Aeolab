import { STAGE_NAME, stageCodeForScore } from "@/lib/scoreLabels";
import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// 서버 컴포넌트 자체 fetch: 공개 도메인(Cloudflare 경유) 대신 로컬 백엔드 직접 호출
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
// og:image·다운로드 링크처럼 브라우저/외부 크롤러가 직접 접근하는 URL은 반드시 공개 도메인이어야 함
// (2026-09-22: 위 BACKEND를 그대로 쓰면 og:image가 http://localhost:8000/... 로 렌더돼 카카오톡·
// 페이스북 크롤러가 접근 불가한 회귀가 생길 뻔함 — 발견 즉시 분리)
const PUBLIC_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ShareData {
  business_name: string;
  category: string;
  region: string;
  score: number;
  /** 성장 단계를 정하는 점수(track1) — 대시보드와 같은 단계로 보이게 한다. 없으면(구버전 응답) score */
  stage_score?: number;
  /** 이번 스캔에서 네이버 일부 항목을 확인하지 못함 — 낮아진 점수로 단계를 붙이지 않는다 */
  stage_pending?: boolean;
  grade: string;
  gemini_frequency: number;
  scanned_at: string;
}

interface Props {
  params: Promise<{ bizId: string }>;
}

function getStage(score: number): { label: string; tagBg: string; bar: string; bg: string; message: string; borderColor: string } {
  // 구간(75/55/30)은 lib/scoreLabels.ts 단일 소스 — 이전에는 이 페이지만 70/50/30을 따로 써서 같은 가게가 대시보드와 다른 단계로 보였다
  const code = stageCodeForScore(score);
  if (code === "dominance") return {
    label: STAGE_NAME.dominance,
    tagBg: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    bg: "bg-blue-50",
    borderColor: "border-blue-200",
    message: "경쟁 가게 대비 AI 검색 노출이 잘 되어 있습니다.",
  };
  if (code === "growth") return {
    label: STAGE_NAME.growth,
    tagBg: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    bg: "bg-blue-50",
    borderColor: "border-blue-200",
    message: "기반이 갖춰져 있습니다. 개선 항목 2~3가지 보완으로 노출을 더 늘릴 수 있습니다.",
  };
  if (code === "stability") return {
    label: STAGE_NAME.stability,
    tagBg: "bg-amber-100 text-amber-700",
    bar: "bg-amber-400",
    bg: "bg-amber-50",
    borderColor: "border-amber-200",
    message: "핵심 항목 몇 가지를 보완하면 AI 검색 노출이 빠르게 늘어납니다.",
  };
  return {
    label: STAGE_NAME.survival,
    tagBg: "bg-slate-100 text-slate-600",
    bar: "bg-slate-400",
    bg: "bg-slate-50",
    borderColor: "border-slate-200",
    message: "AI 검색 개선을 지금 시작하면 경쟁 가게보다 먼저 자리 잡을 수 있습니다.",
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bizId } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/report/share/${bizId}`, { cache: "no-store" });
    if (res.ok) {
      const d: ShareData = await res.json();
      const stage = getStage(d.stage_score ?? d.score);
      return {
        title: `${d.business_name} AI 검색 — ${stage.label} — AEOlab`,
        description: `${d.region} ${d.business_name}의 AI 검색 노출 현황: ${stage.label}. ${stage.message}`,
        openGraph: {
          images: [`${PUBLIC_BACKEND}/api/report/share-card/${bizId}`],
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
          <p className="text-gray-600 mb-4">분석 결과를 찾을 수 없습니다.</p>
          <Link href="/" className="text-blue-600 hover:underline text-sm">AEOlab 홈으로</Link>
        </div>
      </div>
    );
  }

  const stageScore = data.stage_score ?? data.score;
  const pending = data.stage_pending === true;
  const stage = pending
    ? {
        label: "AI 검색 준비도 · 일부 항목 확인 전",
        tagBg: "bg-slate-100 text-slate-700",
        bar: "bg-slate-400",
        bg: "bg-slate-50",
        borderColor: "border-slate-200",
        message: "이번 측정에서 네이버 일부 항목을 확인하지 못했어요. 확인되면 단계를 보여 드려요.",
      }
    : getStage(stageScore);

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
            {/* 진행 바 — 네이버 일부 항목이 확인 전이면 낮아진 점수로 그리지 않는다 */}
            {!pending && (
            <div className="mt-3 mb-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${stage.bar} transition-all duration-700`}
                  style={{ width: `${Math.min(stageScore, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1 text-right">{stage.label} 기준</p>
            </div>
            )}
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
                <span className="text-gray-600 group-open:rotate-180 transition-transform duration-200 text-sm">▼</span>
              </summary>
              <div className="mt-3 space-y-2">
                {([
                  { label: STAGE_NAME.dominance,    range: "최상위 구간", desc: "경쟁 가게 대비 AI 노출 우위", bg: "bg-blue-50 border-blue-200" },
                  { label: STAGE_NAME.growth, range: "상위 구간",   desc: "기반 갖춤, 보완으로 노출 확대 가능", bg: "bg-blue-50 border-blue-100" },
                  { label: STAGE_NAME.stability, range: "중위 구간",   desc: "핵심 항목 보완 시 빠른 개선 가능", bg: "bg-amber-50 border-amber-200" },
                  { label: STAGE_NAME.survival,    range: "하위 구간",    desc: "AI 검색 개선을 시작할 때입니다", bg: "bg-slate-50 border-slate-200" },
                ]).map((item) => (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${item.bg} ${stage.label === item.label ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <span className="font-bold text-slate-700 shrink-0 min-w-[72px]">{item.label}</span>
                    <span className="text-gray-600 text-sm shrink-0">{item.range}</span>
                    <span className="text-gray-600 text-sm">{item.desc}</span>
                  </div>
                ))}
                <p className="text-sm text-gray-600 pt-1 leading-relaxed">
                  지역에서 &apos;{data.category} 추천&apos; 같은 질문을 AI에 여러 번 물었을 때 노출 빈도 + 리뷰·정보 완성도로 계산합니다(측정 횟수는 스캔 종류에 따라 다릅니다).
                </p>
              </div>
            </details>
          </div>

          {/* 사업주 본인용 버튼 */}
          <div className="px-5 pt-3 pb-2 space-y-2">
            <a
              href={`${PUBLIC_BACKEND}/api/report/share-card/${bizId}`}
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
              <span className="text-sm text-gray-600 shrink-0">이 결과를 공유받으신 분께</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <Link
              href="/trial"
              className="flex items-center justify-center w-full border border-blue-200 text-blue-600 hover:bg-blue-50 py-2.5 rounded-xl font-medium text-sm transition-colors"
            >
              우리 가게 AI 검색 점수 무료로 받아보기 <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <p className="text-center text-blue-300/60 text-sm mt-4">
          <Link href="/" className="underline hover:text-white">AEOlab</Link>
          {" "}— AI 검색 사업장 성장 서비스
        </p>
      </div>
    </div>
  );
}
