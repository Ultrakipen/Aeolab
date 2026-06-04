import Link from "next/link";
import { Calculator, Lightbulb, ArrowRight } from "lucide-react";

const TOOLS = [
  {
    icon: Lightbulb,
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    badge: "무료",
    badgeBg: "#DCFCE7",
    badgeColor: "#166534",
    title: "AI 키워드 생성기",
    desc: "업종과 사업장명만 입력하면 AI가 네이버·ChatGPT 노출에 맞는 핵심 키워드 5~10개를 즉시 제안합니다.",
    detail: "회원가입 없이 바로 사용",
    href: "/tools/keyword",
    ctaLabel: "키워드 바로 생성 →",
    ctaBg: "#2563EB",
  },
  {
    icon: Calculator,
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    badge: "무료",
    badgeBg: "#DCFCE7",
    badgeColor: "#166534",
    title: "광고비 절감 계산기",
    desc: "현재 네이버 광고비를 입력하면 AEOlab으로 전환 시 연간 절감 금액을 계산해 드립니다.",
    detail: "회원가입 없이 바로 사용",
    href: "/tools/ad-cost-calculator",
    ctaLabel: "절감액 계산 →",
    ctaBg: "#059669",
  },
] as const;

export default function FreeToolsSection() {
  return (
    <section
      className="px-4 py-12 md:py-16"
      style={{ background: "#F0FDF4", borderTop: "1px solid #BBF7D0", borderBottom: "1px solid #BBF7D0" }}
    >
      <div className="max-w-[1020px] mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-6 md:mb-8">
          <span
            className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full mb-3"
            style={{ background: "#DCFCE7", color: "#166534" }}
          >
            가입 없이 지금 바로
          </span>
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            구독 전에 먼저 체험해보세요
          </h2>
          <p className="text-sm md:text-base mt-2 break-keep" style={{ color: "#475569" }}>
            회원가입 없이 두 가지 무료 도구를 바로 사용할 수 있습니다
          </p>
        </div>

        {/* 카드 2개 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.title}
                className="bg-white rounded-xl border p-5 md:p-6 flex flex-col gap-4"
                style={{ borderColor: "#D1FAE5", boxShadow: "0 2px 12px rgba(5,150,105,0.08)" }}
              >
                {/* 아이콘 + 뱃지 */}
                <div className="flex items-start justify-between">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: tool.iconBg }}
                  >
                    <Icon size={22} style={{ color: tool.iconColor }} />
                  </div>
                  <span
                    className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: tool.badgeBg, color: tool.badgeColor }}
                  >
                    {tool.badge}
                  </span>
                </div>

                {/* 텍스트 */}
                <div className="flex-1">
                  <h3
                    className="text-base md:text-lg font-black mb-1.5 break-keep"
                    style={{ color: "#0F172A" }}
                  >
                    {tool.title}
                  </h3>
                  <p className="text-sm leading-relaxed break-keep" style={{ color: "#475569" }}>
                    {tool.desc}
                  </p>
                  <p className="text-sm font-medium mt-2" style={{ color: "#059669" }}>
                    ✓ {tool.detail}
                  </p>
                </div>

                {/* CTA */}
                <Link
                  href={tool.href}
                  className="inline-flex items-center justify-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{ background: tool.ctaBg }}
                >
                  {tool.ctaLabel}
                  <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-sm mt-5 break-keep" style={{ color: "#64748B" }}>
          더 많은 기능이 필요하다면{" "}
          <Link href="/trial" className="font-bold underline" style={{ color: "#2563EB" }}>
            1분 무료 AI 진단
          </Link>
          을 시도해보세요
        </p>
      </div>
    </section>
  );
}
