"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 사장님 계산기·우리 동네 상권·지원사업 페이지 상단 메뉴 — 홈으로 돌아가지 않고 서로 오갈 수 있게 한다.
// inline: PC 헤더 안에 놓는 가로 메뉴 / row: 모바일에서 헤더 아래에 놓는 가로 스크롤 줄
// 새 기능 3개에는 각 페이지의 포인트 색(계산기 파랑 · 상권 남색 · 지원사업 초록)을 점과 선택 표시로만 쓴다.
// 글자색은 색만으로 뜻을 전하지 않도록 이름을 그대로 두고, 선택된 항목만 짙은 글자색(ink)+연한 배경(soft)으로 강조한다.
interface Accent {
  accent: string; // 점·테두리
  soft: string; // 선택 배경
  ink: string; // 선택 글자(연한 배경 위 4.5:1 이상)
}

const BLUE: Accent = { accent: "oklch(0.546 0.245 262.881)", soft: "oklch(0.97 0.014 254.604)", ink: "oklch(0.424 0.199 265.638)" };
const INDIGO: Accent = { accent: "oklch(0.457 0.24 277.023)", soft: "oklch(0.962 0.018 272.314)", ink: "oklch(0.398 0.195 277.366)" };
const GREEN: Accent = { accent: "oklch(0.508 0.118 165.612)", soft: "oklch(0.979 0.021 166.113)", ink: "oklch(0.432 0.095 166.913)" };

const ITEMS: { href: string; label: string; prefix: string; color?: Accent }[] = [
  { href: "/tools", label: "사장님 계산기", prefix: "/tools", color: BLUE },
  { href: "/area", label: "우리 동네 상권", prefix: "/area", color: INDIGO },
  { href: "/support-programs", label: "지원사업", prefix: "/support-programs", color: GREEN },
  { href: "/how-it-works", label: "서비스 안내", prefix: "/how-it-works" },
  { href: "/pricing", label: "요금제", prefix: "/pricing" },
  { href: "/faq", label: "FAQ", prefix: "/faq" },
];

function isActive(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function Dot({ color }: { color?: Accent }) {
  if (!color) return null;
  return <span className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color.accent }} aria-hidden="true" />;
}

export default function FeatureNav({ variant }: { variant: "inline" | "row" }) {
  const pathname = usePathname() ?? "";

  if (variant === "inline") {
    return (
      <nav aria-label="주요 메뉴" className="ml-6 hidden items-center gap-1 md:flex">
        {ITEMS.map((i) => {
          const active = isActive(pathname, i.prefix);
          const c = i.color;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              style={active && c ? { backgroundColor: c.soft, color: c.ink } : undefined}
              className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm ${
                active
                  ? `font-semibold ${c ? "" : "bg-blue-50 text-blue-700"}`
                  : "font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Dot color={c} />
              {i.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="주요 메뉴" className="border-b border-gray-100 bg-white md:hidden">
      <ul className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((i) => {
          const active = isActive(pathname, i.prefix);
          const c = i.color;
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                style={active && c ? { backgroundColor: c.soft, color: c.ink, borderColor: c.accent } : undefined}
                className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-4 text-sm ${
                  active
                    ? `font-semibold ${c ? "" : "border-blue-600 bg-blue-50 text-blue-700"}`
                    : "border-gray-300 bg-white font-medium text-gray-700"
                }`}
              >
                <Dot color={c} />
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
