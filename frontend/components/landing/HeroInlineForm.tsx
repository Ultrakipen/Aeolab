"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORY_OPTIONS = [
  { value: "food",          label: "음식·식음료" },
  { value: "cafe",          label: "카페·디저트" },
  { value: "beauty",        label: "뷰티·패션" },
  { value: "health",        label: "의료·건강" },
  { value: "education",     label: "교육·보육" },
  { value: "professional",  label: "전문직·법무·세무" },
  { value: "shopping",      label: "쇼핑·유통" },
  { value: "living",        label: "생활서비스·인테리어" },
  { value: "culture",       label: "문화·여가·취미" },
  { value: "accommodation", label: "숙박·여행·이벤트" },
  { value: "photo",         label: "사진·영상촬영" },
  { value: "design",        label: "디자인·인쇄" },
  { value: "it",            label: "IT·웹·마케팅" },
];

export default function HeroInlineForm() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (name.trim()) params.set("business_name", name.trim());
    if (category) params.set("category", category);
    router.push(`/trial?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl mx-auto lg:mx-0 mb-2"
    >
      <div className="flex flex-col sm:flex-row gap-2 bg-white border-2 border-blue-200 rounded-2xl p-2 shadow-md">
        {/* 업종 선택 */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-shrink-0 text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 sm:w-40"
        >
          <option value="">업종 선택</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* 가게 이름 입력 */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="가게 이름 입력"
          className="flex-1 text-sm text-gray-800 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
        />

        {/* 확인 버튼 */}
        <button
          type="submit"
          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
        >
          무료로 확인하기
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1.5 text-center lg:text-left">
        이름이 없어도 됩니다 — 업종만 선택해도 업종 평균 확인 가능
      </p>
    </form>
  );
}
