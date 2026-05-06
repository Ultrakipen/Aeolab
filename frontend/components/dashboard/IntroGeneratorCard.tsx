"use client";

import { useState } from "react";

interface Props {
  bizId: string;
  currentIntro?: string;            // 사용자가 스마트플레이스에 등록한 소개글 길이 추적용 (옵션)
  currentLength?: number;
  generatedAt?: string;             // 마지막 자동 생성 시각 ISO
  planLabel?: string;               // "Free" / "Basic" / "Pro" 등
  planMonthlyLimit?: number;        // 0(불가) / 5 / 20 / 999(무제한)
}

interface IntroStats {
  char_count: number;
  qa_count: number;
  keywords: string[];
}

export function IntroGeneratorCard({
  bizId,
  currentIntro,
  currentLength = 0,
  generatedAt,
  planLabel = "Free",
  planMonthlyLimit = 0,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string>(currentIntro ?? "");
  const [stats, setStats] = useState<IntroStats>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>("");

  const canGenerate = planMonthlyLimit > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/api/businesses/intro-generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ biz_id: bizId, style: "qa_focused", target_length: 400 }),
        }
      );
      if (!res.ok) {
        if (res.status === 403) throw new Error("이 기능은 Basic 이상 플랜에서 사용 가능합니다.");
        if (res.status === 429) throw new Error(`이번 달 한도(${planMonthlyLimit}회)에 도달했습니다.`);
        throw new Error("생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      const data = await res.json();
      setGenerated(data.intro_text);
      setStats({
        char_count: data.char_count,
        qa_count: data.qa_count,
        keywords: data.keywords_included || [],
      });
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
    <div id="intro-generator" className="rounded-lg border bg-white p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base md:text-lg font-bold text-gray-900">
            소개글 AI 자동 생성
          </h3>
          <span className={`text-xs md:text-sm px-2 py-0.5 rounded-full font-medium ${planBadgeColor}`}>
            {planLabel} 플랜 · 월 {planMonthlyLimit >= 999 ? "무제한" : `${planMonthlyLimit}회`}
          </span>
        </div>
        {isShort && (
          <span className="shrink-0 text-xs md:text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium">
            현재 {currentLength}자
          </span>
        )}
      </div>

      <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
        Q&A 5개가 포함된 300~500자 소개글을 자동 생성합니다.
        AI 브리핑 노출의 핵심 텍스트 소스입니다.
      </p>

      {!canGenerate && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm md:text-base text-gray-700">
          <strong>Free 플랜은 사용할 수 없습니다.</strong> Basic: 월 5회(FAQ 생성과 합산), Pro·Biz: 무제한.{" "}
          <a href="/pricing" className="text-blue-600 hover:underline font-medium">플랜 보기 →</a>
        </div>
      )}

      {!generated && canGenerate && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full md:w-auto px-5 py-3 bg-blue-600 text-white rounded font-medium text-sm md:text-base hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {generating ? "생성 중... (30초)" : "소개글 자동 생성"}
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm md:text-base text-red-700 bg-red-50 p-3 rounded border border-red-200">
          {error}
        </p>
      )}

      {generated && (
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-gray-50 rounded border whitespace-pre-wrap text-sm md:text-base text-gray-900 leading-relaxed">
            {generated}
          </div>

          {generatedAt && (
            <p className="text-sm text-gray-500">
              마지막 생성: {new Date(generatedAt).toLocaleString("ko-KR")}
            </p>
          )}

          {stats && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs md:text-sm bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                {stats.char_count}자
              </span>
              <span className="text-xs md:text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                Q&A {stats.qa_count}개
              </span>
              {stats.keywords.length > 0 && (
                <span className="text-xs md:text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                  키워드 {stats.keywords.length}개 포함
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded font-medium text-sm md:text-base hover:bg-green-700 transition-colors"
            >
              {copied ? "복사됨!" : "클립보드에 복사"}
            </button>
            <a
              href="https://smartplace.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-3 bg-gray-700 text-white rounded font-medium text-sm md:text-base hover:bg-gray-800 transition-colors text-center"
            >
              스마트플레이스 열기 →
            </a>
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

          <p className="text-xs md:text-sm text-gray-600">
            스마트플레이스 → 업체정보 → &quot;소개&quot; 항목에 붙여넣기 하세요.
          </p>
        </div>
      )}
    </div>
  );
}
