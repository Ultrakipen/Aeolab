import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/common/SiteFooter";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import TrackedCTA from "@/components/analytics/TrackedCTA";
import {
  areaPath,
  fetchAreaDetail,
  fetchAreaAvailability,
  fetchAreaMeta,
  formatCollectedDate,
  formatStdrYm,
  safeDecode,
  type AreaDetail,
} from "@/lib/area";
import AreaHeader from "../../AreaHeader";
import AreaPicker from "../../AreaPicker";
import SbizIframeTabs from "../../SbizIframeTabs";

// 사전 생성 없이 첫 요청 때 만들고 1시간 캐시(ISR). 데이터가 없는 조합을 빌드 때 만들지 않는다.
// 라우트 설정은 정적 분석되는 숫자 리터럴이어야 한다(상수 import 불가). lib/area.ts AREA_REVALIDATE_SECONDS와 같게 유지.
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ region: string; category: string }> };

async function load(params: Props["params"]) {
  const p = await params;
  const region = safeDecode(p.region);
  const category = safeDecode(p.category);
  const detail = await fetchAreaDetail(region, category);
  return { region, category, detail };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, category, detail } = await load(params);
  if (!detail || !detail.region_label) return { title: "우리 동네 상권 | AEOlab", robots: { index: false } };
  const title = `${detail.region_label} ${detail.category_label} 상권 현황 | AEOlab`;
  const description = `${detail.region_label} ${detail.category_label}의 업소 수와 누적 폐업 현황을 공공데이터 기준으로 확인하세요.`;
  return {
    title,
    description,
    openGraph: { title, description, url: areaPath(region, category), type: "website" },
    alternates: { canonical: areaPath(region, category) },
    // 값이 없는 조합은 색인하지 않는다(내용이 빈 페이지가 검색에 남지 않게)
    robots: detail.available ? undefined : { index: false, follow: true },
  };
}

const COMPARISON_TEXT: Record<string, string> = {
  lower: "전국 평균보다 낮은 편",
  similar: "전국 평균과 비슷한 수준",
  higher: "전국 평균보다 높은 편",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">{value}</p>
      {sub ? <p className="mt-1 text-sm text-gray-600 break-keep">{sub}</p> : null}
    </div>
  );
}

function SbizCard({ d }: { d: AreaDetail }) {
  const s = d.sbiz;
  if (!s || s.total_count == null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-900">등록 업소 수</h2>
        <p className="mt-3 text-sm text-gray-600">이 지역·업종의 업소 수는 아직 집계 전입니다.</p>
      </div>
    );
  }
  const ym = formatStdrYm(s.stdr_ym);
  const collected = formatCollectedDate(d.collected_at);
  const radius = s.radius_m ? `반경 약 ${(s.radius_m / 1000).toLocaleString("ko-KR")}km 안` : "주변";
  const underCount = s.confidence === "low" || s.partial_failure;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <h2 className="text-lg font-bold text-gray-900">등록 업소 수</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat
          label={`${radius} 등록 업소`}
          value={`약 ${s.total_count.toLocaleString("ko-KR")}곳`}
          sub="행정구역 경계가 아니라 원형 범위로 센 근사치입니다."
        />
        {s.density_per_km2 != null ? (
          <Stat label="1㎢당 업소 수" value={`약 ${s.density_per_km2.toLocaleString("ko-KR")}곳`} sub="지역끼리 비교할 때 참고하세요." />
        ) : null}
      </div>
      {underCount ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 break-keep">
          이 지역은 면적이 넓거나 일부 조회가 완료되지 않아 실제보다 적게 집계됐을 수 있습니다.
        </p>
      ) : null}
      <p className="mt-4 text-sm text-gray-600 break-keep">
        {s.scope_label ? `집계 범위: ${s.scope_label} · ` : ""}기준: 소상공인시장진흥공단 상가(상권)정보
        {ym ? ` · 데이터 기준월 ${ym}` : ""}
        {collected ? ` · 수집일 ${collected}` : ""}
      </p>
    </div>
  );
}

