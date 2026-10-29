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
  naver_place_id: string;
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
  // 플레이스 ID는 등록됐는데 평균 별점을 읽지 못한 경우 — 입력할 수 있다는 것을 점으로 알린다
  const ratingMissing = !!initialData.naver_place_id && !(initialData.avg_rating > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-2 rounded-lg transition-colors"
        title={ratingMissing ? "가게 정보 빠른 수정 — 평균 별점을 읽지 못했어요. 입력할 수 있어요" : "가게 정보 빠른 수정"}
        aria-label={ratingMissing ? "가게 정보 빠른 수정, 평균 별점 입력 가능" : "가게 정보 빠른 수정"}
      >
        <Pencil className="w-4 h-4" />
        <span className="hidden sm:inline">수정</span>
        {ratingMissing && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
        )}
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
