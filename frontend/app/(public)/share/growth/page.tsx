import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import GrowthShareClient from "./GrowthShareClient";

// 임계값은 lib/scoreLabels.ts의 getScoreTextLabel과 동일(75/55/30) — 드리프트 시 함께 갱신할 것
function getStageLabel(score: number): string {
  if (score >= 75) return "안정 궤도";
  if (score >= 55) return "성장 진행 중";
  if (score >= 30) return "성장 준비 중";
  return "시작 단계";
}

interface Props {
  searchParams: Promise<{ img?: string; biz?: string; score?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { img, biz, score } = await searchParams;

  const bizName = biz ? decodeURIComponent(biz) : "우리 가게";
  const scoreVal = score ? parseInt(score, 10) : null;

  const stageLabel = scoreVal && !isNaN(scoreVal) ? getStageLabel(scoreVal) : null;

  const title = stageLabel
    ? `${bizName} AI 검색 — ${stageLabel} — AEOlab`
    : `${bizName} AI 검색 성장 기록 — AEOlab`;

  const description = stageLabel
    ? `AI 검색 최적화로 노출이 늘어났습니다! ${bizName} 현재 단계: ${stageLabel} · AEOlab`
    : `AI 검색 최적화로 사업장 노출이 늘어납니다 · AEOlab`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: img ? [{ url: decodeURIComponent(img), width: 600, height: 400 }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: img ? [decodeURIComponent(img)] : [],
    },
  };
}

export default async function GrowthSharePage({ searchParams }: Props) {
  const { img, biz, score } = await searchParams;

  // img 없으면 /trial 리다이렉트
  if (!img) {
    redirect("/trial");
  }

  const imgUrl = decodeURIComponent(img);
  const bizName = biz ? decodeURIComponent(biz) : null;
  const scoreVal = score ? parseInt(score, 10) : null;
  const stageLabel = scoreVal !== null && !isNaN(scoreVal) ? getStageLabel(scoreVal) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-start justify-center p-4 py-8">
      <div className="w-full max-w-sm">
        {/* 성장 카드 이미지 */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* 헤더 */}
          <div className="bg-blue-600 px-6 py-4 text-center">
            <p className="text-blue-200 text-sm font-medium mb-0.5">AI 검색 노출 성장 기록</p>
            {bizName && (
              <h1 className="text-white text-xl font-bold leading-tight truncate max-w-full">
                {bizName}
              </h1>
            )}
            {stageLabel && (
              <p className="text-blue-200 text-sm mt-0.5">
                현재 단계 <span className="font-bold text-white">{stageLabel}</span>
              </p>
            )}
          </div>

          {/* 성장 카드 이미지 */}
          <div className="px-4 pt-4 pb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt={bizName ? `${bizName} 성장 카드` : "성장 카드"}
              className="w-full rounded-xl shadow-md"
              width={540}
              height={360}
            />
          </div>

          {/* 메시지 */}
          <div className="px-5 pt-2 pb-4 text-center">
            <p className="text-base font-semibold text-gray-800">
              {stageLabel ? `AI 검색 노출 — ${stageLabel}` : "AI 검색 최적화로 노출이 늘어났습니다!"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              네이버·Gemini·ChatGPT 노출 기록을 한 곳에서 확인
            </p>
          </div>

          {/* CTA 버튼 */}
          <div className="px-5 pb-5 space-y-3">
            <Link
              href="/trial?ref=growth_share_landing"
              className="flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-base transition-colors shadow-sm"
            >
              내 가게도 무료로 진단받기 →
            </Link>
            <p className="text-center text-sm text-gray-400">
              회원가입 불필요 · 1분 완성
            </p>
          </div>

          {/* 구분선 */}
          <div className="border-t border-gray-100 px-5 py-3">
            <GrowthShareClient shareUrl={`https://aeolab.co.kr/share/growth?img=${img}${biz ? `&biz=${biz}` : ""}${score ? `&score=${score}` : ""}`} />
          </div>
        </div>

        {/* 하단 브랜드 */}
        <p className="text-center text-blue-300/60 text-sm mt-4">
          <Link href="/" className="underline hover:text-white">
            AEOlab
          </Link>
          {" "}— AI 검색 사업장 성장 플랫폼
        </p>
      </div>
    </div>
  );
}
