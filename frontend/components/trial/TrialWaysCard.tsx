"use client";

import { useState } from "react";
import { CHANNEL_ROWS } from "@/components/common/ChannelTimelineBox";
import type { CompBlog } from "@/components/trial/TrialResultExtras";
import type { TrialChatgptGroup, TrialGooglePlaces } from "@/types";
import { maybeSameShop } from "@/lib/trialAutofill";

/**
 * 무료 체험 결과 — "손님이 가게를 찾는 5개 길" + 주변 비교 한 줄 결론 + 소개글·소식 확인 질문.
 * 전부 실측·사용자 입력에서만 문장을 만든다(더미 없음). 측정하지 않은 길은 "가입하면 확인"으로만 표시.
 * 걸리는 시간은 ChannelTimelineBox의 기존 안내(CHANNEL_ROWS)를 그대로 쓴다 — 새 주장 추가 금지.
 */

const durationOf = (channel: string): string =>
  CHANNEL_ROWS.find((r) => r.channel === channel)?.duration ?? "";

type Tone = "ok" | "warn" | "calm" | "muted";

interface Way {
  key: string;
  name: string;
  hint: string;
  state: "measured" | "later" | "na";
  now: string;
  nowTone: Tone;
  affects: string;
  duration: string;
}

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-green-800",
  warn: "text-amber-800",
  calm: "text-slate-900",
  muted: "text-slate-600",
};

function StateTag({ state }: { state: Way["state"] }) {
  if (state === "measured") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-sm font-bold text-green-800">
        <span className="h-2 w-2 rounded-full bg-green-600" aria-hidden="true" />직접 재 봄
      </span>
    );
  }
  if (state === "na") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-600">
        해당 없음
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-slate-400 px-2.5 py-0.5 text-sm font-bold text-slate-600">
      <span className="h-2 w-2 rounded-sm border border-slate-500" aria-hidden="true" />가입하면 확인
    </span>
  );
}

