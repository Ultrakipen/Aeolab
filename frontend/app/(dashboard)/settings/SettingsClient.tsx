"use client";

import { useState } from "react";
import { updatePhone } from "@/lib/api";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  userId: string;
  currentPhone?: string;
}

export function SettingsClient({ userId, currentPhone }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const handlePhoneSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneSaving(true);
    setPhoneSaved(false);
    try {
      await updatePhone(phone, userId);
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/api/settings/cancel`,
        {
          method: "POST",
          headers: { "X-User-Id": userId },
        }
      );
      if (res.ok) {
        setCancelled(true);
        setShowConfirm(false);
      }
    } finally {
      setCancelling(false);
    }
  };

  if (cancelled) {
    return (
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-500">
          구독 해지가 완료되었습니다. 현재 기간 만료일까지 서비스를 계속 이용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 카카오 알림 수신 번호 */}
      <div className="border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-1">카카오 알림톡 수신 번호</h3>
        <p className="text-xs text-gray-400 mb-3">AI 노출 변화, 주간 리포트 알림을 받을 번호를 입력하세요.</p>
        <form onSubmit={handlePhoneSave} className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={phoneSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {phoneSaving ? "저장 중..." : phoneSaved ? "저장됨 ✓" : "저장"}
          </button>
        </form>
      </div>

      {/* 구독 해지 */}
      <div className="border-t border-gray-100 pt-4">
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          구독 해지
        </button>
      ) : (
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-sm text-red-700 mb-3">
            정말 해지하시겠습니까? 현재 구독 기간 만료일까지는 서비스를 계속 이용할 수 있습니다.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {cancelling ? "처리 중..." : "해지 확인"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
