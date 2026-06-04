"use client";

import { useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { MobileBottomTabs } from "@/components/dashboard/MobileBottomTabs";
import { FloatingChatButton } from "@/components/common/FloatingChatButton";

interface Props {
  email: string;
  plan: string | null;
  hasBusiness: boolean;
  canAddMore: boolean;
  children: React.ReactNode;
}

/**
 * 대시보드 클라이언트 쉘
 * - open state를 DashboardSidebar, MobileBottomTabs 두 곳에 공유
 * - 서버 컴포넌트인 layout.tsx에서 "use client" 없이 SSR 가능하도록 분리
 */
export function DashboardShell({
  email,
  plan,
  hasBusiness,
  canAddMore,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar
        email={email}
        plan={plan}
        hasBusiness={hasBusiness}
        canAddMore={canAddMore}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />

      {/* 메인 — 모바일: 상단바(56px) + 하단탭(56px) 패딩 / 데스크톱: 패딩 없음 */}
      <main className="flex-1 overflow-auto min-w-0 pt-14 lg:pt-0 pb-16 lg:pb-0">
        {children}
      </main>

      {/* 모바일 하단 5탭바 */}
      <MobileBottomTabs onMoreClick={() => setSidebarOpen(true)} />

      {/* 플로팅 1:1 문의 버튼 */}
      <FloatingChatButton />
    </div>
  );
}
