"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  orderId: string;
  status: string;
  token: string;
}

/** 의뢰 취소(결제 전) / 목록에서 삭제(취소·환불 후). 결제가 끝난 의뢰에는 아무것도 표시하지 않는다. */
export default function DeliveryOrderActions({ orderId, status, token }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = status === "received" ? "cancel" : status === "cancelled" || status === "refunded" ? "hide" : null;
  if (!mode) return null;

  const confirmText =
    mode === "cancel"
      ? "이 의뢰를 취소할까요? 결제 전이라 비용은 청구되지 않습니다."
      : "이 의뢰를 내 목록에서 삭제할까요? 삭제 후에는 목록에서 다시 볼 수 없습니다.";

  const run = async () => {
    if (!window.confirm(confirmText)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/delivery/orders/${orderId}/${mode === "cancel" ? "cancel" : "hide"}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.detail === "string" ? data.detail : "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      if (mode === "cancel") {
        router.refresh();
      } else {
        router.push("/delivery/orders");
        router.refresh();
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === "cancel" ? "의뢰 취소" : "목록에서 삭제"}
      </button>
    </div>
  );
}
