"use client";

import { useState, useEffect, useRef } from "react";
import { getSafeSession } from "@/lib/supabase/client";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, ChevronUp, ChevronDown } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface CompareRow {
  field: string;
  label: string;
  type: "number" | "bool" | "rating";
  mine: number | boolean | null;
  competitors: Array<{ id?: string; name: string; value: number | boolean | null; synced?: boolean }>;
  needs_action: boolean;
  action_hint?: string;
}

interface PlaceCompareData {
  rows: CompareRow[];
  gaps: Array<{ field: string; label: string; needs_action: boolean; hint: string }>;
  synced_at?: string;
  has_competitor_data: boolean;
  mine_name?: string;
  sp_auto_syncing?: boolean;
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

function RatingCell({ value, synced, isWeak, noDataText }: { value: number | null; synced?: boolean; isWeak: boolean; noDataText?: string }) {
  if (value === null) {
    if (noDataText) return <span className="text-gray-400 text-xs">{noDataText}</span>;
    if (synced) return <span className="text-gray-400 text-xs">별점 없음</span>;
    return <span className="text-amber-500 text-xs font-medium">동기화 필요</span>;
  }
  return (
    <span className={`font-semibold text-sm ${isWeak ? "text-red-600" : "text-gray-800"}`}>
      ⭐ {value.toFixed(1)}
    </span>
  );
}

export function PlaceCompareTable({ bizId, currentPlan, authToken: initialToken }: Props) {
  const [data, setData] = useState<PlaceCompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(initialToken);
  const [expanded, setExpanded] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Record<string, boolean>>({});
  const autoFetched = useRef(false);

  // 토큰이 없으면 세션에서 가져오기
  useEffect(() => {
    if (!token) {
      getSafeSession()
        .then((session) => {
          if (session?.access_token) setToken(session.access_token);
        })
        .catch(() => {});
    }
  }, [token]);

  // 토큰이 준비되면 자동으로 데이터 로드 (버튼 클릭 없이도 표시)
  useEffect(() => {
    if (token && !autoFetched.current) {
      autoFetched.current = true;
      void fetchData();
    }
    // fetchData는 token을 클로저로 캡처하므로 token 의존성만 추가
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function fetchData(useToken?: string) {
    const t = useToken ?? token;
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/report/place-compare/${bizId}`, {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      // 401: 토큰 만료 → 세션 갱신 후 1회 재시도
      if (res.status === 401) {
        const fresh = await getSafeSession();
        if (fresh?.access_token && fresh.access_token !== t) {
          setToken(fresh.access_token);
          const retry = await fetch(`${BACKEND}/api/report/place-compare/${bizId}`, {
            headers: { Authorization: `Bearer ${fresh.access_token}` },
            cache: "no-store",
          });
          if (retry.ok) {
            setData(await retry.json());
            return;
          }
        }
        throw new Error("인증이 만료되었습니다. 페이지를 새로고침해 주세요.");
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        const detail = (d as { detail?: unknown }).detail;
        const msg = typeof detail === "string"
          ? detail
          : res.status === 403
          ? "이 기능은 Basic 이상 플랜에서 사용할 수 있습니다."
          : `데이터 로드 실패 (${res.status})`;
        throw new Error(msg);
      }
      const json: PlaceCompareData = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function syncCompetitor(competitorId: string) {
    const t = token;
    if (!t || !competitorId) return;
    setSyncingIds(prev => ({ ...prev, [competitorId]: true }));
    try {
      const res = await fetch(`${BACKEND}/api/competitors/${competitorId}/sync-place`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        await fetchData(t);
      }
    } catch {
      // 실패 시 조용히 무시 — 재시도 가능
    } finally {
      setSyncingIds(prev => ({ ...prev, [competitorId]: false }));
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
          onClick={() => void fetchData()}
          disabled={loading || !token}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shrink-0"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> 새로고침</>
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

      {/* 내 가게 스마트플레이스 자동 점검 중 안내 */}
      {data?.sp_auto_syncing && (
        <div className="px-4 md:px-6 py-3 flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border-b border-blue-100">
          <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin text-blue-500" />
          <span>내 가게 스마트플레이스 정보를 처음 가져오고 있습니다. 약 30초 후 <strong>새로고침</strong>하면 소개글·메뉴 등록 여부가 정확히 표시됩니다.</span>
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
      {data && data.has_competitor_data && data.rows.length > 0 && (() => {
        const ALL_COMPS = data.rows[0]?.competitors ?? [];
        const SHOW_LIMIT = 5;
        const visibleComps = expanded ? ALL_COMPS : ALL_COMPS.slice(0, SHOW_LIMIT);
        const hiddenCount = ALL_COMPS.length - SHOW_LIMIT;

        return (
          <div className="overflow-x-auto">
            <table className="min-w-[540px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">항목</th>
                  <th className="text-center px-4 py-3 font-semibold text-blue-700 bg-blue-50">내 가게</th>
                  {visibleComps.map((c) => (
                    <th key={c.name} className="text-center px-4 py-3 font-semibold text-gray-600">
                      <div className="flex flex-col items-center gap-1">
                        <span className="leading-tight">{c.name}</span>
                        {c.id && (
                          <button
                            onClick={() => void syncCompetitor(c.id!)}
                            disabled={syncingIds[c.id]}
                            title="네이버 플레이스 데이터 재스캔"
                            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingIds[c.id] ? 'animate-spin text-blue-500' : ''}`} />
                            {syncingIds[c.id] ? '스캔 중' : '재스캔'}
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.rows.map((row) => {
                  const isBlogRow = row.field === "blog_mention_count";
                  const competitorMax = Math.max(
                    ...row.competitors.map((c) =>
                      typeof c.value === "number" ? c.value : c.value === true ? 1 : 0
                    ),
                    0
                  );
                  const myVal = typeof row.mine === "number" ? row.mine : row.mine === true ? 1 : 0;
                  const isWeak = row.needs_action && myVal < competitorMax;
                  const visibleCompCells = row.competitors.slice(0, expanded ? undefined : SHOW_LIMIT);

                  return (
                    <tr key={row.field} className={isWeak ? "bg-red-50" : "bg-white"}>
                      {/* 항목 레이블 */}
                      <td className="px-4 py-3 font-medium text-gray-700">
                        <div className="flex items-center gap-1.5">
                          {isWeak && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          <span>{row.label}</span>
                        </div>
                        {isBlogRow && (
                          <span className="text-xs text-gray-400 mt-0.5 block leading-tight">
                            네이버 블로그 검색 결과 건수
                          </span>
                        )}
                        {isWeak && (
                          <span className="text-red-500 text-xs font-normal mt-0.5 block">개선 필요</span>
                        )}
                      </td>

                      {/* 내 가게 셀 */}
                      <td className="px-4 py-3 text-center bg-blue-50/30">
                        {isBlogRow ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`font-semibold text-sm ${isWeak ? "text-red-600" : "text-gray-800"}`}>
                              {row.mine !== null ? `${(row.mine as number).toLocaleString()}건` : "-"}
                            </span>
                            {data.mine_name && (
                              <span className="text-xs text-gray-400 leading-tight">
                                &ldquo;{data.mine_name}&rdquo; 검색
                              </span>
                            )}
                          </div>
                        ) : row.type === "bool" ? (
                          <div className="flex justify-center"><BoolCell value={row.mine as boolean | null} /></div>
                        ) : row.type === "rating" ? (
                          <RatingCell value={row.mine as number | null} isWeak={isWeak} noDataText="미입력" />
                        ) : (
                          <NumberCell value={row.mine as number | null} isWeak={isWeak} />
                        )}
                      </td>

                      {/* 경쟁사 셀 (visible 범위만) */}
                      {visibleCompCells.map((c) => (
                        <td key={c.name} className="px-4 py-3 text-center">
                          {isBlogRow ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-semibold text-sm text-gray-800">
                                {c.value !== null ? `${(c.value as number).toLocaleString()}건` : "-"}
                              </span>
                              <span className="text-xs text-gray-400 leading-tight">
                                &ldquo;{c.name}&rdquo; 검색
                              </span>
                            </div>
                          ) : row.type === "bool" ? (
                            <div className="flex justify-center"><BoolCell value={c.value as boolean | null} /></div>
                          ) : row.type === "rating" ? (
                            <RatingCell value={c.value as number | null} synced={c.synced} isWeak={false} />
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

            {/* 블로그 언급 수 데이터 출처 안내 */}
            {data.rows.some((r) => r.field === "blog_mention_count") && (
              <div className="px-4 md:px-6 py-2.5 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-400 leading-relaxed">
                  💡 <strong className="text-gray-500">블로그 언급 수</strong>는 네이버 블로그 API에
                  업체명을 검색한 총 결과 건수입니다. 동명 업체가 있거나 일반 명사와 겹치면 실제보다
                  높게 나올 수 있으며, 경쟁사 간 상대 비교 용도로 활용하세요.
                </p>
              </div>
            )}

            {/* 경쟁사 더 보기 / 접기 버튼 */}
            {hiddenCount > 0 && (
              <div className="px-4 md:px-6 py-2.5 border-t border-gray-100 bg-gray-50 flex justify-center">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      접기
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      {hiddenCount}개 경쟁사 더 보기
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 내 가게 평점 미입력 안내 */}
      {data && data.rows.some(r => r.type === "rating" && r.mine === null) && (
        <div className="px-4 md:px-6 py-3 border-t border-blue-100 bg-blue-50">
          <p className="text-sm text-blue-800">
            내 가게 평점이 <strong>미입력</strong>으로 표시됩니다. 스캔을 실행하면 자동으로 수집되거나, <a href="/dashboard/settings" className="underline font-medium">사업장 설정</a>에서 직접 입력할 수 있습니다.
          </p>
        </div>
      )}

      {/* 평점 데이터 없음 안내 */}
      {data && data.has_competitor_data && !data.rows.some(r => r.type === "rating") && (
        <div className="px-4 md:px-6 py-3 border-t border-amber-100 bg-amber-50">
          <p className="text-sm text-amber-800">
            <strong>평균 평점 데이터가 없습니다.</strong> 각 경쟁사 카드에서 &quot;네이버 데이터 동기화&quot; 버튼을 눌러 실제 평점·리뷰 수를 가져오세요.
          </p>
        </div>
      )}

      {/* 지금 할 일 목록 */}
      {actionItems.length > 0 && (
        <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-amber-50">
          <h3 className="text-sm font-bold text-amber-800 mb-2">지금 할 일</h3>
          <ul className="space-y-2">
            {actionItems.map((item) => (
              <li key={item.field} className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <span className="font-semibold">[{item.label}]</span>{" "}
                  {item.hint}
                  {(item.field === "review_count" || item.field === "blog_mention_count") && (
                    <a
                      href="/guide"
                      className="ml-1.5 text-amber-700 underline underline-offset-2 hover:text-amber-900 font-semibold whitespace-nowrap"
                    >
                      → 가이드에서 리뷰 유도 문구 보기
                    </a>
                  )}
                </span>
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

      {/* 초기 로딩 중 */}
      {!data && loading && (
        <div className="px-4 md:px-6 py-8 text-center text-sm text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
          <p>경쟁사 비교 데이터를 불러오고 있습니다...</p>
        </div>
      )}
    </div>
  );
}
