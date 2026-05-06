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
  Trophy,
  Target,
  Zap,
  CalendarDays,
  X,
} from "lucide-react";
import { PlanGate } from "@/components/common/PlanGate";
import { KeywordManagerModal } from "@/components/dashboard/KeywordManagerModal";
import { addExcludedKeyword } from "@/lib/api";
import Link from "next/link";
import { getBriefingEligibility, type BriefingEligibility } from "@/lib/userGroup";

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
}

interface WeeklyAction {
  priority: number;
  action: string;
  impact: "high" | "medium" | "low";
  reason: string;
}

interface CompetitorBlog {
  name: string;
  score: number;
  post_count: number;
  freshness: string;
  keyword_coverage: string[];
}

interface CompetitorBlogComparison {
  avg_score: number;
  my_score: number;
  my_rank: number;
  total_count: number;
  competitors: CompetitorBlog[];
  competitor_keyword_gaps?: string[];
  competitor_gap_message?: string;
}

interface BlogAnalysisResult {
  id?: string;
  business_id?: string;
  blog_url?: string;
  platform?: string;
  citation_score?: number;
  post_count?: number;
  total_post_count?: number;
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
  // v3 fields
  posting_frequency?: {
    monthly_counts: Record<string, number>;
    total_analyzed: number;
    avg_interval_days: number;
    consistency: "active" | "regular" | "irregular" | "inactive";
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
  ai_readiness_items?: Array<{
    label: string;
    passed: boolean;
    description?: string;
  }>;
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

function scoreLabel(score: number) {
  if (score >= 70) return "AI 인용 가능성 높음";
  if (score >= 40) return "보통 - 개선 여지 있음";
  return "낮음 - 즉시 개선 필요";
}

function scoreBgColor(score: number) {
  if (score >= 70) return "bg-green-50 border-green-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function postScoreBadge(score: number) {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-300";
  if (score >= 40) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-red-100 text-red-700 border-red-300";
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

/* ── WeeklyActionsCard ── */
function WeeklyActionsCard({ actions }: { actions: WeeklyAction[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("aeolab_blog_weekly_actions");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const toggle = (idx: number) => {
    const next = { ...checked, [idx]: !checked[idx] };
    setChecked(next);
    try { localStorage.setItem("aeolab_blog_weekly_actions", JSON.stringify(next)); } catch {}
  };

  if (!actions || actions.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-blue-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-blue-900">이번 주 할 일</h3>
        <span className="text-sm text-blue-500 ml-auto">
          {Object.values(checked).filter(Boolean).length}/{actions.length} 완료
        </span>
      </div>
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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!posts || posts.length === 0) return null;

  const shown = expanded ? posts : posts.slice(0, 5);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">포스트별 상세 분석</h3>
        <span className="text-sm text-gray-400 ml-auto">상위 {posts.length}개</span>
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
        </p>
      </div>

      {/* PC: 테이블 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm table-fixed">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[28%]" />
            <col className="w-[26%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-3 pr-3 font-semibold text-gray-600">제목</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">날짜</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">점수</th>
              <th className="pb-3 font-semibold text-gray-600 text-center">SEO</th>
              <th className="pb-3 pl-3 font-semibold text-gray-600">문제점</th>
              <th className="pb-3 pl-3 font-semibold text-gray-600">개선 제목</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                <td className="py-3 pr-3">
                  <div className="flex items-start gap-1">
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium line-clamp-2 break-keep">
                        {p.title || "(제목 없음)"}
                      </a>
                    ) : (
                      <span className="text-gray-800 font-medium line-clamp-2 break-keep">{p.title || "(제목 없음)"}</span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-center text-gray-500 whitespace-nowrap">
                  {p.date ? new Date(p.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "-"}
                </td>
                <td className="py-3 text-center">
                  <span className={`inline-flex items-center border text-sm font-bold px-2 py-0.5 rounded-full ${postScoreBadge(p.post_score)}`}>
                    {p.post_score}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className={`inline-flex items-center border text-sm font-bold px-2 py-0.5 rounded-full ${postScoreBadge(p.title_seo_score)}`}>
                    {p.title_seo_score}
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
                </td>
                <td className="py-3 pl-3">
                  {p.improved_title && p.improved_title !== p.title ? (
                    <div className="flex items-start gap-1.5">
                      <span
                        className="text-sm text-indigo-700 font-medium leading-snug break-keep flex-1 min-w-0"
                        title={p.improved_title}
                      >
                        {p.improved_title}
                      </span>
                      <button
                        onClick={() => {
                          copyToClipboard(p.improved_title, () => {});
                          setCopiedIdx(idx);
                          setTimeout(() => setCopiedIdx(null), 2000);
                        }}
                        className="shrink-0 p-1 hover:bg-indigo-100 rounded-lg transition-colors mt-0.5"
                        title="제목 복사"
                      >
                        {copiedIdx === idx ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-green-600">변경 불필요</span>
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
                  <p className="text-sm text-gray-400 mt-0.5">
                    {new Date(p.date).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center border text-sm font-bold px-2.5 py-0.5 rounded-full ${postScoreBadge(p.post_score)}`}>
                  {p.post_score}점
                </span>
              </div>
            </div>

            {/* positives + issues */}
            {((p.positives?.length ?? 0) > 0 || p.issues.length > 0) && (
              <div className="flex flex-wrap gap-1 mb-2">
                {(p.positives ?? []).map((pos, i) => (
                  <span key={`pos-${i}`} className="bg-green-50 text-green-700 border border-green-200 text-sm px-2 py-0.5 rounded-lg">
                    ✓ {pos}
                  </span>
                ))}
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

            {/* improved title */}
            {p.improved_title && p.improved_title !== p.title && (
              <div className="bg-white border border-indigo-200 rounded-lg p-3">
                <p className="text-sm text-gray-500 mb-1">개선 제목 제안</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-indigo-700 flex-1">{p.improved_title}</p>
                  <button
                    onClick={() => {
                      copyToClipboard(p.improved_title, () => {});
                      setCopiedIdx(idx);
                      setTimeout(() => setCopiedIdx(null), 2000);
                    }}
                    className="shrink-0 p-1.5 bg-indigo-100 hover:bg-indigo-200 rounded-lg transition-colors"
                  >
                    {copiedIdx === idx ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-indigo-600" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {posts.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
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

/* ── CompetitorComparisonSection ── */
function CompetitorComparisonSection({ comparison, businessName }: { comparison: CompetitorBlogComparison; businessName: string }) {
  const maxScore = Math.max(comparison.my_score, ...comparison.competitors.map(c => c.score), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">경쟁사 블로그 비교</h3>
      </div>

      {/* 순위 + 평균 비교 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-2xl md:text-3xl font-bold text-blue-700">{comparison.my_rank}위</div>
          <div className="text-sm text-blue-600 mt-1">{comparison.total_count}개 사업장 중</div>
        </div>
        <div className={`border rounded-xl p-4 text-center ${comparison.my_score >= comparison.avg_score ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className={`text-2xl md:text-3xl font-bold ${comparison.my_score >= comparison.avg_score ? "text-green-700" : "text-red-700"}`}>
            {comparison.my_score >= comparison.avg_score ? "+" : ""}{Math.round(comparison.my_score - comparison.avg_score)}점
          </div>
          <div className="text-sm text-gray-600 mt-1">경쟁사 평균 대비</div>
        </div>
      </div>

      {/* 바 차트 */}
      <div className="space-y-3">
        {/* 내 블로그 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-blue-700">{businessName} (나)</span>
            <span className="text-sm font-bold text-blue-700">{comparison.my_score}점</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.max((comparison.my_score / maxScore) * 100, 2)}%` }} />
          </div>
        </div>
        {/* 경쟁사 */}
        {comparison.competitors.map((c, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-600 truncate max-w-[60%]">{c.name}</span>
              <span className="text-sm font-semibold text-gray-700">{c.score}점 · {c.post_count}개</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gray-400 rounded-full transition-all" style={{ width: `${Math.max((c.score / maxScore) * 100, 2)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 경쟁사 키워드 갭 */}
      {comparison.competitor_keyword_gaps && comparison.competitor_keyword_gaps.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-200">
          <h4 className="text-sm font-bold text-gray-900 mb-1">
            경쟁사 블로그에는 있고 내 블로그에는 없는 키워드
          </h4>
          {comparison.competitor_gap_message && (
            <p className="text-sm text-gray-500 mb-3 leading-relaxed">{comparison.competitor_gap_message}</p>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            {comparison.competitor_keyword_gaps.map((kw) => (
              <span key={kw} className="inline-flex items-center border text-sm font-semibold px-3 py-1 rounded-full bg-red-50 border-red-200 text-red-700">
                {kw}
              </span>
            ))}
          </div>
          <p className="text-sm text-blue-600 leading-relaxed">
            이 키워드들로 포스팅하면 경쟁사 대비 AI 노출을 따라잡을 수 있습니다.
          </p>
        </div>
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
    if (count === 0) return "bg-gray-100 text-gray-400";
    if (count === 1) return "bg-blue-200 text-blue-700";
    if (count === 2) return "bg-blue-400 text-white";
    return "bg-blue-600 text-white";
  }

  function consistencyBadge(c: string) {
    if (c === "active") return { label: "활발", cls: "bg-green-100 text-green-700 border-green-300" };
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
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
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
              <span className="text-sm text-gray-400">건</span>
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
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-amber-800">
          다음 발행 권장일: {formatNextDate(freq.recommended_next_date)}
        </p>
      </div>
    </div>
  );
}

/* ── BestCitationCandidateCard ── */
function BestCitationCandidateCard({ candidate }: { candidate: NonNullable<BlogAnalysisResult["best_citation_candidate"]> }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-amber-500 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-amber-900">AI 검색 인용 가능성 높은 포스트</h3>
      </div>

      {/* 포스트 점수 + 제목 */}
      <div className="flex items-start gap-3 mb-3">
        <span className={`inline-flex items-center border text-sm font-bold px-2.5 py-0.5 rounded-full shrink-0 ${postScoreBadge(candidate.post_score)}`}>
          {candidate.post_score}점
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
          소요 시간: 5분
        </span>
      </div>
    </div>
  );
}

/* ── DuplicateTopicsWarning ── */
function DuplicateTopicsWarning({ topics, isInactive = false }: { topics: NonNullable<BlogAnalysisResult["duplicate_topics"]>; isInactive?: boolean }) {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <h3 className="text-base md:text-lg font-bold text-amber-900">중복 주제 감지</h3>
      </div>

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
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 md:p-6 shadow-sm">
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
                className="absolute top-2 right-2 w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
  const briefingEligibility = getBriefingEligibility(business?.category, !!business?.is_franchise);
  const isBlogInactive = briefingEligibility !== "active";
  const isBlogLikely   = briefingEligibility === "likely";

  const [loading, setLoading] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlogAnalysisResult | null>(null);
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
      try {
        const currentToken = token || (await getSafeSession())?.access_token || "";
        if (!currentToken) return;
        const res = await fetch(`${BACKEND}/api/blog/result/${business.id}`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
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
          const isOldFormat = hasNoDetails || hasEllipsis || missingPositives || missingNewFields;
          if (!isOldFormat) {
            setResult(data as BlogAnalysisResult);
          } else {
            setOldFormatDetected(true);
          }
        }
      } catch (e) {
        console.warn('[Blog] 저장된 분석 결과 조회 실패', e);
      } finally {
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
        const detail = (data as { detail?: string | { message?: string } }).detail;
        const message = typeof detail === "string"
          ? detail
          : (detail && typeof detail === "object" && detail.message) || `분석 실패 (${res.status})`;
        throw new Error(message);
      }
      const data: BlogAnalysisResult = await res.json();
      setResult(data);
      setToast({ type: "success", message: "블로그 분석이 완료됐습니다." });
      // 결과 영역으로 스크롤
      setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
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
              onClick={() => setSelectedBiz(biz)}
              className="text-left bg-white border border-gray-200 hover:border-blue-400 hover:shadow-md rounded-2xl p-5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-500">분석 중인 사업장:</span>
            <span className="text-sm font-semibold text-gray-900">{selectedBiz.name}</span>
            <button
              onClick={() => {
                setSelectedBiz(null);
                setResult(null);
              }}
              className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <X className="w-4 h-4" />
              사업장 변경
            </button>
          </div>
        )}

        {/* 블로그 미등록 */}
        {!savedBlogUrl && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-base md:text-lg font-bold text-amber-900 mb-1">블로그 주소가 등록되지 않았습니다</h2>
                <p className="text-sm text-amber-800 mb-4 leading-relaxed">
                  블로그 AI 진단을 사용하려면 사업장 설정에서 블로그 주소를 먼저 등록해 주세요.
                  네이버 블로그, 티스토리, 워드프레스 등 외부 블로그 주소도 사용 가능합니다.
                </p>
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
          <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
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
                  <p className="text-sm text-gray-400">
                    마지막 분석: {new Date(lastAnalyzedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                    {isStale(lastAnalyzedAt) && (
                      <span className="ml-2 text-amber-500 font-medium">- 7일 이상 지났습니다</span>
                    )}
                  </p>
                )}
                {!lastAnalyzedAt && (
                  <p className="text-sm text-gray-400">아직 분석 기록이 없습니다</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleAnalyze()}
                aria-busy={loading}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold text-base px-5 py-3 rounded-xl transition-colors w-full sm:w-auto shrink-0 min-h-[44px]"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> 재분석하기</>
                )}
              </button>
            </div>

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

            {error && (
              <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* 저장된 결과 불러오는 중 */}
        {savedBlogUrl && !result && resultLoading && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 md:p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
            <p className="text-base font-semibold text-gray-600 mb-1">이전 분석 결과를 불러오는 중...</p>
          </div>
        )}

        {/* 블로그 URL은 있지만 아직 분석 안 된 경우 */}
        {savedBlogUrl && !lastAnalyzedAt && !result && !loading && !resultLoading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-4">
            <span className="text-2xl shrink-0">&#x23F3;</span>
            <div>
              <p className="font-semibold text-amber-800">블로그 분석이 진행 중입니다</p>
              <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
                등록하신 블로그를 자동으로 분석하고 있습니다. 보통 1~2분 안에 완료됩니다.<br/>
                완료되면 이 페이지를 새로고침하면 결과를 확인할 수 있습니다.
              </p>
              <button onClick={() => window.location.reload()} className="mt-2 text-sm text-amber-800 underline">
                새로고침
              </button>
            </div>
          </div>
        )}

        {/* 결과 없음 empty state */}
        {savedBlogUrl && !result && !loading && !autoTriggered && !resultLoading && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 md:p-8 text-center">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-600 mb-1">분석 결과가 없습니다</p>
            <p className="text-sm text-gray-500">
              위 &quot;재분석하기&quot; 버튼을 눌러 블로그 AI 진단을 시작하세요.
            </p>
          </div>
        )}

        {/* AI 브리핑 게이팅 안내 배너 (v4.1) */}
        {isBlogInactive && (
          <div className={`rounded-2xl border px-4 md:px-5 py-4 flex items-start gap-3 ${
            isBlogLikely ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"
          }`}>
            <span className="text-xl shrink-0 mt-0.5">
              {business?.is_franchise ? "🏢" : isBlogLikely ? "🔮" : "ℹ️"}
            </span>
            <div className="flex-1 min-w-0">
              {business?.is_franchise ? (
                <>
                  <p className="text-base font-bold text-gray-900 mb-1">
                    프랜차이즈 가맹점 — AI 브리핑 비대상
                  </p>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    프랜차이즈는 현재 네이버 AI 브리핑 제공 대상에서 제외됩니다(추후 확대 예정).
                    블로그 분석은 <strong>ChatGPT·Gemini·Google AI 검색 노출 및 C-rank 신호</strong> 강화에 동일하게 효과적입니다.
                  </p>
                </>
              ) : isBlogLikely ? (
                <>
                  <p className="text-base font-bold text-gray-900 mb-1">
                    AI 브리핑 확대 예상 업종
                  </p>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    미리 블로그 최적화를 완료해두면 확대 즉시 인용됩니다.
                    현재도 ChatGPT·Gemini·Google AI 검색 노출에 직접 효과적입니다.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-gray-900 mb-1">
                    현재 비대상 업종 — 블로그 분석은 모든 AI 채널에 효과적입니다
                  </p>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    네이버 AI 브리핑 비대상이지만, 아래 분석 결과는
                    <strong> ChatGPT·Gemini·Google·네이버 일반 검색 노출</strong> 및 C-rank 신호 강화에 동일하게 활용하세요.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ 분석 결과 ═══ */}
        {result && (
          <div ref={resultSectionRef} className="space-y-5">

            {/* 종합 점수 카드 */}
            <div className={`border rounded-2xl p-4 md:p-6 ${scoreBgColor(result.citation_score ?? 0)}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  {platformBadge(result.platform)}
                  {result.blog_url && (
                    <a
                      href={result.blog_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      블로그 열기 <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-3xl md:text-4xl font-bold ${scoreColor(result.citation_score ?? 0)}`}>
                    {result.citation_score ?? 0}
                    <span className="text-base font-normal text-gray-500 ml-1">/ 100</span>
                  </div>
                  <div className="text-sm font-medium text-gray-600 mt-0.5">
                    {scoreLabel(result.citation_score ?? 0)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white/70 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">{result.post_count ?? 0}</div>
                  <div className="text-sm text-gray-400 mt-0.5">(최근 50개 기준)</div>
                  <div className="text-sm text-gray-500 mt-0.5">분석 포스트</div>
                </div>
                <div className="bg-white/70 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {result.freshness_score ?? 0}
                    <span className="text-sm font-normal text-gray-500">/100</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">최신성 점수</div>
                </div>
                <div className="bg-white/70 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                  <div className="text-xl font-bold text-gray-900">
                    {result.keyword_coverage?.present?.length ?? 0}
                    {" / "}
                    {(result.keyword_coverage?.present?.length ?? 0) + (result.keyword_coverage?.missing?.length ?? 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">확인된 키워드</div>
                </div>
              </div>
            </div>

            {/* A. AI 인용 체크리스트 */}
            {result.ai_readiness_items && result.ai_readiness_items.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <h3 className="text-base md:text-lg font-bold text-gray-900">
                    {isBlogInactive
                      ? "AI 검색 인용 체크리스트 (ChatGPT·Gemini·Google·네이버)"
                      : "AI 브리핑 인용 체크리스트"}
                  </h3>
                </div>
                <div className={result.ai_readiness_items.length >= 5 ? "grid grid-cols-1 md:grid-cols-2 gap-2" : "space-y-2"}>
                  {result.ai_readiness_items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 rounded-xl p-3 border ${item.passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
                    >
                      <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${item.passed ? "bg-green-500" : "bg-red-400"}`}>
                        {item.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${item.passed ? "text-green-800" : "text-red-800"}`}>{item.label}</p>
                        {item.description && (
                          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* B. AI 브리핑 가장 가까운 포스트 */}
            {result.best_citation_candidate && (
              <BestCitationCandidateCard candidate={result.best_citation_candidate} />
            )}

            {/* C. 발행 주기 분석 */}
            {result.posting_frequency && (
              <PostingFrequencyCard freq={result.posting_frequency} />
            )}

            {/* D. 중복 주제 경고 */}
            {result.duplicate_topics && result.duplicate_topics.length > 0 && (
              <DuplicateTopicsWarning topics={result.duplicate_topics} isInactive={isBlogInactive} />
            )}

            {/* E. 이번 주 할 일 카드 */}
            {result.weekly_actions && result.weekly_actions.length > 0 && (
              <WeeklyActionsCard actions={result.weekly_actions} />
            )}

            {/* F. 포스트별 상세 분석 */}
            {result.posts_detail && result.posts_detail.length > 0 && (
              <PostDetailSection posts={result.posts_detail} />
            )}

            {/* G. 경쟁사 블로그 비교 */}
            {result.competitor_blog_comparison && (
              <CompetitorComparisonSection
                comparison={result.competitor_blog_comparison}
                businessName={business.name}
              />
            )}

            {/* H. 제목 개선 제안 */}
            {result.posts_detail && result.posts_detail.length > 0 && (
              <TitleImprovementSection posts={result.posts_detail} businessId={business.id} />
            )}

            {/* 키워드 커버리지 */}
            {result.keyword_coverage && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
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
                <p className="text-sm text-gray-400 mb-4">포스트 제목과 요약글을 기준으로 분석합니다 - 본문까지는 분석되지 않습니다</p>
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
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="text-sm font-semibold text-red-700">
                          없는 키워드 ({result.keyword_coverage.missing.length}) - 제목에 넣으면 AI 노출에 유리합니다
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">관련 없는 키워드는 X를 눌러 제외하면 분석에서 영구히 빠집니다</p>
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
                        <TrendingUp className="w-4 h-4 text-blue-500 shrink-0" />
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

            {/* 개선 권고사항 */}
            {result.top_recommendation && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
                  <h3 className="text-base font-bold text-amber-900">지금 당장 할 수 있는 개선</h3>
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">{result.top_recommendation}</p>

                {(result.missing_keywords?.length ?? 0) > 0 && (
                  <div className="mt-4 border-t border-amber-200 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-sm font-semibold text-amber-800">
                        다음 포스트 제목에 이 키워드를 넣으세요:
                      </p>
                      <button
                        onClick={() => copyToClipboard(result.missing_keywords!.slice(0, 5).join(", "), setKwCopied)}
                        className="shrink-0 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors w-full sm:w-auto justify-center"
                      >
                        {kwCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {kwCopied ? "복사됨" : "키워드 복사"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {result.missing_keywords!.slice(0, 5).map((kw) => (
                        <span key={kw} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 text-sm font-medium px-3 py-1 rounded-full">
                          {kw}
                          <button
                            type="button"
                            onClick={() => handleExcludeKeyword(kw)}
                            disabled={excludingKws.has(kw)}
                            aria-label={`${kw} 제외`}
                            title="이 키워드 제외"
                            className="ml-0.5 w-4 h-4 rounded-full hover:bg-amber-300 text-amber-600 hover:text-amber-900 flex items-center justify-center disabled:opacity-40 transition-colors"
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
                    <p className="text-sm text-amber-600 mt-2">
                      복사 후 네이버 블로그 에디터에 붙여넣어 포스트 제목에 활용하세요.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 분석 일시 */}
            {result.analyzed_at && (
              <p className="text-sm text-gray-400 text-right">
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
