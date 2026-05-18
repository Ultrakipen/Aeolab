"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackClaimFunnel } from "@/lib/analytics";

function ClaimedContent() {
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";
  const trialId = sp.get("trial_id") ?? undefined;
  const sentRef = useRef(false);

  const [resendState, setResendState] = useState<"idle" | "loading" | "sent" | "error">("idle");

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    trackClaimFunnel("success", {
      page: "claimed",
      trial_id: trialId,
      has_email: Boolean(email),
    });
  }, [email, trialId]);

  const signupHref = trialId
    ? `/signup?trial_id=${encodeURIComponent(trialId)}&email=${encodeURIComponent(email)}`
    : email
      ? `/signup?email=${encodeURIComponent(email)}`
      : "/signup";

  async function handleResend() {
    if (!trialId || !email || resendState === "loading") return;
    setResendState("loading");
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://aeolab.co.kr";
      const res = await fetch(`${backendUrl}/api/scan/trial-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trial_id: trialId, email, resend: true }),
      });
      if (res.ok) {
        setResendState("sent");
      } else {
        setResendState("error");
      }
    } catch {
      setResendState("error");
    }
  }

  return (
    <main className="min-h-[80vh] bg-gradient-to-b from-blue-50 to-white px-4 md:px-8 py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl bg-white border border-blue-100 p-6 md:p-10 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 md:h-20 md:w-20 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 md:h-10 md:w-10"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
              메일함을 확인해주세요
            </h1>
            <p className="mt-3 text-sm md:text-base text-gray-700">
              {email ? (
                <>
                  <span className="font-semibold text-blue-700 break-all">
                    {email}
                  </span>
                  으로 보낸 링크를 클릭하면 가입 + 결과 보관이 완료됩니다.
                </>
              ) : (
                <>입력하신 이메일로 보낸 링크를 클릭하면 가입 + 결과 보관이 완료됩니다.</>
              )}
            </p>
          </div>

          <div className="mt-6 md:mt-8 rounded-xl bg-blue-50 border border-blue-100 px-4 py-4 md:px-6 md:py-5 text-sm md:text-base text-blue-900">
            <p className="font-semibold mb-1">3분 안에 메일이 안 오면</p>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li>스팸함 / 프로모션 탭을 확인해주세요</li>
              <li>이메일 주소에 오타가 없는지 다시 확인해주세요</li>
              <li>그래도 안 오면 아래 재발송 버튼을 눌러주세요</li>
            </ul>
          </div>

          {/* 재발송 결과 메시지 */}
          {resendState === "sent" && (
            <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm md:text-base text-green-800 text-center font-medium">
              메일을 다시 발송했습니다. 받은편지함을 확인해주세요.
            </div>
          )}
          {resendState === "error" && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm md:text-base text-red-800 text-center">
              발송에 실패했습니다. 아래 버튼으로 직접 가입하거나 문의해주세요.
            </div>
          )}

          <div className="mt-6 md:mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href={signupHref}
              className="flex-1 text-center rounded-xl bg-blue-600 px-4 py-3 md:py-4 text-sm md:text-base font-bold text-white hover:bg-blue-700 transition-colors"
            >
              지금 바로 가입하기
            </Link>
            <button
              onClick={handleResend}
              disabled={resendState === "loading" || resendState === "sent" || !trialId}
              className="flex-1 text-center rounded-xl border border-gray-300 bg-white px-4 py-3 md:py-4 text-sm md:text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendState === "loading"
                ? "발송 중..."
                : resendState === "sent"
                  ? "발송 완료"
                  : "메일 재발송"}
            </button>
          </div>

          <p className="mt-4 text-xs md:text-sm text-gray-500 text-center">
            진단 결과는 30일간 보관됩니다. 가입을 완료하시면 영구 보관됩니다.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm md:text-base text-blue-600 hover:text-blue-800 underline-offset-4 hover:underline"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function TrialClaimedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[60vh] flex items-center justify-center text-sm md:text-base text-gray-500">
          불러오는 중...
        </main>
      }
    >
      <ClaimedContent />
    </Suspense>
  );
}
