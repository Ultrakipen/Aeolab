"use client";

// ConversionGuideSection.tsx
// 대시보드 "AI 노출 지수를 높이는 방법" — 스캔 결과 기반 맞춤 개선 팁
// - 서버에서 맞춤 팁 3~4개 fetch (AI 호출 0)
// - 각 팁: 진단 근거(reason) + 즉시 복사·수정 가능 초안 + 외부 스마트플레이스 링크
// - Free 플랜은 상위 2개만 copy_text 공개, 나머지 Basic+ 잠금
// - 편집 내용은 localStorage에 저장 (key: aeolab_tip_{bizId}_{tip.id})

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Lock,
  Copy,
  Check,
  CheckCheck,
  ExternalLink,
  Zap,
  AlertTriangle,
  ArrowRight,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { getConversionTips } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import type { ConversionTip, ConversionTipsResponse } from "@/types";

interface Props {
  bizId: string;
  plan: string;
}

const URGENCY_COLOR: Record<string, string> = {
  do_now: "bg-red-100 text-red-700 border-red-200",
  this_week: "bg-amber-100 text-amber-700 border-amber-200",
  this_month: "bg-slate-100 text-slate-700 border-slate-200",
};

const EVIDENCE_COLOR: Record<string, string> = {
  keyword_gap: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ai_citation: "bg-rose-50 text-rose-700 border-rose-200",
  smart_place: "bg-emerald-50 text-emerald-700 border-emerald-200",
  review: "bg-sky-50 text-sky-700 border-sky-200",
};

function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!text || disabled) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-400 bg-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          복사됨
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          복사하기
        </>
      )}
    </button>
  );
}

