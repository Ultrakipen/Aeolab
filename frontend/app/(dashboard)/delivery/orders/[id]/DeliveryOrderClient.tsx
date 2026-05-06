"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Message {
  id: string;
  order_id: string;
  sender_type: "user" | "admin";
  body: string;
  created_at: string;
}

interface Props {
  orderId: string;
  initialMessages: Message[];
  isDisabled: boolean;
  token: string;
}

export default function DeliveryOrderClient({ orderId, initialMessages, isDisabled, token }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("ko-KR", {
      hour: "2-digit", minute: "2-digit",
    });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", {
      month: "short", day: "numeric",
    });

  // 날짜 구분선 처리
  const getDateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";
    return formatDate(iso);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    setError(null);
    setSending(true);
    setInput("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/delivery/orders/${orderId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? "메시지 전송에 실패했습니다.");
      }

      const { message: newMsg } = await res.json();
      setMessages((prev) => [...prev, newMsg]);
    } catch (err: unknown) {
      setError((err as Error).message ?? "오류가 발생했습니다.");
      setInput(content); // 실패 시 입력 복원
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 날짜 구분선을 삽입하기 위한 날짜 추적
  const renderedDates = new Set<string>();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
        <h2 className="text-base font-semibold text-gray-800">메시지</h2>
        {isDisabled && (
          <span className="ml-auto text-sm text-gray-400">종료된 의뢰</span>
        )}
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 min-h-[240px] max-h-[480px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" strokeWidth={1.2} />
            <p className="text-sm">아직 메시지가 없습니다.</p>
            <p className="text-sm">의뢰 내용을 담당자에게 문의해 보세요.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const dateLabel = getDateLabel(msg.created_at);
            const showDateDivider = !renderedDates.has(dateLabel);
            if (showDateDivider) renderedDates.add(dateLabel);

            const isUser = msg.sender_type === "user";

            return (
              <div key={msg.id}>
                {showDateDivider && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-sm text-gray-400 shrink-0">{dateLabel}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}
                <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
                  <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    {!isUser && (
                      <span className="text-sm text-gray-500 font-medium px-1">AEOlab 담당자</span>
                    )}
                    <div
                      className={[
                        "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                        isUser
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm",
                      ].join(" ")}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    </div>
                    <span className="text-sm text-gray-400 px-1">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      <div className="px-5 py-4 border-t border-gray-100">
        {error && (
          <p className="text-sm text-red-600 mb-2">{error}</p>
        )}
        {isDisabled ? (
          <p className="text-center text-sm text-gray-400 py-2">
            완료 또는 취소된 의뢰는 메시지를 보낼 수 없습니다.
          </p>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="담당자에게 문의할 내용을 입력하세요. (Enter 전송, Shift+Enter 줄바꿈)"
              rows={2}
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder:text-gray-400 resize-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              aria-label="메시지 전송"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
