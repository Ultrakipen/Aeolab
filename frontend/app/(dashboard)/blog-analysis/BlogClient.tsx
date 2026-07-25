"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSafeSession } from "@/lib/supabase/client";
import {
  Search,
  Copy,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FileText,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  CalendarDays,
  X,
  Globe,
  BarChart2,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { PlanGate } from "@/components/common/PlanGate";
import { KeywordManagerModal } from "@/components/dashboard/KeywordManagerModal";
import { addExcludedKeyword } from "@/lib/api";
import Link from "next/link";
import { getBriefingEligibility, type BriefingEligibility } from "@/lib/userGroup";
import { useBriefingCategories } from "@/lib/useBriefingCategories";
import { getScoreTextLabel } from "@/lib/scoreLabels";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const STALE_DAYS = 7;

interface Business {
  id: string;
  name: string;
  category: string;
  region: string;
  keywords?: string[];
  blog_url?: string;
  blog_analyzed_at?: string | null;
  is_franchise?: boolean;
}

interface PostDetail {
  title: string;
  link: string;
  date: string | null;
  post_score: number;
  title_seo_score: number;
  issues: string[];
  positives?: string[];
  suggestion: string;
  improved_title: string;
  // RSS 경로에서만 실측(-1이면 API 전용 수집이라 측정 불가)
  img_count?: number;
  heading_count?: number;
  full_text_len?: number;
  // AI 인용 매칭 (백엔드 v4+ 신규 필드)
  is_cited?: boolean;
  cited_confirmed?: boolean;
}

interface WeeklyAction {
  priority: number;
  action: string;
  impact: "high" | "medium" | "low";
  reason: string;
}

interface TopicSuggestionV2 {
  topic: string;
  reason: string;
  priority: "high" | "medium" | "low";
  source: "competitor_gap" | "keyword_gap" | "reuse";
  monthly_volume?: number | null;
  competition?: "high" | "medium" | "low" | "unknown" | null;
  volume_trend?: {
    from_date: string;
    to_date: string;
    from_volume: number;
    to_volume: number;
    pct_change: number | null;
  } | null;
}

interface CompetitorBlogComparison {
  // 키워드별 경쟁사 점유 현황 (백엔드 v4+ 신규 필드)
  competitor_keyword_detail?: Array<{
    keyword: string;
    covered_by: string[];
    my_status: string;
  }>;
}

interface BlogAnalysisResult {
  id?: string;
  business_id?: string;
  blog_url?: string;
  platform?: string;
  citation_score?: number;
  post_count?: number;
  total_post_count?: number;
  // 티스토리 등 외부 블로그는 단일 페이지 추정치 — 네이버(API 정확 카운트)는 false
  is_post_count_estimated?: boolean;
  freshness_score?: number;
  keyword_coverage?: {
    present: string[];
    missing: string[];
    competitor_only: string[];
  };
  top_recommendation?: string;
  missing_keywords?: string[];
  analyzed_at?: string;
  // v2 fields
  posts_detail?: PostDetail[];
  weekly_actions?: WeeklyAction[];
  competitor_blog_comparison?: CompetitorBlogComparison | null;
  content_type?: string;
  promotional_ratio?: number;
  informational_ratio?: number;
  content_issue?: string;
  title_suggestions?: string[];
  // v2: 이번 달 블로그 주제 추천
  topic_suggestions_v2?: TopicSuggestionV2[];
  // v3 fields
  posting_frequency?: {
    monthly_counts: Record<string, number>;
    total_analyzed: number;
    avg_interval_days: number;
    consistency: "active" | "regular" | "irregular" | "inactive" | "bursty";
    recommended_posts_per_month: number;
    recommended_next_date: string;
    consistency_message: string;
  };
  best_citation_candidate?: {
    title: string;
    link: string;
    post_score: number;
    title_seo_score: number;
    what_to_add: string;
    reason: string;
  };
  duplicate_topics?: Array<{
    keyword: string;
    count: number;
    titles: string[];
    warning: string;
    suggestion: string;
  }>;
  templated_content?: Array<{
    titles: string[];
    similarity: number;
    warning: string;
    suggestion: string;
  }>;
  ai_readiness_items?: Array<{
    label: string;
    passed: boolean | null;
    unavailable?: boolean;
    description?: string;
  }>;
  // 월 사용량 (GET/POST 응답에 포함)
  monthly_used?: number;
  monthly_limit?: number;
  // 측정 자체가 실패한 경우(네이버 API/RSS 접근 불가 등) — null/undefined면 정상 측정
  error?: string | null;
  // RSS 접근 실패로 API 스니펫만으로 분석했을 때 true (이미지·본문 길이 측정 불가)
  rss_failed?: boolean;
  // 채널별 AI 인용 현황 (최근 3회 스캔, 백엔드 v4+ 신규 필드)
  multi_channel_citations?: Record<string, { mentioned_count: number; total: number; text_count?: number; image_count?: number }>;
  // 업종 평균 대비 채널별 인용률 텍스트 레이블 (2026-07-17 신규)
  citation_benchmark?: Record<string, string>;
  // 블로그 언급 수 경쟁사 비교 (백엔드 v4+ 신규 필드)
  competitor_blog_mentions?: {
    my_count: number;
    competitors: Array<{ name: string; blog_mention_count: number }>;
    avg_count: number;
  };
}

interface Props {
  businesses: Business[];
  currentPlan: string;
  accessToken: string;
  initialBizId?: string | null;
}

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

function platformBadge(platform?: string) {
  if (!platform) return null;
  const cfg: Record<string, { label: string; className: string }> = {
    naver: { label: "네이버 블로그", className: "bg-green-100 text-green-700 border-green-200" },
    tistory: { label: "티스토리", className: "bg-orange-100 text-orange-700 border-orange-200" },
    wordpress: { label: "워드프레스", className: "bg-blue-100 text-blue-700 border-blue-200" },
    external: { label: "외부 블로그", className: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  const c = cfg[platform.toLowerCase()] ?? cfg.external;
  return (
    <span className={`inline-flex items-center border text-sm font-medium px-3 py-1 rounded-full ${c.className}`}>
      {c.label}
    </span>
  );
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

// citation_score 레이블은 반드시 lib/scoreLabels.ts의 getScoreTextLabel과 동일한 기준을 써야 함 —
// 과거 여기 자체 임계값(70/40)을 썼다가 이 페이지의 추이 차트(getScoreTextLabel, 75/55/30)와
// 같은 점수에 다른 라벨이 뜨는 모순이 있었음(2026-07-06 발견·수정)
function scoreBgColor(score: number) {
  if (score >= 75) return "bg-green-50 border-green-200";
  if (score >= 55) return "bg-amber-50 border-amber-200";
  if (score >= 30) return "bg-red-50 border-red-200";
  return "bg-gray-50 border-gray-200";
}

function postScoreBadge(score: number) {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-300";
  if (score >= 40) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-red-100 text-red-700 border-red-300";
}

function postScoreLabel(score: number) {
  if (score >= 70) return "우수";
  if (score >= 40) return "보통";
  return "개선 필요";
}

function freshnessLabel(score: number) {
  if (score >= 70) return "최신 콘텐츠 양호";
  if (score >= 40) return "업데이트 권장";
  return "오래된 콘텐츠";
}

// 포스트 AI 인용 상태 배지 — is_cited/cited_confirmed 3단계
// - cited_confirmed=true: 정확 매칭 (높은 신뢰도)
// - is_cited=true, cited_confirmed=false: 블로그 단위 매칭 (낮은 신뢰도)
// - is_cited=false: 과거 스캔 데이터라 미확인일 수 있음 → "단정 금지" 원칙 준수 ("아직 미인용" 아님)
// - undefined: 구 분석 결과 (필드 없음) → null 반환해 렌더 생략
function citationStatusBadge(p: PostDetail) {
  if (p.cited_confirmed) {
    return (
      <span className="inline-flex items-center border text-sm font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border-green-300">
        네이버 인용 확인됨
      </span>
    );
  }
  if (p.is_cited === true) {
    return (
      <span className="inline-flex items-center border text-sm font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border-blue-300">
        네이버 인용 가능성 있음
      </span>
    );
  }
  if (p.is_cited === false) {
    return (
      <span className="inline-flex items-center border text-sm font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border-gray-200">
        확인 안 됨
      </span>
    );
  }
  return null;
}

function impactBadge(impact: string) {
  if (impact === "high") return "bg-red-100 text-red-700 border-red-300";
  if (impact === "medium") return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-gray-100 text-gray-600 border-gray-300";
}

function isStale(lastAnalyzedAt: string | null): boolean {
  if (!lastAnalyzedAt) return true;
  const elapsed = Date.now() - new Date(lastAnalyzedAt).getTime();
  return elapsed > STALE_DAYS * 24 * 60 * 60 * 1000;
}

/* ── MethodologyDisclosureBar: 이 진단의 근거 — 실측 수치만 정직하게 표시 ── */
function MethodologyDisclosureBar({
  postCount,
  isPostCountEstimated,
  citations,
}: {
  postCount: number;
  isPostCountEstimated?: boolean;
  citations: Record<string, { mentioned_count: number; total: number }>;
}) {
  const totalMeasurements = Object.values(citations || {}).reduce(
    (sum, c) => sum + (c?.total || 0), 0
  );
  const channelCount = Object.keys(citations || {}).length;
  if (postCount === 0 && totalMeasurements === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
      <Info className="w-4 h-4 text-gray-400 shrink-0" />
      <span>
        이 진단의 근거 · 블로그 포스트 <strong className="text-gray-700">{postCount}개</strong> 실측 분석{isPostCountEstimated ? " (추정)" : ""}
        {totalMeasurements > 0 && (
          <> · {channelCount}개 채널 총 <strong className="text-gray-700">{totalMeasurements}회</strong> 실측 스캔 기반</>
        )}
      </span>
      <Link href="/how-it-works" className="text-indigo-600 hover:underline ml-auto shrink-0">
        측정 방법론 보기
      </Link>
    </div>
  );
}

/* ── Layer 1+3: 정보형 AI 브리핑 준비도 (상태 레이블·실측 근거·변화 확인) ── */
function InfoBriefingReadinessCard({
  result,
  eligibility,
  businessId,
  platform,
  blogUrl,
}: {
  result: BlogAnalysisResult;
  eligibility: BriefingEligibility;
  businessId: string;
  platform?: string;
  blogUrl?: string;
}) {
  const score = result.citation_score ?? 0;
  const label = getScoreTextLabel(score);
  const present = result.keyword_coverage?.present?.length ?? 0;
  const total = present + (result.keyword_coverage?.missing?.length ?? 0);
  const posts = result.post_count ?? 0;

  // 근거 1줄 — 실측값만 (CLAUDE.md 실측 원칙: 더미·추정 금지)
  const evidenceBits: string[] = [];
  if (posts > 0) evidenceBits.push(`블로그 글 ${posts}개 분석${result.is_post_count_estimated ? " (추정)" : ""}`);
  evidenceBits.push(`최신성 ${freshnessLabel(result.freshness_score ?? 0)}`);
  if (total > 0) evidenceBits.push(`핵심 키워드 ${present}/${total} 반영`);
  if (result.posting_frequency?.consistency) {
    const cmap: Record<string, string> = {
      active: "발행 꾸준함",
      regular: "발행 규칙적",
      irregular: "발행 불규칙",
      inactive: "발행 휴면",
      bursty: "발행 몰아쓰기",
    };
    evidenceBits.push(cmap[result.posting_frequency.consistency] ?? "");
  }

  // Layer 3: 지난 분석 대비 준비도 변화 (localStorage, 텍스트만)
  const [prevLabel, setPrevLabel] = useState<string | null>(null);
  useEffect(() => {
    const key = `aeolab_info_briefing_readiness_${businessId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved && saved !== label) setPrevLabel(saved);
      localStorage.setItem(key, label);
    } catch { /* localStorage 차단 환경 무시 */ }
  }, [businessId, label]);

  // getScoreTextLabel과 동일한 4단계(시작 전 포함) — 순서가 어긋나면 changeDir(변화 방향)이 틀어짐
  const order = ["시작 전", "주의 필요", "보통", "양호"];
  const changeDir = prevLabel ? order.indexOf(label) - order.indexOf(prevLabel) : 0;

  return (
    <div className={`border rounded-xl p-4 md:p-6 ${scoreBgColor(score)}`}>
      {/* Layer 1: 상태 헤딩 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <TrendingUp className="w-5 h-5 text-indigo-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">정보형 네이버 AI 브리핑 준비도</h3>
        <span className="inline-flex items-center border text-sm font-semibold px-2.5 py-0.5 rounded-full bg-white/70 border-gray-300 text-gray-600">
          블로그·콘텐츠 기반 · 전 업종
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {platformBadge(platform)}
          {blogUrl && (
            <a
              href={blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              블로그 열기 <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${scoreColor(score)}`}>{label}</div>
          <div className="text-sm text-gray-500 mt-0.5">분석 시점 기준 — 측정 시점·기기에 따라 달라질 수 있음</div>
        </div>
      </div>

      {/* Layer 1: 실측 근거 1줄 */}
      <p className="text-sm text-gray-600 mt-3 leading-relaxed">
        <span className="font-semibold text-gray-700">근거</span> · {evidenceBits.filter(Boolean).join(" · ")}
      </p>

      {/* Layer 3: 지난 분석 대비 변화 */}
      {prevLabel && changeDir !== 0 && (
        <p className={`text-sm mt-1 font-medium ${changeDir > 0 ? "text-green-700" : "text-amber-700"}`}>
          지난 분석 대비 <span className="font-semibold">{prevLabel} → {label}</span> {changeDir > 0 ? "↑ 개선" : "↓ 하락"}
        </p>
      )}

      {/* Layer 1: 실측 통계 타일 */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{posts}</div>
          <div className="text-sm text-gray-500 mt-0.5">(제목·요약 기준)</div>
          <div className="text-sm text-gray-500 mt-0.5">분석 포스트</div>
        </div>
        <div className="bg-white/70 rounded-xl p-3 text-center">
          <div className="text-base font-bold text-gray-700">{freshnessLabel(result.freshness_score ?? 0)}</div>
          <div className="text-sm text-gray-500 mt-0.5">최신성</div>
        </div>
        <div className="bg-white/70 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
          <div className="text-xl font-bold text-gray-900">{present} / {total}</div>
          <div className="text-sm text-gray-500 mt-0.5">확인된 키워드</div>
        </div>
      </div>

      {/* 인과 설명 — 정보형 브리핑은 전 업종 */}
      <div className="mt-4 bg-white/60 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
        <span className="font-semibold text-indigo-700">왜 중요한가요?</span> 블로그·콘텐츠가 충실하면 네이버가 이를 출처로 채택해{" "}
        <span className="font-semibold">정보형 AI 브리핑(추천·요약형)</span>에 인용합니다. 정보형은 업종 제한이 없어 사진·학원·법무 등{" "}
        <span className="font-semibold">전 업종이 노출 대상</span>이며, 같은 콘텐츠가 ChatGPT·Gemini·Google AI 노출에도 함께 작용합니다.
        {eligibility === "active" && " 이 업종은 가게를 직접 요약하는 '플레이스형' AI 브리핑 대상이기도 합니다."}
      </div>
    </div>
  );
}

/* ── WeeklyActionsCard ── */
function WeeklyActionsCard({ actions, businessId }: { actions: WeeklyAction[]; businessId: string }) {
  const storageKey = `aeolab_blog_weekly_actions_${businessId}`;
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggle = (idx: number) => {
    const next = { ...checked, [idx]: !checked[idx] };
    setChecked(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  if (!actions || actions.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-blue-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-blue-900">이번 주 할 일</h3>
        <span className="text-sm text-blue-500 ml-auto">
          {Object.values(checked).filter(Boolean).length}/{actions.length} 완료
        </span>
      </div>
      <p className="text-sm text-blue-700 mb-3 leading-relaxed bg-white/60 border border-blue-100 rounded-lg px-3 py-2">
        ✓ 완료할수록 <span className="font-semibold">네이버 정보형 AI 브리핑 인용</span> + ChatGPT·Gemini 노출 가능성이 올라갑니다
      </p>
      <div className="space-y-3">
        {actions.map((a, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 bg-white rounded-xl p-3 md:p-4 border transition-all ${checked[idx] ? "border-green-200 opacity-60" : "border-gray-200"}`}
          >
            <button
              onClick={() => toggle(idx)}
              className={`w-6 h-6 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${checked[idx] ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-blue-400"}`}
            >
              {checked[idx] && <CheckCircle2 className="w-4 h-4" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`inline-flex items-center border text-sm font-semibold px-2 py-0.5 rounded-full shrink-0 ${impactBadge(a.impact)}`}>
                  {a.impact === "high" ? "높음" : a.impact === "medium" ? "중간" : "낮음"}
                </span>
                <p className={`text-sm md:text-base font-semibold text-gray-900 ${checked[idx] ? "line-through" : ""}`}>
                  {a.action}
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-1">{a.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PostDetailSection ── */
function PostDetailSection({ posts }: { posts: PostDetail[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!posts || posts.length === 0) return null;

  const shown = expanded ? posts : posts.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">포스트별 상세 분석</h3>
        <span className="text-sm text-gray-500 ml-auto">상위 {posts.length}개</span>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-sm text-slate-700 leading-relaxed">
        <p className="font-semibold text-slate-800 mb-1">💡 두 가지 키워드를 구분해서 보여드립니다</p>
        <p>
          <span className="font-semibold text-green-700">업종 키워드</span>(웨딩스냅·돌잔치 스냅·프로필 촬영 등) —{" "}
          AI가 업종 인식하는 용도 · <span className="font-semibold text-red-600">검색 의도어</span>(추천·후기·비교·가격 등) —{" "}
          AI 검색이 인용할 &quot;정보성 글&quot;로 분류하는 신호.
          <br />
          <span className="text-slate-600">
            예: <span className="font-medium">&quot;창원 웨딩스냅&quot;</span>만 있으면 포트폴리오로 판단, <span className="font-medium">&quot;창원 웨딩스냅 추천&quot;</span>이면 AI 인용 대상.
          </span>
          <br />
          <span className="text-slate-600">
            <span className="font-semibold">상태</span> 배지는 이 글의 전반적인 진단 결과, <span className="font-semibold">SEO</span> 배지는 제목이 검색에 얼마나 잘 잡히는지를 각각 나타냅니다. 제목 개선 제안은 이 표 아래 카드에서 바로 복사할 수 있습니다.
          </span>
          <br />
          <span className="text-slate-600">
            <span className="font-semibold">네이버 인용 확인됨/가능성 있음</span> 배지는 네이버 AI 브리핑(정보형)이 이 포스트를 출처로 쓴 기록을 실측 대조한 결과입니다.
            ChatGPT·Gemini·Google의 채널별 인용 여부는 이 글 단위가 아닌 사업장 단위로 위 &quot;채널별 AI 인용 현황&quot;에서 확인하세요.
          </span>
        </p>
      </div>

      {/* PC: 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm table-fixed">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[40%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-3 pr-3 font-semibold text-gray-600">제목</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">날짜</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">상태</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">SEO</th>
              <th className="pb-3 pl-3 font-semibold text-gray-600">문제점</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                <td className="py-3 pr-3">
                  <div className="flex flex-col gap-1">
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium line-clamp-2 break-keep">
                        {p.title || "(제목 없음)"}
                      </a>
                    ) : (
                      <span className="text-gray-800 font-medium line-clamp-2 break-keep">{p.title || "(제목 없음)"}</span>
                    )}
                    {citationStatusBadge(p)}
                  </div>
                </td>
                <td className="py-3 text-center text-gray-500 whitespace-nowrap">
                  {p.date ? new Date(p.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "-"}
                </td>
                <td className="py-3 text-center">
                  <span className={`inline-flex items-center border text-sm font-bold px-2 py-0.5 rounded-full ${postScoreBadge(p.post_score)}`}>
                    {postScoreLabel(p.post_score)}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className={`inline-flex items-center border text-sm font-bold px-2 py-0.5 rounded-full ${postScoreBadge(p.title_seo_score)}`}>
                    {postScoreLabel(p.title_seo_score)}
                  </span>
                </td>
                <td className="py-3 pl-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(p.positives ?? []).map((pos, i) => (
                      <span
                        key={`pos-${i}`}
                        className="bg-green-50 text-green-700 border border-green-200 text-sm px-2 py-0.5 rounded-lg whitespace-normal break-keep leading-snug"
                      >
                        ✓ {pos}
                      </span>
                    ))}
                    {p.full_text_len === -1 && (
                      <span className="bg-gray-50 text-gray-500 border border-gray-200 text-sm px-2 py-0.5 rounded-lg whitespace-normal break-keep leading-snug">
                        본문 길이 측정 불가 (API 수집)
                      </span>
                    )}
                    {p.issues.length === 0 && (p.positives?.length ?? 0) === 0 ? (
                      <span className="text-green-600 text-sm font-medium">양호</span>
                    ) : (
                      p.issues.map((issue, i) => (
                        <span
                          key={`iss-${i}`}
                          className="bg-red-50 text-red-600 border border-red-200 text-sm px-2 py-0.5 rounded-lg whitespace-normal break-keep leading-snug"
                        >
                          {issue}
                        </span>
                      ))
                    )}
                  </div>
                  {p.suggestion && (
                    <p className="text-sm text-gray-500 mt-1 leading-snug">{p.suggestion}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: 카드 */}
      <div className="md:hidden space-y-3">
        {shown.map((p, idx) => (
          <div key={idx} className={`border rounded-xl p-4 ${p.post_score < 40 ? "border-red-200 bg-red-50/30" : p.post_score < 70 ? "border-amber-200 bg-amber-50/30" : "border-green-200 bg-green-50/30"}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-700 hover:underline line-clamp-2">
                    {p.title || "(제목 없음)"}
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-gray-900 line-clamp-2">{p.title || "(제목 없음)"}</span>
                )}
                {p.date && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {new Date(p.date).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                )}
                {citationStatusBadge(p) !== null && (
                  <div className="mt-1">{citationStatusBadge(p)}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <span className={`inline-flex items-center border text-sm font-bold px-2.5 py-0.5 rounded-full ${postScoreBadge(p.post_score)}`}>
                  {postScoreLabel(p.post_score)}
                </span>
                <span className={`inline-flex items-center gap-1 border text-sm font-bold px-2.5 py-0.5 rounded-full ${postScoreBadge(p.title_seo_score)}`}>
                  <span className="font-normal opacity-70">SEO</span>{postScoreLabel(p.title_seo_score)}
                </span>
              </div>
            </div>

            {/* positives + issues */}
            {((p.positives?.length ?? 0) > 0 || p.issues.length > 0 || p.full_text_len === -1) && (
              <div className="flex flex-wrap gap-1 mb-2">
                {(p.positives ?? []).map((pos, i) => (
                  <span key={`pos-${i}`} className="bg-green-50 text-green-700 border border-green-200 text-sm px-2 py-0.5 rounded-lg">
                    ✓ {pos}
                  </span>
                ))}
                {p.full_text_len === -1 && (
                  <span className="bg-gray-50 text-gray-500 border border-gray-200 text-sm px-2 py-0.5 rounded-lg">
                    본문 길이 측정 불가 (API 수집)
                  </span>
                )}
                {p.issues.map((issue, i) => (
                  <span key={`iss-${i}`} className="bg-red-50 text-red-600 border border-red-200 text-sm px-2 py-0.5 rounded-lg">
                    {issue}
                  </span>
                ))}
              </div>
            )}
            {p.issues.length === 0 && (p.positives?.length ?? 0) === 0 && (
              <p className="text-sm text-green-600 mb-2">문제없음 - 잘 작성된 포스트입니다</p>
            )}

            {/* suggestion */}
            {p.suggestion && (
              <p className="text-sm text-gray-600 mb-2">{p.suggestion}</p>
            )}
          </div>
        ))}
      </div>

      {posts.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-4 w-full flex items-center justify-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 py-2"
        >
          {expanded ? (
            <>접기 <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>나머지 {posts.length - 5}개 더 보기 <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}

/* ── PostingFrequencyCard ── */
function PostingFrequencyCard({ freq }: { freq: NonNullable<BlogAnalysisResult["posting_frequency"]> }) {
  const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  // 최근 6개월 키 생성
  const recentMonths: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    recentMonths.push(key);
  }

  function heatmapColor(count: number) {
    if (count === 0) return "bg-gray-100 text-gray-500";
    if (count === 1) return "bg-blue-200 text-blue-700";
    if (count === 2) return "bg-blue-400 text-white";
    return "bg-blue-600 text-white";
  }

  function consistencyBadge(c: string) {
    if (c === "active") return { label: "활발", cls: "bg-green-100 text-green-700 border-green-300" };
    if (c === "bursty") return { label: "몰아 발행 주의", cls: "bg-amber-100 text-amber-700 border-amber-300" };
    if (c === "regular") return { label: "규칙적", cls: "bg-blue-100 text-blue-700 border-blue-300" };
    if (c === "irregular") return { label: "불규칙", cls: "bg-amber-100 text-amber-700 border-amber-300" };
    return { label: "비활성", cls: "bg-red-100 text-red-700 border-red-300" };
  }

  const badge = consistencyBadge(freq.consistency);

  function formatNextDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-5 h-5 text-blue-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">발행 주기 분석</h3>
      </div>

      {/* 월별 히트맵 */}
      <div className="flex items-end gap-2 mb-4 overflow-x-auto pb-1">
        {recentMonths.map((monthKey) => {
          const count = freq.monthly_counts[monthKey] ?? 0;
          const monthNum = parseInt(monthKey.split("-")[1], 10);
          return (
            <div key={monthKey} className="flex flex-col items-center gap-1 shrink-0">
              <span className="text-sm text-gray-500">{MONTH_LABELS[monthNum - 1]}</span>
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex flex-col items-center justify-center font-bold text-sm ${heatmapColor(count)}`}>
                {count}
              </div>
              <span className="text-sm text-gray-500">건</span>
            </div>
          );
        })}
      </div>

      {/* 통계 배지 행 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex items-center border text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600 border-gray-300">
          평균 {Math.round(freq.avg_interval_days)}일 간격
        </span>
        <span className="inline-flex items-center border text-sm font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600 border-gray-300">
          권장 월 {freq.recommended_posts_per_month}회
        </span>
        <span className={`inline-flex items-center border text-sm font-semibold px-3 py-1 rounded-full ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* 일관성 메시지 */}
      <p className="text-sm text-gray-600 mb-3 leading-relaxed">{freq.consistency_message}</p>

      {/* 다음 발행 권장일 */}
      {(() => {
        const recDate = new Date(freq.recommended_next_date);
        const isPast = recDate < new Date();
        return (
          <div className={`rounded-xl px-4 py-3 ${isPast ? "bg-gray-50 border border-gray-200" : "bg-amber-50 border border-amber-200"}`}>
            <p className={`text-sm font-semibold ${isPast ? "text-gray-500" : "text-amber-800"}`}>
              다음 발행 권장일: {formatNextDate(freq.recommended_next_date)}
              {isPast && <span className="ml-2 text-gray-500 font-normal">(이미 지났습니다 — 지금 작성하세요)</span>}
            </p>
          </div>
        );
      })()}
    </div>
  );
}

/* ── BestCitationCandidateCard ── */
function BestCitationCandidateCard({ candidate }: { candidate: NonNullable<BlogAnalysisResult["best_citation_candidate"]> }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-amber-500 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-amber-900">AI 검색 인용 가능성 높은 포스트</h3>
      </div>

      {/* 포스트 점수 + 제목 */}
      <div className="flex items-start gap-3 mb-3">
        <span className={`inline-flex items-center border text-sm font-bold px-2.5 py-0.5 rounded-full shrink-0 ${postScoreBadge(candidate.post_score)}`}>
          {postScoreLabel(candidate.post_score)}
        </span>
        <div className="flex-1 min-w-0">
          {candidate.link ? (
            <a
              href={candidate.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1 text-sm md:text-base font-semibold text-gray-900 hover:text-blue-700 hover:underline leading-snug"
            >
              {candidate.title}
              <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            </a>
          ) : (
            <p className="text-sm md:text-base font-semibold text-gray-900 leading-snug">{candidate.title}</p>
          )}
        </div>
      </div>

      {/* reason */}
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">{candidate.reason}</p>

      {/* 지금 이것만 추가 */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-3">
        <p className="text-sm font-semibold text-green-800 mb-1">지금 이것만 추가하면 됩니다</p>
        <p className="text-sm font-bold text-green-900 leading-relaxed">{candidate.what_to_add}</p>
        <span className="inline-flex items-center border text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-700 border-green-300 mt-3">
          간단한 수정으로 가능
        </span>
      </div>
    </div>
  );
}

/* ── TopicSuggestionsV2Card ── */
function TopicSuggestionsV2Card({ suggestions }: { suggestions: TopicSuggestionV2[] }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const priorityBadge: Record<TopicSuggestionV2["priority"], string> = {
    high: "bg-red-50 text-red-600 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-gray-50 text-gray-500 border-gray-200",
  };
  const priorityLabel: Record<TopicSuggestionV2["priority"], string> = {
    high: "경쟁사 갭",
    medium: "업종 갭",
    low: "재활용",
  };
  // source 필드 기반 레이블 — priority와 1:1로 생성되지만 구조적으로 source를 직접 쓰는 것이 올바름
  // (향후 백엔드가 priority 산정 로직을 변경해도 레이블이 오표시되지 않음)
  const sourceLabel: Record<TopicSuggestionV2["source"], string> = {
    competitor_gap: "경쟁사 갭",
    keyword_gap: "업종 갭",
    reuse: "재활용",
  };
  const competitionLabel: Record<"high" | "medium" | "low", string> = {
    low: "경쟁 낮음",
    medium: "경쟁 보통",
    high: "경쟁 높음",
  };
  const competitionColor: Record<"high" | "medium" | "low", string> = {
    low: "text-green-600",
    medium: "text-amber-600",
    high: "text-red-500",
  };

  // 경쟁사 블로그 갭 기반 추천이 하나도 없으면(경쟁사 분석 데이터 부재) 그 이유를 밝힘
  const hasCompetitorGap = suggestions.some((s) => s.source === "competitor_gap");
  // 검색량 배지가 하나도 안 보이면(전부 null/0) 설명 문구도 함께 숨겨 불필요한 안내를 방지
  const hasVolumeData = suggestions.some(
    (s) => s.monthly_volume !== null && s.monthly_volume !== undefined && s.monthly_volume > 0
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">이번 달 블로그 주제 추천</h3>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        {hasCompetitorGap
          ? "경쟁사 블로그와 비교해 우선순위가 높은 주제부터 보여드립니다."
          : "경쟁사 블로그 진단 데이터가 아직 없어 업종 표준 키워드 기준으로 추천합니다. 경쟁사 데이터가 쌓이면 더 정밀해집니다."}
        {hasVolumeData && (
          <>
            {" "}
            주제 옆 숫자(예: 월 4.1k회)는 최근 1개월간 네이버에서 이 키워드를 검색한 횟수예요 — 숫자가 클수록 찾는 사람이 많다는 뜻입니다.
          </>
        )}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {suggestions.map((s, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
            <span className={`inline-flex items-center self-start border text-sm font-semibold px-2 py-0.5 rounded-full ${priorityBadge[s.priority]}`}>
              {sourceLabel[s.source] ?? priorityLabel[s.priority]}
            </span>
            <p className="text-sm font-semibold text-gray-900 leading-snug break-keep flex-1">
              {s.topic}
              {s.monthly_volume !== null && s.monthly_volume !== undefined && s.monthly_volume > 0 && (
                <span className="text-sm font-normal text-indigo-500 opacity-80">
                  {' '}
                  · 월{' '}
                  {s.monthly_volume >= 10000
                    ? `${Math.round(s.monthly_volume / 1000)}k`
                    : s.monthly_volume.toLocaleString()}
                  회
                </span>
              )}
            </p>
            <p className="text-sm text-gray-500 leading-relaxed">{s.reason}</p>
            {s.competition && s.competition !== "unknown" && (
              <span className={`text-sm font-medium ${competitionColor[s.competition]}`}>
                {competitionLabel[s.competition]}
                {s.competition === "low" && s.monthly_volume && s.monthly_volume > 0
                  ? " · 검색량 대비 선점 기회예요"
                  : ""}
              </span>
            )}
            {s.volume_trend && s.volume_trend.pct_change !== null && (
              <p className="text-sm text-gray-500">
                검색량 추이({s.volume_trend.from_date}→{s.volume_trend.to_date}):{' '}
                {s.volume_trend.from_volume.toLocaleString()}회 → {s.volume_trend.to_volume.toLocaleString()}회{' '}
                <span className={s.volume_trend.pct_change >= 0 ? "text-red-500 font-medium" : "text-blue-500 font-medium"}>
                  {s.volume_trend.pct_change >= 0 ? "▲" : "▼"}{Math.abs(s.volume_trend.pct_change)}%
                </span>
              </p>
            )}
            <button
              onClick={() => {
                copyToClipboard(s.topic, () => {});
                setCopiedIdx(idx);
                setTimeout(() => setCopiedIdx(null), 2000);
              }}
              className="self-start inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium mt-1"
            >
              {copiedIdx === idx ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> 주제 복사
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── BlogScoreTrendChart ── */
interface BlogScoreHistoryPoint {
  analyzed_date: string;
  citation_score: number;
  keyword_coverage: number | null;
  post_count: number | null;
  freshness: string | null;
}

function BlogScoreTrendChart({ businessId, token }: { businessId: string; token: string }) {
  const [history, setHistory] = useState<BlogScoreHistoryPoint[] | null>(null);
  const [historyFetchFailed, setHistoryFetchFailed] = useState(false);

  useEffect(() => {
    if (!businessId || !token) return;
    let cancelled = false;
    (async () => {
      setHistoryFetchFailed(false);
      try {
        const res = await fetch(`${BACKEND}/api/blog/score-history/${businessId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setHistoryFetchFailed(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setHistory(data?.history ?? []);
      } catch {
        if (!cancelled) setHistoryFetchFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [businessId, token]);

  if (history === null && !historyFetchFailed) return null; // 로딩 중 — 자리 차지 안 함

  if (historyFetchFailed) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-gray-500 shrink-0" />
          <h3 className="text-base md:text-lg font-bold text-gray-900">블로그 진단 점수 추이</h3>
        </div>
        <p className="text-sm text-gray-500">추이 데이터를 불러오지 못했습니다 — 새로고침해 주세요.</p>
      </div>
    );
  }

  if ((history ?? []).length < 2) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-gray-500 shrink-0" />
          <h3 className="text-base md:text-lg font-bold text-gray-900">블로그 진단 점수 추이</h3>
        </div>
        <p className="text-sm text-gray-500">분석을 2회 이상 진행하면 추세 차트가 표시됩니다.</p>
      </div>
    );
  }

  const points = history!.slice(-30);
  const latest = points[points.length - 1];
  const first = points[0];

  const renderSeries = (label: string, key: "citation_score" | "keyword_coverage") => {
    const vals = points.map((p) => p[key] ?? 0);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const range = max - min || 1;
    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="text-sm text-gray-500">
            현재 <span className="font-medium text-blue-700">{getScoreTextLabel(latest[key] ?? 0)}</span>
          </span>
        </div>
        <div className="flex items-end gap-1 h-12">
          {points.map((p, idx) => {
            const v = p[key] ?? 0;
            const heightPct = ((v - min) / range) * 70 + 30;
            const isLatest = idx === points.length - 1;
            return (
              <div
                key={p.analyzed_date}
                className={`flex-1 rounded-t-sm ${isLatest ? "bg-blue-500" : "bg-blue-200"}`}
                style={{ height: `${heightPct}%` }}
                title={`${p.analyzed_date}: ${getScoreTextLabel(v)}`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-blue-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">블로그 진단 점수 추이</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {first.analyzed_date} ~ {latest.analyzed_date}
      </p>
      {renderSeries("AI 인용 준비도", "citation_score")}
      {renderSeries("키워드 커버리지", "keyword_coverage")}
    </div>
  );
}

/* ── DuplicateTopicsWarning ── */
function DuplicateTopicsWarning({
  topics,
  templated,
  isInactive = false,
}: {
  topics: NonNullable<BlogAnalysisResult["duplicate_topics"]>;
  templated?: BlogAnalysisResult["templated_content"];
  isInactive?: boolean;
}) {
  const hasTopics = !!topics && topics.length > 0;
  const hasTemplated = !!templated && templated.length > 0;
  if (!hasTopics && !hasTemplated) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-amber-900">중복·반복 콘텐츠 감지</h3>
      </div>

      {hasTopics && (
        <div className="space-y-4">
          {topics.map((topic, idx) => (
            <div key={idx} className="bg-white border border-amber-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center border text-sm font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border-amber-300">
                  &quot;{topic.keyword}&quot; 관련 포스트 {topic.count}개
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-2 leading-relaxed">{topic.warning}</p>
              <div className="space-y-1 mb-3">
                {topic.titles.slice(0, 3).map((title, tIdx) => (
                  <p key={tIdx} className="text-sm text-gray-700 line-clamp-1 pl-2 border-l-2 border-amber-200">
                    {title}
                  </p>
                ))}
              </div>
              <p className="text-sm text-blue-600 italic leading-relaxed">{topic.suggestion}</p>
            </div>
          ))}
        </div>
      )}

      {hasTemplated && (
        <div className={`space-y-3 ${hasTopics ? "mt-4 pt-4 border-t border-amber-200" : ""}`}>
          <p className="text-sm font-semibold text-amber-900">제목 템플릿 반복</p>
          {templated!.map((t, idx) => (
            <div key={idx} className="bg-white border border-amber-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center border text-sm font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border-amber-300">
                  제목 구조 유사도 {t.similarity}%
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-2 leading-relaxed">{t.warning}</p>
              <div className="space-y-1 mb-3">
                {t.titles.map((title, tIdx) => (
                  <p key={tIdx} className="text-sm text-gray-700 line-clamp-1 pl-2 border-l-2 border-amber-200">
                    {title}
                  </p>
                ))}
              </div>
              <p className="text-sm text-blue-600 italic leading-relaxed">{t.suggestion}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-amber-700 mt-4 leading-relaxed">
        {isInactive
          ? "AI 검색(ChatGPT·Gemini·Google)은 같은 주제 포스트 중 가장 관련성 높은 1개만 인용합니다."
          : "AI 브리핑은 같은 주제 포스트 중 가장 관련성 높은 1개만 인용합니다."}
      </p>
    </div>
  );
}

/* ── TitleImprovementSection ── */
function TitleImprovementSection({ posts, businessId }: { posts: PostDetail[]; businessId: string }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const storageKey = `aeolab_blog_title_dismissed_${businessId}`;

  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const allImprovable = posts.filter(p => p.improved_title && p.improved_title !== p.title);
  // 동일 improved_title 중복 제거 — 구 분석 결과에 템플릿 중복이 있을 경우 방어
  const seenImproved = new Set<string>();
  const dedupedImprovable = allImprovable.filter(p => {
    const key = (p.improved_title || "").trim();
    if (!key || seenImproved.has(key)) return false;
    seenImproved.add(key);
    return true;
  });
  const visible = dedupedImprovable.filter(p => !dismissed.includes(p.title));
  const shown = visible.slice(0, 5);
  const nextQueueCount = Math.max(visible.length - shown.length, 0);

  if (dedupedImprovable.length === 0) return null;

  const persist = (next: string[]) => {
    setDismissed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const handleDismiss = (title: string) => {
    persist([...dismissed, title]);
  };

  const handleResetAll = () => {
    setDismissed([]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Zap className="w-5 h-5 text-indigo-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-indigo-900">제목 개선 제안</h3>
        {nextQueueCount > 0 && (
          <span className="text-sm text-indigo-500 ml-auto">대기 {nextQueueCount}개</span>
        )}
      </div>
      <p className="text-sm text-indigo-600 mb-4">
        AI 인용에 유리하도록 변경한 제목입니다. 해당되지 않는 제안은 <span className="font-semibold">X 버튼</span>으로 삭제하면 대기 중인 다음 제안이 자동으로 표시됩니다.
      </p>

      {shown.length === 0 && dismissed.length > 0 && (
        <div className="bg-white rounded-xl border border-indigo-100 p-4 text-center">
          <p className="text-sm text-gray-600 mb-3">모든 제목 제안을 숨겼습니다.</p>
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            숨긴 제안 {dismissed.length}개 다시 보기
          </button>
        </div>
      )}

      <div className="space-y-3">
        {shown.map((p) => {
          const key = p.link || p.title;
          return (
            <div key={key} className="relative bg-white rounded-xl border border-indigo-100 p-4 pr-10 sm:pr-4">
              <button
                type="button"
                onClick={() => handleDismiss(p.title)}
                aria-label="이 제안 삭제"
                title="이 제안 삭제"
                className="absolute top-2 right-2 w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 line-through break-keep">{p.title}</p>
                  <p className="text-sm md:text-base font-semibold text-indigo-800 mt-1 break-keep">{p.improved_title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(p.improved_title, () => {});
                    setCopiedKey(key);
                    setTimeout(() => setCopiedKey(null), 2000);
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors w-full sm:w-auto justify-center"
                >
                  {copiedKey === key ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKey === key ? "복사됨" : "이 제목으로 변경"}
                </button>
              </div>
              {p.suggestion && (
                <p className="text-sm text-gray-500 mt-2">{p.suggestion}</p>
              )}
            </div>
          );
        })}
      </div>

      {shown.length > 0 && dismissed.length > 0 && (
        <div className="mt-4 pt-4 border-t border-indigo-200 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-indigo-500">숨긴 제안 {dismissed.length}개</p>
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            다시 보기
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   섹션 A — MultiChannelCitationPanel
   채널별 AI 인용 횟수 (최근 3회 스캔 기준)
   ─────────────────────────────────────────────────────────── */
const CHANNEL_LABELS: Record<string, string> = {
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  naver: "네이버 AI 브리핑",
  google: "Google AI Overview",
};
const CHANNEL_ORDER = ["naver", "chatgpt", "gemini", "google"];

const BENCHMARK_LABEL_CLASS: Record<string, string> = {
  "업종 평균 상회": "text-green-600",
  "업종 평균 수준": "text-gray-500",
  "업종 평균 이하": "text-amber-600",
  "데이터 수집 중": "text-gray-400",
};

interface ChannelCitationData {
  mentioned_count: number;
  total: number;
  text_count?: number;
  image_count?: number;
}

function MultiChannelCitationPanel({
  citations,
  benchmark,
}: {
  citations: Record<string, ChannelCitationData>;
  benchmark?: Record<string, string>;
}) {
  const entries = CHANNEL_ORDER
    .filter((k) => citations[k] !== undefined)
    .map((k) => [k, citations[k]] as [string, ChannelCitationData]);

  // 정의된 채널 외의 것도 뒤에 붙임
  const extra = Object.entries(citations).filter(([k]) => !CHANNEL_ORDER.includes(k));
  const all = [...entries, ...extra];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-5 h-5 text-indigo-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">채널별 AI 인용 현황</h3>
        <span className="text-sm text-gray-400 ml-auto shrink-0">최근 3회 스캔 기준</span>
      </div>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        각 AI 채널에서 사업장 또는 블로그 콘텐츠가 인용된 횟수입니다.
        측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>

      {all.length === 0 ? (
        <p className="text-sm text-gray-400">아직 측정 데이터 없음 — 스캔 후 표시됩니다.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {all.map(([platform, data]) => {
            const pct = data.total > 0 ? Math.round((data.mentioned_count / data.total) * 100) : 0;
            const label = CHANNEL_LABELS[platform] ?? platform;
            const isHigh = pct >= 50;
            const isMid = pct >= 20;
            const barClass = isHigh
              ? "bg-green-500"
              : isMid
              ? "bg-amber-400"
              : "bg-gray-300";
            const badgeClass = isHigh
              ? "bg-green-100 text-green-700 border-green-300"
              : isMid
              ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-gray-100 text-gray-600 border-gray-300";
            const textClass = isHigh
              ? "text-green-700"
              : isMid
              ? "text-amber-600"
              : "text-gray-500";
            return (
              <div key={platform} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{label}</span>
                  <span className={`inline-flex items-center border text-sm font-bold px-2.5 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                    {data.mentioned_count}/{data.total}회 인용
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all ${barClass}`}
                    style={{ width: `${data.total > 0 ? Math.max(pct, 4) : 0}%` }}
                  />
                </div>
                <p className={`text-sm font-semibold ${textClass}`}>
                  {data.total > 0 ? `${pct}% 인용률` : "측정 데이터 없음"}
                </p>
                {((data.text_count ?? 0) > 0 || (data.image_count ?? 0) > 0) && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    텍스트 {data.text_count ?? 0} · 이미지 썸네일 {data.image_count ?? 0}
                  </p>
                )}
                {benchmark?.[platform] && (
                  <p className={`text-sm mt-0.5 ${BENCHMARK_LABEL_CLASS[benchmark[platform]] ?? "text-gray-400"}`}>
                    {benchmark[platform]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   섹션 B — CompetitorKeywordBlockedPanel
   키워드별 경쟁사 점유 현황 테이블
   ─────────────────────────────────────────────────────────── */
function CompetitorKeywordBlockedPanel({
  keywordDetail,
}: {
  keywordDetail: Array<{ keyword: string; covered_by: string[]; my_status: string }>;
}) {
  if (!keywordDetail || keywordDetail.length === 0) return null;

  const pioneerCount = keywordDetail.filter((k) => k.covered_by.length === 0).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Target className="w-5 h-5 text-orange-500 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">경쟁사 키워드 점유 현황</h3>
      </div>
      <p className="text-sm text-gray-500 mb-1 leading-relaxed">
        경쟁사들이 블로그에서 이미 다루고 있는 키워드를 분석합니다.
      </p>
      {pioneerCount > 0 && (
        <div className="inline-flex items-center border text-sm font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 border-green-300 mb-4">
          선점 기회 {pioneerCount}개 발견 — 경쟁사 미사용
        </div>
      )}

      {/* PC: 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-2 pr-4 font-semibold text-gray-600 w-[28%]">키워드</th>
              <th className="pb-2 pr-4 font-semibold text-gray-600 w-[38%]">커버한 경쟁사</th>
              <th className="pb-2 font-semibold text-gray-600">권장 액션</th>
            </tr>
          </thead>
          <tbody>
            {keywordDetail.map((item, idx) => {
              const isPioneer = item.covered_by.length === 0;
              return (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 ${isPioneer ? "bg-green-50/50" : "bg-red-50/20"}`}
                >
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center border text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                      isPioneer
                        ? "bg-green-100 text-green-700 border-green-300"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}>
                      {item.keyword}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-700">
                    {isPioneer ? (
                      <span className="font-medium text-green-700">없음 — 선점 기회</span>
                    ) : (
                      item.covered_by.join(", ")
                    )}
                  </td>
                  <td className="py-3 text-sm text-gray-600">
                    {isPioneer
                      ? "이 키워드로 포스트 작성 시 선점 가능"
                      : "경쟁사 대비 차별화 필요"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 카드 */}
      <div className="md:hidden space-y-2">
        {keywordDetail.map((item, idx) => {
          const isPioneer = item.covered_by.length === 0;
          return (
            <div
              key={idx}
              className={`rounded-xl border p-3 ${isPioneer ? "bg-green-50 border-green-200" : "bg-red-50/30 border-red-100"}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <span className={`inline-flex items-center border text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                  isPioneer ? "bg-green-100 text-green-700 border-green-300" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {item.keyword}
                </span>
                {isPioneer && (
                  <span className="text-sm font-semibold text-green-700">선점 기회</span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {isPioneer
                  ? "이 키워드로 포스트 작성 시 선점 가능"
                  : `경쟁사: ${item.covered_by.join(", ")} — 차별화 필요`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   섹션 C — BlogMentionBenchmarkCard
   블로그 언급 수 가로 막대 차트 (Recharts)
   ─────────────────────────────────────────────────────────── */
function BlogMentionBenchmarkCard({
  data,
  businessName,
}: {
  data: NonNullable<BlogAnalysisResult["competitor_blog_mentions"]>;
  businessName: string;
}) {
  const truncateChartName = (name: string, max = 7) =>
    name.length > max ? `${name.slice(0, max)}…` : name;

  const chartData = [
    { name: `${truncateChartName(businessName)} (나)`, count: data.my_count, isMe: true },
    ...data.competitors.map((c) => ({ name: truncateChartName(c.name), count: c.blog_mention_count, isMe: false })),
  ];

  const chartHeight = Math.max(160, chartData.length * 52 + 24);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <BarChart2 className="w-5 h-5 text-blue-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">블로그 언급 수 비교</h3>
        <span className="inline-flex items-center border text-sm px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border-gray-200 ml-auto">(추정)</span>
      </div>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">
        네이버 블로그 검색 기준 언급 수입니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 32, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 12, fill: "#374151" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: unknown) => [`${Number(value).toLocaleString()}건`]}
            contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e5e7eb" }}
            cursor={{ fill: "#f9fafb" }}
          />
          {data.avg_count > 0 && (
            <ReferenceLine
              x={data.avg_count}
              stroke="#f59e0b"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{
                value: `평균 ${data.avg_count}건`,
                position: "top",
                fontSize: 11,
                fill: "#d97706",
              }}
            />
          )}
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.isMe ? "#3b82f6" : "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="mt-3 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-sm text-gray-600">내 사업장</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-400" />
          <span className="text-sm text-gray-600">경쟁사</span>
        </div>
        {data.avg_count > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 border-t-2 border-dashed border-amber-400" style={{ borderStyle: "dashed" }} />
            <span className="text-sm text-gray-600">평균 {data.avg_count.toLocaleString()}건</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 업종별 AI 브리핑 비대상 안내 배너 — 결과 유무와 무관하게 동일 문구 사용(중복 방지) ── */
function BriefingIneligibilityBanner({ business, isBlogLikely }: { business?: Business; isBlogLikely: boolean }) {
  return (
    <div className={`rounded-xl border px-4 md:px-5 py-4 flex items-start gap-3 ${
      isBlogLikely ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"
    }`}>
      <span className="text-xl shrink-0 mt-0.5">
        {business?.is_franchise ? "🏢" : isBlogLikely ? "🔮" : "ℹ️"}
      </span>
      <div className="flex-1 min-w-0">
        {business?.is_franchise ? (
          <>
            <p className="text-base font-bold text-gray-900 mb-1">
              프랜차이즈 가맹점 — '플레이스형' AI 브리핑 비대상
            </p>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
              프랜차이즈는 '플레이스형' 네이버 AI 브리핑 제공 대상에서 제외됩니다. 단, 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다.
              블로그 분석은 <strong>정보형 AI 브리핑·AI탭·일반 검색 노출 및 콘텐츠 품질 점수</strong> 강화에 효과적입니다. ChatGPT·Gemini는 구글 비즈니스 프로필이 더 직접적입니다.
            </p>
          </>
        ) : isBlogLikely ? (
          <>
            <p className="text-base font-bold text-gray-900 mb-1">
              AI 브리핑 확대 예상 업종
            </p>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
              미리 블로그 최적화를 완료해두면 확대 시 인용 가능성이 높아집니다 (알고리즘 기준, 100% 보장 아님).
              현재도 네이버 AI탭·일반 검색 노출에 효과적입니다. ChatGPT·Gemini는 구글 비즈니스 프로필이 더 직접적입니다.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-bold text-gray-900 mb-1">
              현재 '플레이스형' AI 브리핑 비대상 업종 — 블로그 분석은 모든 AI 채널에 효과적입니다
            </p>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
              '플레이스형' 네이버 AI 브리핑 비대상이지만, 블로그·콘텐츠가 갖춰지면 '정보형 AI 브리핑'에 노출될 수 있습니다. 아래 분석 결과는
              <strong>정보형 AI 브리핑·AI탭·일반 검색 노출</strong> 및 콘텐츠 품질 점수 강화에 활용하세요. ChatGPT·Gemini는 구글 비즈니스 프로필이 더 직접적입니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main BlogClient ── */
export function BlogClient({ businesses, currentPlan, accessToken: initialToken, initialBizId }: Props) {
  // 복수 사업장 선택 상태 (단일이면 자동 선택, initialBizId로 초기 활성 사업장 지정)
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(() => {
    if (initialBizId) {
      const found = businesses.find((b) => b.id === initialBizId);
      if (found) return found;
    }
    return businesses.length === 1 ? businesses[0] : null;
  });

  // 선택된 사업장 기반 파생값
  const business = selectedBiz ?? businesses[0];
  const savedBlogUrl = selectedBiz?.blog_url ?? null;
  const lastAnalyzedAt = selectedBiz?.blog_analyzed_at ?? null;

  // AI 브리핑 게이팅 (v4.1) — 미로딩 시 ACTIVE 가정(깜빡임 방지)
  const briefingCats = useBriefingCategories();
  const briefingEligibility = getBriefingEligibility(business?.category, !!business?.is_franchise, briefingCats?.active, briefingCats?.likely);
  const isBlogInactive = briefingEligibility !== "active";
  const isBlogLikely   = briefingEligibility === "likely";

  const [loading, setLoading] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  // 저장된 분석 결과 조회 자체가 실패한 경우 — "아직 분석 안 함"과 구분해서 안내해야 함
  const [savedResultFetchFailed, setSavedResultFetchFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlogAnalysisResult | null>(null);
  const [monthlyUsed, setMonthlyUsed] = useState<number | null>(null);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [isMonthlyLimitReached, setIsMonthlyLimitReached] = useState(false);
  const [kwCopied, setKwCopied] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [toast, setToast] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [autoAnalyzing, setAutoAnalyzing] = useState(false);
  const [keywordModalOpen, setKeywordModalOpen] = useState(false);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);
  const [oldFormatDetected, setOldFormatDetected] = useState(false);
  const [excludingKws, setExcludingKws] = useState<Set<string>>(new Set());
  const [isDashboardReanalyze, setIsDashboardReanalyze] = useState(false);
  // 상세 데이터 섹션(트렌드·발행주기·포스트별 분석·키워드 관리) 기본 접힘 — 진단 요약 +
  // 실행 항목만 먼저 보여 페이지를 간결하게 유지. 사용자가 한 번 펼치면 기억함
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("aeolab_blog_detail_expanded") === "1") setShowDetail(true);
    } catch {}
  }, []);
  const handleToggleDetail = () => {
    setShowDetail((prev) => {
      const next = !prev;
      try { localStorage.setItem("aeolab_blog_detail_expanded", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!token) {
      getSafeSession().then((session) => {
        if (session?.access_token) setToken(session.access_token);
      });
    }
  }, [token]);

  // 대시보드 "재분석" 링크 → ?reanalyze=1 감지
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reanalyze') === '1') {
      setIsDashboardReanalyze(true);
    }
  }, []);

  // 페이지 진입 시 DB에서 이전 분석 결과 불러오기 (재분석 요청이면 건너뜀)
  useEffect(() => {
    if (isDashboardReanalyze) return;
    if (!selectedBiz || !savedBlogUrl || !business.id) return;
    const fetchSavedResult = async () => {
      setResultLoading(true);
      // getSafeSession()/fetch()가 드물게 응답 없이 멈추면(supabase-js 세션 락 등) 이 스피너가
      // 영구히 "이전 분석 결과를 불러오는 중..."에 멈춰 있었음 — 두 구간 모두 타임아웃으로
      // 감싸 항상 finally에 도달하도록 방어 (2026-07-18 라이브 무한로딩 신고로 발견)
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 15000);
      try {
        const sessionOrTimeout = await Promise.race([
          getSafeSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
        ]);
        const currentToken = token || sessionOrTimeout?.access_token || "";
        if (!currentToken) {
          setSavedResultFetchFailed(true);
          return;
        }
        const res = await fetch(`${BACKEND}/api/blog/result/${business.id}`, {
          headers: { Authorization: `Bearer ${currentToken}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          setSavedResultFetchFailed(true);
          return;
        }
        const data = await res.json();
        setSavedResultFetchFailed(false);
        if (data?.has_blog_analysis && data?.citation_score !== undefined) {
          // 구 형식 캐시 감지 — 다음 중 하나면 재분석 필요
          //  (1) posts_detail 자체가 없음 (v1 구형식)
          //  (2) improved_title에 "..."가 포함 (구 로직 결과)
          //  (3) positives 필드 자체가 없음 (이전 배포 버전 결과)
          const details = (data.posts_detail ?? []) as PostDetail[];
          const hasNoDetails = details.length === 0;
          const hasEllipsis = details.some(p => typeof p.improved_title === "string" && p.improved_title.includes("..."));
          const missingPositives = details.length > 0 && details.every(p => p.positives === undefined);
          const missingNewFields = !data.posting_frequency && !data.best_citation_candidate;
          // INACTIVE 업종인데 캐시에 구 "AI 브리핑" 문구가 남아 있으면 재분석 필요
          const hasOldBriefingText = isBlogInactive && (
            (typeof data.best_citation_candidate?.reason === "string" && data.best_citation_candidate.reason.includes("AI 브리핑")) ||
            ((data.weekly_actions ?? []) as {reason?: string}[]).some(a => a.reason?.includes("AI 브리핑")) ||
            (typeof data.top_recommendation === "string" && data.top_recommendation.includes("AI 브리핑"))
          );
          const isOldFormat = hasNoDetails || hasEllipsis || missingPositives || missingNewFields || hasOldBriefingText;
          if (!isOldFormat) {
            setResult(data as BlogAnalysisResult);
            if (typeof data.monthly_used === "number") setMonthlyUsed(data.monthly_used);
            if (typeof data.monthly_limit === "number") setMonthlyLimit(data.monthly_limit);
          } else {
            setOldFormatDetected(true);
          }
        }
      } catch (e) {
        console.warn('[Blog] 저장된 분석 결과 조회 실패', e);
        setSavedResultFetchFailed(true);
      } finally {
        clearTimeout(abortTimer);
        setResultLoading(false);
      }
    };
    fetchSavedResult();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id, savedBlogUrl, isDashboardReanalyze]);

  const handleAnalyze = useCallback(async (opts?: { silent?: boolean }) => {
    if (!savedBlogUrl) {
      setError("등록된 블로그 주소가 없습니다. 사업장 설정에서 먼저 등록해 주세요.");
      return;
    }
    // 이미 진행 중인 경우 재진입 방지 + 사용자 피드백
    if (loading) {
      setToast({ type: "info", message: "이미 분석 중입니다. 잠시만 기다려 주세요." });
      return;
    }
    setLoading(true);
    setError(null);
    if (!opts?.silent) {
      setToast({ type: "info", message: isBlogInactive
        ? "블로그를 읽고 AI 검색 인용 신호를 분석 중입니다..."
        : "블로그를 읽고 AI 브리핑 신호를 분석 중입니다..." });
    }

    try {
      const currentToken = token || (await getSafeSession())?.access_token || "";
      if (!currentToken) {
        throw new Error("로그인 세션이 만료됐습니다. 페이지를 새로고침해 주세요.");
      }
      const res = await fetch(`${BACKEND}/api/blog/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          business_id: business.id,
          blog_url: savedBlogUrl,
          category: business.category,
          keywords: business.keywords ?? [],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        type DetailObj = { code?: string; message?: string; monthly_used?: number; monthly_limit?: number };
        const detail = (data as { detail?: string | DetailObj }).detail;
        if (typeof detail === "object" && detail?.code === "MONTHLY_LIMIT_REACHED") {
          setIsMonthlyLimitReached(true);
          if (typeof detail.monthly_used === "number") setMonthlyUsed(detail.monthly_used);
          if (typeof detail.monthly_limit === "number") setMonthlyLimit(detail.monthly_limit);
        }
        const message = typeof detail === "string"
          ? detail
          : (detail && typeof detail === "object" && detail.message) || `분석 실패 (${res.status})`;
        throw new Error(message);
      }
      const data: BlogAnalysisResult = await res.json();
      setResult(data);
      setIsMonthlyLimitReached(false);
      if (typeof data.monthly_used === "number") setMonthlyUsed(data.monthly_used);
      if (typeof data.monthly_limit === "number") setMonthlyLimit(data.monthly_limit);
      // 측정 자체가 실패한 응답(HTTP 200이지만 error 필드 있음)은 성공 토스트를 띄우면 안 됨
      if (data.error) {
        setToast({ type: "error", message: "블로그 측정에 실패했습니다. 잠시 후 다시 시도해주세요." });
      } else {
        setToast({ type: "success", message: "블로그 분석이 완료됐습니다." });
        // 결과 영역으로 스크롤 (측정 실패 시에는 스크롤하지 않음)
        setTimeout(() => {
          resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.";
      setError(msg);
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
      setAutoAnalyzing(false);
    }
  }, [savedBlogUrl, token, business, loading]);

  const handleExcludeKeyword = useCallback(async (kw: string) => {
    if (excludingKws.has(kw)) return
    setExcludingKws(prev => new Set(prev).add(kw))
    try {
      const currentToken = token || (await getSafeSession())?.access_token || ""
      if (!currentToken) return
      await addExcludedKeyword(business.id, kw, currentToken)
      // 로컬 상태에서 즉시 제거
      setResult(prev => {
        if (!prev?.keyword_coverage) return prev
        return {
          ...prev,
          keyword_coverage: {
            ...prev.keyword_coverage,
            missing: prev.keyword_coverage.missing?.filter(k => k !== kw) ?? [],
          },
          missing_keywords: prev.missing_keywords?.filter(k => k !== kw),
        }
      })
      setToast({ type: "success", message: `"${kw}" 제외됨. 다음 분석부터 반영됩니다.` })
    } catch {
      setToast({ type: "error", message: `"${kw}" 제외에 실패했습니다.` })
    } finally {
      setExcludingKws(prev => { const s = new Set(prev); s.delete(kw); return s })
    }
  }, [excludingKws, token, business.id])

  // 토스트 자동 사라짐
  useEffect(() => {
    if (!toast) return;
    const timeout = toast.type === "error" ? 6000 : 3500;
    const id = setTimeout(() => setToast(null), timeout);
    return () => clearTimeout(id);
  }, [toast]);

  // 자동 분석: (1) stale한 경우  (2) 구 형식 캐시 감지 시 재분석
  useEffect(() => {
    if (!selectedBiz || !savedBlogUrl || autoTriggered || resultLoading) return;
    if (result) return;
    if (oldFormatDetected || isStale(lastAnalyzedAt)) {
      setAutoTriggered(true);
      setAutoAnalyzing(true);
      handleAnalyze({ silent: true });
    }
  }, [selectedBiz, savedBlogUrl, lastAnalyzedAt, autoTriggered, handleAnalyze, result, resultLoading, oldFormatDetected]);

  // 대시보드 "재분석" 클릭 시 즉시 트리거 (기존 결과 유무 무관)
  useEffect(() => {
    if (!isDashboardReanalyze) return;
    if (!selectedBiz || !savedBlogUrl || autoTriggered || loading) return;
    setAutoTriggered(true);
    setAutoAnalyzing(true);
    handleAnalyze({ silent: true });
  }, [isDashboardReanalyze, selectedBiz, savedBlogUrl, autoTriggered, loading, handleAnalyze]);

  // 사업장 선택 화면 — 복수 사업장이고 아직 선택하지 않은 경우 (모든 훅 선언 이후)
  if (businesses.length > 1 && selectedBiz === null) {
    return (
      <div>
        <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-4">분석할 사업장을 선택하세요</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {businesses.map((biz) => (
            <button
              key={biz.id}
              onClick={() => {
                setSelectedBiz(biz);
                setResult(null);
                setAutoTriggered(false);
                setOldFormatDetected(false);
                setMonthlyUsed(null);
                setMonthlyLimit(null);
                setIsMonthlyLimitReached(false);
              }}
              className="text-left bg-white border border-gray-200 hover:border-blue-400 hover:shadow-md rounded-xl p-5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <p className="text-base font-semibold text-gray-900 mb-1 truncate">{biz.name}</p>
              <p className="text-sm text-gray-500 mb-3">
                {biz.category} · {biz.region}
              </p>
              {biz.blog_url ? (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-sm font-medium px-3 py-1 rounded-full">
                  블로그 등록됨
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-sm font-medium px-3 py-1 rounded-full">
                  블로그 미등록
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="블로그 AI 진단">
      {/* 토스트 알림 */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 max-w-sm shadow-lg rounded-xl px-4 py-3 border-2 flex items-start gap-2 animate-in slide-in-from-top-2 ${
            toast.type === "success"
              ? "bg-green-50 border-green-300 text-green-800"
              : toast.type === "error"
              ? "bg-red-50 border-red-300 text-red-800"
              : "bg-blue-50 border-blue-300 text-blue-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : toast.type === "error" ? (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-semibold leading-relaxed">{toast.message}</p>
        </div>
      )}
      <div className="space-y-6 max-w-4xl">

        {/* 복수 사업장일 때 현재 선택 사업장 + 변경 버튼 */}
        {businesses.length > 1 && selectedBiz && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-500 shrink-0">분석 중인 사업장:</span>
            <span className="text-sm font-semibold text-gray-900 truncate min-w-0">{selectedBiz.name}</span>
            <button
              onClick={() => {
                setSelectedBiz(null);
                setResult(null);
                setAutoTriggered(false);
                setOldFormatDetected(false);
                setMonthlyUsed(null);
                setMonthlyLimit(null);
                setIsMonthlyLimitReached(false);
              }}
              className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors shrink-0 whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              사업장 변경
            </button>
          </div>
        )}

        {/* 블로그 미등록 */}
        {!savedBlogUrl && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-base md:text-lg font-bold text-amber-900 mb-1">블로그 주소가 등록되지 않았습니다</h2>
                <p className="text-sm text-amber-800 mb-4 leading-relaxed">
                  블로그 AI 진단을 사용하려면 사업장 설정에서 블로그 주소를 먼저 등록해 주세요.
                  네이버 블로그, 티스토리, 워드프레스 등 외부 블로그 주소도 사용 가능합니다.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
                  <div className="flex items-start gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2.5">
                    <Search className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900">등록하면 포스트별로 네이버 AI 브리핑 인용 여부를 확인할 수 있습니다</p>
                  </div>
                  <div className="flex items-start gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2.5">
                    <BarChart2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900">Gemini·ChatGPT·네이버·Google 4채널 인용 현황을 한눈에 봅니다</p>
                  </div>
                  <div className="flex items-start gap-2 bg-white border border-amber-100 rounded-lg px-3 py-2.5">
                    <Target className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900">경쟁사가 점유한 키워드와 선점 기회를 비교합니다</p>
                  </div>
                </div>
                <Link
                  href={`/settings?tab=business&biz_id=${encodeURIComponent(business.id)}`}
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  사업장 설정으로 이동
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 블로그 등록됨 */}
        {savedBlogUrl && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <h2 className="text-base md:text-lg font-bold text-gray-900">등록된 블로그</h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col gap-1">
                <a
                  href={savedBlogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline text-sm font-medium break-all"
                >
                  {savedBlogUrl}
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
                {lastAnalyzedAt && (
                  <p className="text-sm text-gray-500">
                    마지막 분석: {new Date(lastAnalyzedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                    {isStale(lastAnalyzedAt) && (
                      <span className="ml-2 text-amber-500 font-medium">- 7일 이상 지났습니다</span>
                    )}
                  </p>
                )}
                {!lastAnalyzedAt && (
                  <p className="text-sm text-gray-500">아직 분석 기록이 없습니다</p>
                )}
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  aria-busy={loading}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold text-base px-5 py-3 rounded-xl transition-colors w-full sm:w-auto min-h-[44px]"
                  disabled={loading || isMonthlyLimitReached}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4" /> 재분석하기</>
                  )}
                </button>
                {/* 월 사용량 배지 — basic(3)/pro(10)/startup(5)만 표시, 무제한(999)은 숨김 */}
                {typeof monthlyLimit === "number" && monthlyLimit > 0 && monthlyLimit < 999 && (
                  <span className={`inline-flex items-center justify-center text-sm font-medium px-3 py-1 rounded-full border ${
                    (monthlyUsed ?? 0) >= monthlyLimit
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}>
                    이번 달 {monthlyUsed ?? 0}/{monthlyLimit}회 사용
                  </span>
                )}
              </div>
            </div>

            {/* 월별 한도 초과 업그레이드 CTA */}
            {isMonthlyLimitReached && (
              <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900 mb-1">
                    이번 달 블로그 분석 횟수를 모두 사용했습니다
                    {typeof monthlyLimit === "number" && monthlyLimit > 0 && (
                      <span className="ml-1 font-normal text-amber-700">({monthlyLimit}회/월)</span>
                    )}
                  </p>
                  <p className="text-sm text-amber-800 mb-3 leading-relaxed">
                    다음 달 1일에 초기화됩니다.
                    {currentPlan === "pro" && " Biz 플랜으로 업그레이드하면 월 무제한으로 분석할 수 있습니다."}
                    {currentPlan !== "pro" && currentPlan !== "biz" && currentPlan !== "enterprise" &&
                      " Pro 플랜으로 업그레이드하면 월 10회까지 분석할 수 있습니다."}
                  </p>
                  {/* biz/enterprise는 blog_monthly가 무제한(999)이라 이 배너 자체에 도달하지
                      않지만, 향후 PLAN_LIMITS 변경 시를 대비해 업그레이드 버튼도 함께 숨김 */}
                  {currentPlan !== "biz" && currentPlan !== "enterprise" && (
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                    >
                      플랜 업그레이드
                    </Link>
                  )}
                </div>
              </div>
            )}

            {loading && (
              <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-start gap-2">
                <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-semibold">
                    {autoAnalyzing
                      ? (isDashboardReanalyze ? "재분석 요청을 처리 중입니다" : (oldFormatDetected ? "새 분석 엔진으로 자동 재분석 중입니다" : "오래된 분석을 자동으로 갱신 중입니다"))
                      : "블로그 분석을 실행 중입니다"}
                  </p>
                  <p className="text-sm mt-0.5">
                    {isBlogInactive
                      ? "블로그 포스트를 읽고 AI 검색 인용 가능성을 분석합니다. (15~25초 소요)"
                      : "블로그 포스트를 읽고 AI 브리핑 인용 가능성을 분석합니다. (15~25초 소요)"}
                  </p>
                </div>
              </div>
            )}

            {error && !isMonthlyLimitReached && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* 저장된 결과 불러오는 중 */}
        {savedBlogUrl && !result && resultLoading && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 md:p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
            <p className="text-base font-semibold text-gray-600 mb-1">이전 분석 결과를 불러오는 중...</p>
          </div>
        )}

        {/* 블로그 URL은 있지만 아직 분석 안 된 경우 */}
        {savedBlogUrl && !lastAnalyzedAt && !result && !loading && !resultLoading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
            <span className="text-2xl shrink-0">&#x23F3;</span>
            <div>
              <p className="font-semibold text-amber-800">블로그 첫 분석을 자동으로 시작합니다. 잠시만 기다려 주세요.</p>
              <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
                등록하신 블로그를 읽고 AI 인용 가능성을 분석합니다. 보통 20~35초 소요됩니다.<br/>
                분석이 완료되면 결과가 자동으로 표시됩니다. 오래 걸리면 새로고침해 주세요.
              </p>
            </div>
          </div>
        )}

        {/* 저장된 결과 조회 자체가 실패한 경우 — "분석 결과 없음"과 구분(재분석 유도로 사용량 낭비 방지) */}
        {savedBlogUrl && !!lastAnalyzedAt && !result && !loading && !autoTriggered && !resultLoading && savedResultFetchFailed && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 md:p-8 text-center">
            <Search className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-amber-800 mb-1">저장된 분석 결과를 불러오지 못했습니다</p>
            <p className="text-sm text-amber-700">
              이전에 분석한 기록은 남아 있어요. 새로고침해서 다시 시도해주세요.
            </p>
          </div>
        )}

        {/* 결과 없음 empty state — lastAnalyzedAt 있을 때만 (없으면 "진행 중" 배너가 담당) */}
        {savedBlogUrl && !!lastAnalyzedAt && !result && !loading && !autoTriggered && !resultLoading && !savedResultFetchFailed && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 md:p-8 text-center">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-600 mb-1">분석 결과가 없습니다</p>
            <p className="text-sm text-gray-500">
              위 &quot;재분석하기&quot; 버튼을 눌러 블로그 AI 진단을 시작하세요.
            </p>
          </div>
        )}

        {/* 분석 결과가 아직 없을 때(첫 진입·분석 전)만 여기서 안내 — 결과가 있으면 요약 카드 뒤로 이동 */}
        {isBlogInactive && !result && (
          <BriefingIneligibilityBanner business={business} isBlogLikely={isBlogLikely} />
        )}

        {/* 측정 자체가 실패한 경우 — 점수/카드를 확정적으로 보여주면 안 됨 */}
        {result && result.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-4">
            <span className="text-2xl shrink-0">&#x26A0;&#xFE0F;</span>
            <div>
              <p className="font-semibold text-red-800">일시적으로 블로그를 측정하지 못했습니다</p>
              <p className="text-sm text-red-700 mt-0.5 leading-relaxed">
                {result.top_recommendation || "네이버 블로그 검색에 일시적으로 접근하지 못했습니다."} 잠시 후 &quot;재분석하기&quot; 버튼을 다시 눌러주세요.
              </p>
            </div>
          </div>
        )}

        {/* ═══ 분석 결과 ═══ */}
        {result && !result.error && (
          <div ref={resultSectionRef} className="space-y-5">

            {/* RSS 접근 제한 안내 배너 — API 스니펫 전용 분석 시 표시 */}
            {result.rss_failed && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-blue-400 shrink-0 mt-0.5">&#x2139;&#xFE0F;</span>
                <p className="text-sm text-blue-800 leading-relaxed">
                  이번 분석은 일부 데이터(이미지·본문 길이)에 접근하지 못해 측정이 제한적입니다. 다시 분석하면 더 정확한 결과를 받을 수 있어요.
                </p>
              </div>
            )}

            {/* 진단 근거 요약 바 — 실측 데이터 수치만 정직하게 표시 (신뢰 장치, CLAUDE.md 허위수치 금지 원칙 준수) */}
            <MethodologyDisclosureBar
              postCount={result.post_count ?? 0}
              isPostCountEstimated={result.is_post_count_estimated}
              citations={result.multi_channel_citations || {}}
            />

            {/* Layer 1+3: 정보형 AI 브리핑 준비도 (상태·근거·변화) — 개인화된 실제 결과를 가장 먼저 노출 */}
            <InfoBriefingReadinessCard
              result={result}
              eligibility={briefingEligibility}
              businessId={business.id}
              platform={result.platform}
              blogUrl={result.blog_url}
            />

            {/* AI 브리핑 게이팅 안내 배너 (v4.1) — 위 요약 카드 다음 순서로, 체크리스트 해석을 돕는 보충 설명 */}
            {isBlogInactive && (
              <BriefingIneligibilityBanner business={business} isBlogLikely={isBlogLikely} />
            )}

            {/* ═══ 핵심 3축 진단 (2026-07-18 순서 재배치 — 헤드라인 카드 바로 다음으로 승격.
                체크리스트·포스트상세·액션카드보다 먼저 노출해 "내 블로그 현황"을 최우선 노출.
                이전엔 07-18 낮 세션에서 showDetail 토글 밖으로만 꺼내고 위치는 그대로였음) ═══ */}
            {/* 키워드 커버리지 — ①내 블로그 현황 본체 */}
            {result.keyword_coverage && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                  <h3 className="text-base md:text-lg font-bold text-gray-900">키워드 커버리지</h3>
                  <button
                    type="button"
                    onClick={() => setKeywordModalOpen(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-sm md:text-base font-semibold px-3 py-2 rounded-xl transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    키워드 설정
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">포스트 제목과 본문 내용을 기준으로 분석합니다 (일부 포스트는 API로만 수집되어 제목·요약 정보만 반영될 수 있습니다)</p>
                {result.top_recommendation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 leading-relaxed">{result.top_recommendation}</p>
                  </div>
                )}
                <div className="space-y-4">
                  {(result.keyword_coverage.present?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-sm font-semibold text-green-700">
                          확인된 키워드 ({result.keyword_coverage.present.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.keyword_coverage.present.map((kw) => (
                          <span key={kw} className="bg-green-100 text-green-700 border border-green-200 text-sm px-3 py-1 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(result.keyword_coverage.missing?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="text-sm font-semibold text-red-700">
                            없는 키워드 ({result.keyword_coverage.missing.length}) - 제목에 넣으면 AI 노출에 유리합니다
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(result.keyword_coverage!.missing.slice(0, 5).join(", "), setKwCopied)}
                          className="shrink-0 inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors w-full sm:w-auto justify-center"
                        >
                          {kwCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {kwCopied ? "복사됨" : "상위 5개 복사"}
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">관련 없는 키워드는 X를 눌러 제외하면 분석에서 영구히 빠집니다. 복사한 키워드는 네이버 블로그 에디터에 붙여넣어 다음 포스트 제목에 활용하세요.</p>
                      <div className="flex flex-wrap gap-2">
                        {result.keyword_coverage.missing.map((kw) => (
                          <span key={kw} className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 text-sm px-3 py-1 rounded-full">
                            {kw}
                            <button
                              type="button"
                              onClick={() => handleExcludeKeyword(kw)}
                              disabled={excludingKws.has(kw)}
                              aria-label={`${kw} 제외`}
                              title="이 키워드 제외 (다음 분석부터 미표시)"
                              className="ml-0.5 w-4 h-4 rounded-full hover:bg-red-300 text-red-500 hover:text-red-800 flex items-center justify-center disabled:opacity-40 transition-colors"
                            >
                              {excludingKws.has(kw) ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(result.keyword_coverage.competitor_only?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-sm font-semibold text-blue-700">
                          경쟁사 선점 키워드 ({result.keyword_coverage.competitor_only.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.keyword_coverage.competitor_only.map((kw) => (
                          <span key={kw} className="bg-blue-100 text-blue-700 border border-blue-200 text-sm px-3 py-1 rounded-full">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* A-2. 블로그 진단 점수 추이 (30일) */}
            {token && <BlogScoreTrendChart businessId={business.id} token={token} />}

            {/* 섹션 B. 경쟁사 키워드 점유 현황 — competitor_keyword_detail
                (2026-07-17: 점수·순위 비교 카드는 제거함 — 경쟁사 블로그 URL을 몰라
                실측 불가능한 채 영구 비활성 상태였고, 이 패널이 같은 키워드 갭을
                더 상세히(경쟁사별 점유 여부) 보여주므로 중복이었음) */}
            {result.competitor_blog_comparison?.competitor_keyword_detail &&
              result.competitor_blog_comparison.competitor_keyword_detail.length > 0 && (
                <CompetitorKeywordBlockedPanel
                  keywordDetail={result.competitor_blog_comparison.competitor_keyword_detail}
                />
              )}

            {/* 섹션 C. 블로그 언급 수 비교 차트 */}
            {/* 백엔드 조회 실패 시 competitor_blog_mentions가 빈 객체({})로 올 수 있음 —
                {}도 truthy라 my_count 존재 여부로 실제 데이터 유무를 구분 (data.competitors.map 크래시 방지) */}
            {result.competitor_blog_mentions &&
              typeof result.competitor_blog_mentions.my_count === "number" &&
              Array.isArray(result.competitor_blog_mentions.competitors) && (
                <BlogMentionBenchmarkCard
                  data={result.competitor_blog_mentions}
                  businessName={business.name}
                />
              )}

            {/* A. AI 인용 체크리스트 */}
            {result.ai_readiness_items && result.ai_readiness_items.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <h3 className="text-base md:text-lg font-bold text-gray-900">
                    {isBlogInactive
                      ? "정보형 AI 브리핑·ChatGPT·Gemini·Google 인용 체크리스트"
                      : "AI 브리핑 인용 체크리스트"}
                  </h3>
                </div>
                <div className={result.ai_readiness_items.length >= 5 ? "grid grid-cols-1 md:grid-cols-2 gap-2" : "space-y-2"}>
                  {result.ai_readiness_items.map((item, idx) => {
                    const isUnavailable = item.unavailable || item.passed === null;
                    const boxClass = isUnavailable
                      ? "bg-gray-50 border-gray-200"
                      : item.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200";
                    const dotClass = isUnavailable
                      ? "bg-gray-400"
                      : item.passed ? "bg-green-500" : "bg-red-400";
                    const labelClass = isUnavailable
                      ? "text-gray-600"
                      : item.passed ? "text-green-800" : "text-red-800";
                    return (
                      <div key={idx} className={`flex items-start gap-3 rounded-xl p-3 border ${boxClass}`}>
                        <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${dotClass}`}>
                          {isUnavailable ? (
                            <span className="text-white text-sm leading-none">-</span>
                          ) : item.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${labelClass}`}>
                            {item.label}
                            {isUnavailable && <span className="ml-1.5 text-sm font-normal text-gray-500">(측정 불가)</span>}
                          </p>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══ 섹션 A: 채널별 AI 인용 현황 ═══ */}
            {result.multi_channel_citations &&
              Object.keys(result.multi_channel_citations).length > 0 && (
                <MultiChannelCitationPanel citations={result.multi_channel_citations} benchmark={result.citation_benchmark} />
              )}

            {/* F. 포스트별 상세 분석 — naeo.kr 핵심 대응 기능(실측 인용 배지)이라 상단으로 이동 (2026-07-17) */}
            {result.posts_detail && result.posts_detail.length > 0 && (
              <PostDetailSection posts={result.posts_detail} />
            )}

            {/* ═══ 이번 실행 항목 (항상 노출) ═══ */}
            {/* D. 중복 주제 + 제목 템플릿 반복 경고 */}
            {((result.duplicate_topics && result.duplicate_topics.length > 0) ||
              (result.templated_content && result.templated_content.length > 0)) && (
              <DuplicateTopicsWarning
                topics={result.duplicate_topics || []}
                templated={result.templated_content}
                isInactive={isBlogInactive}
              />
            )}

            {/* D-2. 이번 달 블로그 주제 추천 */}
            {result.topic_suggestions_v2 && result.topic_suggestions_v2.length > 0 && (
              <TopicSuggestionsV2Card suggestions={result.topic_suggestions_v2} />
            )}

            {/* E. 이번 주 할 일 카드 */}
            {result.weekly_actions && result.weekly_actions.length > 0 && (
              <WeeklyActionsCard actions={result.weekly_actions} businessId={business.id} />
            )}

            {/* 추가 분석 펼치기/접기 — 핵심 3축(키워드 커버리지·자기추세·경쟁사 대비)+전체 순위는
                위에서 항상 노출, 보조 항목(AI 브리핑 후보 포스트·발행주기·제목 개선)만 접어서 페이지 길이 관리 */}
            <button
              type="button"
              onClick={handleToggleDetail}
              aria-expanded={showDetail}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl py-2.5 transition-colors"
            >
              {showDetail ? (
                <>추가 분석 접기 <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>추가 분석 보기(AI 브리핑 후보 포스트·발행 주기·제목 개선) <ChevronDown className="w-4 h-4" /></>
              )}
            </button>

            {showDetail && (
              <div className="space-y-5">
                {/* B. AI 브리핑 가장 가까운 포스트 */}
                {result.best_citation_candidate && (
                  <BestCitationCandidateCard candidate={result.best_citation_candidate} />
                )}

                {/* C. 발행 주기 분석 */}
                {result.posting_frequency && (
                  <PostingFrequencyCard freq={result.posting_frequency} />
                )}

                {/* H. 제목 개선 제안 */}
                {result.posts_detail && result.posts_detail.length > 0 && (
                  <TitleImprovementSection posts={result.posts_detail} businessId={business.id} />
                )}
              </div>
            )}

            {/* 분석 일시 */}
            {result.analyzed_at && (
              <p className="text-sm text-gray-500 text-right">
                분석 일시: {new Date(result.analyzed_at).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 키워드 설정 모달 */}
      <KeywordManagerModal
        bizId={business.id}
        accessToken={token}
        isOpen={keywordModalOpen}
        onClose={() => setKeywordModalOpen(false)}
        onChange={() => {
          // 변경사항이 반영된 블로그 재분석
          handleAnalyze({ silent: true });
        }}
      />
    </PlanGate>
  );
}
