"use client";

/**
 * 클라이언트 컴포넌트 전용 — AI 브리핑 업종 분류를 백엔드 API에서 동적으로 가져옴.
 * 서버 컴포넌트는 lib/briefingCategoriesServer.ts 사용.
 * 모듈 레벨 캐시로 여러 컴포넌트가 동시에 호출해도 네트워크 요청은 1회만 발생.
 */

import { useEffect, useState } from "react";
import { apiBase } from "@/lib/api";

const FALLBACK_ACTIVE = ["restaurant", "cafe", "bakery", "bar", "accommodation"];
const FALLBACK_LIKELY = [
  "beauty", "nail", "skincare", "massage", "spa",
  "pet", "fitness", "yoga", "pharmacy",
  "dance", "ballet", "semi_permanent",
];

export interface BriefingCategories {
  active: readonly string[];
  likely: readonly string[];
}

let cached: BriefingCategories | null = null;
let inflight: Promise<BriefingCategories> | null = null;

async function loadBriefingCategories(): Promise<BriefingCategories> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch(`${apiBase}/api/public/briefing-categories`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        cached = {
          active: Array.isArray(data.active) ? data.active : FALLBACK_ACTIVE,
          likely: Array.isArray(data.likely) ? data.likely : FALLBACK_LIKELY,
        };
        return cached;
      })
      .catch(() => {
        cached = { active: FALLBACK_ACTIVE, likely: FALLBACK_LIKELY };
        return cached;
      });
  }
  return inflight;
}

/** 첫 렌더에는 undefined(하드코딩 fallback 사용) → 로드 완료 후 동적 목록으로 갱신 */
export function useBriefingCategories(): BriefingCategories | undefined {
  const [cats, setCats] = useState<BriefingCategories | undefined>(cached ?? undefined);

  useEffect(() => {
    let mounted = true;
    loadBriefingCategories().then((c) => {
      if (mounted) setCats(c);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return cats;
}
