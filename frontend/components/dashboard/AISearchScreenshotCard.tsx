"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Screenshot {
  platform: "naver" | "naver_place" | "naver_blog" | "naver_cafe" | "naver_briefing" | "chatgpt" | "gemini";
  query: string;
  is_mentioned: boolean;
  url: string | null;
  scanned_at?: string;
  captured_at: string;
  label?: string;
  exposure_freq?: number;
}

interface Props {
  bizId: string;
  plan: string;
  authToken: string;
}

const PAID_PLANS = ["basic", "startup", "pro", "biz", "enterprise"];

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
}

const PLATFORM_META: Record<string, { label: string; color: string; headerColor: string; badge: string }> = {
  naver_blog: {
    label: "네이버 블로그",
    color: "bg-green-50 border-green-200",
    headerColor: "text-green-700",
    badge: "블로그 콘텐츠 노출",
  },
  naver_cafe: {
    label: "네이버 카페",
    color: "bg-teal-50 border-teal-200",
    headerColor: "text-teal-700",
    badge: "카페 커뮤니티 노출",
  },
  naver_briefing: {
    label: "네이버 AI 브리핑",
    color: "bg-emerald-50 border-emerald-300",
    headerColor: "text-emerald-700",
    badge: "AI 텍스트 요약",
  },
  chatgpt: {
    label: "ChatGPT",
    color: "bg-orange-50 border-orange-200",
    headerColor: "text-orange-700",
    badge: "AI 언급 여부",
  },
  gemini: {
    label: "Gemini AI",
    color: "bg-blue-50 border-blue-200",
    headerColor: "text-blue-700",
    badge: "AI 노출률",
  },
};

function PlatformCard({ screenshot }: { screenshot: Screenshot }) {
  const [imgError, setImgError] = useState(false);
  const meta = PLATFORM_META[screenshot.platform] ?? PLATFORM_META["naver"];
  const displayLabel = screenshot.label || meta.label;
  const checkedAt = screenshot.captured_at || screenshot.scanned_at || "";

  return (
    <div className={`rounded-xl border p-4 ${meta.color}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-base font-bold ${meta.headerColor}`}>{displayLabel}</span>
          <span className="text-xs text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full">
            {meta.badge}
          </span>
        </div>
        {checkedAt && (
          <span className="text-xs text-gray-400">{formatDate(checkedAt)} 확인</span>
        )}
      </div>

      {/* 검색어 */}
      <p className="text-sm text-gray-500 mb-2">
        검색어: <span className="font-medium text-gray-700">{screenshot.query}</span>
      </p>

      {/* 언급 배지 */}
      {screenshot.is_mentioned ? (
        <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-lg mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          내 가게 노출됨
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-lg mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          내 가게 미노출
        </div>
      )}

      {/* 스크린샷 */}
      {screenshot.platform === "gemini" ? (
        <div className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-4">
          <p className="text-sm text-blue-600 font-semibold mb-2">Gemini·ChatGPT 듀얼 측정 노출 결과</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-blue-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, screenshot.exposure_freq ?? 0)}%` }}
              />
            </div>
            <span className="text-base font-bold text-blue-700 whitespace-nowrap">
              {screenshot.exposure_freq ?? 0}회 / 100회
            </span>
          </div>
          <p className="text-sm text-blue-500 mt-2 text-center">
            Gemini·ChatGPT 각 50회씩 반복 질문하여 언급 횟수로 노출률을 측정합니다
          </p>
        </div>
      ) : screenshot.platform === "chatgpt" ? (
        <div className="w-full h-28 rounded-lg border border-dashed border-orange-200 bg-orange-50 flex flex-col items-center justify-center gap-1.5 px-4">
          <svg className="w-8 h-8 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-xs text-orange-500 text-center">
            ChatGPT는 API로 언급 여부만 확인합니다
          </p>
        </div>
      ) : screenshot.url && !imgError ? (
        <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
          style={{ minHeight: "160px", maxHeight: "320px" }}>
          <Image
            src={screenshot.url}
            alt={`${displayLabel} 검색 화면`}
            width={600}
            height={400}
            className="w-full h-auto object-top"
            onError={() => setImgError(true)}
            unoptimized
          />
          <a
            href={screenshot.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded hover:bg-opacity-80 transition-colors"
          >
            크게 보기
          </a>
        </div>
      ) : (
        <div className="w-full h-40 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2">
          <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-gray-400 text-center px-2">
            {imgError ? "이미지를 불러올 수 없습니다" : "스크린샷 준비 중"}
          </p>
          {screenshot.platform === "naver_briefing" && !screenshot.url && !imgError && (
            <p className="text-xs text-gray-400 text-center px-3">
              이 검색어에서 AI 브리핑이 나타나지 않았습니다
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AISearchScreenshotCard({ bizId, plan, authToken }: Props) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  useEffect(() => {
    if (!PAID_PLANS.includes(plan)) {
      setLoading(false);
      return;
    }
    fetch(`${BACKEND_URL}/api/report/ai-search-screenshots/${bizId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.screenshots) setScreenshots(data.screenshots);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bizId, plan, authToken, BACKEND_URL]);

  if (!PAID_PLANS.includes(plan)) return null;

  // 플랫폼별 분류 (naver_blog, naver_cafe 우선 — 구형 naver/naver_place 지도 화면 제외)
  const naverBlog = screenshots.find((s) => s.platform === "naver_blog") ?? null;
  const naverCafe = screenshots.find((s) => s.platform === "naver_cafe") ?? null;
  const naverBriefing = screenshots.find((s) => s.platform === "naver_briefing") ?? null;
  const chatgpt = screenshots.find((s) => s.platform === "chatgpt") ?? null;
  const gemini = screenshots.find((s) => s.platform === "gemini") ?? null;

  const displayItems = [naverBlog, naverCafe, naverBriefing, chatgpt, gemini].filter(Boolean) as Screenshot[];

  const lastChecked = screenshots.reduce<string | null>((latest, s) => {
    const ts = s.captured_at || s.scanned_at || "";
    if (!ts) return latest;
    if (!latest) return ts;
    return ts > latest ? ts : latest;
  }, null);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">실제 AI 검색 화면</h2>
          <p className="text-xs text-gray-400 mt-0.5">스캔 후 자동 캡처 · 네이버 블로그 + 카페 + ChatGPT + Gemini</p>
        </div>
        {lastChecked && (
          <span className="text-sm text-gray-400">마지막 확인: {formatDate(lastChecked)}</span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-32 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-48 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-28 mb-3" />
              <div className="h-40 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : displayItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayItems.map((s, i) => (
            <PlatformCard key={i} screenshot={s} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 px-4">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-gray-500 leading-relaxed">
            아직 AI 검색 화면 분석이 완료되지 않았습니다.
            <br />
            스캔 완료 후 약 20초 뒤 자동으로 나타납니다.
          </p>
        </div>
      )}
    </div>
  );
}