function ClosureCard({ d }: { d: AreaDetail }) {
  const c = d.closure;
  if (!c || c.closure_rate == null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-900">누적 폐업 현황</h2>
        <p className="mt-3 text-sm text-gray-600">이 지역·업종의 폐업 현황은 아직 집계 전입니다.</p>
      </div>
    );
  }
  const cmp = c.comparison ? COMPARISON_TEXT[c.comparison] : null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
      <h2 className="text-lg font-bold text-gray-900">누적 폐업 현황</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat
          label="역대 누적 폐업 비율"
          value={`${c.closure_rate.toLocaleString("ko-KR")}%`}
          sub={cmp && c.national_avg != null ? `${cmp} (전국 ${c.national_avg}%)` : undefined}
        />
        {c.active_count != null && c.closed_count != null ? (
          <Stat
            label="인허가 기록"
            value={`영업 ${c.active_count.toLocaleString("ko-KR")} · 폐업 ${c.closed_count.toLocaleString("ko-KR")}`}
            sub="단위: 곳"
          />
        ) : null}
      </div>
      <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm leading-relaxed text-blue-900 break-keep">
        이 비율은 오래 영업한 가게와 문을 닫은 가게를 모두 합친 <strong>누적</strong> 기록이라, 올해 얼마나
        폐업했는지를 뜻하는 연간 폐업률이 아닙니다.
      </p>
      <p className="mt-4 text-sm text-gray-600 break-keep">
        집계 범위: {c.scope_label} · 기준: 행정안전부 지방행정 인허가 데이터(지번주소 기준, 일부 누락 가능)
        {formatCollectedDate(d.collected_at) ? ` · 수집일 ${formatCollectedDate(d.collected_at)}` : ""}
      </p>
    </div>
  );
}

export default async function AreaDetailPage({ params }: Props) {
  const { region, category, detail } = await load(params);
  if (!detail || !detail.region_label || !detail.category_label) notFound();

  const [meta, availability] = await Promise.all([fetchAreaMeta(), fetchAreaAvailability()]);
  const title = `${detail.region_label} ${detail.category_label} 상권 현황`;

  return (
    <main className="min-h-screen bg-gray-50">
      <AreaHeader />
      <BreadcrumbJsonLd
        items={[
          { name: "AEOlab", url: "https://aeolab.co.kr/" },
          { name: "우리 동네 상권", url: "https://aeolab.co.kr/area" },
          { name: title, url: `https://aeolab.co.kr${areaPath(region, category)}` },
        ]}
      />

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <nav aria-label="현재 위치" className="mb-3 text-sm text-gray-600">
            <Link href="/area" className="inline-flex min-h-[44px] items-center hover:text-gray-900">
              우리 동네 상권
            </Link>
            <span className="mx-1 text-gray-300" aria-hidden="true">/</span>
            <span>{detail.region_label}</span>
          </nav>
          <h1 className="mb-6 break-keep text-2xl font-bold text-gray-900 md:text-3xl">{title}</h1>
          <AreaPicker meta={meta} availability={availability} initialRegion={region} initialCategory={category} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 md:px-6">
        {detail.available ? (
          <div className="grid gap-5 md:grid-cols-2">
            <SbizCard d={detail} />
            <ClosureCard d={detail} />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">아직 집계 전입니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 break-keep">
              전국 지역의 공공데이터를 순서대로 모으는 중이라 {detail.region_label} {detail.category_label}은(는) 아직
              반영되지 않았습니다. 반영되는 대로 이 화면에 표시되며, 이미 모은 다른 지역은 지금 볼 수 있습니다. 아래
              소상공인365 분석은 바로 이용하실 수 있습니다.
            </p>
          </div>
        )}

        <SbizIframeTabs />

        <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
          <h2 className="text-lg font-bold text-gray-900">같은 지역의 다른 업종</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {meta.categories
              .filter((c) => c.value !== category)
              .map((c) => (
                <li key={c.value}>
                  <Link
                    href={areaPath(region, c.value)}
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-800 hover:border-blue-300 hover:bg-blue-50"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        <section className="rounded-xl bg-blue-600 p-6 text-white md:p-8">
          <h2 className="break-keep text-lg font-bold md:text-xl">
            이 동네에서 내 가게는 AI 검색에 어떻게 보일까요?
          </h2>
          <p className="mt-2 break-keep text-sm leading-relaxed text-blue-50 md:text-base">
            가게 이름만 입력하면 ChatGPT와 네이버에서의 노출 상태와 먼저 고칠 점을 무료로 확인할 수 있습니다.
          </p>
          <TrackedCTA
            href="/trial"
            location="area_detail"
            label="trial_start"
            className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-white px-6 text-base font-semibold text-blue-700 hover:bg-blue-50"
          >
            무료로 내 가게 확인하기
          </TrackedCTA>
        </section>

        <p className="text-sm leading-relaxed text-gray-600 break-keep">
          위 수치는 공공데이터를 일정 주기로 수집한 값으로, 수집 시점·집계 방식·조회 범위에 따라 실제와 다를 수 있습니다.
          창업·투자 판단의 단독 근거로 사용하지 마시고 현장 확인과 함께 참고해 주세요.
        </p>
      </div>

      <SiteFooter activePage="/area" />
    </main>
  );
}
