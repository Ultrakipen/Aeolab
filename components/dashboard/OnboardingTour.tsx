"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Step {
  title: string;
  description: string;
  targetAttr: string;
}

const STEPS: Step[] = [
  {
    title: "내 사업장 등록하기",
    description:
      "사업장 이름과 업종을 등록하면 AI 검색 노출 분석이 바로 시작됩니다. '내 가게 등록하고 시작하기' 버튼을 누르거나 사이드바의 메뉴를 이용하세요.",
    targetAttr: "register-business",
  },
  {
    title: "AI 스캔 실행하기",
    description:
      "상단의 'AI 스캔 시작' 버튼을 누르면 네이버·ChatGPT·Gemini·Google AI 4개 채널에서 내 가게 노출 여부를 약 2분 안에 확인합니다.",
    targetAttr: "scan-button",
  },
  {
    title: "경쟁사 추가하기",
    description:
      "경쟁 사업장을 등록하면 AI 노출 점수를 비교하고, 경쟁사만 쓰는 키워드를 발굴할 수 있습니다. 사이드바에서 '경쟁사 관리' 메뉴를 눌러보세요.",
    targetAttr: "competitors-menu",
  },
  {
    title: "완료! 이제 점수를 확인하세요",
    description:
      "기본 설정이 완료됐습니다. 대시보드에서 AI 노출 점수와 개선 가이드를 확인하고 꾸준히 최적화해 보세요.",
    targetAttr: "",
  },
];

const LS_KEY = "aeolab_onboarding_done_v1";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  userId: string;
  initialOnboardingDone: boolean;
  initialStep?: number;
}

export default function OnboardingTour({ userId, initialOnboardingDone, initialStep = 0 }: Props) {
  const [stepIndex, setStepIndex] = useState(initialStep);
  const [visible, setVisible] = useState(false);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // localStorage + DB 양쪽으로 dismissal 여부 확인
  useEffect(() => {
    if (initialOnboardingDone) return;
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored && stored.includes(userId)) return; // 이미 완료
    } catch {
      // 시크릿 모드 등 localStorage 접근 불가 — DB 결과만 사용
    }
    setVisible(true);
  }, [initialOnboardingDone, userId]);

  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (!visible) return;
    if (!currentStep.targetAttr) {
      setHighlightRect(null);
      setTooltipPos(null);
      return;
    }

    const el = document.querySelector(
      `[data-onboarding-tour="${currentStep.targetAttr}"]`
    ) as HTMLElement | null;

    if (el) {
      const rect = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      setHighlightRect({
        top: rect.top + scrollY - 8,
        left: rect.left + scrollX - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
      const spaceBelow = window.innerHeight - rect.bottom;
      const tooltipHeight = 220;
      const tipTop =
        spaceBelow > tooltipHeight
          ? rect.bottom + scrollY + 16
          : rect.top + scrollY - tooltipHeight - 16;
      const tipLeft = Math.min(
        Math.max(rect.left + scrollX, 8),
        window.innerWidth - 332
      );
      setTooltipPos({ top: tipTop, left: tipLeft });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setHighlightRect(null);
      setTooltipPos(null);
    }
  }, [visible, stepIndex, currentStep.targetAttr]);

  const markDone = () => {
    // localStorage에 먼저 저장 — DB 실패해도 재표시 방지
    try {
      localStorage.setItem(LS_KEY, userId);
    } catch {
      // 무시
    }
    // DB는 best-effort (void로 캐스트 — PromiseLike catch 타입 이슈 우회)
    const supabase = createClient();
    void supabase
      .from("profiles")
      .upsert({ id: userId, onboarding_done: true }, { onConflict: "id" });
  };

  const handleNext = () => {
    if (isLastStep) {
      setVisible(false);
      markDone();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    markDone();
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/60"
        aria-hidden="true"
        style={{ pointerEvents: "all" }}
      />

      {highlightRect && (
        <div
          className="fixed z-[9999] rounded-2xl ring-4 ring-blue-400 ring-offset-2 bg-transparent pointer-events-none"
          style={{
            top: highlightRect.top - window.scrollY,
            left: highlightRect.left - window.scrollX,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.60)",
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="fixed z-[10000] w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5"
        style={
          tooltipPos
            ? {
                top: tooltipPos.top - window.scrollY,
                left: tooltipPos.left,
              }
            : {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
        }
      >
        <div className="flex items-center gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? "w-6 bg-blue-600"
                  : i < stepIndex
                  ? "w-3 bg-blue-300"
                  : "w-3 bg-gray-200"
              }`}
            />
          ))}
          <span className="ml-auto text-sm text-gray-400 shrink-0">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>

        <h3 className="text-base font-bold text-gray-900 mb-2">{currentStep.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-5">{currentStep.description}</p>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSkip}
            className="flex-shrink-0 text-sm text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
          >
            건너뛰기
          </button>
          <div className="flex-1" />
          <button
            onClick={handleNext}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            {isLastStep ? "완료" : "다음"}
          </button>
        </div>
      </div>

      <style>{`
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          [data-onboarding-tooltip] {
            padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </>
  );
}
