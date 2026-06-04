import { IntroGeneratorCard } from "@/components/dashboard/IntroGeneratorCard";
import { TalktalkFAQGeneratorCard } from "@/components/dashboard/TalktalkFAQGeneratorCard";

interface ChatMenuItem {
  question: string;
  answer: string;
  category: string;
}

interface TalktalkDraft {
  items: ChatMenuItem[];
  chat_menus: string[];
}

interface Props {
  bizId: string;
  planLabel: string;
  planFaqLimit: number;
  naver_intro_draft?: string;
  naver_intro_generated_at?: string;
  talktalk_faq_draft?: TalktalkDraft | null;
  talktalk_faq_generated_at?: string;
}

export default function DashboardGeneratorZone({
  bizId,
  planLabel,
  planFaqLimit,
  naver_intro_draft,
  naver_intro_generated_at,
  talktalk_faq_draft,
  talktalk_faq_generated_at,
}: Props) {
  return (
    <>
      <IntroGeneratorCard
        bizId={bizId}
        currentIntro={naver_intro_draft}
        currentLength={naver_intro_draft?.length ?? 0}
        generatedAt={naver_intro_generated_at}
        planLabel={planLabel}
        planMonthlyLimit={planFaqLimit}
      />
      <TalktalkFAQGeneratorCard
        bizId={bizId}
        initialDraft={talktalk_faq_draft ?? null}
        generatedAt={talktalk_faq_generated_at}
        planLabel={planLabel}
        planMonthlyLimit={planFaqLimit}
      />
    </>
  );
}
