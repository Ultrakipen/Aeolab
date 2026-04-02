"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RegisterBusinessForm } from "@/components/dashboard/RegisterBusinessForm";
import Link from "next/link";
import { CheckCircle, ChevronRight, Bell, Store, Search, BarChart2, Lightbulb } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Step = 1 | 2 | 3;

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { num: 1, label: "환영" },
    { num: 2, label: "가게 등록" },
    { num: 3, label: "완료" },
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-6 md:mb-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={
                "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors " +
                (current >= s.num
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500")
              }
            >
              {current > s.num ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s.num
              )}
            </div>
            <span
              className={
                "text-sm font-medium hidden sm:block " +
                (current >= s.num ? "text-blue-600" : "text-gray-400")
              }
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={"w-8 md:w-12 h-0.5 " + (current > s.num ? "bg-blue-600" : "bg-gray-200")} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
      } else {
        router.push("/login");
      }
    })();
  }, [router]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.slice(0, 3) + "-" + digits.slice(3);
    return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
  };

  const handlePhoneNext = async () => {
    if (phone && phone.replace(/\D/g, "").length < 10) {
      setPhoneError("올바른 전화번호를 입력해주세요.");
      return;
    }
    setPhoneError("");

    if (phone) {
      setPhoneSaving(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          await fetch(`${BACKEND}/api/settings/me`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ phone }),
          });
        }
      } catch {
        // 전화번호 저장 실패해도 계속 진행
      } finally {
        setPhoneSaving(false);
      }
    }
    setStep(2);
  };

  const handleBusinessRegistered = () => {
    setStep(3);
    setTimeout(() => {
      router.push("/dashboard");
    }, 2500);
  };

  // ── STEP 1: 환영 + 전화번호 ─────────────────────────────────────
  if (step === 1) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <Link href="/" className="text-2xl md:text-3xl font-bold text-blue-600">
              AEOlab
            </Link>
          </div>

          <StepIndicator current={1} />

          <div className="bg-white rounded-2xl shadow-md p-6 md:p-8">
            {/* 환영 메시지 */}
            <div className="text-center mb-6 md:mb-8">
              <div className="text-4xl mb-3">🎉</div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                AEOlab에 오신 것을 환영합니다
              </h1>
              <p className="text-base md:text-lg text-gray-500">
                AI 검색에서 내 가게가 얼마나 노출되는지 확인해보세요
              </p>
            </div>

            {/* 서비스 특징 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 md:mb-8">
              {[
                { Icon: Search, color: "bg-blue-50 text-blue-600", title: "AI 검색 분석", desc: "7개 AI에서 내 가게 노출 현황" },
                { Icon: BarChart2, color: "bg-violet-50 text-violet-600", title: "경쟁사 비교", desc: "주변 경쟁 업체와 비교 분석" },
                { Icon: Lightbulb, color: "bg-amber-50 text-amber-600", title: "개선 가이드", desc: "AI 브리핑 노출 높이는 방법" },
              ].map((item) => (
                <div key={item.title} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className={"w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2 " + item.color}>
                    <item.Icon className="w-5 h-5" strokeWidth={1.8} />
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* 전화번호 입력 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 text-blue-500 shrink-0" />
                <label className="text-base font-medium text-gray-700">
                  카카오 알림톡 수신 번호{" "}
                  <span className="text-sm text-gray-400 font-normal">(선택)</span>
                </label>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                스캔 완료, 경쟁사 순위 변동 시 카카오톡으로 알림을 받을 수 있습니다. 나중에 설정에서도 입력 가능합니다.
              </p>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="010-0000-0000"
                className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
              />
              {phoneError && (
                <p className="text-sm text-red-500 mt-1.5">{phoneError}</p>
              )}
            </div>

            {/* CTA 버튼 */}
            <button
              type="button"
              onClick={handlePhoneNext}
              disabled={phoneSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {phoneSaving ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  저장 중...
                </>
              ) : (
                <>
                  내 가게 등록하고 시작하기
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full mt-3 text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
            >
              전화번호 없이 건너뛰기
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── STEP 2: 사업장 등록 ──────────────────────────────────────────
  if (step === 2) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <Link href="/" className="text-2xl md:text-3xl font-bold text-blue-600">
              AEOlab
            </Link>
          </div>

          <StepIndicator current={2} />

          <div className="bg-white rounded-2xl shadow-md p-5 md:p-6 mb-4">
            <div className="flex items-center gap-3 mb-1">
              <Store className="w-6 h-6 text-blue-600 shrink-0" />
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                내 가게를 등록하고 시작하세요
              </h1>
            </div>
            <p className="text-base text-gray-500">
              가게 정보를 입력하면 AI 검색 노출 현황을 즉시 분석합니다.
            </p>
          </div>

          {userId ? (
            <RegisterBusinessForm
              userId={userId}
              onSuccess={handleBusinessRegistered}
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-md p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-base text-gray-500 mt-4">로딩 중...</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── STEP 3: 완료 ────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl md:text-3xl font-bold text-blue-600">
            AEOlab
          </Link>
        </div>

        <StepIndicator current={3} />

        <div className="bg-white rounded-2xl shadow-md p-8 md:p-10 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            등록이 완료되었습니다!
          </h1>
          <p className="text-base text-gray-500 mb-6">
            이제 AI 스캔을 시작해서 내 가게의 노출 현황을 확인해보세요.
          </p>

          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-blue-800 mb-2">다음 단계</p>
            <ul className="space-y-2">
              {[
                "AI 스캔 시작 → 7개 AI 플랫폼 노출 분석 (약 2~3분)",
                "경쟁사 등록 → 주변 동종업체와 비교",
                "개선 가이드 → AI 브리핑 노출 높이기",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-blue-700">
                  <span className="shrink-0 mt-0.5 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-base transition-colors"
          >
            AI 스캔 시작하기
          </button>
          <p className="text-sm text-gray-400 mt-3">잠시 후 자동으로 이동합니다...</p>
        </div>
      </div>
    </main>
  );
}
