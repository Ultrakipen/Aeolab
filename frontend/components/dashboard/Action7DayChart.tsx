"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from "recharts";

interface TimelinePoint {
  date: string;
  score: number | null;
  track1?: number | null;
  track2?: number | null;
}

interface ActionWindow {
  action_type: string;
  action_label: string;
  action_date: string;
  score_before: number | null;
  score_after: number | null;
  timeline: TimelinePoint[];
}

interface TimelineResponse {
  business_name: string;
  action_count: number;
  windows: ActionWindow[];
  history: { date: string; score: number | null }[];
}

interface Props {
  bizId: string;
  accessToken?: string;
}

export default function Action7DayChart({ bizId, accessToken }: Props) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    fetch(`${apiBase}/api/report/action-timeline/${bizId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: TimelineResponse) => {
        setData(json);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [bizId, accessToken]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6">
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data || data.action_count === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">행동-결과 7일 타임라인</span>
        </div>
        <p className="text-sm text-gray-500">
          가이드 페이지에서 체크박스를 완료하면, 이곳에 행동 시점과 7일 후 점수 변화가 자동으로 기록됩니다.
        </p>
      </div>
    );
  }

  const activeWindow = data.windows[activeIdx];
  const chartData = (activeWindow?.timeline ?? []).map((p) => ({
    date: p.date.slice(5), // MM-DD
    점수: p.score,
  }));

  const delta =
    activeWindow?.score_before != null && activeWindow?.score_after != null
      ? Number((activeWindow.score_after - activeWindow.score_before).toFixed(1))
      : null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          행동-결과 7일 타임라인
        </span>
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-sm text-slate-400">행동 {data.action_count}건 기록됨</span>
      </div>

      {/* 행동 선택 탭 */}
      {data.windows.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {data.windows.map((w, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                i === activeIdx
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {w.action_label} · {w.action_date.slice(5)}
            </button>
          ))}
        </div>
      )}

      {/* 행동 정보 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
        <p className="text-sm font-semibold text-blue-900 mb-1">{activeWindow.action_label}</p>
        <p className="text-sm text-blue-700">
          {activeWindow.action_date} 실행 ·{" "}
          {activeWindow.score_before != null && <>시점 점수 {activeWindow.score_before.toFixed(1)}</>}
          {delta != null && (
            <>
              {" → "}
              7일 후{" "}
              <span className={delta >= 0 ? "font-bold text-emerald-700" : "font-bold text-red-600"}>
                {delta >= 0 ? "+" : ""}
                {delta}점
              </span>
            </>
          )}
          {activeWindow.score_after == null && activeWindow.score_before != null && (
            <> · 7일 후 점수 측정 대기 중</>
          )}
        </p>
      </div>

      {/* 차트 */}
      {chartData.length > 0 ? (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine
                x={activeWindow.action_date.slice(5)}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: "행동", fontSize: 11, fill: "#f59e0b" }}
              />
              <Line
                type="monotone"
                dataKey="점수"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-gray-500 text-center py-6">
          아직 일별 점수 데이터가 쌓이지 않았습니다. 매일 새벽 자동 스캔 후 일별 점수가 누적됩니다.
        </p>
      )}

      <p className="text-sm text-gray-400 mt-3 text-center">
        행동 시점 기준 -2일 ~ +7일 일별 점수 · 대화형 ChatGPT로는 측정 불가능한 영역
      </p>
    </div>
  );
}
