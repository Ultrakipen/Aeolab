interface NaverSeoBaseCardProps {
  reviewCount: number;
  hasIntro: boolean;
  hasRecentPost: boolean;
  hasReservation: boolean | null;
  photoCount: number | null;
  blogMentionCount: number;
  eligibility: "active" | "likely" | "inactive";
}

interface CheckItemProps {
  checked: boolean | null; // null = 미측정
  action: string;
  effect: string;
}

function CheckItem({ checked, action, effect }: CheckItemProps) {
  const icon = checked === null ? "⬜" : checked ? "✅" : "❌";
  const badgeColor =
    checked === null
      ? "bg-gray-100 text-gray-500"
      : checked
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="flex items-center justify-between rounded-lg bg-white border border-emerald-100 px-3 py-2 gap-2">
      <span className="text-sm text-gray-800">
        {icon} {action}
      </span>
      <span
        className={`text-sm px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${badgeColor}`}
      >
        {effect}
      </span>
    </div>
  );
}

export default function NaverSeoBaseCard({
  reviewCount,
  hasIntro,
  hasRecentPost,
  hasReservation,
  photoCount,
  blogMentionCount,
  eligibility,
}: NaverSeoBaseCardProps) {
  const isActiveOrLikely = eligibility === "active" || eligibility === "likely";

  // 체크리스트 항목 5개
  const checkItems: CheckItemProps[] = [
    {
      checked: hasIntro,
      action: "소개글 Q&A 포함",
      effect: isActiveOrLikely ? "AI 브리핑·AI탭 ↑" : "AI탭 ↑",
    },
    {
      checked: reviewCount >= 10,
      action:
        reviewCount < 10
          ? `리뷰 ${reviewCount}개 (10개 목표)`
          : `리뷰 ${reviewCount}개`,
      effect: isActiveOrLikely ? "플레이스탭·AI 브리핑 ↑" : "플레이스탭 ↑",
    },
    {
      checked: photoCount === null ? null : photoCount >= 10,
      action:
        photoCount === null
          ? "사진 10장+ (스캔 후 확인)"
          : photoCount < 10
          ? `사진 ${photoCount}장 (10장 목표)`
          : `사진 ${photoCount}장`,
      effect: "플레이스탭·AI탭 ↑",
    },
    {
      checked: hasRecentPost,
      action: "14일 이내 소식 게시",
      effect: "AI탭 ↑",
    },
    {
      checked: hasReservation,
      action: "예약 연동",
      effect: isActiveOrLikely ? "AI 브리핑 ↑" : "플레이스탭 ↑",
    },
  ];

  // 블로그 언급 배지
  const blogBadge =
    blogMentionCount === 0
      ? { color: "bg-amber-100 text-amber-700", label: "AI탭 소스 없음" }
      : blogMentionCount <= 5
      ? { color: "bg-yellow-100 text-yellow-700", label: "AI탭 소스 부족" }
      : blogMentionCount <= 20
      ? { color: "bg-emerald-100 text-emerald-700", label: "AI탭 답변 소스" }
      : { color: "bg-emerald-200 text-emerald-800", label: "AI탭 소스 풍부" };

  const subtitle = isActiveOrLikely
    ? "네이버 검색 순위와 AI 브리핑·AI탭 노출을 함께 높이는 기반입니다"
    : "네이버 검색 순위와 AI탭 노출을 함께 높이는 기반입니다";

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 md:px-5 py-4">
      {/* 헤더 */}
      <div className="flex items-start gap-2.5 mb-3">
        <span className="text-xl shrink-0">🔍</span>
        <div className="min-w-0">
          <p className="text-sm md:text-base font-semibold text-gray-900">
            네이버 검색 기반 강화 현황
          </p>
          <p className="text-sm text-emerald-800 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-500 mb-1.5">
          플레이스 탭 노출 준비도
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {checkItems.map((item) => (
            <CheckItem
              key={item.action}
              checked={item.checked}
              action={item.action}
              effect={item.effect}
            />
          ))}
        </div>
      </div>

      {/* 블로그 언급 섹션 */}
      <div className="mt-3 pt-3 border-t border-emerald-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-800">
            📝 블로그 언급 {blogMentionCount}건
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600 font-bold">→</span>
            <span
              className={`text-sm px-2 py-0.5 rounded-full whitespace-nowrap ${blogBadge.color}`}
            >
              {blogBadge.label}
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-3">
        <a
          href="/guide"
          className="inline-block text-sm font-medium text-emerald-700 hover:text-emerald-900 underline"
        >
          플레이스 최적화 가이드 보기 →
        </a>
      </div>

      {/* 면책 문구 */}
      <p className="text-sm text-gray-400 mt-2">
        ※ 네이버 검색 순위는 기기·지역·로그인 상태에 따라 다를 수 있으며, 본
        서비스의 측정은 참고용입니다.
      </p>
    </div>
  );
}
