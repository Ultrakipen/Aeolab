"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  CATEGORY_MAP,
  FLAT_CATEGORY_GROUPS,
  FLAT_CATEGORY_MAP,
  tagsForFlat,
} from "@/lib/categories";
import { CATEGORY_ICON_MAP } from "@/lib/categoryIcons";
import { getUserGroup } from "@/lib/userGroup";
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
  } = props;

  return (
    <>
      <div
        id="trial-form"
        className={`max-w-2xl mx-auto px-4 ${step === "category" ? "pb-10" : "py-10"}`}
      >
        {/* ── 3단계 흐름 안내 ── */}
        {step !== "scanning" && step !== "search" && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                <span className="text-sm text-gray-700 font-medium">
                  네이버·ChatGPT 등 AI에서 내 가게가 검색되는지 확인{" "}
                  <span className="text-gray-500 font-normal">(30초)</span>
                </span>
              </div>
              <span
                className="hidden sm:block text-gray-500 text-lg font-light"
                aria-hidden="true"
              >
                →
              </span>
              <div className="flex items-center gap-2 flex-1">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                <span className="text-sm text-gray-700 font-medium">
                  부족한 키워드 확인 → 복사 버튼으로 스마트플레이스에 바로 사용
                </span>
              </div>
              <span
                className="hidden sm:block text-gray-500 text-lg font-light"
                aria-hidden="true"
              >
                →
              </span>
              <div className="flex items-center gap-2 flex-1">
                <span className="bg-blue-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold shrink-0">
                  3
                </span>
                <span className="text-sm text-gray-700 font-medium">
                  회원가입 후 7일 뒤 AI 검색 변화 자동 확인
                </span>
              </div>
            </div>
          </div>
        )}

        {step !== "scanning" && step !== "search" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[
              { key: "category", label: "업종" },
              { key: "tags", label: "서비스" },
              { key: "info", label: "정보 입력" },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${
                    step === s.key
                      ? "bg-blue-600 text-white"
                      : ["category", "tags", "info"].indexOf(step) > i
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span>{i + 1}</span>
                  <span>{s.label}</span>
                </div>
                {i < 2 && <div className="w-4 h-px bg-gray-300" aria-hidden="true" />}
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
            <p className="text-gray-500 text-center text-sm mb-6">
              가장 가까운 업종을 선택하세요
            </p>
            {/* 25개 평면 업종 */}
            <div className="space-y-5">
              {FLAT_CATEGORY_GROUPS.map((group) => (
                <div key={group.groupLabel}>
                  <p className="text-xs md:text-sm font-semibold text-slate-500 mb-2 px-1">
                    {group.groupLabel}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
                    {group.items.map((cat) => {
                      const cfg = CATEGORY_ICON_MAP[cat.value];
                      const Icon = cfg?.Icon;
                      const selected = selectedCategory === cat.value;
                      return (
                        <button
                          key={cat.value}
                          aria-label={`${cat.label} 업종 선택`}
                          onClick={() => {
                            setSelectedCategory(cat.value);
                            setSelectedTags([]);
                            setStep("tags");
                          }}
                          className={`
                            min-h-[88px] flex flex-col items-center justify-center gap-1.5 p-2.5 md:p-3 rounded-2xl border-2 cursor-pointer
                            transition-all duration-150 hover:scale-105 hover:shadow-md
                            ${
                              selected
                                ? `${cfg?.bg ?? "bg-blue-50"} ${cfg?.border ?? "border-blue-300"} shadow-sm`
                                : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                            }
                          `}
                        >
                          <div
                            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${selected ? (cfg?.bg ?? "bg-blue-100") : (cfg?.bg ?? "bg-gray-100")}`}
                          >
                            {Icon ? (
                              <Icon
                                className={`w-4.5 h-4.5 md:w-5 md:h-5 ${cfg?.text ?? "text-gray-500"}`}
                                strokeWidth={1.8}
                              />
                            ) : (
                              <span className="text-lg md:text-xl" aria-hidden="true">
                                🏪
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-sm md:text-base font-semibold text-center leading-tight break-keep ${selected ? (cfg?.text ?? "text-blue-600") : "text-gray-700"}`}
                          >
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
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
              const group = getUserGroup(selectedCategory, false);
              if (group === "INACTIVE") {
                return (
                  <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 mb-5">
                    <div className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
                      <div>
                        <p className="text-sm font-bold text-amber-900 mb-1">
                          이 업종은 네이버 AI 브리핑 대상이 아닙니다
                        </p>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          대신 <strong>ChatGPT·Gemini·Google AI</strong> 검색 노출을 중심으로 진단합니다.
                          네이버 지도·블로그 노출도 함께 확인합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              if (group === "LIKELY") {
                return (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 mb-5">
                    <div className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5" aria-hidden="true">ℹ️</span>
                      <div>
                        <p className="text-sm font-bold text-blue-900 mb-1">
                          현재 네이버 AI 브리핑 공식 대상 업종은 아닙니다
                        </p>
                        <p className="text-sm text-blue-800 leading-relaxed">
                          <strong>ChatGPT·Gemini·네이버 지도</strong> 노출 최적화를 중심으로 진단합니다.
                          네이버 플레이스 완성도와 리뷰 관리가 가장 효과적입니다.
                        </p>
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
            <div className="flex flex-wrap gap-2 mb-6">
              {tagsForFlat(selectedCategory).map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selectedTags.includes(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700">
                선택한 서비스: <strong>{selectedTags.join(", ")}</strong>
              </div>
            )}
            <button
              onClick={() => setStep("info")}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              다음 →
            </button>
            <button
              type="button"
              onClick={() => setStep("info")}
              className="text-sm text-gray-400 underline mt-2 block mx-auto"
            >
              건너뛰기
            </button>
          </div>
        )}

        {/* 3단계: 정보 입력 */}
        {step === "info" && (
          <div>
            <button
              onClick={() => setStep("tags")}
              aria-label="서비스 다시 선택"
              className="text-base text-gray-500 hover:text-gray-600 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> 서비스 다시 선택
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
                className={`text-sm px-3 py-1.5 rounded-full border-2 font-medium transition-all ${
                  isStartupMode
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-600"
                }`}
              >
                {isStartupMode ? "🚀 예비 창업자 모드" : "아직 가게가 없어요"}
              </button>
            </div>
            {isStartupMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-base font-semibold text-amber-800 mb-1">
                  🚀 예비 창업자 모드
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setBusinessType("location_based")}
                className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  businessType === "location_based"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                🏪 오프라인 매장
              </button>
              <button
                type="button"
                onClick={() => setBusinessType("non_location")}
                className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  businessType === "non_location"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                💻 배달·온라인·전문직
              </button>
            </div>

            <form onSubmit={onSearch} className="space-y-4">
              {!isStartupMode && (
                <div>
                  <label
                    htmlFor="trial-business-name"
                    className="block text-base font-medium text-gray-700 mb-1"
                  >
                    사업장 이름 *
                  </label>
                  <input
                    id="trial-business-name"
                    type="text"
                    required={!isStartupMode}
                    placeholder="사업장 이름을 입력하세요"
                    value={form.business_name}
                    onChange={(e) =>
                      setForm({ ...form, business_name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* 가게 소개 한 줄 */}
              <div>
                <label
                  htmlFor="trial-description"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  가게 소개 한 줄{" "}
                  <span className="text-gray-500 font-normal">(선택)</span>
                </label>
                <textarea
                  id="trial-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 20년 전통 손칼국수 전문점"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  maxLength={200}
                />
                <p className="text-sm text-gray-500 mt-1">
                  가게의 핵심 강점을 한 문장으로 표현해주세요 — AI 분석 시 가게를 더
                  정확하게 파악합니다
                </p>
              </div>

              <div>
                <label
                  htmlFor="trial-region"
                  className="block text-base font-medium text-gray-700 mb-1"
                >
                  지역
                  {businessType === "location_based" ? (
                    " *"
                  ) : (
                    <span className="text-gray-500 font-normal ml-1">(선택)</span>
                  )}
                </label>
                <input
                  id="trial-region"
                  type="text"
                  required={businessType === "location_based"}
                  placeholder={
                    businessType === "location_based"
                      ? "시·구·동 단위로 입력 (예: 수원시 팔달구)"
                      : "서울 강남 등 (비워두면 전국 검색)"
                  }
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="trial-extra-keyword"
                  className="block text-base font-medium text-gray-700 mb-1"
                >
                  추가 키워드 <span className="text-gray-500 font-normal">(선택)</span>
                </label>
                <input
                  id="trial-extra-keyword"
                  type="text"
                  placeholder="예: 주차 가능, 예약 운영, 포장 가능"
                  value={form.extra_keyword}
                  onChange={(e) =>
                    setForm({ ...form, extra_keyword: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  운영 방식이나 서비스 특징을 쉼표로 구분해 입력해주세요
                </p>
              </div>

              <div>
                <label
                  htmlFor="trial-email"
                  className="block text-base font-medium text-gray-700 mb-1"
                >
                  이메일{" "}
                  <span className="text-gray-500 font-normal">
                    (결과를 이메일로 받기, 선택)
                  </span>
                </label>
                <input
                  id="trial-email"
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 선택 입력 토글 */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                className="w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-2 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                {showAdvanced
                  ? "▲ 간단히 보기"
                  : "▼ 더 정확한 분석을 원하시면 (선택사항)"}
              </button>

              {showAdvanced && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-500">
                    아래 정보를 추가하면 더 정확한 분석이 가능합니다
                  </p>

                  {businessType === "location_based" && forceManualEntry && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-base font-semibold text-green-800 mb-1">
                        📍 네이버 스마트플레이스 현황
                      </p>
                      <p className="text-sm text-green-700 mb-3">
                        체크한 항목은 네이버 AI 브리핑 점수에 즉시 반영됩니다. (가게가
                        검색되면 자동 진단으로 대체됩니다)
                      </p>
                      <div className="space-y-2.5">
                        <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-green-400 transition-colors">
                          <input
                            type="checkbox"
                            checked={form.is_smart_place ?? false}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                is_smart_place: e.target.checked,
                              }))
                            }
                            className="w-5 h-5 rounded accent-green-500"
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              네이버 스마트플레이스에 등록되어 있습니다
                            </p>
                            <p className="text-sm text-gray-500">
                              네이버 지도·플레이스에 가게 정보가 등록된 경우 체크
                            </p>
                          </div>
                        </label>
                        {[
                          {
                            id: "has_faq",
                            checked: hasFaq,
                            onChange: setHasFaq,
                            label: "소개글에 Q&A 섹션을 넣었어요",
                            badge: "+30점",
                            desc: "소개글 안 Q&A는 AI 인용 후보 경로 중 하나입니다",
                            hint: "소개글 Q&A 포함 여부",
                          },
                          {
                            id: "has_recent_post",
                            checked: hasRecentPost,
                            onChange: setHasRecentPost,
                            label: "최근 7일 내 '소식'을 업데이트했어요",
                            badge: "+20점",
                            desc: "AI가 '지금 운영 중'으로 인식하는 최신성 신호",
                            hint: "최신성 점수에 영향",
                          },
                          {
                            id: "has_intro",
                            checked: hasIntro,
                            onChange: setHasIntro,
                            label: "가게 소개글을 작성했어요",
                            badge: "+10점",
                            desc: "키워드 기반 영구 랭킹 신호",
                            hint: "키워드 기반 영구 효과",
                          },
                        ].map((item) => (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={(e) => item.onChange(e.target.checked)}
                              className="mt-0.5 w-4 h-4 accent-green-600 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base text-gray-800 group-hover:text-green-700 transition-colors">
                                  {item.label}
                                </span>
                                <span className="text-sm font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                  {item.badge}
                                </span>
                                {item.hint && (
                                  <span className="text-sm text-gray-500 ml-1">
                                    ({item.hint})
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {item.desc}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

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
                      회원가입하고 매일 자동 진단 받기 →
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
                className={`w-full text-left bg-white border-2 rounded-2xl p-4 md:p-5 transition-all hover:border-blue-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
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
                    className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-xl ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700"
                    }`}
                  >
                    {isSelected ? "✓ 선택됨" : "이 가게 맞아요"}
                  </span>
                </div>
                {c.address && (
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed flex items-start gap-1.5">
                    <span className="shrink-0" aria-hidden="true">
                      📍
                    </span>
                    <span>{c.address}</span>
                  </p>
                )}
                {c.phone && (
                  <p className="text-sm md:text-base text-gray-500 mt-1 flex items-center gap-1.5">
                    <span aria-hidden="true">📞</span>
                    <span>{c.phone}</span>
                  </p>
                )}
                {!hasRealId && (
                  <p className="text-xs text-gray-500 mt-2">
                    ※ 정보 자동 진단은 사용 불가 — 입력하신 체크박스 정보로 진단합니다
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {(candidates.length === 0 || forceManualEntry) && !searchLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm md:text-base text-amber-800 font-semibold mb-1">
            검색 결과가 없거나 내 가게가 보이지 않나요?
          </p>
          <p className="text-sm text-amber-700 leading-relaxed">
            검색되지 않으면 입력하신 가게명·지역 정보로 직접 진단받을 수 있습니다.
            가게가 아직 네이버에 등록되지 않은 경우에도 점수와 개선 가이드를 받을 수
            있습니다.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onSkipPlaceMatch}
        disabled={!!selectedCandidateKey}
        className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold text-sm md:text-base hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50"
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
