"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CATEGORY_MAP,
  FLAT_CATEGORY_MAP,
  flatToGroup,
} from "@/lib/categories";
import { getUserGroup, GROUP_MESSAGES } from "@/lib/userGroup";
import AIProblemDiagnosis from "@/components/trial/AIProblemDiagnosis";
import FactEvidenceSection from "@/components/trial/FactEvidenceSection";
import OneLineConclusion from "@/components/trial/OneLineConclusion";
import TodayOneAction from "@/components/trial/TodayOneAction";
import SubscriptionValueCompare from "@/components/trial/SubscriptionValueCompare";
import MoreDetailsAccordion from "@/components/trial/MoreDetailsAccordion";
import ClaimGate from "@/components/trial/ClaimGate";
import KakaoShareButton from "@/components/common/KakaoShareButton";
import TextShareButton from "@/components/trial/TextShareButton";
import CompetitorGapHighlightCard from "@/components/trial/CompetitorGapHighlightCard";
import type {
  TrialScanResult,
  TrialPlaceMatch,
  TrialSmartPlaceCheck,
  TrialAIEvidence,
} from "@/types";
import type { TrialResultProps } from "./TrialSharedTypes";
import { trackTrialComplete } from "@/lib/analytics";

// ── 항목별 상세 안내 ──────────────────────────────────────────────────
const BREAKDOWN_INFO: Record<
  string,
  {
    label: string;
    icon: string;
    what: string;
    low: string;
    high: string;
    tip: string;
    improve: string;
    trialNote?: string;
  }
> = {
  exposure_freq: {
    label: "AI 검색 노출",
    icon: "🔍",
    what:
      "ChatGPT에 \"추천해줘\"라고 물어 내 가게 이름이 나오는지 확인합니다. (정식 플랜은 4개 AI — Gemini·ChatGPT 각 50회(총 100회)·네이버 AI 브리핑·Google AI Overview — 를 동시에 확인합니다)",
    low: "이번 테스트에서 AI가 내 가게를 언급하지 않았습니다. 아직 AI가 내 가게를 모를 수 있습니다.",
    high: "이번 테스트에서 AI가 내 가게를 언급했습니다.",
    tip: "정식 플랜에서는 더 많은 AI를 주기적으로 반복 확인해 정확한 노출 현황을 측정합니다.",
    improve: "네이버 스마트플레이스 소개글 안 Q&A 추가 + 리뷰 답변 키워드 삽입",
  },
  review_quality: {
    label: "리뷰 평판",
    icon: "⭐",
    what:
      "네이버·카카오맵 등에 등록된 리뷰 수와 평점입니다. AI는 단순 별점보다 '돌잔치 촬영 잘됐어요'처럼 업종 키워드가 포함된 구체적인 리뷰가 있는 가게를 더 자주 추천합니다.",
    low: "리뷰 수가 적거나 키워드 없는 단순 별점 위주라 AI가 신뢰도 있는 가게로 인식하기 어렵습니다.",
    high: "리뷰와 평점이 충분하고 키워드가 포함돼 AI가 신뢰할 수 있는 가게로 인식합니다.",
    tip: "리뷰 키워드 분석으로 어떤 단어가 AI 추천에 영향을 주는지 확인합니다.",
    improve: "단순 별점보다 키워드 포함 구체적 리뷰 유도 + 리뷰 답변에 핵심 키워드 삽입",
    trialNote:
      "체험 스캔에서는 실제 리뷰 수·평점을 직접 수집하지 않습니다. 정식 스캔에서 실제 데이터로 정확히 측정됩니다.",
  },
  schema_score: {
    label: "온라인 정보 정리",
    icon: "📋",
    what:
      "내 가게의 영업시간·전화번호·위치·메뉴가 인터넷에 얼마나 잘 정리돼 있는지입니다. AI는 정리가 잘 된 가게를 더 자주 추천합니다.",
    low: "가게 정보가 인터넷에 충분히 등록되지 않아 AI가 정확한 정보를 파악하기 어렵습니다.",
    high: "가게 기본 정보가 잘 정리돼 있어 AI가 쉽게 인식합니다.",
    tip: "홈페이지·네이버플레이스·카카오맵에 빠진 정보를 자동으로 찾아드립니다.",
    improve: "AI 검색 최적화 정보 + Open Graph 태그 추가",
    trialNote:
      "체험 스캔에서는 온라인 정보 완성도를 완전히 측정하기 어렵습니다. 정식 스캔에서 네이버플레이스·웹사이트 데이터를 기반으로 측정됩니다.",
  },
  online_mentions: {
    label: "온라인 언급 수",
    icon: "📢",
    what:
      "네이버 블로그에서 내 가게 후기가 몇 건인지입니다. 후기가 많을수록 손님이 더 신뢰하고 AI도 더 자주 추천합니다.",
    low: "블로그 후기가 적어 손님이 검색할 때 경쟁 가게 후기가 먼저 보입니다.",
    high: "블로그 후기가 충분해 손님이 검색할 때 내 가게를 발견하기 쉽습니다.",
    tip: "Basic에서 경쟁사 대비 블로그 후기 격차와 키워드별 분석을 제공합니다.",
    improve: "블로그 포스팅 + 소식 업데이트 주 1회",
  },
  info_completeness: {
    label: "기본 정보 완성도",
    icon: "📍",
    what: "전화번호·주소·영업시간·메뉴판 등 기본 정보가 얼마나 등록되어 있는지입니다.",
    low: "전화번호·영업시간 등 기본 정보가 일부 누락되어 있습니다.",
    high: "기본 정보가 모두 잘 등록되어 있습니다.",
    tip: "어떤 정보가 빠져 있는지 항목별로 체크리스트를 제공합니다.",
    improve: "사업장 정보 완성도 100% 채우기",
    trialNote:
      "체험 스캔에서 입력하지 않은 항목은 측정되지 않습니다. 사업장 등록 후 정확한 완성도를 확인하세요.",
  },
  content_freshness: {
    label: "최근 활동",
    icon: "🗓️",
    what: "최근에 새 리뷰나 소식이 올라오면 AI가 현재 운영 중인 가게로 인식합니다.",
    low: "최근 활동이 없으면 AI가 가게가 문을 닫은 것으로 판단할 수 있습니다.",
    high: "최근 활동이 확인되어 AI가 현재 운영 중인 가게로 인식합니다.",
    tip: "리뷰 요청 타이밍과 콘텐츠 업데이트 주기를 가이드로 제공합니다.",
    improve: "월 2회 이상 업데이트로 최신성 유지",
  },
};

// 업종별 벤치마크 기본값
const CATEGORY_BENCHMARKS: Record<string, { avg: number; top30: number }> = {
  food: { avg: 52, top30: 68 },
  cafe: { avg: 48, top30: 65 },
  health: { avg: 58, top30: 75 },
  beauty: { avg: 55, top30: 72 },
  education: { avg: 53, top30: 70 },
  professional: { avg: 50, top30: 67 },
  shopping: { avg: 44, top30: 61 },
  living: { avg: 47, top30: 63 },
  culture: { avg: 45, top30: 62 },
  accommodation: { avg: 51, top30: 68 },
};

