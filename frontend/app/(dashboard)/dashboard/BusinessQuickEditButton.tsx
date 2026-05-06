"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import BusinessQuickEditPanel from "@/components/dashboard/BusinessQuickEditPanel";

interface InitialData {
  keywords: string[];
  has_faq: boolean;
  has_intro: boolean;
  has_recent_post: boolean;
  visitor_review_count: number;
  receipt_review_count: number;
  avg_rating: number;
  naver_place_url: string;
}

interface Props {
  bizId: string;
  bizName: string;
  initialData: InitialData;
  authToken: string;
}

export default function BusinessQuickEditButton({ bizId, bizName, initialData, authToken }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-2 rounded-lg transition-colors"
        title="가게 정보 빠른 수정"
        aria-label="가게 정보 빠른 수정"
      >
        <Pencil className="w-4 h-4" />
        <span className="hidden sm:inline">수정</span>
      </button>

      <BusinessQuickEditPanel
        isOpen={open}
        onClose={() => setOpen(false)}
        bizId={bizId}
        bizName={bizName}
        initialData={initialData}
        authToken={authToken}
      />
    </>
  );
}
