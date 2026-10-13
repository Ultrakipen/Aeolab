"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BOARD_CATEGORY_LABEL, boardErrorMessage } from "@/lib/board";

// 관리자 키는 서버 측 admin-proxy에서만 사용 — 클라이언트 번들에 노출 금지
const ADMIN_PROXY = "/api/admin-proxy";

export interface AdminPost {
  id: number;
  category: string;
  title: string;
  title_private: boolean;
  content: string;
  author_name: string;
  email: string | null;
  status: "pending" | "answered";
  answer: string | null;
  answered_at: string | null;
  is_notice: boolean;
  is_hidden: boolean;
  created_at: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AdminBoardClient({ items }: { items: AdminPost[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nContent, setNContent] = useState("");

  const call = async (key: string, path: string, method: string, body?: unknown): Promise<boolean> => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=${encodeURIComponent(path)}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        setError(boardErrorMessage(await res.json().catch(() => ({}))));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("요청에 실패했습니다.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const btn = "px-3.5 py-2 rounded-lg text-sm font-medium border disabled:opacity-50";

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

      <details className="bg-white border border-gray-100 rounded-xl p-4">
        <summary className="text-sm font-semibold text-gray-900 cursor-pointer">공지 작성 (목록 상단 고정·누구나 열람)</summary>
        <div className="mt-3 space-y-3">
          <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="제목" maxLength={120} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" />
          <textarea value={nContent} onChange={(e) => setNContent(e.target.value)} placeholder="내용" rows={5} maxLength={3000} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base" />
          <button
            disabled={!nTitle.trim() || !nContent.trim() || busy === "notice"}
            onClick={async () => {
              if (await call("notice", "admin/board/notice", "POST", { title: nTitle, content: nContent })) {
                setNTitle("");
                setNContent("");
              }
            }}
            className={`${btn} bg-blue-600 text-white border-blue-600`}
          >
            공지 등록
          </button>
        </div>
      </details>

      {items.length === 0 && <div className="py-14 text-center text-base text-gray-600 bg-white rounded-xl border border-gray-100">글이 없습니다.</div>}

      {items.map((p) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className={`bg-white rounded-xl border shadow-sm ${p.is_hidden ? "border-red-200 opacity-70" : "border-gray-100"}`}>
            <button onClick={() => setOpenId(open ? null : p.id)} className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="text-sm text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">{p.is_notice ? "공지" : BOARD_CATEGORY_LABEL[p.category] ?? p.category}</span>
                {!p.is_notice && (
                  <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${p.status === "answered" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>
                    {p.status === "answered" ? "답변완료" : "답변대기"}
                  </span>
                )}
                {p.is_hidden && <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800">숨김</span>}
              </span>
              <span className="flex-1 text-base font-medium text-gray-900 break-keep">
                #{p.id} {p.title}
                {p.title_private && <span className="text-sm text-gray-600"> (제목 비공개)</span>}
              </span>
              <span className="text-sm text-gray-600 shrink-0">{p.author_name} · {fmt(p.created_at)}</span>
            </button>

            {open && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                {p.email && <p className="text-sm text-gray-700">이메일: {p.email}</p>}
                <div className="text-base text-gray-900 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-4">{p.content}</div>

                {!p.is_notice && (
                  <div>
                    <label htmlFor={`ans-${p.id}`} className="block text-sm font-semibold text-gray-800 mb-1.5">
                      답변 {p.answered_at && <span className="font-normal text-gray-600">(등록: {fmt(p.answered_at)})</span>}
                    </label>
                    <textarea
                      id={`ans-${p.id}`}
                      rows={5}
                      maxLength={3000}
                      value={answers[p.id] ?? p.answer ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [p.id]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base"
                    />
                    {p.email && <p className="text-sm text-gray-600 mt-1">답변을 등록하면 작성자 이메일로 알림이 발송됩니다.</p>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {!p.is_notice && (
                    <button
                      disabled={!(answers[p.id] ?? p.answer ?? "").trim() || busy === `a${p.id}`}
                      onClick={() => call(`a${p.id}`, `admin/board/${p.id}`, "PATCH", { answer: answers[p.id] ?? p.answer })}
                      className={`${btn} bg-blue-600 text-white border-blue-600 inline-flex items-center gap-1.5`}
                    >
                      {busy === `a${p.id}` && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                      답변 {p.status === "answered" ? "수정" : "등록"}
                    </button>
                  )}
                  <button onClick={() => call(`h${p.id}`, `admin/board/${p.id}`, "PATCH", { is_hidden: !p.is_hidden })} disabled={busy === `h${p.id}`} className={`${btn} border-gray-300 text-gray-800`}>
                    {p.is_hidden ? "숨김 해제" : "숨김 (목록에서 제거)"}
                  </button>
                  <button onClick={() => call(`n${p.id}`, `admin/board/${p.id}`, "PATCH", { is_notice: !p.is_notice })} disabled={busy === `n${p.id}`} className={`${btn} border-gray-300 text-gray-800`}>
                    {p.is_notice ? "공지 해제" : "공지로 고정"}
                  </button>
                  <button
                    onClick={() => window.confirm(`#${p.id} 글을 영구 삭제할까요?`) && call(`d${p.id}`, `admin/board/${p.id}`, "DELETE")}
                    disabled={busy === `d${p.id}`}
                    className={`${btn} border-red-200 text-red-700`}
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