const FAQ_PREVIEW: Record<string, { q: string; a: string }> = {
  restaurant: {
    q: "단체 예약이 가능한가요?",
    a: "네, 10인 이상 단체 예약은 전화로 사전 문의 주시면 자리를 준비해 드립니다. 주차는 건물 뒤편 무료 주차장을 이용하실 수 있습니다.",
  },
  cafe: {
    q: "테이크아웃 되나요?",
    a: "네, 모든 음료 테이크아웃 가능합니다. 텀블러 지참 시 300원 할인해 드립니다.",
  },
  hair: {
    q: "예약 없이 방문해도 되나요?",
    a: "당일 예약도 가능하지만 대기가 생길 수 있어요. 네이버 예약으로 미리 잡아오시면 바로 안내해 드립니다.",
  },
  beauty: {
    q: "예약 없이 방문해도 되나요?",
    a: "당일 예약도 가능하지만 대기가 생길 수 있어요. 네이버 예약으로 미리 잡아오시면 바로 안내해 드립니다.",
  },
  clinic: {
    q: "예약 없이 방문 진료 가능한가요?",
    a: "당일 예약도 가능하지만 대기 시간이 길어질 수 있습니다. 네이버 예약 또는 전화 예약을 권장합니다.",
  },
  academy: {
    q: "체험 수업이 가능한가요?",
    a: "네, 첫 방문 고객께는 1회 무료 체험 수업을 제공합니다. 사전에 연락 주시면 일정을 잡아드립니다.",
  },
  fitness: {
    q: "하루 체험이 가능한가요?",
    a: "네, 1일 체험권을 운영합니다. 방문 전 전화 또는 네이버 예약으로 신청해 주세요.",
  },
  default: {
    q: "주차 가능한가요?",
    a: "네, 건물 내 무료 주차 가능합니다. 2시간까지 무료이며 그 이후는 10분당 500원입니다.",
  },
};

