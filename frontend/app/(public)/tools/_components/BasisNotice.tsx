"use client";

import { CALC_BASIS, isPastValidThrough, type CalcSource } from "@/lib/calc";
import { useClientValue } from "@/lib/useClientValue";

// 기준값 출처·확인일 표기 + 적용 연도가 지났으면 경고(ISR 캐시 시점과 무관하게 방문 시점으로 판정)
export default function BasisNotice({
  items,
}: {
  items: { label: string; validThrough?: string; sources: CalcSource[] }[];
}) {
  // 문자열 하나로 판정(같은 입력이면 ===) — 훅이 매 렌더 값을 비교하므로 배열을 직접 돌려주지 않는다
  const staleKey = useClientValue(
    () => items.filter((i) => i.validThrough && isPastValidThrough(i.validThrough)).map((i) => i.label).join("\n"),
    "",
  );
  const stale = staleKey === "" ? [] : staleKey.split("\n");

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5" aria-label="기준값 출처">
      <h2 className="text-base font-bold text-gray-900">사용한 기준값과 출처</h2>
      {stale.length > 0 ? (
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 break-keep" role="alert">
          {stale.join(", ")}은(는) 지난 적용 연도의 값일 수 있어요. 올해 기준은 아래 출처에서 확인한 뒤 직접 입력해 주세요.
        </p>
      ) : null}
      <ul className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">
        {items.map((i) => (
          <li key={i.label}>
            <p className="font-medium text-gray-900">
              {i.label}
              {i.validThrough ? <span className="ml-1 font-normal text-gray-600">(적용 연도 {i.validThrough.slice(0, 4)}년)</span> : null}
            </p>
            <ul className="mt-1 space-y-1">
              {i.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center break-all text-blue-700 underline">
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-gray-600">기준값 확인일: {CALC_BASIS.checkedAt}</p>
    </section>
  );
}
