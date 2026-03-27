"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

import { CATEGORY_GROUPS, CATEGORY_LABEL } from "@/lib/categories";

interface Business {
  id: string;
  name: string;
  category: string;
  region: string;
  address?: string;
  phone?: string;
  website_url?: string;
  keywords?: string[];
  created_at: string;
}

interface Props {
  businesses: Business[];
  userId: string;
}

export function BusinessManager({ businesses, userId }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [editForm, setEditForm] = useState<Omit<Business, "id" | "created_at">>({
    name: "", category: "restaurant", region: "",
    address: "", phone: "", website_url: "", keywords: [],
  });

  const openEdit = (biz: Business) => {
    setEditForm({
      name: biz.name,
      category: biz.category,
      region: biz.region,
      address: biz.address ?? "",
      phone: biz.phone ?? "",
      website_url: biz.website_url ?? "",
      keywords: biz.keywords ?? [],
    });
    setEditingId(biz.id);
    setError("");
  };

  const handleSave = async (bizId: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-User-Id": userId },
        body: JSON.stringify({
          ...editForm,
          keywords: typeof editForm.keywords === "string"
            ? (editForm.keywords as string).split(",").map((k) => k.trim()).filter(Boolean)
            : editForm.keywords,
        }),
      });
      if (!res.ok) throw new Error();
      setEditingId(null);
      router.refresh();
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bizId: string) => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId },
      });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      router.refresh();
    } catch {
      setError("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {businesses.map((biz) => (
        <div key={biz.id} className="border border-gray-100 rounded-xl overflow-hidden">
          {/* 사업장 헤더 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium text-gray-900">{biz.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {biz.region} · {CATEGORY_LABEL[biz.category] ?? biz.category} · {formatDate(biz.created_at)}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => editingId === biz.id ? setEditingId(null) : openEdit(biz)}
                className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {editingId === biz.id ? "취소" : "수정"}
              </button>
              <button
                onClick={() => { setDeleteId(biz.id); setError(""); }}
                className="text-xs px-3 py-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>

          {/* 수정 폼 */}
          {editingId === biz.id && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">사업장 이름</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">업종</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORY_GROUPS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.options.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">지역 (구/동)</label>
                  <input
                    value={editForm.region}
                    onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                  <input
                    value={editForm.phone ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                <input
                  value={editForm.address ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">웹사이트</label>
                <input
                  value={editForm.website_url ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  핵심 키워드 <span className="text-gray-400 font-normal">(쉼표로 구분)</span>
                </label>
                <input
                  value={Array.isArray(editForm.keywords) ? editForm.keywords.join(", ") : editForm.keywords ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })}
                  placeholder="예: 강남 치킨, 야식, 배달"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => handleSave(biz.id)}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          )}

          {/* 삭제 확인 */}
          {deleteId === biz.id && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700 mb-3">
                <strong>{biz.name}</strong>을(를) 삭제하시겠습니까?<br />
                <span className="text-xs text-red-500">관련 스캔 기록, 경쟁사 데이터가 모두 비활성화됩니다.</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(biz.id)}
                  disabled={deleting}
                  className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "삭제 중..." : "삭제 확인"}
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
