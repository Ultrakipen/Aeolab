"use client";

import { Check, X, Search } from "lucide-react";

/**
 * FactEvidenceSection — AI에게 직접 물어본 결과를 사실 증거로 보여주는 섹션
 *
 * 트라이얼이 이미 수집한 가장 강력한 증거:
 * - ChatGPT 실제 응답 원문 (chatgpt_result.excerpt)
 * - 네이버 AI 브리핑 실측 (naver.in_briefing + briefing_text/excerpt)
 * - Gemini 노출 빈도 (10회 중 N회 — 트라이얼은 100회가 아닌 10회만 측정)
 *
 * 점수 요약·진단보다 위에 배치하여 사실 → 점수 → 행동 순서로 신뢰 확보.
 */

interface ChatGPTLike {
  mentioned?: boolean;
  excerpt?: string;
  exposure_freq?: number;
  sample_size?: number;
}

interface NaverLike {
  in_briefing?: boolean;
  briefing_excerpt?: string | null;
  briefing_text?: string;
  search_query?: string;
}

interface AIEvidenceQuery {
  query: string;
  mentioned: boolean;
  excerpt?: string;
}

interface Props {
  chatgptResult?: ChatGPTLike | null;
  naver?: NaverLike | null;
  exposureFreq?: number; // 트라이얼은 10회 기준
  totalSamples?: number; // 기본 10
  aiEvidence?: {
    queries?: AIEvidenceQuery[];
  } | null;
  analyzedKeyword?: string; // 측정에 사용된 핵심 키워드 (예: "파스타")
  region?: string;          // 지역 (예: "경상남도 창원시")
  userGroup?: string;       // ACTIVE / LIKELY / INACTIVE / franchise
}

function ResultBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
      <Check className="w-4 h-4" /> 노출됨
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
      <X className="w-4 h-4" /> 미노출
    </span>
  );
}

