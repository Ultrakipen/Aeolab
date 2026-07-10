"use client";

import { useState, useEffect, useCallback } from "react";

// 관리자 API는 서버 사이드 프록시를 통해 호출 (키 노출 방지)
// 가격 정보는 백엔드 plan_stats에서 직접 받음 — lib/plans.ts PLAN_PRICES는 layout.tsx JSON-LD 등 클라이언트 표시용
const ADMIN_PROXY = "/api/admin-proxy";

interface PlanStat {
  subscribers: number;
  mrr: number;
  scan_month: number;
  price: number;
}

interface Stats {
  total_subscribers: number;
  active_subscribers: number;
  mrr: number;
  bep_progress: number;
  plan_distribution: Record<string, number>;
  plan_stats: Record<string, PlanStat>;
  scan_count_today: number;
  scan_count_month: number;
  waitlist_count: number;
}

interface RevenueRow {
  month: string;
  revenue: number;
  subscriber_count: number;
}

interface CategoryDist {
  total: number;
  groups: { active: number; likely: number; inactive: number };
  ratios: { active: number; likely: number; inactive: number };
  per_category: Record<string, number>;
}

interface AiUsage {
  period_days: number;
  scan_counts: { total_scans: number; gemini: number; chatgpt: number; naver: number; google: number };
  guide_generation_count: number;
  guide_by_context: Record<string, number>;
  assistant_chat_count: number;
}

interface CohortAnalysis {
  signup_cohorts: { cohort_month: string; total: number; active_now: number; retention_pct: number }[];
  status_distribution: Record<string, number>;
  cumulative_churn_rate_pct: number;
  avg_tenure_days: number | null;
  data_caveat: string;
}

interface SubRow {
  user_id: string;
  email?: string;
  plan: string;
  status: string;
  start_at: string;
  end_at: string;
  team_member_count?: number;
  api_key_count?: number;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  order_num: number;
  is_active: boolean;
}

const FAQ_CATEGORY_LABELS: Record<string, string> = {
  general: "서비스 이용", pricing: "요금제", scan: "스캔", guide: "개선 가이드",
};

