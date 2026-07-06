"use client";

import Link from "next/link";
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
  plan: string;
  planLabel: string;
  planFaqLimit: number;
  naverIntroDraft?: string;
  naverIntroGeneratedAt?: string;
  talktalkFaqDraft?: TalktalkDraft | null;
  talktalkFaqGeneratedAt?: string;
}

function SubLabel({ icon, label, borderClass }: { icon: string; label: string; borderClass: string }) {
  return (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${borderClass}`}>
      <span className="text-base" aria-hidden="true">{icon}</span>
      <span className="text-sm font-bold text-gray-700">{label}</span>
    </div>
  );
}

export default function DashboardContentZone({
  bizId,
  plan,
  planLabel,
  planFaqLimit,
  naverIntroDraft,
  naverIntroGeneratedAt,
  talktalkFaqDraft,
  talktalkFaqGeneratedAt,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Free 사용자 업그레이드 프리뷰 */}
      {plan === "free" && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">AI가 내 가게 맞춤 소개글·채팅 메뉴를 대신 써줍니다</p>
              <p className="text-sm text-gray-500 mt-1 leading-snug">
                스마트플레이스 소개글·톡톡 채팅방 메뉴를 AI가 초안 작성 →<br />
                직접 수정·복사해서 바로 등록
              </p>
              <p className="text-sm text-purple-700 font-semibold mt-1.5">Basic 구독 시 월 10회 생성 가능</p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 px-3.5 py-2 rounded-lg leading-none"
            >
              구독하기
            </Link>
          </div>
        </div>
      )}

      {/* 네이버 소개글 생성 */}
      <div id="naver-intro-anchor">
        <SubLabel icon="📝" label="네이버 소개글 생성" borderClass="border-blue-300" />
        <IntroGeneratorCard
          bizId={bizId}
          currentIntro={naverIntroDraft}
          currentLength={naverIntroDraft?.length ?? 0}
          generatedAt={naverIntroGeneratedAt}
          planLabel={planLabel}
          planMonthlyLimit={planFaqLimit}
          onlyType="naver"
        />
      </div>

      {/* 톡톡 채팅방 메뉴 초안 */}
      <div id="naver-talktalk-anchor">
        <SubLabel icon="💬" label="톡톡 채팅방 메뉴 초안" borderClass="border-purple-300" />
        <TalktalkFAQGeneratorCard
          bizId={bizId}
          initialDraft={talktalkFaqDraft ?? null}
          generatedAt={talktalkFaqGeneratedAt}
          planLabel={planLabel}
          planMonthlyLimit={planFaqLimit}
        />
      </div>
    </div>
  );
}
