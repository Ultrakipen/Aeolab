"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CATEGORY_MAP,
  FLAT_CATEGORY_MAP,
  flatToGroup,
} from "@/lib/categories";
import { getUserGroup, GROUP_MESSAGES, getBriefingEligibility, type BriefingEligibility } from "@/lib/userGroup";
import { PLAN_PRICES, FIRST_MONTH_DISCOUNT_PRICES } from "@/lib/plans";
import TodayOneAction from "@/components/trial/TodayOneAction";
import SubscriptionValueCompare from "@/components/trial/SubscriptionValueCompare";
import SubscriptionScreenshotPreview from "@/components/trial/SubscriptionScreenshotPreview";
import ClaimGate from "@/components/trial/ClaimGate";
import KakaoShareButton from "@/components/common/KakaoShareButton";
import TextShareButton from "@/components/trial/TextShareButton";
import TrialCompetitorGapCard from "@/components/trial/TrialCompetitorGapCard";
import TrialDetailAccordion from "@/components/trial/TrialDetailAccordion";
import type {
  TrialScanResult,
  TrialPlaceMatch,
  TrialSmartPlaceCheck,
} from "@/types";
import type { TrialResultProps } from "./TrialSharedTypes";
import { trackTrialComplete, trackEvent } from "@/lib/analytics";
import {
  Info,
  Store,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Calendar,
  Check,
  X,
  XCircle,
  TrendingUp,
  Lock,
} from "lucide-react";

