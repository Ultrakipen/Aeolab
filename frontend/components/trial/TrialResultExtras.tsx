"use client";

/**
 * 무료 체험 결과 화면 재구성용 카드 모음 (2026-09-28 목업 반영).
 *
 * 원칙 (CLAUDE.md 작업 지침 7):
 *  - 더미·예시 수치 금지: 실측값이 있는 것만 숫자로, 없으면 아예 표시하지 않거나 "가입 후 실측"으로 표기
 *  - 점수 숫자 비노출: 건수·회수·순서 같은 실측값만 노출
 *  - 추정은 "(추정)" 라벨, 사용자 응답은 측정값이 아님을 구분
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock, Copy, ExternalLink, ChevronDown, ChevronUp, Check } from "lucide-react";

// ── 첫 화면 한 줄 진단 (2026-09-28) ─────────────────────────────────────
// 5초 안에 "그래서 내 가게는 지금 어떤가"를 답한다 — 전부 실측·입력에서 계산한 문장만 (더미 없음)
export interface VerdictBullet {
  label: string;
  text: string;
  tone: "warn" | "ok" | "neutral";
}

export function TrialVerdictCard({
  headline,
  bullets,
}: {
  headline: string;
  bullets: VerdictBullet[];
}) {
  const toneCls: Record<VerdictBullet["tone"], string> = {
    warn: "bg-amber-50 border-amber-200",
    ok: "bg-green-50 border-green-200",
    neutral: "bg-slate-50 border-slate-200",
  };
  const dotCls: Record<VerdictBullet["tone"], string> = {
    warn: "bg-amber-500",
    ok: "bg-green-600",
    neutral: "bg-slate-400",
  };
  return (
    <div className="rounded-xl border-2 border-slate-800 bg-white px-4 py-4 md:px-6 md:py-5 mb-4 shadow-sm">
      <p className="text-sm font-bold text-slate-600 mb-1">한 줄 진단</p>
      <p className="text-xl md:text-2xl font-extrabold text-slate-900 leading-snug break-keep mb-3">{headline}</p>
      <ul className="space-y-2">
        {bullets.map((b) => (
          <li key={b.label} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${toneCls[b.tone]}`}>
            <span className={`mt-1.5 w-2.5 h-2.5 shrink-0 rounded-full ${dotCls[b.tone]}`} aria-hidden="true" />
            <p className="text-sm md:text-base text-slate-800 leading-snug break-keep">
              <span className="font-bold">{b.label}</span> {b.text}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-slate-600 leading-snug">
        측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다.
      </p>
    </div>
  );
}

// ── 접이식 구역 (하단 공통 블록 길이 축소용) ─────────────────────────────
export function CollapsibleSection({
  title,
  summary,
  children,
  onToggle,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  onToggle?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4 shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          onToggle?.(!open);
        }}
        className="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 text-left"
      >
        <span className="min-w-0">
          <span className="block text-base font-extrabold text-slate-900">{title}</span>
          {summary && <span className="block text-sm text-slate-700 leading-snug break-keep">{summary}</span>}
        </span>
        <span className="inline-flex items-center gap-1 shrink-0 text-sm font-bold text-slate-700">
          {open ? "접기" : "펼치기"}
          {open ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </span>
      </button>
      {open && <div className="px-2 md:px-4 pt-3">{children}</div>}
    </div>
  );
}

// ── 탭 ─────────────────────────────────────────────────────────────────
export type TrialTabKey = "glance" | "compete" | "naver" | "ai" | "plan";

const TABS: { key: TrialTabKey; label: string }[] = [
  { key: "glance", label: "한눈에" },
  { key: "compete", label: "경쟁 비교" },
  { key: "naver", label: "네이버 현황" },
  { key: "ai", label: "AI 검색" },
  { key: "plan", label: "할 일 · 로드맵" },
];

export function ResultTabs({
  active,
  onChange,
}: {
  active: TrialTabKey;
  onChange: (k: TrialTabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="체험 결과 구역"
      className="mb-4 flex gap-2 overflow-x-auto md:overflow-visible pb-1"
    >
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`trial-tab-${t.key}`}
            aria-selected={on}
            aria-controls={`trial-panel-${t.key}`}
            onClick={() => onChange(t.key)}
            className={`shrink-0 md:flex-1 min-h-[44px] rounded-xl border px-4 text-sm md:text-base font-bold whitespace-nowrap transition-colors ${
              on
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 먼저 고칠 것 3가지 ─────────────────────────────────────────────────
export interface PriorityItem {
  title: string;
  level: "높음" | "보통";
  time: string;
}

export function PriorityFixCard({
  items,
  onMore,
}: {
  items: PriorityItem[];
  onMore: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
        <p className="text-base md:text-lg font-extrabold text-blue-900">먼저 고칠 것 {items.length}가지</p>
        <p className="text-sm text-blue-800">우선순위는 AEOlab 판단 기준(추정)입니다</p>
      </div>
      <ol className="space-y-2 mb-3">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-lg bg-white border border-blue-100 px-3 py-3"
          >
            <span className="shrink-0 w-7 h-7 rounded-full bg-blue-700 text-white text-sm font-extrabold flex items-center justify-center">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm md:text-base font-bold text-slate-900 leading-snug break-keep">{it.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-bold rounded-full px-2.5 py-0.5 border ${
                    it.level === "높음"
                      ? "bg-red-50 text-red-900 border-red-200"
                      : "bg-amber-50 text-amber-900 border-amber-200"
                  }`}
                >
                  우선순위 {it.level}
                </span>
                <span className="text-sm text-slate-700">{it.time}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onMore}
        className="w-full min-h-[44px] rounded-lg border border-blue-700 bg-white text-blue-700 text-sm md:text-base font-bold hover:bg-blue-50 transition-colors"
      >
        전체 할 일과 복사 문구 보기
      </button>
    </div>
  );
}

// ── 직접 확인해 보세요 ─────────────────────────────────────────────────
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function DirectCheckCard({
  chatgptQuery,
  naverQuery,
  googleQuery,
  onAction,
}: {
  chatgptQuery: string;
  naverQuery: string;
  googleQuery: string;
  /** 계측용 — channel: chatgpt|naver|google, action: copy|open */
  onAction?: (channel: string, action: "copy" | "open") => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const rows = [
    {
      key: "chatgpt",
      ch: "ChatGPT",
      how: "ChatGPT에 아래 질문을 그대로 넣고, 답변에 내 가게가 나오는지 봅니다.",
      q: chatgptQuery,
      btn: "ChatGPT 열기",
      href: "https://chatgpt.com/",
    },
    {
      key: "naver",
      ch: "네이버 검색 · 지도",
      how: "검색 결과와 지도 목록에서 내 가게가 보이는지 봅니다.",
      q: naverQuery,
      btn: "네이버에서 열기",
      href: `https://search.naver.com/search.naver?query=${encodeURIComponent(naverQuery)}`,
    },
    {
      key: "google",
      ch: "구글 검색",
      how: "상위 글에 내 가게가 언급되는지 봅니다.",
      q: googleQuery,
      btn: "구글에서 열기",
      href: `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`,
    },
  ].filter((r) => r.q);

  if (rows.length === 0) return null;

  const onCopy = async (key: string, q: string) => {
    onAction?.(key, "copy");
    const ok = await copyText(q);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <p className="text-base md:text-lg font-extrabold text-slate-900 mb-1">직접 확인해 보세요</p>
      <p className="text-sm text-slate-700 leading-relaxed mb-3 break-keep">
        결과가 믿기 어렵다면 아래 질문을 직접 넣어 보세요. 측정 시점과 기기에 따라 답이 달라질 수 있습니다.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 flex flex-col gap-2">
            <p className="text-sm md:text-base font-extrabold text-blue-800">{r.ch}</p>
            <p className="text-sm text-slate-700 leading-snug break-keep">{r.how}</p>
            <p className="rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm md:text-base font-bold text-slate-900 leading-snug break-keep">
              {r.q}
            </p>
            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={() => onCopy(r.key, r.q)}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-100 transition-colors"
              >
                {copiedKey === r.key ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" /> 복사됨
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" /> 질문 복사
                  </>
                )}
              </button>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onAction?.(r.key, "open")}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800 transition-colors"
              >
                {r.btn} <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 이 결과, 다음 주엔 어떻게 바뀔까요 ─────────────────────────────────
