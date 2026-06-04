"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MessageSquare, Star, X } from "lucide-react";

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
  isCompleted?: boolean;
}

export default function DeliveryOrderClient({ orderId, initialMessages, isDisabled, token, isCompleted = false }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 후기 작성 모달 상태
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [testimonialBody, setTestimonialBody] = useState("");
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialDone, setTestimonialDone] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);

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

  const handleTestimonialSubmit = async () => {
    if (!testimonialBody.trim()) {
      setTestimonialError("후기 내용을 입력해주세요.");
      return;
    }
    setTestimonialSubmitting(true);
    setTestimonialError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/delivery/orders/${orderId}/testimonial`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: testimonialBody.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? "후기 제출에 실패했습니다.");
      }

      setTestimonialDone(true);
      setShowTestimonialModal(false);
    } catch (err: unknown) {
      setTestimonialError((err as Error).message ?? "오류가 발생했습니다.");
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTestimonialModal(false);
    };
    if (showTestimonialModal) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [showTestimonialModal]);

  // 날짜 구분선을 삽입하기 위한 날짜 추적
  const renderedDates = new Set<string>();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
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

      {/* 후기 작성 섹션 — 완료된 주문만 */}
      {isCompleted && (
        <div className="px-5 py-4 border-t border-gray-100 bg-amber-50 rounded-b-xl">
          {testimonialDone ? (
            <div className="flex items-center gap-2 text-emerald-700">
              <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
              <p className="text-sm font-medium">
                후기 감사합니다! 코칭 쿠폰은 카카오톡으로 보내드립니다.
              </p>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-amber-800 mb-0.5">후기를 남겨주세요!</p>
                <p className="text-sm text-amber-700">
                  후기 작성 시 <span className="font-bold">1:1 화상 코칭 1회 (30,000원 상당)</span>를 무료로 드립니다
                </p>
              </div>
              <button
                onClick={() => setShowTestimonialModal(true)}
                className="flex items-center gap-1.5 shrink-0 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors"
              >
                <Star className="w-4 h-4" />
                후기 작성
              </button>
            </div>
          )}
        </div>
      )}

      {/* 후기 작성 모달 */}
      {showTestimonialModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="testimonial-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4"
        >
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowTestimonialModal(false)}
            aria-hidden="true"
          />

          {/* 모달 본체 */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 z-10">
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2
                  id="testimonial-modal-title"
                  className="text-base font-bold text-gray-900"
                >
                  서비스 후기 작성
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  후기를 작성하면 <span className="font-semibold text-amber-600">1:1 화상 코칭 1회 (30,000원 상당)</span>를 무료로 드립니다
                </p>
              </div>
              <button
                onClick={() => setShowTestimonialModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
                aria-label="모달 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 텍스트 영역 */}
            <textarea
              value={testimonialBody}
              onChange={(e) => setTestimonialBody(e.target.value)}
              placeholder="서비스를 이용하며 느낀 점, 개선된 부분, 담당자 친절함 등을 자유롭게 작성해주세요."
              rows={5}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition resize-none placeholder:text-gray-400 mb-3"
            />

            {testimonialError && (
              <p className="text-sm text-red-600 mb-3">{testimonialError}</p>
            )}

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleTestimonialSubmit}
                disabled={testimonialSubmitting || !testimonialBody.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testimonialSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4" />
                    작성 완료
                  </>
                )}
              </button>
              <button
                onClick={() => setShowTestimonialModal(false)}
                className="px-5 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
