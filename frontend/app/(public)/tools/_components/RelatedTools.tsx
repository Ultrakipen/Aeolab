"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TOOLS = [
  { href: "/tools/break-even", label: "손익분기점·마진율" },
  { href: "/tools/delivery-settlement", label: "배달앱 실수령액" },
  { href: "/tools/labor-cost", label: "직원 인건비" },
  { href: "/tools/vat", label: "부가세" },
];

// 다른 계산기로 이동(현재 페이지는 제외) — 계산기 한 개를 쓰고 끝나지 않고 이어서 쓰게 한다
export default function RelatedTools() {
  const pathname = usePathname();
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5" aria-label="다른 계산기">
      <h2 className="text-base font-bold text-gray-900">다른 계산기도 써 보세요</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {TOOLS.filter((t) => t.href !== pathname).map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-800 hover:border-blue-300 hover:bg-blue-50"
            >
              {t.label}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/area"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-800 hover:border-blue-300 hover:bg-blue-50"
          >
            우리 동네 상권
          </Link>
        </li>
      </ul>
    </section>
  );
}
