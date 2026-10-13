"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Megaphone } from "lucide-react";
import { apiBase } from "@/lib/api";
import {
  BOARD_CATEGORY_LABEL,
  BOARD_CONTENT_MAX,
  BOARD_TITLE_MAX,
  boardErrorMessage,
  formatBoardDate,
  type BoardItem,
  type BoardOpened,
} from "@/lib/board";

const inputCls =
  "w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

export function BoardPostClient({ meta }: { meta: BoardItem & { content?: string } }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [opened, setOpened] = useState<BoardOpened | null>(
    meta.is_notice ? { ...meta, content: meta.content ?? "", answer: null } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eContent, setEContent] = useState("");
  const [ePrivate, setEPrivate] = useState(false);

  const call = async (path: string, method: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/board/${meta.id}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(boardErrorMessage(data));
        return null;
      }
      return data;
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    const data = await call("/open", "POST", { password });
    if (data) setOpened(data as BoardOpened);
  };

  const startEdit = () => {
    if (!opened) return;
    setETitle(opened.title);
    setEContent(opened.content);
    setEPrivate(opened.title_private);
    setEditing(true);
    setError("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call("", "PATCH", { password, title: eTitle, content: eContent, title_private: ePrivate });
    if (data && opened) {
      setOpened({ ...opened, title: eTitle, content: eContent, title_private: ePrivate });
      setEditing(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("이 글을 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) return;
    const data = await call("/delete", "POST", { password });
    if (data) router.push("/board");
  };

  return (
    <section className="px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/board" className="text-sm text-blue-700 hover:underline">
          ← 목록으로
        </Link>

        <div className="mt-4 border-b border-gray-200 pb-4">
          <p className="text-sm text-gray-700 mb-1.5">
            {meta.is_notice ? (
              <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                <Megaphone className="w-4 h-4" aria-hidden="true" />공지
              </span>
            ) : (
              BOARD_CATEGORY_LABEL[meta.category] ?? meta.category
            )}
          </p>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 break-keep">{opened?.title ?? meta.title}</h1>
          <p className="text-sm text-gray-700 mt-2">
            {meta.author_name} · {formatBoardDate(meta.created_at)}
            {!meta.is_notice && (
              <span className={`ml-2 font-semibold ${meta.status === "answered" ? "text-green-700" : "text-gray-700"}`}>
                {meta.status === "answered" ? "답변완료" : "답변대기"}
              </span>
            )}
          </p>
        </div>

        {!opened && (
          <form onSubmit={unlock} className="mt-8 max-w-md mx-auto text-center">
            <KeyRound className="w-10 h-10 text-gray-500 mx-auto mb-3" aria-hidden="true" />
            <p className="text-base text-gray-800 mb-4 break-keep">글을 쓸 때 정한 비밀번호를 입력하면 내용과 답변을 볼 수 있습니다.</p>
            <label htmlFor="p-pw" className="sr-only">비밀번호</label>
            <input
              id="p-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="비밀번호"
              autoComplete="off"
              autoFocus
            />
            {error && (
              <p role="alert" className="text-sm text-red-700 mt-3 break-keep">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !password}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-base font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              확인
            </button>
            <p className="text-sm text-gray-600 mt-4 break-keep">비밀번호를 5번 틀리면 15분간 열람이 제한됩니다.</p>
          </form>
        )}

        {opened && !editing && (
          <div className="mt-6">
            <div className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap break-words">{opened.content}</div>

            {opened.answer && (
              <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-5">
                <p className="text-sm font-bold text-blue-800 mb-2">AEOlab 답변</p>
                <div className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap break-words">{opened.answer}</div>
              </div>
            )}

            {!meta.is_notice && (
              <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-5">
                {opened.can_edit && (
                  <button onClick={startEdit} className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50">
                    수정
                  </button>
                )}
                <button onClick={remove} disabled={busy} className="px-5 py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                  삭제
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700 mt-3">
                {error}
              </p>
            )}
          </div>
        )}

        {opened && editing && (
          <form onSubmit={saveEdit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="e-title" className="block text-sm font-semibold text-gray-800 mb-1.5">제목</label>
              <input id="e-title" value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={BOARD_TITLE_MAX} required className={inputCls} />
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-800 cursor-pointer">
                <input type="checkbox" checked={ePrivate} onChange={(e) => setEPrivate(e.target.checked)} className="w-4 h-4" />
                제목도 비공개로 하기
              </label>
            </div>
            <div>
              <label htmlFor="e-content" className="block text-sm font-semibold text-gray-800 mb-1.5">내용</label>
              <textarea id="e-content" value={eContent} onChange={(e) => setEContent(e.target.value)} maxLength={BOARD_CONTENT_MAX} required rows={8} className={`${inputCls} resize-y`} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="px-6 py-3 rounded-xl bg-blue-600 text-white text-base font-semibold hover:bg-blue-700 disabled:opacity-50">
                저장
              </button>
              <button type="button" onClick={() => setEditing(false)} className="px-6 py-3 rounded-xl border border-gray-300 text-base text-gray-800 hover:bg-gray-50">
                취소
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
