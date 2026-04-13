"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Minus, FileText, Star, Lightbulb } from "lucide-react";

interface PlatformResult {
  mentioned?: boolean;
  exposure_freq?: number;
  in_briefing?: boolean;
  error?: string;
}

interface CompetitorItem {
  name: string;
  score: number;
  isMe?: boolean;
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
  totalScore: number;
  competitorItems: CompetitorItem[];
  categoryKo: string;
  inBriefing?: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  naver: "네이버 AI 브리핑",
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  google: "Google AI",
  perplexity: "Perplexity",
};

// 표시할 플랫폼 순서 고정
const DISPLAY_PLATFORMS = ["naver", "gemini", "chatgpt", "perplexity", "google"];

function eunNeun(name: string): string {
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}은(는)`;
  const hasJongseong = (code - 0xac00) % 28 !== 0;
  return hasJongseong ? `${name}은` : `${name}는`;
}

function iGa(name: string): string {
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}이(가)`;
  const hasJongseong = (code - 0xac00) % 28 !== 0;
  return hasJongseong ? `${name}이` : `${name}가`;
}

function eulReul(name: string): string {
  const last = name[name.length - 1];
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
  smartPlaceScore,
  naverMentioned,
  totalScore,
  competitorItems,
  categoryKo,
  inBriefing,
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

  // 경쟁사 + 내 가게 합산 (내 가게 포함 확인)
  const hasCompetitors = competitorItems.filter((c) => !c.isMe).length > 0;
  const sortedItems = [...competitorItems].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...sortedItems.map((i) => i.score), 1);

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
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === kwIdx ? "w-5 bg-blue-400" : "w-1.5 bg-slate-600 hover:bg-slate-400"
                  }`}
                />
              ))}
              <span className="text-xs text-slate-500 ml-1">{kwIdx + 1}/{allKeywords.length}</span>
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
            {eunNeun(businessName)} 지금 AI 검색에 나오지 않습니다
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
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5"
                >
                  <Minus className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-400 leading-tight">{label}</span>
                  <span className="ml-auto text-sm text-gray-400">이번 스캔에서 미확인</span>
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
                      <span className="block text-xs text-green-600 mt-0.5">네이버 AI 브리핑에서 내 가게를 직접 추천하고 있습니다</span>
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
                      <span className="block text-xs text-amber-700 mt-0.5">
                        <strong>AI 브리핑에는 아직 안 나옵니다</strong>
                      </span>
                      <span className="block text-xs text-amber-600 mt-1">
                        FAQ 등록과 리뷰를 늘리면 가능성이 높아집니다
                      </span>
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
                      <span className="block text-xs text-red-600 mt-0.5">네이버 검색과 AI 브리핑 모두에서 내 가게가 나오지 않습니다</span>
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
                  {known ? "알고 있음" : "모름"}
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
                ? `지금 어떤 AI도 ${businessName}을 모릅니다. AI로 오는 신규 손님이 0명인 상태입니다.`
                : mentionedCount <= 2
                ? `${mentionedCount}개 AI만 알고 있습니다. 나머지 AI 손님을 놓치고 있습니다.`
                : `절반 이상의 AI가 알고 있습니다. 조금만 더 최적화하세요.`}
            </div>
            {/* 비즈니스 임팩트 번역 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs md:text-sm text-slate-600">
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
                {reviewCount}개
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

          {/* 스마트플레이스 FAQ */}
          <div
            className={`rounded-xl p-4 border ${
              smartPlaceScore < 70
                ? "bg-red-50 border-red-200"
                : "bg-green-50 border-green-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-sm md:text-base font-semibold ${
                  smartPlaceScore < 70 ? "text-red-800" : "text-green-800"
                }`}
              >
                스마트플레이스 FAQ
              </span>
              <span
                className={`text-sm font-bold flex items-center gap-1 ${
                  smartPlaceScore < 70 ? "text-red-700" : "text-green-700"
                }`}
              >
                {smartPlaceScore < 70 ? "없음" : (
                  <><CheckCircle2 className="w-4 h-4" /> 있음</>
                )}
              </span>
            </div>
            <p
              className={`text-sm ${
                smartPlaceScore < 70 ? "text-red-700" : "text-green-700"
              }`}
            >
              {naverInBriefing
                ? "FAQ가 잘 등록되어 있습니다. 이제 ChatGPT·Gemini도 이 정보를 참고할 수 있도록 웹사이트에도 FAQ Schema를 추가해보세요."
                : naverMentionedOnly && smartPlaceScore >= 70
                ? "FAQ는 있습니다. AI 브리핑 인용을 늘리려면 FAQ 내용에 핵심 키워드를 더 구체적으로 포함시키세요."
                : smartPlaceScore < 70
                ? "FAQ 없음 — AI 브리핑 인용 경로 차단 상태. AI 브리핑이 가장 자주 직접 인용하는 항목입니다. FAQ가 없으면 AI가 질문에 답할 때 내 가게를 건너뜁니다."
                : "FAQ 있음. AI 브리핑이 직접 인용할 수 있는 내용이 등록되어 있습니다."}
            </p>
          </div>

          {/* 스마트플레이스 등록 */}
          <div
            className={`rounded-xl p-4 border ${
              smartPlaceScore < 40
                ? "bg-red-50 border-red-200"
                : "bg-green-50 border-green-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-sm md:text-base font-semibold ${
                  smartPlaceScore < 40 ? "text-red-800" : "text-green-800"
                }`}
              >
                스마트플레이스 등록
              </span>
              <span
                className={`text-sm font-bold flex items-center gap-1 ${
                  smartPlaceScore < 40 ? "text-red-700" : "text-green-700"
                }`}
              >
                {smartPlaceScore < 40 ? "미등록" : (
                  <><CheckCircle2 className="w-4 h-4" /> 등록됨</>
                )}
              </span>
            </div>
            <p
              className={`text-sm ${
                smartPlaceScore < 40 ? "text-red-700" : "text-green-700"
              }`}
            >
              {naverInBriefing
                ? "스마트플레이스가 잘 등록되어 있습니다. 구글 비즈니스 프로필도 등록하면 글로벌 AI 노출까지 확장할 수 있습니다."
                : naverMentionedOnly
                ? "스마트플레이스에는 등록되어 있습니다. AI 브리핑 인용을 위해 소개글과 영업시간을 최신 상태로 유지하세요."
                : smartPlaceScore < 40
                ? "스마트플레이스 미등록 — 네이버 AI 브리핑 노출의 가장 기본 조건입니다. 가장 먼저 등록이 필요합니다."
                : "스마트플레이스에 등록되어 있습니다."}
            </p>
          </div>
        </div>
      </div>

      {/* 섹션 4: 경쟁 가게와 비교 */}
      {hasCompetitors && (
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base md:text-lg font-bold text-gray-900">
                경쟁 가게 AI 노출 비교
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">AEOlab 분석 기준 점수</p>
            </div>
            {/* 직접 확인 링크 */}
            <a
              href={`https://search.naver.com/search.naver?query=${encodeURIComponent(displayRegion + " " + displayKeyword + " 추천")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              네이버에서 직접 확인 →
            </a>
          </div>

          <div className="space-y-2.5 mb-4">
            {sortedItems.map((item) => {
              const barWidth = Math.max(2, Math.round((item.score / maxScore) * 100));
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span
                    className={`text-sm font-medium w-28 md:w-36 truncate shrink-0 ${
                      item.isMe
                        ? "text-blue-700 font-bold"
                        : "text-gray-700"
                    }`}
                  >
                    {item.name}
                    {item.isMe && (
                      <span className="ml-1 text-xs text-blue-500">(나)</span>
                    )}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        item.isMe
                          ? "bg-blue-500"
                          : item.score >= totalScore
                          ? "bg-red-400"
                          : "bg-gray-300"
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-bold w-10 text-right shrink-0 ${
                      item.isMe ? "text-blue-700" : "text-gray-600"
                    }`}
                  >
                    {Math.round(item.score)}점
                  </span>
                </div>
              );
            })}
          </div>

          {/* 안내 박스 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              이 점수는 AEOlab가 리뷰·FAQ·스마트플레이스 등록 여부를 분석한 AI 노출 가능성 점수입니다.
              실제 네이버 AI 브리핑에 어떤 가게가 나오는지는{" "}
              <a
                href={`https://search.naver.com/search.naver?query=${encodeURIComponent(displayRegion + " " + displayKeyword + " 추천")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline underline-offset-1 font-medium"
              >
                직접 검색
              </a>
              으로 확인할 수 있습니다.
            </p>
          </div>
        </div>
      )}

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
                스마트플레이스 Q&amp;A에 FAQ 1개 등록
              </p>
              <p className="text-sm md:text-base text-amber-800 mt-1 leading-relaxed">
                &ldquo;예약은 어떻게 하나요?&rdquo; 같은 질문 1개만 올려도
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
    </div>
  );
}
