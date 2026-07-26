import Link from "next/link";
import { Search, RefreshCw, Share2, CheckCircle2 } from "lucide-react";
import BusinessQuickEditButton from "../BusinessQuickEditButton";
import { BusinessTabLink } from "@/components/dashboard/BusinessTabLink";
import { RescanBanner } from "../RescanBanner";
import { NewCompetitorAlert } from "@/components/dashboard/NewCompetitorAlert";
import { OnboardingProgressBar } from "@/components/dashboard/OnboardingProgressBar";
import OnboardingTour from "@/components/dashboard/OnboardingTour";
import VisitDeltaBanner from "@/components/dashboard/VisitDeltaBanner";
import TrialAttachTracker from "@/components/dashboard/TrialAttachTracker";
import { CATEGORY_LABEL } from "@/lib/categories";

const PLAN_BIZ_LIMITS: Record<string, number> = { free: 1, basic: 1, startup: 1, pro: 2, biz: 5 };

interface BusinessShape {
  id: string;
  name: string;
  category: string;
  region: string;
  website_url?: string | null;
  keywords?: string[];
  has_faq?: boolean | null;
  has_intro?: boolean | null;
  has_recent_post?: boolean | null;
  visitor_review_count?: number;
  receipt_review_count?: number;
  avg_rating?: number;
  naver_place_id?: string | null;
  naver_place_url?: string | null;
}

interface Props {
  user: { id: string };
  businesses: BusinessShape[] | null;
  business: BusinessShape | null;
  plan: string;
  isAdmin: boolean;
  onboardingDone: boolean;
  briefingEligibility: "active" | "likely" | "inactive";
  accessToken: string;
  scanInfo: { label: string; desc: string };
  lastScannedLabel: string | null;
  scanUsed: number;
  scanLimit: number;
  showRescanNotice: boolean;
  rescanIsStale?: boolean;
  lastQueryUsed?: string;
  displayCity: string;
}

