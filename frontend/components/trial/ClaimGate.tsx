"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackClaimFunnel } from "@/lib/analytics";

interface ClaimGateProps {
  trialId?: string;
  initialEmail?: string;
}

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9-+()\s]{7,20}$/;

/**
 * Trial 결과 → 30일 보관 + 재진단 알림 게이트
 *
 * - 이메일 1줄 + (선택) 휴대폰 + 마케팅 동의
 * - POST /api/scan/trial-claim
 * - 성공 시 /trial/claimed?email=... 이동
 * - GA4: claim_gate_shown / claim_submitted / claim_success
 * - 백엔드 미배포(404/5xx) 시: 폼은 그대로 보이지만 안내문 출력 (graceful)
 *
 * trialId가 없으면 컴포넌트 자체를 숨김 (백엔드가 trial_id 미응답 시).
 */
export default function ClaimGate({
  trialId,
  initialEmail = "",
}: ClaimGateProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const shownRef = useRef(false);
  const [claimStats, setClaimStats] = useState<{ total_claims: number } | null>(null);

  useEffect(() => {
    if (!trialId || shownRef.current) return;
    shownRef.current = true;
    trackClaimFunnel("gate_shown", { trial_id: trialId });

    // 소셜 프루프 통계 fetch (공개 엔드포인트)
    fetch(`${BACKEND}/api/scan/claim-stats`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then((d) => { if (d?.total_claims > 0) setClaimStats(d); });
  }, [trialId]);

  if (!trialId) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const _email = email.trim();
    if (!_email) {
      setError("이메일을 입력해주세요");
      return;
    }
    if (!EMAIL_RE.test(_email)) {
      setError("이메일 형식을 확인해주세요");
      return;
    }
    const _phone = phone.trim();
    if (_phone && !PHONE_RE.test(_phone)) {
      setError("휴대폰 번호 형식을 확인해주세요");
      return;
    }

    setSubmitting(true);
    trackClaimFunnel("submitted", { trial_id: trialId });

    try {
      const res = await fetch(`${BACKEND}/api/scan/trial-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trial_id: trialId,
          email: _email,
          phone: _phone || undefined,
          marketing_opt_in: marketingOptIn,
        }),
      });
      if (!res.ok) {
        let msg = "보관 신청에 실패했습니다. 잠시 후 다시 시도해주세요.";
        try {
          const j = (await res.json()) as { detail?: string };
          if (j?.detail) msg = j.detail;
        } catch {
          /* ignore parse error */
        }
        throw new Error(msg);
      }

      trackClaimFunnel("success", { trial_id: trialId });
      router.push(`/trial/claimed?email=${encodeURIComponent(_email)}`);
    } catch (err) {
      const m =
        err instanceof Error
          ? err.message
          : "보관 신청에 실패했습니다.";
      setError(m);
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="claim-gate-title"
      className="mt-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50 p-4 md:p-8 shadow-sm"
    >
      <header className="mb-4 md:mb-6">
        <h3
          id="claim-gate-title"
          className="text-xl md:text-2xl font-bold text-blue-900 leading-snug"
        >
          결과를 저장하지 않으면 7일 후 삭제됩니다
        </h3>
        <p className="mt-2 text-sm md:text-base text-blue-800/90">
          이메일 하나로 30일 보관 + 점수 변화 알림
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-3 md:space-y-4" noValidate>
        {claimStats && claimStats.total_claims >= 5 && (
          <div className="flex items-center gap-2 mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <span className="text-lg">👥</span>
            <p className="text-sm text-blue-800 font-medium">
              지금까지 <strong>{claimStats.total_claims.toLocaleString()}명</strong>이 결과를 저장했습니다
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="claim-email"
            className="block text-sm md:text-base font-medium text-gray-800 mb-1"
          >
            이메일 <span className="text-red-500">*</span>
          </label>
          <input
            id="claim-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm md:text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label
            htmlFor="claim-phone"
            className="block text-sm md:text-base font-medium text-gray-800 mb-1"
          >
            휴대폰 <span className="text-gray-500">(선택)</span>
          </label>
          <input
            id="claim-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm md:text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <p className="mt-1 text-xs md:text-sm text-gray-500">
            카카오 알림톡으로 점수 변화를 알려드릴 때 사용합니다.
          </p>
        </div>

        <label className="flex items-start gap-2 md:gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-1 h-4 w-4 md:h-5 md:w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
          />
          <span className="text-sm md:text-base text-gray-700 leading-snug">
            마케팅 정보 수신에 동의합니다 <span className="text-gray-500">(선택)</span> —
            업종 트렌드·신규 기능 안내 메일을 받습니다.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm md:text-base text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 md:py-4 text-sm md:text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {submitting ? "보관 신청 중..." : "30일 보관 + 재진단 알림 받기"}
        </button>

        <p className="text-xs md:text-sm text-gray-500 text-center">
          가입은 다음 단계에서 진행됩니다. 결과는 30일간 보관됩니다.
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          <a href="/pricing" className="underline hover:text-gray-700">요금제 전체 보기</a>
        </p>
      </form>
    </section>
  );
}