// ─── FAQ 탭 ──────────────────────────────────────────────────
function FAQTab() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "", category: "general", order_num: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ question: "", answer: "", category: "general", order_num: 0 });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=api/faq`);
      const data = await res.json();
      setFaqs(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) return;
    setSubmitting(true);
    setMsg("");
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=api/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMsg("FAQ가 등록되었습니다.");
        setForm({ question: "", answer: "", category: "general", order_num: 0 });
        load();
      } else {
        setMsg("등록 실패");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("삭제하시겠습니까?")) return;
    await fetch(`${ADMIN_PROXY}?path=api/faq/${id}`, {
      method: "DELETE",
    });
    load();
  }

  function handleEditStart(f: FAQ) {
    setEditingId(f.id);
    setEditForm({ question: f.question, answer: f.answer, category: f.category, order_num: f.order_num });
  }

  function handleEditCancel() {
    setEditingId(null);
  }

  async function handleEditSave(id: number) {
    if (!editForm.question.trim() || !editForm.answer.trim()) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=api/faq/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        load();
      } else {
        setMsg("수정 실패");
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  const grouped = Object.entries(FAQ_CATEGORY_LABELS).map(([key, label]) => ({
    key, label, items: faqs.filter((f) => f.category === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* 작성 폼 */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">FAQ 작성</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(FAQ_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="순서"
              value={form.order_num}
              onChange={(e) => setForm({ ...form, order_num: parseInt(e.target.value) || 0 })}
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            placeholder="질문"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <textarea
            placeholder="답변"
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            required
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
            {msg && <span className="text-sm text-green-600">{msg}</span>}
          </div>
        </form>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">등록된 FAQ ({faqs.length}개)</h2>
        {loading ? (
          <div className="text-sm text-gray-400">불러오는 중...</div>
        ) : faqs.length === 0 ? (
          <div className="text-sm text-gray-400">등록된 FAQ가 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => (
              <div key={g.key}>
                <p className="text-sm font-semibold text-gray-400 uppercase mb-2">{g.label}</p>
                <div className="space-y-2">
                  {g.items.map((f) => editingId === f.id ? (
                    <div key={f.id} className="py-3 border-b border-gray-50 last:border-0 space-y-2">
                      <div className="flex gap-3">
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(FAQ_CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={editForm.order_num}
                          onChange={(e) => setEditForm({ ...editForm, order_num: parseInt(e.target.value) || 0 })}
                          className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <input
                        type="text"
                        value={editForm.question}
                        onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <textarea
                        value={editForm.answer}
                        onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEditSave(f.id)}
                          disabled={editSubmitting}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {editSubmitting ? "저장 중..." : "수정 저장"}
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={f.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{f.question}</p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{f.answer}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">#{f.order_num}</span>
                        <button
                          onClick={() => handleEditStart(f)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(f.id)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 문의 탭 ─────────────────────────────────────────────────
interface InquiryRow {
  id: number;
  name: string;
  email: string;
  subject: string;
  content: string;
  status: "pending" | "answered";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

function InquiryTab() {
  const [items, setItems] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "answered">("all");
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const [msg, setMsg] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`${ADMIN_PROXY}?path=api/inquiry/admin/list&${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function toggleOpen(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAnswer(id: number) {
    const answerText = answers[id]?.trim();
    if (!answerText) return;
    setSubmitting((prev) => ({ ...prev, [id]: true }));
    setMsg((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=api/inquiry/admin/${id}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      if (res.ok) {
        setMsg((prev) => ({ ...prev, [id]: "답변이 등록되었습니다." }));
        setAnswers((prev) => ({ ...prev, [id]: "" }));
        load();
      } else {
        setMsg((prev) => ({ ...prev, [id]: "등록 실패" }));
      }
    } finally {
      setSubmitting((prev) => ({ ...prev, [id]: false }));
    }
  }

  const STATUS_TABS: { key: "all" | "pending" | "answered"; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "pending", label: "대기중" },
    { key: "answered", label: "답변완료" },
  ];

  return (
    <div className="space-y-4">
      {/* 상태 필터 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          문의 목록 ({items.length}건)
        </h2>
        {loading ? (
          <div className="text-sm text-gray-400">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">문의 내역이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const isOpen = openIds.has(item.id);
              return (
                <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleOpen(item.id)}
                    className="w-full flex items-center gap-3 p-4 text-left bg-white hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className={`shrink-0 text-sm px-2 py-0.5 rounded-full font-medium ${
                        item.status === "answered"
                          ? "bg-green-50 text-green-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {item.status === "answered" ? "답변완료" : "대기중"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 truncate">{item.subject}</span>
                        <span className="text-sm text-gray-400 shrink-0">{item.name} ({item.email})</span>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400 shrink-0">
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      <div className="p-4 border-b border-gray-100">
                        <p className="text-sm text-gray-400 mb-1">문의 내용</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                      <div className="p-4">
                        {item.answer && (
                          <div className="mb-3 p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-600 mb-1">
                              기존 답변 ({item.answered_at ? new Date(item.answered_at).toLocaleDateString("ko-KR") : ""})
                            </p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                          </div>
                        )}
                        <p className="text-sm text-gray-400 mb-1">
                          {item.answer ? "답변 수정" : "답변 입력"}
                        </p>
                        <textarea
                          value={answers[item.id] ?? ""}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          placeholder="답변 내용을 입력하세요."
                          rows={4}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleAnswer(item.id)}
                            disabled={submitting[item.id] || !answers[item.id]?.trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {submitting[item.id] ? "등록 중..." : "답변 등록"}
                          </button>
                          {msg[item.id] && (
                            <span className="text-sm text-green-600">{msg[item.id]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 대시보드 ────────────────────────────────────────────
// 로그인: 입력받은 key를 서버 프록시로 검증. key는 state에만 보관하며 번들에 포함되지 않음.
export function AdminDashboard({ initialKey = "" }: { initialKey?: string }) {
  const [inputKey, setInputKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "faq" | "inquiry">("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [subSearch, setSubSearch] = useState("");
  const [subPlanFilter, setSubPlanFilter] = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [cancelTarget, setCancelTarget] = useState<SubRow | null>(null);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelResult, setCancelResult] = useState<{ refunded: boolean; refund_amount: number | null } | null>(null);
  const [catDist, setCatDist] = useState<CategoryDist | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [cohort, setCohort] = useState<CohortAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // initialKey prop은 더 이상 사용하지 않음 (하위호환용 파라미터만 유지)
  void initialKey;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, revenueRes, subsRes, catRes, aiUsageRes, cohortRes] = await Promise.all([
        fetch(`${ADMIN_PROXY}?path=admin/stats`),
        fetch(`${ADMIN_PROXY}?path=admin/revenue`),
        fetch(`${ADMIN_PROXY}?path=admin/subscriptions`),
        fetch(`${ADMIN_PROXY}?path=admin/category-distribution`),
        fetch(`${ADMIN_PROXY}?path=admin/ai-usage?days=30`),
        fetch(`${ADMIN_PROXY}?path=admin/cohort-analysis`),
      ]);
      if (!statsRes.ok) {
        if (statsRes.status === 403) {
          setError("관리자 키가 올바르지 않습니다.");
          setAuthed(false);
          return;
        }
        throw new Error("API 오류");
      }
      setStats(await statsRes.json());
      setRevenue(await revenueRes.json());
      setSubs(await subsRes.json());
      if (catRes.ok) setCatDist(await catRes.json());
      if (aiUsageRes.ok) setAiUsage(await aiUsageRes.json());
      if (cohortRes.ok) setCohort(await cohortRes.json());
      setAuthed(true);
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 관리자 강제 구독 취소/환불 — 2단계 확인 모달의 최종 확정 버튼에서 호출 (금전 이동)
  const handleAdminCancelSubscription = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(
        `${ADMIN_PROXY}?path=${encodeURIComponent(`admin/subscriptions/${cancelTarget.user_id}/cancel`)}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail?.code === "NO_ACTIVE_SUBSCRIPTION" ? "이미 해지되었거나 활성 구독이 아닙니다." : (data?.detail ?? "취소 처리에 실패했습니다."));
      }
      setCancelResult({ refunded: !!data.refunded, refund_amount: data.refund_amount ?? null });
      setSubs((prev) => prev.map((s) => s.user_id === cancelTarget.user_id ? { ...s, status: "cancelled", end_at: data.end_at ?? s.end_at } : s));
    } catch (err: unknown) {
      setCancelError((err as Error).message ?? "오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget]);

  const closeCancelModal = () => {
    setCancelTarget(null);
    setCancelStep(1);
    setCancelError("");
    setCancelResult(null);
  };

  // 로그인 검증: 입력한 키를 서버 프록시에 전달해 403 여부로 확인
  const handleLogin = useCallback(async () => {
    if (!inputKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      // 임시로 쿠키/세션 없이 서버 환경변수 ADMIN_SECRET_KEY와 비교하는 경량 검증
      // 프록시가 ADMIN_KEY를 header에 붙이므로 stats 호출 성공 = 인증 성공
      const res = await fetch(`${ADMIN_PROXY}?path=admin/stats`);
      if (res.status === 403) {
        setError("관리자 키가 올바르지 않습니다.");
        return;
      }
      if (!res.ok) throw new Error("API 오류");
      setStats(await res.json());
      // 나머지 데이터 로드
      const [revenueRes, subsRes, catRes2, aiUsageRes2, cohortRes2] = await Promise.all([
        fetch(`${ADMIN_PROXY}?path=admin/revenue`),
        fetch(`${ADMIN_PROXY}?path=admin/subscriptions`),
        fetch(`${ADMIN_PROXY}?path=admin/category-distribution`),
        fetch(`${ADMIN_PROXY}?path=admin/ai-usage?days=30`),
        fetch(`${ADMIN_PROXY}?path=admin/cohort-analysis`),
      ]);
      setRevenue(await revenueRes.json());
      setSubs(await subsRes.json());
      if (catRes2.ok) setCatDist(await catRes2.json());
      if (aiUsageRes2.ok) setAiUsage(await aiUsageRes2.json());
      if (cohortRes2.ok) setCohort(await cohortRes2.json());
      setAuthed(true);
      // 세션 유지 (새로고침 대응)
      try { localStorage.setItem("aeolab_admin_authed", "1"); } catch { /* ignore */ }
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [inputKey]);

  useEffect(() => {
    // localStorage 기반 간단 세션 유지
    const saved = (() => { try { return localStorage.getItem("aeolab_admin_authed"); } catch { return null; } })();
    if (saved === "1") fetchAll();
  }, [fetchAll]);

  if (!authed) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl p-4 md:p-8 shadow-sm max-w-sm w-full">
          <h1 className="text-xl font-bold text-gray-900 mb-6">관리자 접근</h1>
          <input
            type="password"
            placeholder="관리자 키 입력"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "확인 중..." : "확인"}
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const BEP_TARGET = 20;
  const bepPct = stats ? Math.min(100, Math.round((stats.active_subscribers / BEP_TARGET) * 100)) : 0;

  const SUB_STATUS_LABELS: Record<string, string> = {
    active: "활성", grace_period: "유예", suspended: "정지", cancelled: "해지", expired: "만료",
  };
  const subStatusOptions = Array.from(new Set(subs.map((s) => s.status)));
  const subPlanOptions = Array.from(new Set(subs.map((s) => s.plan)));
  const filteredSubs = subs.filter((s) => {
    if (subPlanFilter !== "all" && s.plan !== subPlanFilter) return false;
    if (subStatusFilter !== "all" && s.status !== subStatusFilter) return false;
    if (subSearch.trim()) {
      const needle = subSearch.trim().toLowerCase();
      const haystack = `${s.email ?? ""} ${s.user_id}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">AEOlab 관리자</h1>
            <p className="text-sm text-gray-400">구독자·매출·공지사항·FAQ·Q&A 관리</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchAll()}
              className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              새로고침
            </button>
            <button
              onClick={() => {
                try { localStorage.removeItem("aeolab_admin_authed"); } catch { /* ignore */ }
                setAuthed(false);
                setInputKey("");
              }}
              className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 외부 링크 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <a
            href="/admin/delivery"
            className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            대행 의뢰 관리 →
          </a>
          <a
            href="/admin/support"
            className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Q&A 문의 관리 →
          </a>
          <a
            href="/admin/feedback"
            className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            피드백 현황 →
          </a>
          <a
            href="/admin/notices"
            className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            공지사항 관리 →
          </a>
          <a
            href="/admin/score-comparison"
            className="text-sm text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            점수 모델 v3.1 비교 →
          </a>
          <a
            href="/admin/business"
            className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            사업장 조회 →
          </a>
          <a
            href="/admin/ops"
            className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            운영 현황(감사로그·알림·결제이력) →
          </a>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 flex-wrap">
          {([
            ["dashboard", "대시보드"],
            ["faq", "FAQ"],
            ["inquiry", "문의"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {tab === "faq" && <FAQTab />}
        {tab === "inquiry" && <InquiryTab />}

        {tab === "dashboard" && (
          <>
            {stats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "활성 구독자",   value: `${stats.active_subscribers}명`, sub: `전체 ${stats.total_subscribers}명` },
                    { label: "월 매출 (MRR)", value: `${stats.mrr.toLocaleString()}원`, sub: "이번 달 예상" },
                    { label: "BEP 달성도",   value: `${bepPct}%`, sub: `목표 ${BEP_TARGET}명` },
                    { label: "이번 달 스캔", value: `${stats.scan_count_month}회`, sub: `오늘 ${stats.scan_count_today}회` },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-xl p-5 shadow-sm">
                      <div className="text-sm text-gray-500 mb-1">{item.label}</div>
                      <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                      <div className="text-sm text-gray-400 mt-0.5">{item.sub}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">BEP 달성 진행률</span>
                    <span className="text-sm text-gray-500">
                      {stats.active_subscribers} / {BEP_TARGET}명 ({bepPct}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full">
                    <div
                      className={`h-3 rounded-full transition-all ${bepPct >= 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${bepPct}%` }}
                    />
                  </div>
                  {bepPct >= 100 && (
                    <p className="text-sm text-green-600 mt-2 font-medium">BEP 달성! 월 비용 ~8만원 커버됩니다.</p>
                  )}
                </div>

                {stats.plan_stats && (
                  <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">플랜별 상세 현황</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-sm text-gray-400 border-b border-gray-100">
                            <th className="pb-2 font-medium">플랜</th>
                            <th className="pb-2 font-medium text-right">월정액</th>
                            <th className="pb-2 font-medium text-right">활성 구독자</th>
                            <th className="pb-2 font-medium text-right">월 매출</th>
                            <th className="pb-2 font-medium text-right">BEP 달성도</th>
                            <th className="pb-2 font-medium text-right">이달 스캔</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(stats.plan_stats).map(([plan, ps]) => {
                            const bepTarget: Record<string, number> = { basic: 20, pro: 7, biz: 3, startup: 10 };
                            const target = bepTarget[plan] ?? 10;
                            const pct = Math.min(100, Math.round((ps.subscribers / target) * 100));
                            return (
                              <tr key={plan} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-2.5">
                                  <span className="capitalize font-medium text-gray-800">{plan}</span>
                                </td>
                                <td className="py-2.5 text-right text-gray-500">{ps.price.toLocaleString()}원</td>
                                <td className="py-2.5 text-right">
                                  <span className={`font-semibold ${ps.subscribers > 0 ? "text-blue-600" : "text-gray-300"}`}>
                                    {ps.subscribers}명
                                  </span>
                                </td>
                                <td className="py-2.5 text-right">
                                  <span className={ps.mrr > 0 ? "font-medium text-gray-800" : "text-gray-300"}>
                                    {ps.mrr.toLocaleString()}원
                                  </span>
                                </td>
                                <td className="py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                                      <div
                                        className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-blue-400"}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className={`text-sm ${pct >= 100 ? "text-green-600 font-semibold" : "text-gray-500"}`}>
                                      {pct}%
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 text-right">
                                  <span className={ps.scan_month > 0 ? "text-gray-700" : "text-gray-300"}>
                                    {ps.scan_month}회
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-50 font-semibold">
                            <td className="py-2.5 text-gray-700">합계</td>
                            <td className="py-2.5" />
                            <td className="py-2.5 text-right text-blue-600">{stats.active_subscribers}명</td>
                            <td className="py-2.5 text-right text-gray-800">{stats.mrr.toLocaleString()}원</td>
                            <td className="py-2.5 text-right text-gray-600">{stats.bep_progress}%</td>
                            <td className="py-2.5 text-right text-gray-700">{stats.scan_count_month}회</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {revenue.length > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">월별 매출 추이</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-sm text-gray-400 border-b border-gray-100">
                        <th className="pb-2">월</th>
                        <th className="pb-2 text-right">매출</th>
                        <th className="pb-2 text-right">구독자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.slice(0, 12).map((row) => (
                        <tr key={row.month} className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">{row.month}</td>
                          <td className="py-2 text-right font-medium">{row.revenue.toLocaleString()}원</td>
                          <td className="py-2 text-right text-gray-500">{row.subscriber_count}명</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {subs.length > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">
                  구독자 목록 ({filteredSubs.length}/{subs.length}명)
                </h2>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    placeholder="이메일 검색"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={subStatusFilter}
                    onChange={(e) => setSubStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">전체 상태</option>
                    {subStatusOptions.map((s) => (
                      <option key={s} value={s}>{SUB_STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                  <select
                    value={subPlanFilter}
                    onChange={(e) => setSubPlanFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white capitalize"
                  >
                    <option value="all">전체 플랜</option>
                    {subPlanOptions.map((p) => (
                      <option key={p} value={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>
                {filteredSubs.length === 0 ? (
                  <div className="text-sm text-gray-400 py-4 text-center">검색 조건에 맞는 구독자가 없습니다.</div>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-sm text-gray-400 border-b border-gray-100">
                        <th className="pb-2">이메일</th>
                        <th className="pb-2">플랜</th>
                        <th className="pb-2">상태</th>
                        <th className="pb-2">만료일</th>
                        <th className="pb-2">팀/API키</th>
                        <th className="pb-2">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubs.map((sub) => (
                        <tr key={sub.user_id} className="border-b border-gray-50">
                          <td className="py-2 text-gray-700 text-sm">{sub.email ?? sub.user_id.slice(0, 8) + "..."}</td>
                          <td className="py-2">
                            <span className="bg-blue-50 text-blue-700 text-sm px-2 py-0.5 rounded-full capitalize">
                              {sub.plan}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`text-sm px-2 py-0.5 rounded-full ${
                              sub.status === "active" ? "bg-green-50 text-green-700" :
                              sub.status === "grace_period" ? "bg-yellow-50 text-yellow-700" :
                              "bg-gray-100 text-gray-500"
                            }`}>
                              {SUB_STATUS_LABELS[sub.status] ?? sub.status}
                            </span>
                          </td>
                          <td className="py-2 text-sm text-gray-400">
                            {sub.end_at ? new Date(sub.end_at).toLocaleDateString("ko-KR") : "—"}
                          </td>
                          <td className="py-2 text-sm text-gray-500">
                            {(sub.team_member_count || sub.api_key_count)
                              ? `팀 ${sub.team_member_count ?? 0}명 · 키 ${sub.api_key_count ?? 0}개`
                              : "—"}
                          </td>
                          <td className="py-2">
                            {(sub.status === "active" || sub.status === "grace_period") ? (
                              <button
                                onClick={() => { setCancelTarget(sub); setCancelStep(1); setCancelError(""); setCancelResult(null); }}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                              >
                                구독 취소
                              </button>
                            ) : (
                              <span className="text-sm text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )}

            {/* 업종 그룹 분포 (P2-4) — AI 브리핑 ACTIVE/LIKELY/INACTIVE 비율 */}
            {catDist && catDist.total > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm mt-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">업종 그룹 분포</h2>
                <p className="text-sm text-gray-400 mb-4">
                  AI 브리핑 게이팅 기준 · INACTIVE 비율이 높으면 해당 UX 개선 우선순위 ↑ (총 {catDist.total}개 사업장)
                </p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {([
                    { key: "active", label: "ACTIVE", desc: "AI 브리핑 대상", color: "text-green-700", bg: "bg-green-50 border-green-200" },
                    { key: "likely", label: "LIKELY", desc: "베타·확대 예정", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                    { key: "inactive", label: "INACTIVE", desc: "AI탭·글로벌 AI", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
                  ] as const).map(({ key, label, desc, color, bg }) => (
                    <div key={key} className={`rounded-xl p-3 border ${bg}`}>
                      <div className={`text-sm font-semibold ${color} mb-0.5`}>{label}</div>
                      <div className={`text-xl font-bold ${color}`}>{catDist.ratios[key]}%</div>
                      <div className="text-sm text-gray-500">{catDist.groups[key]}개 · {desc}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">업종별 상세</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(catDist.per_category).slice(0, 20).map(([cat, cnt]) => (
                      <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2.5 py-1 text-xs">
                        {cat} <span className="font-semibold text-gray-500">{cnt}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI 비용/사용량 모니터링 (§3-A P1) — 채널별 실행 횟수, 정확한 토큰비용 아님 */}
            {aiUsage && (
              <div className="bg-white rounded-xl p-5 shadow-sm mt-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">AI 사용량 (최근 {aiUsage.period_days}일)</h2>
                <p className="text-sm text-gray-400 mb-4">
                  채널이 포함된 스캔 세션 수 — 실제 API 콜 수(스캔당 50~100회 샘플링)와는 다름
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">전체 스캔</div>
                    <div className="text-xl font-bold text-gray-800">{aiUsage.scan_counts.total_scans}</div>
                  </div>
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">Gemini</div>
                    <div className="text-xl font-bold text-gray-800">{aiUsage.scan_counts.gemini}</div>
                  </div>
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">ChatGPT</div>
                    <div className="text-xl font-bold text-gray-800">{aiUsage.scan_counts.chatgpt}</div>
                  </div>
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">네이버</div>
                    <div className="text-xl font-bold text-gray-800">{aiUsage.scan_counts.naver}</div>
                  </div>
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">Google</div>
                    <div className="text-xl font-bold text-gray-800">{aiUsage.scan_counts.google}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-1">가이드 생성(Claude Sonnet) — {aiUsage.guide_generation_count}건</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(aiUsage.guide_by_context).map(([ctx, cnt]) => (
                        <span key={ctx} className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-sm">
                          {ctx} <span className="font-semibold text-gray-500">{cnt}</span>
                        </span>
                      ))}
                      {Object.keys(aiUsage.guide_by_context).length === 0 && (
                        <span className="text-sm text-gray-400">기간 내 생성 없음</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">AI 어시스턴트 채팅(Claude Haiku)</div>
                    <div className="text-xl font-bold text-gray-800">{aiUsage.assistant_chat_count}건</div>
                  </div>
                </div>
              </div>
            )}

            {/* 가입 코호트 유지율 (§3-A-I) — 상태변경 이력 부재로 스냅샷 기준, data_caveat 명시 */}
            {cohort && (
              <div className="bg-white rounded-xl p-5 shadow-sm mt-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">가입 코호트 유지율</h2>
                <p className="text-sm text-gray-400 mb-4">{cohort.data_caveat}</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">누적 이탈률</div>
                    <div className="text-xl font-bold text-gray-800">{cohort.cumulative_churn_rate_pct}%</div>
                  </div>
                  <div className="rounded-xl p-3 border border-gray-100">
                    <div className="text-sm text-gray-500 mb-0.5">평균 유지 기간</div>
                    <div className="text-xl font-bold text-gray-800">
                      {cohort.avg_tenure_days != null ? `${cohort.avg_tenure_days}일` : "—"}
                    </div>
                  </div>
                </div>
                {cohort.signup_cohorts.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-sm text-gray-400 border-b border-gray-100">
                          <th className="pb-2 pr-3">가입월</th>
                          <th className="pb-2 pr-3">가입자수</th>
                          <th className="pb-2 pr-3">현재 유지</th>
                          <th className="pb-2">유지율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohort.signup_cohorts.map((c) => (
                          <tr key={c.cohort_month} className="border-b border-gray-50">
                            <td className="py-2 pr-3 text-gray-700">{c.cohort_month}</td>
                            <td className="py-2 pr-3 text-gray-500">{c.total}명</td>
                            <td className="py-2 pr-3 text-gray-500">{c.active_now}명</td>
                            <td className="py-2 font-semibold text-gray-800">{c.retention_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 관리자 구독 취소/환불 확인 모달 — 되돌릴 수 없는 금전 이동이므로 2단계 확인 */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            {cancelResult ? (
              <>
                <h3 className="text-base font-bold text-gray-900 mb-2">처리 완료</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {cancelTarget.email ?? cancelTarget.user_id} 구독이 해지되었습니다.
                  {cancelResult.refunded
                    ? ` 7일 이내 청약철회 대상으로 ${cancelResult.refund_amount?.toLocaleString() ?? ""}원이 환불 처리되었습니다.`
                    : " 환불 대상이 아니며(가입 7일 경과 또는 서비스 이용 이력 있음) 잔여 기간까지 서비스가 유지됩니다."}
                </p>
                <button
                  onClick={closeCancelModal}
                  className="w-full py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 transition-colors"
                >
                  닫기
                </button>
              </>
            ) : cancelStep === 1 ? (
              <>
                <h3 className="text-base font-bold text-gray-900 mb-2">구독 취소 확인</h3>
                <p className="text-sm text-gray-600 mb-4">
                  <span className="font-semibold">{cancelTarget.email ?? cancelTarget.user_id}</span>
                  {" "}({cancelTarget.plan}) 구독을 취소하시겠습니까?
                  <br />가입 7일 이내 + 미이용 상태면 <span className="font-semibold text-red-600">즉시 전액 환불</span>이 실행됩니다.
                  이 작업은 되돌릴 수 없습니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCancelStep(2)}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                  >
                    계속
                  </button>
                  <button
                    onClick={closeCancelModal}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-red-700 mb-2">최종 확인 — 금전 이동 가능</h3>
                <p className="text-sm text-gray-600 mb-4">
                  마지막 확인입니다. &quot;취소 확정&quot;을 누르면 즉시 처리되며 취소할 수 없습니다.
                </p>
                {cancelError && (
                  <p className="text-sm text-red-600 mb-3">{cancelError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleAdminCancelSubscription}
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {cancelling ? "처리 중..." : "취소 확정"}
                  </button>
                  <button
                    onClick={closeCancelModal}
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