export default function DashboardHeader({
  user,
  businesses,
  business,
  plan,
  isAdmin,
  onboardingDone,
  briefingEligibility,
  accessToken,
  scanInfo,
  lastScannedLabel,
  showRescanNotice,
  rescanIsStale = false,
  displayCity,
}: Props) {
  const planBadgeClass = isAdmin
    ? "bg-slate-100 text-slate-600"
    : plan === "biz"
    ? "bg-purple-100 text-purple-700"
    : plan === "pro"
    ? "bg-blue-100 text-blue-700"
    : plan === "startup"
    ? "bg-green-100 text-green-700"
    : plan === "basic"
    ? "bg-gray-100 text-gray-600"
    : "bg-gray-50 text-gray-500";

  const planBadgeText = isAdmin
    ? "관리자"
    : plan === "biz"
    ? "Biz"
    : plan === "pro"
    ? "Pro"
    : plan === "startup"
    ? "창업패키지"
    : plan === "basic"
    ? "Basic"
    : "무료";

  return (
    <>
      {/* Trial → 가입 연결 GA4 트래커 */}
      <TrialAttachTracker />

      {/* 온보딩 투어 — onboarding_done=false 신규 사용자에게만 표시 */}
      {!onboardingDone && (
        <OnboardingTour
          userId={user.id}
          initialOnboardingDone={false}
          initialStep={business ? 1 : 0}
        />
      )}

      {/* 사업장 탭 */}
      {businesses && (businesses.length > 1 || businesses.length < (PLAN_BIZ_LIMITS[plan] ?? 1)) && (
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2 mb-3">
          {businesses.map((b) => (
            <BusinessTabLink
              key={b.id}
              href={`/dashboard?biz_id=${b.id}`}
              bizId={b.id}
              active={b.id === business?.id}
            >
              {b.name}
            </BusinessTabLink>
          ))}
          {(() => {
            const limit = PLAN_BIZ_LIMITS[plan] ?? 1;
            return businesses.length < limit ? (
              <a
                href="/onboarding"
                className="px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1"
                title={`사업장을 ${limit}개까지 등록할 수 있습니다`}
              >
                <span className="text-base leading-none">+</span> 사업장 추가
              </a>
            ) : null;
          })()}
        </div>
      )}

      {/* 방금 스캔 요청(2~3분 소요) 안내만 전체폭 배너로. 7일 경과(stale) 권유는 진단 카드 안 배지로 흡수 */}
      {showRescanNotice && !rescanIsStale && <RescanBanner stale={false} />}

      {/* 재방문 변화 요약 배너 */}
      {business?.id && <VisitDeltaBanner bizId={business.id} />}

      {/* 사업장 미등록 */}
      {!business && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 md:p-10 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-blue-900 mb-3">
                내 가게를 등록하고 AI 검색 분석을 시작하세요
              </h2>
              <p className="text-blue-700 text-base md:text-lg mb-4">
                가게 이름과 업종만 입력하면 AI 검색 노출 현황을 즉시 확인할 수 있습니다.
              </p>
              <ul className="space-y-2 text-base text-blue-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> 네이버·ChatGPT·Google AI 노출 현황 분석
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> 경쟁 사업장과 비교
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> AI 브리핑 노출 현황 진단 및 개선 방향 제시
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <a
                href="/onboarding"
                data-onboarding-tour="register-business"
                className="inline-flex items-center justify-center w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-lg transition-colors"
              >
                내 가게 등록하고 시작하기
              </a>
              <p className="text-sm text-blue-500 text-center">무료로 시작 · 1분 소요</p>
            </div>
          </div>
        </div>
      )}

      {/* 사업장 등록 이후 */}
      {business && (
        <>
          <OnboardingProgressBar userId={user.id} token={accessToken} />

          {/* 헤더: 가게명 + 수정/공유 버튼 */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep">{business.name}</h1>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${planBadgeClass}`}>
                  {planBadgeText}
                </span>
              </div>
              {/* 메타 1줄 압축 — 위치·업종·브리핑 자격·자동스캔 정보를 한 행에 (진단 카드 위로 끌어올리기) */}
              <div className="mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap">
                <p className="text-sm text-gray-500 break-keep">
                  {displayCity} · {CATEGORY_LABEL[business.category] ?? business.category}
                </p>
                {briefingEligibility === "active" ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
                    ✓ AI 브리핑 대상 업종
                  </span>
                ) : briefingEligibility === "likely" ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 whitespace-nowrap">
                    △ AI 브리핑 확대 예정
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
                    ChatGPT·Gemini 노출 가능 업종
                  </span>
                )}
                <span className="text-sm text-gray-500 items-center gap-1 hidden sm:inline-flex">
                  <RefreshCw className="w-3 h-3 shrink-0" />
                  <span className="break-keep">{scanInfo.label}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <BusinessQuickEditButton
                bizId={business.id}
                bizName={business.name}
                authToken={accessToken}
                initialData={{
                  keywords: business.keywords ?? [],
                  has_faq: business.has_faq ?? false,
                  has_intro: business.has_intro ?? false,
                  has_recent_post: business.has_recent_post ?? false,
                  visitor_review_count: business.visitor_review_count ?? 0,
                  receipt_review_count: business.receipt_review_count ?? 0,
                  avg_rating: business.avg_rating ?? 0,
                  naver_place_id: business.naver_place_id ?? "",
                  naver_place_url: business.naver_place_url ?? "",
                }}
              />
              <a
                href={`/share/${business.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-2 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" /> 공유
              </a>
            </div>
          </div>

          {/* 스캔 섹션·반영 안내는 page.tsx의 진단 2단 레이아웃(우측 컬럼)으로 이동 */}

          {/* 키워드 미등록 안내 */}
          {!business.keywords?.length && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 flex items-start gap-1.5">
                  <Search className="w-4 h-4 shrink-0 mt-0.5" />
                  키워드를 등록하면 실제 검색어로 AI 노출 여부를 확인할 수 있습니다
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  현재는 업종 전체 검색어로만 확인됩니다
                </p>
              </div>
              <a
                href="/settings?tab=business"
                className="shrink-0 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                키워드 추가하기 →
              </a>
            </div>
          )}

          <NewCompetitorAlert businessId={business.id} />
        </>
      )}
    </>
  );
}
