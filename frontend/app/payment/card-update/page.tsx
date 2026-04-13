"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { updateBillingCard, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { XCircle, CheckCircle2, CreditCard } from "lucide-react";

type Status = "processing" | "success" | "error";

function CardUpdateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const authKey = searchParams.get("authKey");
    const customerKey = searchParams.get("customerKey");

    if (!authKey || !customerKey) {
      setStatus("error");
      setErrorMsg("카드 인증 정보가 올바르지 않습니다. 다시 시도해 주세요.");
      return;
    }

    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setStatus("error");
          setErrorMsg("로그인 세션이 만료되었습니다. 다시 로그인 후 시도해 주세요.");
          return;
        }

        await updateBillingCard(authKey, customerKey, session.access_token);
        setStatus("success");
        // 3초 후 설정 페이지로 자동 이동
        setTimeout(() => router.push("/settings"), 3000);
      } catch (e) {
        setStatus("error");
        setErrorMsg(
          e instanceof ApiError
            ? e.message
            : "카드 변경 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "processing") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-base">카드 변경 처리 중...</p>
          <p className="text-gray-400 text-sm mt-1">잠시만 기다려 주세요.</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">카드 변경 실패</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">{errorMsg}</p>
          <div className="space-y-3">
            <Link
              href="/settings"
              className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
            >
              <CreditCard className="w-4 h-4" strokeWidth={1.5} />
              다시 시도
            </Link>
            <Link
              href="/dashboard"
              className="block border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              대시보드로 이동
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">카드 변경 완료</h1>
        <p className="text-gray-600 text-base mb-1">
          새 결제 카드가 등록되었습니다.
        </p>
        <p className="text-gray-400 text-sm mb-2">
          다음 결제부터 변경된 카드로 자동 청구됩니다.
        </p>
        <p className="text-gray-400 text-xs mb-8">3초 후 설정 페이지로 이동합니다...</p>

        <div className="space-y-3">
          <Link
            href="/settings"
            className="block bg-blue-600 text-white py-3 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
          >
            설정 페이지로 이동
          </Link>
          <Link
            href="/dashboard"
            className="block border border-gray-200 text-gray-600 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            대시보드로 이동
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function CardUpdatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <CardUpdateContent />
    </Suspense>
  );
}
