"use client";

import { useState } from "react";
import { updatePhone } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { CreditCard } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  currentPhone?: string;
  kakaoScanNotify?: boolean;
  kakaoCompetitorNotify?: boolean;
  subscriptionStatus?: string;
  userId?: string;
}

export function SettingsClient({
  currentPhone,
  kakaoScanNotify = true,
  kakaoCompetitorNotify = true,
  subscriptionStatus,
  userId,
}: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [scanNotify, setScanNotify] = useState(kakaoScanNotify);
  const [competitorNotify, setCompetitorNotify] = useState(kakaoCompetitorNotify);
  const [notifySaving, setNotifySaving] = useState(false);
  const [cardChanging, setCardChanging] = useState(false);
  const [cardError, setCardError] = useState("");

  const supabase = createClient();

  const getToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("인증 세션이 만료되었습니다. 다시 로그인해 주세요.");
    return session.access_token;
  };

  const handlePhoneSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneSaving(true);
    setPhoneSaved(false);
    try {
      const token = await getToken();
      await updatePhone(phone, token);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleNotifyToggle = async (field: "scan" | "competitor", value: boolean) => {
    if (field === "scan") setScanNotify(value);
    else setCompetitorNotify(value);

    setNotifySaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/settings/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          field === "scan"
            ? { kakao_scan_notify: value }
            : { kakao_competitor_notify: value }
        ),
      });
      if (!res.ok) {
        if (field === "scan") setScanNotify(!value);
        else setCompetitorNotify(!value);
      }
    } catch {
      if (field === "scan") setScanNotify(!value);
      else setCompetitorNotify(!value);
    } finally {
      setNotifySaving(false);
    }
  };

  const handleCardChange = async () => {
    setCardChanging(true);
    setCardError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const effectiveUserId = userId ?? session?.user?.id;
      if (!effectiveUserId) {
        setCardError("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
        return;
      }

      const { loadTossPayments } = await import("@tosspayments/payment-sdk");
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      );
      await tossPayments.requestBillingAuth("카드", {
        customerKey: `customer_${effectiveUserId}`,
        successUrl: `${window.location.origin}/payment/card-update`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
      // requestBillingAuth는 리디렉션이 발생하므로 아래 코드는 실행되지 않음
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "카드 변경 중 오류가 발생했습니다.";
      // 사용자가 직접 닫은 경우는 오류로 표시하지 않음
      if (!msg.includes("PAY_PROCESS_CANCELED")) {
        setCardError(msg);
      }
    } finally {
      setCardChanging(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/settings/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCancelled(true);
        setShowConfirm(false);
      } else {
        const err = await res.json().catch(() => ({}));
        const code = err?.detail?.code ?? "";
        setCancelError(
          code === "NO_ACTIVE_SUBSCRIPTION"
            ? "활성 구독이 없습니다. 이미 해지되었거나 구독 내역이 없습니다."
            : "해지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      }
    } finally {
      setCancelling(false);
    }
  };

  const isActiveSubscription =
    subscriptionStatus === "active" || subscriptionStatus === "grace_period";

  if (cancelled) {
    return (
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500">
          구독 해지가 완료되었습니다. 현재 기간 만료일까지 서비스를 계속 이용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 카카오 알림 수신 번호 */}
      <div className="border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-1">카카오 알림톡 수신 번호</h3>
        <p className="text-sm text-gray-400 mb-3">AI 노출 변화, 주간 리포트 알림을 받을 번호를 입력하세요.</p>
        <form onSubmit={handlePhoneSave} className="flex flex-col sm:flex-row gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={phoneSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {phoneSaving ? "저장 중..." : phoneSaved ? "저장됨 ✓" : "저장"}
          </button>
        </form>
      </div>

      {/* 카카오 알림 수신 설정 */}
      <div className="border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-1">카카오 알림 수신 설정</h3>
        <p className="text-sm text-gray-400 mb-4">알림톡 수신 번호가 등록된 경우에만 발송됩니다.</p>
        <div className="space-y-3">
          {[
            { label: "스캔 완료 알림", desc: "AI 스캔이 완료되면 결과를 알림톡으로 받습니다.", value: scanNotify, field: "scan" as const },
            { label: "경쟁사 순위변동 알림", desc: "경쟁사가 내 점수를 추월하면 즉시 알림을 받습니다.", value: competitorNotify, field: "competitor" as const },
          ].map(({ label, desc, value, field }) => (
            <div key={field} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-gray-700">{label}</div>
                <div className="text-sm text-gray-400 mt-0.5">{desc}</div>
              </div>
              <button
                role="switch"
                aria-checked={value}
                disabled={notifySaving}
                onClick={() => handleNotifyToggle(field, !value)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${value ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 결제 카드 변경 */}
      {isActiveSubscription && (
        <div className="border border-gray-100 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-gray-800">결제 카드</h3>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            등록된 결제 카드를 변경합니다. 새 카드 인증 후 다음 결제부터 적용됩니다.
          </p>
          {cardError && (
            <div className="mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <p className="text-sm text-red-600">{cardError}</p>
            </div>
          )}
          <button
            onClick={handleCardChange}
            disabled={cardChanging}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {cardChanging ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                카드 인증 페이지 이동 중...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" strokeWidth={1.5} />
                카드 변경
              </>
            )}
          </button>
        </div>
      )}

      {/* 구독 해지 */}
      <div className="border-t border-gray-100 pt-4">
        {!showConfirm ? (
          <button
            onClick={() => { setShowConfirm(true); setCancelError(""); }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            구독 해지
          </button>
        ) : (
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-sm text-red-700 mb-3">
              정말 해지하시겠습니까? 현재 구독 기간 만료일까지는 서비스를 계속 이용할 수 있습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelling ? "처리 중..." : "해지 확인"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
            {cancelError && (
              <p className="text-red-500 text-sm mt-2">{cancelError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
