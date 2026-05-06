"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Minus, FileText, Star, Lightbulb } from "lucide-react";

interface PlatformResult {
  mentioned?: boolean;
  exposure_freq?: number;
  exposure_rate?: number;
  in_briefing?: boolean;
  error?: string;
}

interface Props {
  businessName: string;
  category: string;
  region: string;
  keywords?: string[];
  allPlatformResults: Record<string, PlatformResult>;
  reviewCount: number;
  avgRating: number;
  smartPlaceScore: number;
  naverMentioned: boolean;
  categoryKo: string;
  inBriefing?: boolean;
  naverPlaceUrl?: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  naver: "네이버 AI 브리핑",
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  google: "Google AI",
};

// 표시할 플랫폼 순서 고정
const DISPLAY_PLATFORMS = ["naver", "gemini", "chatgpt", "google"];


function eunNeun(name: string): string {
  if (!name) return "우리 가게은(는)";
  const last = name[name.length - 1];
  if (!last) return `${name}은(는)`;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}은(는)`;
  const hasJongseong = (code - 0xac00) % 28 !== 0;
  return hasJongseong ? `${name}은` : `${name}는`;
}

function iGa(name: string): string {
  if (!name) return "우리 가게이(가)";
  const last = name[name.length - 1];
  if (!last) return `${name}이(가)`;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}이(가)`;
  const hasJongseong = (code - 0xac00) % 28 !== 0;
  return hasJongseong ? `${name}이` : `${name}가`;
}

