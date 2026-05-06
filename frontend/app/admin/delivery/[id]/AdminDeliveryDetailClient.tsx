"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

// 서버사이드 프록시를 통해 admin API 호출 — ADMIN_SECRET_KEY를 클라이언트에 노출하지 않음
const ADMIN_PROXY = "/api/admin-proxy";

interface Message {
  id: string;
  sender_type: "user" | "admin";
  body: string;
  created_at: string;
}

interface CompletionReport {
  items?: string[];
  summary?: string;
}

interface Props {
  orderId: string;
  initialMessages: Message[];
  currentStatus: string;
  adminKey?: string; // 더 이상 클라이언트에서 사용하지 않음 — 프록시 경유
}

const COMPLETION_CHECKLIST = [
  "소개글 등록 완료",
  "키워드 최적화 완료",
  "톡톡 채팅방 메뉴 등록 완료",
  "후기 답글 템플릿 제공",
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });

export function AdminDeliveryDetailClient({ orderId, initialMessages, currentStatus, adminKey }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [msgInput, setMsgInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgError, setMsgError] = useState("");

  // 상태 변경
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");

  // 완료 처리 모달
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [checkedItems, setCheckedItems] = useState<boolean[]>(COMPLETION_CHECKLIST.map(() => false));
  const [completeMemo, setCompleteMemo] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const proxyHeaders = { "Content-Type": "application/json" };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "completed") {
      setShowCompleteModal(true);
      return;
    }
    setChangingStatus(newStatus);
    setStatusError("");
    try {
      const res = await fetch(
        `${ADMIN_PROXY}?path=admin/delivery/${orderId}/status`,
        {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "상태 변경 실패");
      }
      window.location.reload();
    } catch (err: unknown) {
      setStatusError((err as Error).message);
    } finally {
      setChangingStatus(null);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    setCompleteError("");
    try {
      const completedItems = COMPLETION_CHECKLIST.filter((_, i) => checkedItems[i]);
      const report: CompletionReport = {
        items: completedItems,
        summary: completeMemo.trim() || undefined,
      };
      const res = await fetch(
        `${ADMIN_PROXY}?path=admin/delivery/${orderId}/complete`,
        {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify({ completion_report: report }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "완료 처리 실패");
      }
      setShowCompleteModal(false);
      window.location.reload();
    } catch (err: unknown) {
      setCompleteError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const handleSendMessage = async () => {
    const body = msgInput.trim();
    if (!body) return;
    setSendingMsg(true);
    setMsgError("");
    try {
      const res = await fetch(
        `${ADMIN_PROXY}?path=admin/delivery/${orderId}/messages`,
        {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify({ body }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? "메시지 전송 실패");
      }
      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg.message ?? { id: Date.now().toString(), sender_type: "admin", body, created_at: new Date().toISOString() }]);
      setMsgInput("");
    } catch (err: unknown) {
      setMsgError((err as Error).message);
    } finally {
      setSendingMsg(false);
    }
  };

  const isDone = currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "refunded";

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6">
      {/* 좌측: 메시지 스레드 */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: "400px" }}>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">메시지 스레드</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ maxHeight: "500px" }}>
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">메시지가 없습니다.</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${msg.sender_type === "admin" ? "items-end" : "items-start"}`}
                >
                  <span className={`text-sm font-semibold ${msg.sender_type === "admin" ? "text-blue-600" : "text-gray-600"}`}>
                    {msg.sender_type === "admin" ? "운영자" : "사용자"}
                  </span>
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.sender_type === "admin"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800",
                    ].join(" ")}
                  >
                    {msg.body}
                  </div>
                  <span className="text-sm text-gray-400">{formatDate(msg.created_at)}</span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          {!isDone && (
            <div className="border-t border-gray-100 p-4">
              {msgError && <p className="text-sm text-red-500 mb-2">{msgError}</p>}
              <div className="flex gap-2">
                <textarea
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={2}
                  placeholder="운영자 메시지 입력 (Enter 전송)"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMsg || !msgInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
                >
                  {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 우측: 상태 변경 패널 */}
      <div className="w-full lg:w-72 shrink-0 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">상태 변경</h2>

          {statusError && (
            <p className="text-sm text-red-500 mb-3">{statusError}</p>
          )}

          <div className="space-y-2">
            {currentStatus === "received" && (
              <button
                onClick={() => handleStatusChange("in_progress")}
                disabled={changingStatus === "in_progress"}
                className="w-full py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {changingStatus === "in_progress" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                진행 시작
              </button>
            )}

            {(currentStatus === "received" || currentStatus === "in_progress") && (
              <button
                onClick={() => handleStatusChange("completed")}
                disabled={!!changingStatus || completing}
                className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                완료 처리
              </button>
            )}

            {!isDone && (
              <button
                onClick={() => handleStatusChange("cancelled")}
                disabled={!!changingStatus}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                취소
              </button>
            )}

            {isDone && (
              <p className="text-sm text-gray-400 text-center py-2">
                이미 종료된 의뢰입니다.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 완료 처리 모달 */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">완료 보고서 입력</h3>

            <div className="space-y-2 mb-4">
              {COMPLETION_CHECKLIST.map((item, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedItems[i]}
                    onChange={(e) => {
                      const next = [...checkedItems];
                      next[i] = e.target.checked;
                      setCheckedItems(next);
                    }}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="text-sm text-gray-800">{item}</span>
                </label>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">메모 (선택)</label>
              <textarea
                value={completeMemo}
                onChange={(e) => setCompleteMemo(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="추가 완료 사항, 특이사항 등을 입력하세요."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400 transition"
              />
            </div>

            {completeError && (
              <p className="text-sm text-red-500 mb-3">{completeError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={completing}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                완료 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
