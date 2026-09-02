import Link from "next/link";
import { Lightbulb, Store, BarChart2, TrendingUp, BookOpen } from "lucide-react";
import AIAssistant from "@/components/common/AIAssistant";

interface Props {
  bizId: string;
  bizName: string;
  plan: string;
  accessToken: string;
}

const NAV_ITEMS = [
  { href: "/guide",       Icon: Lightbulb,  label: "오늘 할 일 보기",       desc: "AI가 추천하는 개선 방법" },
  { href: "/schema",      Icon: Store,       label: "소개글 · 스키마 만들기", desc: "소개글·블로그 자동 생성" },
  { href: "/competitors", Icon: BarChart2,   label: "경쟁사 관리",            desc: "주변 경쟁 점포와 비교" },
  { href: "/history",     Icon: TrendingUp,  label: "30일 변화 기록",         desc: "점수 변화 추이 보기" },
  { href: "/guide/channels", Icon: BookOpen, label: "가이드 자료실",           desc: "업종별 AI 검색 노출 체크리스트" },
];

export default function DashboardFooter({ bizId, bizName, plan, accessToken }: Props) {
  return (
    <>
      {/* 빠른 이동 그리드 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
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
            <div className="text-sm text-gray-500 mt-1.5 leading-snug break-keep">{item.desc}</div>
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
