"use client";

import { useState } from "react";
import Link from "next/link";
import { Notice } from "@/types";

interface Props {
  initialItems: Notice[];
  initialTotal: number;
}

const CATEGORY_TABS = [
  { key: "", label: "전체" },
  { key: "update", label: "서비스 업데이트" },
  { key: "maintenance", label: "점검 안내" },
  { key: "general", label: "일반" },
];

const CATEGORY_BADGE: Record<string, string> = {
  general: "bg-gray-100 text-gray-600",
  update: "bg-blue-100 text-blue-700",
  maintenance: "bg-amber-100 text-amber-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "일반",
  update: "업데이트",
  maintenance: "점검",
};

export default function NoticesClient({ initialItems, initialTotal }: Props) {
  const [items, setItems] = useState<Notice[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState("");
  const [loading, setLoading] = useState(false);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function fetchNotices(cat: string, p: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (cat) params.set("category", cat);
      const res = await fetch(BACKEND_URL + "/api/notices?" + params.toString());
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCategoryChange(cat: string) {
    setActiveCategory(cat);
    setPage(1);
    fetchNotices(cat, 1);
  }

  function handlePageChange(p: number) {
    setPage(p);
    fetchNotices(activeCategory, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4 md:mb-6">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleCategoryChange(tab.key)}
            className={
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors " +
              (activeCategory === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10 text-gray-400 text-sm">
          불러오는 중...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-gray-400 text-base">등록된 공지사항이 없습니다.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-left">
                  <th className="pb-2 pr-3 font-medium w-20">구분</th>
                  <th className="pb-2 font-medium">제목</th>
                  <th className="pb-2 pl-3 font-medium w-28 text-right">날짜</th>
                </tr>
              </thead>
              <tbody>
                {items.map((notice) => (
                  <tr key={notice.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-3">
                      <span className={"inline-block px-2 py-0.5 rounded text-xs font-medium " + CATEGORY_BADGE[notice.category]}>
                        {CATEGORY_LABEL[notice.category]}
                      </span>
                    </td>
                    <td className="py-3">
                      <Link href={"/notices/" + notice.id} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                        {notice.is_pinned && <span className="text-red-500 font-bold text-xs shrink-0">📌</span>}
                        <span className={notice.is_pinned ? "font-medium" : ""}>{notice.title}</span>
                      </Link>
                    </td>
                    <td className="py-3 pl-3 text-gray-400 text-right whitespace-nowrap">
                      {formatDate(notice.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {items.map((notice) => (
              <Link key={notice.id} href={"/notices/" + notice.id} className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-2 mb-1.5">
                  {notice.is_pinned && <span className="text-red-500 text-sm shrink-0 mt-0.5">📌</span>}
                  <p className={"text-sm text-gray-900 leading-snug " + (notice.is_pinned ? "font-medium" : "")}>{notice.title}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={"inline-block px-2 py-0.5 rounded text-xs font-medium " + CATEGORY_BADGE[notice.category]}>
                    {CATEGORY_LABEL[notice.category]}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(notice.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-1 mt-6">
              <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">이전</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => handlePageChange(p)} className={"px-3 py-1.5 rounded-lg text-sm border transition-colors " + (p === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-gray-50")}>{p}</button>
              ))}
              <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">다음</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
