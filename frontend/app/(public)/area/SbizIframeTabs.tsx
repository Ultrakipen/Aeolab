"use client";

import { useState } from "react";
import { useClientValue } from "@/lib/useClientValue";

// 소상공인365 오픈 API(iFrame) — 승인 후 신청 화면에 나오는 "Request URL(사용예시)"의 인증키 자리에 발급받은 키를
// 넣은 **전체 URL**을 환경변수에 넣으면 그 탭만 나타난다. 키가 없는 서비스는 아무것도 그리지 않는다
// ("준비 중" 문구를 노출하지 않음). 코드를 고칠 필요 없이 .env + 재빌드만 하면 된다.
//   예) NEXT_PUBLIC_SBIZ365_URL_SIMPLE=https://bigdata.sbiz.or.kr/#/openApi/simple?certKey=발급받은키
// 주소 경로를 이 파일이 추측하지 않는다 — 서비스마다 포털이 알려 준 URL 그대로 쓴다.
// NEXT_PUBLIC_* 는 빌드 시점에 치환되므로 반드시 process.env.NEXT_PUBLIC_XXX 형태로 직접 적어야 한다.
const SBIZ_HOST = "bigdata.sbiz.or.kr";
const SBIZ_HOME = `https://${SBIZ_HOST}`;

// 순서 = 화면 탭 순서. 사용자 우선순위: 간단·업종·창업기상도·경쟁 → 배달·입지·상세·지도 → 통계류
const TABS: { id: string; label: string; url: string | undefined; primary?: boolean }[] = [
  { id: "simple", primary: true, label: "간단분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_SIMPLE },
  { id: "industry", primary: true, label: "업종분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_INDUSTRY },
  { id: "startup-weather", primary: true, label: "창업기상도", url: process.env.NEXT_PUBLIC_SBIZ365_URL_STARTUP_WEATHER },
  { id: "competition", primary: true, label: "경쟁분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_COMPETITION },
  { id: "delivery", label: "배달분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_DELIVERY },
  { id: "location", label: "입지분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_LOCATION },
  { id: "detail", label: "상세분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_DETAIL },
  { id: "map", label: "상권지도", url: process.env.NEXT_PUBLIC_SBIZ365_URL_MAP },
  { id: "main-stats", label: "주요통계", url: process.env.NEXT_PUBLIC_SBIZ365_URL_MAIN_STATS },
  { id: "population", label: "인구통계", url: process.env.NEXT_PUBLIC_SBIZ365_URL_POPULATION },
  { id: "store-stats", label: "업소통계", url: process.env.NEXT_PUBLIC_SBIZ365_URL_STORE_STATS },
  { id: "sales-stats", label: "매출통계", url: process.env.NEXT_PUBLIC_SBIZ365_URL_SALES_STATS },
  { id: "trend", label: "트렌드 분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_TREND },
  { id: "sns", label: "SNS 분석", url: process.env.NEXT_PUBLIC_SBIZ365_URL_SNS },
  { id: "festival", label: "관광 축제 정보", url: process.env.NEXT_PUBLIC_SBIZ365_URL_FESTIVAL },
];

// 인증키 사용기간 만료일(한국 날짜, 예: 2027-03-31). 이 날이 지나면 iFrame이 깨지므로 탭 영역 전체를 숨긴다
// (자체 데이터 카드는 그대로). 갱신해서 새 키를 받으면 환경변수의 URL과 이 날짜를 함께 바꾼다.
const EXPIRES = process.env.NEXT_PUBLIC_SBIZ365_EXPIRES;

function isExpired(): boolean {
  if (!EXPIRES) return false;
  const t = Date.parse(`${EXPIRES}T23:59:59+09:00`);
  return Number.isFinite(t) && Date.now() > t;
}

/** https + 소상공인365 도메인일 때만 허용(환경변수 오입력으로 다른 사이트가 열리지 않게) */
function safeSbizUrl(v: string | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" && u.hostname === SBIZ_HOST ? u.toString() : null;
  } catch {
    return null;
  }
}

export default function SbizIframeTabs() {
  const tabs = TABS.map((t) => ({ ...t, safe: safeSbizUrl(t.url) })).filter((t) => t.safe !== null);
  const [activeId, setActiveId] = useState<string | null>(null); // 누르기 전에는 불러오지 않는다(지연 로딩)
  // 만료 판정은 방문 시점으로(서버 렌더·ISR 캐시 시점과 달라 생기는 하이드레이션 불일치 방지)
  const expired = useClientValue(isExpired, false);
  const [showMore, setShowMore] = useState(false);
  if (tabs.length === 0 || expired) return null;

  const active = tabs.find((t) => t.id === activeId) ?? null;
  // 핵심 4개만 먼저 보이고 나머지는 접어 둔다(선택된 탭이 접힌 쪽이면 함께 펼친다). 접힌 탭도 모두 열 수 있다.
  const hiddenCount = tabs.filter((t) => !t.primary).length;
  const expanded = showMore || (active !== null && !active.primary);
  const visibleTabs = tabs.filter((t) => t.primary || expanded);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      <h2 className="text-lg font-bold text-gray-900 md:text-xl">더 자세한 상권 분석</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600 break-keep">
        소상공인시장진흥공단 「소상공인365」에서 제공하는 화면입니다. 이 화면 안에서 지역과 업종을 한 번 더 선택해
        주세요(위에서 고른 지역은 자동으로 넘어가지 않습니다).
      </p>
      <p className="mt-1 text-sm leading-relaxed text-gray-600 break-keep">
        지역 목록이 잘려 보이면 화면 안쪽을 아래로 스크롤해 주세요. 검색어에 목록이 나오지 않으면 시·군·구 이름만(예: 성산구)
        입력해 보세요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="상권 분석 종류">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            id={`sbiz-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === activeId}
            aria-controls="sbiz-panel"
            onClick={() => setActiveId(t.id)}
            className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium ${
              t.id === activeId
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
        {hiddenCount > 0 && !(active !== null && !active.primary) ? (
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className="min-h-[44px] rounded-lg border border-dashed border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showMore ? "다른 분석 접기" : `다른 분석 ${hiddenCount}개 더 보기`}
          </button>
        ) : null}
      </div>
      <div id="sbiz-panel" role="tabpanel" aria-labelledby={active ? `sbiz-tab-${active.id}` : undefined}>
        {active ? (
          <div className="mt-4">
            <iframe
              key={active.id}
              src={active.safe as string}
              title={`소상공인365 ${active.label}`}
              loading="lazy"
              className="h-[720px] w-full rounded-lg border border-gray-200 md:h-[900px]"
            />
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="mt-3 min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              화면 닫기
            </button>
            <p className="mt-2 text-sm text-gray-600">
              화면이 보이지 않으면{" "}
              <a href={SBIZ_HOME} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                소상공인365에서 직접 보기
              </a>
              를 이용해 주세요.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-600">보고 싶은 분석 종류를 선택하면 화면이 열립니다.</p>
        )}
      </div>
      <p className="mt-3 text-sm text-gray-600">출처: 소상공인365(소상공인시장진흥공단)</p>
    </section>
  );
}
