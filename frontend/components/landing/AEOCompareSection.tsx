import { Lightbulb, Target, ArrowRight } from "lucide-react";
import { PLAN_PRICES, FIRST_MONTH_DISCOUNT_PRICES } from "@/lib/plans";
import { GEMINI_MEASUREMENT_LIVE } from "@/lib/featureFlags";

/**
 * 서비스 비교 (2026-11-08 개편) — 이전 표는 "웹 SEO 관리"·"플레이스 관리"처럼 실제 대안이 아닌 열과 AEOlab의 기능 9개를 비교해
 * 한쪽만 체크가 차는 구조였다. 소상공인이 실제로 고려하는 대안 유형(무료 자가진단 / 블로그 전용 진단 / 기업·컨설팅형)과 비교한다.
 *
 * 규칙: ① 서비스 이름은 쓰지 않는다(법적 위험·낡음 방지). ② 확인한 범위만 쓰고 "서비스마다 다릅니다"를 함께 둔다.
 * ③ 근거 — docs/aeolab_strategic_direction_v1.0.md §1(2026-07-20 유형별 조사), docs/competitor_naver_ai_support_recheck_2026_10_07.md,
 *    2026-11-08 기업형 1곳 가격 재확인(월 199,000원). 가격·지원 범위가 바뀌면 이 표와 FAQSection의 같은 문구를 함께 고칠 것.
 */

interface Column {
  key: string;
  title: string;
  sub: string;
  price: string;
  naver: string;
  scope: string;
  self: string;
}

const AEOLAB_PRICE = `월 ${PLAN_PRICES.basic.toLocaleString()}원 · 첫 달 ${FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원`;
const GLOBAL_AI = GEMINI_MEASUREMENT_LIVE ? "ChatGPT·Gemini·구글 AI" : "ChatGPT·구글 AI";

const OTHERS: Column[] = [
  {
    key: "free",
    title: "무료 자가진단",
    sub: "1회성 점검 도구",
    price: "무료",
    naver: "대체로 다루지 않음",
    scope: "한 번 점검해 점수·안내 제공",
    self: "가능 (구독·추적 없음)",
  },
  {
    key: "blog",
    title: "블로그 전용 진단",
    sub: "네이버 블로그 글 중심",
    price: "무료 ~ 월 2만 원대 (7월 조사, 현재 가격 미공개)",
    naver: "블로그 글 한 채널만",
    scope: "블로그 글 진단",
    self: "가능",
  },
  {
    key: "biz",
    title: "기업·컨설팅형",
    sub: "AI 노출 SaaS · 대행",
    price: "월 19만 원대부터",
    naver: "일부 서비스만 지원",
    scope: "브랜드·콘텐츠 중심 점검, 컨설팅",
    self: "대부분 어려움 (컨설팅·대행 중심)",
  },
];

const AEOLAB: Column = {
  key: "aeolab",
  title: "AEOlab",
  sub: "소상공인 셀프서비스",
  price: AEOLAB_PRICE,
  naver: "가게 단위로 확인 (가입 후 AI 브리핑·AI탭)",
  scope: `스마트플레이스·리뷰·키워드·블로그 + ${GLOBAL_AI} 답변`,
  self: "가능 (직접 실행, 순서 안내·초안 제공)",
};

const ROWS: { label: string; field: "price" | "naver" | "scope" | "self" }[] = [
  { label: "가격 (확인한 범위)", field: "price" },
  { label: "네이버 AI 브리핑·AI탭", field: "naver" },
  { label: "보는 범위", field: "scope" },
  { label: "사장님이 직접 쓰기", field: "self" },
];

