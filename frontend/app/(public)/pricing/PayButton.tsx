"use client";

import { useEffect, useState } from "react";
import { createClient, getSafeSession } from "@/lib/supabase/client";

interface Props {
  planName: string;
  amount: number;
  highlight: boolean;
  signupHref: string;
  firstMonthAmount?: number; // 첫 달 50% 할인가 (있으면 신규 가입자에게 적용)
}

export function PayButton({ planName, amount, highlight, signupHref, firstMonthAmount }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);

  // 모달 열릴 때 구독 이력 확인 — 없으면 첫 달 할인가 적용
  useEffect(() => {
    if (!showConfirm || !firstMonthAmount) return;
    (async () => {
      const session = await getSafeSession();
      const user = session?.user ?? null;
      if (!user) {
        setIsFirstTime(true); // 비로그인은 신규로 간주 (signup 유도 후 재확인)
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setIsFirstTime(!data);
    })();
  }, [showConfirm, firstMonthAmount]);

  const chargeAmount = firstMonthAmount && isFirstTime ? firstMonthAmount : amount;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const session = await getSafeSession();
      const user = session?.user ?? null;

      if (!user) {
        window.location.href = `${signupHref}?plan=${encodeURIComponent(planName)}&amount=${chargeAmount}`;
        return;
      }

      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        alert("결제 키가 설정되지 않았습니다.");
        return;
      }

      // @ts-ignore — 토스 스크립트 동적 로드
      const { loadTossPayments } = await import("@tosspayments/payment-sdk");
      const tossPayments = await loadTossPayments(clientKey);

      const customerKey = `customer_${user.id}`;

      await tossPayments.requestBillingAuth("카드", {
        customerKey,
        successUrl: `${window.location.origin}/payment/success?plan=${encodeURIComponent(planName)}&amount=${chargeAmount}`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (e: unknown) {
      if ((e as { code?: string })?.code !== "USER_CANCEL") {
        alert("결제 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className={`w-full py-3 rounded-xl font-semibold transition-colors ${
          highlight
            ? "bg-white text-blue-600 hover:bg-blue-50"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        시작하기
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">결제 확인</h2>
            <p className="text-sm text-gray-500 mb-5">아래 내용을 확인하고 결제를 진행해주세요.</p>

            <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">상품</span>
                <span className="font-medium text-gray-900">AEOlab {planName} 구독</span>
              </div>
              {firstMonthAmount && isFirstTime ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">오늘 결제 (첫 달 50%)</span>
                    <span className="font-bold text-emerald-600 text-base">
                      {firstMonthAmount.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">다음 달부터</span>
                    <span className="text-gray-700">
                      {amount.toLocaleString()}원 / 월
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-gray-500">결제 금액</span>
                  <span className="font-bold text-blue-600 text-base">
                    {amount.toLocaleString()}원 / 월
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">결제 방식</span>
                <span className="text-gray-700">카드 자동결제 (매월 갱신)</span>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-5">
              {firstMonthAmount && isFirstTime
                ? `첫 달 ${firstMonthAmount.toLocaleString()}원 결제 후, 30일 뒤부터 매월 ${amount.toLocaleString()}원이 자동으로 결제됩니다. 언제든지 설정에서 해지할 수 있습니다.`
                : "카드를 등록하면 매월 자동으로 결제됩니다. 언제든지 설정에서 해지할 수 있습니다."}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? "처리 중..." : "카드 등록 및 결제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
