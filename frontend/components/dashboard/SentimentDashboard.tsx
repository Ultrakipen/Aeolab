"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, Minus, BarChart3 } from "lucide-react";
import Link from "next/link";

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  top_positive: string[];
  top_negative: string[];
  total: number;
  status: string;
}

interface Props {
  bizId: string;
  token: string;
}

export function SentimentDashboard({ bizId, token }: Props) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    fetch(`${BACKEND}/api/report/sentiment/${bizId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: SentimentData | null) => { if (d) setData(d) })
      .catch((e) => console.warn('[Sentiment]', e))
      .finally(() => setLoading(false));
  }, [bizId, token]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="flex-1 h-20 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data || data.status === "no_data" || data.total === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          <h3 className="text-base md:text-lg font-bold text-gray-900">리뷰 감정 분석</h3>
        </div>
        <p className="text-sm text-gray-600">
          리뷰 스캔 데이터가 아직 없습니다.<br/>
          <span className="text-sm text-gray-500">AI 스캔을 실행하면 리뷰 감정 분석이 자동으로 시작됩니다.</span>
        </p>
      </div>
    );
  }

  const total = data.positive + data.neutral + data.negative || 1;
  const posRate = Math.round((data.positive / total) * 100);
  const neuRate = Math.round((data.neutral / total) * 100);
  const negRate = Math.round((data.negative / total) * 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">리뷰 감정 분석</h3>
        <span className="ml-auto text-sm text-gray-400">{data.total}건 분석</span>
      </div>

      {/* 비율 바 */}
      <div className="w-full h-3 rounded-full overflow-hidden flex mb-4">
        <div className="bg-emerald-500 transition-all" style={{ width: `${posRate}%` }} />
        <div className="bg-gray-300 transition-all" style={{ width: `${neuRate}%` }} />
        <div className="bg-red-400 transition-all" style={{ width: `${negRate}%` }} />
      </div>

      {/* 수치 카드 */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <ThumbsUp className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
          <div className="text-xl md:text-2xl font-bold text-emerald-700">{posRate}%</div>
          <div className="text-sm text-emerald-600 mt-0.5">긍정 {data.positive}건</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <Minus className="w-4 h-4 text-gray-500 mx-auto mb-1" />
          <div className="text-xl md:text-2xl font-bold text-gray-600">{neuRate}%</div>
          <div className="text-sm text-gray-500 mt-0.5">중립 {data.neutral}건</div>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <ThumbsDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
          <div className="text-xl md:text-2xl font-bold text-red-600">{negRate}%</div>
          <div className="text-sm text-red-500 mt-0.5">부정 {data.negative}건</div>
        </div>
      </div>

      {/* 키워드 */}
      {((data.top_positive?.length ?? 0) > 0 || (data.top_negative?.length ?? 0) > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {(data.top_positive?.length ?? 0) > 0 && (
            <div>
              <p className="text-sm font-semibold text-emerald-700 mb-1.5">자주 나온 칭찬</p>
              <div className="flex flex-wrap gap-1">
                {(data.top_positive ?? []).slice(0, 3).map((kw) => (
                  <span key={kw} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-sm rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {(data.top_negative?.length ?? 0) > 0 && (
            <div>
              <p className="text-sm font-semibold text-red-600 mb-1.5">개선 필요 키워드</p>
              <div className="flex flex-wrap gap-1">
                {(data.top_negative ?? []).slice(0, 3).map((kw) => (
                  <span key={kw} className="px-2 py-0.5 bg-red-100 text-red-600 text-sm rounded-full">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 부정 키워드 행동 유도 */}
      {(data.top_negative?.length ?? 0) > 0 && (
        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm font-semibold text-orange-800">
            손님들이 &ldquo;{data.top_negative[0]}&rdquo;에 대해 불만이 있습니다
          </p>
          <p className="text-sm text-orange-700 mt-1">
            스마트플레이스 소개글에 이 부분을 보완하는 내용을 추가해보세요.
          </p>
          <Link href="/guide" className="mt-2 inline-flex items-center text-sm font-semibold text-orange-800 hover:underline">
            소개글 개선 방법 보기 →
          </Link>
        </div>
      )}

      {/* 긍정 키워드 강화 안내 */}
      {(data.top_positive?.length ?? 0) > 0 && (
        <div className="mt-3 bg-emerald-50 rounded-lg p-3">
          <p className="text-sm text-emerald-700">
            💡 &ldquo;{data.top_positive.slice(0, 2).join('", "')}&rdquo; 키워드를 FAQ와 소개글에 넣으면 AI가 더 자주 인용합니다.
          </p>
        </div>
      )}
    </div>
  );
}
