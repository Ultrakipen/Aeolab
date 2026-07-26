"use client";

import { syncActiveBusinessCookie } from "@/lib/active-business-client";

interface Props {
  href: string;
  bizId: string;
  active: boolean;
  children: React.ReactNode;
}

/**
 * 대시보드·가이드 등 페이지 상단 "사업장 전환" 탭 하나.
 * 클릭 시 aeolab_active_biz 쿠키를 함께 갱신해, 이후 다른 페이지로 이동해도
 * 방금 선택한 사업장이 유지되도록 한다(getActiveBusinessId가 이 쿠키를 읽음).
 */
export function BusinessTabLink({ href, bizId, active, children }: Props) {
  return (
    <a
      href={href}
      onClick={() => syncActiveBusinessCookie(bizId)}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
      }`}
    >
      {children}
    </a>
  );
}
