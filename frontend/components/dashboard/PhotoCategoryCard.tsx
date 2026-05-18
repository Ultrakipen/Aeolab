"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, ImageOff, BookOpen, X } from "lucide-react";
import {
  EXPECTED_CATEGORIES,
  SUPPORTED_CATEGORIES,
  getCountNormalized,
} from "@/lib/photoCategories";

interface PhotoGuideEntry {
  description: string;
  examples: string[];
  tips: string[];
}

interface Props {
  photoCategories: Record<string, number> | null;
  category: string;
  /** 부족 카테고리 클릭 시 가이드 모달 표시 (선택). 없으면 모달 비활성 */
  photoGuides?: Record<string, PhotoGuideEntry> | null;
}

export default function PhotoCategoryCard({
  photoCategories,
  category,
  photoGuides = null,
}: Props) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // ESC 닫기 + body scroll lock + 모달 열릴 때 닫기 버튼에 포커스 + 닫힐 때 trigger로 복귀
  useEffect(() => {
    if (!openCat) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenCat(null);
    };
    document.addEventListener("keydown", handleKey);
    // 마이크로태스크 뒤 포커스 (모달 렌더 직후)
    setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
      triggerRef.current?.focus();
    };
  }, [openCat]);

  if (!SUPPORTED_CATEGORIES.includes(category)) return null;

  const expected = EXPECTED_CATEGORIES[category] ?? [];

  const isEmpty =
    !photoCategories || Object.keys(photoCategories).length === 0;

  const guide = openCat && photoGuides ? photoGuides[openCat] : null;

  return (
    <>
      <section
        aria-labelledby="photo-category-title"
        className="mb-4 md:mb-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50">
          <ImageOff className="w-4 h-4 md:w-5 md:h-5 text-gray-500 shrink-0" />
          <h2
            id="photo-category-title"
            className="text-base md:text-lg font-bold text-gray-900 break-keep"
          >
            스마트플레이스 사진 카테고리 현황
          </h2>
        </div>

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
                  const count = getCountNormalized(photoCategories, catName);
                  const hasPhotos = count > 0;
                  const hasGuide = !!(photoGuides && photoGuides[catName]);

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
                        <div className="flex flex-col gap-2">
                          <span className="inline-flex items-center self-start rounded-full bg-red-100 border border-red-300 text-red-700 px-2.5 py-0.5 text-sm font-semibold">
                            0장
                          </span>
                          <p className="text-sm text-red-600 break-keep leading-snug">
                            이번 달 추가 권장
                          </p>
                          {hasGuide && (
                            <button
                              type="button"
                              ref={openCat === catName ? triggerRef : null}
                              onClick={(e) => {
                                triggerRef.current = e.currentTarget;
                                setOpenCat(catName);
                              }}
                              aria-label={`${catName} 촬영 가이드 보기`}
                              aria-haspopup="dialog"
                              className="inline-flex items-center gap-1 self-start text-sm font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 min-h-[44px] py-1"
                            >
                              <BookOpen className="w-4 h-4" />
                              이렇게 찍어보세요
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-gray-500 leading-snug">
                측정 시점·기기·로그인 상태에 따라 달라질 수 있음. 스마트플레이스 관리자에서 직접 확인을 권장합니다.
              </p>
            </>
          )}
        </div>
      </section>

      {openCat && guide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="photo-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpenCat(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 sticky top-0 bg-white">
              <h3
                id="photo-guide-title"
                className="text-base md:text-lg font-bold text-gray-900"
              >
                {openCat} 촬영 가이드
              </h3>
              <button
                type="button"
                ref={closeBtnRef}
                onClick={() => setOpenCat(null)}
                aria-label="닫기"
                className="p-2 rounded hover:bg-gray-100 text-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-800 leading-relaxed">
                {guide.description}
              </p>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  추천 사진 예시
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {guide.examples.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  촬영 팁
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {guide.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