export default function AEOCompareSection() {
  return (
    <section className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF" }}>
      <div className="max-w-[1020px] mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-7 fade-up">
          <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
            서비스 비교
          </p>
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            기존 방법과 무엇이 다른가요?
          </h2>
          <p className="text-sm md:text-base mt-2 break-keep" style={{ color: "#45556C" }}>
            소상공인이 실제로 고르는 방법과 나란히 비교했습니다
          </p>
        </div>

        {/* PC — 유형 4열 비교표 */}
        <div className="hidden md:block fade-up">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "150px repeat(3, minmax(0, 1fr)) minmax(0, 1.25fr)" }}
          >
            {/* 열 머리글 */}
            <div />
            {OTHERS.map((c) => (
              <div key={c.key} className="rounded-xl border px-4 py-3" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}>
                <p className="text-base font-black break-keep" style={{ color: "#45556C" }}>{c.title}</p>
                <p className="text-sm break-keep" style={{ color: "#45556C" }}>{c.sub}</p>
              </div>
            ))}
            <div
              className="relative rounded-xl px-4 py-3"
              style={{
                background: "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)",
                border: "2px solid #2563EB",
              }}
            >
              <span
                className="absolute -top-3 left-4 text-sm font-bold px-3 py-0.5 rounded-full"
                style={{ background: "#2563EB", color: "#FFFFFF" }}
              >
                추천
              </span>
              <p className="text-base font-black" style={{ color: "#2563EB" }}>{AEOLAB.title}</p>
              <p className="text-sm break-keep" style={{ color: "#0F172A" }}>{AEOLAB.sub}</p>
            </div>

            {/* 행 */}
            {ROWS.map((r) => (
              <div key={r.field} className="contents">
                <div className="flex items-center text-sm font-bold break-keep pr-2" style={{ color: "#0F172A" }}>
                  {r.label}
                </div>
                {OTHERS.map((c) => (
                  <div
                    key={c.key + r.field}
                    className="rounded-lg border px-4 py-3 text-sm break-keep"
                    style={{ borderColor: "#E2E8F0", background: "#FFFFFF", color: "#45556C" }}
                  >
                    {c[r.field]}
                  </div>
                ))}
                <div
                  className="rounded-lg px-4 py-3 text-sm font-semibold break-keep"
                  style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#0F172A" }}
                >
                  {AEOLAB[r.field]}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-5">
            <a
              href="/trial"
              className="inline-flex items-center justify-center gap-1 px-8 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)", boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}
            >
              무료로 시작하기 <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* 모바일 — AEOlab 카드 + 다른 방법 카드 */}
        <div className="md:hidden fade-up space-y-3">
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)",
              border: "1.5px solid #2563EB",
              boxShadow: "var(--aeo-shadow-lg)",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: "#2563EB", color: "#FFFFFF" }}>
                추천
              </span>
              <p className="text-base font-black" style={{ color: "#2563EB" }}>{AEOLAB.title}</p>
            </div>
            <p className="text-sm mb-3 break-keep" style={{ color: "#45556C" }}>{AEOLAB.sub}</p>
            <dl className="space-y-2.5">
              {ROWS.map((r) => (
                <div key={r.field}>
                  <dt className="text-sm font-bold" style={{ color: "#0F172A" }}>{r.label}</dt>
                  <dd className="text-sm break-keep" style={{ color: "#0F172A" }}>{AEOLAB[r.field]}</dd>
                </div>
              ))}
            </dl>
            <a
              href="/trial"
              className="flex items-center justify-center gap-1 w-full mt-5 py-3 rounded-xl text-sm font-bold text-white text-center transition-all hover:scale-105 hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)", boxShadow: "0 4px 16px rgba(124,58,237,0.25)" }}
            >
              무료로 시작하기 <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>

          {OTHERS.map((c) => (
            <div key={c.key} className="rounded-xl border p-4" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}>
              <p className="text-base font-black break-keep" style={{ color: "#45556C" }}>{c.title}</p>
              <p className="text-sm mb-2 break-keep" style={{ color: "#45556C" }}>{c.sub}</p>
              <dl className="space-y-1.5">
                {ROWS.map((r) => (
                  <div key={r.field} className="flex gap-2 text-sm">
                    <dt className="font-bold shrink-0 w-[104px] break-keep" style={{ color: "#0F172A" }}>{r.label}</dt>
                    <dd className="break-keep" style={{ color: "#45556C" }}>{c[r.field]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* 기준·한계 — 이름 없이 유형으로 비교하며, 서비스마다 다르고 바뀔 수 있음을 밝힌다 */}
        <p className="text-sm text-gray-600 text-center mt-4 break-keep fade-up">
          확인한 범위의 유형별 비교이며 서비스마다 다르고 바뀔 수 있습니다 (2026년 7~11월 조사, 기업형 가격은 11월 재확인)
        </p>

        {/* 네이버 검색 SEO 연결 안내 */}
        <div className="hidden md:block mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 fade-up">
          <p className="text-sm font-semibold text-green-800 text-center break-keep">
            <Lightbulb className="inline w-4 h-4 -mt-0.5 mr-1" aria-hidden="true" />스마트플레이스·블로그를 개선하면 <strong>네이버 플레이스 탭 검색 순위</strong>와 <strong>AI 브리핑·AI탭 노출</strong> 가능성이 함께 높아집니다
          </p>
          <p className="text-sm text-green-700 text-center mt-1 break-keep">
            웹사이트 노출 관리 중심의 서비스와 달리 AEOlab은 네이버 로컬 검색 순위·AI 노출을 동시에 다룹니다
          </p>
        </div>

        {/* 경쟁 서비스 대비 차별화 안내 */}
        <div className="hidden md:block mt-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 fade-up">
          <p className="text-sm font-semibold text-blue-800 text-center break-keep">
            <Target className="inline w-4 h-4 -mt-0.5 mr-1" aria-hidden="true" />ChatGPT·Gemini 중심 서비스와 달리 AEOlab은 <strong>네이버 AI와 글로벌 AI를 함께</strong> 측정합니다
          </p>
          <p className="text-sm text-blue-700 text-center mt-1 break-keep">
            네이버 AI까지 보는 서비스도 있지만, 확인한 서비스는 기업·에이전시 대상이었습니다. AEOlab은 소상공인을 위한 서비스입니다(월 {PLAN_PRICES.basic.toLocaleString()}원부터)
          </p>
        </div>
      </div>
    </section>
  );
}
