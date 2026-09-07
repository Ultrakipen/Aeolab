import Link from "next/link";
import { Store, BookOpen } from "lucide-react";
import AIAssistant from "@/components/common/AIAssistant";

interface Props {
  bizId: string;
  bizName: string;
  plan: string;
  accessToken: string;
}

// 가이드(/guide)·경쟁사(/competitors)·변화기록(/history)은 데스크톱 사이드바(DashboardSidebar)
// 와 모바일 하단 탭바(MobileBottomTabs) 양쪽에 이미 있어 여기서 제거함(중복 네비게이션,
// 2026-09-07 외부 진단 반영). 아래 2개만 두 네비게이션 어디에도 없는 항목.
const NAV_ITEMS = [
  { href: "/schema",        Icon: Store,     label: "소개글 · 스키마 만들기", desc: "소개글·블로그 자동 생성" },
  { href: "/guide/channels", Icon: BookOpen, label: "가이드 자료실",          desc: "업종별 AI 검색 노출 체크리스트" },
];

export default function DashboardFooter({ bizId, bizName, plan, accessToken }: Props) {
  return (
    <>
      {/* 빠른 이동 그리드 — 사이드바·탭바에 없는 항목만 */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-w-xl mx-auto sm:mx-0">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow text-center border border-gray-100 hover:border-blue-300"
          >
            <div className="flex justify-center mb-2">
              <item.Icon className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
            </div>
            <div className="font-bold text-gray-900 text-base md:text-lg leading-tight break-keep">
              {item.label}
            </div>
            <div className="text-sm text-gray-600 mt-1.5 leading-snug break-keep">{item.desc}</div>
          </Link>
        ))}
      </div>

      {/* AI 도우미 플로팅 채팅 — Basic+ 전용 */}
      {["basic", "startup", "pro", "biz", "enterprise"].includes(plan) && accessToken && (
        <AIAssistant bizId={bizId} plan={plan} authToken={accessToken} />
      )}
    </>
  );
}
