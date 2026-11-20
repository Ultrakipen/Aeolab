import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { SiteFooter } from "@/components/common/SiteFooter";
import { areaPath, fetchAreaAvailability, fetchAreaMeta, groupBySido } from "@/lib/area";
import { pageOpenGraph } from "@/lib/seoMeta";
import AreaHeader from "./AreaHeader";
import AreaPicker from "./AreaPicker";
import NearbyPanel from "./NearbyPanel";

// 라우트 설정은 정적 분석되는 숫자 리터럴이어야 한다(상수 import 불가). lib/area.ts AREA_REVALIDATE_SECONDS와 같게 유지.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "우리 동네 상권 — 지역·업종별 업소 수와 폐업 현황 | AEOlab",
  description:
    "지역과 업종을 고르면 공공데이터(소상공인시장진흥공단 상가정보, 행정안전부 인허가) 기준의 업소 수와 누적 폐업 현황을 보여 드립니다. 로그인 없이 무료로 확인하세요.",
  alternates: { canonical: "/area" },
  openGraph: pageOpenGraph({ title: "우리 동네 상권 — 지역·업종별 업소 수와 폐업 현황 | AEOlab", description:
    "지역과 업종을 고르면 공공데이터(소상공인시장진흥공단 상가정보, 행정안전부 인허가) 기준의 업소 수와 누적 폐업 현황을 보여 드립니다. 로그인 없이 무료로 확인하세요.", path: "/area" }),
};

export default async function AreaHubPage() {
  const [meta, availability] = await Promise.all([fetchAreaMeta(), fetchAreaAvailability()]);
  // 값이 모인 지역이 있는지 — 조회 실패(null)면 표시를 바꾸지 않는다(전부 막지 않음)
  const readyOf = (slug: string) => (availability === null ? true : (availability[slug]?.length ?? 0) > 0);
  const readyTotal = availability === null ? null : meta.regions.filter((r) => readyOf(r.slug)).length;

  return (
    <main className="min-h-screen bg-gray-50">
      <AreaHeader />

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <span className="text-sm font-medium text-blue-600">공공데이터 기반 · 로그인 없이 무료</span>
          </div>
          <h1 className="mb-3 break-keep text-2xl font-bold text-gray-900 md:text-3xl">우리 동네 상권 현황</h1>
          <p className="max-w-2xl break-keep text-sm leading-relaxed text-gray-600 md:text-base">
            창업을 준비하거나 가게를 운영 중이라면, 가게 바로 주변에 어떤 업종이 몇 곳 있는지 먼저 확인해 보세요.
            가게 이름이나 주소만 넣으면 됩니다.
          </p>
          <div className="mt-6">
            <NearbyPanel />
          </div>
          <h2 className="mb-2 mt-10 text-lg font-bold text-gray-900 md:text-xl">구·시 단위로 보기 — 업소 수와 누적 폐업</h2>
          <p className="mb-4 max-w-2xl break-keep text-sm leading-relaxed text-gray-600">
            더 넓은 범위가 궁금하다면 지역과 업종을 골라 보세요. 이쪽은 구·시 전체 기준이고, 누적 폐업 현황도 함께 볼 수 있어요.
          </p>
          <div>
            <AreaPicker meta={meta} availability={availability} />
          </div>
          {readyTotal !== null && readyTotal < meta.regions.length ? (
            <p className="mt-4 text-sm leading-relaxed text-gray-600 break-keep" role="status">
              지금까지 전국 {meta.regions.length}개 시·군·구 중 <strong className="text-gray-900">{readyTotal}곳</strong>의 집계가 끝났어요.
              나머지는 대도시권부터 순서대로 반영 중이며, 반영되면 선택할 수 있게 열려요.
            </p>
          ) : null}
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h2 className="mb-3 text-lg font-bold text-gray-900">지역으로 바로 가기</h2>
        <p className="mb-4 text-sm text-gray-600">
          지역을 누르면 음식점 기준 화면이 열리고, 그 화면에서 업종을 바꿀 수 있습니다.
        </p>
        <div className="space-y-2">
          {groupBySido(meta.regions).map((g) => (
            <details key={g.sido} className="rounded-lg border border-gray-200 bg-white">
              <summary className="flex min-h-[48px] cursor-pointer items-center justify-between px-4 text-base font-medium text-gray-900">
                <span>{g.sido}</span>
                <span className="text-sm font-normal text-gray-600">
                  {availability === null
                    ? `${g.regions.length}곳`
                    : `${g.regions.filter((r) => readyOf(r.slug)).length}/${g.regions.length}곳 집계 완료`}
                </span>
              </summary>
              <ul className="grid grid-cols-2 gap-2 border-t border-gray-100 p-3 sm:grid-cols-3 md:grid-cols-4">
                {g.regions.map((r) => (
                  <li key={r.slug}>
                    {readyOf(r.slug) ? (
                      <Link
                        href={areaPath(
                          r.slug,
                          availability === null || availability[r.slug]?.includes("restaurant")
                            ? "restaurant"
                            : (availability[r.slug]?.[0] ?? "restaurant"),
                        )}
                        className="flex min-h-[44px] items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-800 hover:border-blue-300 hover:bg-blue-50"
                      >
                        {r.sigungu}
                      </Link>
                    ) : (
                      <span className="flex min-h-[44px] flex-col justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 text-sm leading-tight text-gray-600">
                        {r.sigungu}
                        <span className="text-sm">집계 준비 중</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm leading-relaxed text-gray-600 break-keep">
          자료 출처: 소상공인시장진흥공단 상가(상권)정보, 행정안전부 지방행정 인허가 데이터. 수집 시점·집계 방식에
          따라 실제와 차이가 있을 수 있으며, 아직 집계하지 않은 지역·업종은 &ldquo;집계 전&rdquo;으로 표시됩니다.
        </p>
      </section>

      <SiteFooter activePage="/area" />
    </main>
  );
}
