"use client";

import { useState } from "react";
import { updatePhone, reactivateSubscription, ApiError } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import { CreditCard, Bell, Phone, AlertTriangle, CheckCircle2, X, ArrowRight } from "lucide-react";

// 해지 사유 선택지
const CANCEL_REASONS = [
  {
    id: "complex",
    label: "사용이 복잡해요",
    response: "가이드 페이지에서 단계별 사용법을 확인해보세요. 5분이면 핵심 기능을 모두 사용할 수 있습니다.",
    link: "/guide",
    linkLabel: "가이드 페이지 보기",
  },
  {
    id: "no_effect",
    label: "효과를 못 느꼈어요",
    response: "스캔 결과의 '지금 할 것' 액션을 실행하셨나요? 스마트플레이스 소개글에 Q&A 1개 추가 후 7일 뒤 변화를 확인해보세요.",
    link: null,
    linkLabel: null,
  },
  {
    id: "expensive",
    label: "가격이 부담돼요",
    response: "Basic 플랜(월 11,900원)으로 다운그레이드하면 핵심 기능을 더 저렴하게 유지할 수 있습니다.",
    link: "/pricing",
    linkLabel: "Basic 플랜 보기",
  },
  {
    id: "pause",
    label: "잠시 쉬려고요",
    response: "현재 구독 기간 만료일까지는 서비스를 계속 이용할 수 있습니다. 재가입 시 데이터는 그대로 유지됩니다.",
    link: null,
    linkLabel: null,
  },
] as const;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  currentPhone?: string;
  kakaoScanNotify?: boolean;
  kakaoCompetitorNotify?: boolean;
  subscriptionStatus?: string;
  subscriptionEndAt?: string | null;
  userId?: string;
  subscriptionDays?: number;
  competitorCount?: number;
  actionCount?: number;
  refundEligible?: boolean;
  cardDisplay?: string | null;
}