// ── 발견 사항 카드 (A안 — 점수 없이 현황 요약) ──────────────────────
function FindingsCard({
  chatgptMentioned,
  inBriefing,
  blogCount,
  missingKws,
  hasFaq,
  hasIntro,
  isSmartPlace,
  userGroup,
  businessName,
  categoryLabel,
  benchmarkAvg,
  score,
}: {
  chatgptMentioned: boolean | undefined;
  inBriefing: boolean | null;
  blogCount: number;
  missingKws: string[];
  hasFaq: boolean;
  hasIntro: boolean;
  isSmartPlace: boolean;
  userGroup: string;
  businessName: string;
  categoryLabel: string;
  benchmarkAvg: number;
  score: number;
}) {
  const findings: { icon: string; title: string; desc: string; positive: boolean }[] = [];

  // 발견 1: 네이버 AI 브리핑 / 블로그
  if (userGroup === "ACTIVE" || userGroup === "LIKELY") {
    if (inBriefing === false) {
      findings.push({ icon: "📍", positive: false,
        title: "네이버 AI 브리핑에 아직 등장하지 않습니다",
        desc: "리뷰 키워드 다양성 확보 + 소개글 Q&A 섹션 추가가 핵심 개선 포인트입니다.",
      });
    } else if (inBriefing === true) {
      findings.push({ icon: "✅", positive: true,
        title: "네이버 AI 브리핑에 등장하고 있습니다",
        desc: "이미 노출 중입니다. 경쟁 가게보다 더 자주 등장하려면 키워드 다양성을 높여야 합니다.",
      });
    } else {
      findings.push({ icon: "📍", positive: false,
        title: "네이버 AI 브리핑 노출 여부를 확인했습니다",
        desc: "소개글 Q&A·리뷰 키워드가 충분하면 AI 브리핑에 내 가게가 인용될 수 있습니다.",
      });
    }
  } else {
    if (blogCount < 5) {
      findings.push({ icon: "📝", positive: false,
        title: `블로그 후기가 ${blogCount}건으로 적습니다`,
        desc: "네이버 검색 노출과 ChatGPT 학습 데이터 모두 블로그 언급 수가 영향을 줍니다.",
      });
    } else {
      findings.push({ icon: "✅", positive: true,
        title: `블로그 후기 ${blogCount}건 발견됐습니다`,
        desc: "어느 정도 쌓여 있습니다. 경쟁 가게 대비 더 많이 확보하면 노출이 더 늘어납니다.",
      });
    }
  }

  // 발견 2: 키워드 갭
  if (missingKws.length > 0) {
    findings.push({ icon: "🔑", positive: false,
      title: `경쟁 가게가 쓰는 키워드 ${missingKws.length}개가 없습니다`,
      desc: `'${missingKws.slice(0, 2).join("', '")}' 등이 소개글·리뷰에 없습니다. 이 키워드들이 있어야 AI가 추천할 때 포함됩니다.`,
    });
  } else if (!hasFaq) {
    findings.push({ icon: "📝", positive: false,
      title: "소개글에 Q&A 섹션이 없습니다",
      desc: "소개글 Q&A 텍스트는 네이버 AI 브리핑이 참고하는 핵심 콘텐츠입니다. 3개 이상 작성하면 AI 인용 가능성이 높아집니다 (네이버 알고리즘 기준, 100% 보장 아님).",
    });
  } else if (!hasIntro) {
    findings.push({ icon: "✏️", positive: false,
      title: "소개글이 충분하지 않습니다",
      desc: "AI는 소개글을 읽고 내 가게를 추천합니다. 가게 특징·메뉴·분위기를 구체적으로 작성하세요.",
    });
  } else {
    findings.push({ icon: "✅", positive: true,
      title: "소개글과 키워드가 잘 갖춰져 있습니다",
      desc: "기본 콘텐츠는 준비됐습니다. 이제 정기적인 소식 업데이트로 최신성을 유지하세요.",
    });
  }

  // 발견 3: 스마트플레이스 / 프로필
  if (!isSmartPlace) {
    findings.push({ icon: "🏪", positive: false,
      title: "스마트플레이스 정보가 불완전합니다",
      desc: "스마트플레이스는 네이버 AI 브리핑의 기본 조건입니다. 소개글·사진·영업시간이 완전해야 합니다.",
    });
  }

  const positionMsg = score >= benchmarkAvg
    ? `${categoryLabel} 업종 평균보다 나은 상태`
    : `${categoryLabel} 업종 평균 대비 개선 여지 있음`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <p className="text-base font-bold text-slate-800">🔎 이번 스캔에서 발견한 것</p>
        <p className="text-sm text-slate-500 mt-0.5">{businessName} · {positionMsg}</p>
      </div>
      <div className="divide-y divide-slate-50">
        {findings.slice(0, 3).map((f, i) => (
          <div key={i} className={`px-4 py-3.5 flex gap-3 ${f.positive ? "bg-green-50/40" : ""}`}>
            <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
            <div>
              <p className={`text-base font-semibold leading-snug break-keep ${f.positive ? "text-green-800" : "text-slate-800"}`}>{f.title}</p>
              <p className="text-sm text-slate-600 mt-0.5 leading-relaxed break-keep">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
        <p className="text-sm text-slate-500 leading-relaxed">정확한 항목별 점수와 경쟁사 비교는 구독 후 매주 자동 측정합니다</p>
      </div>
    </div>
  );
}

// ── 잠긴 상세 분석 카드 (점수는 위에서 공개, 여기서는 항목별 분석 유도) ────
function LockedScoreCard({ score, track1, track2 }: { score: number; track1: number; track2: number }) {
  return (
    <div className="rounded-xl border-2 border-blue-100 bg-white overflow-hidden relative mb-4">
      <div className="px-4 py-3 border-b border-blue-100">
        <p className="text-base font-bold text-slate-700">📊 항목별 상세 분석 (구독 후 확인)</p>
        <p className="text-sm text-slate-500 mt-0.5">5가지 항목 개별 점수 + 경쟁사 비교 + 매주 자동 측정</p>
      </div>
      {/* 블러 처리된 항목 분석 바 */}
      <div className="px-4 py-5 blur-sm select-none pointer-events-none opacity-60" aria-hidden="true">
        {[
          { label: "핵심 키워드 보유", val: Math.round(score * 0.35) },
          { label: "고객 후기 신뢰도", val: Math.round(score * 0.25) },
          { label: "네이버 프로필 완성도", val: Math.round(score * 0.15) },
          { label: "AI 브리핑 노출", val: Math.round(score * 0.15) },
          { label: "카카오맵 등록", val: Math.round(score * 0.10) },
        ].map((item) => (
          <div key={item.label} className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-slate-600">{item.label}</span>
              <span className="text-sm font-bold text-slate-700">{item.val}/100</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-blue-400" style={{ width: `${item.val}%` }} />
            </div>
          </div>
        ))}
      </div>
      {/* 잠금 오버레이 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[2px]">
        <div className="text-center px-6">
          <p className="text-sm font-bold text-slate-800 mb-1">🔒 항목별 세부 분석은 구독 후 확인</p>
          <p className="text-sm text-slate-500 mb-3 leading-relaxed break-keep">
            어떤 항목이 몇 점인지, 경쟁사 대비 어떤지, 매주 점수가 어떻게 바뀌는지 추적합니다
          </p>
          <Link href="/pricing" className="inline-block text-sm font-bold text-white bg-blue-600 rounded-xl px-5 py-2 hover:bg-blue-700 transition-colors">
            구독 시작하기 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── 점수 요약 카드 (성장 단계 중심 — 거부감 없이 기회 전달) ─────────────
function ScoreSummaryCard({
  score,
  track1,
  track2,
  benchmarkAvg,
  categoryLabel,
  isEstimatedBenchmark,
}: {
  score: number;
  track1: number;
  track2: number;
  benchmarkAvg: number;
  categoryLabel: string;
  isEstimatedBenchmark: boolean;
}) {
  // 등급 대신 성장 여정 단계로 표현 — 낙제 감각 없이 가능성 중심
  const stage =
    score >= 70
      ? {
          label: "안정 궤도",
          tagBg: "bg-blue-100 text-blue-700",
          bar: "bg-blue-500",
          message: "경쟁 가게 대비 AI 검색 노출이 잘 되어 있습니다. 이 상태를 꾸준히 유지하면서 상위권을 지키세요.",
        }
      : score >= 50
        ? {
            label: "성장 진행 중",
            tagBg: "bg-blue-100 text-blue-700",
            bar: "bg-blue-500",
            message: "기반이 갖춰져 있습니다. 아래 발견 항목 2~3가지 보완으로 노출을 크게 늘릴 수 있습니다.",
          }
        : score >= 30
          ? {
              label: "성장 준비 중",
              tagBg: "bg-slate-100 text-slate-600",
              bar: "bg-slate-400",
              message: "핵심 항목 몇 가지를 보완하면 AI 검색 노출이 빠르게 늘어납니다. 아래 발견 항목을 확인하세요.",
            }
          : {
              label: "시작 단계",
              tagBg: "bg-slate-100 text-slate-600",
              bar: "bg-slate-400",
              message: "AI 검색 최적화가 아직 시작 전입니다. 지금 시작하면 경쟁 가게보다 먼저 자리 잡을 수 있습니다.",
            };

  const vsAvg = score - benchmarkAvg;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 mb-4 shadow-sm">
      {/* 단계 태그 */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${stage.tagBg}`}>
          {stage.label}
        </span>
        <span className="text-sm text-slate-400">현재 AI 노출 단계</span>
      </div>

      {/* 메시지 */}
      <p className="text-base md:text-lg text-slate-700 leading-relaxed break-keep mb-4">{stage.message}</p>

      {/* 점수 바 + 업종 평균선 */}
      <div className="mb-1">
        <div className="w-full bg-slate-100 rounded-full h-2.5 relative">
          <div
            className={`h-2.5 rounded-full ${stage.bar} transition-all duration-700`}
            style={{ width: `${score}%` }}
          />
          {benchmarkAvg > 0 && benchmarkAvg <= 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 rounded-full"
              style={{ left: `${benchmarkAvg}%` }}
              title={`${categoryLabel} 평균 ${benchmarkAvg}점`}
            />
          )}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-sm text-slate-400">0점</span>
          {benchmarkAvg > 0 && (
            <span className="text-sm text-slate-400">
              {categoryLabel} 평균 {benchmarkAvg}점{isEstimatedBenchmark ? " (추정)" : ""}
            </span>
          )}
          <span className="text-sm text-slate-400">100점</span>
        </div>
      </div>

      {/* 채널별 점수 */}
      <div className="flex flex-wrap gap-2 mt-3">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="text-sm text-slate-500">네이버</span>
          <span className="text-base font-bold text-slate-700">{track1}점</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <span className="text-sm text-slate-500">글로벌 AI</span>
          <span className="text-base font-bold text-slate-700">{track2}점</span>
        </div>
        {Math.abs(vsAvg) >= 1 && (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <span className="text-sm text-slate-500">업종 평균 대비</span>
            <span className={`text-sm font-bold ${vsAvg >= 0 ? "text-blue-600" : "text-slate-500"}`}>
              {vsAvg >= 0 ? `+${vsAvg}점` : `${vsAvg}점`}
            </span>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-400 mt-3 leading-relaxed">
        AEOlab AI 가시성 점수 · ChatGPT·네이버 실측 기반 · 측정 시점·기기에 따라 ±5점 변동 가능
      </p>
    </div>
  );
}

// ── 측정 근거 카드 ────────────────────────────────────────────────────
function ScanEvidenceCard({ result, analyzedKeyword, chatgptFirstQuery }: { result: any; analyzedKeyword: string; chatgptFirstQuery?: string }) {
  const chatgptCount = result?.chatgpt_result?.sample_size ?? result?.chatgpt_result?.queries_sent ?? 5;
  const blogCount = result?.naver?.blog_mentions ?? result?.blog_count ?? result?.competitor_data?.blog_count ?? result?.blog_found ?? 0;
  const hasNaver = !!(result?.naver_result ?? result?.naver);
  const hasSmartPlace = !!(result?.smart_place_result ?? result?.smart_place_check ?? result?.naver_place_id ?? result?.place_match?.naver_place_url);

  // 실제 질의문이 있으면 사용, 없으면 "키워드 추천" 형식으로 표현 (단순 키워드 반복 오해 방지)
  const displayQuery = chatgptFirstQuery || `${analyzedKeyword} 추천`;

  const items: { icon: string; text: string }[] = [
    { icon: "🤖", text: `ChatGPT에 "${displayQuery}" 등 ${chatgptCount}가지 질문으로 테스트` },
    { icon: "📍", text: hasNaver ? "네이버 AI 브리핑 직접 확인" : "네이버 검색 자동 점검" },
    ...(blogCount > 0 ? [{ icon: "📝", text: `블로그 후기 ${blogCount}건 발견` }] : []),
    ...(hasSmartPlace ? [{ icon: "✅", text: "스마트플레이스 자동 점검 완료" }] : []),
  ];

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mb-2 text-sm font-medium text-slate-600">🔍 이렇게 측정했습니다</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item, i) => (
          <span key={i} className="text-sm text-slate-700">{item.icon} {item.text}</span>
        ))}
      </div>
    </div>
  );
}

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

// ── 컴포넌트 본체 ─────────────────────────────────────────────────────
export default function TrialResultStep(props: TrialResultProps) {
  const {
    result,
    selectedCategory,
    selectedTags,
    form,
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
    isRestored = false,
    onRescan,
  } = props;

  // 점수 계산
  const totalScore = Math.round(result.score?.total_score ?? 0);
  const track1 =
    result.track1_score ??
    result.score?.track1_score ??
    result.score?.naver_channel_score ??
    Math.round(totalScore * 0.6);
  const track2 =
    result.track2_score ??
    result.score?.track2_score ??
    result.score?.global_channel_score ??
    Math.round(totalScore * 0.4);
  const unified = result.score?.unified_score ?? result.score?.total_score;
  const gs = result.growth_stage;
  const gsLabel = result.growth_stage_label ?? gs?.stage_label ?? "성장 중";
  const missingKws = result.top_missing_keywords ?? [];
  const pioneerKws = result.pioneer_keywords ?? [];
  const faqText = result.faq_copy_text ?? null;
  const [dismissedKws, setDismissedKws] = useState<string[]>([]);
  const effectiveFaqText =
    missingKws.length > 0 && dismissedKws.includes(missingKws[0])
      ? null
      : faqText;
  const effectiveMissingKws = missingKws.filter((k) => !dismissedKws.includes(k));
  const effectivePioneerKws = pioneerKws.filter(
    (k) => missingKws.includes(k) && !dismissedKws.includes(k),
  );

  const score = Math.round(
    result.score?.total_score ?? result.score?.unified_score ?? 0,
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

  const benchmarkData =
    CATEGORY_BENCHMARKS[flatToGroup(selectedCategory)] ??
    CATEGORY_BENCHMARKS[selectedCategory] ?? { avg: 50, top30: 65 };
  const benchmarkAvg = apiBenchmark?.avg_score ?? benchmarkData.avg;
  const isEstimatedBenchmark = !apiBenchmark?.avg_score;

  const chatgptResult = (
    result as {
      chatgpt_result?: {
        mentioned?: boolean;
        excerpt?: string;
        exposure_freq?: number;
        sample_size?: number;
        queries_used?: string[];
      };
    }
  ).chatgpt_result;
  const chatgptMentioned =
    chatgptResult?.mentioned ??
    (chatgptResult?.exposure_freq !== undefined
      ? chatgptResult.exposure_freq > 0
      : undefined);
  const chatgptSampleSize = chatgptResult?.sample_size ?? 5;

  const websiteCheckResult = (
    result as {
      website_check_result?: { has_website?: boolean };
    }
  ).website_check_result;
  const hasWebsite: boolean | null = websiteCheckResult?.has_website ?? null;

  const geminiExposureFreq = (
    result as {
      gemini_result?: { exposure_freq?: number };
    }
  ).gemini_result?.exposure_freq;

  const aiEvidence = (result as {
    ai_evidence?: {
      queries?: Array<{ query: string; mentioned: boolean; excerpt?: string }>;
    };
  }).ai_evidence;

  const analyzedKeyword =
    (result as { analyzed_keyword?: string }).analyzed_keyword ||
    selectedTags[0] ||
    undefined;

  // ChatGPT 카드에 표시할 질의: 실제 ChatGPT 쿼리 > Gemini 쿼리 > 핵심키워드 > 태그 fallback
  const chatgptDisplayQueries = (() => {
    // 1순위: 실제 ChatGPT에 보낸 쿼리 (가장 정확)
    if (chatgptResult?.queries_used && chatgptResult.queries_used.length > 0) {
      return chatgptResult.queries_used;
    }
    // 2순위: Gemini ai_evidence 쿼리
    if (aiEvidence?.queries && aiEvidence.queries.length > 0) {
      return aiEvidence.queries.map((q) => q.query);
    }
    const city = (form.region || "")
      .trim()
      .replace(/^(?:서울특별시|부산광역시|인천광역시|대구광역시|대전광역시|광주광역시|울산광역시|세종특별자치시|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)\s*/u, "");
    const prefix = city || form.region || "";
    // 3순위: 분석 키워드 기반 조합
    if (analyzedKeyword) return [`${prefix ? prefix + " " : ""}${analyzedKeyword} 추천`];
    const tags = selectedTags.length > 0 ? selectedTags.slice(0, 1) : [];
    if (tags.length === 0) return [form.business_name || "내 가게"];
    // 4순위: 태그 fallback (1개만 — 실제 단일 쿼리 반영)
    return tags.map((t) => `${prefix ? prefix + " " : ""}${t} 추천`);
  })();

  const isFranchise = (form as { is_franchise?: boolean }).is_franchise === true;
  const userGroupValue = getUserGroup(selectedCategory, isFranchise);

  function getSignupCTALabel(group: string): string {
    if (group === "ACTIVE") return "가입하고 네이버 AI 브리핑 노출 시작하기";
    if (group === "LIKELY") return "가입하고 AI탭 노출 + 확대 예정 대비하기";
    if (group === "franchise") return "가입하고 글로벌 AI 노출 시작하기";
    return "가입하고 ChatGPT·Gemini 최적화 진단 받기";
  }

  function handleSignupCTAClick(group: string) {
    const dimMap: Record<string, string> = {
      ACTIVE: "signup_cta_clicked_active",
      LIKELY: "signup_cta_clicked_likely",
      INACTIVE: "signup_cta_clicked_inactive",
      franchise: "signup_cta_clicked_franchise",
    };
    trackEvent(dimMap[group] ?? "signup_cta_clicked_inactive", {
      category: selectedCategory,
      group,
    });
  }

  const naverChannelScore = result.score?.naver_channel_score ?? track1;
  const globalChannelScore = result.score?.global_channel_score ?? track2;

  // 업종 AI 브리핑 분류 (백엔드 제공 우선, 없으면 프론트 단일 소스 헬퍼 사용)
  const briefingCategory: BriefingEligibility =
    (result.briefing_category as BriefingEligibility | undefined) ??
    getBriefingEligibility(selectedCategory, isFranchise);

  // 점수 산식 분해 데이터
  const breakdown = result.score?.breakdown;
  const breakdownItems = [
    {
      label: "AI 질문에 내 가게가 나오는 핵심 키워드 보유",
      weight: 35,
      value: breakdown?.keyword_gap_score,
    },
    {
      label: "고객 후기 수와 평점 신뢰도",
      weight: 25,
      value: breakdown?.review_quality,
      trialLimited: !breakdown?.review_quality,
      trialNote: "체험 스캔에서는 미수집 — 정식 스캔에서 자동으로 측정합니다",
    },
    {
      label: "네이버 가게 프로필 완성도",
      weight: 15,
      value: breakdown?.smart_place_completeness,
    },
    {
      label: isFranchise || userGroupValue === "INACTIVE"
        ? "네이버 지역·블로그 검색 노출 여부"
        : userGroupValue === "LIKELY"
          ? "네이버 AI 브리핑 노출 여부 (확대 예정)"
          : "실제 네이버 AI 브리핑 노출 여부",
      weight: 15,
      value: breakdown?.naver_exposure_confirmed,
      trialLimited: !breakdown?.naver_exposure_confirmed,
      trialNote: "체험 스캔에서는 미측정 — 정식 스캔에서 확인합니다",
    },
    {
      label: "카카오맵 가게 정보 등록",
      weight: 10,
      value: breakdown?.kakao_completeness,
    },
  ];

  // 점수 의미 해석
  const unifiedScore = unified ?? score;
  const isInactiveGroup = userGroupValue !== "ACTIVE";
  const scoreInterpretation =
    unifiedScore >= 60
      ? { text: isInactiveGroup ? "네이버·글로벌 AI 검색 노출 안정권 (60점 이상)" : "AI 브리핑 노출 안정권 (60점 이상)", color: "text-green-700", bg: "bg-green-50 border-green-200" }
      : unifiedScore >= 40
        ? { text: isInactiveGroup ? "기반 구축 중 — 플레이스·블로그 보완 필요 (40~60점)" : "기반 구축 중 — 콘텐츠 보완 필요 (40~60점)", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" }
        : { text: isInactiveGroup ? "네이버 검색 노출 낮음 — 블로그·플레이스 개선 필요 (40점 미만)" : "노출 확률 낮음 — 지금 바로 개선 필요 (40점 미만)", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };

  // 7일 후 날짜 계산
  const nextScanDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${month}월 ${day}일 (${weekdays[d.getDay()]})`;
  })();

  const categoryLabel =
    FLAT_CATEGORY_MAP[selectedCategory]?.label ??
    CATEGORY_MAP[selectedCategory]?.label ??
    selectedCategory;

  // 결과 화면 마운트 시 최상단으로 스크롤 (스캔 진행 중 아래로 스크롤된 상태 초기화)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // GA4: trial_complete
  useEffect(() => {
    const trialId = (result as { trial_id?: string }).trial_id;
    trackTrialComplete({
      trial_id: trialId,
      category: selectedCategory,
      score,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 업종 그룹 배너 노드 (섹션 4 내에 포함) ──────────────────────────
  const group = userGroupValue;
  const msg = GROUP_MESSAGES[group];
  const bgMap: Record<string, string> = {
    ACTIVE: "bg-green-50 border-green-200",
    LIKELY: "bg-blue-50 border-blue-200",
    INACTIVE: "bg-amber-50 border-amber-200",
    franchise: "bg-amber-50 border-amber-200",
  };

  const groupBannerNode = (
    <>
      {(group === "INACTIVE" || group === "franchise") && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm md:text-base font-bold text-amber-900">
              {group === "franchise"
                ? "프랜차이즈 가맹점은 네이버 AI 브리핑 대상에서 제외됩니다"
                : "현재 네이버 AI 브리핑 대상 업종이 아닙니다"}
            </p>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed mb-2 break-keep">
            {group === "franchise"
              ? "네이버 본사 정책에 따라 프랜차이즈 가맹점은 AI 브리핑 노출이 제한됩니다. 단, 네이버 AI탭(모든 업종 베타)은 이용 가능합니다."
              : "ChatGPT·Gemini·Google AI 노출 최적화에 집중합니다. 또한 네이버 AI탭(모든 업종 베타)도 이용 가능합니다."}
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "네이버 AI탭", desc: "모든 업종 베타 대상" },
              { label: "ChatGPT", desc: "OpenAI 학습 데이터 + Bing 검색" },
              { label: "Gemini", desc: "Google 검색 혼합" },
              { label: "Google AI", desc: "구글 SGE 인용" },
            ].map((ch) => (
              <span
                key={ch.label}
                className="inline-flex items-center gap-1 text-sm bg-white border border-amber-300 rounded-full px-2.5 py-1 text-amber-900 font-medium"
              >
                <span className="font-bold">{ch.label}</span>
                <span className="text-amber-700">{ch.desc}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {group === "LIKELY" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            2026 AI탭 베타 공개·확대 진행 중
          </p>
          <p className="text-sm text-amber-800 leading-relaxed">
            이 업종은 네이버 AI 브리핑 확대 예상 대상입니다. 2026-04-27 네이버플러스
            우선 베타 공개 후 상반기 전체 확대 예정입니다.
          </p>
        </div>
      )}

      <div className={`rounded-xl border px-4 py-3 ${bgMap[group]}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${msg.badgeColor}`}>
            {msg.badge}
          </span>
          <span className="text-sm text-gray-500">{categoryLabel}</span>
        </div>
        <p className="text-sm md:text-base text-gray-900 font-semibold leading-snug break-keep mb-1">
          {msg.headline}
        </p>
        <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
          {msg.sub}
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* 이전 결과 복원 안내 배너 */}
      {isRestored && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
            <p className="text-sm text-blue-800">
              이전 스캔 결과입니다. 이메일로 저장하지 않으면 탭을 닫을 때 사라집니다.
            </p>
            <button
              onClick={onRescan ?? onReset}
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 transition-colors shrink-0"
            >
              새로 스캔하기
            </button>
          </div>
        </div>
      )}

      {/* Sticky 상단 CTA — 비로그인, 데스크톱 전용 */}
      {!isLoggedIn && (
        <div className="hidden md:block sticky top-0 z-40 bg-blue-600 shadow-md">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-base font-medium leading-tight text-white">
              이 결과를 기반으로 매주 자동 진단 + 경쟁사 비교 + 개선 가이드 — 무료 회원가입
            </p>
            <Link
              href="/signup"
              onClick={() => { onSaveTrialData(); handleSignupCTAClick(userGroupValue); }}
              className="shrink-0 bg-white text-blue-600 text-base font-bold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {getSignupCTALabel(userGroupValue)}
            </Link>
          </div>
        </div>
      )}

      <StickySignupBanner isLoggedIn={isLoggedIn} onSave={onSaveTrialData} />

      <div className="max-w-5xl mx-auto py-6 px-4 pb-28">

        {/* ── 0. 핵심 요약 (처음 접속자 즉시 파악) ───────────────── */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-800">
              {score >= benchmarkAvg
                ? `업종 평균(${Math.round(benchmarkAvg)}점) 이상입니다`
                : `업종 평균(${Math.round(benchmarkAvg)}점)보다 낮습니다 — 개선 여지 있음`}
            </p>
            <p className="text-sm text-slate-600 mt-0.5 break-keep">
              {missingKws.length > 0
                ? `개선 포인트: '${missingKws[0]}' 키워드가 소개글에 없습니다`
                : chatgptMentioned === false
                  ? "ChatGPT 답변에 아직 내 가게가 등장하지 않습니다"
                  : "아래 발견 항목을 확인하세요"}
            </p>
          </div>
          <a
            href="#today-action"
            className="shrink-0 text-sm font-bold text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            오늘 할 일 보기 ↓
          </a>
        </div>

        {/* ── 1. 가게 헤더 (업종 배지 인라인 통합) ───────────────── */}
        {form.business_name ? (
          <div className="rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-5 py-5 mb-4 shadow-lg border border-white/10">
            {/* 레이블 */}
            <p className="text-sm font-bold text-blue-200 tracking-widest uppercase mb-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-300"></span>
              진단 대상 가게
            </p>
            <div className="flex items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                <Store className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-black text-white truncate leading-tight tracking-tight">
                  {form.business_name}
                </p>
                {form.region && (
                  <p className="text-base text-blue-200 mt-0.5 font-medium">{form.region}</p>
                )}
                <div className="mt-2">
                  <BriefingBadgeChip category={briefingCategory} />
                </div>
              </div>
              {result.place_match?.naver_place_url && (
                <a
                  href={result.place_match.naver_place_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-bold text-blue-700 bg-white hover:bg-blue-50 px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-md"
                >
                  네이버 플레이스 →
                </a>
              )}
            </div>
          </div>
        ) : (
          <BriefingCategoryBadge category={briefingCategory} />
        )}

        {/* ── 1.5 점수 요약 (처음 접속자용 즉시 이해) ──────────────────── */}
        <ScoreSummaryCard
          score={score}
          track1={track1}
          track2={track2}
          benchmarkAvg={benchmarkAvg}
          categoryLabel={categoryLabel}
          isEstimatedBenchmark={isEstimatedBenchmark}
        />

        {/* ── 2. 채널별 AI 검색 결과 (업종별 순서 분기)
             ACTIVE 업종: 네이버 AI 브리핑 먼저 → ChatGPT
             LIKELY/INACTIVE: ChatGPT 먼저 → 네이버는 섹션 3 안내로 대체 ── */}

        {briefingCategory === "active" && (
          <NaverBriefingResultCard
            businessName={form.business_name || "내 가게"}
            inBriefing={inBriefing}
            isLikely={false}
          />
        )}

        {chatgptMentioned !== undefined && (
          <ChatGPTResultCard
            businessName={form.business_name || "내 가게"}
            queries={chatgptDisplayQueries}
            mentioned={chatgptMentioned}
            excerpt={chatgptResult?.excerpt}
            sampleSize={chatgptSampleSize}
          />
        )}

        {briefingCategory === "likely" && (
          <NaverBriefingResultCard
            businessName={form.business_name || "내 가게"}
            inBriefing={inBriefing}
            isLikely={true}
          />
        )}

        {/* ── 3. 노출 채널 안내 (비대상 업종, 결론 다음) ──────────── */}
        {(briefingCategory === "inactive" || briefingCategory === "likely") && (
          <div className="rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-4 mb-4">
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900 leading-snug mb-1">
                  {briefingCategory === "likely"
                    ? "네이버 AI 브리핑은 현재 공식 대상이 아닙니다 (2026 확대 예정)"
                    : "네이버 AI 브리핑 대상 업종이 아닙니다"}
                </p>
                <p className="text-sm text-blue-700 leading-relaxed mb-3">
                  {briefingCategory === "likely"
                    ? "지금은 ChatGPT·Gemini 최적화와 네이버 검색 노출에 집중하면 효과적입니다."
                    : "그래도 개선하면 ChatGPT·Gemini 검색과 네이버 검색 노출 가능성이 높아집니다."}
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-blue-200">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900 break-keep">
                      <span className="font-semibold">스마트플레이스·소개글 개선</span> →
                      ChatGPT·Gemini가 가게 정보를 더 잘 인식해 검색에서 추천될 가능성이 높아집니다
                    </p>
                  </div>
                  <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-blue-200">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900 break-keep">
                      <span className="font-semibold">블로그 포스팅·리뷰 쌓기</span> →
                      네이버 AI 브리핑 대상이 아니어도 블로그 언급이 늘면 <span className="font-semibold text-blue-700">네이버 검색 노출에 직접 효과</span>가 있습니다
                    </p>
                  </div>
                  {briefingCategory === "inactive" && (
                    <div className="flex items-start gap-2 bg-blue-100 rounded-lg px-3 py-2 border border-blue-300 mt-1">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-900 break-keep">
                        <span className="font-semibold">AEOlab 구독 시 블로그 최적화 지원</span> —
                        업종별 키워드 기반 블로그 포스팅 전략, 경쟁사 블로그 분석, 매주 자동 측정으로 네이버 검색 노출 향상을 지원합니다
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. 측정 근거 + 발견 사항 ───────────────────────────── */}
        <ScanEvidenceCard
          result={result}
          analyzedKeyword={analyzedKeyword ?? selectedTags[0] ?? form.business_name ?? "내 가게"}
          chatgptFirstQuery={chatgptDisplayQueries[0]}
        />
        <FindingsCard
          chatgptMentioned={chatgptMentioned}
          inBriefing={inBriefing}
          blogCount={blogCount}
          missingKws={effectiveMissingKws}
          hasFaq={hasFaq}
          hasIntro={hasIntro}
          isSmartPlace={isSmartPlace}
          userGroup={userGroupValue}
          businessName={form.business_name || "내 가게"}
          categoryLabel={categoryLabel}
          benchmarkAvg={benchmarkAvg}
          score={score}
        />

        {/* ── 7. 지금 바로 할 핵심 액션 ──────────────────────────── */}
        <div id="today-action" />
        <TodayOneAction
          key={effectiveMissingKws[0] ?? "no-kw"}
          isSmartPlace={isSmartPlace}
          missingKws={effectiveMissingKws}
          hasFaq={hasFaq}
          inBriefing={inBriefing}
          faqText={effectiveFaqText}
          selectedTags={selectedTags}
          categoryLabel={categoryLabel}
          userGroup={userGroupValue}
          category={selectedCategory}
          isLoggedIn={isLoggedIn}
          onDismissKw={(kw) => setDismissedKws((prev) => [...prev, kw])}
        />

        {/* ── 8. 스마트플레이스 점검 ─────────────────────────────── */}
        {!result.smart_place_check && result.place_match && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mb-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-700">스마트플레이스 상세 점검</strong> —
              네이버 지역검색·모바일 검색 두 경로로 시도했지만 이 가게의 플레이스 ID를 자동으로 찾지 못해 소개글·소식·사진 수 등의 상세 점검을 건너뛰었습니다.
              <span className="block mt-1 text-slate-500">
                이런 경우는 보통 가게가 아직 스마트플레이스에 등록되지 않았거나(미등록), 등록되었더라도 검색 결과 상위에 노출되지 않을 때 발생합니다.
                정식 스캔에서는 가게 정보 입력 시 플레이스 URL을 직접 붙여 넣어 정확히 확인합니다.
              </span>
            </p>
          </div>
        )}
        {result.smart_place_check && (
          <SmartPlaceCheckCard check={result.smart_place_check} userGroup={userGroupValue} />
        )}

        {/* ── 9. 성장단계 이번 주 액션 ──────────────────────────── */}
        {gs?.this_week_action && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 mb-0.5 break-keep">
                이번 주 집중할 것 <span className="font-normal text-amber-600">({gsLabel})</span>
              </p>
              <p className="text-sm text-amber-700 leading-relaxed break-keep">{gs.this_week_action}</p>
            </div>
          </div>
        )}

        {/* ── 10. 트랙별 상세 아코디언 ───────────────────────────── */}
        <TrialDetailAccordion
          naverTrackCardProps={{
            track1Score: track1,
            inBriefing,
            isSmartPlace,
            blogCount,
            hasFaq,
            hasIntro,
            userGroup: userGroupValue,
            businessName: form.business_name || "내 가게",
          }}
          competitorGapCardProps={{
            businessName: form.business_name || "내 가게",
            searchQuery: (naver as { search_query?: string } | null)?.search_query,
            myRank: naver?.my_rank,
            blogCount,
            topCompetitorName: (
              naver as { top_competitor_name?: string | null } | null
            )?.top_competitor_name,
            topCompetitorBlogCount: (
              naver as { top_competitor_blog_count?: number } | null
            )?.top_competitor_blog_count,
            naverCompetitors: (
              naver as {
                naver_competitors?: { rank: number; name: string; address?: string }[];
              } | null
            )?.naver_competitors,
            blogSearchQuery: (naver as { blog_search_query?: string } | null)
              ?.blog_search_query,
            compBlogSearchQuery: (
              naver as { comp_blog_search_query?: string } | null
            )?.comp_blog_search_query,
            keywordRanks: (result as {
              keyword_ranks?: Array<{ query: string; rank: number | null; exposed: boolean }>;
            }).keyword_ranks,
          }}
          keywordCardProps={
            missingKws.length > 0
              ? {
                  missingKws,
                  faqText,
                  categoryLabel,
                  dismissed: dismissedKws,
                  onDismiss: (kw) => setDismissedKws((prev) => [...prev, kw]),
                  keywordMeta: (result as { keyword_meta?: Record<string, { subcategory: string; weight: number }> }).keyword_meta,
                  userGroup: userGroupValue,
                }
              : null
          }
          globalAiActionCardProps={{
            track2Score: track2,
            chatgptMentioned,
            chatgptSampleSize,
            geminiExposureFreq,
            blogCount,
            hasWebsite,
            missingKeywords: effectiveMissingKws,
            businessName: form.business_name || "내 가게",
            category: selectedCategory,
            region: form.region || "",
            userGroup: userGroupValue,
          }}
          factEvidenceSectionProps={{
            chatgptResult: chatgptResult ?? null,
            naver: result.naver ?? null,
            exposureFreq: result.score?.breakdown?.exposure_freq,
            totalSamples: 10,
            aiEvidence: aiEvidence ?? null,
            analyzedKeyword,
            region: form.region || undefined,
            userGroup: userGroupValue,
          }}
          problemDiagnosisProps={{
            businessName: form.business_name || "내 가게",
            category: selectedCategory,
            track1Score: track1,
            track2Score: track2,
            missingKeywords: effectiveMissingKws,
            hasFaq,
            hasRecentPost,
            hasIntro,
            isSmartPlace,
            blogMentions: blogCount,
            faqCopyText: effectiveFaqText,
            pioneerKeywords: effectivePioneerKws,
            reviewCopyText: (
              result as TrialScanResult & {
                review_copy_text?: string;
              }
            ).review_copy_text,
            selectedTags,
            region: form.region,
            userGroup: userGroupValue,
          }}
          scoreBreakdownProps={{
            userGroup: userGroupValue,
            naverChannelScore,
            globalChannelScore,
            groupBannerNode,
          }}
        />

        {/* ── 11. 체험 스캔 기준 + 측정 시점 ─────────────────────── */}
        <MergedScanInfoBox chatgptSampleSize={chatgptSampleSize} />

        {/* ── 12. 잠긴 점수 카드 — 구독 유도 ────────────────────── */}
        {!isLoggedIn && (
          <LockedScoreCard score={score} track1={track1} track2={track2} />
        )}

        {/* ── 13. ClaimGate — 근거 확인 후 저장 유도 ──────────── */}
        {!isLoggedIn && (
          <ClaimGate trialId={result.trial_id} initialEmail={form.email} />
        )}

        {/* ── 14. 구독 전환 섹션 ────────────────────────────────── */}
        <NextScanDateNote nextScanDate={nextScanDate} isLoggedIn={isLoggedIn} />
        <SubscriptionScreenshotPreview
          businessName={form.business_name || "내 가게"}
        />
        <SubscriptionValueCompare isLoggedIn={isLoggedIn} onSave={onSaveTrialData} />

        {/* ── 15. 공유 버튼 ──────────────────────────────────────── */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5 mb-4">
          <p className="text-sm md:text-base font-bold text-slate-800 mb-1 leading-snug break-keep">
            같은 동네 사장님께도 알려주세요
          </p>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed break-keep">
            결과 카드를 공유해 친구 가게도 무료 진단받게 하세요
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <KakaoShareButton
              score={result.score?.unified_score ?? result.score?.total_score ?? 0}
              businessName={form.business_name || "내 가게"}
              category={categoryLabel}
              region={form.region || ""}
              trialId={result.trial_id}
              benchmarkAvg={apiBenchmark?.avg_score}
            />
            <TextShareButton
              score={score}
              category={selectedCategory}
              topMissingKeywords={result.top_missing_keywords}
            />
          </div>
        </div>

        {/* ── 16. 재진단 버튼 ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          {!isLoggedIn && (
            <Link
              href="/signup"
              onClick={() => { onSaveTrialData(); handleSignupCTAClick(userGroupValue); }}
              className="flex-1 text-center bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm md:text-base"
            >
              {getSignupCTALabel(userGroupValue)}
            </Link>
          )}
          <button
            onClick={onReset}
            className="flex-1 border border-slate-300 text-slate-500 font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors text-sm"
          >
            다시 진단하기
          </button>
        </div>
      </div>
    </>
  );
}

// ── 체험 스캔 기준 + 측정 시점 통합 박스 ─────────────────────────────
function MergedScanInfoBox({ chatgptSampleSize }: { chatgptSampleSize: number }) {
  const now = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="bg-slate-700 rounded-xl px-4 py-4 mb-4">
      <div className="flex items-start gap-3 mb-3">
        <Info className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-base text-white font-bold leading-snug mb-1.5">
            이번 체험 스캔 기준
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Gemini <strong className="text-white font-semibold">10회</strong> + ChatGPT <strong className="text-white font-semibold">{chatgptSampleSize}회 질의</strong> + 네이버 스마트플레이스 자동 점검으로 측정한 결과입니다.
          </p>
        </div>
      </div>
      <div className="bg-slate-600 rounded-lg px-3 py-2 mb-3">
        <p className="text-sm text-slate-300 leading-relaxed">
          <span className="text-white font-semibold">Basic 구독</span>에서는 Gemini·ChatGPT 각{" "}
          <span className="text-white font-semibold">50회씩(총 100회)</span> + 네이버 스마트플레이스 주기 측정. Pro 이상에서 Google AI Overview 추가 측정합니다.
        </p>
      </div>
      <div className="border-t border-slate-500 pt-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
        <p className="text-sm text-slate-400">
          측정 시점: <span className="text-slate-300">{now}</span>
        </p>
        <p className="text-sm text-slate-400 sm:before:content-['·'] sm:before:mr-3">
          Basic 가입 시 → 매주 자동 측정 + 점수 변화 추적
        </p>
      </div>
    </div>
  );
}

// ── 업종 AI 브리핑 배지 ────────────────────────────────────────────────
function BriefingCategoryBadge({
  category,
}: {
  category: "active" | "likely" | "inactive";
}) {
  if (category === "active") {
    return (
      <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
        <p className="text-sm font-semibold text-green-800">
          네이버 AI 브리핑 노출 대상 업종입니다
        </p>
      </div>
    );
  }
  if (category === "likely") {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 mb-3 flex items-start gap-2">
        <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">
            ChatGPT·Gemini + 네이버 플레이스 검색 노출이 가능합니다
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            네이버 AI 브리핑은 현재 공식 대상이 아닙니다 (2026 상반기 확대 예정)
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-blue-50 border border-blue-300 rounded-xl px-4 py-2.5 mb-3 flex items-start gap-2">
      <Globe className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-blue-800">
          ChatGPT·Gemini·Google AI + 네이버 플레이스·블로그 검색 노출이 가능합니다
        </p>
        <p className="text-sm text-blue-700 mt-0.5">
          네이버 AI 브리핑 대상 업종이 아닙니다
        </p>
      </div>
    </div>
  );
}

// ── 점수 산식 투명 박스 ────────────────────────────────────────────────
interface BreakdownItem {
  label: string;
  weight: number;
  value: number | undefined;
  trialLimited?: boolean;
  trialNote?: string;
}

function ScoreBreakdownBox({
  breakdownItems,
  scoreInterpretation,
  unifiedScore,
}: {
  breakdownItems: BreakdownItem[];
  scoreInterpretation: { text: string; color: string; bg: string };
  unifiedScore: number;
}) {
  const hasAnyValue = breakdownItems.some((item) => item.value !== undefined);
  if (!hasAnyValue) return null;

  const ScoreIcon =
    unifiedScore >= 60 ? CheckCircle2 : unifiedScore >= 40 ? AlertTriangle : XCircle;
  const scoreIconColor =
    unifiedScore >= 60
      ? "text-green-600"
      : unifiedScore >= 40
        ? "text-amber-500"
        : "text-amber-600";

  return (
    <div id="score-breakdown" className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 mb-4 shadow-sm">
      {/* 점수 의미 해석 */}
      <div className={`rounded-xl px-3 py-2 mb-4 border ${scoreInterpretation.bg}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${scoreInterpretation.color}`}>
          <ScoreIcon className={`w-4 h-4 shrink-0 ${scoreIconColor}`} />
          {scoreInterpretation.text}
        </div>
      </div>

      {/* 점수 근거 안내 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
        <p className="text-sm md:text-base font-bold text-slate-700 mb-2">이 점수는 어떻게 계산하나요?</p>
        <ul className="space-y-1.5">
          <li className="text-sm md:text-base text-slate-600 flex items-start gap-2">
            <span className="text-slate-400 shrink-0 mt-0.5">•</span>
            <span><strong className="text-slate-700">0~100점</strong>으로 표현한 AI 검색 노출 가능성 — 점수가 높을수록 AI가 내 가게를 더 잘 추천합니다</span>
          </li>
          <li className="text-sm md:text-base text-slate-600 flex items-start gap-2">
            <span className="text-slate-400 shrink-0 mt-0.5">•</span>
            <span>네이버·ChatGPT 두 채널을 직접 측정한 실측값입니다 (체험 기준)</span>
          </li>
          <li className="text-sm md:text-base text-slate-600 flex items-start gap-2">
            <span className="text-slate-400 shrink-0 mt-0.5">•</span>
            <span>아래 5가지 항목을 각각 측정한 뒤 비율에 따라 합산합니다</span>
          </li>
        </ul>
      </div>

      <p className="text-sm font-bold text-gray-800 mb-3">
        항목별 측정 결과
      </p>
      <div className="space-y-3">
        {breakdownItems.map((item) => {
          const val = item.value ?? 0;
          const isUnmeasured = item.trialLimited && val === 0;
          const barColor =
            val >= 50 ? "bg-blue-500" : val >= 30 ? "bg-amber-400" : "bg-amber-300";
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700 font-medium">
                  {item.label}
                  <span className="ml-1.5 text-slate-400 font-normal">({item.weight}%)</span>
                </span>
                <span
                  className={`text-sm font-bold ${
                    isUnmeasured
                      ? "text-slate-400"
                      : item.value === undefined
                        ? "text-slate-400"
                        : val >= 50
                          ? "text-blue-700"
                          : val >= 30
                            ? "text-amber-700"
                            : "text-amber-600"
                  }`}
                >
                  {isUnmeasured ? "미측정" : item.value === undefined ? "N/A" : `${Math.round(val)}/100`}
                </span>
              </div>
              {isUnmeasured ? (
                <div className="w-full bg-slate-100 rounded-full h-2 flex items-center">
                  <div className="h-2 w-full rounded-full bg-slate-200" />
                </div>
              ) : (
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${barColor}`}
                    style={{ width: `${item.value === undefined ? 0 : Math.min(100, Math.round(val))}%` }}
                  />
                </div>
              )}
              {isUnmeasured && item.trialNote && (
                <p className="text-sm text-slate-500 mt-0.5">{item.trialNote}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-1.5 mt-3">
        <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-500 leading-relaxed">
          AEOlab 자체 측정값 · 네이버 공식 노출 점수 아님 · 측정 시점·기기·로그인 상태에 따라 ±5점 변동 가능
        </p>
      </div>
    </div>
  );
}


// ── 네이버 AI 브리핑 결과 카드 ────────────────────────────────────────
function NaverBriefingResultCard({
  businessName,
  inBriefing,
  isLikely,
}: {
  businessName: string;
  inBriefing: boolean | null;
  isLikely?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm mb-4 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100" style={{ background: "rgba(3,199,90,0.08)" }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "#03c75a" }}>
            <span className="text-white text-xs font-bold leading-none">N</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">네이버 AI 브리핑 검색 결과</span>
        </div>
        {isLikely && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">2026 확대 예정</span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* 결론 */}
        {inBriefing === null ? (
          !isLikely ? (
            /* ACTIVE 업종 — 전환 유도 UI */
            <div className="space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                음식점·카페는 <strong className="text-slate-900">네이버 AI 브리핑 자동 노출 확인 대상</strong>입니다.
                체험 스캔은 ChatGPT 측정 중심으로 진행되며, 네이버 AI 브리핑 실측 확인은 정식 스캔에서 제공합니다.
              </p>
              {/* 잠금된 결과 미리보기 */}
              <div className="relative rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 blur-sm select-none pointer-events-none" aria-hidden="true">
                  <p className="text-base font-semibold text-gray-800 mb-1">
                    &ldquo;{businessName}&rdquo;이 이번 네이버 검색에서 AI 브리핑에 ···
                  </p>
                  <p className="text-sm text-gray-500">주요 원인 분석 · 개선 액션 3가지</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-semibold">정식 스캔에서 확인 가능</span>
                  </div>
                </div>
              </div>
              {/* CTA */}
              <a
                href="/pricing"
                className="flex items-center justify-center gap-1.5 w-full text-center font-semibold text-sm px-4 py-3 rounded-xl text-white transition-colors"
                style={{ background: "#03c75a" }}
              >
                내 가게 AI 브리핑 노출 확인하기 → Basic 시작 (첫 달 4,950원)
              </a>
            </div>
          ) : (
            /* LIKELY 업종 — 확대 예정 안내 */
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-amber-800 mb-1">2026 확대 예정 업종</p>
              <p className="text-sm text-amber-700 leading-relaxed">
                현재 네이버 AI 브리핑 공식 대상이 아니지만 2026년 상반기 확대 예정입니다.
                정식 스캔에서 노출 가능 여부를 주기적으로 모니터링합니다.
              </p>
            </div>
          )
        ) : (
          <p className="text-base font-semibold leading-snug text-gray-800">
            &ldquo;{businessName}&rdquo;이 이번 네이버 검색에서{" "}
            {inBriefing === true ? (
              <span className="text-green-700">AI 브리핑에 노출됐습니다.</span>
            ) : (
              <span className="text-slate-700">AI 브리핑에 아직 노출되지 않았습니다.</span>
            )}
          </p>
        )}

        {/* 노출 중 */}
        {inBriefing === true && (
          <div className="border-l-2 border-green-400 pl-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              이미 네이버 AI 브리핑에 가게가 인용되고 있습니다. 경쟁 가게보다 더 자주 노출되려면
              리뷰 키워드 다양성을 높이고 소식을 주기적으로 업로드하세요.
            </p>
          </div>
        )}

        {/* 미노출 — 원인 */}
        {inBriefing === false && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">주요 원인</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-400 shrink-0 mt-px">•</span>
                소개글에 Q&A 형식의 구조화된 정보 없음 — AI가 인용할 텍스트 부족
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-400 shrink-0 mt-px">•</span>
                리뷰 키워드 다양성 부족 — 업종 대표 키워드가 리뷰에 충분히 쌓이지 않음
              </li>
            </ul>
          </div>
        )}

        {/* 미노출 — 지금 할 일 */}
        {inBriefing === false && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">지금 할 일</p>
            <ol className="space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-500 shrink-0 font-semibold mt-px">1.</span>
                소개글 끝에 Q&A 3개 추가 — &ldquo;가격은?&rdquo; &ldquo;예약은?&rdquo; &ldquo;주차는?&rdquo;
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-500 shrink-0 font-semibold mt-px">2.</span>
                2주에 1회 소식 업로드로 최신성 점수 유지
              </li>
            </ol>
          </div>
        )}

      </div>

      {/* 면책 */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-sm text-gray-400 leading-relaxed">
          네이버 AI 브리핑은 검색어·시점·기기·로그인 상태에 따라 달라질 수 있습니다.
        </p>
      </div>
    </div>
  );
}

// ── ChatGPT 검색 결과 카드 (GPT 답변 스타일 — 결론→원인→액션) ──────────
function ChatGPTResultCard({
  businessName,
  queries,
  mentioned,
  excerpt,
  sampleSize,
}: {
  businessName: string;
  queries: string[];
  mentioned: boolean;
  excerpt?: string;
  sampleSize: number;
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm mb-4 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold leading-none">G</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">ChatGPT 검색 결과</span>
        </div>
        <span className="text-sm text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {sampleSize}회 질의 기준
        </span>
      </div>

      {/* 본문 */}
      <div className="px-4 py-4 space-y-3">
        {/* 질의 목록 */}
        <div>
          <p className="text-sm text-gray-400 mb-1.5 leading-snug">
            실제 손님이 AI에게 묻는 방식으로 {sampleSize}회 테스트했습니다
          </p>
          <ul className="space-y-0.5 mb-2">
            {queries.map((q, i) => (
              <li key={i} className="text-sm font-medium text-gray-700">
                &ldquo;{q}&rdquo;
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-400 leading-snug">
            손님은 가게 이름을 모른 채 업종·지역 키워드로 AI에 묻습니다.
            위 질의에 &ldquo;{businessName}&rdquo;이 추천됐는지 확인한 결과입니다.
          </p>
        </div>

        {/* 결론 */}
        <p className="text-base font-semibold leading-snug text-gray-800">
          &ldquo;{businessName}&rdquo;는 이번 검색에서 추천 목록에{" "}
          {mentioned ? (
            <span className="text-green-700">포함됐습니다.</span>
          ) : (
            <span className="text-red-600">포함되지 않았습니다.</span>
          )}
        </p>

        {/* 포함된 경우: 발췌 */}
        {mentioned && excerpt && (
          <div className="border-l-2 border-green-400 pl-3">
            <p className="text-sm text-gray-600 italic leading-relaxed">
              &ldquo;{excerpt.length > 150 ? excerpt.slice(0, 150) + "…" : excerpt}&rdquo;
            </p>
          </div>
        )}

        {/* 미포함: 원인 */}
        {!mentioned && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">원인</p>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-400 shrink-0 mt-px">•</span>
                소개글에 Q&amp;A 형식의 구조화된 정보 없음
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-400 shrink-0 mt-px">•</span>
                AI가 인용할 키워드 텍스트 부족 — 인용 후보 탈락
              </li>
            </ul>
          </div>
        )}

        {/* 미포함: 지금 할 일 */}
        {!mentioned && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1.5">지금 할 일</p>
            <ol className="space-y-1.5">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-500 shrink-0 font-semibold mt-px">1.</span>
                소개글 끝에 Q&amp;A 3개 추가 — &ldquo;가격은?&rdquo; &ldquo;예약은?&rdquo; &ldquo;주차는?&rdquo;
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-gray-500 shrink-0 font-semibold mt-px">2.</span>
                아래 개선 가이드에서 키워드별 대응 방법 확인
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* 면책 */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-sm text-gray-400 leading-relaxed">
          ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
          측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
        </p>
      </div>
    </div>
  );
}

// ── 다음 측정일 안내 (경량 버전 — SubscriptionValueCompare 바로 위) ──
function NextScanDateNote({
  nextScanDate,
  isLoggedIn,
}: {
  nextScanDate: string;
  isLoggedIn: boolean;
}) {
  if (isLoggedIn) return null;
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
      <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
      <p className="text-sm text-slate-600 leading-snug">
        지금 가입하면 다음 자동 측정:{" "}
        <span className="font-bold text-slate-800">{nextScanDate}</span>
        <span className="ml-1.5 text-slate-400">· 매주 변화 감지 + 카카오 알림</span>
      </p>
    </div>
  );
}

// ── 헤더 내 업종 배지 칩 (인라인용) ──────────────────────────────────
function BriefingBadgeChip({
  category,
}: {
  category: "active" | "likely" | "inactive";
}) {
  if (category === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-green-700 bg-white rounded-full px-3 py-1 shadow-sm whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        네이버 AI 브리핑 대상
      </span>
    );
  }
  if (category === "likely") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-200 bg-white/20 border border-amber-300/60 rounded-full px-3 py-1 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        ChatGPT·Gemini + AI 브리핑 확대 예정
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-white/20 border border-white/40 rounded-full px-3 py-1 whitespace-nowrap">
      <Globe className="w-3.5 h-3.5 shrink-0" />
      ChatGPT·Gemini + 네이버 검색 노출
    </span>
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
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 bg-blue-600 text-white px-4 pt-4 pb-4 z-50 shadow-2xl"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold leading-snug">
            7일 후 AI가 내 가게를 인식했는지 자동으로 확인해 드립니다
          </p>
          <p className="text-sm md:text-base text-blue-200 mt-0.5">
            <span className="text-emerald-300 font-semibold">첫 달 {FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원</span>
            {" "}· 이후 월 {PLAN_PRICES.basic.toLocaleString()}원 · 언제든 해지
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
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SmartPlaceCheckCard ───────────────────────────────────────────────
function SmartPlaceCheckCard({ check, userGroup }: { check: TrialSmartPlaceCheck; userGroup?: string }) {
  const isActive = userGroup === "ACTIVE";
  if (check.error) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          <strong className="text-slate-700">스마트플레이스 자동 점검</strong> —
          네이버 서버 응답 지연으로 이번 체험에서는 점검하지 못했습니다.
          정식 스캔에서는 리뷰 수·평점·사진 수·소식 여부를 자동으로 확인합니다.
        </p>
      </div>
    );
  }

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
    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 md:p-6 mb-5 shadow-sm">
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
              {item.checked ? (
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <X className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <span
                className={`text-sm md:text-base font-semibold break-keep ${
                  item.checked ? "text-emerald-800" : "text-red-800"
                }`}
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
            스마트플레이스 4개 항목 모두 등록 완료
          </p>
          <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
            {isActive
              ? "네이버 AI 브리핑 노출에 필요한 기본 조건은 갖추셨습니다. 이제 키워드와 리뷰로 점수를 더 올려보세요."
              : "네이버 플레이스 기본 조건은 갖추셨습니다. ChatGPT·Gemini도 네이버 플레이스 정보를 참고합니다."}
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <p className="text-sm md:text-base font-bold text-amber-800 leading-relaxed">
            이 항목들 누락으로 약 -{check.score_loss}점 손실 중
          </p>
          <p className="text-sm text-amber-700 mt-1 leading-relaxed">
            {isActive
              ? "빨간색 항목을 등록하면 네이버 AI 브리핑 노출 점수가 즉시 올라갑니다."
              : "빨간색 항목을 등록하면 네이버 플레이스 노출과 ChatGPT·Gemini의 가게 인식이 향상됩니다."}
          </p>
        </div>
      )}

      {/* AI탭 품질 향상 참고 사항 — 점수 미반영, advisory only */}
      {(check.has_reservation !== undefined || check.photo_count !== undefined) && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-500 mb-2">AI탭 품질 향상 참고 사항 (점수 미반영)</p>
          <div className="flex flex-col gap-2">
            {check.has_reservation !== undefined && (
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                  check.has_reservation
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                {check.has_reservation ? (
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className="text-sm text-gray-700 flex-1 break-keep">
                  {check.has_reservation
                    ? "네이버 예약 연동됨 — AI탭 결과에 예약 버튼 표시됩니다"
                    : "네이버 예약 미연동 — 설정하면 AI탭 결과에 예약 버튼이 표시됩니다"}
                </span>
                {!check.has_reservation && check.action_links?.reservation && (
                  <a
                    href={check.action_links.reservation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap transition-colors"
                  >
                    설정하기 →
                  </a>
                )}
              </div>
            )}
            {check.photo_count !== undefined && (
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                  (check.photo_count ?? 0) >= 10
                    ? "bg-blue-50 border-blue-200"
                    : "bg-amber-50 border-amber-200"
                }`}
              >
                <Info
                  className={`w-4 h-4 shrink-0 ${
                    (check.photo_count ?? 0) >= 10 ? "text-blue-500" : "text-amber-500"
                  }`}
                />
                <span className="text-sm text-gray-700 break-keep">
                  사진 {check.photo_count ?? 0}장 등록
                  {(check.photo_count ?? 0) < 10
                    ? " — 10장 이상 권장 (AI탭 노출 품질 향상)"
                    : " — 충분한 사진이 등록되어 있습니다"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
