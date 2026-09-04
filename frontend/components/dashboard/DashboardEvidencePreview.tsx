import Link from "next/link";

interface Props {
  /** ChatGPT가 내 가게를 실제로 언급한 인용문 (실측, 없으면 미표시) */
  chatgptCitation?: string | null;
  /** 경쟁사 비교 순위 (1줄 보조, 경쟁사 2곳 이상일 때만) */
  myRankInList?: number;
  totalCompetitors?: number;
}

/**
 * 🔎 실측 증거 미리보기 — "돈값" 체감을 위해 차별적 실측 증거를 Hero 직하단으로 끌어올림.
 *
 * 기존에는 ChatGPT 실제 인용문이 접힌 ⑦ 글로벌 AI 섹션 안에 숨어 있었다.
 * 가장 강한 가치 증거(AI가 내 가게를 실제로 이렇게 설명함)를 첫 화면에서 보여준다.
 *
 * 실측 인용문이 있을 때만 렌더링한다 (더미·예시 금지 — CLAUDE.md 실측 데이터 원칙).
 * 인용문이 없으면 null 반환 → 빈 상태 허위 표시 방지.
 */
export default function DashboardEvidencePreview({
  chatgptCitation,
  myRankInList,
  totalCompetitors,
}: Props) {
  const citation = chatgptCitation?.trim() || "";
  if (!citation) return null;

  const hasRank = !!(myRankInList && totalCompetitors && totalCompetitors > 1);

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base" aria-hidden="true">🔎</span>
        <p className="text-sm md:text-base font-bold text-gray-900 break-keep">
          AI가 실제로 내 가게를 이렇게 설명했어요
        </p>
        {hasRank && (
          <span className="ml-auto text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
            경쟁사 {totalCompetitors}곳 중 {myRankInList}위
          </span>
        )}
      </div>
      <blockquote className="border-l-2 border-blue-300 pl-3 text-sm text-gray-700 leading-relaxed break-keep line-clamp-3">
        “{citation}”
      </blockquote>
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <p className="text-xs text-gray-600 leading-snug break-keep">
          ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다 · 측정 시점·기기·로그인 상태에 따라 달라질 수 있음
        </p>
        <Link
          href="#section-global"
          className="text-sm font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0"
        >
          글로벌 AI 상세 →
        </Link>
      </div>
    </div>
  );
}
