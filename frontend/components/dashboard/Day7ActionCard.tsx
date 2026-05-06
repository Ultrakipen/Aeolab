"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Copy, Loader2, X } from "lucide-react";
import { getSafeSession } from "@/lib/supabase/client";
import { trackOnboardingAction } from "@/lib/analytics";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Day7ActionCardProps {
  bizId: string;
  /**
   * 사용자 계정 생성일 (ISO string).
   * 7일 이내: "first-week" 모드 (기존 카드)
   * 7일 이후: "weekly" 모드 (매주 새 액션 카드)
   */
  userCreatedAt?: string | null;
  /** @deprecated createdAt은 userCreatedAt으로 대체됨. 하위 호환용. */
  createdAt?: string | null | undefined;
}

interface OnboardingActionResponse {
  action_type: string;
  title: string;
  description: string;
  expected_impact?: string | null;
  estimated_time_min?: number | null;
  copy_template?: string | null;
  action_url?: string | null;
  biz_id: string;
  scan_id?: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type CardMode = "first-week" | "weekly";

function getCardMode(userCreatedAt: string | null | undefined, createdAt: string | null | undefined): CardMode {
  const dateStr = userCreatedAt ?? createdAt;
  if (!dateStr) return "first-week";
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return "first-week";
  return Date.now() - t < SEVEN_DAYS_MS ? "first-week" : "weekly";
}

/** 현재 ISO 주차 (YYYY-WW) */
function isoWeek(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = now.getTime() - startOfWeek1.getTime();
  const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${now.getFullYear()}-${String(weekNum).padStart(2, "0")}`;
}

function dismissKey(bizId: string, mode: CardMode): string {
  if (mode === "first-week") return `aeolab_day7_dismissed_${bizId}`;
  return `aeolab_weekly_action_skipped_${bizId}_${isoWeek()}`;
}

/**
 * 가입 7일 액션 카드 (P3 확장)
 *
 * - first-week 모드: 가입 7일 이내 사용자에게 1회용 카드. 완료/건너뛰기 시 영구 숨김
 * - weekly 모드: 가입 7일 이후 매주 1개 액션 카드. 건너뛰기는 해당 주만 숨김
 */
export default function Day7ActionCard({
  bizId,
  userCreatedAt,
  createdAt,
}: Day7ActionCardProps) {
  const mode = getCardMode(userCreatedAt, createdAt);

  const [data, setData] = useState<OnboardingActionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const shownRef = useRef(false);

  // localStorage dismiss 체크
  useEffect(() => {
    try {
      if (localStorage.getItem(dismissKey(bizId, mode)) === "1") {
        setHidden(true);
      }
    } catch {
      /* ignore */
    }
  }, [bizId, mode]);

  // API 호출
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    (async () => {
      try {
        const session = await getSafeSession();
        const token = session?.access_token;
        if (!token) {
          if (!cancelled) {
            setLoading(false);
            setHidden(true);
          }
          return;
        }
        const res = await fetch(
          `${BACKEND}/api/report/onboarding-action/${bizId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          if (!cancelled) {
            setLoading(false);
            setHidden(true);
          }
          return;
        }
        const raw = await res.json();
        if (cancelled) return;
        if (!raw || !raw.action?.title) {
          setHidden(true);
          setLoading(false);
          return;
        }
        const json: OnboardingActionResponse = {
          ...raw.action,
          biz_id: raw.biz_id,
          scan_id: raw.scan_id ?? null,
        };
        setData(json);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setHidden(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bizId, hidden]);

  // shown 이벤트 1회 발송
  useEffect(() => {
    if (!data || shownRef.current) return;
    shownRef.current = true;
    trackOnboardingAction("shown", {
      biz_id: bizId,
      action_type: data.action_type,
    });
  }, [data, bizId]);

  const onCopy = useCallback(async () => {
    if (!data?.copy_template) return;
    try {
      await navigator.clipboard.writeText(data.copy_template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [data]);

  const onComplete = useCallback(async () => {
    if (!data || submitting || completed) return;
    setSubmitting(true);
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      if (!token) {
        setSubmitting(false);
        return;
      }
      await fetch(`${BACKEND}/api/report/action-log/${bizId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action_type: data.action_type,
          action_label: data.title,
        }),
      });
      setCompleted(true);
      trackOnboardingAction("completed", {
        biz_id: bizId,
        action_type: data.action_type,
      });
      // 완료 시 이번 주(또는 영구) dismiss
      try {
        localStorage.setItem(dismissKey(bizId, mode), "1");
      } catch {
        /* ignore */
      }
    } catch {
      /* graceful: 실패해도 UI는 완료로 두지 않음 */
    } finally {
      setSubmitting(false);
    }
  }, [bizId, data, submitting, completed, mode]);

  const onSkip = useCallback(() => {
    if (!data) return;
    trackOnboardingAction("skipped", {
      biz_id: bizId,
      action_type: data.action_type,
    });
    try {
      localStorage.setItem(dismissKey(bizId, mode), "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }, [bizId, data, mode]);

  if (hidden) return null;
  if (loading) return null;
  if (!data) return null;

  // 모드별 뱃지 + 헤더 제목
  const badgeText = mode === "first-week" ? "가입 7일 액션" : "이번 주 추천 액션";
  const headerTitle =
    mode === "first-week"
      ? "가입하신 후 7일 이내 첫 액션을 추천드려요"
      : "이번 주 한 가지만 실행해 보세요";

  const metaInline = [
    data.estimated_time_min != null ? `소요 ${data.estimated_time_min}분` : null,
    data.expected_impact ? `효과 ${data.expected_impact}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section
      aria-labelledby="day7-action-title"
      className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span
          className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-sm font-bold"
        >
          {badgeText}
        </span>
        <button
          type="button"
          onClick={onSkip}
          aria-label="건너뛰기"
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-1">{headerTitle}</p>

      <h3
        id="day7-action-title"
        className="text-base md:text-lg font-bold text-gray-900 leading-snug"
      >
        {data.title}
      </h3>
      <p className="mt-1.5 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
        {data.description}
      </p>

      {metaInline && (
        <p className="mt-2 text-sm text-gray-500">{metaInline}</p>
      )}

      {data.copy_template && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setCopyOpen(v => !v)}
            aria-expanded={copyOpen}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Copy className="w-4 h-4 text-gray-500" />
              붙여넣기용 문구
            </span>
            {copyOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {copyOpen && (
            <div className="px-3 pb-3 border-t border-gray-100">
              <p className="mt-2 text-sm text-gray-900 whitespace-pre-line break-words">
                {data.copy_template}
              </p>
              <button
                type="button"
                onClick={onCopy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={submitting || completed}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-bold px-4 py-2.5 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              기록 중...
            </>
          ) : completed ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              완료 기록됨
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              완료 표시
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 transition-colors"
        >
          건너뛰기
        </button>
      </div>
    </section>
  );
}
