"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function PaymentConfirmInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get("orderId") ?? "";
  const paymentKey = searchParams.get("paymentKey") ?? "";
  const amount = Number(searchParams.get("amount") ?? "0");
  const tossOrderId = searchParams.get("tossOrderId") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!orderId || !paymentKey || !tossOrderId) {
      setStatus("error");
      setErrorMsg("유효하지 않은 결제 요청입니다. (파라미터 누락)");
      return;
    }

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setStatus("error");
          setErrorMsg("로그인이 필요합니다.");
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token ?? "";

        const res = await fetch(`${BACKEND_URL}/api/delivery/orders/${orderId}/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_key: paymentKey,
            amount,
            toss_order_id: tossOrderId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail ?? "결제 확인에 실패했습니다.");
        }

        setStatus("success");

        // 3초 후 의뢰 상세 페이지로 이동
        setTimeout(() => {
          router.push(`/delivery/orders/${orderId}`);
        }, 3000);
      } catch (err: unknown) {
        setStatus("error");
        setErrorMsg((err as Error).message ?? "결제 확인 중 오류가 발생했습니다.");
      }
    })();
  }, [orderId, paymentKey, amount, tossOrderId, router]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-base font-medium text-gray-700">결제를 확인하는 중입니다...</p>
        <p className="text-sm text-gray-400">잠시만 기다려 주세요.</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-green-500" />
        </div>
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">결제 완료!</h1>
          <p className="text-base text-gray-600">의뢰가 접수되었습니다.</p>
          <p className="text-sm text-gray-400 mt-1">잠시 후 의뢰 상세 페이지로 이동합니다.</p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span className="text-sm text-blue-500">3초 후 자동 이동...</span>
        </div>
        <button
          onClick={() => router.push(`/delivery/orders/${orderId}`)}
          className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          지금 바로 이동
        </button>
      </div>
    );
  }

  // error
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="w-9 h-9 text-red-500" />
      </div>
      <div className="text-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">결제 확인 오류</h1>
        <p className="text-base text-gray-600">결제 확인 중 오류가 발생했습니다.</p>
        <p className="text-sm text-red-500 mt-1">{errorMsg}</p>
        <p className="text-sm text-gray-400 mt-2">고객센터에 문의해 주세요.</p>
      </div>
      <button
        onClick={() => router.push("/delivery/orders")}
        className="mt-2 px-5 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
      >
        의뢰 목록 보기
      </button>
    </div>
  );
}

export default function DeliveryPaymentConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <PaymentConfirmInner />
    </Suspense>
  );
}