export function SettingsClient({
  currentPhone,
  kakaoScanNotify = true,
  kakaoCompetitorNotify = true,
  subscriptionStatus,
  subscriptionEndAt = null,
  userId,
  subscriptionDays = 0,
  competitorCount = 0,
  actionCount = 0,
  refundEligible = false,
  cardDisplay = null,
}: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [scanNotify, setScanNotify] = useState(kakaoScanNotify);
  const [competitorNotify, setCompetitorNotify] = useState(kakaoCompetitorNotify);
  const [notifySaving, setNotifySaving] = useState(false);
  const [cardChanging, setCardChanging] = useState(false);
  const [cardError, setCardError] = useState("");
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState("");
  const [reactivated, setReactivated] = useState(false);

  const getToken = async (): Promise<string> => {
    const session = await getSafeSession();
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
      const session = await getSafeSession();
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
        failUrl: `${window.location.origin}/payment/fail?from=card-update`,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "USER_CANCEL") {
        const msg = err instanceof Error ? err.message : "카드 변경 중 오류가 발생했습니다.";
        setCardError(msg);
      }
    } finally {
      setCardChanging(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    setReactivateError("");
    try {
      const token = await getToken();
      await reactivateSubscription(token);
      setReactivated(true);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: unknown) {
      setReactivateError(
        err instanceof ApiError ? err.message : "재활성화 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setReactivating(false);
    }
  };

  const isActiveSubscription =
    subscriptionStatus === "active" || subscriptionStatus === "grace_period";
  const isSuspended = subscriptionStatus === "suspended";
  // subscriptionEndAt이 날짜만 있는 문자열("2026-07-15")이면 그 날짜 00:00 UTC(09:00 KST)로
  // 파싱되어 마지막 날 오전 9시부터 이미 만료 취급되던 버그 — 날짜만 온 경우 하루를 더해
  // 그 날짜 전체를 포함하도록 보정 (백엔드 plan_gate.py _end_at_in_future와 동일 로직)
  const endAtMs = subscriptionEndAt
    ? new Date(subscriptionEndAt).getTime() + (subscriptionEndAt.length <= 10 ? 86400000 : 0)
    : 0;
  const canReactivate =
    subscriptionStatus === "cancelled" &&
    !!subscriptionEndAt &&
    endAtMs > Date.now();

  if (cancelled) {
    return (
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-800">
          {refunded
            ? "구독 해지 및 전액 환불이 완료되었습니다. 영업일 기준 3~5일 내 결제 수단으로 환불됩니다."
            : "구독 해지가 완료되었습니다. 현재 기간 만료일까지 서비스를 계속 이용할 수 있습니다."}
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
            <p className="text-sm text-gray-600">AI 노출 변화, 주간 리포트 알림을 받을 번호</p>
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
                ? "bg-emerald-700 text-white"
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
            <p className="text-sm text-gray-600">수신 번호가 등록된 경우에만 발송됩니다.</p>
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
                <div className="text-sm text-gray-600 mt-0.5">{desc}</div>
              </div>
              <button
                role="switch"
                aria-checked={value}
                aria-label={label}
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

      {/* ── 결제 카드 변경 (활성 구독자 + 정지 상태 — 정지 상태는 카드 변경 성공 시 즉시 재결제 시도) ── */}
      {(isActiveSubscription || isSuspended) && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-indigo-600" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">결제 카드</h3>
              <p className="text-sm text-gray-600">
                {isSuspended
                  ? "결제가 계속 실패해 구독이 정지되었습니다. 카드를 변경하면 즉시 재결제를 시도합니다."
                  : "새 카드 인증 후 다음 결제부터 적용됩니다."}
              </p>
            </div>
          </div>
          {cardDisplay ? (
            <div className="bg-white rounded-lg px-4 py-3 border border-gray-100">
              <p className="text-sm text-gray-600 mb-0.5">현재 등록된 카드</p>
              <p className="text-base font-semibold text-gray-800">{cardDisplay}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">등록된 카드 정보를 불러올 수 없습니다.</p>
          )}
          {cardError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{cardError}</p>
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

      {/* ── 해지 취소(재활성화) — cancelled 상태이면서 잔여기간(end_at)이 아직 남은 경우만 ── */}
      {canReactivate && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">해지 취소</h3>
              <p className="text-sm text-gray-600">아직 구독 기간이 남아 있습니다. 지금 재활성화하면 계속 이용할 수 있습니다.</p>
            </div>
          </div>
          {reactivated ? (
            <p className="text-sm text-emerald-700 font-medium">재활성화가 완료되었습니다. 잠시 후 새로고침됩니다...</p>
          ) : (
            <>
              {reactivateError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{reactivateError}</p>
                </div>
              )}
              <button
                onClick={handleReactivate}
                disabled={reactivating}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-700 text-white text-base font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {reactivating ? "재활성화 중..." : "구독 재활성화"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 구독 해지 (위험 영역) ── */}
      {/* suspended 상태는 이미 해지할 활성 구독이 없으므로(카드 변경 섹션과 동일 게이트) 숨김 */}
      {isActiveSubscription && (
        <div className="border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.8} />
            <h3 className="text-base font-semibold text-red-700">구독 해지</h3>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-gray-600 flex-1">구독을 해지하면 자동 스캔과 알림이 중단됩니다. 현재 구독 기간이 끝날 때까지는 서비스를 계속 이용할 수 있습니다.</p>
            <button
              onClick={() => { setShowCancelModal(true); setCancelError(""); setSelectedReason(null); }}
              className="w-full sm:w-auto text-sm text-red-700 hover:text-red-800 font-medium border border-red-200 px-4 py-2.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              구독 해지
            </button>
          </div>
        </div>
      )}

      {/* ── 해지 방어 모달 ── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            {/* 모달 헤더 */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">구독을 해지하시겠습니까?</h3>
                <p className="text-sm text-gray-600 mt-0.5">만료일이 지나면 다음 데이터에 대한 분석 기능을 이용할 수 없게 됩니다.</p>
              </div>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-gray-600 hover:text-gray-700 transition-colors ml-3 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 7일 청약철회 자동환불 자격 안내 */}
            {refundEligible && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-emerald-800 font-medium">
                  구독 시작 7일 이내 + 서비스 미이용 상태로 확인되어, 해지 시 결제한 금액이 전액 환불됩니다.
                </p>
              </div>
            )}

            {/* 잃게 되는 데이터 요약 */}
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-red-800">
                <span className="text-red-700 font-bold shrink-0">•</span>
                <span>AI 노출 이력 <strong>{subscriptionDays}일</strong> 기록</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-red-800">
                <span className="text-red-700 font-bold shrink-0">•</span>
                <span>경쟁사 비교 데이터 <strong>{competitorCount}개</strong> 사업장</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-red-800">
                <span className="text-red-700 font-bold shrink-0">•</span>
                <span>행동→점수 변화 기록 <strong>{actionCount}건</strong></span>
              </div>
              <p className="text-sm text-red-700 mt-1 pt-2 border-t border-red-100">
                데이터 자체는 삭제되지 않고 보관되며, 재가입 시 그대로 이어서 이용할 수 있습니다.
              </p>
            </div>

            {/* 해지 사유 선택 */}
            <p className="text-sm font-medium text-gray-700 mb-2">불편하신 점이 있으신가요?</p>
            <div className="space-y-2 mb-4">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReason(r.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    selectedReason === r.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* 선택된 사유 맞춤 응답 */}
            {selectedReason && (() => {
              const reason = CANCEL_REASONS.find(r => r.id === selectedReason);
              if (!reason) return null;
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-sm text-blue-800 leading-relaxed">{reason.response}</p>
                  {reason.link && reason.linkLabel && (
                    <a
                      href={reason.link}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800 mt-2"
                    >
                      {reason.linkLabel}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })()}

            {cancelError && (
              <p className="text-sm text-red-700 mb-3">{cancelError}</p>
            )}

            {/* 액션 버튼 — 유지하기가 주 버튼 */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 text-base font-bold bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors"
              >
                유지하기
              </button>
              <button
                onClick={async () => {
                  setCancelling(true);
                  try {
                    const token = await getToken();
                    const res = await fetch(`${BACKEND}/api/settings/cancel`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) {
                      const body = await res.json().catch(() => ({}));
                      setRefunded(Boolean(body?.refunded));
                      setCancelled(true);
                      setShowCancelModal(false);
                      // router.refresh()는 상단 "구독 중" 배지가 실제로는 즉시 갱신되지 않는
                      // 경우가 실측 확인됨(2026-07-07 라이브 QA) — 배너를 잠깐 보여준 뒤
                      // 완전한 페이지 새로고침으로 서버 렌더 데이터를 확실히 동기화
                      setTimeout(() => window.location.reload(), 2500);
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
                }}
                disabled={cancelling}
                className="w-full sm:w-auto text-sm text-red-700 border border-red-200 px-4 py-3 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {cancelling ? "처리 중..." : "그래도 해지"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
