"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

export default function AdminBusinessSearchClient() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=admin/businesses`);
      if (!res.ok) throw new Error("API 오류");
      setRows(await res.json());
    } catch {
      setError("사업장 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const needle = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(needle) ||
        (r.owner_email || "").toLowerCase().includes(needle)
    );
  }, [rows, query]);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">사업장 조회</h1>
          <p className="text-sm text-gray-400 mt-1">사업장명·이메일로 검색 후 스캔이력·가이드·경쟁사까지 한 번에 확인</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
          ← 관리자 메인
        </Link>
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="사업장명 또는 이메일 검색"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
          <p className="text-base">{rows.length === 0 ? "등록된 사업장이 없습니다." : "검색 조건에 맞는 사업장이 없습니다."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map((biz) => (
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
      )}
    </div>
  );
}
