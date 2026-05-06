"use client";

import { useEffect, useState } from "react";

interface PooledQ {
  question: string;
  asked_by: string[];
  count: number;
}

interface CompetitorRow {
  competitor_id: string;
  competitor_name: string;
  questions: string[];
  collected_at: string;
}

interface FAQGapResponse {
  business_name?: string;
  gap_count: number;
  competitors: CompetitorRow[];
  pooled_questions: PooledQ[];
  message?: string;
}

interface Props {
  bizId: string;
  accessToken?: string;
}

export default function CompetitorFAQCard({ bizId, accessToken }: Props) {
  const [data, setData] = useState<FAQGapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiBase}/api/report/competitor-faq-gap/${bizId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [bizId, accessToken]);

  const handleCopy = async (q: string) => {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(q);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6">
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data || data.gap_count === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            경쟁사 FAQ 갭 분석
          </span>
          <span className="ml-auto text-xs text-slate-400">매주 월요일 자동 수집</span>
        </div>
        <p className="text-sm text-gray-500">
          {data?.message ||
            "경쟁사 Q&A 수집 데이터가 아직 없습니다. (네이버 스마트플레이스 Q&A 탭은 2026년 폐기됨 — 경쟁사 리뷰·소개글 기반 분석으로 대체 예정)"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          경쟁사가 올린 FAQ 질문 {data.gap_count}개
        </span>
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">ChatGPT로 얻을 수 없는 데이터</span>
      </div>

      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        주변 경쟁사가 등록한 Q&amp;A 질문입니다. 아래 문구를 복사해 스마트플레이스 소개글 하단이나 톡톡 채팅방 메뉴에 추가하세요.
      </p>

      <div className="space-y-2">
        {data.pooled_questions.slice(0, 10).map((row, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 leading-snug break-keep">
                Q. {row.question}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {row.asked_by.slice(0, 3).join(" · ")}
                {row.asked_by.length > 3 && ` 외 ${row.asked_by.length - 3}곳`}
                {row.count >= 2 && <span className="ml-2 bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-xs font-bold">{row.count}곳 공통</span>}
              </p>
            </div>
            <button
              onClick={() => handleCopy(row.question)}
              className="shrink-0 text-xs font-semibold text-amber-700 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              {copied === row.question ? "복사됨 ✓" : "복사"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        경쟁사 {data.competitors.length}곳의 Q&amp;A 데이터 기반 분석
      </p>
    </div>
  );
}
