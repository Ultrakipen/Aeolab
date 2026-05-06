"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Flame } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  priority: number;
}

interface MonthlyChecklistData {
  checklist: ChecklistItem[];
  completed_count: number;
  total_count: number;
  streak_days: number;
  month_label: string;
}

interface Props {
  bizId: string;
  authToken: string | null;
}

export default function MonthlyChecklistCard({ bizId, authToken }: Props) {
  const [data, setData] = useState<MonthlyChecklistData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bizId || !authToken) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    fetch(`${BACKEND}/api/report/monthly-checklist/${bizId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json: MonthlyChecklistData) => setData(json))
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("[MonthlyChecklistCard] 조회 실패:", err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [bizId, authToken]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6 mb-4">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-14 bg-gray-100 rounded animate-pulse" />
          <div className="h-14 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { checklist, completed_count, total_count, streak_days, month_label } = data;
  const allDone = completed_count === total_count;
  const progressPct = total_count > 0 ? Math.round((completed_count / total_count) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-6 mb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">
          {month_label} 이달의 할 일
        </h3>
        <span className="text-sm text-gray-500">
          {completed_count}/{total_count} 완료
        </span>
      </div>

      {/* 진행률 바 */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* streak 배지 */}
      {streak_days >= 7 && (
        <div className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
          <Flame className="w-4 h-4" />
          {streak_days}일 연속 스캔 중!
        </div>
      )}

      {/* 모두 완료 배너 */}
      {allDone && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-3 rounded-xl mb-4">
          이달 목표 달성! 다음 달도 화이팅
        </div>
      )}

      {/* 체크리스트 항목 */}
      <ul className="space-y-3">
        {[...checklist]
          .sort((a, b) => a.priority - b.priority)
          .map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium leading-snug ${
                    item.completed ? "line-through text-gray-400" : "text-gray-800"
                  }`}
                >
                  {item.title}
                </p>
                <p
                  className={`text-sm mt-0.5 ${
                    item.completed ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
