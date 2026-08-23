"use client";

import { useEffect, useState } from "react";
import { createClient, getSafeSession } from "@/lib/supabase/client";
import { updatePhone } from "@/lib/api";

interface Props {
  planName: string;
  amount: number;
  highlight: boolean;
  signupHref: string;
  firstMonthAmount?: number; // 첫 달 50% 할인가 (있으면 신규 가입자에게 적용)
  ctaText?: string;
}

// 카카오 알림톡 발송에 필요한 최소 형식 — 엄격한 통신사 검증은 아님(가입폼과 동일 수준)
const PHONE_PATTERN = /^01[016789]-?\d{3,4}-?\d{4}$/;

export function PayButton({ planName, amount, highlight, signupHref, firstMonthAmount, ctaText }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // 이미 로그인한 사용자에게는 "회원가입" 문구 대신 결제 지향 문구를 보여줌
  useEffect(() => {
    (async () => {
      const session = await getSafeSession();
      setIsLoggedIn(!!session?.user);
    })();
  }, []);

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

  // 모달 열릴 때 기존 등록된 전화번호 프리필 — 이미 설정에서 입력한 사용자는 재입력 불필요
  // (2026-08-24: 활성 구독 5건 전부 phone=NULL이라 카카오 알림톡이 전면 미작동이던 것을 발견해 신설)
  useEffect(() => {
    if (!showConfirm) return;
    setPhoneError("");
    (async () => {
      const session = await getSafeSession();
      const user = session?.user ?? null;
      if (!user) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.phone) setPhone(data.phone);
    })();
  }, [showConfirm]);

  const displayCta = isLoggedIn && ctaText === "1분 무료 회원가입" ? "결제하기" : (ctaText ?? "시작하기");

  const chargeAmount = firstMonthAmount && isFirstTime ? firstMonthAmount : amount;

  const handleConfirm = async () => {
    setPhoneError("");
    setLoading(true);
    // 전화번호 검증 실패 시에는 모달을 닫지 않고 그대로 두어 사용자가 바로 고칠 수 있게 함
    let keepModalOpen = false;
    try {
      const session = await getSafeSession();
      const user = session?.user ?? null;

      if (!user || !session) {
        // 비로그인은 가입 유도만 — 아직 저장할 계정이 없으므로 전화번호를 여기서 요구하지 않음
        window.location.href = `${signupHref}?plan=${encodeURIComponent(planName)}&amount=${chargeAmount}`;
        return;
      }

      const trimmedPhone = phone.trim();
      if (!trimmedPhone) {
        setPhoneError("카카오 알림 수신용 전화번호를 입력해 주세요.");
        keepModalOpen = true;
        return;
      }
      if (!PHONE_PATTERN.test(trimmedPhone)) {
        setPhoneError("올바른 휴대폰 번호 형식이 아닙니다. 예: 010-1234-5678");
        keepModalOpen = true;
        return;
      }

      // 결제 진행 여부와 무관하게 먼저 저장 — 실패해도 결제 흐름은 막지 않음(카카오 알림은 부가기능)
      try {
        await updatePhone(trimmedPhone, session.access_token);
      } catch (phoneSaveErr) {
        console.warn("전화번호 저장 실패(결제는 계속 진행):", phoneSaveErr);
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
      if (!keepModalOpen) setShowConfirm(false);
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
        {displayCta}
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

            <p className="text-sm text-gray-500 mb-3">
              {firstMonthAmount && isFirstTime
                ? `첫 달 ${firstMonthAmount.toLocaleString()}원 결제 후, 30일 뒤부터 매월 ${amount.toLocaleString()}원이 자동으로 결제됩니다. 언제든지 설정에서 해지할 수 있습니다.`
                : "카드를 등록하면 매월 자동으로 결제됩니다. 언제든지 설정에서 해지할 수 있습니다."}
            </p>

            <div className="mb-5">
              <label htmlFor="pay-confirm-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                카카오 알림 받을 전화번호
              </label>
              <input
                id="pay-confirm-phone"
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                placeholder="010-1234-5678"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                  phoneError ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-blue-200"
                }`}
              />
              {phoneError ? (
                <p className="text-sm text-red-600 mt-1">{phoneError}</p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">AI 노출 점수 변동·경쟁사 알림을 카카오톡으로 받습니다.</p>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-5">
              구독 시작일로부터 7일 이내 청약철회 신청 가능 (단, 서비스 이용 시 제한됩니다) ·{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">이용약관</a>
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
