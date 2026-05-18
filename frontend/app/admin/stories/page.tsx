"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Eye, Loader2 } from "lucide-react";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const ADMIN_SECRET_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || "";

interface StoryItem {
  id: string;
  category: string;
  region: string;
  title: string;
  body: string;
  score_before: number | null;
  score_after: number | null;
  score_delta: number | null;
  is_anonymous: boolean;
  display_name: string | null;
  published_at: string;
  view_count: number;
}

const CATEGORY_OPTIONS = [
  { value: "restaurant", label: "음식점" },
  { value: "cafe", label: "카페" },
  { value: "bakery", label: "베이커리" },
  { value: "bar", label: "바/술집" },
  { value: "beauty", label: "미용" },
  { value: "nail", label: "네일" },
  { value: "medical", label: "의료" },
  { value: "pharmacy", label: "약국" },
  { value: "fitness", label: "헬스" },
  { value: "yoga", label: "요가" },
  { value: "pet", label: "반려동물" },
  { value: "education", label: "교육" },
  { value: "tutoring", label: "학원" },
  { value: "legal", label: "법률" },
  { value: "realestate", label: "부동산" },
  { value: "interior", label: "인테리어" },
  { value: "auto", label: "자동차" },
  { value: "cleaning", label: "청소" },
  { value: "shopping", label: "쇼핑" },
  { value: "fashion", label: "패션" },
  { value: "photo", label: "사진" },
  { value: "video", label: "영상" },
  { value: "design", label: "디자인" },
  { value: "accommodation", label: "숙박" },
  { value: "other", label: "기타" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

const DEFAULT_FORM = {
  title: "",
  category: "restaurant",
  region: "",
  body: "",
  score_before: "",
  score_after: "",
  is_anonymous: false,
  display_name: "",
};

export default function AdminStoriesPage() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/stories?page=1&per_page=50`, { cache: "no-store" });
      if (!res.ok) throw new Error("데이터 조회 실패");
      const data = await res.json();
      setStories(data.items ?? []);
    } catch {
      setError("성공 사례 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError("제목과 본문은 필수입니다.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        region: form.region.trim(),
        body: form.body.trim(),
        score_before: form.score_before ? parseFloat(form.score_before) : null,
        score_after: form.score_after ? parseFloat(form.score_after) : null,
        is_anonymous: form.is_anonymous,
        display_name: form.is_anonymous ? null : (form.display_name.trim() || null),
      };

      const res = await fetch(`${BACKEND_URL}/admin/stories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": ADMIN_SECRET_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "등록에 실패했습니다.");
      }

      setSuccess("성공 사례가 등록되었습니다.");
      setForm(DEFAULT_FORM);
      setShowForm(false);
      fetchStories();
    } catch (err: unknown) {
      setError((err as Error).message ?? "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">성공 사례 관리</h1>
          <p className="text-sm text-gray-500 mt-1">고객 성공 사례 등록 및 목록 관리</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">새 사례 작성</span>
          <span className="sm:hidden">작성</span>
        </button>
      </div>

      {/* 알림 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* 작성 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">새 성공 사례 작성</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="예: 음식점 AI 브리핑 노출 30일 만에 점수 2배 상승"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                required
              />
            </div>

            {/* 카테고리 + 지역 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">업종</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition bg-white"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="예: 서울 강남"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                />
              </div>
            </div>

            {/* 점수 전후 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작 전 점수</label>
                <input
                  type="number"
                  value={form.score_before}
                  onChange={(e) => setForm((f) => ({ ...f, score_before: e.target.value }))}
                  placeholder="예: 32"
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">30일 후 점수</label>
                <input
                  type="number"
                  value={form.score_after}
                  onChange={(e) => setForm((f) => ({ ...f, score_after: e.target.value }))}
                  placeholder="예: 68"
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                />
              </div>
            </div>

            {/* 본문 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                본문 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="고객의 성공 사례를 자세히 작성해주세요..."
                rows={6}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition resize-none"
                required
              />
            </div>

            {/* 익명 여부 */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_anonymous}
                  onChange={(e) => setForm((f) => ({ ...f, is_anonymous: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-300"
                />
                <span className="text-sm text-gray-700">익명으로 게시</span>
              </label>
            </div>

            {/* 표시 이름 (익명 아닐 때) */}
            {!form.is_anonymous && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">표시 이름 (선택)</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="예: 강남구 음식점 사장님"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                />
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    등록 중...
                  </>
                ) : (
                  "등록하기"
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); setError(null); }}
                className="px-5 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : stories.length === 0 ? (
        <div className="py-16 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
          <p className="text-base">등록된 성공 사례가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">새 사례 작성 버튼으로 추가해보세요.</p>
        </div>
      ) : (
        <>
          {/* PC 테이블 */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">업종</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-gray-500">제목</th>
                    <th className="text-right px-5 py-3 text-sm font-semibold text-gray-500">점수 변화</th>
                    <th className="text-right px-5 py-3 text-sm font-semibold text-gray-500">조회수</th>
                    <th className="text-right px-5 py-3 text-sm font-semibold text-gray-500">게시일</th>
                    <th className="text-center px-5 py-3 text-sm font-semibold text-gray-500">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stories.map((story) => (
                    <tr key={story.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-sm font-medium bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                          {CATEGORY_LABELS[story.category] ?? story.category}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]">
                          {story.title}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {story.score_delta !== null ? (
                          <span className="text-sm font-bold text-emerald-600">
                            +{story.score_delta.toFixed(0)}점
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-500">
                        {story.view_count.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-400">
                        {formatDate(story.published_at)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link
                          href={`/stories/${story.id}`}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                          target="_blank"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 카드 목록 */}
          <div className="md:hidden space-y-3">
            {stories.map((story) => (
              <div key={story.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-sm font-medium bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                    {CATEGORY_LABELS[story.category] ?? story.category}
                  </span>
                  {story.score_delta !== null && (
                    <span className="text-sm font-bold text-emerald-600 shrink-0">
                      +{story.score_delta.toFixed(0)}점
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">{story.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{formatDate(story.published_at)}</span>
                  <Link
                    href={`/stories/${story.id}`}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    target="_blank"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    보기
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 하단 네비게이션 */}
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          ← 관리자 메인
        </Link>
        <Trash2 className="w-4 h-4 text-gray-200 ml-auto" aria-hidden="true" />
        <span className="text-sm text-gray-300">삭제 기능은 Supabase에서 직접 처리</span>
      </div>
    </div>
  );
}
