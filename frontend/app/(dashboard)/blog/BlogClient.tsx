"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Copy, CheckCircle2, AlertTriangle, TrendingUp, FileText, ExternalLink, Loader2 } from "lucide-react";
import { PlanGate } from "@/components/common/PlanGate";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Business {
  id: string;
  name: string;
  category: string;
  region: string;
  keywords?: string[];
}

interface BlogAnalysisResult {
  id?: string;
  business_id?: string;
  blog_url?: string;
  platform?: string;
  citation_score?: number;
  post_count?: number;
  freshness_score?: number;
  keyword_coverage?: {
    present: string[];
    missing: string[];
    competitor_only: string[];
  };
  top_recommendation?: string;
  missing_keywords?: string[];
  analyzed_at?: string;
}

interface Props {
  business: Business;
  currentPlan: string;
  initialResult: BlogAnalysisResult | null;
  accessToken: string;
}

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
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
  if (score >= 40) return "보통 — 개선 여지 있음";
  return "낮음 — 즉시 개선 필요";
}

function scoreBgColor(score: number) {
  if (score >= 70) return "bg-green-50 border-green-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export function BlogClient({ business, currentPlan, initialResult, accessToken: initialToken }: Props) {
  const [blogUrl, setBlogUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlogAnalysisResult | null>(initialResult);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState(initialToken);

  useEffect(() => {
    if (!token) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) setToken(session.access_token);
      });
    }
  }, [token]);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!blogUrl.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND}/api/blog/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: business.id,
          blog_url: blogUrl.trim(),
          category: business.category,
          keywords: business.keywords ?? [],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? `분석 실패 (${res.status})`);
      }
      const data: BlogAnalysisResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="블로그 AI 진단">
      <div className="space-y-6 max-w-3xl">
        {/* 입력 폼 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
            <h2 className="text-base md:text-lg font-bold text-gray-900">블로그 URL 입력</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            네이버 블로그 주소(blog.naver.com/xxx) 또는 외부 블로그 URL을 입력하세요.
            분석에 15~25초 정도 소요됩니다.
          </p>
          <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={blogUrl}
              onChange={(e) => setBlogUrl(e.target.value)}
              placeholder="예: https://blog.naver.com/myblog"
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !blogUrl.trim()}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors shrink-0"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 분석 중...</>
              ) : (
                <><Search className="w-4 h-4" /> 분석하기</>
              )}
            </button>
          </form>
          {loading && (
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              블로그 포스트를 읽고 AI 브리핑 인용 가능성을 분석 중입니다. 잠시만 기다려 주세요...
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* 결과 없음 empty state */}
        {!result && !loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-600 mb-1">아직 분석 결과가 없습니다</p>
            <p className="text-sm text-gray-500">
              위 입력창에 블로그 URL을 입력하고 "분석하기"를 클릭하세요.
            </p>
          </div>
        )}

        {/* 분석 결과 */}
        {result && (
          <div className="space-y-5">
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
                  <div className="text-sm text-gray-500 mt-0.5">분석 포스트 수</div>
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
                  <div className="text-sm text-gray-500 mt-0.5">핵심 키워드 보유</div>
                </div>
              </div>
            </div>

            {/* 키워드 커버리지 */}
            {result.keyword_coverage && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 mb-4">키워드 커버리지</h3>
                <div className="space-y-4">
                  {(result.keyword_coverage.present?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-sm font-semibold text-green-700">
                          보유 키워드 ({result.keyword_coverage.present.length})
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
                          부족한 키워드 ({result.keyword_coverage.missing.length}) — 지금 추가하세요
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.keyword_coverage.missing.map((kw) => (
                          <span key={kw} className="bg-red-100 text-red-700 border border-red-200 text-sm px-3 py-1 rounded-full">
                            {kw}
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
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
                      <h3 className="text-base font-bold text-amber-900">지금 당장 할 수 있는 개선</h3>
                    </div>
                    <p className="text-sm text-amber-800 leading-relaxed">{result.top_recommendation}</p>
                    {(result.missing_keywords?.length ?? 0) > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-amber-800 mb-1.5">추가하면 효과적인 키워드:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.missing_keywords!.slice(0, 5).map((kw) => (
                            <span key={kw} className="bg-amber-100 text-amber-800 border border-amber-300 text-sm font-medium px-3 py-1 rounded-full">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.top_recommendation ?? "", setCopied)}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
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
    </PlanGate>
  );
}
