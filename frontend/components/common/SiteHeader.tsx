"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";

// 공개 페이지 공통 헤더 — 로고 · 무료 도구 · 서비스 · 로그인 · 무료 진단.
// 묶음은 "사장님이 일에 쓰는 무료 도구"와 "AEOlab 서비스 안내"로 나눈다.
// PC: 묶음 버튼을 누르면 펼침(Esc·바깥 클릭·이동 시 닫힘) / 모바일: 햄버거 → 전체 메뉴 패널.
interface Item {
  href: string;
  label: string;
  desc: string;
  dot?: string;
  short?: string; // 모바일 칩용 짧은 이름
}

const TOOLS: Item[] = [
  { href: "/tools", label: "사장님 계산기", short: "계산기", desc: "손익분기·배달 수수료·인건비·부가세·원가", dot: "oklch(0.546 0.245 262.881)" },
  { href: "/area", label: "우리 동네 상권", short: "동네 상권", desc: "지역·업종별 업소 수와 폐업 현황", dot: "oklch(0.457 0.24 277.023)" },
  { href: "/support-programs", label: "지원사업", short: "지원사업", desc: "소상공인 지원사업 공고 모음", dot: "oklch(0.508 0.118 165.612)" },
];

const SERVICE: Item[] = [
  { href: "/how-it-works", label: "서비스 안내", desc: "AI 검색 노출을 어떻게 측정하나요" },
  { href: "/pricing", label: "요금제", desc: "플랜별 기능과 가격" },
  { href: "/faq", label: "FAQ", desc: "자주 묻는 질문" },
];

const GROUPS: { id: string; label: string; items: Item[] }[] = [
  { id: "tools", label: "무료 도구", items: TOOLS },
  { id: "service", label: "서비스", items: SERVICE },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Dot({ color }: { color?: string }) {
  if (!color) return null;
  return <span className="mr-2 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />;
}

export default function SiteHeader({ maxWidth = "max-w-6xl" }: { maxWidth?: string }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState<string | null>(null); // PC 펼침 묶음 id
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const rootRef = useRef<HTMLElement>(null);

  // 다른 페이지로 이동하면 열린 메뉴를 닫는다(렌더 중 상태 보정 — effect 안 setState 방지)
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (open === null && !mobileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, mobileOpen]);

  return (
    <header ref={rootRef} className="sticky top-0 z-40 border-b border-gray-100 bg-white">
      <div className={`mx-auto flex ${maxWidth} items-center justify-between px-4 py-3 md:px-6`}>
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex min-h-[44px] items-center text-xl font-bold text-blue-600 md:text-2xl">
            AEOlab
          </Link>

          {/* 넓은 화면(lg↑): 무료 도구 3개를 펼치지 않아도 보이게 바로 노출 */}
          <nav aria-label="무료 도구" className="ml-4 hidden items-center gap-1 lg:flex">
            {TOOLS.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-base font-medium hover:bg-gray-50 ${
                    active ? "bg-blue-50 text-blue-700" : "text-gray-800"
                  }`}
                >
                  <Dot color={i.dot} />
                  {i.label}
                </Link>
              );
            })}
          </nav>

          <nav aria-label="주요 메뉴" className="hidden items-center gap-1 md:flex">
            {GROUPS.map((g) => {
              // lg↑에서는 무료 도구가 위에 직접 노출되므로 묶음은 서비스만 둔다
              const toolsGroupHiddenOnLg = g.id === "tools" ? "lg:hidden" : "";
              const expanded = open === g.id;
              const groupActive = g.items.some((i) => isActive(pathname, i.href));
              return (
                <div key={g.id} className={`relative ${toolsGroupHiddenOnLg}`}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`site-menu-${g.id}`}
                    onClick={() => setOpen(expanded ? null : g.id)}
                    className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-base font-medium hover:bg-gray-50 ${
                      groupActive ? "text-blue-700" : "text-gray-700"
                    }`}
                  >
                    {g.label}
                    <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {expanded ? (
                    <ul
                      id={`site-menu-${g.id}`}
                      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
                    >
                      {g.items.map((i) => {
                        const active = isActive(pathname, i.href);
                        return (
                          <li key={i.href}>
                            <Link
                              href={i.href}
                              aria-current={active ? "page" : undefined}
                              className={`block rounded-lg px-3 py-2.5 hover:bg-gray-50 ${active ? "bg-blue-50" : ""}`}
                            >
                              <span className={`flex items-center text-base font-semibold ${active ? "text-blue-700" : "text-gray-900"}`}>
                                <Dot color={i.dot} />
                                {i.label}
                              </span>
                              <span className="mt-0.5 block text-sm text-gray-600">{i.desc}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <AuthNavControlClient />
          <Link
            href="/trial"
            className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 md:px-4 md:text-base"
          >
            무료 진단<span className="ml-1 max-[389px]:hidden">시작</span>
          </Link>
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="site-menu-mobile"
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* 모바일: 햄버거를 열지 않아도 무료 도구 3개가 보이는 가로 칩 줄 */}
      <nav aria-label="무료 도구 바로가기" className="border-t border-gray-100 md:hidden">
        <ul className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TOOLS.map((i) => {
            const active = isActive(pathname, i.href);
            return (
              <li key={i.href} className="shrink-0">
                <Link
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold ${
                    active ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-800 active:bg-gray-50"
                  }`}
                >
                  <Dot color={i.dot} />
                  {i.short ?? i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {mobileOpen ? (
        <nav id="site-menu-mobile" aria-label="전체 메뉴" className="max-h-[calc(100vh-8rem)] overflow-y-auto border-t border-gray-100 bg-white px-4 pb-4 md:hidden">
          {GROUPS.map((g) => (
            <div key={g.id} className="pt-3">
              <p className="px-1 text-sm font-semibold text-gray-600">{g.label}</p>
              <ul className="mt-1">
                {g.items.map((i) => {
                  const active = isActive(pathname, i.href);
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-[48px] flex-col justify-center rounded-lg px-3 py-2 ${active ? "bg-blue-50" : "active:bg-gray-50"}`}
                      >
                        <span className={`flex items-center text-base font-semibold ${active ? "text-blue-700" : "text-gray-900"}`}>
                          <Dot color={i.dot} />
                          {i.label}
                        </span>
                        <span className="text-sm text-gray-600">{i.desc}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
