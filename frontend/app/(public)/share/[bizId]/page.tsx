import Link from "next/link";
import { Metadata } from "next";

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

async function getShareData(bizId: string): Promise<ShareData | null> {
  try {
    const res = await fetch(`${BACKEND}/api/report/share/${bizId}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { bizId: string };
}): Promise<Metadata> {
  const data = await getShareData(params.bizId);
  if (!data) return { title: "AEOlab AI 성적표" };
  return {
    title: `${data.business_name} AI 검색 점수 ${data.score}점 (${data.grade}등급) — AEOlab`,
    description: `${data.category} | ${data.region} | AEOlab AI 노출 분석`,
    openGraph: {
      images: [`${BACKEND}/api/report/share-card/${params.bizId}`],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: { bizId: string };
}) {
  const data = await getShareData(params.bizId);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-slate-400 text-lg">공유 정보를 찾을 수 없습니다</p>
          <Link href="/trial" className="mt-4 text-blue-400 underline inline-block">
            내 가게 무료 분석하기
          </Link>
        </div>
      </div>
    );
  }

  const gradeColor: Record<string, string> = {
    A: "text-green-400",
    B: "text-blue-400",
    C: "text-yellow-400",
    D: "text-orange-400",
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 성적표 카드 */}
        <div className="bg-slate-800 rounded-2xl p-8 text-white text-center shadow-2xl">
          <p className="text-slate-400 text-sm mb-1">{data.category} · {data.region}</p>
          <h1 className="text-2xl font-bold mb-6">{data.business_name}</h1>

          <div className="mb-2">
            <span className={`text-8xl font-black ${gradeColor[data.grade] ?? "text-slate-400"}`}>
              {data.score}
            </span>
            <span className="text-3xl text-slate-400">/100</span>
          </div>
          <div className={`text-4xl font-bold mb-4 ${gradeColor[data.grade] ?? "text-slate-400"}`}>
            {data.grade}등급
          </div>

          <p className="text-slate-400 text-sm mb-6">
            AI 100회 검색 중 <strong className="text-white">{data.gemini_frequency}회</strong> 언급
          </p>

          <div className="border-t border-slate-700 pt-4 text-xs text-slate-500">
            분석일: {new Date(data.scanned_at).toLocaleDateString("ko-KR")}
            &nbsp;·&nbsp;AEOlab AI Visibility Score
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/trial"
            className="bg-blue-600 text-white rounded-xl px-8 py-4 font-semibold inline-block hover:bg-blue-700 transition-colors"
          >
            내 사업장도 무료 분석하기 →
          </Link>
          <p className="text-slate-500 text-xs mt-3">1분 만에 결과 확인 · 신용카드 불필요</p>
        </div>
      </div>
    </div>
  );
}
