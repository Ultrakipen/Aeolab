"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
  const hasDraft = !!(naver_intro_draft || talktalk_faq_draft);
  const [isOpen, setIsOpen] = useState(hasDraft);

  return (
    <div id="section-generator" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-800">✏️ 소개글·FAQ 자동 생성</span>
          {hasDraft && (
            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
              생성 완료
            </span>
          )}
          {!hasDraft && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
              AI가 초안 작성
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
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
        </div>
      )}
    </div>
  );
}
