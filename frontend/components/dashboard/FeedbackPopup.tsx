"use client";

import { useState, useEffect, useCallback } from "react";
import { ThumbsUp, ThumbsDown, X } from "lucide-react";

interface Props {
  eventType: "guide_generated" | "scan_complete";
  trigger: boolean;
  accessToken?: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export function FeedbackPopup({ eventType, trigger, accessToken }: Props) {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    if (typeof window === "undefined") return;
    const key = `feedback_shown_${eventType}`;
    const lastShown = localStorage.getItem(key);
    if (lastShown && Date.now() - parseInt(lastShown) < COOLDOWN_MS) return;
    setVisible(true);
    localStorage.setItem(key, String(Date.now()));
  }, [trigger, eventType]);

  const submit = useCallback(
    async (rating: number) => {
      setSubmitted(true);
      try {
        await fetch(`${BACKEND}/api/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ event_type: eventType, rating }),
        });
      } catch {
        // 피드백은 비핵심 기능 — 실패해도 UX 차단 금지
      }
      setTimeout(() => setVisible(false), 1500);
    },
    [eventType, accessToken]
  );

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-50 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 w-72">
      <button
        onClick={() => setVisible(false)}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="닫기"
      >
        <X className="w-4 h-4" />
      </button>

      {submitted ? (
        <p className="text-sm font-medium text-green-600 text-center py-2">
          감사합니다! 피드백이 전송됐어요.
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-800 mb-3 pr-5">
            {eventType === "guide_generated"
              ? "가이드가 도움이 됐나요?"
              : "스캔 결과에 만족하셨나요?"}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => submit(1)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors"
            >
              <ThumbsUp className="w-4 h-4" />
              도움됐어요
            </button>
            <button
              onClick={() => submit(0)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <ThumbsDown className="w-4 h-4" />
              아쉬워요
            </button>
          </div>
        </>
      )}
    </div>
  );
}
