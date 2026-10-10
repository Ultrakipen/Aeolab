"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, MapPin, Phone, Store, Info } from "lucide-react";
import { FLAT_CATEGORY_GROUPS } from "@/lib/categories";
import { parseNaverPlaceUrl } from "@/lib/naverPlaceUrl";
import type { TrialBusinessCandidate } from "@/types";
import type { ManualKind, TrialFormState } from "./TrialSharedTypes";

/**
 * Trial — "가게 이름만 입력" 빠른 경로
 *   1) find    : 가게 이름 검색 → 후보 선택
 *   2) confirm : 자동으로 채운 업종·지역·검색어 확인 → 진단 시작
 * 후보에 없거나 온라인·예비창업이면 기존 직접 입력 경로(category→tags→info)로 보낸다.
 * 모든 state는 부모(page.tsx)가 보유 — 이 컴포넌트는 렌더 + 이벤트 위임.
 */
export interface TrialFindStepProps {
  step: "find" | "confirm";
  // find
  query: string;
  setQuery: (v: string) => void;
  results: TrialBusinessCandidate[];
  loading: boolean;
  done: boolean;
  onSelect: (c: TrialBusinessCandidate) => void;
  onManual: (kind: ManualKind) => void;
  // confirm
  candidate: TrialBusinessCandidate | null;
  form: TrialFormState;
  setForm: React.Dispatch<React.SetStateAction<TrialFormState>>;
  selectedCategory: string;
  categoryConfirmed: boolean;
  onCategoryChange: (v: string) => void;
  primaryKeyword: string;
  onKeywordChange: (v: string) => void;
  /** 동네·역 이름(선택) — ChatGPT에 구 이름과 별도로 이 이름으로도 묻는다 */
  neighborhood: string;
  setNeighborhood: (v: string) => void;
  /** 주소에서 자동으로 찾은 제안값(없으면 빈 문자열) */
  neighborhoodAuto: string;
  hasFaq: boolean | undefined;
  setHasFaq: (v: boolean) => void;
  hasRecentPost: boolean | undefined;
  setHasRecentPost: (v: boolean) => void;
  hasIntro: boolean | undefined;
  setHasIntro: (v: boolean) => void;
  placeUrl: string;
  setPlaceUrl: (v: string) => void;
  cooldownMs: number;
  error: string;
  onBack: () => void;
  onStart: () => void;
}

function formatCooldown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default function TrialFindStep(props: TrialFindStepProps) {
  return props.step === "find" ? <FindView {...props} /> : <ConfirmView {...props} />;
}

