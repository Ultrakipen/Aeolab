"use client";

import { useEffect, useState } from "react";
import { Gift, Sparkles, Loader2, Lock } from "lucide-react";
import { getBasicTrialStatus, runBasicTrial, ApiError, type BasicTrialStatus } from "@/lib/api";

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getBasicTrialStatus(authToken);
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const handleStart = async () => {
    setError(null);
    setRunning(true);
    try {
      await runBasicTrial(authToken, businessId);
      // 성공 시 새로고침하여 결과 반영
      window.location.reload();
    } catch (e) {
      if (e instanceof ApiError) {
        const detail = e.detail as { code?: string; message?: string } | undefined;
        if (detail?.code === "BASIC_TRIAL_USED") {
          setError("이미 체험을 사용하셨습니다. 계속 이용하려면 Basic 플랜에 가입해 주세요.");
        } else if (detail?.code === "ALREADY_SUBSCRIBED") {
          setError("이미 구독 중이신 고객님은 체험 대신 자동 스캔이 진행됩니다.");
        } else if (detail?.code === "SCAN_IN_PROGRESS") {
          setError("이미 스캔이 진행 중입니다. 잠시만 기다려 주세요.");
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
      <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-green-50 p-5 md:p-6 mb-4">
        <div className="flex items-start gap-3">
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-base md:text-lg font-bold text-emerald-900">
              전체 AI가 내 가게를 확인하고 있어요...
            </p>
            <p className="text-sm md:text-base text-emerald-700 mt-1">
              ChatGPT · 네이버 AI 브리핑 · 구글 AI · Gemini 4개 채널 동시 분석 중 (약 1분 소요)
            </p>
            <p className="text-xs text-emerald-600 mt-2">
              이 페이지를 닫지 말고 잠시만 기다려 주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 체험 가능 상태
  if (!status.used && status.can_use) {
    return (
      <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-5 md:p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-emerald-100 shrink-0">
            <Gift className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-bold text-emerald-900 flex items-center gap-2 flex-wrap">
              지금 <span className="underline decoration-2">무료로 전체 AI 체험</span> 한 번 사용해 보세요
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </h3>
            <p className="text-sm md:text-base text-emerald-800 mt-1.5 leading-relaxed">
              <strong>{businessName}</strong>에 대해 4개 AI(ChatGPT · 네이버 AI 브리핑 · 구글 AI · Gemini)가
              어떻게 소개하는지 확인할 수 있습니다.
            </p>
            <ul className="text-xs md:text-sm text-emerald-700 mt-2 space-y-0.5 leading-relaxed">
              <li>• Gemini·ChatGPT 각 100회 샘플링으로 AI 노출 빈도 측정</li>
              <li>• AI 개선 가이드 1회 자동 생성</li>
              <li>• 약 1분 소요 · 평생 1회 무료</li>
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
            className="w-full md:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm md:text-base font-semibold rounded-xl transition-colors shadow-sm"
          >
            지금 1회 무료로 전체 AI 체험
          </button>
        ) : (
          <div className="bg-white border border-emerald-200 rounded-xl p-4">
            <p className="text-sm md:text-base text-gray-800 font-medium mb-3">
              지금 한 번만 무료 체험이 가능합니다. 약 1분이 소요됩니다. 시작할까요?
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleStart}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm md:text-base font-semibold rounded-lg transition-colors"
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
      <div className="rounded-2xl border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50 p-5 md:p-6 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-200 shrink-0">
            <Lock className="w-5 h-5 md:w-6 md:h-6 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-bold text-slate-800">
              무료 체험을 사용하셨습니다
            </h3>
            <p className="text-sm md:text-base text-slate-600 mt-1 leading-relaxed">
              계속 이용하려면 <strong className="text-slate-900">Basic 플랜(월 9,900원)</strong>에 가입해 주세요.
              매일 AI 자동 스캔과 개선 가이드를 받을 수 있습니다.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <a
                href="/pricing"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm md:text-base font-semibold rounded-lg transition-colors"
              >
                요금제 보기
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
