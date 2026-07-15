"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { updateBillingCard, ApiError } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import { XCircle, CheckCircle2, CreditCard } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";

type Status = "processing" | "success" | "error";

function CardUpdateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [errorMsg, setErrorMsg] = useState("");
  const [reactivated, setReactivated] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

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
        const session = await getSafeSession();
        if (!session?.access_token) {
          setStatus("error");
          setErrorMsg("로그인 세션이 만료되었습니다. 다시 로그인 후 시도해 주세요.");
          return;
        }

        const result = await updateBillingCard(authKey, customerKey, session.access_token);
        setReactivated(Boolean(result?.reactivated));
        setRetryFailed(Boolean(result?.retry_failed));
        setStatus("success");
        // retry_failed 상태는 사용자가 직접 확인해야 하므로 자동 이동하지 않음
        if (!result?.retry_failed) {
          setTimeout(() => router.push("/settings"), 3000);
        }
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
          <p className="text-gray-500 text-sm mt-1">잠시만 기다려 주세요.</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center">
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
        </div>
        <SiteFooter />
      </main>
    );
  }

  if (retryFailed) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center">
            <XCircle className="w-14 h-14 text-amber-500 mx-auto mb-4" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">카드는 등록됐지만 구독은 아직 정지 상태입니다</h1>
            <p className="text-gray-600 text-base mb-1">
              새 카드로 즉시 재결제를 시도했지만 실패했습니다.
            </p>
            <p className="text-gray-500 text-sm mb-8">
              카드 한도·잔액을 확인하시거나 다른 카드로 다시 시도해 주세요. 계속 실패하면 1:1 문의로 알려주세요.
            </p>

            <div className="space-y-3">
              <Link
                href="/settings"
                className="block bg-blue-600 text-white py-3 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
              >
                설정 페이지에서 다시 시도
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

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl p-6 md:p-8 shadow-sm max-w-sm w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {reactivated ? "결제 재개 완료" : "카드 변경 완료"}
          </h1>
          <p className="text-gray-600 text-base mb-1">
            {reactivated
              ? "새 카드로 결제가 성공해 구독이 다시 활성화되었습니다."
              : "새 결제 카드가 등록되었습니다."}
          </p>
          <p className="text-gray-500 text-sm mb-2">
            {reactivated ? "다음 결제일부터 정상적으로 자동 청구됩니다." : "다음 결제부터 변경된 카드로 자동 청구됩니다."}
          </p>
          <p className="text-gray-500 text-sm mb-8">3초 후 설정 페이지로 이동합니다...</p>

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
      </div>
      <SiteFooter />
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
