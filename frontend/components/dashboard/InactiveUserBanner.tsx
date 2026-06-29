"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "inactive_banner_dismissed";

interface Props {
  userCreatedAt: string;
}

export default function InactiveUserBanner({ userCreatedAt }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 가입 후 7일 이내 여부 확인
    const daysSinceSignup =
      (Date.now() - new Date(userCreatedAt).getTime()) / 86400000;
    const isDismissed = localStorage.getItem(STORAGE_KEY) === "1";

    if (daysSinceSignup < 7 && !isDismissed) {
      setVisible(true);
    }
  }, [userCreatedAt]);

  if (!visible) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      className="fade-up flex items-start gap-3 rounded-xl border border-blue-200 bg-[#EFF6FF] p-3 md:p-4"
      role="alert"
    >
      <p className="flex-1 text-sm leading-relaxed text-[#1E40AF] break-keep">
        '플레이스형' AI 브리핑은 비대상 업종이지만, 블로그·콘텐츠로 '정보형 AI 브리핑' 노출 가능합니다. ChatGPT·Gemini 노출은 정상 측정 중이며, AI탭도 업종 제한이 없습니다(정식 출시).
      </p>
      <button
        onClick={handleDismiss}
        aria-label="배너 닫기"
        className="mt-0.5 flex-shrink-0 rounded-md p-1 text-[#1E40AF] hover:bg-blue-100 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
