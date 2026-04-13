"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Circle, X } from "lucide-react";
import Link from "next/link";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
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
}

export function OnboardingProgressBar({ userId }: Props) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // localStorage 기반 닫기 상태 복원
    const key = `onboarding_dismissed_${userId}`;
    if (localStorage.getItem(key) === "true") {
      setDismissed(true);
      return;
    }

    async function load() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`${BACKEND}/api/settings/onboarding-status`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (res.ok) {
          const data: OnboardingStatus = await res.json();
          setStatus(data);
        } else {
          // API 없을 경우 Supabase에서 직접 체크
          const supabase = createClient();
          const [
            { data: businesses },
            { data: scans },
            { data: competitors },
            { data: guides },
            { data: schemas },
          ] = await Promise.all([
            supabase.from("businesses").select("id").eq("user_id", userId).limit(1),
            supabase.from("scan_results")
              .select("id")
              .in("business_id",
                (await supabase.from("businesses").select("id").eq("user_id", userId)).data?.map((b: { id: string }) => b.id) ?? []
              ).limit(1),
            supabase.from("competitors")
              .select("id")
              .in("business_id",
                (await supabase.from("businesses").select("id").eq("user_id", userId)).data?.map((b: { id: string }) => b.id) ?? []
              ).limit(1),
            supabase.from("guides")
              .select("id")
              .in("business_id",
                (await supabase.from("businesses").select("id").eq("user_id", userId)).data?.map((b: { id: string }) => b.id) ?? []
              ).limit(1),
            Promise.resolve({ data: null }),
          ]);

          const stepsDone: Record<string, boolean> = {
            business_registered: (businesses?.length ?? 0) > 0,
            first_scan_done:     (scans?.length ?? 0) > 0,
            competitor_added:    (competitors?.length ?? 0) > 0,
            guide_checked:       (guides?.length ?? 0) > 0,
            schema_generated:    false,
          };
          void schemas;

          const steps: OnboardingStep[] = DEFAULT_STEPS.map((s) => ({
            ...s,
            done: stepsDone[s.key] ?? false,
          }));

          const allDone = steps.every((s) => s.done);
          setStatus({ show: !allDone, steps });
        }
      } catch {
        // 조용히 실패
      }
    }

    load();
  }, [userId]);

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
              (7일 이내 완료 시 Pro 1주일 무료 연장)
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
        {steps.map((step) => (
          <li key={step.key}>
            {step.done ? (
              <div className="flex items-center gap-2.5 text-sm text-gray-400">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <span className="line-through">{step.label}</span>
              </div>
            ) : (
              <Link
                href={step.href}
                className="flex items-center gap-2.5 text-sm text-blue-700 font-medium hover:text-blue-900 transition-colors group"
              >
                <Circle className="w-5 h-5 text-blue-300 shrink-0 group-hover:text-blue-500 transition-colors" />
                <span className="group-hover:underline">{step.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
