"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import Link from "next/link";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface OnboardingStep {
  key?: string;
  id?: string;
  label: string;
  done: boolean;
  href?: string;
  link?: string;
}

interface OnboardingStatus {
  show: boolean;
  steps: OnboardingStep[];
}

const DEFAULT_STEPS: Omit<OnboardingStep, "done">[] = [
  { key: "business_registered", label: "내 가게 등록하기",       href: "/onboarding" },
  { key: "first_scan_done",     label: "첫 AI 스캔 실행하기",    href: "/dashboard" },
  { key: "competitor_added",    label: "경쟁사 1곳 이상 등록",   href: "/competitors" },
  { key: "guide_checked",       label: "개선 가이드 확인하기",   href: "/guide" },
  { key: "schema_generated",    label: "AI 검색 등록 완료하기",  href: "/schema" },
];

interface Props {
  userId: string;
  token: string; // 서버 컴포넌트에서 전달받은 accessToken
}

export function OnboardingProgressBar({ userId, token }: Props) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`onboarding_dismissed_${userId}`) === "true";
  });

  useEffect(() => {
    if (dismissed) return;

    if (!token) return;

    async function load() {
      const LS_KEY = `aeolab_onboarding_progress_${userId}`;
      try {
        const res = await fetch(`${BACKEND}/api/settings/onboarding-status`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (res.ok) {
          const data: OnboardingStatus = await res.json();
          setStatus(data);
          try {
            localStorage.setItem(LS_KEY, JSON.stringify(data));
          } catch {
            // localStorage 쓰기 실패 무시
          }
        } else {
          // API 실패 시 캐시 사용
          const cached = localStorage.getItem(LS_KEY);
          if (cached) {
            setStatus(JSON.parse(cached) as OnboardingStatus);
          }
        }
      } catch {
        // 네트워크 오류 시 캐시 사용
        try {
          const LS_KEY2 = `aeolab_onboarding_progress_${userId}`;
          const cached = localStorage.getItem(LS_KEY2);
          if (cached) {
            setStatus(JSON.parse(cached) as OnboardingStatus);
          }
        } catch {
          // 캐시도 실패하면 조용히 종료
        }
      }
    }

    load();
  }, [userId, token, dismissed]);

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(`onboarding_dismissed_${userId}`, "true");
  }

  if (dismissed) return null;
  if (!status) return null;
  if (!status.show) return null;

  const steps = status.steps ?? DEFAULT_STEPS.map((s) => ({ ...s, done: false }));
  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;

  if (allDone) return null;

  const progressPct = Math.round((doneCount / total) * 100);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5 mb-5 relative">
      {/* 닫기 버튼 */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 transition-colors p-1 rounded-lg hover:bg-blue-100"
        aria-label="닫기"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 제목 + 진행 바 */}
      <div className="mb-4 pr-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
          <h3 className="text-base font-bold text-blue-900">
            시작 가이드
            <span className="ml-2 text-sm font-normal text-blue-500">
              (완료 시 온보딩 배지 획득)
            </span>
          </h3>
          <span className="text-sm font-semibold text-blue-700">
            {doneCount} / {total} 완료
          </span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 체크리스트 */}
      <ul className="space-y-2">
        {steps.map((step) => {
          const stepKey = step.key ?? step.id ?? step.label;
          const stepHref = step.href ?? step.link ?? "/dashboard";
          return (
          <li key={stepKey}>
            {step.done ? (
              <div className="flex items-center gap-2.5 text-sm text-gray-400">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <span className="line-through">{step.label}</span>
              </div>
            ) : (
              <Link
                href={stepHref}
                className="flex items-center gap-2.5 text-sm text-blue-700 font-medium hover:text-blue-900 transition-colors group"
              >
                <Circle className="w-5 h-5 text-blue-300 shrink-0 group-hover:text-blue-500 transition-colors" />
                <span className="group-hover:underline">{step.label}</span>
              </Link>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}
