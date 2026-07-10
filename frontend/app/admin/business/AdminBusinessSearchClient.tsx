"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/categories";

const ADMIN_PROXY = "/api/admin-proxy";

interface BusinessRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  region: string;
  is_active: boolean;
  created_at: string;
  owner_email: string | null;
}

const PAGE_SIZE = 50;

export default function AdminBusinessSearchClient() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  // 검색어 디바운스(300ms) — 서버에 매 타이핑마다 요청 보내지 않도록.
  // 검색어가 바뀌면 페이지도 0으로 초기화(이전 검색의 2페이지에 머무는 것 방지).
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(queryInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        path: "admin/businesses",
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`${ADMIN_PROXY}?${params}`);
      if (!res.ok) throw new Error("API 오류");
      const data = await res.json();
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("사업장 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">사업장 조회</h1>
        <p className="text-sm text-gray-400 mt-1">사업장명·이메일로 검색 후 스캔이력·가이드·경쟁사까지 한 번에 확인</p>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="사업장명 또는 이메일 검색"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && total > 0 && (
        <p className="text-sm text-gray-400 mb-3">
          총 {total.toLocaleString()}건 중 {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)}건 표시
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
          <p className="text-base">{query.trim() ? "검색 조건에 맞는 사업장이 없습니다." : "등록된 사업장이 없습니다."}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {rows.map((biz) => (
              <Link
                key={biz.id}
                href={`/admin/business/${biz.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{biz.name}</span>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{CATEGORY_LABEL[biz.category] ?? biz.category}</span>
                    {!biz.is_active && (
                      <span className="text-sm text-red-600 bg-red-50 px-2 py-0.5 rounded-full">비활성</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {biz.owner_email ?? biz.user_id.slice(0, 8) + "..."} {biz.region && `· ${biz.region}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← 이전
              </button>
              <span className="text-sm text-gray-500">{page + 1} / {totalPages} 페이지</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
