"use client";

import { useState } from "react";
import { getSafeSession } from "@/lib/supabase/client";
import DiaScoreBadge, { diaScoreLabel, type DiaScore } from "./DiaScoreBadge";
import { FeedbackPopup } from "./FeedbackPopup";

interface Props {
  bizId: string;
  currentIntro?: string;
  currentLength?: number;
  generatedAt?: string;
  planLabel?: string;
  planMonthlyLimit?: number;
  globalCurrentIntro?: string;
  globalGeneratedAt?: string;
  /** 설정 시 해당 타입만 표시하고 토글 버튼 숨김 */
  onlyType?: "naver" | "global";
}

interface IntroStats {
  char_count: number;
  qa_count: number;
  keywords: string[];
  dia_score?: DiaScore | null;
}

type IntroType = "naver" | "global";

export function IntroGeneratorCard({
  bizId,
  currentIntro,
  currentLength = 0,
  generatedAt,
  planLabel = "Free",
  planMonthlyLimit = 0,
  globalCurrentIntro,
  globalGeneratedAt,
  onlyType,
}: Props) {
  const initialType: IntroType = onlyType === "global" ? "global" : "naver";
  const initialContent = onlyType === "global" ? (globalCurrentIntro ?? "") : (currentIntro ?? "");
  const initialGeneratedAt = onlyType === "global" ? globalGeneratedAt : generatedAt;

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string>(initialContent);
  const [localGeneratedAt, setLocalGeneratedAt] = useState<string | undefined>(initialGeneratedAt);
  const [stats, setStats] = useState<IntroStats>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>("");
  const [introType, setIntroType] = useState<IntroType>(initialType);
  const [feedbackTriggered, setFeedbackTriggered] = useState(false);

  const canGenerate = planMonthlyLimit > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError("");
    try {
      const sess = await getSafeSession();
      const token = sess?.access_token;
      if (!token) {
        setError("로그인이 필요합니다. 페이지를 새로고침해주세요.");
        return;
      }
      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const endpoint =
        introType === "global"
          ? `${BACKEND}/api/businesses/global-ai-intro-generate`
          : `${BACKEND}/api/businesses/intro-generate`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ biz_id: bizId, style: "qa_focused", target_length: 400 }),
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error("이 기능은 Basic 이상 플랜에서 사용 가능합니다.");
        if (res.status === 429) throw new Error(`이번 달 소개글·FAQ 합산 한도(${planMonthlyLimit}회)에 도달했습니다.`);
        throw new Error("생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      const data = await res.json();
      setGenerated(data.intro ?? data.intro_text ?? "");
      setLocalGeneratedAt(new Date().toISOString());
      setStats({
        char_count: data.char_count ?? 0,
        qa_count: data.qa_count ?? 0,
        keywords: data.keywords_included || [],
        dia_score: (data.dia_score as DiaScore | undefined) ?? null,
      });
      setFeedbackTriggered(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("복사에 실패했습니다. 텍스트를 직접 선택해주세요.");
    }
  };

  const isShort = currentLength > 0 && currentLength < 300;
  const planBadgeColor =
    planMonthlyLimit === 0 ? "bg-gray-100 text-gray-700" :
    planMonthlyLimit >= 999 ? "bg-emerald-100 text-emerald-700" :
    "bg-blue-100 text-blue-700";

  return (
    <div id="intro-generator" className="rounded-xl border bg-white p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base md:text-lg font-bold text-gray-900">
            소개글 AI 자동 생성
          </h3>
          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${planBadgeColor}`}>
            {planLabel} 플랜 · 월 {planMonthlyLimit >= 999 ? "무제한" : `${planMonthlyLimit}회`}
          </span>
        </div>
        {isShort && introType === "naver" && (
          <span className="shrink-0 text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium">
            현재 {currentLength}자
          </span>
        )}
      </div>

      {/* 네이버용 / 글로벌 AI용 토글 — onlyType 설정 시 숨김 */}
      {!onlyType && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            type="button"
            onClick={() => { setIntroType("naver"); setGenerated(currentIntro ?? ""); setStats(undefined); setError(""); setLocalGeneratedAt(generatedAt); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              introType === "naver"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            네이버 검색 노출용
          </button>
          <button
            type="button"
            onClick={() => { setIntroType("global"); setGenerated(globalCurrentIntro ?? ""); setStats(undefined); setError(""); setLocalGeneratedAt(globalGeneratedAt); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              introType === "global"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            ChatGPT·Gemini 노출용
          </button>
        </div>
      )}

      {introType === "naver" ? (
        <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
          Q&A 5개가 포함된 300~500자 소개글을 AI가 자동으로 써드립니다.
          네이버 AI가 내 가게를 검색 결과에 소개할 때 이 글을 참고합니다. 생성 후 스마트플레이스에 붙여넣기만 하면 됩니다.
        </p>
      ) : (
        <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
          ChatGPT·Gemini 같은 AI가 내 가게를 검색할 때 언급하도록 최적화된 소개글입니다.
          자체 웹사이트나 구글 비즈니스 프로필 소개란에 붙여넣으면 글로벌 AI 노출에 효과적입니다.
        </p>
      )}

      {!canGenerate && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm md:text-base text-gray-700">
          <strong>Free 플랜은 사용할 수 없습니다.</strong> Basic: 소개글·톡톡 메뉴 생성 합산 월 5회, Pro·Biz: 무제한.{" "}
          <a href="/pricing" className="text-blue-600 hover:underline font-medium">플랜 보기 →</a>
        </div>
      )}

      {!generated && canGenerate && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full md:w-auto px-5 py-3 bg-blue-600 text-white rounded font-medium text-sm md:text-base hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generating ? "AI가 소개글 쓰는 중... (약 30초)" : "소개글 자동 생성"}
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm md:text-base text-red-700 bg-red-50 p-3 rounded border border-red-200">
          {error}
        </p>
      )}

      {generated && (
        <div className="mt-4 space-y-3">
          {introType === "naver" && currentIntro && !stats && (
            <p className="text-sm text-gray-500 mb-2">이전에 생성된 소개글입니다. 하단 &apos;다시 생성&apos; 버튼으로 새로 만들 수 있습니다.</p>
          )}
          {introType === "global" && globalCurrentIntro && !stats && (
            <p className="text-sm text-gray-500 mb-2">이전에 생성된 글로벌 AI용 소개글입니다. 하단 &apos;다시 생성&apos; 버튼으로 새로 만들 수 있습니다.</p>
          )}
          <div className="p-4 bg-gray-50 rounded border whitespace-pre-wrap break-words text-sm md:text-base text-gray-900 leading-relaxed">
            {generated}
          </div>

          {localGeneratedAt && (
            <p className="text-sm text-gray-500">
              마지막 생성: {new Date(localGeneratedAt).toLocaleString("ko-KR")}
            </p>
          )}

          {stats && (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm bg-green-100 text-green-800 px-2.5 py-1 rounded font-medium">
                  {stats.char_count}자
                </span>
                {stats.qa_count > 0 && (
                <span className="text-sm bg-blue-100 text-blue-800 px-2.5 py-1 rounded font-medium">
                  Q&A {stats.qa_count}개
                </span>
                )}
                {stats.keywords.length > 0 && (
                  <span className="text-sm bg-purple-100 text-purple-800 px-2.5 py-1 rounded font-medium">
                    키워드 {stats.keywords.length}개 포함
                  </span>
                )}
                {stats.dia_score && (
                  <span
                    className={`text-sm px-2.5 py-1 rounded font-medium ${
                      stats.dia_score.score >= 80
                        ? "bg-emerald-100 text-emerald-800"
                        : stats.dia_score.score >= 50
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    품질 {diaScoreLabel(stats.dia_score.score)}
                  </span>
                )}
              </div>

              {stats.dia_score && (
                <DiaScoreBadge
                  dia={stats.dia_score}
                  onRegenerate={canGenerate ? () => { void handleGenerate(); } : undefined}
                />
              )}
            </>
          )}

          <div className="flex flex-col md:flex-row gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded font-medium text-sm md:text-base hover:bg-green-700 transition-colors"
            >
              {copied ? "복사됨!" : "클립보드에 복사"}
            </button>
            {introType === "naver" ? (
              <a
                href="https://smartplace.naver.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded font-medium text-sm md:text-base hover:bg-gray-800 transition-colors text-center"
              >
                스마트플레이스 열기 →
              </a>
            ) : (
              <a
                href="https://business.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded font-medium text-sm md:text-base hover:bg-gray-800 transition-colors text-center"
              >
                구글 비즈니스 프로필 열기 →
              </a>
            )}
            {canGenerate && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-3 border border-gray-300 rounded font-medium text-sm md:text-base hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                다시 생성
              </button>
            )}
          </div>

          <p className="text-sm text-gray-600">
            {introType === "naver"
              ? <>스마트플레이스 → 업체정보 → &quot;소개&quot; 항목에 붙여넣기 하세요.</>
              : <>자체 웹사이트 소개란 또는 구글 비즈니스 프로필 → &quot;소개&quot; 항목에 붙여넣기 하세요.</>
            }
          </p>
        </div>
      )}

      <FeedbackPopup eventType="guide_generated" trigger={feedbackTriggered} />
    </div>
  );
}
