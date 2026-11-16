"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useClientValue } from "@/lib/useClientValue";
import {
  REGION_OPTIONS,
  ddayLabel,
  daysUntil,
  eventTypeOptions,
  filterEvents,
  filterSupport,
  regionLabel,
  sortEvents,
  sortSupport,
  todayKst,
  type EventItem,
  type SupportItem,
  type SupportSort,
} from "@/lib/supportBoard";

const PAGE = 20;

const selectClass =
  "w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "blue" | "amber" | "red" }) {
  const cls = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-50 text-blue-800",
    amber: "bg-amber-50 text-amber-900",
    red: "bg-red-50 text-red-800",
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium ${cls}`}>{children}</span>;
}

function Dday({ end, today }: { end: string | null; today: string }) {
  const label = today ? ddayLabel(end, today) : "";
  if (!label) return null;
  const n = daysUntil(end, today);
  const tone = n !== null && n <= 3 ? "red" : n !== null && n <= 7 ? "amber" : "blue";
  return <Badge tone={tone}>{label}</Badge>;
}

function SupportCard({ it, today }: { it: SupportItem; today: string }) {
  const region = regionLabel(it.regions);
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {it.field ? <Badge tone="blue">{it.field}</Badge> : null}
        {region ? <Badge>{region}</Badge> : null}
        <Badge tone={it.sbiz_target ? "blue" : "gray"}>지원대상: {it.target || "원문 확인"}</Badge>
        <Dday end={it.end} today={today} />
      </div>
      <h3 className="mt-2 break-keep text-base font-bold leading-snug text-gray-900 md:text-lg">
        <a href={it.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {it.title}
        </a>
      </h3>
      <p className="mt-2 text-sm text-gray-700">
        {it.end ? (
          <>
            <span className="font-medium">신청기간</span> {it.start} ~ {it.end}
          </>
        ) : (
          <>
            <span className="font-medium">신청기간</span> {it.period_raw || "원문 확인"}{" "}
            <span className="text-gray-600">(날짜가 정해지지 않은 공고예요. 마감은 원문에서 확인하세요)</span>
          </>
        )}
      </p>
      {it.summary ? <p className="mt-1 break-keep text-sm leading-relaxed text-gray-600">{it.summary}</p> : null}
      <p className="mt-2 break-keep text-sm text-gray-600">
        소관 {it.agency || "-"}
        {it.exec_agency ? ` · 수행 ${it.exec_agency}` : ""}
        {it.contact ? ` · 문의 ${it.contact}` : ""}
      </p>
      <a
        href={it.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100"
      >
        기업마당에서 원문 보기
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </li>
  );
}

function EventStatus({ it, today }: { it: EventItem; today: string }) {
  if (!today || !it.start) return null;
  const toStart = daysUntil(it.start, today);
  if (toStart === null) return null;
  if (toStart > 0) return <Badge tone={toStart <= 3 ? "red" : toStart <= 7 ? "amber" : "blue"}>D-{toStart}</Badge>;
  if (toStart === 0) return <Badge tone="red">오늘 시작</Badge>;
  return <Badge tone="amber">진행 중</Badge>; // 시작은 지났고 끝나지 않은 행사(끝난 행사는 목록에서 이미 빠진다)
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function EventCard({ it, today }: { it: EventItem; today: string }) {
  const originHost = it.origin_url ? hostOf(it.origin_url) : "";
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {it.type ? <Badge tone="blue">{it.type.split("@").join(" · ")}</Badge> : null}
        {it.area ? <Badge>{it.area}</Badge> : null}
        {it.field ? <Badge>{it.field.split("@").join(" · ")}</Badge> : null}
        <EventStatus it={it} today={today} />
      </div>
      <h3 className="mt-2 break-keep text-base font-bold leading-snug text-gray-900 md:text-lg">
        <a href={it.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {it.title}
        </a>
      </h3>
      <p className="mt-2 text-sm text-gray-700">
        <span className="font-medium">행사 기간</span>{" "}
        {it.start && it.end ? (it.start === it.end ? it.start : `${it.start} ~ ${it.end}`) : it.period_raw || "원문 확인"}
        {it.org ? <span className="text-gray-600"> · 주최 {it.org}</span> : null}
      </p>
      {it.summary ? <p className="mt-1 break-keep text-sm leading-relaxed text-gray-600">{it.summary}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          기업마당에서 보기
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        {it.origin_url ? (
          <a
            href={it.origin_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            주최 측 안내{originHost ? ` (${originHost})` : ""}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default function SupportBoard({ support, events }: { support: SupportItem[]; events: EventItem[] }) {
  // 방문 시점의 한국 날짜(서버 렌더·첫 하이드레이션은 빈 값 → 마감 계산은 방문 뒤에 적용)
  const today = useClientValue(() => todayKst(), "");
  const [tab, setTab] = useState<"support" | "events">("support");

  const [region, setRegion] = useState("");
  const [field, setField] = useState("");
  const [sbizOnly, setSbizOnly] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SupportSort>("deadline");
  const [shown, setShown] = useState(PAGE);

  const [eRegion, setERegion] = useState("");
  const [eType, setEType] = useState("");
  const [eQ, setEQ] = useState("");
  const [eShown, setEShown] = useState(PAGE);

  const fields = useMemo(() => [...new Set(support.map((s) => s.field).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [support]);
  const types = useMemo(() => eventTypeOptions(events), [events]);

  const supportList = useMemo(
    () => sortSupport(filterSupport(support, { region, field, sbizOnly, q }, today), sort),
    [support, region, field, sbizOnly, q, sort, today],
  );
  const eventList = useMemo(
    () => sortEvents(filterEvents(events, { region: eRegion, type: eType, q: eQ }, today), today),
    [events, eRegion, eType, eQ, today],
  );

  const resetFilters = () => {
    setRegion("");
    setField("");
    setSbizOnly(true);
    setQ("");
    setShown(PAGE);
  };

  return (
    <div>
      <div role="tablist" aria-label="보기 종류" className="flex flex-wrap gap-2">
        {(
          [
            ["support", `지원사업 공고 (${support.length})`],
            ["events", `교육·행사 (${events.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            id={`sp-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="sp-panel"
            onClick={() => setTab(id)}
            className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium ${
              tab === id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="sp-panel" role="tabpanel" aria-labelledby={`sp-tab-${tab}`} className="mt-4 space-y-4">
        {tab === "support" ? (
          <>
            <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4 md:p-5">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">지역 (전국 공고 포함)</span>
                <select
                  className={selectClass}
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setShown(PAGE);
                  }}
                >
                  <option value="">전체 지역</option>
                  {REGION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">지원 분야</span>
                <select
                  className={selectClass}
                  value={field}
                  onChange={(e) => {
                    setField(e.target.value);
                    setShown(PAGE);
                  }}
                >
                  <option value="">전체 분야</option>
                  {fields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">정렬</span>
                <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as SupportSort)}>
                  <option value="deadline">마감 임박순</option>
                  <option value="latest">최근 등록순</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">검색어</span>
                <input
                  type="search"
                  className={selectClass}
                  value={q}
                  placeholder="예: 임차료, 청년, 카드수수료"
                  autoComplete="off"
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShown(PAGE);
                  }}
                />
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-gray-800 md:col-span-4">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-300 text-blue-600"
                  checked={sbizOnly}
                  onChange={(e) => {
                    setSbizOnly(e.target.checked);
                    setShown(PAGE);
                  }}
                />
                지원대상이 &lsquo;소상공인&rsquo;으로 표시된 공고만 보기
              </label>
              <p className="text-sm leading-relaxed text-gray-600 md:col-span-4 break-keep">
                끄면 지원대상이 중소기업·창업 등으로 표시됐지만 제목·태그·내용에 소상공인이 들어간 공고도 함께 보여요. 신청 자격은 공고마다
                달라서 반드시 원문에서 확인하세요.
              </p>
            </div>

            <p className="text-sm text-gray-700" aria-live="polite">
              <strong className="text-gray-900">{supportList.length}건</strong>
              {supportList.length !== support.length ? ` (전체 ${support.length}건 중)` : ""}
            </p>

            {supportList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm leading-relaxed text-gray-700 break-keep">
                조건에 맞는 공고가 없어요. 지역·분야를 &lsquo;전체&rsquo;로 바꾸거나 검색어를 지워 보세요.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    조건 모두 지우기
                  </button>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {supportList.slice(0, shown).map((it) => (
                  <SupportCard key={it.id} it={it} today={today} />
                ))}
              </ul>
            )}
            {supportList.length > shown ? (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="min-h-[48px] w-full rounded-lg border border-gray-300 bg-white text-base font-medium text-gray-800 hover:bg-gray-50"
              >
                더 보기 ({supportList.length - shown}건 남음)
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-3 md:p-5">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">지역 (전국 행사 포함)</span>
                <select
                  className={selectClass}
                  value={eRegion}
                  onChange={(e) => {
                    setERegion(e.target.value);
                    setEShown(PAGE);
                  }}
                >
                  <option value="">전체 지역</option>
                  {REGION_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">행사 유형</span>
                <select
                  className={selectClass}
                  value={eType}
                  onChange={(e) => {
                    setEType(e.target.value);
                    setEShown(PAGE);
                  }}
                >
                  <option value="">전체 유형</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">검색어</span>
                <input
                  type="search"
                  className={selectClass}
                  value={eQ}
                  placeholder="예: 마케팅, 세무, 창업"
                  autoComplete="off"
                  onChange={(e) => {
                    setEQ(e.target.value);
                    setEShown(PAGE);
                  }}
                />
              </label>
              <p className="text-sm leading-relaxed text-gray-600 md:col-span-3 break-keep">
                기업마당에 올라온 중소기업·창업자 대상 교육·설명회·전시회예요. 소상공인만을 위한 행사가 아닐 수 있어 대상은 원문에서
                확인하세요.
              </p>
            </div>

            <p className="text-sm text-gray-700" aria-live="polite">
              <strong className="text-gray-900">{eventList.length}건</strong>
              {eventList.length !== events.length ? ` (전체 ${events.length}건 중)` : ""}
            </p>

            {eventList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm leading-relaxed text-gray-700 break-keep">
                조건에 맞는 행사가 없어요. 지역·유형을 &lsquo;전체&rsquo;로 바꿔 보세요.
              </div>
            ) : (
              <ul className="space-y-3">
                {eventList.slice(0, eShown).map((it) => (
                  <EventCard key={it.id} it={it} today={today} />
                ))}
              </ul>
            )}
            {eventList.length > eShown ? (
              <button
                type="button"
                onClick={() => setEShown((n) => n + PAGE)}
                className="min-h-[48px] w-full rounded-lg border border-gray-300 bg-white text-base font-medium text-gray-800 hover:bg-gray-50"
              >
                더 보기 ({eventList.length - eShown}건 남음)
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
