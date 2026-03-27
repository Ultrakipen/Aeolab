"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CARD_COMPANY: "지원하지 않는 카드사입니다.",
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: "해당 카드는 할부가 지원되지 않습니다.",
  INVALID_CARD_NUMBER: "카드 번호가 올바르지 않습니다.",
  CARD_EXPIRATION: "카드 유효기간이 만료되었습니다.",
  EXCEED_MAX_DAILY_PAYMENT_COUNT: "하루 결제 한도를 초과했습니다.",
  REJECT_CARD_PAYMENT: "카드사에서 결제를 거절했습니다.",
  PAYMENT_DECLINED: "결제가 거절되었습니다. 카드사에 문의해주세요.",
  USER_CANCEL: "결제를 취소하셨습니다.",
};

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("code") ?? "";
  const errorMsg = searchParams.get("message") ?? "";
  const orderId = searchParams.get("orderId");

  const displayMsg =
    ERROR_MESSAGES[errorCode] ||
    errorMsg ||
    "결제 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">결제 실패</h1>
        <p className="text-gray-500 text-sm mb-2">{displayMsg}</p>
        {orderId && (
          <p className="text-xs text-gray-400 mb-6">주문번호: {orderId}</p>
        )}

        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm font-medium text-blue-800 mb-2">이런 경우 확인해보세요</p>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• 카드 한도 초과 여부</li>
            <li>• 카드 번호·유효기간·CVC 정확도</li>
            <li>• 해외 결제 차단 설정</li>
            <li>• 카드사 앱에서 1회성 비밀번호 설정 여부</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/pricing"
            className="block bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            다시 결제하기
          </Link>
          <Link
            href="/"
            className="block text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <PaymentFailContent />
    </Suspense>
  );
}