export default function FactEvidenceSection({
  chatgptResult,
  naver,
  exposureFreq,
  totalSamples = 10,
  aiEvidence,
  analyzedKeyword,
  region,
  userGroup,
}: Props) {
  const isActive = userGroup === "ACTIVE";
  const hasChatgpt = chatgptResult && typeof chatgptResult.mentioned === "boolean";
  const hasNaver = naver && typeof naver.in_briefing === "boolean";
  const hasGemini = typeof exposureFreq === "number" && exposureFreq >= 0;

  // 셋 다 없으면 섹션 자체 렌더링 안 함
  if (!hasChatgpt && !hasNaver && !hasGemini) return null;

  const naverExcerpt = naver?.briefing_excerpt || naver?.briefing_text || "";

  // 측정 증거 박스에 쓰이는 공통 값
  const regionPrefix = region ? region.split(" ")[0] : null;
  const keyword = analyzedKeyword || null;
  const subTitle =
    regionPrefix && keyword
      ? `'${regionPrefix} ${keyword} 추천' 실측 결과`
      : "사실 증거 — 추측이 아닌 실측 결과";

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5 shadow-sm">
      <div className="bg-slate-50 border-b border-slate-200 px-4 md:px-5 py-3 md:py-4">
        <p className="text-sm text-slate-500 mb-0.5">{subTitle}</p>
        <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" />
          <span className="text-slate-900">AI에게 직접 물어본 결과</span>
        </h2>
      </div>

      <div className="divide-y divide-slate-100">
        {/* 카드 1: 네이버 AI 브리핑 */}
        {hasNaver && (
          <div className={`p-4 md:p-6 ${naver!.in_briefing ? "bg-emerald-50/40" : "bg-red-50/40"}`}>
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-bold text-gray-900">네이버 AI 브리핑</span>
                <ResultBadge ok={naver!.in_briefing === true} />
              </div>
              {naver?.search_query && (
                <span className="text-sm text-gray-500">
                  &ldquo;{naver.search_query}&rdquo; 검색
                </span>
              )}
            </div>
            <p
              className={`text-base md:text-lg font-bold leading-snug mb-3 ${
                naver!.in_briefing ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {naver!.in_briefing
                ? "네이버 AI 브리핑에 내 가게가 나옵니다"
                : "네이버 AI 브리핑에 내 가게가 안 나옵니다"}
            </p>
            {naverExcerpt ? (
              <div className="bg-gray-100 border-l-4 border-gray-300 rounded-r-lg px-4 py-3 mb-2">
                <p className="text-sm text-gray-500 font-semibold mb-1">실제 브리핑 문장:</p>
                <p className="text-sm md:text-base text-gray-800 leading-relaxed italic break-words">
                  &ldquo;{naverExcerpt}&rdquo;
                </p>
              </div>
            ) : !naver!.in_briefing ? (
              <p className="text-sm text-gray-500 leading-relaxed">
                {isActive
                  ? "소개글에 Q&A를 포함하면 AI 브리핑 인용 후보가 됩니다. 6~8주 안에 노출 가능성이 높아집니다."
                  : "소개글에 키워드를 포함하면 ChatGPT·Gemini 검색에서 발견될 가능성이 높아집니다."}
              </p>
            ) : null}
            <p className="text-sm text-gray-500 italic mt-2">
              정식 구독은 매주 자동 재확인 + 경쟁사 브리핑 비교 제공
            </p>
          </div>
        )}

        {/* 카드 2: ChatGPT */}
        {hasChatgpt && (
          <div className={`p-4 md:p-6 ${chatgptResult!.mentioned ? "bg-emerald-50/40" : "bg-red-50/40"}`}>
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-bold text-gray-900">ChatGPT</span>
                <ResultBadge ok={chatgptResult!.mentioned === true} />
              </div>
            </div>
            <p
              className={`text-base md:text-lg font-bold leading-snug mb-2 ${
                chatgptResult!.mentioned ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {chatgptResult!.mentioned
                ? "ChatGPT가 내 가게를 추천합니다"
                : "ChatGPT는 아직 내 가게를 모릅니다"}
            </p>
            {/* 5회 샘플링 결과 표시 — exposure_freq/sample_size가 있을 때만 */}
            {typeof chatgptResult!.exposure_freq === "number" &&
              typeof chatgptResult!.sample_size === "number" && (
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  {chatgptResult!.sample_size}회 질문 중{" "}
                  <span
                    className={
                      chatgptResult!.exposure_freq > 0
                        ? "text-emerald-700"
                        : "text-red-600"
                    }
                  >
                    {chatgptResult!.exposure_freq}회 언급
                  </span>
                </p>
              )}
            {chatgptResult!.excerpt ? (
              <div className="bg-gray-100 border-l-4 border-gray-300 rounded-r-lg px-4 py-3 mb-2">
                <p className="text-sm text-gray-500 font-semibold mb-1">실제 ChatGPT 응답:</p>
                <p className="text-sm md:text-base text-gray-800 leading-relaxed italic break-words">
                  &ldquo;{chatgptResult!.excerpt}&rdquo;
                </p>
              </div>
            ) : !chatgptResult!.mentioned ? (
              <>
                {/* 측정 증거 — 미노출 신뢰도 향상 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2">
                  <p className="text-sm text-gray-500 font-semibold mb-0.5">측정 방법</p>
                  <p className="text-sm text-gray-700">
                    ChatGPT에게 &ldquo;{regionPrefix ?? "지역"} {keyword ?? "해당 업종"} 추천&rdquo;을{" "}
                    {chatgptResult!.sample_size ?? 5}번 질문했습니다.
                  </p>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  ChatGPT는 미국 데이터(Google 비즈니스·해외 사이트)를 주로 봅니다. Google 비즈니스 프로필 등록만으로 노출 가능성이 크게 높아집니다.
                </p>
              </>
            ) : null}
            <p className="text-sm text-gray-500 italic mt-2">
              정식 구독은 Gemini·ChatGPT 각 50회 (총 100회) 반복 측정 + 매주 추적 + 변화 알림
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mt-1">
              ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </p>
          </div>
        )}

        {/* 카드 3: Gemini 노출 빈도 — 트라이얼은 10회 측정 */}
        {hasGemini && (
          <div className="p-4 md:p-6 bg-blue-50/40">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-base md:text-lg font-bold text-gray-900">Gemini AI</span>
                {exposureFreq! > 0 ? (
                  <ResultBadge ok={true} />
                ) : (
                  <ResultBadge ok={false} />
                )}
              </div>
            </div>
            <p
              className={`text-base md:text-lg font-bold leading-snug mb-3 ${
                exposureFreq! > 0 ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {totalSamples}번 중 <span className="text-2xl md:text-3xl">{exposureFreq}</span>번 추천됨
            </p>
            <div className="w-full bg-white border border-gray-200 rounded-full h-3 mb-2">
              <div
                className={`h-3 rounded-full ${
                  (exposureFreq! / totalSamples) >= 0.5
                    ? "bg-emerald-500"
                    : (exposureFreq! / totalSamples) >= 0.2
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${Math.min((exposureFreq! / totalSamples) * 100, 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              같은 질문을 {totalSamples}번 반복했을 때 AI가 내 가게를 추천한 횟수입니다.
              {exposureFreq! === 0
                ? " AI가 내 가게를 모르고 있습니다."
                : exposureFreq! < totalSamples / 2
                ? " 노출이 불안정합니다 — 키워드와 FAQ를 보강하면 빈도가 올라갑니다."
                : " 안정적으로 노출되고 있습니다."}
            </p>
            {/* Gemini 미노출 시 측정 증거 — 신뢰도 향상 */}
            {exposureFreq! === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2 mt-2">
                <p className="text-sm text-gray-500 font-semibold mb-0.5">측정 방법</p>
                <p className="text-sm text-gray-700">
                  Gemini에게 &ldquo;{regionPrefix ?? "지역"} {keyword ?? "해당 업종"} 추천&rdquo;을{" "}
                  {totalSamples}번 반복 질문했습니다.
                </p>
              </div>
            )}
            {/* 언급된 쿼리 원문 최대 2개 표시 */}
            {aiEvidence?.queries
              ?.filter((q) => q.mentioned && q.excerpt)
              .slice(0, 2)
              .map((q, i) => (
                <div key={i} className="mt-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-blue-600 font-semibold mb-0.5 truncate">
                    질문: &ldquo;{q.query}&rdquo;
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed italic break-words">
                    &ldquo;{q.excerpt}&rdquo;
                  </p>
                </div>
              ))}
            <p className="text-sm text-gray-500 italic mt-2">
              정식 구독은 Gemini·ChatGPT 각 50회 (총 100회) + 매일 변화 추적
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
