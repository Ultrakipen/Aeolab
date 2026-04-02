"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { issueBilling, ApiError } from "@/lib/api";
import { XCircle, CheckCircle2 } from "lucide-react";

type Status = "processing" | "success" | "error";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [planName, setPlanName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
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

    issueBilling({ authKey, customerKey, plan, amount })
      .then(() => setStatus("success"))
      .catch((e) => {
        setStatus("error");
        setErrorMsg(e instanceof ApiError ? e.message : "결제 확정 중 오류가 발생했습니다.");
      });
  }, [searchParams]);

  if (status === "processing") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">결제 확정 중...</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full text-center">
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

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">구독 시작!</h1>
        <p className="text-gray-600 mb-1">
          <span className="font-semibold text-blue-600">{planName}</span> 플랜이 활성화되었습니다.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          이제 7개 AI 플랫폼 자동 스캔과 개선 가이드를 이용할 수 있습니다.
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
