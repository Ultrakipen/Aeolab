import GlobalAiFocusCard from "@/components/dashboard/GlobalAiFocusCard";
import SchemaCheckCard from "@/components/dashboard/SchemaCheckCard";
import { IntroGeneratorCard } from "@/components/dashboard/IntroGeneratorCard";
import { CATEGORY_LABEL } from "@/lib/categories";
import type { WebsiteCheckResult } from "@/types";

interface Props {
  category: string;
  plan: string;
  schemaSeoScore: number | null;
  websiteUrl?: string | null;
  websiteCheckResult?: WebsiteCheckResult | null;
  globalWeight?: number;
  googlePlaceRegistered?: boolean;
  /* F항목: 글로벌 소개글 생성기 */
  bizId?: string;
  planLabel?: string;
  planFaqLimit?: number;
  globalIntroDraft?: string;
  globalIntroGeneratedAt?: string;
  /* 실측 노출 현황 */
  chatgptFreq?: number;
  chatgptSampleSize?: number;
  geminiFreq?: number;
  geminiSampleSize?: number;
  googleMentioned?: boolean | null;
  googleError?: boolean;
}

export default function DashboardGlobalAiZone({
  category,
  plan,
  schemaSeoScore,
  websiteUrl,
  websiteCheckResult,
  globalWeight,
  googlePlaceRegistered,
  bizId,
  planLabel,
  planFaqLimit,
  globalIntroDraft,
  globalIntroGeneratedAt,
  chatgptFreq,
  chatgptSampleSize,
  geminiFreq,
  geminiSampleSize,
  googleMentioned,
  googleError,
}: Props) {
  const hasAnyData = chatgptFreq !== undefined || geminiFreq !== undefined || (googleMentioned !== undefined && googleMentioned !== null && !googleError);

  return (
    <div className="space-y-4">

      {/* 실측 노출 현황 요약 — 스캔 결과가 있을 때만 표시 */}
      {hasAnyData && (
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-sm font-bold text-blue-800 mb-3">글로벌 AI 실측 노출 현황</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {/* ChatGPT */}
            <div className="bg-white rounded-lg border border-blue-100 p-3 text-center">
              <p className="text-sm text-gray-600 mb-1 font-medium">ChatGPT</p>
              {chatgptFreq !== undefined ? (
                <>
                  <p className={`text-sm font-bold leading-tight ${chatgptFreq > 0 ? "text-blue-700" : "text-gray-600"}`}>
                    {chatgptFreq > 0 ? `${chatgptFreq}회 언급` : "미언급"}
                  </p>
                  {chatgptSampleSize != null && chatgptSampleSize > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">{chatgptSampleSize}회 중</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600">–</p>
              )}
            </div>
            {/* Gemini */}
            <div className="bg-white rounded-lg border border-blue-100 p-3 text-center">
              <p className="text-sm text-gray-600 mb-1 font-medium">Gemini</p>
              {geminiFreq !== undefined ? (
                <>
                  <p className={`text-sm font-bold leading-tight ${geminiFreq > 0 ? "text-blue-700" : "text-gray-600"}`}>
                    {geminiFreq > 0 ? `${geminiFreq}회 언급` : "미언급"}
                  </p>
                  {geminiSampleSize != null && geminiSampleSize > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">{geminiSampleSize}회 중</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-600">–</p>
              )}
            </div>
            {/* Google AI */}
            <div className="bg-white rounded-lg border border-blue-100 p-3 text-center">
              <p className="text-sm text-gray-600 mb-1 font-medium">Google AI</p>
              {!googleError && googleMentioned !== undefined && googleMentioned !== null ? (
                <p className={`text-sm font-bold leading-tight ${googleMentioned ? "text-blue-700" : "text-gray-600"}`}>
                  {googleMentioned ? "노출 중" : "미확인"}
                </p>
              ) : (
                <p className="text-sm text-gray-600">–</p>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-600 leading-snug">
            ChatGPT·Gemini 스캐너는 모두 학습 데이터 기반 쿼리로 측정합니다.
            개선 반영까지 <span className="font-semibold text-gray-700">수개월~1년</span> 소요됩니다.
          </p>
        </div>
      )}

      {globalWeight !== undefined && globalWeight >= 0.65 && (
        <GlobalAiFocusCard
          globalWeight={globalWeight}
          categoryLabel={CATEGORY_LABEL[category] ?? category}
          category={category}
        />
      )}
      <SchemaCheckCard
        schemaSeoScore={schemaSeoScore}
        websiteUrl={websiteUrl}
        websiteCheckResult={websiteCheckResult}
        plan={plan}
        googlePlaceRegistered={googlePlaceRegistered}
      />
      {/* F. ChatGPT·Gemini 소개글 생성기 */}
      {bizId && (
        <IntroGeneratorCard
          bizId={bizId}
          globalCurrentIntro={globalIntroDraft}
          globalGeneratedAt={globalIntroGeneratedAt}
          planLabel={planLabel ?? "Free"}
          planMonthlyLimit={planFaqLimit ?? 0}
          onlyType="global"
        />
      )}
    </div>
  );
}
