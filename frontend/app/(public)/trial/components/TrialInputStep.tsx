"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, Search, Target, Mail, Store, Laptop, Rocket, MapPin, Phone, Info, AlertTriangle } from "lucide-react";
import {
  CATEGORY_MAP,
  FLAT_CATEGORY_GROUPS,
  FLAT_CATEGORY_MAP,
  tagsForFlat,
  CATEGORIES_WITH_TYPE_KEYWORDS,
} from "@/lib/categories";
import { CATEGORY_ICON_MAP } from "@/lib/categoryIcons";
import { getUserGroup } from "@/lib/userGroup";
import { useBriefingCategories } from "@/lib/useBriefingCategories";
import type { TrialBusinessCandidate } from "@/types";
import type { TrialInputStepProps } from "./TrialSharedTypes";

/**
 * Trial — 입력 4단계 (category → tags → info → search) 렌더링
 *
 * 부모 page.tsx 가 모든 state·콜백을 props로 전달.
 * 본 컴포넌트는 순수 렌더 + DOM 이벤트 위임.
 */
export default function TrialInputStep(props: TrialInputStepProps) {
  const {
    step,
    setStep,
    selectedCategory,
    setSelectedCategory,
    selectedTags,
    setSelectedTags,
    toggleTag,
    businessType,
    setBusinessType,
    form,
    setForm,
    hasFaq,
    setHasFaq,
    hasRecentPost,
    setHasRecentPost,
    hasIntro,
    setHasIntro,
    reviewText,
    setReviewText,
    description,
    setDescription,
    showAdvanced,
    setShowAdvanced,
    isStartupMode,
    setIsStartupMode,
    candidates,
    searchLoading,
    searchError,
    selectedCandidateKey,
    forceManualEntry,
    cooldownMs,
    error,
    onSearch,
    onPlaceSelect,
    onSkipPlaceMatch,
    getCandidateKey,
    primaryKeyword,
    setPrimaryKeyword,
    onMoveToInfo,
    inlineSearchResults,
    inlineSearchLoading,
    inlineSelectedCandidate,
    onInlinePlaceSelect,
    onInlinePlaceClear,
  } = props;

  const [keywordError, setKeywordError] = useState(false);
  const [regionError, setRegionError] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const briefingCats = useBriefingCategories();

  useEffect(() => {
    if (step === "category") setCategorySearch("");
  }, [step]);
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const regionInputRef = useRef<HTMLInputElement>(null);

  /** tags → info 단계 이동 전 종류 키워드 필수 선택 검사 */
  const handleMoveToInfo = () => {
    const flatCat = FLAT_CATEGORY_MAP[selectedCategory];
    const typeTagList = flatCat?.typeTags ?? [];
    if (
      CATEGORIES_WITH_TYPE_KEYWORDS.has(selectedCategory) &&
      typeTagList.length > 0 &&
      !typeTagList.some((t) => selectedTags.includes(t))
    ) {
      alert(
        `"${flatCat?.label}" 업종은 구체적인 종류를 1개 이상 선택해야 합니다.\n(예: ${typeTagList.slice(0, 3).join(", ")} 등)`
      );
      return;
    }
    onMoveToInfo();
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // 1. 분석 키워드 필수
    if (!primaryKeyword.trim()) {
      e.preventDefault();
      setKeywordError(true);
      keywordInputRef.current?.focus();
      keywordInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setKeywordError(false);

    // 2. 지역 필수 (예비창업자 모드 제외 전 타입)
    // 배달도 지역 단위 노출 → 오프라인·배달·전문직 모두 필수
    // 순수 온라인은 "전국" 입력 유도 (플레이스홀더 안내)
    const needsRegion = !isStartupMode;
    if (needsRegion && !form.region.trim()) {
      e.preventDefault();
      setRegionError(true);
      regionInputRef.current?.focus();
      regionInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setRegionError(false);

    onSearch(e);
  };

  return (
    <>
      <div
        id="trial-form"
        className={`mx-auto px-4 ${
          step === "category" ? "max-w-5xl pt-8 pb-10" :
          step === "info" ? "max-w-3xl py-10" :
          "max-w-2xl py-10"
        }`}
      >
        {/* ── 무료 진단으로 얻는 것 ── */}
        {step !== "scanning" && step !== "search" && (
          <div className="mb-7 max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-slate-500 text-center mb-3">무료 진단으로 얻는 것</p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  Icon: Search,
                  title: "AI 노출 점수",
                  desc: "네이버·ChatGPT가 내 가게를 검색하는지 바로 확인",
                },
                {
                  Icon: Target,
                  title: "개선 키워드 목록",
                  desc: "지금 당장 보완할 수 있는 항목만 추려 드립니다",
                },
                {
                  Icon: Mail,
                  title: "7일 뒤 변화 알림",
                  desc: "가입 후 개선 효과를 자동 측정해 알려 드립니다",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-center"
                >
                  <item.Icon className="w-6 h-6 text-blue-600" aria-hidden="true" />
                  <p className="text-sm font-bold text-slate-800 leading-tight">{item.title}</p>
                  <p className="text-sm text-slate-500 leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step !== "scanning" && (
          <div className="flex items-center justify-center gap-1.5 mb-8 flex-wrap">
            {[
              { key: "category", label: "업종" },
              { key: "tags", label: "서비스" },
              { key: "info", label: "정보" },
              { key: "search", label: "가게 찾기" },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
                    step === s.key
                      ? "bg-blue-600 text-white"
                      : ["category", "tags", "info", "search"].indexOf(step) > i
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span>{i + 1}</span>
                  <span>{s.label}</span>
                </div>
                {i < 3 && <div className="w-4 h-0.5 bg-gray-300" aria-hidden="true" />}
              </div>
            ))}
          </div>
        )}

        {/* 1단계: 업종 선택 */}
        {step === "category" && (
          <div>
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                지금 내 가게, AI 검색에서 찾히나요?
              </h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                업종과 가게 이름을 입력하면 네이버·ChatGPT·Google AI에서
                내 가게가 검색되는지 확인하고,
                <br />
                오늘 당장 할 수 있는 개선 방법을 알려드립니다.
              </p>
              <p className="text-blue-600 text-sm font-semibold mt-2">
                아래에서 업종을 선택해 주세요
              </p>
            </div>
            <p className="text-gray-500 text-center text-sm mb-3">
              가장 가까운 업종을 선택하세요
            </p>

            {/* AI 채널 범례 */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mb-4 px-1">
              {[
                { dot: "bg-green-500", label: "네이버 AI 브리핑 대상" },
                { dot: "bg-blue-400", label: "AI 브리핑 확대 예정" },
                { dot: "bg-violet-400", label: "글로벌 AI (ChatGPT·Gemini)" },
              ].map(({ dot, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${dot} inline-block shrink-0`} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>

            {/* 업종 검색 입력 */}
            <div className="relative mb-4 max-w-lg mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                placeholder="업종 검색 (예: 카페, 네일, 학원)"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>

            {/* 59개 평면 업종 (그룹별) */}
            <div className="space-y-5">
              {FLAT_CATEGORY_GROUPS.map((group) => {
                const q = categorySearch.trim().toLowerCase();
                const filteredItems = q
                  ? group.items.filter(
                      (cat) =>
                        cat.label.toLowerCase().includes(q) ||
                        cat.groupLabel.toLowerCase().includes(q),
                    )
                  : group.items;
                if (filteredItems.length === 0) return null;
                return (
                <div key={group.groupLabel}>
                  <p className="text-sm font-semibold text-slate-500 mb-2 px-1">
                    {group.groupLabel}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
                    {filteredItems.map((cat) => {
                      const cfg = CATEGORY_ICON_MAP[cat.value];
                      const Icon = cfg?.Icon;
                      const selected = selectedCategory === cat.value;
                      const grp = getUserGroup(cat.value, false, briefingCats?.active, briefingCats?.likely);
                      const aiBadge =
                        grp === "ACTIVE"
                          ? { text: "AI 브리핑", cls: "bg-green-100 text-green-700", dot: "bg-green-500" }
                          : grp === "LIKELY"
                          ? { text: "AI 브리핑 확대 예정", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-400" }
                          : { text: "글로벌 AI", cls: "bg-violet-50 text-violet-700", dot: "bg-violet-400" };
                      return (
                        <button
                          key={cat.value}
                          aria-label={`${cat.label} 업종 선택 — ${aiBadge.text}`}
                          onClick={() => {
                            setSelectedCategory(cat.value);
                            setSelectedTags([]);
                            setStep("tags");
                          }}
                          className={`
                            min-h-[96px] flex flex-col items-center justify-center gap-1.5 p-2.5 md:p-3 rounded-xl border-2 cursor-pointer
                            transition-all duration-150 hover:scale-105 hover:shadow-md
                            ${
                              selected
                                ? `${cfg?.bg ?? "bg-blue-50"} ${cfg?.border ?? "border-blue-300"} shadow-sm`
                                : "bg-white border-slate-200 hover:border-gray-300 hover:shadow-sm"
                            }
                          `}
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? (cfg?.bg ?? "bg-blue-100") : (cfg?.bg ?? "bg-gray-100")}`}
                          >
                            {Icon ? (
                              <Icon
                                className={`w-5 h-5 ${cfg?.text ?? "text-gray-500"}`}
                                strokeWidth={1.8}
                              />
                            ) : (
                              <Store className="w-5 h-5 text-gray-500" aria-hidden="true" />
                            )}
                          </div>
                          <span
                            className={`text-base font-semibold text-center leading-tight break-keep ${selected ? (cfg?.text ?? "text-blue-600") : "text-gray-700"}`}
                          >
                            {cat.label}
                          </span>
                          {cat.typeTags && cat.typeTags.length > 0 && (
                            <span className="text-xs text-gray-400 text-center leading-tight truncate w-full px-1">
                              {cat.typeTags.slice(0, 2).join("·")} 등
                            </span>
                          )}
                          <span className={`text-sm font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${aiBadge.cls}`}>
                            <span className={`w-2 h-2 rounded-full ${aiBadge.dot} inline-block shrink-0`} aria-hidden="true" />
                            {aiBadge.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {categorySearch.trim() &&
              FLAT_CATEGORY_GROUPS.every(
                (g) =>
                  !g.items.some(
                    (c) =>
                      c.label.toLowerCase().includes(categorySearch.trim().toLowerCase()) ||
                      c.groupLabel.toLowerCase().includes(categorySearch.trim().toLowerCase()),
                  ),
              ) && (
                <p className="text-center text-sm text-slate-400 py-6">
                  일치하는 업종이 없습니다. 다른 단어로 검색해 보세요.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 2단계: 서비스 태그 선택 */}
        {step === "tags" && selectedCategory && (
          <div>
            <button
              onClick={() => setStep("category")}
              aria-label="업종 다시 선택"
              className="text-base text-gray-500 hover:text-gray-600 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> 업종 다시 선택
            </button>

            {/* 업종별 AI 브리핑 대상 여부 안내 — 업종 선택 직후 즉시 표시 */}
            {(() => {
              const group = getUserGroup(selectedCategory, false, briefingCats?.active, briefingCats?.likely);
              if (group === "ACTIVE") {
                return (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-bold text-green-900">
                          네이버 AI 브리핑 대상 업종입니다
                        </p>
                        <p className="text-sm text-green-800">
                          네이버 AI 브리핑 + ChatGPT·Gemini·Google AI 노출을 통합 진단합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              if (group === "INACTIVE") {
                return (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 mb-5">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-blue-900 mb-1">
                          네이버 AI 브리핑 대상 업종이 아닙니다 — 그래도 개선 효과가 있습니다
                        </p>
                        <ul className="space-y-1.5 mt-2">
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                            <p className="text-sm text-blue-800">
                              <strong>ChatGPT·Gemini·Google AI</strong> 검색에서 찾히도록 최적화
                            </p>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                            <p className="text-sm text-blue-800">
                              <strong>블로그 포스팅·리뷰</strong>가 쌓이면 네이버 검색 노출에 직접 효과
                            </p>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                            <p className="text-sm text-blue-800">
                              <strong>스마트플레이스·소개글</strong> 개선 → 네이버 지도 상위 노출 가능
                            </p>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                            <p className="text-sm text-blue-800">
                              <strong>네이버 AI탭</strong>은 2026-04-27 베타 출시, 2026년 2026-06-25 전체 사용자 정식 출시됨 (업종 공식 제한 없음)
                            </p>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }
              if (group === "LIKELY") {
                return (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 mb-5">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-blue-900 mb-1">
                          네이버 AI 브리핑 확대 예정 업종 — AI탭(정식 출시)은 이미 노출 가능
                        </p>
                        <ul className="space-y-1.5 mt-2">
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                            <p className="text-sm text-blue-800">
                              <strong>네이버 플레이스·지도</strong> 노출 + <strong>ChatGPT·Gemini</strong> 검색을 중심으로 진단
                            </p>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                            <p className="text-sm text-blue-800">
                              <strong>블로그 포스팅·리뷰</strong>가 쌓이면 네이버 검색 노출에 직접 효과
                            </p>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                            <p className="text-sm text-blue-800">
                              '플레이스형' AI 브리핑 대상이 아니어도 <strong>스마트플레이스·소개글·블로그 개선</strong>은 '정보형 AI 브리핑'과 검색 노출에 도움
                            </p>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {(() => {
              const cfg = CATEGORY_ICON_MAP[selectedCategory];
              const Icon = cfg?.Icon;
              return (
                <div className="flex items-center gap-2.5 mb-1">
                  {Icon && (
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}
                    >
                      <Icon className={`w-5 h-5 ${cfg.text}`} strokeWidth={1.8} />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-900">
                    {FLAT_CATEGORY_MAP[selectedCategory]?.label ??
                      CATEGORY_MAP[selectedCategory]?.label}
                  </h2>
                </div>
              );
            })()}
            <p className="text-base text-gray-500 mb-4">
              해당하는 서비스를 모두 선택하세요{" "}
              <span className="text-blue-500">(복수 선택 가능)</span>
            </p>

            {CATEGORIES_WITH_TYPE_KEYWORDS.has(selectedCategory) ? (
              // ── 두 섹션: 종류(필수) + 특징(선택) ──
              <>
                {/* 섹션 1: 종류 (필수) */}
                {(() => {
                  const flatCat = FLAT_CATEGORY_MAP[selectedCategory];
                  const typeTagList = flatCat?.typeTags ?? [];
                  if (typeTagList.length === 0) return null;
                  const hasTypeSelected = typeTagList.some((t) =>
                    selectedTags.includes(t)
                  );
                  return (
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-bold text-gray-800">
                          어떤{" "}
                          {FLAT_CATEGORY_MAP[selectedCategory]?.label ?? ""}
                          인가요?
                        </p>
                        <span
                          className={`text-sm px-2 py-0.5 rounded-full font-medium ${
                            hasTypeSelected
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {hasTypeSelected ? "선택됨" : "1개 이상 필수"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {typeTagList.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            aria-pressed={selectedTags.includes(tag)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                              selectedTags.includes(tag)
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 섹션 2: 특징 (선택) */}
                {(() => {
                  const attrTags = tagsForFlat(selectedCategory);
                  if (attrTags.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-bold text-gray-800 mb-2">
                        특징 키워드{" "}
                        <span className="text-sm font-normal text-gray-500">
                          (선택사항)
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {attrTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            aria-pressed={selectedTags.includes(tag)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                              selectedTags.includes(tag)
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              // ── 기존 단일 섹션 (나머지 업종) ──
              <div className="flex flex-wrap gap-2 mb-6">
                {tagsForFlat(selectedCategory).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={selectedTags.includes(tag)}
                    className={`px-4 py-2 rounded-full text-base font-medium border transition-all ${
                      selectedTags.includes(tag)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {selectedTags.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 mb-4 text-base text-blue-700">
                선택한 서비스: <strong>{selectedTags.join(", ")}</strong>
              </div>
            )}
            <button
              onClick={handleMoveToInfo}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              {selectedTags.length > 0 ? "다음 →" : "태그 없이 다음으로 →"}
            </button>
          </div>
        )}

        {/* 3단계: 정보 입력 */}
        {step === "info" && (
          <div>
            <button
              onClick={() => setStep(selectedTags.length > 0 ? "tags" : "category")}
              aria-label={selectedTags.length > 0 ? "서비스 다시 선택" : "업종 다시 선택"}
              className="text-base text-gray-500 hover:text-gray-600 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              {selectedTags.length > 0 ? "서비스 다시 선택" : "업종 다시 선택"}
            </button>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {isStartupMode ? "경쟁 환경 분석" : "사업장 정보를 입력하세요"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsStartupMode((v) => !v);
                  if (!isStartupMode) setForm((f) => ({ ...f, business_name: "" }));
                }}
                className={`text-sm px-3 py-1.5 rounded-full border-2 font-medium transition-all flex items-center gap-1.5 ${
                  isStartupMode
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600"
                }`}
              >
                {isStartupMode ? (
                  <><Rocket className="w-4 h-4" aria-hidden="true" /> 예비 창업자 모드</>
                ) : "아직 가게가 없어요"}
              </button>
            </div>
            {isStartupMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-base font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                  <Rocket className="w-4 h-4" aria-hidden="true" /> 예비 창업자 모드
                </p>
                <p className="text-base text-amber-700">
                  가게 이름 없이 업종·지역의 <strong>경쟁 환경</strong>을 분석합니다.
                </p>
              </div>
            )}

            {(() => {
              const cfg = CATEGORY_ICON_MAP[selectedCategory];
              const Icon = cfg?.Icon;
              return (
                <div
                  className={`rounded-xl p-3 mb-4 flex items-center gap-3 ${cfg?.bg ?? "bg-gray-50"}`}
                >
                  {Icon && (
                    <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                      <Icon
                        className={`w-4 h-4 ${cfg?.text ?? "text-gray-600"}`}
                        strokeWidth={1.8}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold ${cfg?.text ?? "text-gray-600"}`}
                    >
                      {FLAT_CATEGORY_MAP[selectedCategory]?.label ??
                        CATEGORY_MAP[selectedCategory]?.label}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTags.map((t) => (
                        <span
                          key={t}
                          className="bg-white/70 text-gray-700 text-sm px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 분석 기준 키워드 — 경쟁사·AI 측정에 사용되는 핵심 키워드 (항상 표시) */}
            {(() => {
              const categoryKorean: Record<string, string> = {
                restaurant: "레스토랑", cafe: "카페", bakery: "베이커리", bar: "바",
                beauty: "미용실", nail: "네일샵", medical: "의원", pharmacy: "약국",
                fitness: "헬스장", yoga: "요가원", pet: "반려동물", education: "학원",
                tutoring: "과외", legal: "법무사", realestate: "부동산", interior: "인테리어",
                auto: "자동차", cleaning: "청소", shopping: "쇼핑", fashion: "패션",
                photo: "사진관", video: "영상", design: "디자인", accommodation: "숙박", other: "가게",
              };
              const fallbackKeyword =
                selectedTags[0] ||
                categoryKorean[selectedCategory] ||
                "대표 키워드 입력";
              const previewKeyword = primaryKeyword || selectedTags[0];
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-5 h-5 text-blue-500 shrink-0" aria-hidden="true" />
                    <p className="text-base font-bold text-blue-900">분석 기준 키워드 확인</p>
                  </div>
                  <p className="text-sm text-blue-700 mb-1 leading-relaxed">
                    이 키워드로 네이버 AI·ChatGPT·Gemini에 <strong>&ldquo;[지역] [키워드] 추천&rdquo;</strong> 형식으로 실제 쿼리를 날려 경쟁사와 비교 측정합니다.
                  </p>
                  <p className="text-sm font-semibold text-blue-800 mb-3">
                    내 가게의 대표 서비스·업종명이 맞는지 확인하세요.
                  </p>
                  <input
                    ref={keywordInputRef}
                    type="text"
                    value={primaryKeyword}
                    onChange={e => {
                      setPrimaryKeyword(e.target.value.slice(0, 20));
                      if (e.target.value.trim()) setKeywordError(false);
                    }}
                    placeholder={fallbackKeyword}
                    className={`w-full border-2 rounded-xl px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 font-medium transition-colors ${
                      keywordError
                        ? "border-red-400 focus:ring-red-300 focus:border-red-400"
                        : "border-amber-300 focus:ring-amber-400 focus:border-amber-400"
                    }`}
                    maxLength={20}
                  />
                  {keywordError && (
                    <p className="text-sm font-semibold text-red-600 mt-1.5 flex items-center gap-1.5" role="alert">
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      키워드를 직접 입력해 주세요. 분석 기준이 되는 가장 중요한 항목입니다.
                    </p>
                  )}
                  {!keywordError && previewKeyword && form.region ? (
                    <div className="mt-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-amber-700 font-semibold mb-0.5">실제 측정 쿼리 미리보기</p>
                      <p className="text-sm text-slate-700">&ldquo;<strong>{form.region.split(" ")[0]} {previewKeyword} 추천</strong>&rdquo; 등 5가지 방식</p>
                    </div>
                  ) : !keywordError && previewKeyword && !isStartupMode ? (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-sm text-red-700">
                        <strong>지역을 아래에 입력</strong>해야 <strong className="text-slate-700">&ldquo;[지역] {previewKeyword} 추천&rdquo;</strong> 형태로 정확하게 질의합니다.
                      </p>
                    </div>
                  ) : !keywordError && (
                    <p className="text-sm text-amber-700 mt-1.5">지역을 입력하면 실제 측정 쿼리를 미리 볼 수 있습니다.</p>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setBusinessType("location_based")}
                className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  businessType === "location_based"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <Store className="w-4 h-4" aria-hidden="true" /> 오프라인 매장
              </button>
              <button
                type="button"
                onClick={() => setBusinessType("non_location")}
                className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  businessType === "non_location"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <Laptop className="w-4 h-4" aria-hidden="true" /> 배달·온라인·전문직
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {!isStartupMode && (
                <div>
                  <label
                    htmlFor="trial-business-name"
                    className="block text-base font-semibold text-slate-700 mb-1"
                  >
                    사업장 이름 *
                  </label>
                  <div className="relative">
                    <input
                      id="trial-business-name"
                      type="text"
                      required={!isStartupMode}
                      placeholder="사업장 이름을 입력하세요"
                      value={form.business_name}
                      onChange={(e) =>
                        setForm({ ...form, business_name: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                    />
                    {inlineSearchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* 인라인 선택 완료 표시 */}
                  {inlineSelectedCandidate && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-800 leading-tight">네이버 스마트플레이스에서 찾았습니다</p>
                        {inlineSelectedCandidate.address && (
                          <p className="text-sm text-green-700 mt-0.5 break-keep">{inlineSelectedCandidate.address}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={onInlinePlaceClear}
                        className="text-sm text-slate-500 hover:text-slate-700 underline shrink-0 mt-0.5"
                      >
                        다시 찾기
                      </button>
                    </div>
                  )}

                  {/* 인라인 검색 결과 드롭다운 */}
                  {!inlineSelectedCandidate && inlineSearchResults.length > 0 && (
                    <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                      <p className="text-sm text-slate-500 px-3 py-2 bg-slate-50 border-b border-slate-100">
                        네이버에서 찾은 가게 — 선택하면 정보가 자동 입력됩니다
                      </p>
                      {inlineSearchResults.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onInlinePlaceSelect(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{c.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {c.category && (
                              <span className="text-sm text-blue-600 font-medium">{c.category}</span>
                            )}
                            {c.address && (
                              <span className="text-sm text-slate-500">{c.address}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 가게 소개 한 줄 */}
              <div>
                <label
                  htmlFor="trial-description"
                  className="block text-base font-semibold text-slate-700 mb-1"
                >
                  가게 소개 한 줄
                </label>
                <textarea
                  id="trial-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 20년 전통 손칼국수 전문점 / 주차 넓고 단체석 운영"
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  maxLength={200}
                />
                <p className={`text-sm mt-1 ${description ? "text-blue-600" : "text-amber-600"}`}>
                  {description
                    ? "네이버·ChatGPT·Gemini가 가게를 더 정확하게 파악합니다"
                    : "비워두면 업종 평균 데이터로 추정합니다 — 짧아도 좋으니 한 줄 적어보세요"}
                </p>
              </div>

              <div>
                <label
                  htmlFor="trial-region"
                  className="block text-base font-semibold text-slate-700 mb-1"
                >
                  지역
                  {!isStartupMode ? (
                    <span className="text-red-500 ml-0.5">*</span>
                  ) : (
                    <span className="text-slate-500 font-normal ml-1">(선택)</span>
                  )}
                </label>
                {!isStartupMode && (
                  <p className="text-sm text-slate-500 mb-1.5 leading-snug">
                    {businessType === "non_location"
                      ? <>서비스 지역을 입력하세요. 전국 대상이면 <strong className="text-slate-700">&apos;전국&apos;</strong> 입력. 배달도 배달의민족·쿠팡이츠 기준 지역 단위로 측정됩니다.</>
                      : <><strong className="text-slate-700">시·구 단위</strong>로 입력하세요 (예: 창원시 의창구, 서울 강남구). 같은 동 이름이 다른 시·구에도 존재하므로 구 단위까지 입력해야 경쟁사 비교가 정확합니다.</>
                    }
                  </p>
                )}
                <input
                  ref={regionInputRef}
                  id="trial-region"
                  type="text"
                  placeholder={
                    isStartupMode
                      ? "서울 강남 등 (비워두면 전국 분석)"
                      : businessType === "non_location"
                        ? "서비스 지역 입력 (예: 서울 강남구, 전국 서비스면 '전국')"
                        : "시+구 단위로 입력 (예: 창원시 의창구, 서울 강남구)"
                  }
                  value={form.region}
                  onChange={(e) => {
                    setForm({ ...form, region: e.target.value });
                    if (e.target.value.trim()) setRegionError(false);
                  }}
                  className={`w-full border-2 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 transition-colors ${
                    regionError
                      ? "border-red-400 focus:ring-red-300 focus:border-red-400"
                      : "border-slate-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                />
                {regionError && (
                  <p className="text-sm font-semibold text-red-600 mt-1.5 flex items-center gap-1.5" role="alert">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {businessType === "non_location"
                      ? "서비스 지역을 입력해 주세요. 전국 서비스라면 '전국'으로 입력하세요."
                      : "시·구 단위로 입력해 주세요 (예: 창원시 의창구). 구 단위까지 입력해야 경쟁사 비교가 정확합니다."
                    }
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="trial-extra-keyword"
                  className="block text-base font-semibold text-slate-700 mb-1"
                >
                  추가 키워드 <span className="text-slate-500 font-normal">(선택)</span>
                </label>
                <input
                  id="trial-extra-keyword"
                  type="text"
                  placeholder="예: 주차 가능, 예약 운영, 포장 가능"
                  value={form.extra_keyword}
                  onChange={(e) =>
                    setForm({ ...form, extra_keyword: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-slate-500 mt-1">
                  특별한 서비스가 없으면 비워도 됩니다 — 있다면 쉼표로 구분해 입력해주세요
                </p>
              </div>

              {/* 스마트플레이스 등록 여부 — 메인 폼 노출 */}
              {businessType === "location_based" && !isStartupMode && (
                <div>
                  <label className="block text-base font-semibold text-slate-700 mb-2">
                    네이버 스마트플레이스 등록 여부
                    <span className="ml-2 text-sm font-normal text-slate-400">진단 정확도에 영향을 줍니다</span>
                  </label>

                  {/* 인라인 선택 시: 자동 확인 표시 */}
                  {inlineSelectedCandidate ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" />
                      <p className="text-sm font-semibold text-green-800 flex-1">스마트플레이스 등록됨 (자동 확인)</p>
                      <button
                        type="button"
                        onClick={onInlinePlaceClear}
                        className="text-sm text-slate-500 hover:text-slate-700 underline shrink-0"
                      >
                        변경
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: "등록됨", isSelected: form.is_smart_place === true, onClick: () => setForm((p) => ({ ...p, is_smart_place: true })) },
                        { label: "미등록", isSelected: form.is_smart_place === false, onClick: () => setForm((p) => ({ ...p, is_smart_place: false })) },
                        { label: "모르겠어요", isSelected: form.is_smart_place === undefined, onClick: () => setForm((p) => ({ ...p, is_smart_place: undefined })) },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={opt.onClick}
                          className={`py-3 rounded-xl border-2 text-sm font-semibold text-center transition-all ${
                            opt.isSelected
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.is_smart_place === true && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-green-800">어디까지 설정하셨나요?</p>
                        {(() => {
                          const answered = [hasIntro, hasRecentPost, hasFaq].filter(v => v !== undefined).length;
                          return answered < 3 ? (
                            <span className="text-sm text-amber-600 font-semibold">{answered}/3 답변됨</span>
                          ) : (
                            <span className="text-sm text-green-600 font-semibold">모두 답변됨</span>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-green-700 mb-2.5">있어요 / 없어요 중 하나를 선택하면 진단 점수가 정확해집니다</p>
                      <div className="space-y-1.5">
                        {[
                          { key: "has_intro", value: hasIntro, onChange: setHasIntro, label: "소개글 작성" },
                          { key: "has_recent_post", value: hasRecentPost, onChange: setHasRecentPost, label: "최근 7일 내 소식" },
                          { key: "has_faq", value: hasFaq, onChange: setHasFaq, label: "소개글 Q&A 포함" },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center gap-3 py-1.5 border-b border-green-100 last:border-b-0">
                            <span className={`flex-1 text-sm font-medium ${item.value === undefined ? "text-slate-700" : "text-slate-800"}`}>
                              {item.label}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => item.onChange(true)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                                  item.value === true
                                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                                    : "bg-white text-slate-400 border-slate-200 hover:border-green-400 hover:text-green-600"
                                }`}
                              >
                                있어요
                              </button>
                              <button
                                type="button"
                                onClick={() => item.onChange(false)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                                  item.value === false
                                    ? "bg-slate-100 text-slate-700 border-slate-400"
                                    : "bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600"
                                }`}
                              >
                                없어요
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {[hasIntro, hasRecentPost, hasFaq].some(v => v === undefined) && (
                        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2.5 border border-amber-200">
                          각 항목에 답해주세요 — 선택하지 않으면 기본값(없어요)으로 처리됩니다
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="trial-email"
                  className="block text-base font-semibold text-slate-700 mb-1"
                >
                  이메일{" "}
                  <span className="text-slate-500 font-normal">
                    (선택)
                  </span>
                </label>
                <input
                  id="trial-email"
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  입력하시면 스캔 완료 후 결과 요약을 바로 이메일로 보내드립니다.
                </p>
              </div>

              {/* 리뷰 붙여넣기 토글 */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                className="w-full text-sm text-slate-600 hover:text-slate-700 flex items-center justify-center gap-1 py-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                {showAdvanced ? (
                  <><ChevronUp className="w-4 h-4" /> 접기</>
                ) : (
                  <><ChevronDown className="w-4 h-4" /> 손님 리뷰 붙여넣기 — 키워드 분석 정밀도 향상 (선택)</>
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label
                      htmlFor="trial-review-text"
                      className="block text-base font-medium text-gray-700 mb-1"
                    >
                      손님 리뷰 1~3개 붙여넣기{" "}
                      <span className="text-gray-500 font-normal">
                        (선택 — 건너뛰어도 됩니다)
                      </span>
                    </label>
                    <textarea
                      id="trial-review-text"
                      rows={3}
                      placeholder={
                        "리뷰를 붙여넣으면 어떤 키워드가 부족한지 정확하게 알 수 있습니다.\n예) 분위기 좋고 음식도 맛있어요. 주차공간이 넓어서 좋았습니다."
                      }
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      없으면 업종 평균으로 추정합니다.
                    </p>
                  </div>
                </div>
              )}

              {cooldownMs > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-3">
                  <p className="text-sm text-amber-800 font-medium">
                    오늘 무료 체험 3회를 모두 이용했습니다.{" "}
                    <strong>{formatCooldown(cooldownMs)}</strong> 후 다시 이용할 수 있습니다.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link
                      href="/signup"
                      className="flex-1 text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      회원가입하고 매주 자동 진단 받기 →
                    </Link>
                    <Link
                      href="/login"
                      className="flex-1 text-center py-2.5 border border-blue-600 text-blue-600 hover:bg-blue-50 text-sm font-medium rounded-lg transition-colors"
                    >
                      이미 계정이 있어요
                    </Link>
                  </div>
                </div>
              )}
              {error && !cooldownMs && (
                <p className="text-red-500 text-sm" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={cooldownMs > 0 || searchLoading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldownMs > 0
                  ? `${formatCooldown(cooldownMs)} 후 다시 이용 가능`
                  : searchLoading
                    ? "내 가게 찾는 중..."
                    : inlineSelectedCandidate
                      ? `${inlineSelectedCandidate.title} 진단 시작 →`
                      : businessType === "location_based" &&
                          !isStartupMode &&
                          !forceManualEntry &&
                          form.business_name.trim()
                        ? "내 가게 찾기 →"
                        : "내 가게 온라인 현황 무료 진단"}
              </button>
            </form>
          </div>
        )}

        {/* 4단계: 검색 후보 선택 (place 매칭) */}
        {step === "search" && (
          <SearchStep
            candidates={candidates}
            searchLoading={searchLoading}
            searchError={searchError}
            selectedCandidateKey={selectedCandidateKey}
            forceManualEntry={forceManualEntry}
            onPlaceSelect={onPlaceSelect}
            onSkipPlaceMatch={onSkipPlaceMatch}
            onBack={() => setStep("info")}
            getCandidateKey={getCandidateKey}
          />
        )}
      </div>
    </>
  );
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────
function formatCooldown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

// ── 검색 후보 선택 sub-step ────────────────────────────────────────────
interface SearchStepProps {
  candidates: TrialBusinessCandidate[];
  searchLoading: boolean;
  searchError: string;
  selectedCandidateKey: string | null;
  forceManualEntry: boolean;
  onPlaceSelect: (c: TrialBusinessCandidate) => Promise<void>;
  onSkipPlaceMatch: () => Promise<void>;
  onBack: () => void;
  getCandidateKey: (c: TrialBusinessCandidate) => string;
}

function SearchStep({
  candidates,
  searchLoading,
  searchError,
  selectedCandidateKey,
  forceManualEntry,
  onPlaceSelect,
  onSkipPlaceMatch,
  onBack,
  getCandidateKey,
}: SearchStepProps) {
  return (
    <div>
      <button
        onClick={onBack}
        aria-label="입력 정보 다시 보기"
        className="text-base text-gray-500 hover:text-gray-600 mb-4 flex items-center gap-1"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" /> 입력 정보 다시 보기
      </button>

      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
        이 중에 내 가게가 있나요?
      </h2>
      <p className="text-sm md:text-base text-gray-500 mb-5 leading-relaxed">
        네이버 지역검색 결과입니다. 정확히 일치하는 가게를 선택하면 실제 데이터로
        진단해 드립니다.
      </p>

      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{searchError}</p>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="space-y-2.5 mb-5">
          {candidates.slice(0, 5).map((c) => {
            const cardKey = getCandidateKey(c);
            const isSelected = selectedCandidateKey === cardKey;
            const hasRealId = !!(c.naver_place_id || "").trim();
            return (
              <button
                key={cardKey}
                type="button"
                onClick={() => onPlaceSelect(c)}
                disabled={!!selectedCandidateKey}
                aria-label={`${c.title} 선택`}
                className={`w-full text-left bg-white border-2 rounded-xl p-4 md:p-5 transition-all hover:border-blue-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected ? "border-blue-500 bg-blue-50 shadow-md" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-base md:text-lg font-bold text-gray-900 leading-tight">
                      {c.title}
                    </p>
                    {c.category && (
                      <span className="inline-block mt-1.5 text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                        {c.category}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700"
                    }`}
                  >
                    {isSelected ? (
                      <><CheckCircle2 className="w-4 h-4" aria-hidden="true" /> 선택됨</>
                    ) : "이 가게 맞아요"}
                  </span>
                </div>
                {c.address && (
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{c.address}</span>
                  </p>
                )}
                {c.phone && (
                  <p className="text-sm md:text-base text-gray-500 mt-1 flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
                    <span>{c.phone}</span>
                  </p>
                )}
                {!hasRealId && (
                  <p className="text-sm text-gray-500 mt-2">
                    ※ 정보 자동 진단은 사용 불가 — 입력하신 체크박스 정보로 진단합니다
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {(candidates.length === 0 || forceManualEntry) && !searchLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-base text-blue-800 font-semibold mb-1">
            검색 결과가 없거나 내 가게가 보이지 않나요?
          </p>
          <p className="text-sm text-blue-700 leading-relaxed">
            입력하신 가게명·지역 정보로 직접 진단받을 수 있습니다.
            가게가 아직 네이버에 등록되지 않은 경우에도 점수와 개선 가이드를 받을 수
            있습니다.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onSkipPlaceMatch}
        disabled={!!selectedCandidateKey}
        className="w-full bg-white border-2 border-blue-300 text-blue-700 py-3 rounded-xl font-semibold text-base hover:bg-blue-50 hover:border-blue-400 transition-colors disabled:opacity-50"
      >
        {candidates.length > 0
          ? "내 가게가 없어요 — 입력한 정보로 그대로 진단받기"
          : "입력한 정보로 진단받기"}
      </button>

      <p className="text-sm text-gray-500 text-center mt-3">
        {selectedCandidateKey
          ? "선택한 가게로 진단을 시작합니다..."
          : "가게를 선택하거나 직접 진단받기 버튼을 눌러주세요"}
      </p>
    </div>
  );
}
