import Link from "next/link";
import type { WebsiteCheckResult } from "@/types";

interface Props {
  schemaSeoScore: number | null;
  websiteUrl?: string | null;
  websiteCheckResult?: WebsiteCheckResult | null;
  plan: string;
}

const ITEMS = [
  { key: "has_json_ld",              label: "AI 인식 정보 코드 (JSON-LD)", points: 40 },
  { key: "has_schema_local_business", label: "가게 유형 정보 (LocalBusiness)",  points: 20 },
  { key: "has_open_graph",            label: "SNS 공유 설정 (OG 태그)",         points: 20 },
  { key: "is_mobile_friendly",        label: "모바일 최적화 (viewport)",         points: 10 },
] as const;

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
}

function barColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

export default function SchemaCheckCard({ schemaSeoScore, websiteUrl, websiteCheckResult, plan }: Props) {
  const canGenerate = plan !== "free";

  // 스캔 데이터 없음
  if (schemaSeoScore === null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-800">AI 검색 등록 (JSON-LD)</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Track 2</span>
        </div>
        <p className="text-sm text-gray-500">첫 스캔 후 웹사이트 AI 인식 점수가 표시됩니다.</p>
      </div>
    );
  }

  // 홈페이지 없음
  if (!websiteUrl) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-800">AI 검색 등록 (JSON-LD)</span>
          <span className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">홈페이지 없음</span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed break-keep">
          독립 웹사이트가 없으면 ChatGPT·Gemini 인용이 어렵습니다.
          홈페이지 없이는 카카오맵 비즈니스 채널 등록으로 Google AI Overview 노출 가능성을 높일 수 있습니다.
        </p>
        <Link
          href="/schema"
          className="mt-3 inline-block text-sm text-blue-600 font-medium underline"
        >
          소개글 · 블로그 초안 만들기 →
        </Link>
      </div>
    );
  }

  const score = Math.round(schemaSeoScore);
  const missingItems = ITEMS.filter((item) => websiteCheckResult && !websiteCheckResult[item.key]);
  const missingPoints = missingItems.reduce((s, i) => s + i.points, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">AI 검색 등록 (JSON-LD)</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Track 2</span>
        </div>
        <span className={`text-lg font-bold ${scoreColor(score)}`}>{score}점</span>
      </div>

      {/* 점수 진행바 */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-2 rounded-full transition-all ${barColor(score)}`} style={{ width: `${score}%` }} />
      </div>

      {/* 누락 항목 */}
      {missingItems.length > 0 ? (
        <div className="space-y-1.5 mb-4">
          {missingItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <span className="text-red-400 text-sm shrink-0">✕</span>
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="text-xs text-red-400 ml-auto shrink-0">−{item.points}점</span>
            </div>
          ))}
          <p className="text-sm text-gray-500 pt-1">
            코드 적용 시 최대 <strong className="text-gray-700">+{missingPoints}점</strong> 상승 가능
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-emerald-500 text-sm">✓</span>
          <span className="text-sm text-gray-600">모든 AI 인식 항목 등록 완료</span>
        </div>
      )}

      {/* CTA */}
      {missingItems.length > 0 && (
        canGenerate ? (
          <Link
            href="/schema"
            className="w-full block text-center text-sm font-semibold bg-blue-600 text-white rounded-xl py-2.5 hover:bg-blue-700 transition-colors"
          >
            AI 검색 등록 코드 자동 생성 →
          </Link>
        ) : (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
            <p className="text-sm text-gray-500">AI 검색 코드 자동 생성은 Basic 플랜(월 9,900원)부터</p>
            <Link href="/pricing" className="text-sm font-semibold text-blue-600 hover:underline">
              플랜 업그레이드 →
            </Link>
          </div>
        )
      )}

      {/* 점수 설명 */}
      {missingItems.length === 0 && score >= 80 && (
        <p className="text-sm text-gray-500">웹사이트 AI 인식 설정이 잘 갖춰져 있습니다. 정기 스캔으로 유지하세요.</p>
      )}
    </div>
  );
}