export function NextWeekBand({
  nextScanDate,
  onSave,
}: {
  nextScanDate: string;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-blue-700 bg-white px-4 md:px-6 py-5 mb-4 md:grid md:grid-cols-[minmax(0,1fr)_280px] md:gap-6 md:items-center">
      <div>
        <p className="text-lg md:text-xl font-extrabold text-slate-900 mb-2 break-keep">
          이 결과, 다음 주엔 어떻게 바뀔까요
        </p>
        <p className="text-sm md:text-base text-slate-700 leading-relaxed mb-3 break-keep">
          고친 뒤 실제로 나아졌는지는 다시 측정해야 알 수 있습니다. 가입하면 결제 없이 4채널 분석 1회를 받고,
          구독하면 매주 자동으로 다시 측정해 변화를 알려 드립니다.
        </p>
        <div className="flex items-center max-w-md mb-4 md:mb-0" aria-label={`오늘 측정, 다음 측정 ${nextScanDate}`}>
          <div className="flex flex-col items-center gap-1 w-20 shrink-0">
            <span className="w-4 h-4 rounded-full bg-blue-700" />
            <span className="text-sm font-bold text-slate-900">오늘</span>
          </div>
          <div className="flex-1 border-t-2 border-dashed border-slate-400 mb-6" />
          <div className="flex flex-col items-center gap-1 w-28 shrink-0">
            <span className="w-4 h-4 rounded-full border-2 border-dashed border-slate-500" />
            <span className="text-sm text-slate-700">다음 {nextScanDate}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {/* 가입 페이지로 실제 이동해야 한다(기존 CTA와 동일하게 Link) — onSave만 호출하던 버튼은 이동하지 않는 결함이었음 */}
        <Link
          href="/signup"
          onClick={onSave}
          className="min-h-[52px] inline-flex items-center justify-center rounded-xl bg-blue-700 text-white text-base font-extrabold hover:bg-blue-800 transition-colors"
        >
          무료 가입하고 다음 결과 받기
        </Link>
        <p className="text-sm text-slate-700 text-center">카드 등록 없이 시작할 수 있어요</p>
      </div>
    </div>
  );
}

