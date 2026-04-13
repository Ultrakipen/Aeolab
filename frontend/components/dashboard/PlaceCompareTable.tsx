"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface CompareRow {
  field: string;
  label: string;
  type: "number" | "bool" | "rating";
  mine: number | boolean | null;
  competitors: Array<{ name: string; value: number | boolean | null }>;
  needs_action: boolean;
  action_hint?: string;
}

interface PlaceCompareData {
  rows: CompareRow[];
  gaps: Array<{ field: string; label: string; needs_action: boolean; hint: string }>;
  synced_at?: string;
  has_competitor_data: boolean;
}

interface Props {
  bizId: string;
  currentPlan: string;
  authToken: string | null;
}

function BoolCell({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-gray-300 text-sm">-</span>;
  return value
    ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
    : <XCircle className="w-5 h-5 text-red-400 mx-auto" />;
}

function NumberCell({ value, isWeak }: { value: number | null; isWeak: boolean }) {
  if (value === null) return <span className="text-gray-300 text-sm">-</span>;
  return (
    <span className={`font-semibold text-sm ${isWeak ? "text-red-600" : "text-gray-800"}`}>
      {value.toLocaleString()}
    </span>
  );
}

function RatingCell({ value, isWeak }: { value: number | null; isWeak: boolean }) {
  if (value === null) return <span className="text-gray-300 text-sm">-</span>;
  return (
    <span className={`font-semibold text-sm ${isWeak ? "text-red-600" : "text-gray-800"}`}>
      {value.toFixed(1)}
    </span>
  );
}

export function PlaceCompareTable({ bizId, currentPlan, authToken: initialToken }: Props) {
  const [data, setData] = useState<PlaceCompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(initialToken);

  useEffect(() => {
    if (!token) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) setToken(session.access_token);
      });
    }
  }, [token]);

  async function fetchData() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/report/place-compare/${bizId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail ?? `데이터 로드 실패 (${res.status})`);
      }
      const json: PlaceCompareData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const actionItems = data?.gaps?.filter((g) => g.needs_action) ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 md:px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-base md:text-lg font-bold text-gray-900">스마트플레이스 경쟁사 비교</h2>
          <p className="text-sm text-gray-500 mt-0.5">항목별로 내 가게와 경쟁사를 1:1 비교합니다.</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading || !token}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shrink-0"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> 데이터 불러오기</>
          )}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="px-4 md:px-6 py-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border-b border-red-100">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* 경쟁사 데이터 없음 안내 */}
      {data && !data.has_competitor_data && (
        <div className="px-4 md:px-6 py-6 text-center text-sm text-gray-500">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="font-semibold text-gray-700 mb-1">경쟁사 플레이스 데이터가 아직 없습니다</p>
          <p>경쟁사 AI 스캔 후 자동으로 채워집니다. 대시보드에서 스캔을 실행해 주세요.</p>
        </div>
      )}

      {/* Skeleton 로딩 */}
      {loading && !data && (
        <div className="px-4 md:px-6 py-6 space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl" />
          ))}
        </div>
      )}

      {/* 비교 테이블 */}
      {data && data.has_competitor_data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-[540px] w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">항목</th>
                <th className="text-center px-4 py-3 font-semibold text-blue-700 bg-blue-50">내 가게</th>
                {data.rows[0]?.competitors.map((c) => (
                  <th key={c.name} className="text-center px-4 py-3 font-semibold text-gray-600">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.rows.map((row) => {
                const competitorMax = Math.max(
                  ...row.competitors.map((c) =>
                    typeof c.value === "number" ? c.value : c.value === true ? 1 : 0
                  ),
                  0
                );
                const myVal = typeof row.mine === "number" ? row.mine : row.mine === true ? 1 : 0;
                const isWeak = row.needs_action && myVal < competitorMax;

                return (
                  <tr key={row.field} className={isWeak ? "bg-red-50" : "bg-white"}>
                    <td className="px-4 py-3 font-medium text-gray-700">
                      <div className="flex items-center gap-1.5">
                        {isWeak && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        <span>{row.label}</span>
                      </div>
                      {isWeak && (
                        <span className="text-red-500 text-xs font-normal mt-0.5 block">개선 필요</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center bg-blue-50/30">
                      {row.type === "bool" ? (
                        <div className="flex justify-center"><BoolCell value={row.mine as boolean | null} /></div>
                      ) : row.type === "rating" ? (
                        <RatingCell value={row.mine as number | null} isWeak={isWeak} />
                      ) : (
                        <NumberCell value={row.mine as number | null} isWeak={isWeak} />
                      )}
                    </td>
                    {row.competitors.map((c) => (
                      <td key={c.name} className="px-4 py-3 text-center">
                        {row.type === "bool" ? (
                          <div className="flex justify-center"><BoolCell value={c.value as boolean | null} /></div>
                        ) : row.type === "rating" ? (
                          <RatingCell value={c.value as number | null} isWeak={false} />
                        ) : (
                          <NumberCell value={c.value as number | null} isWeak={false} />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 지금 할 일 목록 */}
      {actionItems.length > 0 && (
        <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-amber-50">
          <h3 className="text-sm font-bold text-amber-800 mb-2">지금 할 일</h3>
          <ul className="space-y-1.5">
            {actionItems.map((item) => (
              <li key={item.field} className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span><span className="font-semibold">[{item.label}]</span> {item.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 동기화 시각 */}
      {data?.synced_at && (
        <div className="px-4 md:px-6 py-2 border-t border-gray-100 text-right">
          <span className="text-sm text-gray-400">
            마지막 동기화: {new Date(data.synced_at).toLocaleString("ko-KR")}
          </span>
        </div>
      )}

      {/* 초기 상태 (미조회) */}
      {!data && !loading && !error && (
        <div className="px-4 md:px-6 py-8 text-center text-sm text-gray-500">
          <p>"데이터 불러오기" 버튼을 클릭하면 경쟁사와 항목별 비교를 확인할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}
