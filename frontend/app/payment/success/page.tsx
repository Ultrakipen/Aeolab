"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { issueBilling, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { XCircle, CheckCircle2 } from "lucide-react";
import { trackSubscriptionActive } from "@/lib/analytics";

type Status = "processing" | "billing" | "waiting" | "success" | "error";

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
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [planName, setPlanName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(3);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const authKey = searchParams.get("authKey");
    const customerKey = searchParams.get("customerKey");
    const plan = searchParams.get("plan") ?? "Basic";
    const amount = Number(searchParams.get("amount"));

    if (!authKey || !customerKey || !amount) {
      setStatus("error");
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      return;
    }

    setPlanName(plan);
    setStatus("billing");

    issueBilling({ authKey, customerKey, plan, amount })
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
        if (activated) {
          // 구독 확인되면 3초 카운트다운 후 대시보드 이동
          let count = 3;
          const timer = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
              clearInterval(timer);
              router.push("/dashboard");
            }
          }, 1000);
        } else {
          // 폴링 실패해도 3초 후 이동 (웹훅이 약간 늦을 수 있음)
          setTimeout(() => router.push("/dashboard"), 3000);
        }
      })
      .catch((e) => {
        setStatus("error");
        setErrorMsg(e instanceof ApiError ? e.message : "결제 확정 중 오류가 발생했습니다.");
      });
  }, []);

  if (status === "processing" || status === "billing") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">결제 확정 중...</p>
        </div>
      </main>
    );
  }

  if (status === "waiting") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">플랜 활성화 확인 중...</p>
          <p className="text-gray-400 text-sm mt-1">잠시만 기다려 주세요</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">결제 오류</h1>
          <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
          <Link
            href="/pricing"
            className="block bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </Link>
        </div>
      </main>
    );
  }

  // success
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm max-w-sm w-full text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">구독 시작!</h1>
        <p className="text-gray-600 mb-1">
          <span className="font-semibold text-blue-600">{planName}</span> 플랜이 활성화되었습니다.
        </p>
        <p className="text-gray-400 text-sm mb-2">
          이제 네이버·카카오·ChatGPT 3채널 자동 스캔과 개선 가이드를 이용할 수 있습니다.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          {countdown}초 후 대시보드로 이동합니다...
        </p>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            대시보드 바로가기
          </Link>
          <Link
            href="/guide"
            className="block border border-gray-200 text-gray-700 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            AI 개선 가이드 보기
          </Link>
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
