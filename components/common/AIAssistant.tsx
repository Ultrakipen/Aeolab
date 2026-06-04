"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  bizId?: string;
  plan: string;
  authToken: string;
}

const PAID_PLANS = ["basic", "startup", "pro", "biz", "enterprise"];

const PLAN_MONTHLY_LIMIT: Record<string, number> = {
  basic: 20,
  startup: 30,
  pro: 60,
  biz: 200,
  enterprise: 999,
};

const DEFAULT_QUICK_QUESTIONS = [
  "내 점수가 왜 낮아요?",
  "FAQ를 어디에 올리나요?",
  "경쟁 가게보다 뒤처진 이유가 뭔가요?",
];

export default function AIAssistant({ bizId, plan, authToken }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickQuestions, setQuickQuestions] = useState<string[]>(DEFAULT_QUICK_QUESTIONS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  // Basic+ 미만이면 표시 안 함
  if (!PAID_PLANS.includes(plan)) return null;

  const monthlyLimit = PLAN_MONTHLY_LIMIT[plan] ?? 20;

  // 빠른 질문 fetch
  useEffect(() => {
    if (!open || quickQuestions !== DEFAULT_QUICK_QUESTIONS) return;
    fetch(`${BACKEND_URL}/api/assistant/quick-questions`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.questions?.length) setQuickQuestions(data.questions.slice(0, 3));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 메시지 추가 시 맨 아래로 스크롤
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, loading]);

  // 채팅창 열릴 때 입력창 포커스
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;
    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ business_id: bizId, question }),
      });
      if (!res.ok) throw new Error("응답 오류");
      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.answer ?? "답변을 가져오지 못했습니다.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.quick_questions?.length) {
        setQuickQuestions(data.quick_questions.slice(0, 3));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "잠시 후 다시 시도해 주세요." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* 채팅창 */}
      {open && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-xs md:max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
          style={{ maxHeight: "min(420px, calc(100vh - 140px))" }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-blue-600 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <span className="text-base">💬</span>
              </div>
              <span className="text-base font-bold text-white">AI 도우미</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white text-opacity-80 hover:text-opacity-100 p-1 rounded transition-colors"
              aria-label="닫기"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {!hasMessages && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">무엇이든 물어보세요</p>
                <div className="space-y-2">
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-lg transition-colors leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  {plan} 플랜: 월 {monthlyLimit}회 사용 가능
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500">답변 생성 중</span>
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 대화 중 빠른 질문 */}
            {hasMessages && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-sm bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors leading-snug"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 */}
          <form onSubmit={handleSubmit} className="border-t border-gray-100 p-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="궁금한 점을 입력하세요..."
              disabled={loading}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 disabled:opacity-60 placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white disabled:text-gray-400 rounded-lg px-3 py-2.5 transition-colors shrink-0"
              aria-label="전송"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-gray-700 hover:bg-gray-800 rotate-0"
            : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
        }`}
        aria-label={open ? "AI 도우미 닫기" : "AI 도우미 열기"}
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-2xl leading-none">💬</span>
        )}
      </button>
    </>
  );
}
