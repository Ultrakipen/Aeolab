"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

interface BizSummaryItem {
  id: string;
  name: string;
  category: string;
  region: string;
  unified_score: number | null;
  track1_score: number | null;
  track2_score: number | null;
  competitor_count: number;
  last_scanned_at: string | null;
}

interface Props {
  token: string;
}

export function MultiBizTable({ token }: Props) {
  const [items, setItems] = useState<BizSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    fetch(`${BACKEND}/api/report/multi-biz-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { items?: BizSummaryItem[] }) => setItems(d.items || []))
      .catch((e) => { setItems([]); console.warn('[MultiBizTable]', e); })
      .finally(() => setLoading(false));
  }, [token]);

  function scoreStatusLabel(score: number | null) {
    if (score === null) return { text: "–",      cls: "bg-gray-50 text-gray-600 border-gray-200" };
    if (score >= 70)   return { text: "양호",    cls: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    if (score >= 40)   return { text: "보통",    cls: "bg-amber-50 text-amber-700 border-amber-200" };
    return                    { text: "개선 필요", cls: "bg-red-50 text-red-700 border-red-100" };
  }

  function formatDate(iso: string | null) {
    if (!iso) return "미스캔";
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-blue-600" />
        <h3 className="text-base md:text-lg font-bold text-gray-900">
          전체 사업장 현황
        </h3>
        <span className="ml-auto text-sm text-gray-600">{items.length}개 사업장</span>
      </div>

      {/* PC 테이블 */}
      <div className="hidden md:block overflow-x-auto" tabIndex={0}>
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-3 text-gray-600 font-medium">사업장</th>
              <th className="text-center py-2 px-3 text-gray-600 font-medium">AI 노출 종합 지수</th>
              <th className="text-center py-2 px-3 text-gray-600 font-medium">네이버</th>
              <th className="text-center py-2 px-3 text-gray-600 font-medium">글로벌</th>
              <th className="text-center py-2 px-3 text-gray-600 font-medium">경쟁사</th>
              <th className="text-center py-2 px-3 text-gray-600 font-medium">마지막 스캔</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-3">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-600">{item.region} · {item.category}</div>
                </td>
                <td className="text-center py-3 px-3">
                  {(() => { const s = scoreStatusLabel(item.unified_score); return (
                    <span className={`text-sm px-2.5 py-1 rounded-full border font-semibold ${s.cls}`}>{s.text}</span>
                  );})()}
                </td>
                <td className="text-center py-3 px-3">
                  {(() => { const s = scoreStatusLabel(item.track1_score); return (
                    <span className={`text-sm px-2.5 py-1 rounded-full border font-semibold ${s.cls}`}>{s.text}</span>
                  );})()}
                </td>
                <td className="text-center py-3 px-3">
                  {(() => { const s = scoreStatusLabel(item.track2_score); return (
                    <span className={`text-sm px-2.5 py-1 rounded-full border font-semibold ${s.cls}`}>{s.text}</span>
                  );})()}
                </td>
                <td className="text-center py-3 px-3 text-gray-600">
                  {item.competitor_count}개
                </td>
                <td className="text-center py-3 px-3 text-gray-600 text-sm">
                  {formatDate(item.last_scanned_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                <div className="text-sm text-gray-600">{item.region} · {item.category}</div>
              </div>
              {(() => { const s = scoreStatusLabel(item.unified_score); return (
                <span className={`text-sm px-2.5 py-0.5 rounded-full border font-semibold ${s.cls}`}>{s.text}</span>
              );})()}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              <span>네이버 <span className={`text-sm px-1.5 py-0.5 rounded-full border font-semibold ${scoreStatusLabel(item.track1_score).cls}`}>{scoreStatusLabel(item.track1_score).text}</span></span>
              <span>글로벌 <span className={`text-sm px-1.5 py-0.5 rounded-full border font-semibold ${scoreStatusLabel(item.track2_score).cls}`}>{scoreStatusLabel(item.track2_score).text}</span></span>
              <span>경쟁사 {item.competitor_count}개</span>
              <span className="ml-auto">{formatDate(item.last_scanned_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
