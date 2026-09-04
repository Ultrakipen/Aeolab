"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Eye, EyeOff, XCircle } from "lucide-react";

// 관리자 키는 서버 측 admin-proxy에서만 사용 — 클라이언트 번들에 노출 금지
const ADMIN_PROXY = "/api/admin-proxy";

interface Reply {
  id: string;
  author_type: "user" | "admin";
  body: string;
  created_at: string;
}

interface Props {
  ticketId: string;
  initialReplies: Reply[];
  currentStatus: string;
  isPublic: boolean;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function AdminSupportClient({ ticketId, initialReplies, currentStatus, isPublic }: Props) {
  const router = useRouter();
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [replyInput, setReplyInput] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState("");

  const [changingStatus, setChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const proxyHeaders = {
    "Content-Type": "application/json",
  };

  const handleSendReply = async () => {
    const body = replyInput.trim();
    if (!body) return;
    setSendingReply(true);
    setReplyError("");
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=${encodeURIComponent(`admin/support/${ticketId}/reply`)}`, {
        method: "POST",
        headers: proxyHeaders,
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail ?? "답글 전송 실패");
      }
      const data = await res.json();
      const newReply: Reply = data.reply ?? {
        id: Date.now().toString(),
        author_type: "admin",
        body,
        created_at: new Date().toISOString(),
      };
      setReplies((prev) => [...prev, newReply]);
      setReplyInput("");
      router.refresh();
    } catch (err: unknown) {
      setReplyError((err as Error).message);
    } finally {
      setSendingReply(false);
    }
  };

  const handleToggleVisibility = async () => {
    setTogglingVisibility(true);
    setVisibilityError("");
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=${encodeURIComponent(`admin/support/${ticketId}/visibility`)}`, {
        method: "PATCH",
        headers: proxyHeaders,
        body: JSON.stringify({ visibility: isPublic ? "private" : "public" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail ?? "공개 설정 변경 실패");
      }
      router.refresh();
    } catch (err: unknown) {
      setVisibilityError((err as Error).message);
    } finally {
      setTogglingVisibility(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("이 문의를 종료 처리하시겠습니까?")) return;
    setChangingStatus(true);
    setStatusError("");
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=${encodeURIComponent(`admin/support/${ticketId}/status`)}`, {
        method: "PATCH",
        headers: proxyHeaders,
        body: JSON.stringify({ status: "closed" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail ?? "상태 변경 실패");
      }
      router.refresh();
    } catch (err: unknown) {
      setStatusError((err as Error).message);
    } finally {
      setChangingStatus(false);
    }
  };

  const isClosed = currentStatus === "closed";

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6">
      {/* 좌측: 답글 스레드 */}
      <div className="flex-1 min-w-0">
        <div
          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
          style={{ minHeight: "400px" }}
        >
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">답글 스레드</h2>
          </div>

          <div
            className="flex-1 overflow-y-auto p-5 space-y-4"
            style={{ maxHeight: "520px" }}
          >
            {replies.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">
                아직 답글이 없습니다.
              </p>
            ) : (
              replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`flex flex-col gap-1 ${
                    reply.author_type === "admin" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        reply.author_type === "admin" ? "text-blue-600" : "text-gray-600"
                      }`}
                    >
                      {reply.author_type === "admin" ? "운영자" : "사용자"}
                    </span>
                    {reply.author_type === "admin" && !isPublic && (
                      <span className="text-sm text-gray-600 flex items-center gap-0.5">
                        <EyeOff className="w-3.5 h-3.5" />
                        비공개
                      </span>
                    )}
                  </div>
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      reply.author_type === "admin"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800",
                    ].join(" ")}
                  >
                    {reply.body}
                  </div>
                  <span className="text-sm text-gray-600">{formatDate(reply.created_at)}</span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* 답글 입력창 */}
          {!isClosed && (
            <div className="border-t border-gray-100 p-4">
              {replyError && (
                <p className="text-sm text-red-700 mb-2">{replyError}</p>
              )}
              <div className="flex gap-2">
                <textarea
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value.slice(0, 2000))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  rows={2}
                  placeholder="관리자 답글 입력 (Enter 전송, Shift+Enter 줄바꿈)"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                />
                <button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
                  aria-label="답글 전송"
                >
                  {sendingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 우측: 액션 패널 */}
      <div className="w-full lg:w-64 shrink-0 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">관리 액션</h2>

          <div className="space-y-3">
            {/* 공개/비공개 토글 */}
            <div>
              <p className="text-sm text-gray-600 mb-1.5">게시물 공개 설정</p>
              <button
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                className={[
                  "w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2",
                  isPublic
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100",
                ].join(" ")}
              >
                {togglingVisibility ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPublic ? (
                  <>
                    <Eye className="w-4 h-4" />
                    공개 중 (비공개로 전환)
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" />
                    비공개 중 (공개로 전환)
                  </>
                )}
              </button>
              {visibilityError && (
                <p className="text-sm text-red-700 mt-1.5">{visibilityError}</p>
              )}
            </div>

            {/* 종료 버튼 */}
            <div>
              <p className="text-sm text-gray-600 mb-1.5">문의 종료</p>
              {isClosed ? (
                <p className="text-sm text-gray-600 py-2 text-center">종료된 문의입니다.</p>
              ) : (
                <button
                  onClick={handleClose}
                  disabled={changingStatus}
                  className="w-full py-2.5 rounded-xl bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {changingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      문의 종료
                    </>
                  )}
                </button>
              )}
              {statusError && (
                <p className="text-sm text-red-700 mt-1.5">{statusError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
