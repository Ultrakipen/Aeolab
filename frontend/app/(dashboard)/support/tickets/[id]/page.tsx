"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, AlertCircle, Loader2, Send } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Reply {
  id: string;
  ticket_id: string;
  sender_type: "user" | "admin";
  body: string;
  created_at: string;
}

interface TicketDetail {
  id: string;
  category: string;
  title: string;
  body: string;
  status: string;
  visibility: "public" | "private";
  created_at: string;
  replies?: Reply[];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "답변 대기", color: "bg-blue-100 text-blue-700" },
  answered: { label: "답변 완료", color: "bg-green-100 text-green-700" },
  closed: { label: "종료", color: "bg-gray-100 text-gray-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  payment: "결제",
  feature: "기능 사용",
  score: "점수 해석",
  bug: "버그",
  other: "기타",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

function TicketDetailInner() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [token, setToken] = useState("");

  const [replyBody, setReplyBody] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const tok = sessionData.session?.access_token ?? "";
        setToken(tok);

        const res = await fetch(`${BACKEND_URL}/api/support/tickets/${id}`, {
          headers: { Authorization: `Bearer ${tok}` },
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("문의를 불러올 수 없습니다.");
        }
        const data = await res.json();
        setTicket(data.ticket ?? data);
      } catch (err: unknown) {
        setLoadError((err as Error).message ?? "불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.replies]);

  const handleReply = async () => {
    const body = replyBody.trim();
    if (!body) return;
    setSubmittingReply(true);
    setReplyError("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/support/tickets/${id}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "전송 실패");
      }
      const data = await res.json();
      const newReply = data.reply ?? {
        id: Date.now().toString(),
        ticket_id: id,
        sender_type: "user" as const,
        body,
        created_at: new Date().toISOString(),
      };
      setTicket((prev) => prev
        ? { ...prev, replies: [...(prev.replies ?? []), newReply] }
        : prev
      );
      setReplyBody("");
    } catch (err: unknown) {
      setReplyError((err as Error).message);
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (loadError || !ticket) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium text-red-800">
              {loadError || "문의를 찾을 수 없습니다."}
            </p>
            <a href="/support/tickets" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              목록으로 돌아가기
            </a>
          </div>
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[ticket.status] ?? { label: ticket.status, color: "bg-gray-100 text-gray-600" };
  const isClosed = ticket.status === "closed";
  const replies = ticket.replies ?? [];
  const adminReplies = replies.filter((r) => r.sender_type === "admin");
  const userReplies = replies.filter((r) => r.sender_type === "user" && replies.indexOf(r) > 0);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 flex-wrap">
          <a href="/support/tickets" className="hover:text-blue-600 transition-colors">1:1 문의</a>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 truncate max-w-[180px]">{ticket.title}</span>
        </div>

        {/* 문의 본문 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 mb-1">{ticket.title}</h1>
              <p className="text-sm text-gray-400">
                {CATEGORY_LABELS[ticket.category] ?? ticket.category} · {formatDate(ticket.created_at)}
                {ticket.visibility === "public" && <span className="ml-2 text-green-600 font-medium">공개</span>}
              </p>
            </div>
            <span className={`shrink-0 text-sm font-semibold px-3 py-1.5 rounded-full ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.body}</p>
          </div>
        </div>

        {/* 답변 + 추가 코멘트 스레드 */}
        {replies.length > 0 && (
          <div className="space-y-3 mb-4">
            {replies.map((reply) => (
              <div
                key={reply.id}
                className={[
                  "rounded-2xl border p-4",
                  reply.sender_type === "admin"
                    ? "bg-blue-50 border-blue-200"
                    : "bg-white border-gray-100 shadow-sm",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-semibold ${reply.sender_type === "admin" ? "text-blue-700" : "text-gray-700"}`}>
                    {reply.sender_type === "admin" ? "운영자" : "나"}
                  </span>
                  <span className="text-sm text-gray-400">{formatDate(reply.created_at)}</span>
                  {reply.sender_type === "admin" && (
                    <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">답변</span>
                  )}
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{reply.body}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* 추가 코멘트 입력창 */}
        {!isClosed && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">추가 코멘트</h2>
            {replyError && (
              <p className="text-sm text-red-500 mb-2">{replyError}</p>
            )}
            <div className="flex gap-2">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
                rows={3}
                placeholder="추가 질문이나 정보를 입력해 주세요. (Enter 전송, Shift+Enter 줄바꿈)"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder:text-gray-400"
              />
              <button
                onClick={handleReply}
                disabled={submittingReply || !replyBody.trim()}
                className="px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
              >
                {submittingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-1 text-right">{replyBody.length}/1000</p>
          </div>
        )}

        {isClosed && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
            종료된 문의입니다. 새로운 문의가 필요하시면{" "}
            <a href="/support/tickets/new" className="text-blue-600 hover:underline">새 문의 작성</a>을 이용해 주세요.
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupportTicketDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    }>
      <TicketDetailInner />
    </Suspense>
  );
}
