"use client";

import { useState } from "react";
import { getUserGroup, GROUP_MESSAGES } from "@/lib/userGroup";
import { FLAT_CATEGORY_GROUPS } from "@/lib/categories";

/** 요금제 페이지 — 업종 선택 → 그룹별 가치 메시지 배너 */
export default function GroupHeadlineBanner() {
  const [category, setCategory] = useState("");
  const [isFranchise, setIsFranchise] = useState(false);

  const group = category ? getUserGroup(category, isFranchise) : null;
  const msg = group ? GROUP_MESSAGES[group] : null;

  const bgMap: Record<string, string> = {
    ACTIVE:    "bg-green-50 border-green-200",
    LIKELY:    "bg-blue-50 border-blue-200",
    INACTIVE:  "bg-amber-50 border-amber-200",
    franchise: "bg-purple-50 border-purple-200",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 md:px-6 py-4 mb-2">
      {/* 셀렉터 행 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-sm font-semibold text-gray-700 shrink-0">
          내 업종:
        </label>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setIsFranchise(false); }}
          className="flex-1 max-w-xs text-sm rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">업종을 선택하세요</option>
          {FLAT_CATEGORY_GROUPS.map((grp) => (
            <optgroup key={grp.groupLabel} label={grp.groupLabel}>
              {grp.items.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        {category && (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 shrink-0">
            <input
              type="checkbox"
              checked={isFranchise}
              onChange={(e) => setIsFranchise(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            프랜차이즈 가맹점
          </label>
        )}
      </div>

      {/* 그룹별 메시지 */}
      {group && msg && (
        <div className={`mt-4 rounded-xl border px-4 py-3 ${bgMap[group]}`}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${msg.badgeColor}`}>
              {msg.badge}
            </span>
          </div>
          <p className="text-sm md:text-base font-bold text-gray-900 leading-snug break-keep mb-1">
            {msg.headline}
          </p>
          <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            {msg.sub}
          </p>
        </div>
      )}

      {!category && (
        <p className="mt-3 text-sm text-gray-500">
          업종을 선택하면 내 가게에 맞는 AEOlab 활용 방법을 안내해 드립니다.
        </p>
      )}
    </div>
  );
}
