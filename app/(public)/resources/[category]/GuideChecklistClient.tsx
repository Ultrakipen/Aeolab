"use client";

import { useState } from "react";

interface Props {
  checklist: string[];
}

export default function GuideChecklistClient({ checklist }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() =>
    Array(checklist.length).fill(false)
  );

  const toggle = (idx: number) =>
    setChecked((prev) => prev.map((v, i) => (i === idx ? !v : v)));

  const doneCount = checked.filter(Boolean).length;

  return (
    <div>
      {/* 진행률 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">
          {doneCount} / {checklist.length} 완료
        </span>
        <span className="text-sm text-blue-600 font-medium">
          {Math.round((doneCount / checklist.length) * 100)}%
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(doneCount / checklist.length) * 100}%` }}
        />
      </div>

      {/* 항목 목록 */}
      <ul className="space-y-2">
        {checklist.map((item, idx) => (
          <li key={idx}>
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-start gap-3 p-3 md:p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
              aria-checked={checked[idx]}
              role="checkbox"
            >
              {/* 체크박스 */}
              <span
                className={`shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                  checked[idx]
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 group-hover:border-blue-400"
                }`}
              >
                {checked[idx] && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 12 12"
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                )}
              </span>
              {/* 텍스트 */}
              <span
                className={`text-sm md:text-base leading-snug break-keep ${
                  checked[idx] ? "line-through text-gray-400" : "text-gray-800"
                }`}
              >
                {item}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* 완료 메시지 */}
      {doneCount === checklist.length && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm md:text-base text-green-800 font-medium text-center break-keep">
          체크리스트를 모두 완료했습니다. AEOlab으로 실제 노출 점수를 확인해보세요.
        </div>
      )}

      {/* 초기화 안내 */}
      <p className="mt-3 text-sm text-gray-400">
        체크 상태는 새로고침 시 초기화됩니다.
      </p>
    </div>
  );
}
