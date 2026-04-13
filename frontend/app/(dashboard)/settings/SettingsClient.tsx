"use client";

import { useState } from "react";
import { updatePhone } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { CreditCard, Bell, Phone, Camera, AlertTriangle, CheckCircle2 } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  currentPhone?: string;
  kakaoScanNotify?: boolean;
  kakaoCompetitorNotify?: boolean;
  subscriptionStatus?: string;
  userId?: string;
  instagramUsername?: string;
  instagramFollowerCount?: number;
  instagramPostCount30d?: number;
}

export function SettingsClient({
  currentPhone,
  kakaoScanNotify = true,
  kakaoCompetitorNotify = true,
  subscriptionStatus,
  userId,
  instagramUsername: initIgUsername = "",
  instagramFollowerCount: initIgFollower,
  instagramPostCount30d: initIgPost,
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

  const [igUsername, setIgUsername] = useState(initIgUsername);
  const [igFollower, setIgFollower] = useState(initIgFollower?.toString() ?? "");
  const [igPost, setIgPost] = useState(initIgPost?.toString() ?? "");
  const [igSaving, setIgSaving] = useState(false);
  const [igSaved, setIgSaved] = useState(false);
  const [igError, setIgError] = useState("");

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "카드 변경 중 오류가 발생했습니다.";
      if (!msg.includes("PAY_PROCESS_CANCELED")) {
        setCardError(msg);
      }
    } finally {
      setCardChanging(false);
    }
  };

  const handleIgSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIgSaving(true);
    setIgSaved(false);
    setIgError("");
    try {
      const token = await getToken();
      const body: Record<string, string | number> = {};
      if (igUsername.trim()) body.instagram_username = igUsername.trim().replace(/^@/, "");
      if (igFollower.trim()) body.instagram_follower_count = parseInt(igFollower, 10) || 0;
      if (igPost.trim()) body.instagram_post_count_30d = parseInt(igPost, 10) || 0;

      const res = await fetch(`${BACKEND}/api/settings/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIgSaved(true);
        setTimeout(() => setIgSaved(false), 3000);
      } else {
        setIgError("저장 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } catch {
      setIgError("네트워크 오류가 발생했습니다.");
    } finally {
      setIgSaving(false);
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
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-800">
          구독 해지가 완료되었습니다. 현재 기간 만료일까지 서비스를 계속 이용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      {/* ── 카카오 알림톡 수신 번호 ── */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-yellow-600" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">카카오 알림톡 수신 번호</h3>
            <p className="text-sm text-gray-500">AI 노출 변화, 주간 리포트 알림을 받을 번호</p>
          </div>
        </div>
        <form onSubmit={handlePhoneSave} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={phoneSaving}
            className={`w-full sm:w-auto px-5 py-3 text-base font-medium rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 ${
              phoneSaved
                ? "bg-emerald-500 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {phoneSaving ? "저장 중..." : phoneSaved ? "저장됨 ✓" : "저장"}
          </button>
        </form>
      </div>

      {/* ── 카카오 알림 수신 설정 ── */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-blue-600" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">카카오 알림 수신 설정</h3>
            <p className="text-sm text-gray-500">수신 번호가 등록된 경우에만 발송됩니다.</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "스캔 완료 알림",     desc: "AI 스캔이 완료되면 결과를 알림톡으로 받습니다.",       value: scanNotify,       field: "scan" as const },
            { label: "경쟁사 순위변동 알림", desc: "경쟁사가 내 점수를 추월하면 즉시 알림을 받습니다.",  value: competitorNotify, field: "competitor" as const },
          ].map(({ label, desc, value, field }) => (
            <div key={field} className="flex items-center justify-between gap-4 bg-white rounded-lg px-4 py-3.5 border border-gray-100">
              <div className="min-w-0">
                <div className="text-sm md:text-base font-medium text-gray-700">{label}</div>
                <div className="text-sm text-gray-400 mt-0.5">{desc}</div>
              </div>
              <button
                role="switch"
                aria-checked={value}
                disabled={notifySaving}
                onClick={() => handleNotifyToggle(field, !value)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${value ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── 인스타그램 AI 신호 연동 ── */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-pink-600" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-gray-800">인스타그램 AI 신호 연동</h3>
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">베타</span>
            </div>
            <p className="text-sm text-gray-500">ChatGPT·Perplexity AI 인용 가능성을 측정합니다.</p>
          </div>
        </div>
        <form onSubmit={handleIgSave} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              계정명 <span className="text-gray-400 font-normal">(@ 없이 입력)</span>
            </label>
            <input
              type="text"
              value={igUsername}
              onChange={(e) => setIgUsername(e.target.value)}
              placeholder="mycafe_seoul"
              className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">팔로워 수</label>
              <input
                type="number"
                min="0"
                value={igFollower}
                onChange={(e) => setIgFollower(e.target.value)}
                placeholder="1200"
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">월 평균 게시물</label>
              <input
                type="number"
                min="0"
                value={igPost}
                onChange={(e) => setIgPost(e.target.value)}
                placeholder="8"
                className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
          </div>
          {igError && (
            <p className="text-sm text-red-500">{igError}</p>
          )}
          <button
            type="submit"
            disabled={igSaving}
            className={`w-full sm:w-auto px-5 py-3 text-base font-medium rounded-lg transition-colors disabled:opacity-50 ${
              igSaved
                ? "bg-emerald-500 text-white"
                : "bg-pink-600 text-white hover:bg-pink-700"
            }`}
          >
            {igSaving ? "저장 중..." : igSaved ? "✓ 연동 완료" : "저장"}
          </button>
        </form>
      </div>

      {/* ── 결제 카드 변경 ── */}
      {isActiveSubscription && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-indigo-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">결제 카드</h3>
              <p className="text-sm text-gray-500">새 카드 인증 후 다음 결제부터 적용됩니다.</p>
            </div>
          </div>
          {cardError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{cardError}</p>
            </div>
          )}
          <button
            onClick={handleCardChange}
            disabled={cardChanging}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white text-base font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {cardChanging ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                카드 인증 페이지 이동 중...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" strokeWidth={1.8} />
                카드 변경
              </>
            )}
          </button>
        </div>
      )}

      {/* ── 구독 해지 (위험 영역) ── */}
      <div className="border border-red-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.8} />
          <h3 className="text-base font-semibold text-red-600">위험 영역</h3>
        </div>
        {!showConfirm ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-gray-500 flex-1">구독을 해지하면 자동 스캔과 알림이 중단됩니다.</p>
            <button
              onClick={() => { setShowConfirm(true); setCancelError(""); }}
              className="w-full sm:w-auto text-sm text-red-500 hover:text-red-700 font-medium border border-red-200 px-4 py-2.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              구독 해지
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-red-50 rounded-lg px-3 py-2.5">
              <p className="text-sm text-red-700">
                정말 해지하시겠습니까? 현재 구독 기간 만료일까지는 서비스를 계속 이용할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full sm:w-auto text-base bg-red-600 text-white px-5 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                {cancelling ? "처리 중..." : "해지 확인"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full sm:w-auto text-base border border-gray-200 text-gray-600 px-5 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
            {cancelError && (
              <p className="text-sm text-red-500">{cancelError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
