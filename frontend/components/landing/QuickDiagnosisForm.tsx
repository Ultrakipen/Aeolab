"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATS = [
  { value: "restaurant", label: "음식점" },
  { value: "cafe", label: "카페" },
  { value: "beauty", label: "미용실" },
  { value: "fitness", label: "헬스장" },
  { value: "medical", label: "병원" },
  { value: "education", label: "학원" },
  { value: "other", label: "기타" },
];

export default function QuickDiagnosisForm() {
  const router = useRouter();
  const [bizName, setBizName] = useState("");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("restaurant");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ category });
    if (bizName.trim()) params.set("business_name", bizName.trim());
    if (region.trim()) params.set("region", region.trim());
    router.push(`/trial?${params.toString()}`);
  };

  return (
    <section className="bg-gradient-to-br from-blue-600 to-indigo-700 py-10 md:py-12 px-4 md:px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-2">
            지금 바로 확인
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 break-keep">
            사장님 가게, AI에 뜨고 있나요?
          </h2>
          <p className="text-blue-100 text-sm md:text-base break-keep">
            업종과 가게명만 입력하면 현재 AI 노출 상태를 바로 확인합니다
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 md:p-6 shadow-2xl">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">업종 선택</p>
            <div className="flex flex-wrap gap-2">
              {CATS.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`text-sm px-3 py-1.5 rounded-lg border-2 font-medium transition-colors ${
                    category === cat.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">
                가게명 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="예: 창원 맛있는 치킨"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1 block">
                지역 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="예: 창원 의창구"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold text-base py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
          >
            내 가게 AI 노출 지금 확인 →
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            가입 불필요 · 무료
          </p>
        </form>
      </div>
    </section>
  );
}
