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
}: Props) {
  return (
    <div className="space-y-4">
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
