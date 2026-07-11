"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  title: string;
  body: string;
  cta_label?: string | null;
  cta_url?: string | null;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    // getUser()로 인증 검증 먼저 (Invalid Refresh Token 방지)
    supabase.auth.getUser().then(({ data: userData, error }) => {
      if (error || !userData?.user) return;
      // 인증 통과 후 API 토큰 획득
      supabase.auth.getSession().then(({ data }) => {
        const t = data.session?.access_token ?? null;
        setToken(t);
        if (!t) return;
        fetch(`${BACKEND}/api/messages/unread`, {
          headers: { Authorization: `Bearer ${t}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
          .then((res) => {
            if (res) {
              setUnreadCount((res as { unread_count?: number }).unread_count ?? 0);
              setMessages((res as { messages?: Message[] }).messages ?? []);
            }
          });
      });
    });
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const markRead = async (msgId: string) => {
    if (!token) return;
    await fetch(`${BACKEND}/api/messages/${msgId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // 읽지 않은 메시지가 없으면 아이콘 자체를 숨김
  if (unreadCount === 0 && !open) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label={`알림 ${unreadCount}개`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-sm font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">알림</p>
            <button onClick={() => setOpen(false)} className="text-gray-500 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-500 text-center py-6">새 알림이 없습니다</p>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {messages.map((msg) => (
                <div key={msg.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{msg.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">{msg.body}</p>
                  {msg.cta_label && msg.cta_url && (
                    <a
                      href={msg.cta_url}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                    >
                      {msg.cta_label} →
                    </a>
                  )}
                  <button
                    onClick={() => markRead(msg.id)}
                    className="text-sm text-gray-500 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mt-1 transition-colors"
                  >
                    읽음으로 표시
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
