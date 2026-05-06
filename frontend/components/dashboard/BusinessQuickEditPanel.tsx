"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, RefreshCw, Plus, ExternalLink } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bizId: string;
  bizName: string;
  initialData: {
    keywords: string[];
    has_faq: boolean;
    has_intro: boolean;
    has_recent_post: boolean;
    visitor_review_count: number;
    receipt_review_count: number;
    avg_rating: number;
    naver_place_url: string;
  };
  authToken: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function BusinessQuickEditPanel({
  isOpen,
  onClose,
  bizId,
  bizName,
  initialData,
  authToken,
}: Props) {
  const router = useRouter();

  // form state
  const [keywords, setKeywords] = useState<string[]>(initialData.keywords);
  const [keywordInput, setKeywordInput] = useState("");
  const [hasFaq, setHasFaq] = useState(initialData.has_faq);
  const [hasIntro, setHasIntro] = useState(initialData.has_intro);
  const [hasRecentPost, setHasRecentPost] = useState(initialData.has_recent_post);
  const [visitorReviewCount, setVisitorReviewCount] = useState(initialData.visitor_review_count);
  const [receiptReviewCount, setReceiptReviewCount] = useState(initialData.receipt_review_count);
  const [avgRating, setAvgRating] = useState(initialData.avg_rating);
  const [naverPlaceUrl, setNaverPlaceUrl] = useState(initialData.naver_place_url);

  // ui state
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [syncCooldown, setSyncCooldown] = useState(false);

  // AI 키워드 자동 추천 (Phase A v3.1)
  const [suggesting, setSuggesting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{keyword: string; rationale: string; source: string}[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // 초기 데이터 동기화 (패널 열릴 때마다)
  useEffect(() => {
    if (isOpen) {
      setKeywords(initialData.keywords);
      setHasFaq(initialData.has_faq);
      setHasIntro(initialData.has_intro);
      setHasRecentPost(initialData.has_recent_post);
      setVisitorReviewCount(initialData.visitor_review_count);
      setReceiptReviewCount(initialData.receipt_review_count);
      setAvgRating(initialData.avg_rating);
      setNaverPlaceUrl(initialData.naver_place_url);
      setToast(null);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // 쿨다운 체크
  useEffect(() => {
    const stored = localStorage.getItem(`aeolab_sync_cooldown_${bizId}`);
    if (stored) {
      const diff = Date.now() - parseInt(stored, 10);
      if (diff < 60 * 60 * 1000) setSyncCooldown(true);
      else setSyncCooldown(false);
    } else {
      setSyncCooldown(false);
    }
  }, [bizId, isOpen]);

  // 패널 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // 키워드 추가
  function addKeyword(raw: string) {
    const kw = raw.trim().replace(/,/g, "");
    if (!kw) return;
    if (keywords.length >= 10) {
      showToast("error", "키워드는 최대 10개까지 등록할 수 있습니다");
      return;
    }
    if (keywords.includes(kw)) {
      setKeywordInput("");
      return;
    }
    setKeywords((prev) => [...prev, kw]);
    setKeywordInput("");
  }

  function handleKeywordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordInput);
    }
    if (e.key === "Backspace" && keywordInput === "" && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  // 자동 불러오기
  async function handleSync() {
    if (syncCooldown || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}/sync-review-stats`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("동기화 실패");
      const data = await res.json();
      if (data.visitor_review_count !== undefined) setVisitorReviewCount(data.visitor_review_count);
      if (data.receipt_review_count !== undefined) setReceiptReviewCount(data.receipt_review_count);
      if (data.avg_rating !== undefined) setAvgRating(data.avg_rating);
      localStorage.setItem(`aeolab_sync_cooldown_${bizId}`, Date.now().toString());
      setSyncCooldown(true);
      showToast("success", "리뷰 현황을 불러왔습니다");
    } catch {
      showToast("error", "자동 불러오기에 실패했습니다. 직접 입력해 주세요.");
    } finally {
      setSyncing(false);
    }
  }

  // 저장
  async function handleSave() {
    if (saving) return;
    // 키워드 3개 이상 필수 (service_unification_v1.0.md §13 #3)
    if (keywords.length < 3) {
      showToast("error", `검색 키워드 3개 이상 필요합니다 (현재 ${keywords.length}개)`);
      return;
    }
    setSaving(true);
    try {
      const body = {
        keywords,
        has_faq: hasFaq,
        has_intro: hasIntro,
        has_recent_post: hasRecentPost,
        visitor_review_count: visitorReviewCount,
        receipt_review_count: receiptReviewCount,
        review_count: visitorReviewCount + receiptReviewCount,
        avg_rating: avgRating,
        naver_place_url: naverPlaceUrl,
      };
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "저장 실패");
      }
      showToast("success", "저장했습니다");
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 800);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 슬라이드 패널 */}
      <div
        className={`fixed top-0 right-0 h-full z-50 bg-white shadow-2xl flex flex-col
          w-full sm:w-96
          transition-transform duration-300
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="가게 정보 빠른 수정"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">가게 정보 빠른 수정</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-[200px]">{bizName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 토스트 */}
        {toast && (
          <div
            className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* 폼 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* ① 핵심 키워드 */}
          <section>
            <p className="text-sm font-semibold text-gray-500 mb-3">핵심 키워드</p>
            <div
              className="flex flex-wrap gap-1.5 p-2.5 border border-gray-300 rounded-xl min-h-[48px] cursor-text focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200"
              onClick={() => inputRef.current?.focus()}
            >
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="flex items-center gap-1 bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-1 rounded-full"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeKeyword(kw); }}
                    className="ml-0.5 text-blue-500 hover:text-blue-800"
                    aria-label={`${kw} 삭제`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                onBlur={() => { if (keywordInput.trim()) addKeyword(keywordInput); }}
                placeholder={keywords.length === 0 ? "예: 강남 맛집, 파스타 (Enter로 추가)" : ""}
                className="flex-1 min-w-[100px] text-sm outline-none bg-transparent placeholder-gray-400"
                disabled={keywords.length >= 10}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-gray-400">Enter 또는 쉼표로 추가 · × 버튼으로 삭제</p>
              <p className="text-xs text-gray-400">{keywords.length}/10</p>
            </div>
            {keywords.length < 10 && keywordInput && (
              <button
                type="button"
                onClick={() => addKeyword(keywordInput)}
                className="mt-1.5 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-3 h-3" /> "{keywordInput}" 추가
              </button>
            )}

            {/* AI 자동 추천 (Phase A) */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{keywords.length < 3 ? <span className="text-red-600 font-medium">3개 이상 필수</span> : "AI 추천으로 키워드 보강"}</p>
                <button
                  type="button"
                  disabled={suggesting || keywords.length >= 10}
                  onClick={async () => {
                    setSuggesting(true);
                    try {
                      const res = await fetch(`${BACKEND}/api/businesses/keyword-suggest`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({ biz_id: bizId, count: 10 }),
                      });
                      if (res.status === 429) {
                        showToast("error", "이번 달 자동 추천 한도 도달. 다음 달 재설정 또는 업그레이드");
                      } else if (!res.ok) {
                        showToast("error", "추천 실패");
                      } else {
                        const data = await res.json();
                        setAiSuggestions(data.suggestions || []);
                        if (data.fallback_used) showToast("error", "AI 일시 사용 불가 - 기본 추천 표시");
                      }
                    } catch {
                      showToast("error", "추천 요청 실패");
                    } finally {
                      setSuggesting(false);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {suggesting ? "추천 중..." : "AI 자동 추천"}
                </button>
              </div>
              {aiSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiSuggestions.map((s) => {
                    const already = keywords.includes(s.keyword);
                    return (
                      <button
                        key={s.keyword}
                        type="button"
                        disabled={already || keywords.length >= 10}
                        onClick={() => addKeyword(s.keyword)}
                        title={s.rationale}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          already
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        {already ? "✓ " : "+ "}{s.keyword}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ② 스마트플레이스 현황 */}
          <section>
            <p className="text-sm font-semibold text-gray-500 mb-3">스마트플레이스 현황</p>
            <div className="space-y-3">
              {[
                { label: "소개글 Q&A 포함됨", hint: "(점수 미반영)", value: hasFaq, setter: setHasFaq },
                { label: "소개글 작성됨", hint: "(+10점)", value: hasIntro, setter: setHasIntro },
                { label: "최근 소식 등록됨", hint: "(+20점)", value: hasRecentPost, setter: setHasRecentPost },
              ].map(({ label, hint, value, setter }) => (
                <label
                  key={label}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setter(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        value
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300 group-hover:border-blue-400"
                      }`}
                    >
                      {value && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-800">{label}</span>
                  <span className="text-xs text-emerald-600 font-semibold">{hint}</span>
                </label>
              ))}
            </div>
            <a
              href="https://smartplace.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              스마트플레이스 바로 가기 <ExternalLink className="w-3 h-3" />
            </a>
          </section>

          {/* ③ 리뷰 현황 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-500">리뷰 현황</p>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || syncCooldown}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  syncCooldown
                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                    : "border-blue-300 text-blue-600 hover:bg-blue-50"
                }`}
                title={syncCooldown ? "1시간 후 다시 시도할 수 있습니다" : "네이버 플레이스에서 자동으로 불러오기"}
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "불러오는 중..." : syncCooldown ? "1시간 후 가능" : "자동 불러오기"}
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">방문자 리뷰 수</label>
                  <input
                    type="number"
                    min={0}
                    value={visitorReviewCount}
                    onChange={(e) => setVisitorReviewCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">영수증 리뷰 수</label>
                  <input
                    type="number"
                    min={0}
                    value={receiptReviewCount}
                    onChange={(e) => setReceiptReviewCount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">평균 별점 (0.0 ~ 5.0)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={Math.round(avgRating * 10)}
                    onChange={(e) => setAvgRating(parseInt(e.target.value) / 10)}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="text-sm font-semibold text-gray-800 w-10 text-right">
                    {avgRating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ④ 네이버 플레이스 URL */}
          <section>
            <p className="text-sm font-semibold text-gray-500 mb-3">네이버 플레이스 URL</p>
            <input
              type="url"
              value={naverPlaceUrl}
              onChange={(e) => setNaverPlaceUrl(e.target.value)}
              placeholder="https://map.naver.com/v5/entry/..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 placeholder-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              네이버 지도에서 내 가게 페이지 주소를 입력하세요
            </p>
          </section>
        </div>

        {/* 하단 버튼 */}
        <div className="shrink-0 border-t border-gray-200 px-5 py-4 space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                저장 중...
              </>
            ) : (
              "저장하기"
            )}
          </button>
          <a
            href="/settings?tab=business"
            className="w-full flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-blue-600 py-2 transition-colors"
          >
            전체 설정 보기 →
          </a>
        </div>
      </div>
    </>
  );
}