// ── Gemini 예시 카드 (실측 아님) ───────────────────────────────────────
export function GeminiExampleCard({ query }: { query: string }) {
  const gbp = [
    "구글 비즈니스 프로필 등록 여부 확인",
    "주소 · 영업시간 · 전화번호 최신화",
    "대표 사진 등록",
    "리뷰에 답글 남기기",
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-base md:text-lg font-extrabold text-slate-900">Gemini에서는 이렇게 나타납니다</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-800">
            예시 화면 · 실제 결과 아님
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-800">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" /> 가입 후 1회 실측
          </span>
        </div>
      </div>
      <p className="text-sm md:text-base text-slate-700 leading-relaxed mb-3 break-keep">
        체험에서는 Gemini를 측정하지 않습니다. 가입 후 1회 체험에서 같은 질문을 Gemini에게 던져, 답변에 내 가게가
        나오는지와 어떤 가게가 추천되는지 확인합니다. 결과는 아래와 같은 모양으로 나타납니다.
      </p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-xl border border-dashed border-slate-400 bg-slate-50 p-4 flex flex-col gap-3">
          <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-blue-100 text-blue-900 px-3 py-2 text-sm md:text-base font-bold break-keep">
            “{query}”
          </div>
          <div className="self-start w-[92%] rounded-2xl rounded-bl-sm bg-white border border-slate-200 p-3 flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-700">Gemini 답변 [예시 자리]</span>
            <div className="h-2.5 w-11/12 rounded bg-slate-200" />
            <div className="h-2.5 w-2/3 rounded bg-slate-200" />
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <span className="w-6 h-6 shrink-0 rounded-full bg-slate-200 text-slate-800 text-sm font-extrabold flex items-center justify-center">
                  {n}
                </span>
                <span className="text-sm md:text-base font-bold text-slate-700">[추천 가게 {n}]</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-dashed border-slate-900 bg-white px-3 py-2.5">
            <p className="text-sm md:text-base font-extrabold text-slate-900">[내 가게 언급 여부 · 순서]</p>
            <p className="text-sm text-slate-700 leading-snug break-keep">
              이 칸에 내 가게가 목록에 나오는지, 나온다면 몇 번째인지 표시됩니다.
            </p>
          </div>
          <p className="text-sm text-slate-700 leading-snug break-keep">
            이 화면은 모양을 보여 주는 예시입니다. 내 가게의 노출 여부나 수치를 나타내지 않습니다.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm md:text-base font-extrabold text-slate-900">지금 할 수 있는 일 · 구글 비즈니스 프로필</p>
          {gbp.map((g) => (
            <div key={g} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <span className="w-5 h-5 shrink-0 rounded border-2 border-slate-400 bg-white" aria-hidden="true" />
              <span className="text-sm md:text-base font-bold text-slate-800 leading-snug break-keep">{g}</span>
            </div>
          ))}
          <p className="rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-900 leading-snug break-keep">
            <b>반영 시간</b> 등록 후 2~4주 안에 반영이 시작되고, 안정적으로 인용되기까지는 수개월이 걸릴 수 있습니다.
          </p>
          <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 leading-snug break-keep">
            <b>알아 두세요</b> 가입 후 실측은 검색 연동 없이 AI 모델의 지식을 기준으로 합니다. 실제 Gemini 앱의 답변과
            다를 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── 확인 완료 접기 ─────────────────────────────────────────────────────
export interface PassedItem {
  title: string;
  desc: string;
}

export function PassedItemsAccordion({ items }: { items: PassedItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[52px] flex items-center justify-between px-4 py-3 bg-slate-50 text-left"
      >
        <span className="text-base font-extrabold text-slate-900">확인 완료 · {items.length}</span>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-slate-700">
          {open ? "접기" : "펼치기"}
          {open ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          <p className="text-sm text-slate-700 py-2">문제가 없는 항목을 접어 두었습니다.</p>
          <ul className="divide-y divide-slate-100">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <span className="w-3 h-3 mt-1.5 shrink-0 rounded-full bg-green-600" aria-hidden="true" />
                <div>
                  <p className="text-sm md:text-base font-bold text-slate-900">{it.title}</p>
                  <p className="text-sm text-slate-700 leading-snug">{it.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── AI 답변 속 추천 가게 (ChatGPT 비유도형 프로브 결과) ────────────────
export interface AiPlace {
  name: string;
  count: number;
  // exact = 같은 이름의 가게가 네이버에 있음 / similar = 같은 브랜드의 다른 지점 / none = 확인되지 않음 / null = 검증 불가
  on_naver?: "exact" | "similar" | "none" | null;
}

export function AIRecommendedPlacesCard({
  businessName,
  sampleSize,
  exposureFreq,
  avgRank,
  places,
}: {
  businessName: string;
  sampleSize: number;
  exposureFreq: number;
  avgRank: number | null;
  places: AiPlace[];
}) {
  if (!places || places.length === 0) return null;
  const mentioned = exposureFreq > 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <p className="text-base md:text-lg font-extrabold text-slate-900">AI 답변 속 추천 가게</p>
        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-sm font-bold text-green-900">
          ChatGPT {sampleSize}회 실측
        </span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed mb-3 break-keep">
        내 가게 이름을 알려 주지 않고 “추천해 주세요”라고 물었을 때 ChatGPT가 자주 꺼낸 가게입니다.
      </p>
      <ol className="space-y-2 mb-3">
        {places.map((p, i) => (
          <li key={p.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 shrink-0 rounded-full bg-slate-200 text-slate-800 text-sm font-extrabold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-sm md:text-base font-bold text-slate-900 break-keep">{p.name}</span>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-sm font-bold text-slate-800">{sampleSize}회 중 {p.count}회</span>
              {p.on_naver === "exact" && <span className="text-sm text-green-800">네이버에서 확인됨</span>}
              {p.on_naver === "similar" && (
                <span className="text-sm text-slate-700">비슷한 이름의 가게가 네이버에 있음</span>
              )}
              {p.on_naver === "none" && (
                <span className="text-sm text-amber-800">네이버 지역검색에서 확인되지 않음</span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="rounded-lg border border-dashed border-slate-900 bg-white px-3 py-2.5 mb-3">
        <p className="text-sm md:text-base font-extrabold text-slate-900">내 가게 순서</p>
        <p className="text-sm md:text-base text-slate-800 leading-snug break-keep">
          {mentioned
            ? `“${businessName}”은 ${sampleSize}회 중 ${exposureFreq}회 추천 목록에 나왔고, 나왔을 때 평균 ${avgRank ?? "-"}번째였습니다.`
            : `“${businessName}”은 이번 ${sampleSize}회 답변의 추천 목록에 나오지 않았습니다.`}
        </p>
      </div>
      <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 leading-snug break-keep">
        AI 답변이며 사실과 다를 수 있습니다. 가게명이 실제로 존재하는지 네이버 지역검색과 대조한 결과를 함께 표시합니다.
      </p>
    </div>
  );
}

// ── 내 가게 vs 경쟁 가게 블로그 언급 건수 막대 ─────────────────────────
export interface CompBlog {
  rank?: number;
  name: string;
  count: number;
}

export function CompetitorBlogBars({
  myName,
  myCount,
  competitors,
}: {
  myName: string;
  myCount: number;
  competitors: CompBlog[];
}) {
  if (!competitors || competitors.length === 0) return null;
  const rows = [
    { name: `내 가게 (${myName})`, count: myCount, mine: true },
    ...competitors.map((c) => ({ name: c.name, count: c.count, mine: false })),
  ];
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-base md:text-lg font-extrabold text-slate-900">
          내 가게 vs 경쟁 {competitors.length}곳 · 이름이 나온 블로그 글 수
        </p>
        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-sm font-bold text-green-900">
          실측
        </span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.name} className="md:grid md:grid-cols-[220px_minmax(0,1fr)_90px] md:items-center md:gap-3">
            <p className={`text-sm md:text-base font-bold break-keep mb-1 md:mb-0 ${r.mine ? "text-blue-800" : "text-slate-800"}`}>
              {r.name}
            </p>
            <div className="h-6 rounded-md bg-slate-100 overflow-hidden mb-1 md:mb-0" aria-hidden="true">
              <div
                className={`h-6 rounded-md ${r.mine ? "bg-blue-700" : "bg-slate-500"}`}
                style={{ width: `${Math.max(2, Math.round((r.count / max) * 100))}%` }}
              />
            </div>
            <p className="text-sm md:text-base font-bold text-slate-900 md:text-right">{r.count.toLocaleString()}건</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-700 leading-snug break-keep">
        네이버 블로그 검색 상위 100건 중 제목·요약에 가게 이름이 실제로 나온 글 수입니다(본문에만 나오는 글은 빠져 실제보다 적게 잡힐 수 있고, 모든 가게에 같은 방식을 적용했습니다). 가게 이름이 흔한 단어로 이뤄지면 이 수치가 작게 나옵니다. 이종 업종 가게는 제외했습니다.
      </p>
    </div>
  );
}

// ── 채널별 반영 기간 ───────────────────────────────────────────────────
export function ChannelPeriodsCard() {
  const rows = [
    { ch: "네이버 AI 브리핑 · 검색", w: "w-1/5", term: "약 2~4주 (네이버 미공개 · 추정)" },
    { ch: "Gemini", w: "w-[55%]", term: "등록 후 2~4주 안에 반영 시작, 안정적으로 인용되기까지 수개월" },
    { ch: "ChatGPT", w: "w-full", term: "수개월~1년 (학습 데이터 기반)" },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <p className="text-base md:text-lg font-extrabold text-slate-900 mb-3">채널별로 반영되는 데 걸리는 시간</p>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.ch} className="md:grid md:grid-cols-[200px_minmax(0,1fr)_320px] md:items-center md:gap-4">
            <p className="text-sm md:text-base font-bold text-slate-900 mb-1 md:mb-0">{r.ch}</p>
            <div className="h-3 rounded-full bg-slate-200 mb-1 md:mb-0">
              <div className={`h-3 rounded-full bg-blue-700 ${r.w}`} />
            </div>
            <p className="text-sm text-slate-700 leading-snug break-keep">{r.term}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-700 leading-snug break-keep">
        막대 길이는 상대적인 비교이며 정확한 기간이 아닙니다. ChatGPT와 Gemini는 원리가 달라 함께 묶지 않았습니다.
      </p>
    </div>
  );
}

// ── 4주 로드맵 ─────────────────────────────────────────────────────────
export function RoadmapCard() {
  const rows = [
    { wk: "1주차", t: "스마트플레이스 등록 · 소개글 작성" },
    { wk: "2주차", t: "소식 등록 · 리뷰 답변에 가게 특징 언급" },
    { wk: "3주차", t: "방문 손님께 블로그 후기 요청" },
    { wk: "4주차", t: "다시 측정해 변화 확인" },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <p className="text-base md:text-lg font-extrabold text-slate-900 mb-3">4주 로드맵</p>
      <ol className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.wk} className="flex items-start gap-3">
            <span className="shrink-0 w-16 text-center rounded-lg bg-blue-700 text-white text-sm font-extrabold py-1">
              {r.wk}
            </span>
            <span className="text-sm md:text-base text-slate-800 leading-snug break-keep">{r.t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── 결과 요약 이메일 받기 (2026-09-28) ─────────────────────────────────────
// 입력 화면에서 이메일을 안 적은 사용자가 결과를 보고 나서 "나중에 다시 보고 싶다"고 느낄 때의 유일한 보관 경로.
// 개인정보 동의 필수. 서버가 저장에 성공했을 때만 완료로 표시한다(실패를 성공으로 보이지 않음).
export function TrialEmailCard({
  trialId,
  onTrack,
}: {
  trialId: string;
  onTrack?: (event: string, params?: Record<string, unknown>) => void;
}) {
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      setState("error");
      setMsg("이메일 형식을 확인해 주세요.");
      return;
    }
    if (!agree) {
      setState("error");
      setMsg("개인정보 수집·이용에 동의해 주세요.");
      return;
    }
    setState("loading");
    setMsg("");
    try {
      const res = await fetch(`/api/scan/trial/${trialId}/save-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json().catch(() => ({}))) as { sent?: boolean };
      setSent(!!data.sent);
      setState("done");
      onTrack?.("trial_email_save", { sent: !!data.sent });
    } catch {
      setState("error");
      setMsg("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 px-4 md:px-6 py-4 mb-4" role="status">
        <p className="text-base font-bold text-green-900">
          {sent ? "결과 요약을 이메일로 보냈습니다" : "이메일을 저장했습니다"}
        </p>
        <p className="text-sm text-green-900 mt-1 break-keep">
          {sent
            ? "메일이 보이지 않으면 스팸함을 확인해 주세요."
            : "결과 요약 메일 발송은 실패했을 수 있습니다. 이 화면의 결과는 24시간 동안 이 기기에 저장됩니다."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-300 bg-white px-4 md:px-6 py-4 mb-4" noValidate>
      <label htmlFor="trial-email-after" className="block text-base font-bold text-slate-900">
        이 결과를 이메일로 받아 두기 <span className="text-sm font-normal text-slate-600">(선택)</span>
      </label>
      <p className="text-sm text-slate-700 mt-1 mb-3 break-keep">
        오늘 할 수 있는 1가지를 정리해 한 번 보내 드립니다. 광고성 반복 발송은 하지 않습니다.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="trial-email-after"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="example@email.com"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className="flex-1 min-w-0 border border-slate-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="min-h-[48px] px-5 rounded-xl bg-slate-900 text-white text-base font-bold hover:bg-slate-800 disabled:opacity-60 transition-colors"
        >
          {state === "loading" ? "보내는 중..." : "메일 받기"}
        </button>
      </div>
      <label className="flex items-start gap-2 cursor-pointer mt-3">
        <input
          type="checkbox"
          checked={agree}
          onChange={(ev) => setAgree(ev.target.checked)}
          className="w-4 h-4 accent-blue-600 shrink-0 mt-0.5"
        />
        <span className="text-sm text-slate-700">
          <span className="text-blue-700 font-semibold">[필수]</span> 이메일 주소를 결과 발송 목적으로 수집하는 데 동의합니다.{" "}
          <Link href="/privacy" target="_blank" className="underline">
            개인정보처리방침
          </Link>
        </span>
      </label>
      {state === "error" && msg && (
        <p className="text-sm font-semibold text-red-700 mt-2" role="alert">
          {msg}
        </p>
      )}
    </form>
  );
}