export function ChannelWaysCard({
  isNonLocation,
  naverMeasured,
  myRank,
  competitorCount,
  searchQuery,
  briefingCategory,
  isFranchise,
  chatgptMeasured,
  chatgptFreq,
  chatgptSample,
  chatgptQuery,
  neighborhood,
  googleMapShown,
}: {
  isNonLocation: boolean;
  naverMeasured: boolean;
  myRank: number | null;
  competitorCount: number;
  searchQuery?: string;
  briefingCategory: "active" | "likely" | "inactive";
  isFranchise: boolean;
  chatgptMeasured: boolean;
  chatgptFreq?: number;
  chatgptSample: number;
  chatgptQuery?: string;
  /** 동네·역 이름으로 물은 결과 — 있으면 구 이름 결과와 함께 말한다 */
  neighborhood?: { name: string; freq: number } | null;
  /** 구글 지도 카드가 화면에 실제로 나오는지 — 나올 때만 "아래 카드"를 가리킨다 */
  googleMapShown?: boolean;
}) {
  // 곳 수를 알면 "상위 5곳", 모르면 "상위권" — 앞에 "상위"를 따로 붙이지 않는다
  const topWord = competitorCount > 0 ? `상위 ${competitorCount}곳` : "상위권";

  const naver: Way = isNonLocation
    ? {
        key: "naver",
        name: "네이버 지도·검색",
        hint: "지역에서 가게 찾기",
        state: "na",
        now: "온라인·전문직은 지역 가게 검색이 해당하지 않아요.",
        nowTone: "muted",
        affects: "",
        duration: "",
      }
    : naverMeasured
      ? {
          key: "naver",
          name: "네이버 지도·검색",
          hint: searchQuery ? `“${searchQuery}” 찾기` : "지역에서 가게 찾기",
          state: "measured",
          now: myRank
            ? `지역 검색 ${competitorCount > 0 ? `${topWord} 중 ` : ""}${myRank}위예요.`
            : `지역 검색 ${topWord} 안에 내 가게가 없어요.`,
          nowTone: myRank ? "ok" : "warn",
          affects: "소개글·리뷰·소식",
          duration: durationOf("네이버 일반검색"),
        }
      : {
          key: "naver",
          name: "네이버 지도·검색",
          hint: "지역에서 가게 찾기",
          state: "later",
          now: "이번에는 재지 못했어요.",
          nowTone: "muted",
          affects: "소개글·리뷰·소식",
          duration: durationOf("네이버 일반검색"),
        };

  const briefingNow = isFranchise
    ? "가맹점은 이 기능의 대상에서 빠져요."
    : briefingCategory === "active"
      ? "대상 업종이에요. 가입하면 실제로 나오는지 재 드려요."
      : briefingCategory === "likely"
        ? "아직 대상 업종이 아니에요. 네이버가 대상을 넓힐 예정이라고 해요."
        : "가게 소개형 대상 업종이 아니에요. 블로그 같은 글이 많으면 글 기반 AI 요약에는 나올 수 있어요.";

  const lowGu =
    chatgptMeasured && chatgptFreq !== undefined && chatgptSample > 0 && chatgptFreq / chatgptSample < 0.3;
  // 동네 이름 결과가 있으면 둘 다 0번일 때만 "낮아도 정상"이라고 말한다(동네 이름에서 나온 것은 좋은 발견이라 달래는 말을 붙이지 않는다)
  const lowChatgpt = lowGu && (!neighborhood || neighborhood.freq === 0);

  const ways: Way[] = [
    naver,
    {
      key: "briefing",
      name: "네이버 AI 브리핑",
      hint: "검색 맨 위의 AI 요약",
      state: "later",
      now: briefingNow,
      nowTone: "muted",
      affects: "가게 정보와 리뷰",
      duration: isFranchise || briefingCategory !== "active" ? "" : durationOf("네이버 AI 브리핑"),
    },
    {
      key: "aitab",
      name: "네이버 AI탭",
      hint: "대화하듯 물어보는 네이버 검색",
      state: "later",
      now: "업종 제한이 발표되지 않았어요. 내 가게가 나오는지는 아직 재 보지 않았어요.",
      nowTone: "muted",
      affects: "스마트플레이스 정보",
      duration: durationOf("네이버 AI탭"),
    },
    {
      key: "chatgpt",
      name: "ChatGPT",
      hint: neighborhood ? "구 이름·동네 이름으로 추천 물어보기" : chatgptQuery ? `“${chatgptQuery}” 물어보기` : "추천을 물어보기",
      state: chatgptMeasured ? "measured" : "later",
      now: !chatgptMeasured
        ? "이번에는 재지 못했어요."
        : chatgptFreq === undefined
          ? "추천 여부를 확인했어요."
          : neighborhood
            ? `구 이름으로 ${chatgptFreq}번, 동네 이름(${neighborhood.name})으로 ${neighborhood.freq}번 추천됐어요 (각 ${chatgptSample}번 중).${lowChatgpt ? " 이 길은 지금 낮아도 정상이에요." : ""}`
            : `${chatgptSample}번 중 ${chatgptFreq}번 추천됐어요.${lowChatgpt ? " 이 길은 지금 낮아도 정상이에요." : ""}`,
      nowTone: !chatgptMeasured ? "muted" : lowChatgpt ? "calm" : "ok",
      affects: "AI가 미리 공부한 자료 (단기에는 거의 안 바뀌어요)",
      duration: durationOf("ChatGPT"),
    },
    {
      key: "google",
      name: "제미나이·구글",
      hint: "구글의 AI와 구글 검색",
      state: "later",
      now: googleMapShown
        ? "구글의 AI 답변과 구글 검색에 내 가게가 나오는지는 아직 재 보지 않았어요. 구글 지도는 아래 \u2018구글 지도에서의 모습\u2019에서 직접 재 봤어요."
        : "내 가게가 나오는지는 아직 재 보지 않았어요.",
      nowTone: "muted",
      affects: "구글 지도에 가게 등록(구글 비즈니스 프로필)",
      duration: durationOf("Gemini"),
    },
  ];

  // 모바일에서는 "영향 주는 것·걸리는 시간" 줄을 한 번에 접어 두고 눌러서 본다(PC는 항상 보임)
  const [showMeta, setShowMeta] = useState(false);
  const considered = ways.filter((w) => w.state !== "na");
  const measuredCount = considered.filter((w) => w.state === "measured").length;

  return (
    <section
      aria-labelledby="trial-ways-h"
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm"
    >
      <p className="text-sm font-bold text-slate-500">지금 내 가게 상태</p>
      <h2 id="trial-ways-h" className="mt-0.5 text-lg md:text-xl font-extrabold text-slate-900 break-keep">
        손님이 가게를 찾는 {considered.length}개 길, 내 가게는?
      </h2>
      <p className="mt-1 text-sm md:text-base text-slate-700 leading-snug break-keep">
        이번 무료 체험에서는 {considered.length}개 길 중 <strong>{measuredCount}개</strong>를 직접 재 봤어요. 나머지는 가입하면 재 드려요.
      </p>
      <div
        className="mt-3 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${considered.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${considered.length}개 길 중 ${measuredCount}개 측정`}
      >
        {considered.map((w) => (
          <span
            key={w.key}
            className={`h-2 rounded ${w.state === "measured" ? "bg-green-600" : "border border-dashed border-slate-400"}`}
          />
        ))}
      </div>

      <ul className={`mt-4 md:grid md:gap-3 ${considered.length === 4 ? "md:grid-cols-4" : "md:grid-cols-5"}`}>
        {considered.map((w) => (
          <li
            key={w.key}
            className="py-3 border-t border-slate-200 first:border-t-0 first:pt-0 md:border md:border-slate-200 md:rounded-xl md:p-3 md:first:pt-3 md:flex md:flex-col"
          >
            <div className="flex items-start justify-between gap-2 md:flex-col md:items-start md:gap-1.5">
              <div className="min-w-0">
                <p className="text-base font-extrabold text-slate-900 break-keep">{w.name}</p>
                <p className="text-sm text-slate-600 break-keep">{w.hint}</p>
              </div>
              <StateTag state={w.state} />
            </div>
            <p className={`mt-2 text-sm md:text-base leading-snug break-keep ${TONE_TEXT[w.nowTone]} ${w.state === "measured" ? "font-bold" : ""}`}>
              {w.now}
            </p>
            {(w.affects || w.duration) && (
              <p className={`${showMeta ? "block" : "hidden"} md:block mt-1.5 text-sm text-slate-600 leading-snug break-keep md:mt-auto md:pt-2`}>
                {w.affects && <span className="block">영향 주는 것: {w.affects}</span>}
                {w.duration && <span className="block">바뀌는 데 {w.duration} (참고값)</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setShowMeta((v) => !v)}
        aria-expanded={showMeta}
        className="md:hidden mt-3 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-blue-700"
      >
        {showMeta ? "영향 주는 것·걸리는 시간 접기" : "길마다 영향 주는 것·걸리는 시간 보기"}
      </button>
      <p className="mt-3 text-sm text-slate-600 leading-snug break-keep">
        걸리는 시간은 꾸준히 관리했을 때의 참고값이에요. 네이버는 기간을 공개하지 않고, 어느 길도 기간을 약속할 수는 없어요.
      </p>
    </section>
  );
}

/** 주변 가게와 비교한 한 줄 결론 — 블로그 순위와 네이버 지역 검색 위치, 둘 다 실측일 때만 문장을 만든다 */
export function CompareVerdictCard({
  myRank,
  competitorCount,
  myBlog,
  myBlogCapped,
  competitors,
}: {
  myRank: number | null;
  competitorCount: number;
  myBlog: number;
  myBlogCapped: boolean;
  competitors: CompBlog[];
}) {
  const hasBlog = competitors.length > 0;
  const hasRank = competitorCount > 0;
  if (!hasBlog && !hasRank) return null;

  let blogPart = "";
  let blogGood = false;
  if (hasBlog) {
    const total = competitors.length + 1;
    // 잘린 값(capped)은 "이상"이므로 같은 값이면 앞선 것으로 본다(실제로는 더 많음)
    const ahead = competitors.filter((c) => c.count > myBlog || (c.capped && c.count >= myBlog)).length;
    const k = ahead + 1;
    const lower = myBlogCapped ? "이상 " : "";
    blogGood = k <= Math.ceil(total / 2);
    blogPart =
      k === 1
        ? `블로그 글은 주변 ${total}곳 중 가장 많아요.`
        : blogGood
          ? `블로그 글은 주변 ${total}곳 중 ${k}번째로 많아요.`
          : `블로그 글은 주변 ${total}곳 중 ${k}번째예요. ${lower}글이 적은 편이에요.`;
  }
  let rankPart = "";
  if (hasRank) {
    rankPart = myRank
      ? `네이버 지역 검색에서는 ${competitorCount}곳 중 ${myRank}위예요.`
      : `네이버 지역 검색 상위 ${competitorCount}곳 안에는 없어요.`;
  }
  const tip = hasBlog && hasRank && blogGood && !myRank ? " 부족한 쪽은 네이버 지역 검색에 나오는 것이에요." : "";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 mb-4">
      <p className="text-sm font-bold text-blue-900 mb-0.5">주변 가게와 비교하면</p>
      <p className="text-base md:text-lg font-bold text-slate-900 leading-snug break-keep">
        {[blogPart, rankPart].filter(Boolean).join(" ")}
        {tip}
      </p>
    </div>
  );
}

/** AEOlab이 직접 보지 못한 소개글·소식을 사장님이 눌러서 바로잡는다 — 눌러야만 "먼저 고칠 것"에서 빠진다 */
export function DiagnosisFixCard({
  intro,
  setIntro,
  post,
  setPost,
}: {
  intro: boolean | null;
  setIntro: (v: boolean) => void;
  post: boolean | null;
  setPost: (v: boolean) => void;
}) {
  const rows: Array<{ id: string; label: string; yes: string; no: string; value: boolean | null; set: (v: boolean) => void }> = [
    { id: "intro", label: "가게 소개글", yes: "이미 써 뒀어요", no: "아직 안 썼어요", value: intro, set: setIntro },
    { id: "post", label: "최근 7일 안에 올린 소식", yes: "올렸어요", no: "아직 없어요", value: post, set: setPost },
  ];
  return (
    <section
      aria-labelledby="trial-fix-h"
      className="rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-4 mb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trial-fix-h" className="text-base md:text-lg font-extrabold text-slate-900 break-keep">
          직접 확인하지 못한 항목이 있어요
        </h2>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-900">
          <span className="h-2 w-2 rounded-full border-2 border-dashed border-amber-800" aria-hidden="true" />짐작한 값
        </span>
      </div>
      <p className="mt-1 text-sm md:text-base text-slate-700 leading-snug break-keep">
        네이버 가게 소개글과 소식은 AEOlab이 직접 보지 못했어요. 이미 한 것을 눌러 주시면 아래 &lsquo;먼저 고칠 것&rsquo;에서 빼 드려요.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id}>
            <p className="text-sm font-bold text-slate-800 mb-1.5">{r.label}</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={r.label}>
              <button
                type="button"
                onClick={() => r.set(true)}
                aria-pressed={r.value === true}
                className={`min-h-[44px] rounded-xl border-2 px-2 py-2 text-sm font-bold ${
                  r.value === true ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {r.yes}
              </button>
              <button
                type="button"
                onClick={() => r.set(false)}
                aria-pressed={r.value === false}
                className={`min-h-[44px] rounded-xl border-2 px-2 py-2 text-sm font-bold ${
                  r.value === false ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {r.no}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * 모바일에서는 큰 비교 카드를 접어 두고(한 줄 결론은 위에 그대로 보임), PC에서는 항상 펼쳐 둔다.
 * 결과 화면이 길어져 이탈하는 것을 막기 위한 장치 — 내용은 그대로이고 숨기지 않는다(눌러서 바로 펼침).
 */
export function MobileCollapse({
  title,
  hint,
  onOpen,
  children,
}: {
  title: string;
  hint: string;
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((v) => !v);
        }}
        className="md:hidden w-full min-h-[56px] flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm"
      >
        <span className="min-w-0">
          <span className="block text-base font-extrabold text-slate-900 break-keep">{title}</span>
          <span className="block text-sm text-slate-600 break-keep">{hint}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-blue-700">{open ? "접기" : "펼치기"}</span>
      </button>
      <div className={`${open ? "block mt-3" : "hidden"} md:block`}>{children}</div>
    </div>
  );
}

/**
 * ChatGPT가 구 이름 질문과 동네·역 이름 질문에서 각각 어느 가게를 추천했는지 나란히 보여 준다.
 * 서버 실험(2026-10-10): 같은 가게도 질문의 지역 단위에 따라 결과가 크게 다르다
 * (준오헤어 왕십리역점: "서울 성동구" 0/50, "왕십리" 11/50 / 어니언 성수는 26 vs 19로 비슷).
 * 문장은 두 실측값만으로 만들고, 몇 번 안팎의 차이는 표본 흔들림이라 "비슷하다"고 말한다(차이 기준 = 표본의 16%p).
 */
function AreaGroupBox({ label, group, sample }: { label: string; group: TrialChatgptGroup; sample: number }) {
  const freq = group.exposure_freq ?? 0;
  const queries = group.queries_used ?? [];
  const places = (group.top_places ?? []).filter((p) => p.on_naver === "exact" || p.on_naver === "similar").slice(0, 5);
  return (
    <div className="rounded-xl border border-slate-200 p-3 md:p-4">
      <p className="text-sm md:text-base font-extrabold text-slate-900">{label}</p>
      {queries[0] && (
        <p className="mt-0.5 text-sm text-slate-600 break-keep">
          &ldquo;{queries[0]}&rdquo; 등 {queries.length > 1 ? `${queries.length}가지 말투` : "질문"}
        </p>
      )}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="h-4 rounded-lg bg-slate-100 overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-lg bg-blue-700" style={{ width: `${freq === 0 ? 0 : Math.max(3, Math.round((freq / sample) * 100))}%` }} />
        </div>
        <p className="text-sm md:text-base font-extrabold text-slate-900 tabular-nums">{freq}번 / {sample}번</p>
      </div>
      <p className="mt-3 text-sm font-bold text-slate-600">대신 추천된 가게</p>
      {places.length > 0 ? (
        <ol className="mt-1.5 space-y-1.5">
          {places.map((p) => (
            <li key={p.name} className="grid grid-cols-[minmax(0,1fr)_72px_44px] items-center gap-2 text-sm">
              <span className="min-w-0 break-keep">
                <span className="font-semibold text-slate-900">{p.name}</span>
                <span className="block text-sm text-slate-600">
                  {p.on_naver === "exact" ? "네이버에서 확인됨" : "비슷한 이름이 네이버에 있어요"}
                </span>
              </span>
              <span className="h-2.5 rounded bg-slate-100 overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded bg-slate-400" style={{ width: `${Math.round((p.count / sample) * 100)}%` }} />
              </span>
              <span className="text-right font-bold text-slate-800 tabular-nums">{p.count}번</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-sm text-slate-600 break-keep">네이버에서 확인된 가게가 없었어요.</p>
      )}
    </div>
  );
}

export function AreaCompareCard({
  businessName,
  gu,
  nb,
}: {
  businessName: string;
  gu: TrialChatgptGroup;
  nb: TrialChatgptGroup;
}) {
  const gS = gu.sample_size || 50;
  const nS = nb.sample_size || 50;
  const gF = gu.exposure_freq ?? 0;
  const nF = nb.exposure_freq ?? 0;
  const name = nb.neighborhood || "동네";
  const gR = gF / gS;
  const nR = nF / nS;
  const big = Math.abs(nR - gR) >= 0.16;

  let verdict: string;
  if (gF === 0 && nF === 0) {
    verdict = `구 이름으로도 동네 이름(${name})으로도 추천되지 않았어요. 이 길은 지금 낮아도 정상이에요.`;
  } else if (gF === 0) {
    verdict = `구 이름으로 물으면 0번이고, 동네 이름(${name})으로 물으면 ${nF}번 추천돼요. 손님이 동네 이름으로 찾을 때는 ChatGPT가 내 가게를 추천해요.`;
  } else if (nF === 0) {
    verdict = `동네 이름(${name})으로 물으면 0번이고, 구 이름으로 물으면 ${gF}번 추천돼요.`;
  } else if (big) {
    verdict = nR > gR
      ? `동네 이름(${name})으로 물을 때(${nF}번)가 구 이름으로 물을 때(${gF}번)보다 더 많이 추천돼요.`
      : `구 이름으로 물을 때(${gF}번)가 동네 이름(${name})으로 물을 때(${nF}번)보다 더 많이 추천돼요.`;
  } else {
    verdict = `구 이름으로 물어도(${gF}번) 동네 이름(${name})으로 물어도(${nF}번) 비슷하게 추천돼요. 몇 번 정도의 차이는 같은 질문을 다시 해도 생겨요.`;
  }

  // 같은 가게일 수 있는 이름(지점 표기만 다름) — 같은 가게로 세지는 않고 안내만 한다
  const allPlaces = [...(gu.top_places ?? []), ...(nb.top_places ?? [])];
  const sibling = allPlaces.find((p) => maybeSameShop(businessName, p.name));

  return (
    <section aria-labelledby="trial-area-h" className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trial-area-h" className="text-base md:text-lg font-extrabold text-slate-900 break-keep">
          ChatGPT는 어느 가게를 추천했을까요
        </h2>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-sm font-bold text-green-800">
          <span className="h-2 w-2 rounded-full bg-green-600" aria-hidden="true" />직접 재 본 값
        </span>
      </div>
      <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2.5 text-sm md:text-base font-medium text-slate-900 leading-snug break-keep">{verdict}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <AreaGroupBox label="구 이름으로 물었을 때" group={gu} sample={gS} />
        <AreaGroupBox label={`동네 이름(${name})으로 물었을 때`} group={nb} sample={nS} />
      </div>

      {sibling && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 leading-snug break-keep">
          &lsquo;{sibling.name}&rsquo;은 내 가게(&lsquo;{businessName}&rsquo;)와 같은 가게일 수 있어요. 같은 가게라면 실제 추천 횟수는 더 많아요.
        </p>
      )}
      {big && (
        <p className="mt-3 rounded-lg border border-blue-300 px-3 py-2.5 text-sm md:text-base text-slate-900 leading-snug break-keep">
          <b className="text-blue-800">이렇게 해 보세요</b> 소개글과 블로그 글 제목에 가게가 있는 동네·역 이름(예: {name})을 넣어 보세요. 실제로 그 동네에 있는 가게일 때만 쓰세요.
        </p>
      )}
      <p className="mt-3 text-sm text-slate-600 leading-snug break-keep">
        ChatGPT 결과는 AI가 미리 공부한 자료를 기준으로 해서, 실시간 검색 결과와 다를 수 있어요. 같은 질문을 다시 해도 몇 번 정도는 달라질 수 있어요. 막대 전체가 {gS}번이에요. 측정 시점·기기·로그인 상태에 따라서도 달라질 수 있어요.
      </p>
    </section>
  );
}

/** 구글 지도 검색에서 내 가게가 어떻게 보이는지 — 직접 재 본 값(Serper /places). 점수에는 반영하지 않는다. */
export function GoogleMapCard({ businessName, data }: { businessName: string; data: TrialGooglePlaces }) {
  const rate = (r: number | null, c: number | null) =>
    r != null && c != null ? `평점 ${r} · 리뷰 ${c.toLocaleString()}개` : "평점·리뷰 정보 없음";
  const mine = data.my_place;
  let verdict: string;
  if (data.is_on_google === true && data.my_rank) {
    verdict = `구글 지도에서 “${data.search_query}”를 검색하면 상위 10곳 중 ${data.my_rank}번째로 나와요.`;
  } else if (data.is_on_google === true) {
    verdict = `구글 지도에는 등록돼 있지만, “${data.search_query}” 검색 상위 10곳에는 보이지 않아요.`;
  } else if (data.is_on_google === false) {
    verdict = `구글 지도에서 “${businessName}”을(를) 찾지 못했어요. 구글 비즈니스 프로필에 가게를 등록하면 구글 지도에 나올 수 있어요.`;
  } else {
    verdict = "이번에는 구글 지도에서 내 가게를 확인하지 못했어요.";
  }
  return (
    <section aria-labelledby="trial-gmap-h" className="rounded-xl border border-slate-200 bg-white px-4 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trial-gmap-h" className="text-base md:text-lg font-extrabold text-slate-900 break-keep">
          구글 지도에서는 이렇게 보여요
        </h2>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-sm font-bold text-green-800">
          <span className="h-2 w-2 rounded-full bg-green-600" aria-hidden="true" />직접 재 본 값
        </span>
      </div>
      <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2.5 text-sm md:text-base font-medium text-slate-900 leading-snug break-keep">{verdict}</p>
      {mine && (
        <p className="mt-2 text-sm md:text-base text-slate-800 leading-snug break-keep">
          내 가게: <b>{mine.name}</b> · {rate(mine.rating, mine.rating_count)}
        </p>
      )}
      {data.top.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-slate-700 mb-1.5">구글 지도 검색 상위 가게</p>
          <ol className="space-y-1.5">
            {data.top.map((p) => (
              <li key={p.rank} className="flex items-start gap-2 text-sm md:text-base text-slate-800">
                <span className="w-5 shrink-0 font-bold text-slate-500">{p.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-2 break-words">{p.name}</span>
                  <span className="block text-sm text-slate-600">{rate(p.rating, p.rating_count)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="mt-3 text-sm text-slate-600 leading-snug break-keep">
        구글 지도 검색 결과는 검색하는 사람의 위치·시점·로그인 상태에 따라 달라질 수 있어요. 구글 지도의 평점·리뷰 수는 네이버와 별개예요.
      </p>
    </section>
  );
}
