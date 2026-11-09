"use client";

import { GEMINI_MEASUREMENT_LIVE as GEMINI_LIVE } from "@/lib/featureFlags";
import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { issueBilling, ApiError } from "@/lib/api";
import { createClient, getSafeSession } from "@/lib/supabase/client";
import { XCircle, CheckCircle2 } from "lucide-react";
import { trackSubscriptionActive } from "@/lib/analytics";
import { loadPayContext, clearPayContext, parseCrebReturn } from "@/lib/payContext";

type Status = "processing" | "billing" | "waiting" | "success" | "already" | "error";

// 구독 상태가 active로 바뀔 때까지 최대 5회 폴링 (1초 간격)
async function pollSubscriptionActive(maxAttempts = 5): Promise<boolean> {
  const supabase = createClient();
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) break;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.status === "active") return true;
  }
  return false;
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("processing");
  const [planName, setPlanName] = useState("");
  const [chargedAmount, setChargedAmount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [activationPending, setActivationPending] = useState(false); // 구독 활성화 확인이 늦을 때(웹훅 지연) 안내
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    // 주소의 값(과거 형태 포함)을 우선하고, 없으면 결제 직전에 저장해 둔 값을 쓴다
    const ret = parseCrebReturn(searchParams);
    const ctx = loadPayContext();
    const authKey = ret.authKey;
    const plan = ret.plan ?? ctx?.plan ?? "Basic";
    const amount = ret.amount ?? ctx?.amount ?? 0;

    if (!authKey || !amount) {
      setStatus("error");
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      return;
    }

    setPlanName(plan);
    setChargedAmount(amount);
    setStatus("billing");

    (async () => {
      const session = await getSafeSession();
      if (!session?.access_token) throw new Error("로그인 세션이 만료되었습니다.");
      await issueBilling({ authKey, plan, amount }, session.access_token);
      clearPayContext();
    })()
      .then(async () => {
        // 웹훅 처리 지연을 고려해 Supabase 구독 상태 폴링
        setStatus("waiting");
        const activated = await pollSubscriptionActive(5);
        setStatus("success");
        // GA4: subscription_active — 구독 확인 후 1회 발화
        trackSubscriptionActive({
          plan: plan.toLowerCase(),
          amount,
          billing_cycle: "monthly",
        });
        // 결제 결과 화면은 영수증 성격이라 자동으로 이동하지 않는다(2026-11-09: 결제 금액·카드 명세서 가맹점명 안내를 읽을 시간을
        // 보장하고, 화면 읽기 사용자가 결과를 듣기 전에 페이지가 바뀌지 않게 한다 — WCAG 2.2.1). 이동은 사용자가 버튼으로 한다.
        // 주소의 일회용 인증키는 지운다: 새로고침·뒤로 가기로 같은 인증키가 다시 제출돼 결제가 성공했는데도 '결제 오류'가 보이는 일을 막는다.
        window.history.replaceState(null, "", "/payment/success");
        if (!activated) setActivationPending(true);
      })
      .catch((e) => {
        // 서버는 이미 같은 플랜을 이용 중이면 두 번째 시도를 409로 거부한다(이중 청구 방지, webhook.py). 이것은 오류가 아니라
        // '이미 구독 중' 상태이므로 빨간 오류 화면 대신 안내한다. detail은 문자열로 온다.
        const detail: unknown = e instanceof ApiError ? e.detail : undefined;
        if (e instanceof ApiError && e.status === 409 && typeof detail === "string" && detail.startsWith("이미 같은 플랜")) {
          clearPayContext();
          window.history.replaceState(null, "", "/payment/success");
          setStatus("already");
          return;
        }
        setStatus("error");
        setErrorMsg(e instanceof ApiError ? e.message : "결제 확정 중 오류가 발생했습니다.");
      });
  }, []);

  if (status === "processing" || status === "billing") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">결제 확정 중...</p>
        </div>
      </main>
    );
  }

  if (status === "waiting") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">플랜 활성화 확인 중...</p>
          <p className="text-gray-600 text-sm mt-1">잠시만 기다려 주세요</p>
        </div>
      </main>
    );
  }

  if (status === "already") {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center" role="status">
            <CheckCircle2 className="w-14 h-14 text-green-700 mx-auto mb-4" strokeWidth={1.5} />
            <h1 className="text-xl font-bold text-gray-900 mb-2">이미 구독 중입니다</h1>
            <p className="text-gray-600 text-sm mb-2 break-keep">
              같은 플랜을 이미 이용 중이라 이번 시도는 결제되지 않았고 청구되지 않았습니다.
            </p>
            <p className="text-gray-600 text-sm mb-6 break-keep">
              결제 내역과 다음 결제일은 설정 &gt; 구독 관리에서 확인할 수 있어요.
            </p>
            <div className="space-y-3">
              <Link
                href="/dashboard"
                replace
                className="block bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                대시보드 바로가기
              </Link>
              <Link
                href="/settings"
                className="block border border-gray-200 text-gray-700 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                구독 관리 보기
              </Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center" role="alert">
            <XCircle className="w-12 h-12 text-red-700 mx-auto mb-4" strokeWidth={1.5} />
            <h1 className="text-xl font-bold text-gray-900 mb-2">결제 오류</h1>
            <p className="text-gray-600 text-sm mb-2">{errorMsg}</p>
            <p className="text-gray-600 text-sm mb-6">
              카드 승인이 이미 진행되었을 수 있습니다. 중복 결제를 막기 위해 다시 시도하기 전에 1:1 문의로 결제 여부를 확인해주세요.
            </p>
            <div className="space-y-3">
              <Link
                href="/pricing"
                className="block bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </Link>
              <Link
                href="/support/tickets/new"
                className="block border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                1:1 문의하기
              </Link>
            </div>
          </div>
        </div>
        <SiteFooter />
      </main>
    );
  }

  // success
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl p-4 md:p-8 shadow-sm max-w-sm w-full text-center" role="status">
          <CheckCircle2 className="w-14 h-14 text-green-700 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">구독 시작!</h1>
          <p className="text-gray-600 mb-1">
            <span className="font-semibold text-blue-600">{planName}</span> 플랜이 활성화되었습니다.
          </p>
          {chargedAmount > 0 && (
            <p className="text-gray-600 text-sm mb-1">
              오늘 <span className="font-semibold">{chargedAmount.toLocaleString()}원</span>이 결제되었습니다.
            </p>
          )}
          {chargedAmount > 0 && (
            <p className="text-gray-600 text-sm mb-2 break-keep">
              결제 문자와 카드 명세서에는 가맹점명이 <span className="font-semibold text-gray-800">(주)온프</span>로 표시될 수 있습니다.
            </p>
          )}
          <p className="text-gray-600 text-sm mb-2">
            이제 {GEMINI_LIVE ? "네이버·Gemini·ChatGPT 3곳" : "네이버·ChatGPT 2곳(Gemini는 준비 중)"} 자동 측정과 개선 가이드를 이용할 수 있습니다.
          </p>
          {activationPending && (
            <p className="text-amber-800 text-sm mb-4 break-keep">
              플랜 반영 확인이 조금 늦어지고 있어요. 대시보드에서 반영 상태가 보이지 않으면 잠시 후 새로고침해 주세요.
            </p>
          )}

          <div className="bg-blue-50 rounded-xl p-4 mb-4 text-left">
            <p className="text-sm font-semibold text-blue-800 mb-1">첫 측정 시작 방법</p>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. 대시보드에서 사업장을 등록하세요</li>
              <li>2. [AI 측정 시작] 버튼을 누르면 결과가 나옵니다</li>
            </ol>
          </div>

          <div className="space-y-3">
            <Link
              href="/dashboard"
              replace
              className="block bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              대시보드 바로가기
            </Link>
            <Link
              href="/guide"
              replace
              className="block border border-gray-200 text-gray-700 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              AI 개선 가이드 보기
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
