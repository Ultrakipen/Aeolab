"use client";

import { GEMINI_MEASUREMENT_LIVE as GEMINI_LIVE, AI_COUNT_N } from "@/lib/featureFlags";
import { useCallback, useEffect, useRef, useState } from "react";
import { Gift, Sparkles, Loader2, Lock, PartyPopper } from "lucide-react";
import { getBasicTrialStatus, runBasicTrial, ApiError, type BasicTrialStatus } from "@/lib/api";
import { FIRST_MONTH_DISCOUNT_PRICES, PLAN_PRICES } from "@/lib/plans";

interface Props {
  businessId: string;
  businessName: string;
  authToken: string;
}

export default function BasicTrialBanner({ businessId, businessName, authToken }: Props) {
  const [status, setStatus] = useState<BasicTrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 서버가 백그라운드로 돌리는 측정이 끝날 때까지 3초마다 상태를 확인한다(최대 6분). 창을 닫아도 측정은 계속되고, 다시 열면 이어서 확인한다.
  const waitForTrial = useCallback(async () => {
    const startedAt = Date.now();
    while (alive.current && Date.now() - startedAt < 6 * 60_000) {
      await new Promise((r) => setTimeout(r, 3000));
      if (!alive.current) return;
      let st: BasicTrialStatus | null = null;
      try {
        st = await getBasicTrialStatus(authToken);
      } catch {
        continue; // 일시적인 조회 실패는 다음 주기에 다시 확인
      }
      if (st.run?.status === "error") {
        setError(st.run.error || "체험 측정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        setStatus(st);
        setRunning(false);
        return;
      }
      if (st.interrupted) {
        setError("측정이 중간에 중단되어 체험 횟수를 되돌렸습니다. 다시 시도해 주세요.");
        setStatus(st);
        setRunning(false);
        return;
      }
      if (st.run?.status === "done" || (st.used && !st.run)) {
        window.location.reload();
        return;
      }
    }
    if (alive.current) {
      setError("측정이 예상보다 오래 걸리고 있어요. 잠시 후 페이지를 새로고침하면 결과가 표시됩니다.");
      setRunning(false);
    }
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getBasicTrialStatus(authToken);
        if (!cancelled) {
          setStatus(s);
          if (s.run?.status === "running") {
            setRunning(true);   // 새로고침·재접속해도 진행 중인 측정을 이어서 확인
            void waitForTrial();
          }
        }
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, waitForTrial]);

  const handleStart = async () => {
    setError(null);
    setRunning(true);
    try {
      await runBasicTrial(authToken, businessId);   // 접수만 하고 즉시 돌아온다 — 측정은 서버에서 진행
      await waitForTrial();                          // 끝나면 새로고침해 결과를 반영
    } catch (e) {
      if (e instanceof ApiError) {
        const detail = e.detail as { code?: string; message?: string } | undefined;
        if (detail?.code === "BASIC_TRIAL_USED") {
          setError("이미 체험을 사용하셨습니다. 계속 이용하려면 Basic 플랜에 가입해 주세요.");
        } else if (detail?.code === "ALREADY_SUBSCRIBED") {
          setError("이미 구독 중이신 고객님은 체험 대신 자동 측정이 진행됩니다.");
        } else if (detail?.code === "SCAN_IN_PROGRESS") {
          setError("이미 측정이 진행 중입니다. 잠시만 기다려 주세요.");
        } else {
          setError(detail?.message || e.message || "잠시 후 다시 시도해 주세요.");
        }
      } else {
        setError("잠시 후 다시 시도해 주세요.");
      }
      setRunning(false);
    }
  };

  if (loading || !status) return null;

  // 이미 구독자 → 표시 안 함
  if (status.has_active_subscription) return null;

  // 실행 중 상태
  if (running) {
    return (
      <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 p-5 md:p-6 mb-4">
        <div className="flex items-start gap-3">
          <Loader2 className="w-6 h-6 text-emerald-700 animate-spin shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-base md:text-lg font-bold text-emerald-900">
              전체 AI가 내 가게를 확인하고 있어요...
            </p>
            <p className="text-sm md:text-base text-emerald-700 mt-1">
              ChatGPT · 네이버 AI 브리핑 · 구글 AI{GEMINI_LIVE ? " · Gemini" : ""} 동시 분석 중
            </p>
            <p className="text-sm text-emerald-700 mt-2">
              보통 1~2분 걸려요. 창을 닫아도 측정은 계속되고, 다시 열면 결과가 표시됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 체험 가능 상태
  if (!status.used && status.can_use) {
    return (
      <div className="rounded-xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-5 md:p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-emerald-100 shrink-0">
            <Gift className="w-5 h-5 md:w-6 md:h-6 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0 pr-10 md:pr-0">
            <h3 className="text-base md:text-lg font-bold text-emerald-900 flex items-center gap-2 flex-wrap">
              지금 <span className="underline decoration-2">무료로 전체 AI 체험</span> 한 번 사용해 보세요
              <Sparkles className="w-4 h-4 text-emerald-700" />
            </h3>
            <p className="text-sm md:text-base text-emerald-800 mt-1.5 leading-relaxed">
              <strong>{businessName}</strong>에 대해 {AI_COUNT_N}개 AI(ChatGPT · 네이버 AI 브리핑 · 구글 AI{GEMINI_LIVE ? " · Gemini" : ""})가
              어떻게 소개하는지 확인할 수 있습니다.
            </p>
            <ul className="text-sm text-emerald-700 mt-2 space-y-0.5 leading-relaxed">
              <li>• {GEMINI_LIVE ? "Gemini·ChatGPT 각 50회" : "ChatGPT 50회"} 여러 번 물어봐서 AI 노출 빈도 측정</li>
              <li>• AI 개선 가이드 1회 자동 생성</li>
              <li>• 평생 1회 무료</li>
              <li className="text-emerald-700">• Basic 구독 시 {GEMINI_LIVE ? "각 " : ""}100회로 정확도 상승 + 주 2회 자동 반복 측정</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full md:w-auto px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-sm md:text-base font-semibold rounded-xl transition-colors shadow-sm"
          >
            지금 1회 무료로 전체 AI 체험
          </button>
        ) : (
          <div className="bg-white border border-emerald-200 rounded-xl p-4">
            <p className="text-sm md:text-base text-gray-800 font-medium mb-3">
              지금 한 번만 무료 체험이 가능합니다. 시작할까요?
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleStart}
                className="flex-1 px-4 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-sm md:text-base font-semibold rounded-lg transition-colors"
              >
                네, 시작합니다
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 sm:flex-none sm:px-6 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm md:text-base font-semibold rounded-lg transition-colors"
              >
                나중에
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 이미 체험 사용 + 비구독 상태
  if (status.used && !status.has_active_subscription) {
    return (
      <div className="rounded-xl border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50 p-5 md:p-6 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-200 shrink-0">
            <Lock className="w-5 h-5 md:w-6 md:h-6 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0 pr-10 md:pr-0">
            <h3 className="text-base md:text-lg font-bold text-slate-800">
              무료 체험을 사용하셨습니다
            </h3>
            <p className="text-sm md:text-base text-slate-600 mt-1 leading-relaxed">
              계속 이용하려면 <strong className="text-slate-900">Basic 플랜</strong>에 가입해 주세요.
              방금 체험한 50회 질문이 <strong className="text-slate-900">100회로 늘어나 정확도가 높아지고</strong>,
              주 2회 자동 측정과 개선 가이드를 지속해서 받을 수 있습니다.
            </p>
            <p className="text-sm md:text-base font-semibold text-emerald-700 mt-2">
              <span className="flex items-center gap-1.5"><PartyPopper className="w-4 h-4 shrink-0" aria-hidden="true" />지금 가입하면 첫 달 {FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원 (50% 할인) · 이후 월 {PLAN_PRICES.basic.toLocaleString()}원</span>
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <a
                href="/pricing"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm md:text-base font-semibold rounded-lg transition-colors"
              >
                첫 달 {FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원으로 시작하기
              </a>
              <a
                href="/guide"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-white hover:bg-gray-50 border border-slate-300 text-slate-700 text-sm md:text-base font-semibold rounded-lg transition-colors"
              >
                체험 결과로 가이드 보기
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