// ── 컴포넌트 본체 ─────────────────────────────────────────────────────
export default function TrialResultStep(props: TrialResultProps) {
  const {
    result,
    selectedCategory,
    selectedTags,
    form,
    businessType,
    hasFaq,
    hasRecentPost,
    hasIntro,
    isLoggedIn,
    apiBenchmark,
    naverCheckState,
    naverCheckResult,
    naverCheckError,
    onNaverBriefingCheck,
    onNaverCheckReset,
    onSaveTrialData,
    onReset,
  } = props;

  // 점수 계산 (page.tsx에서 옮겨옴)
  const _totalScore = Math.round(result.score.total_score ?? 0);
  const track1 =
    result.track1_score ??
    result.score.track1_score ??
    result.score.naver_channel_score ??
    Math.round(_totalScore * 0.6);
  const track2 =
    result.track2_score ??
    result.score.track2_score ??
    result.score.global_channel_score ??
    Math.round(_totalScore * 0.4);
  const unified = result.score.unified_score ?? result.score.total_score;
  const gs = result.growth_stage;
  const gsLabel = result.growth_stage_label ?? gs?.stage_label ?? "성장 중";
  const missingKws = result.top_missing_keywords ?? [];
  const pioneerKws = result.pioneer_keywords ?? [];
  const faqText = result.faq_copy_text ?? null;

  const score = Math.round(
    result.score.total_score ?? result.score.unified_score ?? 0,
  );
  const naver = result.naver;
  const blogCount = naver?.blog_mentions ?? 0;
  const smartPlaceStatus: boolean | null =
    form.is_smart_place === true
      ? true
      : form.is_smart_place === false
        ? null
        : naver?.is_smart_place === true
          ? true
          : null;
  const isSmartPlace = smartPlaceStatus === true;

  const inBriefing: boolean | null =
    naver?.in_briefing !== undefined && naver?.in_briefing !== null
      ? Boolean(naver.in_briefing)
      : null;
  const briefingConfidence =
    inBriefing !== null ? "confirmed" : track1 >= 40 ? "likely" : "unlikely";

  const benchmarkData =
    CATEGORY_BENCHMARKS[flatToGroup(selectedCategory)] ??
    CATEGORY_BENCHMARKS[selectedCategory] ?? { avg: 50, top30: 65 };
  const apiResult = result as TrialScanResult & {
    benchmark?: { avg: number; top30: number };
  };
  const benchmarkAvg = apiResult.benchmark?.avg ?? benchmarkData.avg;
  const isEstimatedBenchmark = !apiResult.benchmark?.avg;

  const breakdownEntries = result.score.breakdown
    ? Object.entries(result.score.breakdown)
        .map(([key, val]) => ({
          key,
          val: Math.round(Number(val)),
          info: BREAKDOWN_INFO[key],
        }))
        .filter((e) => e.info)
    : [];

  const visitorReach =
    score >= 90 ? 9 : score >= 70 ? 7 : score >= 50 ? 5 : score >= 35 ? 3 : 1;

  const stageColorMap: Record<string, string> = {
    survival: "bg-red-50 border-red-200 text-red-800",
    stability: "bg-amber-50 border-amber-200 text-amber-800",
    growth: "bg-blue-50 border-blue-200 text-blue-800",
    dominance: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };
  const gsStage = (typeof gs === "string" ? gs : gs?.stage) ?? "stability";
  const gsData = typeof gs === "object" && gs !== null ? gs : null;
  const stageColorClass = stageColorMap[gsStage] ?? "bg-gray-50 border-gray-200 text-gray-800";

  const chatgptResult = (
    result as { chatgpt_result?: { mentioned?: boolean; excerpt?: string } }
  ).chatgpt_result;
  const chatgptMentioned = chatgptResult?.mentioned;
  const chatgptExcerpt = chatgptResult?.excerpt;

  const naverChannelScore = result.score.naver_channel_score ?? track1;
  const globalChannelScore = result.score.global_channel_score ?? track2;

  // GA4: trial_complete — 결과 화면 첫 진입 시 1회 발화
  useEffect(() => {
    const trialId = (result as { trial_id?: string }).trial_id;
    trackTrialComplete({
      trial_id: trialId,
      category: selectedCategory,
      score,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Sticky 상단 CTA — 비로그인 전용, 모바일에서는 하단 배너만 표시 */}
      {!isLoggedIn && (
        <div className="hidden md:flex sticky top-0 z-40 bg-blue-600 text-white px-4 py-3 items-center justify-between gap-3 shadow-md">
          <p className="text-sm font-medium leading-tight">
            이 결과를 기반으로 매주 자동 진단 + 경쟁사 비교 + 개선 가이드 — 무료 회원가입
          </p>
          <Link
            href="/signup"
            onClick={onSaveTrialData}
            className="shrink-0 bg-white text-blue-600 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            회원가입
          </Link>
        </div>
      )}

      <StickySignupBanner isLoggedIn={isLoggedIn} onSave={onSaveTrialData} />

      <div className="max-w-5xl mx-auto py-6 px-4 pb-28">
        {/* 체험 기준 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
          <span className="text-blue-500 text-base shrink-0 mt-0.5" aria-hidden="true">
            ℹ️
          </span>
          <p className="text-sm text-blue-700 leading-relaxed">
            <strong>무료 체험 결과 (빠른 확인 기준 — Gemini 10회 측정)</strong> — 정식
            플랜에서는 Gemini·ChatGPT 각 50회 (총 100회) 반복 측정 + 매주 자동 추적으로 더 정확한 결과를 제공합니다.
          </p>
        </div>

        {/* 그룹별 헤드라인 + 뱃지 — getUserGroup 단일 소스 사용 */}
        {(() => {
          // isFranchise 정보가 있으면 반영 (form 필드가 없으면 false 폴백)
          const isFranchise = (form as { is_franchise?: boolean }).is_franchise === true;
          const group = getUserGroup(selectedCategory, isFranchise);
          const msg = GROUP_MESSAGES[group];
          const bgMap: Record<string, string> = {
            ACTIVE:    "bg-green-50 border-green-200",
            LIKELY:    "bg-blue-50 border-blue-200",
            INACTIVE:  "bg-amber-50 border-amber-200",
            franchise: "bg-purple-50 border-purple-200",
          };
          return (
            <>
              {/* INACTIVE/franchise 전용 — 그룹 카드 위에 별도 강조 배너 */}
              {(group === "INACTIVE" || group === "franchise") && (
                <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg" aria-hidden="true">⚠️</span>
                    <p className="text-sm md:text-base font-bold text-amber-900">
                      {group === "franchise"
                        ? "프랜차이즈 가맹점은 네이버 AI 브리핑 대상에서 제외됩니다"
                        : "현재 네이버 AI 브리핑 대상 업종이 아닙니다"}
                    </p>
                  </div>
                  <p className="text-sm text-amber-800 leading-relaxed mb-2 break-keep">
                    {group === "franchise"
                      ? "네이버 본사 정책에 따라 프랜차이즈 가맹점은 AI 브리핑 노출이 제한됩니다. 대신 ChatGPT·Google AI 노출 최적화에 집중합니다."
                      : "ChatGPT·Gemini·Google AI 검색에서 먼저 찾히도록 최적화하는 것이 가장 효과적입니다."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "ChatGPT", desc: "Google 데이터 기반" },
                      { label: "Gemini", desc: "Google 검색 혼합" },
                      { label: "Google AI", desc: "구글 SGE 인용" },
                    ].map((ch) => (
                      <span
                        key={ch.label}
                        className="inline-flex items-center gap-1 text-xs bg-white border border-amber-300 rounded-full px-2.5 py-1 text-amber-900 font-medium"
                      >
                        <span className="font-bold">{ch.label}</span>
                        <span className="text-amber-700">{ch.desc}</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    Google 비즈니스 프로필 등록 → 홈페이지 JSON-LD 스키마 → 블로그·뉴스 언급 순으로
                    개선하면 ChatGPT·Gemini에서 검색될 가능성이 높아집니다.
                  </p>
                </div>
              )}

              {/* LIKELY 업종 AI탭 베타 확대 안내 */}
              {group === "LIKELY" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                  <p className="text-sm font-semibold text-amber-900 mb-1">2026 AI탭 베타 공개·확대 진행 중</p>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    이 업종은 네이버 AI 브리핑 확대 예상 대상입니다. 2026-04-27 네이버플러스 우선 베타 공개 후
                    상반기 전체 확대 예정입니다. ChatGPT·Gemini·Google AI 노출 개선과 함께 준비하시는 것을 권장합니다.
                  </p>
                </div>
              )}

              {/* 그룹 카드 */}
              <div className={`rounded-xl border px-4 py-3 mb-4 ${bgMap[group]}`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${msg.badgeColor}`}>
                    {msg.badge}
                  </span>
                  <span className="text-sm text-gray-500">
                    {FLAT_CATEGORY_MAP[selectedCategory]?.label ?? selectedCategory}
                  </span>
                </div>
                <p className="text-sm md:text-base text-gray-900 font-semibold leading-snug break-keep mb-1">
                  {msg.headline}
                </p>
                <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
                  {msg.sub}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed break-keep mt-2 font-medium">
                  ※ 그룹 무관: <span className="text-blue-700">네이버 키워드 검색 노출 측정</span>·블로그·스마트플레이스·지도 통합 관리는 모든 업종에 동일하게 제공됩니다 (v3.1 점수 모델).
                </p>
              </div>
            </>
          );
        })()}

        {/* 섹션 1 — 사실 증거 */}
        <FactEvidenceSection
          chatgptResult={
            (result as { chatgpt_result?: { mentioned?: boolean; excerpt?: string } })
              .chatgpt_result ?? null
          }
          naver={result.naver ?? null}
          exposureFreq={result.score?.breakdown?.exposure_freq}
          totalSamples={10}
        />

        {result.place_match && <PlaceMatchCard match={result.place_match} />}
        {result.smart_place_check && (
          <SmartPlaceCheckCard check={result.smart_place_check} />
        )}
        {result.ai_evidence && <AIEvidenceCard evidence={result.ai_evidence} />}

        {/* 섹션 2 — 한 줄 결론 */}
        <OneLineConclusion
          visitorReach={visitorReach}
          gsLabel={gsLabel}
          benchmarkAvg={benchmarkAvg}
          isEstimatedBenchmark={isEstimatedBenchmark}
          myScore={score}
          categoryLabel={
            FLAT_CATEGORY_MAP[selectedCategory]?.label ??
            CATEGORY_MAP[selectedCategory]?.label ??
            selectedCategory
          }
          track1={track1}
          track2={track2}
          unified={unified ?? score}
          analyzedKeyword={
            selectedTags[0] ||
            (form.extra_keyword || "").trim() ||
            FLAT_CATEGORY_MAP[selectedCategory]?.label ||
            CATEGORY_MAP[selectedCategory]?.label ||
            "업종 키워드"
          }
        />

        {/* 섹션 3 — 매주 받으려면 (OneLineConclusion 바로 아래로 이동) */}
        <SubscriptionValueCompare isLoggedIn={isLoggedIn} onSave={onSaveTrialData} />

        {/* Trial Conversion Funnel — 30일 보관 게이트 (비로그인만, OneLineConclusion 바로 아래로 이동) */}
        {!isLoggedIn && (
          <ClaimGate
            trialId={result.trial_id}
            initialEmail={form.email}
          />
        )}

        {/* 경쟁 업체 갭 강조 카드 */}
        {apiBenchmark && apiBenchmark.avg_score > 0 && (
          <CompetitorGapHighlightCard
            myScore={Math.round(result.score.total_score)}
            avgScore={apiBenchmark.avg_score}
            top10Score={apiBenchmark.top10_score}
            category={selectedCategory}
            region={form.region}
          />
        )}

        {/* 섹션 4 — 오늘 5분 안에 할 일 */}
        <TodayOneAction
          isSmartPlace={isSmartPlace}
          missingKws={missingKws}
          hasFaq={hasFaq}
          inBriefing={inBriefing}
          faqText={faqText}
          selectedTags={selectedTags}
          categoryLabel={
            FLAT_CATEGORY_MAP[selectedCategory]?.label ??
            CATEGORY_MAP[selectedCategory]?.label ??
            selectedCategory
          }
          userGroup={getUserGroup(
            selectedCategory,
            (form as { is_franchise?: boolean }).is_franchise === true,
          )}
        />

        {/* 잠긴 경쟁사 카드 */}
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 mb-4 relative overflow-hidden">
          <div className="absolute inset-0 backdrop-blur-sm bg-white/60 flex flex-col items-center justify-center z-10 rounded-2xl">
            <span className="text-2xl mb-2" aria-hidden="true">
              🔒
            </span>
            <p className="text-sm md:text-base font-bold text-gray-800 text-center px-4">
              인근 경쟁 가게와 비교하려면 Basic 플랜이 필요합니다
            </p>
            <p className="text-sm text-gray-500 mt-1 text-center px-4">
              <span className="text-emerald-600 font-semibold">첫 달 4,950원</span> ·
              이후 월 9,900원 · 언제든 해지
            </p>
            <a
              href="/signup"
              className="mt-3 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              무료로 시작하기
            </a>
          </div>
          <p className="text-sm font-semibold text-gray-500 mb-3">
            📊 인근 경쟁 가게 AI 노출 비교
          </p>
          <div className="space-y-2">
            {["경쟁 가게 A", "경쟁 가게 B", "경쟁 가게 C"].map((name, i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-24 truncate">{name}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${i === 0 ? "bg-emerald-400 w-3/4" : i === 1 ? "bg-yellow-400 w-1/2" : "bg-red-300 w-1/4"}`}
                  />
                </div>
                <span className="text-sm text-gray-500">
                  {i === 0 ? "높음" : i === 1 ? "보통" : "낮음"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 더 자세히 보기 */}
        <MoreDetailsAccordion>
          {/* 손님이 가게를 찾는 과정 */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
              <p className="text-base md:text-lg font-bold text-gray-800">
                손님이 가게를 찾는 과정
              </p>
              {naver?.search_query && (
                <p className="text-sm text-gray-500 mt-0.5">
                  &ldquo;{naver.search_query}&rdquo; 로 검색했을 때
                </p>
              )}
            </div>

            {/* STEP 1 */}
            <div className="px-4 md:px-6 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p className="text-sm md:text-base font-semibold text-gray-700">
                  네이버 지도·플레이스에서 가게 목록을 봅니다
                </p>
              </div>
              <div className="space-y-2 ml-8">
                {(() => {
                  const naverComps = (
                    naver as {
                      naver_competitors?: {
                        rank: number;
                        name: string;
                        address?: string;
                      }[];
                    } | null
                  )?.naver_competitors;
                  if (naverComps && naverComps.length > 0) {
                    return naverComps.slice(0, 5).map((comp) => {
                      const isMe = form.business_name
                        ? comp.name.includes(form.business_name) ||
                          form.business_name.includes(comp.name)
                        : comp.rank === (naver?.my_rank ?? -1);
                      return (
                        <div
                          key={comp.rank}
                          className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${isMe ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                              comp.rank === 1
                                ? "bg-yellow-300 text-yellow-900"
                                : comp.rank === 2
                                  ? "bg-gray-300 text-gray-700"
                                  : comp.rank === 3
                                    ? "bg-orange-200 text-orange-800"
                                    : "bg-white text-gray-500 border border-gray-200"
                            }`}
                          >
                            {comp.rank}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-sm md:text-base font-medium ${isMe ? "text-blue-700" : "text-gray-800"}`}
                              >
                                {comp.name}
                              </span>
                              {isMe && (
                                <span className="text-sm bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                                  내 가게
                                </span>
                              )}
                            </div>
                            {comp.address && (
                              <p className="text-sm text-gray-500 truncate mt-0.5">
                                {comp.address}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    });
                  }
                  if (naver?.my_rank) {
                    return (
                      <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 bg-blue-50 border border-blue-200">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            naver.my_rank <= 3
                              ? "bg-yellow-300 text-yellow-900"
                              : "bg-blue-200 text-blue-800"
                          }`}
                        >
                          {naver.my_rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm md:text-base font-medium text-blue-700">
                              {form.business_name || "내 가게"}
                            </span>
                            <span className="text-sm bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                              내 가게
                            </span>
                          </div>
                          <p className="text-sm text-blue-500 mt-0.5">
                            네이버 플레이스 {naver.my_rank}위
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="text-sm text-gray-500 py-2 ml-1">
                      네이버 플레이스 순위 데이터를 수집 중입니다.
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* STEP 2: 블로그 후기 비교 */}
            {naver && naver.top_competitor_name && (
              <div className="px-4 md:px-6 py-4 border-b border-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <p className="text-sm md:text-base font-semibold text-gray-700">
                    블로그 후기를 보고 어느 가게를 갈지 결정합니다
                  </p>
                </div>
                <div className="ml-8">
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <p className="text-sm md:text-base font-bold text-red-700 mb-3">
                      후기가 더 많은 경쟁 가게를 선택할 가능성이 높습니다
                    </p>
                    <div className="mb-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full bg-blue-500 inline-block"
                            aria-hidden="true"
                          />{" "}
                          내 가게
                        </span>
                        <span className="text-sm font-bold text-blue-700">
                          {blogCount}건
                        </span>
                      </div>
                      <div className="w-full bg-white rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-blue-500"
                          style={{
                            width: `${
                              naver.top_competitor_blog_count
                                ? Math.round(
                                    (blogCount / (naver.top_competitor_blog_count || 1)) *
                                      100,
                                  )
                                : 50
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full bg-gray-400 inline-block"
                            aria-hidden="true"
                          />
                          <span className="truncate max-w-[140px] md:max-w-[200px]">
                            {naver.top_competitor_name} (1위)
                          </span>
                        </span>
                        <span className="text-sm font-bold text-gray-600 shrink-0">
                          {naver.top_competitor_blog_count ?? 0}건
                        </span>
                      </div>
                      <div className="w-full bg-white rounded-full h-3">
                        <div className="h-3 rounded-full bg-gray-400 w-full" />
                      </div>
                    </div>
                    {(naver.top_competitor_blog_count ?? 0) > blogCount && (
                      <div className="mt-3 pt-3 border-t border-red-100">
                        <p className="text-sm text-red-500">
                          경쟁 1위보다{" "}
                          <strong>
                            {(naver.top_competitor_blog_count ?? 0) - blogCount}건
                          </strong>{" "}
                          적습니다. 리뷰 답변에 키워드를 넣으면 좁힐 수 있습니다.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            <div className="px-4 md:px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <p className="text-sm md:text-base font-semibold text-gray-700">
                  ChatGPT에 &ldquo;어디 좋아?&rdquo; 라고 물어봅니다
                </p>
              </div>
              <div className="ml-8">
                {chatgptMentioned === true ? (
                  <div className="bg-emerald-50 rounded-xl px-4 py-3 border-l-4 border-emerald-400">
                    <p className="text-sm md:text-base font-semibold text-emerald-700 mb-1">
                      ChatGPT에 내 가게가 나옵니다
                    </p>
                    {chatgptExcerpt && (
                      <p className="text-sm text-gray-600 leading-relaxed">
                        &ldquo;{chatgptExcerpt.slice(0, 120)}...&rdquo;
                      </p>
                    )}
                  </div>
                ) : chatgptMentioned === false ? (
                  <div className="bg-red-50 rounded-xl px-4 py-3 border-l-4 border-red-400">
                    <p className="text-sm md:text-base font-semibold text-red-700 mb-1">
                      ChatGPT에 아직 내 가게가 안 나옵니다
                    </p>
                    <p className="text-sm text-red-600">
                      Google 비즈니스 프로필 등록 + 홈페이지 정보 정리로 개선할 수
                      있습니다.
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-xl px-4 py-3 border-l-4 border-amber-300">
                    <p className="text-sm text-amber-700">ChatGPT 결과를 확인 중입니다.</p>
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
                  측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 네이버 AI 브리핑 노출 카드 */}
          {briefingConfidence === "confirmed" && inBriefing === true ? (
            <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 md:p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base md:text-lg font-bold text-emerald-800 leading-tight">
                    ✅ 네이버 AI 브리핑에 내 가게가 나옵니다
                  </p>
                  <p className="text-sm text-emerald-600 mt-0.5">
                    네이버 AI가 검색 결과 상단에서 내 가게를 소개하고 있습니다.
                  </p>
                </div>
              </div>
              {(naver as { briefing_text?: string } | null)?.briefing_text && (
                <div className="bg-emerald-100 border border-emerald-200 rounded-xl px-4 py-3 mb-3">
                  <p className="text-sm text-emerald-600 font-semibold mb-1">
                    실제 AI 브리핑 문장:
                  </p>
                  <p className="text-sm md:text-base text-emerald-900 leading-relaxed italic">
                    &ldquo;{(naver as { briefing_text?: string }).briefing_text}&rdquo;
                  </p>
                </div>
              )}
              <p className="text-sm text-emerald-700 leading-relaxed">
                → AI가 내 가게를 이렇게 소개하고 있습니다. 더 많은 키워드로 더 자주
                노출되도록 개선하세요.
              </p>
            </div>
          ) : briefingConfidence === "confirmed" && inBriefing === false ? (
            <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-4 md:p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base md:text-lg font-bold text-red-800 leading-tight">
                    ❌ 지금 네이버 AI 브리핑에 내 가게가 안 나옵니다
                  </p>
                </div>
              </div>
              {naver?.top_competitor_name && (
                <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 mb-3">
                  <p className="text-sm text-gray-500 font-semibold mb-1">
                    경쟁 1위{" "}
                    <span className="text-gray-800">{naver.top_competitor_name}</span>
                    은 이렇게 나옵니다:
                  </p>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed italic">
                    &ldquo;
                    {(naver as { top_competitor_briefing_text?: string })
                      .top_competitor_briefing_text ??
                      `${naver.top_competitor_name}는 ${FLAT_CATEGORY_MAP[selectedCategory]?.label ?? CATEGORY_MAP[selectedCategory]?.label ?? selectedCategory} 전문점으로, 리뷰 ${naver.top_competitor_blog_count ?? 0}건과 함께 ${form.region || "이 지역"}에서 AI가 추천하는 업체입니다.`}
                    &rdquo;
                  </p>
                </div>
              )}
              <p className="text-sm text-red-700 leading-relaxed">
                → 경쟁 가게는 AI 브리핑에 나오는데 내 가게는 빠져 있습니다.
                소개글 Q&A 추가로 6~8주 안에 개선 가능합니다.
              </p>
            </div>
          ) : briefingConfidence === "likely" ? (
            <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base md:text-lg font-bold text-amber-800 leading-tight">
                  네이버 AI 브리핑 노출 가능성 있음
                </p>
                <p className="text-sm md:text-base text-amber-700 mt-1 leading-relaxed">
                  점수를 더 높이면 정기적으로 노출될 수 있습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base md:text-lg font-bold text-red-800 leading-tight">
                  현재 네이버 AI 브리핑에 나오지 않습니다
                </p>
                <p className="text-sm md:text-base text-red-700 mt-1 leading-relaxed">
                  소개글 하단에 Q&A를 추가하면 노출 가능성이 높아집니다.
                </p>
              </div>
            </div>
          )}

          {/* 업종 벤치마크 비교 */}
          {apiBenchmark &&
            (() => {
              const myScore = Math.round(
                result.score.unified_score ?? result.score.total_score ?? 0,
              );
              const diff = Math.round(apiBenchmark.top10_score - myScore);
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-5">
                  <p className="text-sm md:text-base font-semibold text-blue-800 mb-3">
                    📊 이 지역 같은 업종과 비교하면
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs md:text-sm text-gray-500 mb-1">업종 평균</p>
                      <p className="text-2xl md:text-3xl font-bold text-gray-700">
                        {Math.round(apiBenchmark.avg_score)}점
                      </p>
                    </div>
                    <div className="bg-white rounded-xl py-2 border-2 border-blue-400">
                      <p className="text-xs md:text-sm text-blue-600 font-semibold mb-1">
                        내 가게 (오늘)
                      </p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-700">
                        {myScore}점
                      </p>
                    </div>
                    <div>
                      <p className="text-xs md:text-sm text-gray-500 mb-1">상위 10%</p>
                      <p className="text-2xl md:text-3xl font-bold text-emerald-600">
                        {Math.round(apiBenchmark.top10_score)}점
                      </p>
                    </div>
                  </div>
                  {diff > 0 ? (
                    <p className="text-sm md:text-base text-blue-700 mt-3 font-medium text-center leading-relaxed break-keep">
                      상위 10% 가게와{" "}
                      <span className="font-bold text-blue-900">{diff}점 차이</span>입니다.
                      가입하면 매주 이 격차를 어떻게 줄이는지 알려드립니다.
                    </p>
                  ) : (
                    <p className="text-sm md:text-base text-emerald-700 mt-3 font-medium text-center leading-relaxed break-keep">
                      이미 상위 10%에 속합니다! 가입해서 이 순위를 유지하세요.
                    </p>
                  )}
                </div>
              );
            })()}

          {/* 내가 입력한 키워드 */}
          {(() => {
            const myTags = selectedTags.filter(Boolean);
            const extraKw = (form.extra_keyword || "").trim();
            const extraList = extraKw ? extraKw.split(/[\s,]+/).filter(Boolean) : [];
            const allMyKws = [...myTags, ...extraList];
            const hasPioneers = pioneerKws.length > 0;
            if (allMyKws.length === 0 && !hasPioneers) return null;
            return (
              <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 md:p-6">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-emerald-600 text-lg" aria-hidden="true">
                    ✓
                  </span>
                  <p className="text-base md:text-lg font-bold text-gray-900">
                    내가 입력한 키워드
                  </p>
                  <span className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    가게 보유 강점으로 인식
                  </span>
                </div>
                <p className="text-sm md:text-base text-gray-500 mb-3 leading-relaxed">
                  체험 단계에서 입력하신 키워드입니다. 정식 스캔에서는 스마트플레이스에
                  실제 등록된 키워드까지 자동으로 확인합니다.
                </p>

                {allMyKws.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm md:text-base font-semibold text-gray-700 mb-2">
                      내 가게가 보유한 키워드
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allMyKws.map((kw, idx) => (
                        <span
                          key={`${kw}-${idx}`}
                          className="inline-flex items-center gap-1 text-sm md:text-base font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 break-words"
                        >
                          <span className="text-emerald-500" aria-hidden="true">
                            ✓
                          </span>
                          <span>{kw}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {hasPioneers && (
                  <div className="mb-2">
                    <p className="text-sm md:text-base font-semibold text-amber-700 mb-2">
                      남들이 안 쓰는 선점 가능 키워드
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {pioneerKws.slice(0, 8).map((kw, idx) => (
                        <span
                          key={`pioneer-${kw}-${idx}`}
                          className="inline-flex items-center gap-1 text-sm md:text-base font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 break-words"
                        >
                          <span className="text-amber-500" aria-hidden="true">
                            ★
                          </span>
                          <span>{kw}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-amber-600 mt-2 leading-relaxed">
                      아직 경쟁 가게가 등록하지 않은 키워드입니다. 먼저 등록하면 AI 조건
                      검색에서 우위를 가질 수 있습니다.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* AI 문제 진단 */}
          <AIProblemDiagnosis
            businessName={form.business_name || "내 가게"}
            category={selectedCategory}
            track1Score={track1}
            track2Score={track2}
            growthStage={gsStage}
            missingKeywords={missingKws}
            hasFaq={hasFaq}
            hasRecentPost={hasRecentPost}
            hasIntro={hasIntro}
            isSmartPlace={isSmartPlace}
            blogMentions={blogCount}
            faqCopyText={faqText}
            pioneerKeywords={pioneerKws}
            reviewCopyText={
              (
                result as import("@/types").TrialScanResult & {
                  review_copy_text?: string;
                }
              ).review_copy_text
            }
            selectedTags={selectedTags}
            region={form.region}
          />

          {/* 항목별 점수 분석 */}
          {breakdownEntries.length > 0 &&
            (() => {
              const sorted = [...breakdownEntries].sort((a, b) => a.val - b.val);
              const weakestKey = sorted[0]?.key;
              return (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                    <p className="text-base md:text-lg font-bold text-gray-800">
                      항목별 점수 전체 보기
                    </p>
                    <p className="text-sm md:text-base text-gray-500 mt-0.5">
                      6개 항목 전부 확인하고, 가장 약한 항목부터 개선하면 효과가 큽니다
                    </p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {breakdownEntries.map(({ key, val, info }) => {
                      const isUnmeasured = val === 0 && Boolean(info.trialNote);
                      const isWeakest = !isUnmeasured && key === weakestKey;
                      return (
                        <div
                          key={key}
                          className={`px-4 md:px-6 py-4 ${isWeakest ? "bg-red-50" : isUnmeasured ? "bg-gray-50" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg" aria-hidden="true">
                                {info.icon}
                              </span>
                              <span
                                className={`text-sm md:text-base font-semibold ${isWeakest ? "text-gray-900" : isUnmeasured ? "text-gray-500" : "text-gray-800"}`}
                              >
                                {info.label}
                              </span>
                              {isWeakest && (
                                <span className="text-sm bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                                  가장 시급
                                </span>
                              )}
                              {isUnmeasured && (
                                <span className="text-sm bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                                  체험 미수집
                                </span>
                              )}
                            </div>
                            {isUnmeasured ? (
                              <span className="text-sm md:text-base font-medium text-gray-500">
                                측정 안 함
                              </span>
                            ) : (
                              <span
                                className={`text-base md:text-lg font-bold ${val >= 70 ? "text-green-600" : val >= 40 ? "text-yellow-600" : "text-red-500"}`}
                              >
                                {val}점
                              </span>
                            )}
                          </div>
                          {!isUnmeasured && (
                            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                              <div
                                className={`h-2 rounded-full ${val >= 70 ? "bg-green-500" : val >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                                style={{ width: `${val}%` }}
                              />
                            </div>
                          )}
                          <p
                            className={`text-sm md:text-base leading-relaxed ${isWeakest ? "text-gray-600" : "text-gray-500"}`}
                          >
                            {info.what}
                          </p>
                          {!isUnmeasured && (
                            <p
                              className={`text-sm md:text-base mt-1 font-medium leading-relaxed ${val < 40 ? "text-red-500" : "text-green-600"}`}
                            >
                              {val < 40 ? `▲ ${info.low}` : `✓ ${info.high}`}
                            </p>
                          )}
                          {(isUnmeasured || isWeakest) && info.trialNote && (
                            <p className="text-sm text-gray-500 mt-1 italic leading-relaxed">
                              {info.trialNote}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          {/* FAQ 미리보기 */}
          <FAQPreviewSection category={selectedCategory} />

          {/* 채널 분리 점수 2카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 px-3 md:px-4 py-4">
              <p className="text-sm md:text-base font-semibold text-gray-600 mb-0.5">
                네이버 AI 노출 점수
              </p>
              <p className="text-sm text-gray-500 mb-2 leading-tight">
                네이버 브리핑 · 카카오맵
              </p>
              <div
                className={`text-2xl md:text-3xl font-black mb-1 ${naverChannelScore >= 70 ? "text-green-500" : naverChannelScore >= 40 ? "text-amber-500" : "text-red-400"}`}
              >
                {Math.round(naverChannelScore)}점
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{ width: `${Math.round(naverChannelScore)}%` }}
                />
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 px-3 md:px-4 py-4">
              <p className="text-sm md:text-base font-semibold text-gray-600 mb-0.5">
                ChatGPT·구글 AI 노출 점수
              </p>
              <p className="text-sm text-gray-500 mb-2 leading-tight">
                요즘 손님이 많이 쓰는 AI
              </p>
              <div
                className={`text-2xl md:text-3xl font-black mb-1 ${globalChannelScore >= 70 ? "text-green-500" : globalChannelScore >= 40 ? "text-blue-500" : "text-red-400"}`}
              >
                {Math.round(globalChannelScore)}점
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                <div
                  className="h-2 rounded-full bg-blue-400"
                  style={{ width: `${Math.round(globalChannelScore)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 지금 내 가게 단계 카드 */}
          {gsData && (
            <div
              className={`rounded-2xl border px-4 md:px-5 py-4 md:py-5 ${stageColorClass}`}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden="true">
                    📈
                  </span>
                  <span className="text-base md:text-lg font-bold">
                    지금 내 가게 단계: {gsData.stage_label}
                  </span>
                </div>
                {gsData.score_range && (
                  <span className="text-sm opacity-70 font-medium">
                    {gsData.score_range}
                  </span>
                )}
              </div>
              {gsData.focus_message && (
                <p className="text-sm md:text-base mb-3 leading-relaxed">
                  {gsData.focus_message}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {gsData.this_week_action && (
                  <div className="bg-white bg-opacity-60 rounded-xl p-3">
                    <div className="text-sm md:text-base font-semibold mb-1">
                      이번 주 집중할 것
                    </div>
                    <p className="text-sm md:text-base leading-relaxed">
                      {gsData.this_week_action}
                    </p>
                  </div>
                )}
                {gsData.do_not_do && (
                  <div className="bg-white bg-opacity-40 rounded-xl p-3">
                    <div className="text-sm md:text-base font-semibold mb-1 opacity-70">
                      지금 하지 말아야 할 것
                    </div>
                    <p className="text-sm md:text-base leading-relaxed opacity-80">
                      {gsData.do_not_do}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 네이버 AI 브리핑 직접 확인 버튼 */}
          {businessType === "location_based" && form.business_name && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5">
              <p className="text-sm md:text-base text-gray-500 mb-3">
                아래 버튼으로 네이버 AI 브리핑 노출 여부를 직접 확인하세요{" "}
                <span className="text-gray-500">(가입 후 매주 자동 제공)</span>
              </p>
              {naverCheckState === "idle" && (
                <button
                  onClick={onNaverBriefingCheck}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors text-sm md:text-base flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  네이버 AI 브리핑 직접 확인하기
                </button>
              )}
              {naverCheckState === "loading" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div
                    className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"
                    role="status"
                    aria-label="확인 중"
                  />
                  <p className="text-sm md:text-base text-gray-600 font-medium text-center">
                    네이버 AI가 확인 중입니다...
                    <br />
                    <span className="text-gray-500 font-normal">(10~20초 소요)</span>
                  </p>
                </div>
              )}
              {naverCheckState === "done" && naverCheckResult && (
                <div className="space-y-3">
                  {naverCheckResult.in_briefing ? (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 flex items-start gap-3">
                      <span
                        className="text-emerald-600 text-xl shrink-0 mt-0.5"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <div>
                        <p className="text-sm md:text-base font-bold text-emerald-800">
                          네이버 AI 브리핑에 내 가게가 소개됩니다
                        </p>
                        {naverCheckResult.briefing_text && (
                          <p className="text-sm md:text-base text-emerald-700 mt-1 leading-relaxed line-clamp-3">
                            &ldquo;{naverCheckResult.briefing_text}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
                      <span
                        className="text-red-500 text-xl shrink-0 mt-0.5"
                        aria-hidden="true"
                      >
                        ✗
                      </span>
                      <div>
                        <p className="text-sm md:text-base font-bold text-red-800">
                          아직 네이버 AI 브리핑에 내 가게가 나오지 않습니다
                        </p>
                        <p className="text-sm md:text-base text-red-700 mt-1">
                          소개글 하단에 Q&A를 추가하면 노출 가능성이 크게 높아집니다.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {naverCheckState === "error" && (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-sm md:text-base text-red-700">{naverCheckError}</p>
                  </div>
                  <button
                    onClick={onNaverCheckReset}
                    className="w-full border border-gray-300 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-sm md:text-base"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Google 비즈니스 등록 CTA */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 md:px-5 py-4">
            <p className="text-sm md:text-base font-bold text-amber-800 mb-1">
              지금 당장 무료로 할 수 있는 1가지
            </p>
            <p className="text-sm md:text-base font-bold text-gray-900 mb-1">
              Google 비즈니스 프로필 등록
            </p>
            <p className="text-sm md:text-base text-gray-500 mb-3 leading-relaxed">
              ChatGPT·Google AI는 구글 데이터를 기반으로 가게를 추천합니다. 무료 등록만으로
              해외 AI 노출 가능성이 크게 높아집니다. (10분 소요)
            </p>
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-2.5 hover:bg-amber-600 transition-colors"
            >
              <span className="text-sm md:text-base font-bold">
                Google 비즈니스 프로필 무료 등록 →
              </span>
              <span className="text-sm opacity-80">무료</span>
            </a>
          </div>
        </MoreDetailsAccordion>

        {/* 카카오톡 공유 — 진단 결과 친구에게 (모든 사용자) */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base md:text-lg font-bold text-gray-900 leading-snug break-keep">
              같은 동네 사장님께도 알려주세요
            </p>
            <p className="text-sm md:text-base text-gray-600 mt-1 leading-relaxed break-keep">
              결과 카드를 카톡으로 공유해 친구 가게도 30초 진단받게 하세요
            </p>
          </div>
          <div className="shrink-0">
            <KakaoShareButton
              score={
                result.score.unified_score ?? result.score.total_score ?? 0
              }
              businessName={form.business_name || "내 가게"}
              category={
                FLAT_CATEGORY_MAP[selectedCategory]?.label ??
                CATEGORY_MAP[selectedCategory]?.label ??
                selectedCategory
              }
              region={form.region || ""}
              trialId={result.trial_id}
              benchmarkAvg={apiBenchmark?.avg_score}
            />
          </div>
        </div>

        {/* 텍스트 공유 버튼 */}
        <div className="flex justify-end mb-2">
          <TextShareButton
            businessName={form.business_name}
            score={Math.round(result.score.total_score)}
            category={selectedCategory}
            region={form.region}
            topMissingKeywords={result.top_missing_keywords}
          />
        </div>

        {/* 재진단 / 가입 액션 */}
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm md:text-base"
          >
            다시 진단하기
          </button>
          {!isLoggedIn && (
            <Link
              href="/signup"
              onClick={onSaveTrialData}
              className="flex-1 text-center bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm md:text-base"
            >
              가입하고 정밀 진단받기
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sticky 하단 배너 ──────────────────────────────────────────────────
function StickySignupBanner({
  isLoggedIn,
  onSave,
}: {
  isLoggedIn: boolean;
  onSave: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem("aeolab_trial_banner_dismissed") ===
        new Date().toDateString()
      ) {
        setDismissed(true);
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, []);

  if (isLoggedIn || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(
        "aeolab_trial_banner_dismissed",
        new Date().toDateString(),
      );
    } catch {
      // 무시
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white px-4 py-4 z-50 shadow-2xl">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold leading-snug">
            7일 후 AI가 내 가게를 인식했는지 자동으로 확인해 드립니다
          </p>
          <p className="text-sm md:text-base text-blue-200 mt-0.5">
            <span className="text-emerald-300 font-semibold">첫 달 4,950원</span> ·
            이후 월 9,900원 · 언제든 해지
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/signup"
            onClick={onSave}
            className="bg-white text-blue-700 font-bold text-sm md:text-base px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap shadow-md"
          >
            회원가입하기 (1분)
          </Link>
          <button
            onClick={handleDismiss}
            aria-label="배너 닫기"
            className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-blue-500"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PlaceMatchCard ────────────────────────────────────────────────────
function PlaceMatchCard({ match }: { match: TrialPlaceMatch }) {
  const ratingText = match.rating != null ? `★ ${match.rating.toFixed(1)}` : null;
  const reviewText =
    match.review_count != null ? `리뷰 ${match.review_count.toLocaleString()}건` : null;
  const statusBadgeColor =
    match.business_status?.includes("영업") || match.business_status?.includes("운영")
      ? "bg-emerald-100 text-emerald-700"
      : match.business_status?.includes("휴")
        ? "bg-amber-100 text-amber-700"
        : match.business_status?.includes("폐")
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white border-2 border-blue-200 rounded-2xl p-4 md:p-6 mb-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold text-blue-700 mb-1">
            진단한 가게
          </p>
          <p className="text-xl md:text-2xl font-bold text-gray-900 leading-tight break-keep">
            {match.name}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {match.category && (
              <span className="text-sm md:text-base text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full font-medium">
                {match.category}
              </span>
            )}
            {match.business_status && (
              <span
                className={`text-sm font-medium px-2.5 py-1 rounded-full ${statusBadgeColor}`}
              >
                {match.business_status}
              </span>
            )}
          </div>
        </div>
        <a
          href={match.naver_place_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-sm md:text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
        >
          네이버 플레이스 보기
          <span className="text-base" aria-hidden="true">
            →
          </span>
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm md:text-base text-gray-700 mb-3">
        {match.address && (
          <div className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5" aria-hidden="true">
              📍
            </span>
            <span className="leading-relaxed break-keep">{match.address}</span>
          </div>
        )}
        {match.phone && (
          <div className="flex items-center gap-2">
            <span className="shrink-0" aria-hidden="true">
              📞
            </span>
            <span>{match.phone}</span>
          </div>
        )}
        {(ratingText || reviewText) && (
          <div className="flex items-center gap-3 sm:col-span-2 text-sm md:text-base">
            {ratingText && <span className="font-bold text-amber-600">{ratingText}</span>}
            {reviewText && <span className="text-gray-600">{reviewText}</span>}
          </div>
        )}
      </div>

      <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-relaxed">
        ✓ 이 가게의 실제 데이터로 진단했습니다
      </p>
    </div>
  );
}

// ── SmartPlaceCheckCard ───────────────────────────────────────────────
function SmartPlaceCheckCard({ check }: { check: TrialSmartPlaceCheck }) {
  const items = [
    {
      key: "is_smart_place",
      label: "스마트플레이스 가입",
      checked: check.is_smart_place,
      link: check.action_links?.register,
    },
    {
      key: "has_faq",
      label: "소개글 Q&A 섹션 포함",
      checked: check.has_faq,
      link: check.action_links?.faq,
    },
    {
      key: "has_recent_post",
      label: "최근 소식 업데이트",
      checked: check.has_recent_post,
      link: check.action_links?.post,
    },
    {
      key: "has_intro",
      label: "소개글 작성",
      checked: check.has_intro,
      link: check.action_links?.intro,
    },
  ];
  const allOK = check.score_loss === 0;

  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 md:p-6 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-base md:text-lg font-bold text-gray-900">
          스마트플레이스 등록 상태
        </p>
        <span className="text-sm text-gray-500">자동 확인됨</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 border ${
              item.checked
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`text-xl shrink-0 ${item.checked ? "text-emerald-600" : "text-red-500"}`}
                aria-hidden="true"
              >
                {item.checked ? "✓" : "✗"}
              </span>
              <span
                className={`text-sm md:text-base font-semibold truncate ${item.checked ? "text-emerald-800" : "text-red-800"}`}
              >
                {item.label}
              </span>
            </div>
            {!item.checked && item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                지금 등록하기 →
              </a>
            )}
          </div>
        ))}
      </div>

      {allOK ? (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3">
          <p className="text-sm md:text-base font-bold text-emerald-800 leading-relaxed">
            ✓ 스마트플레이스 4개 항목 모두 등록 완료
          </p>
          <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
            네이버 AI 브리핑 노출에 필요한 기본 조건은 갖추셨습니다. 이제 키워드와
            리뷰로 점수를 더 올려보세요.
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <p className="text-sm md:text-base font-bold text-amber-800 leading-relaxed">
            이 항목들 누락으로 약 -{check.score_loss}점 손실 중
          </p>
          <p className="text-sm text-amber-700 mt-1 leading-relaxed">
            빨간색 항목을 등록하면 네이버 AI 브리핑 노출 점수가 즉시 올라갑니다.
          </p>
        </div>
      )}
    </div>
  );
}

// ── AIEvidenceCard ────────────────────────────────────────────────────
function AIEvidenceCard({ evidence }: { evidence: TrialAIEvidence }) {
  const { platform, total_queries, mentioned_count, queries } = evidence;

  let toneBg = "bg-emerald-50 border-emerald-200";
  let toneText = "text-emerald-800";
  let toneLabel = "노출이 양호합니다";
  if (mentioned_count === 0) {
    toneBg = "bg-red-50 border-red-200";
    toneText = "text-red-800";
    toneLabel = "검색 결과에 거의 노출되지 않고 있습니다";
  } else if (mentioned_count <= 3) {
    toneBg = "bg-amber-50 border-amber-200";
    toneText = "text-amber-800";
    toneLabel = "노출이 부족합니다";
  }

  const visibleQueries = (queries ?? []).slice(0, 5);

  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 md:p-6 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-base md:text-lg font-bold text-gray-900">
          🔍 {platform}에 직접 물어봤습니다
        </p>
        <span className="text-xs md:text-sm text-gray-500">실제 AI 응답 원문</span>
      </div>

      <div className={`rounded-xl border-2 px-4 py-3 mb-4 ${toneBg}`}>
        <p className={`text-base md:text-lg leading-relaxed font-semibold break-keep ${toneText}`}>
          {total_queries}개 질문 중{" "}
          <strong className="text-xl md:text-2xl">{mentioned_count}개</strong>에서
          당신 가게가 언급되었습니다
        </p>
        <p className={`text-sm md:text-base mt-1 ${toneText} opacity-90`}>{toneLabel}</p>
      </div>

      {visibleQueries.length > 0 && (
        <div className="space-y-3 md:space-y-4">
          {visibleQueries.map((q, idx) => {
            const isMentioned = q.mentioned;
            return (
              <div
                key={idx}
                className={`rounded-xl border ${
                  isMentioned ? "border-emerald-200 bg-white" : "border-red-100 bg-white"
                } overflow-hidden`}
              >
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                  <p className="text-sm md:text-base font-medium text-gray-800 leading-relaxed break-keep">
                    Q. {q.query}
                  </p>
                </div>
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <p className="text-sm md:text-base text-gray-700 italic leading-relaxed break-keep flex-1 min-w-0">
                    &ldquo;{q.excerpt}&rdquo;
                  </p>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 text-xs md:text-sm font-bold px-2.5 py-1 rounded-full ${
                      isMentioned
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {isMentioned ? "✓ 언급됨" : "✗ 미언급"}
                  </span>
                </div>
                {!isMentioned && (
                  <div className="px-4 pb-3">
                    <p className="text-xs md:text-sm text-red-600">
                      → 이런 질문에서 당신 가게가 안 보입니다
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FAQPreviewSection ─────────────────────────────────────────────────
function FAQPreviewSection({ category }: { category: string }) {
  const key = (category ?? "default").toLowerCase();
  const faq = FAQ_PREVIEW[key] ?? FAQ_PREVIEW["default"];
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Q. ${faq.q}\nA. ${faq.a}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 실패 시 무시
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 md:p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl shrink-0" aria-hidden="true">
          📋
        </span>
        <div>
          <p className="text-base font-bold text-amber-900">
            소개글 Q&A — 지금 바로 붙여넣기 가능
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            아래 문구를 스마트플레이스 소개글 하단에 그대로 추가하세요
          </p>
        </div>
      </div>
      <div className="bg-white rounded-xl p-3 md:p-4 border border-amber-200 mb-3">
        <div className="space-y-2">
          <div>
            <span className="text-sm font-semibold text-gray-500">Q.</span>
            <span className="text-sm md:text-base text-gray-800 ml-1">{faq.q}</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-500">A.</span>
            <span className="text-sm md:text-base text-gray-700 ml-1 leading-relaxed">
              {faq.a}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={handleCopy}
        aria-label="FAQ 문구 복사하기"
        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all mb-3 ${
          copied ? "bg-green-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"
        }`}
      >
        {copied
          ? "✓ 복사됨! 스마트플레이스에 붙여넣기 하세요"
          : "전체 복사 (Q&A 형식)"}
      </button>
      <div className="border-t border-amber-200 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <p className="text-sm text-amber-700 leading-relaxed">
          업종별 맞춤 FAQ 5개 전체 + AI 브리핑 키워드 포함 버전은 가입 후 제공됩니다
        </p>
        <a
          href="/signup"
          className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          무료 가입하기 &rarr;
        </a>
      </div>
    </div>
  );
}
