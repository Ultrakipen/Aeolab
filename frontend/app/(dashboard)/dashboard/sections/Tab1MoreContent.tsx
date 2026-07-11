"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default function Tab1MoreContent({ children }: Props) {
  const [show, setShow] = useState(false);

  if (show) return <>{children}</>;

  return (
    <button
      onClick={() => setShow(true)}
      className="w-full flex items-center justify-center gap-1.5 py-3 text-sm text-gray-500 hover:text-gray-600 border border-dashed border-gray-200 rounded-xl transition-colors"
    >
      <ChevronDown className="w-4 h-4" />
      상세 차트 · AI 인용 · 리뷰 감정 더 보기
    </button>
  );
}
