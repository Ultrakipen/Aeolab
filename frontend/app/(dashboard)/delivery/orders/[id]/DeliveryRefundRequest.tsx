"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, RotateCcw } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  orderId: string;
  status: string;
  token: string;
  refundStatus?: string | null;
  refundRequestedAt?: string | null;
  rejectReason?: string | null;
}

const REFUNDABLE = ["paid", "in_progress", "rework"];

/** 결제 완료 후 진행 중인 의뢰의 환불 요청. 요청만 접수하고 실제 환불은 운영자가 승인한다. */
export default function DeliveryRefundRequest({
  orderId, status, token, refundStatus, refundRequestedAt, rejectReason,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!REFUNDABLE.includes(status)) return null;

  const formatDateTime = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString("ko-KR", {
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        })
      : "";

  if (refundStatus === "pending") {
    return (
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-0.5">환불 요청이 접수되었습니다</p>
        <p className="text-sm text-amber-700">
          {refundRequestedAt ? `${formatDateTime(refundRequestedAt)} 접수 · ` : ""}
          운영자가 확인한 뒤 영업일 1~2일 내에 처리 결과를 안내드립니다.
        </p>
      </div>
    );
  }

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 2) {
      setError("환불 사유를 2자 이상 입력해 주세요.");
      return;
    }
    if (!window.confirm("환불을 요청할까요? 운영자 확인 후 처리 결과를 안내드립니다.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/delivery/orders/${orderId}/refund-request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.detail === "string" ? data.detail : "요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
      {refundStatus === "rejected" && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <p className="text-sm font-semibold text-red-800">이전 환불 요청이 처리되지 않았습니다</p>
          {rejectReason && <p className="text-sm text-red-700 mt-0.5">사유: {rejectReason}</p>}
        </div>
      )}
      {!open ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-gray-600 flex-1">
            작업 착수 전(결제완료)에는 전액 환불되며, 작업 진행 중에는 진행 상황에 따라 협의합니다.{" "}
            <Link href="/terms" className="underline text-blue-700">이용약관 제5조의2</Link>
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            환불 요청
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="refund-reason" className="block text-sm font-semibold text-gray-800">
            환불 사유
          </label>
          <textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="환불을 요청하는 사유를 입력해 주세요 (2~500자)"
            className="w-full text-base border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-gray-800 text-white hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              환불 요청 접수
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              disabled={loading}
              className="px-4 py-3 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
