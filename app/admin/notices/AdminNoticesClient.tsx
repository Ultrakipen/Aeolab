"use client";

import { useState, useEffect, useCallback } from "react";
import { Pin, Trash2, Pencil, X, RefreshCw, Plus } from "lucide-react";

const ADMIN_PROXY = "/api/admin-proxy";

const SEVERITY_OPTIONS = [
  { value: "info", label: "정보", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "warning", label: "경고", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "critical", label: "긴급", color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
] as const;

type Severity = (typeof SEVERITY_OPTIONS)[number]["value"];

const SEGMENT_OPTIONS = [
  { value: "", label: "전체 사용자" },
  { value: "free", label: "무료" },
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "biz", label: "Biz" },
];

const CATEGORY_LABELS: Record<string, string> = {
  general: "일반",
  update: "업데이트",
  maintenance: "점검 안내",
};

interface Notice {
  id: number;
  title: string;
  content: string;
  category: string;
  severity?: Severity;
  target_segment?: string;
  cta_label?: string;
  cta_url?: string;
  is_pinned: boolean;
  created_at: string;
}

interface FormState {
  title: string;
  content: string;
  category: string;
  severity: Severity;
  target_segment: string;
  cta_label: string;
  cta_url: string;
  is_pinned: boolean;
  send_message: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  category: "general",
  severity: "info",
  target_segment: "",
  cta_label: "",
  cta_url: "",
  is_pinned: false,
  send_message: false,
};

function SeverityBadge({ severity }: { severity?: Severity }) {
  const opt = SEVERITY_OPTIONS.find((s) => s.value === (severity ?? "info")) ?? SEVERITY_OPTIONS[0];
  return (
    <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

export default function AdminNoticesClient() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=api/notices&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: Notice[] = (data.items ?? []).sort((a: Notice, b: Notice) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setNotices(items);
    } catch {
      // 목록 조회 실패 시 빈 상태 유지
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setMsg("");
    setShowForm(true);
  }

  function openEdit(n: Notice) {
    setEditId(n.id);
    setForm({
      title: n.title,
      content: n.content,
      category: n.category,
      severity: n.severity ?? "info",
      target_segment: n.target_segment ?? "",
      cta_label: n.cta_label ?? "",
      cta_url: n.cta_url ?? "",
      is_pinned: n.is_pinned,
      send_message: false,
    });
    setMsg("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setMsg("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    setMsg("");

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      severity: form.severity,
      target_segment: form.target_segment || null,
      cta_label: form.cta_label.trim() || null,
      cta_url: form.cta_url.trim() || null,
      is_pinned: form.is_pinned,
    };

    try {
      let res: Response;
      if (editId !== null) {
        res = await fetch(`${ADMIN_PROXY}?path=api/notices/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${ADMIN_PROXY}?path=api/notices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        setMsgType("error");
        setMsg("저장 실패 — 잠시 후 다시 시도해주세요.");
        return;
      }

      // 인앱 메시지 발송 (옵션)
      if (form.send_message && editId === null) {
        const msgPayload: Record<string, unknown> = {
          title: form.title.trim(),
          body: form.content.trim(),
          target_segment: form.target_segment || null,
          cta_label: form.cta_label.trim() || null,
          cta_url: form.cta_url.trim() || null,
        };
        await fetch(`${ADMIN_PROXY}?path=api/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msgPayload),
        }).catch(() => {
          // 인앱 발송 실패는 공지 저장에 영향 없음 — 별도 경고만
        });
      }

      setMsgType("success");
      setMsg(editId !== null ? "공지사항이 수정되었습니다." : "공지사항이 등록되었습니다.");
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number, title: string) {
    if (!confirm(`"${title}" 공지사항을 삭제하시겠습니까?`)) return;
    await fetch(`${ADMIN_PROXY}?path=api/notices/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              공지사항 관리
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              작성·수정·삭제·인앱 발송
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="새로고침"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              새 공지
            </button>
          </div>
        </div>

        <a
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6"
        >
          ← 관리자 대시보드로
        </a>

        {/* 결과 메시지 */}
        {msg && (
          <div
            className={`rounded-xl p-3 mb-4 text-sm ${
              msgType === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            {msg}
          </div>
        )}

        {/* 작성/수정 폼 */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {editId !== null ? "공지 수정" : "새 공지 작성"}
              </h2>
              <button
                onClick={cancelForm}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* 카테고리·심각도·고정 */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select
                  value={form.severity}
                  onChange={(e) => setField("severity", e.target.value as Severity)}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <select
                  value={form.target_segment}
                  onChange={(e) => setField("target_segment", e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SEGMENT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(e) => setField("is_pinned", e.target.checked)}
                    className="rounded"
                  />
                  상단 고정
                </label>
              </div>

              {/* 제목 */}
              <input
                type="text"
                placeholder="제목 (필수)"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                required
              />

              {/* 내용 */}
              <textarea
                placeholder="내용 (필수)"
                value={form.content}
                onChange={(e) => setField("content", e.target.value)}
                rows={5}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-gray-400"
                required
              />

              {/* CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="CTA 버튼 라벨 (예: 자세히 보기)"
                  value={form.cta_label}
                  onChange={(e) => setField("cta_label", e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                />
                <input
                  type="url"
                  placeholder="CTA URL (https://...)"
                  value={form.cta_url}
                  onChange={(e) => setField("cta_url", e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                />
              </div>

              {/* 인앱 메시지 발송 (신규 작성 시만) */}
              {editId === null && (
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.send_message}
                    onChange={(e) => setField("send_message", e.target.checked)}
                    className="rounded"
                  />
                  전체 사용자에게 인앱 메시지로도 발송
                  <span className="text-sm text-gray-400 dark:text-gray-500">(대상 세그먼트 적용)</span>
                </label>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "저장 중..." : editId !== null ? "수정 저장" : "등록"}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 공지 목록 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            등록된 공지사항{" "}
            <span className="text-gray-400 dark:text-gray-500 font-normal">
              ({notices.length}개)
            </span>
          </h2>

          {loading && notices.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notices.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-medium text-gray-600 dark:text-gray-300">
                아직 공지가 없습니다
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                첫 공지를 작성해보세요.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {n.is_pinned && (
                        <Pin
                          className="w-3.5 h-3.5 text-amber-500 shrink-0"
                          aria-label="상단 고정"
                        />
                      )}
                      <SeverityBadge severity={n.severity} />
                      <span className="text-sm px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {CATEGORY_LABELS[n.category] ?? n.category}
                      </span>
                      {n.target_segment && (
                        <span className="text-sm px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {SEGMENT_OPTIONS.find((s) => s.value === n.target_segment)?.label ??
                            n.target_segment}
                        </span>
                      )}
                      <span className="text-sm text-gray-400 dark:text-gray-500">
                        {new Date(n.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.content}
                    </p>
                    {n.cta_label && n.cta_url && (
                      <a
                        href={n.cta_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {n.cta_label} →
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(n)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label="수정"
                    >
                      <Pencil className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(n.id, n.title)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 dark:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