function eulReul(name: string): string {
  if (!name) return "우리 가게을(를)";
  const last = name[name.length - 1];
  if (!last) return `${name}을(를)`;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}을(를)`;
  const hasJongseong = (code - 0xac00) % 28 !== 0;
  return hasJongseong ? `${name}을` : `${name}를`;
}

// 행정단위 접미사 제거: "창원시" → "창원"
function stripRegionSuffix(region: string): string {
  return region.replace(/(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$/, "").trim();
}

export default function AIDiagnosisCard({
  businessName,
  category: _category,
  region,
  keywords,
  allPlatformResults,
  reviewCount,
  avgRating,
  smartPlaceScore,
  naverMentioned,
  categoryKo,
  inBriefing,
  naverPlaceUrl,
}: Props) {
  const naverInBriefing = inBriefing ?? (allPlatformResults["naver"]?.in_briefing === true);
  const naverMentionedOnly = naverMentioned && !naverInBriefing;

  // 섹션 3 제목은 "AI 검색 준비 상태"로 고정
  // (상태별 세부 안내는 각 항목 내 텍스트로 표시)
  const section3Title = "AI 검색 준비 상태";
  // 등록 키워드 전체 목록 (없으면 카테고리명 1개)
  const allKeywords = keywords && keywords.length > 0 ? keywords : [categoryKo];
  const displayRegion = stripRegionSuffix(region.split(" ")[0]);

  // 키워드 순환: 3초마다 다음 키워드로 페이드 전환
  const [kwIdx, setKwIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (allKeywords.length <= 1) return;
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setKwIdx((prev) => (prev + 1) % allKeywords.length);
        setFading(false);
      }, 350);
    }, 3000);
    return () => clearInterval(timer);
  }, [allKeywords.length]);

  const displayKeyword = allKeywords[kwIdx];
  // 노출된 AI 개수 계산
  const mentionedCount = DISPLAY_PLATFORMS.filter((key) => {
    const r = allPlatformResults[key];
    if (!r || r.error) return false;
    return r.mentioned === true || (r.exposure_freq !== undefined && r.exposure_freq > 0);
  }).length;

  const totalPlatforms = DISPLAY_PLATFORMS.filter((key) => {
    const r = allPlatformResults[key];
    return r && !r.error;
  }).length;

  // CTA 조건
  const ctaType: "faq" | "review" | "none" =
    smartPlaceScore < 70 ? "faq" : reviewCount === 0 ? "review" : "none";

  return (
    <div className="space-y-4">
      {/* 섹션 1: 핵심 메시지 히어로 */}
      <div className="bg-slate-900 rounded-2xl p-5 md:p-7 text-white">
        <p className="text-sm md:text-base text-slate-400 mb-2">
          손님이 AI에게 물어봤을 때...
        </p>
        {/* 키워드 순환 표시 — 등록된 키워드를 3초마다 전환 */}
        <div className="mb-4">
          <p
            className="text-base md:text-lg text-slate-200 font-mono transition-opacity duration-300"
            style={{ opacity: fading ? 0 : 1 }}
          >
            &ldquo;{displayRegion} <span className="text-blue-300 font-semibold">{displayKeyword}</span> 추천해줘&rdquo;
          </p>
          {allKeywords.length > 1 && (
            <div className="flex items-center gap-1.5 mt-2">
              {allKeywords.map((kw, i) => (
                <button
                  key={kw}
                  onClick={() => { setFading(false); setKwIdx(i); }}
                  title={kw}
                  aria-label={`${kw} 키워드 보기`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === kwIdx ? "w-5 bg-blue-400" : "w-1.5 bg-slate-600 hover:bg-slate-400"
                  }`}
                />
              ))}
              <span className="text-sm text-slate-500 ml-1">{kwIdx + 1}/{allKeywords.length}</span>
            </div>
          )}
        </div>
        {naverInBriefing ? (
          <p className="text-xl md:text-2xl font-bold text-green-400 leading-snug">
            {iGa(businessName)} 네이버 AI 브리핑에 나오고 있습니다!
          </p>
        ) : naverMentionedOnly ? (
          <p className="text-xl md:text-2xl font-bold text-amber-400 leading-snug">
            {iGa(businessName)} 네이버 검색에는 나오지만, AI 브리핑에는 아직 안 나옵니다
          </p>
        ) : (
          <p className="text-xl md:text-2xl font-bold text-white leading-snug">
            {eunNeun(businessName)} 지금 네이버 AI 브리핑에 나오지 않습니다
          </p>
        )}
        <p className="text-sm md:text-base text-slate-400 mt-3">
          아래에서 이유와 해결 방법을 확인하세요
        </p>
      </div>

      {/* 섹션 2: AI별 인식 현황 */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
          지금 이 AI들은 {eulReul(businessName)} 알고 있나요?
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          AI마다 같은 질문에도 다른 가게를 추천합니다.
        </p>

        <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4">
          {DISPLAY_PLATFORMS.map((key) => {
            const r = allPlatformResults[key];
            const label = PLATFORM_LABELS[key] ?? key;
            if (!r) {
              const weeklyNote = "이번 스캔에서 미확인";
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5"
                >
                  <Minus className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-400 leading-tight">{label}</span>
                  <span className="ml-auto text-sm text-gray-400">{weeklyNote}</span>
                </div>
              );
            }
            if (r.error) {
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5"
                >
                  <Minus className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-500 leading-tight">{label}</span>
                  <span className="ml-auto text-sm text-gray-400">확인 불가</span>
                </div>
              );
            }

            // 네이버는 "검색 언급"과 "AI 브리핑 직접 인용"을 구분
            if (key === "naver") {
              const searchMentioned = r.mentioned === true;
              const inBriefing = r.in_briefing === true;
              if (inBriefing) {
                // 최상위: AI 브리핑 직접 인용
                return (
                  <div key={key} className="col-span-2 flex items-start gap-2 rounded-xl px-3 py-3 border bg-green-50 border-green-300">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-green-800">{label}</span>
                      <span className="block text-sm text-green-600 mt-0.5">네이버 AI 브리핑에서 내 가게를 직접 추천하고 있습니다</span>
                      <a
                        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(displayRegion + " " + displayKeyword + " 추천")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline"
                      >
                        네이버에서 직접 확인 →
                      </a>
                    </div>
                    <span className="text-sm font-bold text-green-700 shrink-0">브리핑 인용</span>
                  </div>
                );
              } else if (searchMentioned) {
                // 중간: 검색엔 나오지만 브리핑 미인용
                return (
                  <div key={key} className="col-span-2 flex items-start gap-2 rounded-xl px-3 py-3 border bg-amber-50 border-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-amber-800">{label}</span>
                      <span className="block text-sm text-amber-700 mt-0.5">
                        <strong>AI 브리핑에는 아직 안 나옵니다</strong>
                      </span>
                      <span className="block text-sm text-amber-600 mt-1">
                        소개글 Q&A 추가와 리뷰를 늘리면 가능성이 높아집니다
                      </span>
                      <a
                        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(displayRegion + " " + displayKeyword + " 추천")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline"
                      >
                        네이버에서 직접 확인 →
                      </a>
                    </div>
                    <span className="text-sm font-bold text-amber-600 shrink-0">검색만 노출</span>
                  </div>
                );
              } else {
                // 미노출
                return (
                  <div key={key} className="col-span-2 flex items-start gap-2 rounded-xl px-3 py-3 border bg-red-50 border-red-200">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-red-800">{label}</span>
                      <span className="block text-sm text-red-600 mt-0.5">네이버 검색과 AI 브리핑 모두에서 내 가게가 나오지 않습니다</span>
                      <a
                        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(displayRegion + " " + displayKeyword + " 추천")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline"
                      >
                        네이버에서 직접 확인 →
                      </a>
                    </div>
                    <span className="text-sm font-bold text-red-600 shrink-0">미노출</span>
                  </div>
                );
              }
            }

            // 네이버 외 플랫폼
            const known =
              r.mentioned === true ||
              (r.exposure_freq !== undefined && r.exposure_freq > 0);
            const geminiPct =
              key === "gemini" && r.exposure_rate !== undefined
                ? Math.round(r.exposure_rate * 100)
                : null;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                  known
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                {known
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                }
                <span className={`text-sm font-medium leading-tight ${known ? "text-green-800" : "text-red-800"}`}>
                  {label}
                </span>
                <span className={`ml-auto text-sm font-semibold ${known ? "text-green-700" : "text-red-600"}`}>
                  {geminiPct !== null ? `${geminiPct}%` : known ? "알고 있음" : "모름"}
                </span>
              </div>
            );
          })}
        </div>

        {/* 요약 + 비즈니스 임팩트 */}
        {totalPlatforms > 0 && (
          <div className="space-y-2">
            <div
              className={`rounded-xl px-4 py-3 text-sm md:text-base font-medium ${
                mentionedCount === 0
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : mentionedCount <= 2
                  ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                  : "bg-green-50 text-green-800 border border-green-200"
              }`}
            >
              {mentionedCount === 0
                ? `테스트한 AI에서 ${businessName}이(가) 확인되지 않았습니다. AI 검색 노출이 없는 상태입니다.`
                : mentionedCount <= 2
                ? `${mentionedCount}개 AI에서만 확인됩니다. 나머지 AI에서 노출이 더 필요합니다.`
                : `절반 이상의 AI가 알고 있습니다. 조금만 더 최적화하세요.`}
            </div>
            {/* 비즈니스 임팩트 번역 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm md:text-sm text-slate-600">
              {naverInBriefing ? (
                <span className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>네이버 AI 브리핑 노출 = 지금 이 순간에도 &ldquo;{displayRegion} {displayKeyword} 추천해줘&rdquo;를 검색한 손님에게 노출 중</span>
                </span>
              ) : naverMentionedOnly ? (
                <span className="flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>AI 브리핑 미인용 = AI 결과 1위 자리를 경쟁 가게에 빼앗기고 있습니다 — FAQ 1개 등록으로 개선 가능</span>
                </span>
              ) : mentionedCount === 0 ? (
                <span className="flex items-start gap-1.5">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>AI 브리핑 미노출 = AI로 가게 찾는 손님에게 지금 노출되지 않고 있습니다 — 지금 시작하면 2~4주 내 변화</span>
                </span>
              ) : (
                <span className="flex items-start gap-1.5">
                  <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>일부 AI 노출 중 = 아직 놓치고 있는 AI 손님이 있습니다 — 가이드 → 개선 액션 확인</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 섹션 3: 상태별 진단 */}
      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4">
          {section3Title}
        </h2>

        <div className="space-y-3">
          {/* 리뷰 상태 */}
          <div
            className={`rounded-xl p-4 border ${
              naverInBriefing
                ? "bg-green-50 border-green-200"
                : reviewCount === 0
                ? "bg-red-50 border-red-200"
                : reviewCount < 10
                ? "bg-yellow-50 border-yellow-200"
                : "bg-green-50 border-green-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-sm md:text-base font-semibold ${
                  naverInBriefing
                    ? "text-green-800"
                    : reviewCount === 0
                    ? "text-red-800"
                    : reviewCount < 10
                    ? "text-yellow-800"
                    : "text-green-800"
                }`}
              >
                리뷰 수
              </span>
              <span
                className={`text-base md:text-lg font-bold ${
                  naverInBriefing
                    ? "text-green-700"
                    : reviewCount === 0
                    ? "text-red-700"
                    : reviewCount < 10
                    ? "text-yellow-700"
                    : "text-green-700"
                }`}
              >
                {reviewCount}개{avgRating > 0 ? ` · ★${avgRating.toFixed(1)}` : ""}
              </span>
            </div>
            {/* 진행 막대 */}
            <div className="w-full bg-white rounded-full h-2.5 mb-2 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  naverInBriefing || reviewCount >= 10
                    ? "bg-green-500"
                    : reviewCount > 0
                    ? "bg-yellow-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${Math.min(100, (reviewCount / 50) * 100)}%` }}
              />
            </div>
            <p
              className={`text-sm ${
                naverInBriefing
                  ? "text-green-700"
                  : reviewCount === 0
                  ? "text-red-700"
                  : reviewCount < 10
                  ? "text-yellow-700"
                  : "text-green-700"
              }`}
            >
              {naverInBriefing
                ? "이미 잘 되고 있습니다. 리뷰를 꾸준히 유지하면 ChatGPT·Gemini 등 글로벌 AI에도 노출 확률이 높아집니다."
                : naverMentionedOnly && reviewCount < 10
                ? "네이버 검색에는 나오지만, AI 브리핑에 인용되려면 리뷰가 최소 10개 이상 필요합니다."
                : naverMentionedOnly && reviewCount >= 10
                ? `리뷰 ${reviewCount}개로 충분합니다. AI 브리핑 인용을 높이려면 FAQ와 소개글에 핵심 키워드를 보강하세요.`
                : reviewCount === 0
                ? "리뷰가 없으면 AI는 이 가게를 거의 추천하지 않습니다."
                : reviewCount < 10
                ? "AI는 리뷰가 많은 가게를 더 자주 추천합니다. 리뷰 10개 이상이면 추천 빈도가 크게 증가합니다."
                : "리뷰 수가 충분합니다. AI 추천 기반이 갖춰져 있습니다."}
            </p>
          </div>
          {naverPlaceUrl ? (
            <p className="text-sm text-gray-400 mt-2">
              스마트플레이스 세부 항목(FAQ·소개글·소식 등)은 아래{" "}
              <span className="font-medium text-blue-500">실시간 점검</span>에서 확인하세요.
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-2">
              스마트플레이스 세부 항목(FAQ·소개글·소식 등)은{" "}
              <span className="font-medium text-blue-500">점수 근거 카드</span>에서 확인하세요.{" "}
              <a href="/onboarding" className="text-blue-400 hover:underline">URL 등록 →</a>
            </p>
          )}
        </div>
      </div>

      {/* 섹션 5: 지금 당장 할 수 있는 1가지 */}
      {ctaType === "faq" && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 md:p-6">
          <p className="text-sm font-semibold text-amber-700 mb-2">
            지금 당장 하면 가장 효과적인 것 1가지
          </p>
          <div className="flex items-start gap-3 mb-3">
            <FileText className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-base md:text-lg font-bold text-amber-900 leading-snug">
                소개글 하단에 Q&amp;A 1개 추가
              </p>
              <p className="text-sm md:text-base text-amber-800 mt-1 leading-relaxed">
                &ldquo;예약은 어떻게 하나요?&rdquo; 같은 질문 1개만 넣어도
                AI가 2~4주 안에 인식하기 시작합니다.
              </p>
            </div>
          </div>
          <Link
            href="https://smartplace.naver.com/bizes"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm md:text-base px-4 py-2.5 rounded-xl transition-colors"
          >
            네이버 스마트플레이스 관리자 바로가기 →
          </Link>
        </div>
      )}

      {ctaType === "review" && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 md:p-6">
          <p className="text-sm font-semibold text-amber-700 mb-2">
            지금 당장 하면 가장 효과적인 것 1가지
          </p>
          <div className="flex items-start gap-3">
            <Star className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-base md:text-lg font-bold text-amber-900 leading-snug">
                단골 손님 1명에게 네이버 리뷰를 요청하세요
              </p>
              <p className="text-sm md:text-base text-amber-800 mt-1 leading-relaxed">
                &ldquo;{businessName} 검색 후 별점과 한 줄 후기 남겨주시면 감사해요&rdquo;
              </p>
              <p className="text-sm text-amber-700 mt-1">
                리뷰 1개만 있어도 점수가 올라갑니다.
              </p>
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-3 leading-relaxed">
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}
