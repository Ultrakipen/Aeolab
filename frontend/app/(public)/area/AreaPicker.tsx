"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { areaPath, groupBySido, type AreaMeta } from "@/lib/area";

// 시도 → 시군구 → 업종 선택 후 상세 페이지로 이동. 고정 목록만 보내므로 외부 조회가 일어나지 않는다.
// (시군구가 256곳이라 한 목록에 다 넣지 않고 시도부터 고르게 한다 — 모바일에서 긴 목록을 스크롤하지 않도록)
// 긴 시·도 이름·"특별시/광역시" 표기를 목록에 쓰는 짧은 이름으로 맞춘다(예: "경상남도 창원" → "경남 창원")
const SIDO_ALIAS: Record<string, string> = {
  경상남도: "경남", 경상북도: "경북", 전라남도: "전남", 전라북도: "전북", 전북특별자치도: "전북",
  충청남도: "충남", 충청북도: "충북", 강원특별자치도: "강원", 제주특별자치도: "제주", 경기도: "경기",
  세종특별자치시: "세종", 전남광주통합특별시: "전남광주",
};
function normToken(t: string): string {
  const a = SIDO_ALIAS[t];
  if (a) return a;
  return t.replace(/(특별시|광역시)$/, "");
}

export default function AreaPicker({
  meta,
  initialRegion,
  initialCategory,
  availability = null,
}: {
  meta: AreaMeta;
  initialRegion?: string;
  initialCategory?: string;
  // 지역 → 값이 모인 업종. null 이면(조회 실패) 표시 없이 전부 선택 가능
  availability?: Record<string, string[]> | null;
}) {
  const router = useRouter();
  const groups = useMemo(() => groupBySido(meta.regions), [meta.regions]);
  const initial = meta.regions.find((r) => r.slug === initialRegion);
  const [sido, setSido] = useState(initial?.sido ?? "");
  const [region, setRegion] = useState(initial?.slug ?? "");
  const [category, setCategory] = useState(initialCategory ?? "");
  const ready = region !== "" && category !== "";
  const options = groups.find((g) => g.sido === sido)?.regions ?? [];
  // 아직 수집되지 않은 지역·업종은 누르면 빈 화면이 나오므로 미리 "집계 준비 중"으로 알려 준다(지금 보고 있는 선택은 그대로 둔다)
  const regionReady = (slug: string) => availability === null || (availability[slug]?.length ?? 0) > 0;
  const categoryReady = (value: string) =>
    availability === null || region === "" || (availability[region]?.includes(value) ?? false);
  const readyRegionCount = availability === null ? null : options.filter((r) => regionReady(r.slug)).length;

  // 이름으로 바로 찾기 — 시·도를 먼저 고르지 않아도 "창원", "경남 창원" 처럼 입력하면 일치하는 모든 지역을 보여 준다
  const [query, setQuery] = useState("");
  const tokens = query.trim().split(/\s+/).filter(Boolean).map(normToken);
  const matches =
    tokens.length === 0
      ? []
      : meta.regions.filter((r) => {
          const hay = `${r.sido} ${r.sigungu}`.replace(/\s+/g, "");
          return tokens.every((t) => hay.includes(t.replace(/\s+/g, "")));
        });
  const MAX_SHOWN = 30;

  const selectClass =
    "w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500";

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) router.push(areaPath(region, category));
      }}
    >
      <div className="md:col-span-4">
        <label htmlFor="area-search" className="mb-1 block text-sm font-medium text-gray-700">
          지역 이름으로 찾기
        </label>
        <input
          id="area-search"
          type="search"
          value={query}
          autoComplete="off"
          placeholder="예: 창원, 성산구, 경남 김해"
          onChange={(e) => setQuery(e.target.value)}
          className="w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {tokens.length > 0 ? (
          <div className="mt-2" aria-live="polite">
            {matches.length === 0 ? (
              <p className="text-sm text-gray-600 break-keep">일치하는 지역이 없어요. 시·군·구 이름만 입력해 보세요(예: 성산구).</p>
            ) : (
              <>
                <p className="mb-1 text-sm text-gray-600">
                  {matches.length}곳이 검색됐어요{matches.length > MAX_SHOWN ? ` (앞의 ${MAX_SHOWN}곳만 표시)` : ""}.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {matches.slice(0, MAX_SHOWN).map((r) => {
                    const ready = regionReady(r.slug);
                    return (
                      <li key={r.slug}>
                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => {
                            setSido(r.sido);
                            setRegion(r.slug);
                            setQuery("");
                          }}
                          className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          {r.sido} {r.sigungu}
                          {ready ? "" : " (집계 준비 중)"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">시·도</span>
        <select
          className={selectClass}
          value={sido}
          onChange={(e) => {
            setSido(e.target.value);
            setRegion(""); // 시도가 바뀌면 이전 시군구 선택을 비운다(다른 시도의 지역이 남지 않게)
          }}
        >
          <option value="">시·도를 선택하세요</option>
          {groups.map((g) => (
            <option key={g.sido} value={g.sido}>
              {g.sido}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">시·군·구</span>
        <select
          className={selectClass}
          value={region}
          disabled={sido === ""}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="">{sido === "" ? "시·도를 먼저 선택하세요" : "시·군·구를 선택하세요"}</option>
          {options.map((r) => (
            <option key={r.slug} value={r.slug} disabled={!regionReady(r.slug) && r.slug !== initial?.slug}>
              {regionReady(r.slug) ? r.sigungu : `${r.sigungu} (집계 준비 중)`}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">업종</span>
        <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">업종을 선택하세요</option>
          {meta.categories.map((c) => (
            <option key={c.value} value={c.value} disabled={!categoryReady(c.value) && c.value !== initialCategory}>
              {categoryReady(c.value) ? c.label : `${c.label} (집계 준비 중)`}
            </option>
          ))}
        </select>
      </label>
      {sido !== "" && readyRegionCount === 0 ? (
        <p className="text-sm leading-relaxed text-gray-600 break-keep md:col-span-4">
          이 시·도는 공공데이터를 모으는 중이라 아직 선택할 수 있는 지역이 없어요. 순서대로 반영하고 있어요.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!ready}
        className="min-h-[48px] rounded-lg bg-blue-600 px-6 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600"
      >
        상권 보기
      </button>
    </form>
  );
}
