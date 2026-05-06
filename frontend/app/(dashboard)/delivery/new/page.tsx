"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, ChevronRight, AlertCircle, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Business {
  id: string;
  name: string;
  category: string;
}

const PACKAGES = [
  {
    type: "smartplace_register",
    name: "01 스마트플레이스 등록 대행",
    price: 49000,
    description: "스마트플레이스 신규 등록, 기본정보·메뉴·키워드 최적화",
  },
  {
    type: "ai_optimization",
    name: "02 AI 검색 최적화",
    price: 79000,
    description: "소개글·톡톡메뉴·후기답글·키워드 보강",
  },
  {
    type: "comprehensive",
    name: "03 종합 풀패키지",
    price: 119000,
    description: "등록+최적화+코칭+30일 재진단 (개별 158,000원 → 119,000원)",
  },
];

function DeliveryNewForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preSelected = searchParams.get("package") ?? "smartplace_register";

  const [selectedPackage, setSelectedPackage] = useState(preSelected);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBizId, setSelectedBizId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [consentAgreed, setConsentAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pkg = PACKAGES.find((p) => p.type === selectedPackage) ?? PACKAGES[0];

  // 사업장 목록 조회
  useEffect(() => {
    (async () => {
      setLoadingBiz(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const { data } = await supabase
          .from("businesses")
          .select("id, name, category")
          .eq("user_id", user.id)
          .eq("is_active", true);
        const list = data ?? [];
        setBusinesses(list);
        if (list.length > 0) setSelectedBizId(list[0].id);
      } catch {
        setBusinesses([]);
      } finally {
        setLoadingBiz(false);
      }
    })();
  }, [router]);

  const handleSubmit = async () => {
    setError(null);

    // 유효성 검사
    if (!selectedBizId) {
      setError("사업장을 선택해 주세요.");
      return;
    }
    if (!title.trim()) {
      setError("의뢰 제목을 입력해 주세요.");
      return;
    }
    if (!body.trim()) {
      setError("의뢰 내용을 입력해 주세요.");
      return;
    }
    if (!consentAgreed) {
      setError("위임 동의에 체크해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
        setLoading(false);
        return;
      }
      const token = session.access_token;

      // 의뢰 생성
      const res = await fetch(`${BACKEND_URL}/api/delivery/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          package_type: selectedPackage,
          business_id: selectedBizId,
          request_title: title.trim(),
          request_body: body.trim(),
          consent_agreed: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? "의뢰 생성에 실패했습니다.");
      }

      const order = await res.json();
      const orderId = order.id ?? order.order_id;

      // 토스 결제 오픈
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        // 결제 키 없으면 의뢰 상세로 바로 이동 (운영자 수동 확인)
        router.push(`/delivery/orders/${orderId}`);
        return;
      }

      try {
        // @ts-ignore — 토스 스크립트 동적 로드
        const { loadTossPayments } = await import("@tosspayments/payment-sdk");
        const tossPayments = await loadTossPayments(clientKey);

        const tossOrderId = `delivery_${orderId}_${Date.now()}`;
        // @ts-ignore — 토스 requestPayment 타입 유연하게 처리
        await tossPayments.requestPayment("카드", {
          amount: pkg.price,
          orderId: tossOrderId,
          orderName: `AEOlab 대행 서비스 - ${pkg.name}`,
          successUrl: `${window.location.origin}/delivery/payment-confirm?orderId=${orderId}&amount=${pkg.price}&tossOrderId=${encodeURIComponent(tossOrderId)}`,
          failUrl: `${window.location.origin}/delivery/orders/${orderId}?payment=fail`,
        });
      } catch (payErr: unknown) {
        const code = (payErr as { code?: string })?.code;
        if (code === "USER_CANCEL") {
          // 취소 시 의뢰 상세로 이동 (received 상태 유지)
          router.push(`/delivery/orders/${orderId}`);
        } else {
          // 결제 오류지만 의뢰는 생성됨 → 상세 페이지로 이동 + 안내
          router.push(`/delivery/orders/${orderId}?payment=fail`);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? "오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  };

  if (loadingBiz) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <a href="/delivery" className="hover:text-blue-600 transition-colors">대행 서비스</a>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-700">의뢰 작성</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">대행 서비스 신청</h1>
          <p className="text-sm text-gray-500 mt-1">패키지를 선택하고 의뢰 내용을 작성해 주세요.</p>
        </div>

        <div className="space-y-5">
          {/* 1단계: 패키지 선택 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold mr-2">1</span>
              패키지 선택
            </h2>
            <div className="space-y-2.5">
              {PACKAGES.map((p) => (
                <label
                  key={p.type}
                  className={[
                    "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors",
                    selectedPackage === p.type
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="package"
                    value={p.type}
                    checked={selectedPackage === p.type}
                    onChange={() => setSelectedPackage(p.type)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                      <span className="text-sm font-bold text-blue-600 shrink-0">
                        {p.price.toLocaleString()}원
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 2단계: 사업장 선택 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold mr-2">2</span>
              사업장 선택
            </h2>
            {businesses.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">등록된 사업장이 없습니다.</p>
                <a
                  href="/onboarding"
                  className="inline-block text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  사업장 등록하기 →
                </a>
              </div>
            ) : (
              <select
                value={selectedBizId}
                onChange={(e) => setSelectedBizId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
              >
                {businesses.map((biz) => (
                  <option key={biz.id} value={biz.id}>
                    {biz.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 3단계: 의뢰 내용 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold mr-2">3</span>
              의뢰 내용
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  maxLength={100}
                  placeholder="예: 한식당 스마트플레이스 최적화 의뢰"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder:text-gray-400"
                />
                <p className="text-sm text-gray-400 mt-1 text-right">{title.length}/100</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 2000))}
                  maxLength={2000}
                  rows={6}
                  placeholder="매장 콘셉트, 시그니처 메뉴, 특별 요청사항 등을 작성해 주세요."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder:text-gray-400 resize-none"
                />
                <p className="text-sm text-gray-400 mt-1 text-right">{body.length}/2000</p>
              </div>
            </div>
          </div>

          {/* 4단계: 위임 동의 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold mr-2">4</span>
              위임 동의
            </h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  네이버 스마트플레이스 부운영자 권한을 AEOlab에 위임하는 데 동의합니다.
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  결제 후 작업 시작 전 부운영자 권한 등록 방법을 안내해 드립니다.
                  작업 완료 후 자동 해제됩니다.
                </p>
              </div>
            </label>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 결제 요약 + 버튼 */}
          <div className="bg-blue-600 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-base font-semibold text-white">{pkg.name}</p>
                <p className="text-sm text-blue-200 mt-0.5">결제 완료 후 작업 시작 (영업일 1~2일)</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{pkg.price.toLocaleString()}원</p>
                {pkg.type === "comprehensive" && (
                  <p className="text-sm text-blue-300 line-through">158,000원</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-blue-500/40 rounded-xl p-3 mb-4">
              <CheckCircle2 className="w-4 h-4 text-blue-200 shrink-0" />
              <p className="text-sm text-blue-100">
                결제 후 24시간 내 담당자가 연락드립니다.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || businesses.length === 0}
              className="w-full py-3.5 rounded-xl bg-white text-blue-600 text-base font-bold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                `결제 및 신청 — ${pkg.price.toLocaleString()}원`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeliveryNewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    }>
      <DeliveryNewForm />
    </Suspense>
  );
}
