"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const CATEGORIES = [
  { value: "payment", label: "결제" },
  { value: "feature", label: "기능 사용" },
  { value: "score", label: "점수 해석" },
  { value: "bug", label: "버그" },
  { value: "other", label: "기타" },
];

const PLAN_LIMIT: Record<string, { label: string; limit: number | null }> = {
  free: { label: "Free 플랜: 월 1건", limit: 1 },
  basic: { label: "Basic 플랜: 월 3건", limit: 3 },
  pro: { label: "무제한 문의 가능", limit: null },
  biz: { label: "무제한 문의 가능", limit: null },
  startup: { label: "무제한 문의 가능", limit: null },
  enterprise: { label: "무제한 문의 가능", limit: null },
};

function SupportNewForm() {
  const router = useRouter();

  const [plan, setPlan] = useState<string>("free");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [category, setCategory] = useState("feature");
  const [isPublic, setIsPublic] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan, status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        const activePlan = sub?.status === "active" ? (sub?.plan ?? "free") : "free";
        setPlan(activePlan);

        // 이번 달 문의 수 조회
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth.toISOString());
        const planInfo = PLAN_LIMIT[activePlan] ?? PLAN_LIMIT["free"];
        if (planInfo.limit !== null) {
          setRemaining(Math.max(0, planInfo.limit - (count ?? 0)));
        } else {
          setRemaining(null); // 무제한
        }
      } catch {
        // 조회 실패 시 무시
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [router]);

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!body.trim()) {
      setError("내용을 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
        setSubmitting(false);
        return;
      }
      const token = session.access_token;

      const res = await fetch(`${BACKEND_URL}/api/support/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          title: title.trim(),
          body: body.trim(),
          visibility: isPublic ? "public" : "private",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? "문의 제출에 실패했습니다.");
      }

      const data = await res.json();
      const ticketId = data.id ?? data.ticket_id ?? data.ticket?.id;
      router.push(ticketId ? `/support/tickets/${ticketId}` : "/support/tickets");
    } catch (err: unknown) {
      setError((err as Error).message ?? "오류가 발생했습니다.");
      setSubmitting(false);
    }
  };

  const planInfo = PLAN_LIMIT[plan] ?? PLAN_LIMIT["free"];
  const isLimitExceeded = planInfo.limit !== null && remaining !== null && remaining <= 0;

  if (loadingMeta) {
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
            <a href="/support/tickets" className="hover:text-blue-600 transition-colors">1:1 문의</a>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-700">새 문의 작성</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">새 문의 작성</h1>
          <p className="text-sm text-gray-500 mt-1">궁금한 점이나 불편한 사항을 남겨 주세요.</p>
        </div>

        {/* 요금제 한도 안내 배너 */}
        <div className={[
          "rounded-xl p-4 mb-5 text-sm",
          isLimitExceeded
            ? "bg-red-50 border border-red-200 text-red-700"
            : planInfo.limit === null
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-blue-50 border border-blue-200 text-blue-700",
        ].join(" ")}>
          {planInfo.limit === null ? (
            <span className="font-medium">무제한 문의 가능</span>
          ) : remaining !== null && remaining > 0 ? (
            <span>
              이번 달 남은 문의 <strong>{remaining}건</strong>
              <span className="text-blue-500 ml-1">({planInfo.label})</span>
            </span>
          ) : (
            <span>
              이번 달 문의 한도를 초과했습니다.
              <a href="/pricing" className="underline ml-1">플랜 업그레이드</a>로 더 많은 문의를 보내세요.
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            {/* 카테고리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={[
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      category === cat.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    ].join(" ")}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 공개 여부 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">공개 여부</label>
              <div className="flex flex-col sm:flex-row gap-3">
                {[
                  { value: false, label: "비공개 (기본)", desc: "나만 볼 수 있습니다" },
                  { value: true, label: "공개", desc: "다른 사용자에게 도움이 될 수 있습니다" },
                ].map((opt) => (
                  <label key={String(opt.value)} className="flex items-start gap-3 cursor-pointer flex-1">
                    <input
                      type="radio"
                      name="visibility"
                      checked={isPublic === opt.value}
                      onChange={() => setIsPublic(opt.value)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                      <p className="text-sm text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                maxLength={200}
                placeholder="문의 제목을 간단히 입력해 주세요."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder:text-gray-400"
              />
              <p className="text-sm text-gray-400 mt-1 text-right">{title.length}/200</p>
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 2000))}
                maxLength={2000}
                rows={8}
                placeholder="문의 내용을 상세히 작성해 주세요. 스크린샷이 있으면 내용에 설명을 덧붙여 주세요."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder:text-gray-400 resize-none"
              />
              <p className="text-sm text-gray-400 mt-1 text-right">{body.length}/2000</p>
            </div>
          </div>

          {/* 에러 */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 제출 버튼 */}
          <div className="flex gap-3">
            <a
              href="/support/tickets"
              className="flex-1 py-3.5 rounded-xl bg-gray-100 text-gray-700 text-base font-semibold hover:bg-gray-200 transition-colors text-center"
            >
              취소
            </a>
            <button
              onClick={handleSubmit}
              disabled={submitting || isLimitExceeded}
              className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  제출 중...
                </>
              ) : (
                "문의 제출"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupportNewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    }>
      <SupportNewForm />
    </Suspense>
  );
}
