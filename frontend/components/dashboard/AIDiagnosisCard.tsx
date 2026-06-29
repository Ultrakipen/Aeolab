"use client";

import Link from "next/link";
import { Fragment, useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Minus, FileText, Star, Lightbulb, Globe } from "lucide-react";

interface PlatformResult {
  mentioned?: boolean;
  exposure_freq?: number;
  exposure_rate?: number;
  sample_size?: number;
  in_briefing?: boolean;
  in_ai_overview?: boolean;
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
  briefingEligibility?: "active" | "likely" | "inactive";
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
  briefingEligibility,
}: Props) {
  const isNaverBriefingInactive = briefingEligibility === "inactive";
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
  const PLATFORM_SHORT: Record<string, string> = {
    naver: "네이버", gemini: "Gemini", chatgpt: "ChatGPT", google: "Google AI",
  };

  // 노출된 AI 목록 및 개수 계산
  // naver: in_briefing 기준 (mentioned는 일반 검색 포함이라 AI 브리핑 오판 방지)
  // google: in_ai_overview 기준 (mentioned는 일반 유기 검색 포함이라 "Google AI" 오판 방지)
  // INACTIVE 업종은 naver 제외
  function _isAiExposed(key: string, r: PlatformResult): boolean {
    if (key === "naver") return r.in_briefing === true;
    if (key === "google") return r.in_ai_overview === true;
    return r.mentioned === true || (r.exposure_freq !== undefined && r.exposure_freq > 0);
  }
  const activePlatformsForSummary = DISPLAY_PLATFORMS.filter((key) => {
    if (isNaverBriefingInactive && key === "naver") return false;
    const r = allPlatformResults[key];
    return r && !r.error;
  });
  const mentionedPlatforms = activePlatformsForSummary.filter((key) => {
    const r = allPlatformResults[key];
    return _isAiExposed(key, r);
  });
  const notMentionedPlatforms = activePlatformsForSummary.filter((key) => {
    const r = allPlatformResults[key];
    return !_isAiExposed(key, r);
  });
  const mentionedCount = mentionedPlatforms.length;
  const totalPlatforms = activePlatformsForSummary.length;

  // "N개 AI에서만 확인" 메시지에 플랫폼 명 포함
  const mentionedNames = mentionedPlatforms.map(k => PLATFORM_SHORT[k] ?? k);
  const notMentionedNames = notMentionedPlatforms.map(k => PLATFORM_SHORT[k] ?? k);

  // CTA 조건 — INACTIVE 업종은 구글 비즈니스 프로필 등록 CTA
  const ctaType: "faq" | "review" | "gbp" | "none" =
    isNaverBriefingInactive
      ? "gbp"
      : smartPlaceScore < 70
      ? "faq"
      : reviewCount === 0
      ? "review"
      : "none";

  return (
    <div className="space-y-4">
      {/* 섹션 1: 핵심 메시지 히어로 */}
      <div className="bg-slate-900 rounded-xl p-5 md:p-7 text-white">
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
        {isNaverBriefingInactive ? (
          <p className="text-xl md:text-2xl font-bold text-white leading-snug">
            {eunNeun(businessName)} '플레이스형' 네이버 AI 브리핑 비대상 업종입니다. 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다. AI탭·ChatGPT·Gemini는 소개글·리뷰 개선으로 노출을 시작할 수 있습니다.
          </p>
        ) : naverInBriefing ? (
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
      <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
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
                  <Minus className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-600 leading-tight">{label}</span>
                  <span className="ml-auto text-sm text-gray-500">{weeklyNote}</span>
                </div>
              );
            }
            if (r.error) {
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5"
                >
                  <Minus className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-600 leading-tight">{label}</span>
                  <span className="ml-auto text-sm text-gray-500">확인 불가</span>
                </div>
              );
            }

            // 네이버는 "검색 언급"과 "AI 브리핑 노출 확인"을 구분
            if (key === "naver") {
              // INACTIVE 업종: 네이버 AI 브리핑 미지원 안내 + AI탭 준비 중 카드
              if (isNaverBriefingInactive) {
                return (
                  <Fragment key={key}>
                    <div className="col-span-2 flex items-start gap-2 rounded-xl px-3 py-3 border bg-gray-50 border-gray-200">
                      <Minus className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-600">네이버 검색 노출</span>
                        <span className="block text-sm text-gray-500 mt-0.5">
                          '플레이스형' AI 브리핑은 이 업종에 미적용 — '정보형 AI 브리핑'·AI탭·ChatGPT·Gemini는 동일한 개선 방법으로 노출 가능
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-400 shrink-0">'플레이스형' AI 브리핑 제외</span>
                    </div>
                    <div className="col-span-2 flex items-start gap-2 rounded-xl px-3 py-3 border bg-indigo-50 border-indigo-200">
                      <Minus className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-indigo-700">네이버 AI탭 (현재 네이버플러스 멤버십 한정 · 6월 전체 공개 예정)</span>
                        <span className="block text-sm text-indigo-500 mt-0.5">
                          업종 제한 없음 — 전체 공개 감지 즉시 자동 측정 시작 (월·목 자동 확인 중)
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-indigo-400 shrink-0">공개 대기 중</span>
                    </div>
                  </Fragment>
                );
              }
              const searchMentioned = r.mentioned === true;
              const inBriefing = r.in_briefing === true;
              if (inBriefing) {
                // 최상위: AI 브리핑 노출 확인
                return (
                  <div key={key} className="col-span-2 flex items-start gap-2 rounded-xl px-3 py-3 border bg-green-50 border-green-300">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-green-800">{label}</span>
                      <span className="block text-sm text-green-600 mt-0.5">측정 시점 기준, 네이버 AI 브리핑 노출이 확인되었습니다 (시점·로그인 상태에 따라 달라질 수 있음)</span>
                      <a
                        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(displayRegion + " " + displayKeyword + " 추천")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm text-blue-500 hover:underline"
                      >
                        네이버에서 직접 확인 →
                      </a>
                    </div>
                    <span className="text-sm font-bold text-green-700 shrink-0">브리핑 노출</span>
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
                        소개글·리뷰를 늘리면 네이버 검색 상위노출 가능성이 높아지고, 검색 순위가 오를수록 AI 브리핑·AI탭 노출 가능성도 함께 높아집니다
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
                      <span className="block text-sm text-red-600 mt-0.5">네이버 검색과 AI 브리핑 모두에서 내 가게가 나오지 않습니다 — 스마트플레이스 정보를 채울수록 네이버 검색 순위와 AI 노출이 함께 오릅니다</span>
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

            // Google AI Overview 분기 — mentioned는 일반 유기 검색도 포함하므로 in_ai_overview로 구분
            if (key === "google") {
              const inAiOverview = r.in_ai_overview === true;
              const googleMentioned = r.mentioned === true && !inAiOverview;
              const scanned = r.mentioned !== undefined;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                    inAiOverview
                      ? "bg-green-50 border-green-200"
                      : googleMentioned
                      ? "bg-amber-50 border-amber-200"
                      : scanned
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  {inAiOverview
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    : googleMentioned
                    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    : <XCircle className={`w-4 h-4 shrink-0 ${scanned ? "text-red-500" : "text-gray-400"}`} />
                  }
                  <span className={`text-sm font-medium leading-tight ${inAiOverview ? "text-green-800" : googleMentioned ? "text-amber-800" : scanned ? "text-red-800" : "text-gray-500"}`}>
                    {label}
                  </span>
                  <span className={`ml-auto text-sm font-semibold ${inAiOverview ? "text-green-700" : googleMentioned ? "text-amber-700" : scanned ? "text-red-600" : "text-gray-400"}`}>
                    {inAiOverview ? "AI 노출" : googleMentioned ? "검색만 노출" : scanned ? "미노출" : "미측정"}
                  </span>
                </div>
              );
            }

            // Gemini·ChatGPT
            const known =
              r.mentioned === true ||
              (r.exposure_freq !== undefined && r.exposure_freq > 0);
            // sample_n 결과는 mentioned 없이 exposure_freq만 존재 → 스캔 여부는 둘 다 확인
            const scanned =
              (r.mentioned !== undefined && r.mentioned !== null) ||
              r.exposure_freq !== undefined;
            // exposure_rate 보유 시 % 표시
            const exposurePct =
              r.exposure_rate !== undefined
                ? Math.round(r.exposure_rate * 100)
                : null;
            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
                  known
                    ? "bg-green-50 border-green-200"
                    : scanned
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                {known
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  : <XCircle className={`w-4 h-4 shrink-0 ${scanned ? "text-red-500" : "text-gray-400"}`} />
                }
                <span className={`text-sm font-medium leading-tight ${known ? "text-green-800" : scanned ? "text-red-800" : "text-gray-500"}`}>
                  {label}
                </span>
                <span className={`ml-auto text-sm font-semibold ${known ? "text-green-700" : scanned ? "text-red-600" : "text-gray-400"}`}>
                  {exposurePct !== null ? `${exposurePct}%` : known ? "노출됨" : scanned ? "미노출" : "미측정"}
                  {r.exposure_freq !== undefined && r.sample_size ? (
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      ({r.sample_size}번 중 {r.exposure_freq}번)
                    </span>
                  ) : null}
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
                ? `점검한 AI 채널(${activePlatformsForSummary.map(k => PLATFORM_SHORT[k]).join("·")})에서 ${businessName}이(가) 노출되지 않았습니다.`
                : mentionedCount <= 2
                ? `${mentionedNames.join("·")}에서만 확인됩니다. ${notMentionedNames.join("·")} 노출이 더 필요합니다.`
                : `${mentionedNames.join("·")} 등 절반 이상의 AI가 알고 있습니다.`}
            </div>
            {/* 비즈니스 임팩트 번역 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm md:text-sm text-slate-600">
              {isNaverBriefingInactive ? (
                <span className="flex items-start gap-1.5">
                  <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>이 업종은 '플레이스형' 네이버 AI 브리핑 비대상입니다. 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다. AI탭·ChatGPT·Gemini는 소개글·구글 비즈니스 프로필 개선으로 노출을 시작할 수 있습니다</span>
                </span>
              ) : naverInBriefing ? (
                <span className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>네이버 AI 브리핑 노출 = 지금 이 순간에도 &ldquo;{displayRegion} {displayKeyword} 추천해줘&rdquo;를 검색한 손님에게 노출 중</span>
                </span>
              ) : naverMentionedOnly ? (
                <span className="flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>AI 브리핑 미인용 = AI 결과 1위 자리를 경쟁 가게에 빼앗기고 있습니다 — 소개글 Q&A 1개 추가로 개선 가능</span>
                </span>
              ) : mentionedCount === 0 ? (
                <span className="flex items-start gap-1.5">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>AI 브리핑 미노출 = AI로 가게 찾는 손님에게 지금 노출되지 않고 있습니다 — 지금 시작하면 2~4주 내 AI 브리핑 노출 변화 가능</span>
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
      <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
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
                ? "이미 잘 되고 있습니다. 구글 비즈니스 프로필도 등록하면 ChatGPT·Gemini 노출 가능성이 함께 높아집니다."
                : !isNaverBriefingInactive && naverMentionedOnly && reviewCount < 10
                ? "네이버 검색에는 나오지만, AI 브리핑에 인용되려면 리뷰가 최소 10개 이상 필요합니다."
                : !isNaverBriefingInactive && naverMentionedOnly && reviewCount >= 10
                ? `리뷰 ${reviewCount}개로 충분합니다. AI 브리핑 인용을 높이려면 소개글 Q&A에 핵심 키워드를 보강하세요.`
                : reviewCount === 0
                ? (naverPlaceUrl
                    ? "네이버 플레이스 URL을 저장하면 리뷰 수가 자동 수집됩니다. 방금 등록했다면 약 30초 후 새로고침해 주세요."
                    : "네이버 플레이스 연동이 안 되어 리뷰를 자동 수집할 수 없습니다.")
                : reviewCount < 10
                ? "AI는 리뷰가 많은 가게를 더 자주 추천합니다. 리뷰 10개 이상이면 추천 빈도가 크게 증가합니다."
                : "리뷰 수가 충분합니다. AI 추천 기반이 갖춰져 있습니다."}
            </p>
            {reviewCount === 0 && (
              <p className="mt-1.5 text-sm text-red-600">
                {naverPlaceUrl ? (
                  <>리뷰가 있는데도 0이면 <Link href="/settings" className="underline font-medium text-red-700 hover:text-red-900">설정에서 플레이스 URL을 다시 저장</Link>해 주세요.</>
                ) : (
                  <Link href="/settings" className="underline font-medium text-red-700 hover:text-red-900">
                    설정에서 네이버 플레이스 연동 →
                  </Link>
                )}
              </p>
            )}
          </div>
          {naverPlaceUrl ? (
            <p className="text-sm text-gray-400 mt-2">
              스마트플레이스 세부 항목(소개글 Q&A·소식 등)은 아래{" "}
              <span className="font-medium text-blue-500">실시간 점검</span>에서 확인하세요.
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-2">
              스마트플레이스 세부 항목(소개글 Q&A·소식 등)은{" "}
              <span className="font-medium text-blue-500">채널별 분석 근거</span>에서 확인하세요.{" "}
              <a href="/onboarding" className="text-blue-400 hover:underline">URL 등록 →</a>
            </p>
          )}
        </div>
      </div>

      {/* 섹션 5: 지금 당장 할 수 있는 1가지 */}
      {ctaType === "gbp" && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-5 md:p-6">
          <p className="text-sm font-semibold text-blue-700 mb-2">
            지금 당장 하면 가장 효과적인 것 1가지
          </p>
          <div className="flex items-start gap-3 mb-3">
            <Globe className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-base md:text-lg font-bold text-blue-900 leading-snug">
                구글 비즈니스 프로필 등록
              </p>
              <p className="text-sm md:text-base text-blue-800 mt-1 leading-relaxed">
                구글 비즈니스 프로필 정보가 Gemini(구글 AI)에 반영됩니다. 지금 등록하면 2~4주 내 Gemini 노출이 개선될 수 있습니다. 네이버 AI탭은 스마트플레이스 소개글·리뷰를 채울수록 노출 가능성이 높아집니다.
              </p>
            </div>
          </div>
          <a
            href="https://business.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm md:text-base px-4 py-2.5 rounded-xl transition-colors"
          >
            구글 비즈니스 프로필 등록 →
          </a>
        </div>
      )}

      {ctaType === "faq" && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 md:p-6">
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
                네이버 AI탭·AI 브리핑 인식에 2~4주 소요됩니다. ChatGPT·Gemini는 구글 비즈니스 프로필 등록이 더 빠른 경로입니다.
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
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 md:p-6">
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
      <p className="text-sm text-gray-600 mt-3 leading-relaxed">
        ChatGPT는 과거 학습 데이터 기반 — 한국 소상공인은 낮은 점수가 일반적이며 단기 변동이 없습니다. Gemini(구글 AI)는 구글 비즈니스 프로필 정보를 반영하므로, 지금 등록하면 2~4주 내 인식이 개선될 수 있습니다.
      </p>
    </div>
  );
}
