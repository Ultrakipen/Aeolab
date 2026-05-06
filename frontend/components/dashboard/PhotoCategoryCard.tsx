"use client";

import { CheckCircle2, XCircle, ImageOff } from "lucide-react";

const EXPECTED_CATEGORIES: Record<string, string[]> = {
  restaurant:    ["음식-음료", "메뉴", "풍경"],
  cafe:          ["음식-음료", "메뉴", "풍경"],
  bakery:        ["음식-음료", "메뉴", "풍경"],
  bar:           ["음식-음료", "메뉴", "풍경"],
  accommodation: ["객실", "전망", "수영장"],
  beauty:        ["시술", "매장", "결과"],
  nail:          ["시술", "매장", "결과"],
};

// 카드를 표시할 업종 목록
const SUPPORTED_CATEGORIES = Object.keys(EXPECTED_CATEGORIES);

interface Props {
  photoCategories: Record<string, number> | null;
  category: string;
}

export default function PhotoCategoryCard({ photoCategories, category }: Props) {
  // 지원 업종이 아니면 컴포넌트 숨김
  if (!SUPPORTED_CATEGORIES.includes(category)) return null;

  const expected = EXPECTED_CATEGORIES[category] ?? [];

  // 빈 상태 (null 또는 빈 객체)
  const isEmpty =
    !photoCategories || Object.keys(photoCategories).length === 0;

  return (
    <section
      aria-labelledby="photo-category-title"
      className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50">
        <ImageOff className="w-4 h-4 md:w-5 md:h-5 text-gray-500 shrink-0" />
        <h2
          id="photo-category-title"
          className="text-base md:text-lg font-bold text-gray-900 break-keep"
        >
          스마트플레이스 사진 카테고리 현황
        </h2>
      </div>

      {/* 본문 */}
      <div className="p-4 md:p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <ImageOff className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500">다음 스캔 후 표시됩니다</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {expected.map((catName) => {
                const count = photoCategories?.[catName] ?? 0;
                const hasPhotos = count > 0;

                return (
                  <div
                    key={catName}
                    className={`rounded-xl border p-4 flex flex-col gap-2 ${
                      hasPhotos
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-800 break-keep">
                        {catName}
                      </span>
                      {hasPhotos ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                      )}
                    </div>

                    {hasPhotos ? (
                      <p className="text-2xl font-bold text-green-700">
                        {count.toLocaleString()}
                        <span className="text-sm font-normal text-green-600 ml-1">장</span>
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center self-start rounded-full bg-red-100 border border-red-300 text-red-700 px-2.5 py-0.5 text-sm font-semibold">
                          0장
                        </span>
                        <p className="text-sm text-red-600 break-keep leading-snug">
                          이번 달 추가 권장
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-gray-400 leading-snug">
              측정 시점·기기·로그인 상태에 따라 달라질 수 있음. 스마트플레이스 관리자에서 직접 확인을 권장합니다.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