// ── 1) 가게 찾기 ─────────────────────────────────────────────────────────
function FindView({ query, setQuery, results, loading, done, onSelect, onManual, cooldownMs }: TrialFindStepProps) {
  const q = query.trim();
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-12 md:pt-12">
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-keep">
          내 가게 이름을 알려주세요
        </h1>
        <p className="text-base text-gray-600 leading-relaxed break-keep">
          네이버에서 찾아 업종과 지역을 자동으로 채워 드려요.{" "}
          <br className="hidden sm:block" />
          네이버 검색과 ChatGPT에서 내 가게가 나오는지, 20~40초면 알려 드립니다.
        </p>
      </div>

      {cooldownMs > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            오늘 무료 체험 3회를 모두 이용했습니다. <strong>{formatCooldown(cooldownMs)}</strong> 후 다시 이용할 수 있습니다.
          </p>
          <Link href="/signup" className="inline-block text-sm font-bold text-blue-700 underline">
            회원가입하고 매주 자동 진단 받기 →
          </Link>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          id="trial-find-query"
          type="text"
          inputMode="search"
          autoComplete="off"
          autoFocus
          aria-label="가게 이름"
          placeholder="가게 이름 (예: 어니언 성수)"
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 50))}
          className="w-full rounded-2xl border-2 border-slate-300 bg-white pl-12 pr-12 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-500 break-keep">
        동네 이름을 함께 써도 됩니다 (예: 성수 어니언). 잘 안 나오면 가게 이름만 써 보세요.
      </p>

      {/* 후보 목록 */}
      {results.length > 0 && (
        <div className="mt-4 space-y-2.5" role="list" aria-label="네이버에서 찾은 가게">
          <p className="text-sm font-semibold text-slate-600">네이버에서 찾은 가게 — 내 가게를 눌러 주세요</p>
          {results.slice(0, 5).map((c, i) => (
            <button
              key={`${c.title}|${c.address}|${i}`}
              type="button"
              role="listitem"
              onClick={() => onSelect(c)}
              disabled={cooldownMs > 0}
              aria-label={`${c.title} 선택`}
              className="w-full text-left bg-white border-2 border-slate-200 rounded-xl p-4 transition-all hover:border-blue-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base md:text-lg font-bold text-gray-900 leading-tight break-keep">{c.title}</p>
                  {c.category && (
                    <span className="inline-block mt-1.5 text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                      {c.category}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-sm font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white">내 가게예요</span>
              </div>
              {c.address && (
                <p className="mt-2 text-sm md:text-base text-gray-600 leading-relaxed flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="break-keep">{c.address}</span>
                </p>
              )}
              {c.phone && (
                <p className="mt-1 text-sm md:text-base text-gray-600 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{c.phone}</span>
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 후보 0건 */}
      {done && !loading && results.length === 0 && q.length >= 2 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-700 leading-relaxed break-keep">
            네이버에서 &lsquo;{q}&rsquo;을(를) 찾지 못했어요. 가게 이름만 다시 써 보시거나, 아래에서 직접 입력해 진단할 수 있어요.
          </p>
        </div>
      )}

      {/* 다른 경로 */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <p className="text-base font-bold text-slate-800 mb-3">내 가게가 안 나오나요?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onManual("manual")}
            className="rounded-xl border-2 border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-colors break-keep"
          >
            직접 입력해서 진단
          </button>
          <button
            type="button"
            onClick={() => onManual("online")}
            className="rounded-xl border-2 border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-colors break-keep"
          >
            배달·온라인·전문직이에요
          </button>
          <button
            type="button"
            onClick={() => onManual("startup")}
            className="rounded-xl border-2 border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-amber-400 hover:bg-amber-50 transition-colors break-keep"
          >
            아직 가게가 없어요
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 2) 확인 후 진단 시작 ─────────────────────────────────────────────────
function ConfirmView(p: TrialFindStepProps) {
  const {
    candidate, form, setForm, selectedCategory, categoryConfirmed, onCategoryChange,
    primaryKeyword, onKeywordChange, neighborhood, setNeighborhood, neighborhoodAuto,
    hasFaq, setHasFaq, hasRecentPost, setHasRecentPost,
    hasIntro, setHasIntro, placeUrl, setPlaceUrl, cooldownMs, error, onBack, onStart,
  } = p;
  const [showMore, setShowMore] = useState(false);
  if (!candidate) return null;

  const regionOk = form.region.trim().length > 0;
  const keywordOk = primaryKeyword.trim().length > 0;
  const blockReason = cooldownMs > 0
    ? `${formatCooldown(cooldownMs)} 후 다시 이용할 수 있어요`
    : !categoryConfirmed
      ? "업종을 골라 주세요"
      : !regionOk
        ? "지역을 입력해 주세요"
        : !keywordOk
          ? "검색하는 말을 입력해 주세요"
          : "";
  const placeParsed = parseNaverPlaceUrl(placeUrl);
  const previewQuery = regionOk && keywordOk ? `${form.region.trim()} ${primaryKeyword.trim()} 추천` : "";

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-12 md:pt-10">
      <button
        type="button"
        onClick={onBack}
        aria-label="다른 가게 찾기"
        className="text-base text-gray-600 hover:text-gray-800 mb-4 flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> 다른 가게 찾기
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1 break-keep">이 가게가 맞나요?</h1>
      <p className="text-base text-gray-600 mb-4 break-keep">자동으로 채웠어요. 틀린 곳만 고치고 시작하세요.</p>

      {/* 선택한 가게 */}
      <div className="rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3 mb-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
          <Store className="w-5 h-5 text-green-700" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-green-900 leading-tight break-keep">{candidate.title}</p>
          {candidate.address && <p className="text-sm text-green-800 mt-0.5 break-keep">{candidate.address}</p>}
          {candidate.category && <p className="text-sm text-green-700 mt-0.5">네이버 업종: {candidate.category}</p>}
        </div>
        <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0 mt-0.5" aria-hidden="true" />
      </div>

      <div className="space-y-4">
        {/* 업종 */}
        <div>
          <label htmlFor="trial-confirm-category" className="block text-base font-semibold text-slate-700 mb-1">업종</label>
          {!categoryConfirmed && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 break-keep" role="alert">
              네이버 업종({candidate.category || "정보 없음"})을 자동으로 맞추지 못했어요. 가장 가까운 업종을 골라 주세요.
            </p>
          )}
          <select
            id="trial-confirm-category"
            value={categoryConfirmed ? selectedCategory : ""}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {!categoryConfirmed && <option value="">업종을 골라 주세요</option>}
            {FLAT_CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.groupLabel} label={g.groupLabel}>
                {g.items.map((it) => (
                  <option key={it.value} value={it.value}>{it.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* 지역 + 동네·역 이름 — PC는 가로 두 칸 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="trial-confirm-region" className="block text-base font-semibold text-slate-700 mb-1">지역</label>
            <input
              id="trial-confirm-region"
              type="text"
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value.slice(0, 50) }))}
              placeholder="예: 서울 성동구"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="trial-confirm-neighborhood" className="block text-base font-semibold text-slate-700 mb-1">
              동네·역 이름 <span className="font-normal text-slate-500">(선택)</span>
            </label>
            <input
              id="trial-confirm-neighborhood"
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value.slice(0, 20))}
              maxLength={20}
              placeholder="예: 왕십리, 성수동"
              className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <p className="-mt-2 text-sm text-slate-600 break-keep">
          {neighborhoodAuto && neighborhood.trim() === neighborhoodAuto
            ? "주소에서 찾은 이름이에요. 손님이 가게를 찾을 때 쓰는 이름이 아니면 고쳐 주세요."
            : "손님이 가게를 찾을 때 쓰는 동네나 역 이름이에요. 비워 두면 구 이름으로만 물어요."}
          {neighborhoodAuto && neighborhood.trim() !== neighborhoodAuto && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setNeighborhood(neighborhoodAuto)}
                className="font-bold text-blue-700 underline underline-offset-2"
              >
                주소에서 찾은 &lsquo;{neighborhoodAuto}&rsquo; 사용
              </button>
            </>
          )}
        </p>

        {/* 손님이 검색하는 말 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <label htmlFor="trial-confirm-keyword" className="flex items-center gap-2 text-base font-bold text-blue-900 mb-1">
            <Info className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" /> 손님이 검색하는 말
          </label>
          <p className="text-sm text-blue-800 mb-2 break-keep">내 가게를 가장 잘 나타내는 말인지 봐 주세요.</p>
          <input
            id="trial-confirm-keyword"
            type="text"
            value={primaryKeyword}
            onChange={(e) => onKeywordChange(e.target.value.slice(0, 20))}
            maxLength={20}
            className="w-full rounded-xl border-2 border-blue-300 bg-white px-3 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {previewQuery && (
            <p className="mt-2 text-sm text-slate-700 break-keep">
              실제로 &ldquo;<strong>{previewQuery}</strong>&rdquo; 등으로 검색해 봅니다
            </p>
          )}
        </div>

        {/* ChatGPT에 실제로 보내는 질문 예시 — 백엔드 build_ai_scan_queries의 앞 두 말투와 같은 모양(말투 5가지 중 일부만 보여 줌) */}
        {primaryKeyword.trim() && form.region.trim() && (
          <div className="rounded-xl bg-blue-50 px-4 py-3">
            <p className="text-sm md:text-base font-bold text-blue-900">ChatGPT에는 이렇게 물어봐요</p>
            <div className={`mt-2 grid gap-3 ${neighborhood.trim() ? "sm:grid-cols-2" : ""}`}>
              <div>
                <p className="text-sm font-bold text-blue-800">구 이름으로</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-800 space-y-0.5">
                  <li>{form.region.trim()} {primaryKeyword.trim()} 추천</li>
                  <li>{form.region.trim()}에서 {primaryKeyword.trim()} 잘하는 곳 추천해줘</li>
                </ul>
              </div>
              {neighborhood.trim() && (
                <div>
                  <p className="text-sm font-bold text-blue-800">동네 이름으로</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-800 space-y-0.5">
                    <li>{neighborhood.trim()} {primaryKeyword.trim()} 추천</li>
                    <li>{neighborhood.trim()}에서 {primaryKeyword.trim()} 잘하는 곳 추천해줘</li>
                  </ul>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-700 break-keep">각각 5가지 말투로 물어요. 가게 이름은 질문에 넣지 않아요.</p>
          </div>
        )}

        {/* 프랜차이즈 */}
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={!!form.is_franchise}
            onChange={(e) => setForm((f) => ({ ...f, is_franchise: e.target.checked }))}
            className="w-4 h-4 mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-base font-medium text-slate-800">프랜차이즈 가맹점이에요</span>
            <span className="block text-sm text-slate-500 mt-0.5 break-keep">가맹점은 네이버 AI 브리핑 노출 대상에서 빠지므로, 그에 맞춰 진단합니다</span>
          </span>
        </label>

        {/* 더 정확하게 (선택) */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
          >
            <span className="text-base font-semibold text-slate-700 break-keep">
              더 정확하게 진단받기 <span className="font-normal text-slate-500">(선택)</span>
            </span>
            {showMore ? <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />}
          </button>
          {!showMore && (
            <p className="px-4 pb-3 -mt-1 text-sm text-slate-600 break-keep">
              스마트플레이스 소개글·소식을 알려 주면 &lsquo;먼저 고칠 것&rsquo;이 더 정확해져요. 몰라도 괜찮아요.
            </p>
          )}
          {showMore && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-slate-600 break-keep">
                답하지 않은 항목은 &lsquo;없음&rsquo;으로 계산됩니다. 확실한 것만 눌러 주세요.
              </p>
              {[
                { key: "intro", label: "소개글을 써 두었어요", value: hasIntro, set: setHasIntro },
                { key: "post", label: "최근 7일 안에 소식을 올렸어요", value: hasRecentPost, set: setHasRecentPost },
                { key: "faq", label: "소개글에 Q&A를 넣었어요", value: hasFaq, set: setHasFaq },
              ].map((it) => (
                <div key={it.key} className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium text-slate-800 break-keep">{it.label}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => it.set(true)}
                      aria-pressed={it.value === true}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${it.value === true ? "bg-green-700 text-white border-green-700" : "bg-white text-slate-600 border-slate-300"}`}
                    >
                      맞아요
                    </button>
                    <button
                      type="button"
                      onClick={() => it.set(false)}
                      aria-pressed={it.value === false}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${it.value === false ? "bg-slate-200 text-slate-800 border-slate-400" : "bg-white text-slate-600 border-slate-300"}`}
                    >
                      아니에요
                    </button>
                  </div>
                </div>
              ))}
              <div>
                <label htmlFor="trial-confirm-place-url" className="block text-sm font-semibold text-slate-700 mb-1">
                  내 가게 네이버 지도 주소 <span className="font-normal text-slate-500">(선택)</span>
                </label>
                <input
                  id="trial-confirm-place-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://map.naver.com/p/entry/place/…"
                  value={placeUrl}
                  onChange={(e) => setPlaceUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className={`mt-1.5 text-sm break-keep ${placeParsed.status === "ok" ? "text-green-700 font-semibold" : placeParsed.status === "empty" ? "text-slate-500" : "text-amber-700"}`}>
                  {placeParsed.status === "ok"
                    ? "주소를 확인했습니다 — 소개글·소식·사진·예약을 직접 확인해 진단합니다"
                    : placeParsed.status === "short"
                      ? "naver.me 짧은 주소는 확인할 수 없어요. 네이버 지도에서 내 가게를 열고 주소창의 주소를 붙여넣어 주세요."
                      : placeParsed.status === "invalid"
                        ? "네이버 지도의 가게 주소가 아니에요. 비워 두면 이름·지역으로 진단합니다."
                        : "붙여넣으면 소개글·소식을 직접 확인해, 위 답 대신 그 결과를 씁니다."}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}

        <div>
          <button
            type="button"
            onClick={onStart}
            disabled={!!blockReason}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {blockReason ? blockReason : `${candidate.title} 진단 시작 →`}
          </button>
          <p className="mt-2 text-sm text-center text-slate-500 break-keep">
            가입 없이 무료 · ChatGPT에 50번 질문하는 데 20~40초 걸려요
          </p>
        </div>
      </div>
    </div>
  );
}
