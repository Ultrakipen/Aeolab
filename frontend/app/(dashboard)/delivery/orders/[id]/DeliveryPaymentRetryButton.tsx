"use client";

import { useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { loadCreb, getBuyerInfo } from "@/lib/creb";

const PACKAGE_NAMES: Record<string, string> = {
  smartplace_register: "01 스마트플레이스 등록 대행",
  ai_optimization: "02 AI 검색 개선",
  comprehensive: "03 종합 풀패키지",
};

interface Props {
  orderId: string;
  packageType: string;
  amount: number;
}

export default function DeliveryPaymentRetryButton({ orderId, packageType, amount }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    if (!process.env.NEXT_PUBLIC_CREB_CLIENT_KEY) {
      setError("결제 설정이 완료되지 않았습니다. 고객센터에 문의해주세요.");
      setLoading(false);
      return;
    }
    try {
      const buyer = await getBuyerInfo();
      if (!buyer.phone) {
        setError("결제에 필요한 휴대폰 번호가 등록되어 있지 않습니다. 설정에서 번호를 등록한 뒤 다시 시도해주세요.");
        return;
      }
      const creb = await loadCreb();
      const price = amount;
      const pkgName = PACKAGE_NAMES[packageType] ?? packageType;
      const pgOrderId = `delivery_${orderId}_${Date.now()}`;
      await creb.requestPayment({
        amount: String(price),
        orderId: pgOrderId,
        orderName: `AEOlab 대행 서비스 - ${pkgName}`.slice(0, 100),
        customerName: buyer.name,
        customerPhone: buyer.phone,
        ...(buyer.email ? { customerEmail: buyer.email } : {}),
        successUrl: `${window.location.origin}/delivery/payment-confirm?orderId=${orderId}&amount=${price}&pgOrderId=${encodeURIComponent(pgOrderId)}`,
        failUrl: `${window.location.origin}/delivery/orders/${orderId}?payment=fail`,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "USER_CANCEL") {
        setError("결제 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <button
        onClick={handlePayment}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        결제하기 — {amount.toLocaleString()}원
      </button>
    </div>
  );
}
