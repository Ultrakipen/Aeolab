import PhotoConfirmButton from "./PhotoConfirmButton";
import RecentPostConfirmButton from "./RecentPostConfirmButton";

interface NaverSeoBaseCardProps {
  reviewCount: number;
  hasIntro: boolean;
  hasRecentPost: boolean | null;
  hasReservation: boolean | null;
  photoCount: number | null;
  blogMentionCount: number;
  eligibility: "active" | "likely" | "inactive";
  naverPlaceId?: string | null;
  /** checklist_overrides.__photo_sufficient — 사진 탭 차단 시 사용자 직접 확인값 */
  photoSufficient?: boolean;
  bizId?: string;
  accessToken?: string;
  /** checklist_overrides.__recent_post_confirmed_at — 소식 탭 수동 확인 일시 */
  recentPostConfirmedAt?: string | null;
}

interface CheckItemProps {
  checked: boolean | null; // null = 미측정
  action: string;
  effect: string;
}

function CheckItem({ checked, action, effect }: CheckItemProps) {
  // Hero 진단 카드와 동일한 신호등 언어 — 미완료는 빨강 ✗ 대신 amber ! (불안 유발 차단)
  const statusIcon =
    checked === null
      ? { glyph: "–", cls: "bg-gray-200 text-gray-600" }
      : checked
      ? { glyph: "✓", cls: "bg-emerald-700 text-white" }
      : { glyph: "!", cls: "bg-amber-700 text-white" };
  const badgeColor =
    checked === null
      ? "bg-gray-100 text-gray-600"
      : checked
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="flex items-center justify-between rounded-lg bg-white border border-emerald-100 px-3 py-2 gap-2">
      <span className="text-sm text-gray-800 flex items-center gap-1.5 min-w-0">
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${statusIcon.cls}`}>
          {statusIcon.glyph}
        </span>
        <span className="min-w-0">{action}</span>
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
  naverPlaceId,
  photoSufficient,
  bizId,
  accessToken,
  recentPostConfirmedAt,
}: NaverSeoBaseCardProps) {
  const isActiveOrLikely = eligibility === "active" || eligibility === "likely";

  // photoSufficient가 true면 사진 충분 처리 (자동 측정 불가 대체)
  const effectivePhotoCount = photoSufficient ? 10 : photoCount;

  const recentPostEffect = "AI탭 ↑";

  const checkItems: CheckItemProps[] = [
    {
      checked: hasIntro,
      action: "소개글 작성",
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
      checked: effectivePhotoCount === null ? null : effectivePhotoCount >= 10,
      action:
        effectivePhotoCount === null
          ? "사진 10장+ (직접 확인)"
          : effectivePhotoCount < 10
          ? `사진 ${effectivePhotoCount}장 (10장 목표)`
          : `사진 ${effectivePhotoCount}장`,
      effect: "플레이스탭·AI탭 ↑",
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
    ? "네이버는 스마트플레이스 완성도·리뷰를 기반으로 검색 순위와 AI 브리핑·AI탭 노출을 결정합니다"
    : "네이버는 스마트플레이스 완성도·리뷰를 기반으로 검색 순위와 AI탭 노출을 결정합니다";

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
        <p className="text-sm font-medium text-gray-600 mb-1.5">
          플레이스 탭 노출 준비도
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {checkItems.map((item) => {
            // 사진 항목이 null(측정 불가)이면 PhotoConfirmButton으로 대체
            if (item.action.startsWith("사진") && item.checked === null) {
              if (bizId && accessToken) {
                return (
                  <PhotoConfirmButton
                    key="photo-confirm"
                    bizId={bizId}
                    accessToken={accessToken}
                    naverPlaceId={naverPlaceId}
                    effect={item.effect}
                    alreadyConfirmed={false}
                  />
                );
              }
              // accessToken 없음(비로그인 등) — 링크만 표시
              const photoUrl = naverPlaceId
                ? `https://m.place.naver.com/place/${naverPlaceId}/photo`
                : "https://smartplace.naver.com/";
              return (
                <a
                  key={item.action}
                  href={photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 gap-2 hover:bg-amber-100 transition-colors"
                >
                  <span className="text-sm text-amber-800">
                    📸 사진 탭 직접 확인 →
                  </span>
                  <span className="text-sm px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap bg-amber-100 text-amber-700">
                    {item.effect}
                  </span>
                </a>
              );
            }
            return (
              <CheckItem
                key={item.action}
                checked={item.checked}
                action={item.action}
                effect={item.effect}
              />
            );
          })}

          {/* 소식 항목 — null(IP 차단 측정 불가)이면 수동 확인 버튼 표시 */}
          {hasRecentPost === null ? (
            bizId && accessToken ? (
              <RecentPostConfirmButton
                key="recent-post-confirm"
                bizId={bizId}
                accessToken={accessToken}
                naverPlaceId={naverPlaceId}
                effect={recentPostEffect}
                alreadyConfirmed={false}
                confirmedAt={recentPostConfirmedAt}
              />
            ) : (
              <a
                key="recent-post-link"
                href={naverPlaceId ? `https://m.place.naver.com/place/${naverPlaceId}/feed` : "https://smartplace.naver.com/"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 gap-2 hover:bg-amber-100 transition-colors"
              >
                <span className="text-sm text-amber-800">📢 소식 탭 직접 확인 →</span>
                <span className="text-sm px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap bg-amber-100 text-amber-700">
                  {recentPostEffect}
                </span>
              </a>
            )
          ) : (
            <CheckItem
              key="recent-post"
              checked={hasRecentPost}
              action="90일 이내 소식 게시"
              effect={recentPostEffect}
            />
          )}
        </div>
      </div>

      {/* 블로그 언급 섹션 */}
      <div className="mt-3 pt-3 border-t border-emerald-200">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm text-gray-800">📝 블로그 후기 언급 {blogMentionCount}건</span>
            <p className="text-xs text-gray-600 mt-0.5 leading-snug">네이버 AI탭은 블로그 후기를 답변 소스로 활용합니다</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-emerald-700 font-bold">→</span>
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
      <p className="text-sm text-gray-600 mt-2">
        ※ 네이버 검색 순위는 기기·지역·로그인 상태에 따라 다를 수 있으며, 본
        서비스의 측정은 참고용입니다.
      </p>
    </div>
  );
}
