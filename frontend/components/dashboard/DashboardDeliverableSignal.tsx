import Link from "next/link";

interface Props {
  /** 네이버 소개글 초안 생성 여부 (실측) */
  naverIntroReady: boolean;
  /** 톡톡 채팅방 메뉴 초안 개수 (실측, 0이면 미표시) */
  talktalkMenuCount: number;
  /** 글로벌 AI 소개글 초안 생성 여부 (실측) */
  globalIntroReady: boolean;
}

/**
 * 🎁 "받은 것" 신호 — AI가 생성해둔 내 가게 맞춤 산출물을 상단에서 한눈에.
 *
 * 사장님 관점의 "비용값 체감"을 첫 화면에서 해소하기 위한 컴포넌트.
 * 실제 생성된 산출물(소개글·톡톡 메뉴 초안)만 표시하며, 하나도 없으면 렌더링하지 않는다.
 * (빈 상태 허위 표시 금지 — 미생성 시 ContentZone 생성기 카드가 안내 역할)
 */
export default function DashboardDeliverableSignal({
  naverIntroReady,
  talktalkMenuCount,
  globalIntroReady,
}: Props) {
  const items: { label: string; href: string }[] = [];
  if (naverIntroReady) items.push({ label: "AI 네이버 소개글 초안", href: "#naver-intro-anchor" });
  if (talktalkMenuCount > 0) items.push({ label: `톡톡 채팅방 메뉴 ${talktalkMenuCount}개`, href: "#naver-talktalk-anchor" });
  if (globalIntroReady) items.push({ label: "글로벌 AI 소개글 초안", href: "#section-global" });

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base" aria-hidden="true">🎁</span>
        <p className="text-sm md:text-base font-bold text-gray-900 break-keep">
          AI가 준비한 내 가게 맞춤 자료
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="inline-flex items-center gap-1.5 bg-white border border-purple-200 text-purple-800 text-sm font-semibold rounded-full px-3 py-1.5 hover:bg-purple-100 transition-colors"
          >
            <span className="text-emerald-500" aria-hidden="true">✓</span>
            {it.label}
            <span className="text-purple-400" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2 leading-snug break-keep">
        바로 복사해 스마트플레이스·톡톡에 붙여넣으면 됩니다 · 내용은 다시 생성하면 갱신됩니다
      </p>
    </div>
  );
}
