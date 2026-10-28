"use client";

import { useState } from "react";
import {
  describeTrialReviewInput,
  parseRating,
  parseReviewCount,
  type TrialReviewInput,
} from "@/lib/trialReviewInput";

/**
 * 체험 결과 — 리뷰 수·평점을 AEOlab이 못 읽었을 때 사장님이 직접 알려 주는 선택 입력 (2026-10-28).
 * 입력값은 측정값이 아니므로 "입력하신 값"으로만 표시한다(확인된 것 목록과 섞지 않음).
 */
export default function TrialReviewInputCard({
  value,
  onChange,
}: {
  value: TrialReviewInput | null;
  onChange: (v: TrialReviewInput | null) => void;
}) {
  const [countRaw, setCountRaw] = useState(value?.review_count != null ? String(value.review_count) : "");
  const [ratingRaw, setRatingRaw] = useState(value?.avg_rating != null ? String(value.avg_rating) : "");
  const [error, setError] = useState("");

  const submit = () => {
    const rc = parseReviewCount(countRaw);
    const ar = parseRating(ratingRaw);
    if (rc === undefined) return setError("리뷰 수는 0 이상의 숫자로 입력해 주세요.");
    if (ar === undefined) return setError("평점은 0보다 크고 5 이하인 숫자로 입력해 주세요. (예: 4.3)");
    if (rc === null && ar === null) return setError("리뷰 수나 평점 중 하나는 입력해 주세요.");
    setError("");
    onChange({ review_count: rc, avg_rating: ar });
  };

  const clear = () => {
    setCountRaw("");
    setRatingRaw("");
    setError("");
    onChange(null);
  };

  const inputCls =
    "w-full min-h-[44px] rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline-none";

  return (
    <section aria-labelledby="trial-review-h" className="rounded-xl border border-slate-300 bg-white px-4 py-4 mb-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trial-review-h" className="text-base md:text-lg font-extrabold text-slate-900 break-keep">
          리뷰 수와 평점을 알려 주세요
        </h2>
        <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-bold text-slate-700">선택 입력</span>
      </div>
      <p className="mt-1 text-sm md:text-base text-slate-700 leading-snug break-keep">
        이번 체험에서는 네이버 리뷰 수와 평점을 읽지 못했어요. 네이버 플레이스에 보이는 값을 그대로 적어 주시면 아래에 &lsquo;입력하신 값&rsquo;으로 표시하고,
        가입하면 가게 정보에 이어서 반영해 드려요. AEOlab이 확인한 값이 아니라서 측정 결과와는 따로 보여 드려요.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="trial-review-count" className="block text-sm font-bold text-slate-800 mb-1.5">
            방문자 리뷰 수 (개)
          </label>
          <input
            id="trial-review-count"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="예: 1234"
            value={countRaw}
            onChange={(e) => setCountRaw(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="trial-review-rating" className="block text-sm font-bold text-slate-800 mb-1.5">
            평점 (5점 만점)
          </label>
          <input
            id="trial-review-rating"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="예: 4.3"
            value={ratingRaw}
            onChange={(e) => setRatingRaw(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          className="min-h-[44px] rounded-xl bg-blue-700 px-4 py-2 text-sm md:text-base font-bold text-white hover:bg-blue-800"
        >
          입력한 값 반영하기
        </button>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="min-h-[44px] rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm md:text-base font-bold text-slate-700 hover:border-slate-400"
          >
            지우기
          </button>
        )}
      </div>

      {value && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm md:text-base text-slate-800 leading-snug break-keep">
          <span className="font-bold">입력하신 값</span> · {describeTrialReviewInput(value)}{" "}
          <span className="text-slate-600">(AEOlab이 확인한 값이 아니에요)</span>
        </p>
      )}
    </section>
  );
}
