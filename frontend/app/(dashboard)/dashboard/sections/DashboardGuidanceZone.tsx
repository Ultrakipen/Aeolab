"use client";

import UpgradeNudgeCard from "@/components/dashboard/UpgradeNudgeCard";
import InactiveUserBanner from "@/components/dashboard/InactiveUserBanner";
import { ContextTipBanner } from "@/components/dashboard/ContextTipBanner";
import SeasonalKeywordBanner from "@/components/dashboard/SeasonalKeywordBanner";

interface Props {
  bizId: string;
  eligibility: "active" | "likely" | "inactive";
  plan: string;
  hasLatestScan: boolean;
  isCompetitorEstimated?: boolean;
  userCreatedAt?: string | null;
  category?: string;
}

export default function DashboardGuidanceZone({
  bizId,
  eligibility,
  plan,
  hasLatestScan,
  isCompetitorEstimated,
  userCreatedAt,
  category,
}: Props) {
  const isInactive = eligibility === "inactive";
  const isLikely = eligibility === "likely";

  const guideHref = isInactive
    ? "/guide/chatgpt-search"
    : isLikely
    ? `/guide/ai-tab?biz_id=${bizId}`
    : `/guide/ai-info-tab?biz_id=${bizId}`;
  const guideLabel = isInactive
    ? "ChatGPT·Gemini 가이드 보기 →"
    : isLikely
    ? "AI탭 가이드 열기 →"
    : "5단계 가이드 열기 →";
  const guideTitle = isInactive
    ? "ChatGPT·Gemini·Google AI 노출 가이드"
    : "네이버 AI 검색 노출 5단계 가이드";
  const guideDesc = isInactive
    ? "Gemini는 Google 검색 실시간 연동으로 수 주~수개월 소요됩니다. ChatGPT는 학습 데이터 기반으로 수개월~1년 소요됩니다. 구글 비즈니스 프로필 등록부터 시작하세요."
    : "AI 브리핑·AI탭 대응 체크리스트로 직접 설정하세요 (15분). 개선 시작 후 2~4주 내 변화가 나타납니다.";
  const colorBorder = isInactive ? "border-purple-200 bg-purple-50" : "border-blue-200 bg-blue-50";
  const colorMain = isInactive ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700";
  const colorOutline = isInactive
    ? "border-purple-600 text-purple-600 hover:bg-purple-100"
    : "border-blue-600 text-blue-600 hover:bg-blue-100";

  return (
    <div className="space-y-4 border-t border-gray-100 pt-6">
      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide">안내 및 가이드</p>

      {/* 시즌 키워드 배너 */}
      {category && <SeasonalKeywordBanner category={category} />}

      {/* 맞춤 팁 배너 (백엔드 API, 닫기 가능) */}
      {category && <ContextTipBanner section="score" industry={category} />}

      {/* 무료 플랜 업그레이드 유도 */}
      <UpgradeNudgeCard plan={plan} hasLatestScan={hasLatestScan} />

      {/* INACTIVE 업종 가입자 첫 7일 안내 */}
      {isInactive && userCreatedAt && (
        <InactiveUserBanner userCreatedAt={userCreatedAt} />
      )}

      {/* 경쟁사 추정값 안내 */}
      {isCompetitorEstimated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
          <strong>개선 우선순위는 업종 평균 추정값 기반입니다.</strong> 경쟁사를 등록하면 실측 데이터로 정확도가 높아집니다.
        </div>
      )}

      {/* 채널별 맞춤 가이드 링크 */}
      <div className={`rounded-lg border p-4 ${colorBorder}`}>
        <p className="text-sm text-gray-800 mb-3 leading-relaxed break-keep">
          <strong>{guideTitle}</strong> — {guideDesc}
        </p>
        <div className="flex flex-col md:flex-row gap-2">
          <a
            href={guideHref}
            className={`block w-full md:w-auto text-center px-4 py-2 text-white text-sm rounded font-medium ${colorMain}`}
          >
            {guideLabel}
          </a>
          <a
            href="/how-it-works"
            className={`block w-full md:w-auto text-center px-4 py-2 border text-sm rounded font-medium ${colorOutline}`}
          >
            AEOlab 동작 원리 보기 →
          </a>
        </div>
      </div>

      {/* 면책 문구 */}
      <p className="text-sm text-gray-400 text-center leading-relaxed">
        측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다
      </p>
    </div>
  );
}
