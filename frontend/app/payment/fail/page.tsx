"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
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
  const isCardUpdate = searchParams.get("from") === "card-update";

  // 주소의 message 값은 누구나 만들 수 있으므로(링크로 임의 문구를 우리 화면에 띄울 수 있음) 그대로 쓰지 않는다.
  // 짧은 한글 문구(숫자 4자리 이상 연속·URL·영문 없음)일 때만 PG가 준 사유로 인정한다.
  const safePgMessage = /^[가-힣0-9\s.,()·~\-]{2,60}$/.test(errorMsg) && !/\d{4,}/.test(errorMsg) ? errorMsg : "";
  // 크렙 카드 등록창을 사용자가 닫으면 message="닫기"로 돌아온다 — 오류가 아니라 중단이므로 카드 점검 안내를 띄우지 않는다
  const isUserClose = errorCode === "USER_CANCEL" || /^(닫기|닫음|취소|창 ?닫기)$/.test(errorMsg.trim());
  const displayMsg = isUserClose
    ? "카드 등록 창을 닫으셨습니다. 결제는 진행되지 않았고 카드에 청구된 금액도 없습니다."
    : ERROR_MESSAGES[errorCode] ||
    safePgMessage ||
    "카드 등록이 완료되지 않았습니다. 결제는 진행되지 않았으니 안심하고 다시 시도해주세요.";

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl p-4 md:p-8 shadow-sm max-w-sm w-full text-center">
          <AlertCircle
            className={`w-12 h-12 mx-auto mb-4 ${isUserClose ? "text-gray-400" : "text-red-400"}`}
            strokeWidth={1.5}
          />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isUserClose
              ? isCardUpdate ? "카드 변경을 마치지 않았습니다" : "결제를 마치지 않았습니다"
              : isCardUpdate ? "카드 등록 실패" : "결제 실패"}
          </h1>
          <p className="text-gray-700 text-sm leading-relaxed mb-6 break-keep">{displayMsg}</p>

          {!isUserClose && (
            <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-medium text-blue-800 mb-2">카드 등록이 되지 않을 때 확인해보세요</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 카드 한도 초과 여부</li>
                <li>• 카드 번호·유효기간·CVC 정확도</li>
                <li>• 해외 결제 차단 설정</li>
                <li>• 카드사 앱에서 1회성 비밀번호 설정 여부</li>
              </ul>
              <p className="text-sm text-blue-700 mt-3 break-keep">
                계속 안 되면 <a href="mailto:support@aeolab.co.kr" className="underline">support@aeolab.co.kr</a>로 알려주세요.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Link
              href={isCardUpdate ? "/settings" : "/pricing"}
              className="block bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              {isCardUpdate ? "설정으로 돌아가 다시 시도" : "다시 결제하기"}
            </Link>
            <Link
              href={isCardUpdate ? "/dashboard" : "/"}
              className="block text-sm text-gray-600 hover:text-gray-700 transition-colors"
            >
              {isCardUpdate ? "대시보드로 이동" : "홈으로"}
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
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