function TipCard({ tip, bizId }: { tip: ConversionTip; bizId: string }) {
  const storageKey = `aeolab_tip_${bizId}_${tip.id}`;
  const urgencyClass = URGENCY_COLOR[tip.urgency] ?? URGENCY_COLOR["this_week"];
  const evidenceClass =
    EVIDENCE_COLOR[tip.evidence_type] ?? EVIDENCE_COLOR["smart_place"];

  const [editedText, setEditedText] = useState(tip.copy_text);
  const [isEditing, setIsEditing] = useState(false);

  // localStorage에서 사용자 편집 내용 복원 (잠금 카드는 제외)
  useEffect(() => {
    if (tip.locked) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setEditedText(saved);
    } catch {
      // 시크릿 모드 등 localStorage 접근 불가 시 무시
    }
  }, [storageKey, tip.locked]);

  const isModified = editedText !== tip.copy_text;

  function handleTextChange(val: string) {
    setEditedText(val);
    try {
      localStorage.setItem(storageKey, val);
    } catch {
      // ignore
    }
  }

  function handleReset() {
    setEditedText(tip.copy_text);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setIsEditing(false);
  }

  return (
    <div
      className={`relative rounded-xl border bg-white p-4 md:p-5 ${
        tip.locked ? "border-gray-200" : "border-green-200 shadow-sm"
      }`}
    >
      {/* 배지 영역 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span
          className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full border ${urgencyClass}`}
        >
          <Zap className="w-3.5 h-3.5" />
          {tip.urgency_label}
        </span>
        <span
          className={`inline-flex items-center text-sm font-medium px-2.5 py-1 rounded-full border ${evidenceClass}`}
        >
          {tip.evidence_badge}
        </span>
        <span className="inline-flex items-center text-sm text-gray-600 px-2 py-1">
          ⏱ {tip.estimated_time}
        </span>
      </div>

      {/* 제목 + 근거 */}
      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1.5">
        {tip.title}
      </h3>
      <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-3">
        <AlertTriangle className="inline w-4 h-4 text-amber-700 mr-1 align-text-bottom" />
        {tip.reason}
      </p>

      {/* 등록 위치 안내 (action_steps가 있을 때) */}
      {tip.action_steps && tip.action_steps.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
          <p className="text-sm font-semibold text-blue-700 mb-2 uppercase tracking-wide">
            어디서 하나요?
          </p>
          <ol className="space-y-1">
            {tip.action_steps.map((step, i) => (
              <li key={i} className="text-sm text-blue-800 leading-snug">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 복사 가능 본문 */}
      {tip.copy_text && (
        <div className="relative">
          {tip.locked ? (
            /* 잠금: blur 처리 */
            <div className="relative">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed blur-[3px] select-none max-h-20 overflow-hidden">
                {tip.copy_text.slice(0, 60) + " …"}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-full shadow-sm">
                  <Lock className="w-4 h-4" />
                  Basic 플랜에서 전체 문구 보기
                </div>
              </div>
            </div>
          ) : isEditing ? (
            /* 편집 모드: textarea */
            <div className="relative">
              <textarea
                value={editedText}
                onChange={(e) => handleTextChange(e.target.value)}
                rows={6}
                className="w-full bg-white border border-blue-300 rounded-lg p-3 text-sm text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[100px]"
              />
              {isModified && (
                <span className="absolute top-2 right-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded pointer-events-none">
                  편집됨
                </span>
              )}
            </div>
          ) : (
            /* 표시 모드 */
            <div className="relative">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                {editedText}
              </div>
              {isModified && (
                <span className="absolute top-2 right-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded pointer-events-none">
                  편집됨
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {!tip.locked && tip.copy_text && (
          <>
            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-900 border border-green-200 hover:border-green-400 bg-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                완료
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 bg-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                수정
              </button>
            )}
            <CopyButton text={editedText} />
            {isModified && !isEditing && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 border border-gray-200 hover:border-gray-300 bg-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                원래대로
              </button>
            )}
          </>
        )}
        {tip.action_url && (
          <a
            href={tip.action_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-400 bg-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {tip.action_label}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* 기대 효과 */}
      {tip.impact && (
        <p className="text-sm text-green-700 mt-2 font-medium">
          → {tip.impact}
        </p>
      )}
    </div>
  );
}

function TipSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 animate-pulse">
      <div className="flex gap-1.5 mb-3">
        <div className="h-6 w-16 bg-gray-200 rounded-full" />
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-full bg-gray-100 rounded mb-1" />
      <div className="h-4 w-5/6 bg-gray-100 rounded mb-3" />
      <div className="h-20 bg-gray-50 rounded-lg" />
    </div>
  );
}

export default function ConversionGuideSection({ bizId, plan }: Props) {
  const isPaid = plan !== "free";
  const [data, setData] = useState<ConversionTipsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(attempt = 0) {
      if (!cancelled) setLoading(true);
      setError(null);
      const session = await getSafeSession();
      const token = session?.access_token;
      if (!token) {
        if (!cancelled) {
          setError("로그인 세션이 만료되었습니다.");
          setLoading(false);
        }
        return;
      }
      try {
        const result = await getConversionTips(bizId, token);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (e) {
        if (cancelled) return;
        const isTransient =
          e instanceof Error && e.message.includes("서버 오류");
        if (isTransient && attempt === 0) {
          setTimeout(() => {
            if (!cancelled) load(1);
          }, 2000);
          return;
        }
        setError(
          e instanceof Error
            ? e.message
            : "맞춤 개선 팁을 불러오지 못했습니다.",
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId, retryCount]);

  return (
    <div className="bg-gradient-to-b from-white to-blue-50 border border-blue-100 rounded-xl p-4 md:p-6 shadow-sm">
      {/* 헤더 */}
      <div className="mb-4">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
          AI 노출 지수를 높이는 방법
        </h2>
        <p className="text-sm text-gray-600">
          {loading
            ? "내 스캔 결과를 분석하고 있습니다…"
            : data?.summary ??
              "스캔 결과 기반으로 가장 효과 큰 행동부터 추천합니다."}
        </p>
        {!loading && data?.missing_platforms && data.missing_platforms.length > 0 && (
          <div className="mt-2 inline-flex flex-wrap gap-1.5">
            {data.missing_platforms.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{p} 미노출
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="space-y-3">
          <TipSkeleton />
          <TipSkeleton />
          <TipSkeleton />
        </div>
      )}

      {/* 오류 */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex flex-col gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="self-start text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 팁 리스트 */}
      {!loading && !error && data && data.tips.length > 0 && (
        <div className="space-y-3">
          {data.tips.map((tip) => (
            <TipCard key={tip.id} tip={tip} bizId={bizId} />
          ))}
        </div>
      )}

      {/* 팁 없음 (스캔 미실행 등) */}
      {!loading && !error && data && data.tips.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          먼저 AI 스캔을 실행해 주세요. 스캔 결과가 있어야 맞춤 개선 팁을 만들 수
          있습니다.
        </div>
      )}

      {/* 플랜별 CTA */}
      {!loading && !error && data && (
        <div className="mt-4">
          {!isPaid ? (
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold px-5 py-3 rounded-xl transition-colors"
            >
              <Lock className="w-4 h-4" />
              Basic 플랜 시작하기 — 월 11,900원
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/guide"
              className="flex items-center justify-center gap-2 w-full bg-green-700 hover:bg-green-800 text-white text-base font-bold px-5 py-3 rounded-xl transition-colors"
            >
              더 많은 맞춤 가이드 보기
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <p className="text-sm text-center text-gray-600 mt-2">
            {isPaid
              ? "가이드 페이지에서 리뷰 답변 초안·FAQ·소식 초안을 업종별 맞춤으로 받을 수 있습니다."
              : "가입 후 모든 복사 문구와 경로별 상세 가이드를 바로 사용할 수 있습니다. 7일 이내 미사용 시 100% 환불 가능합니다."}
          </p>
        </div>
      )}
    </div>
  );
}
