"use client";

import Link from "next/link";
import { trackDetailsToggle } from "@/lib/analytics";

const FLOAT_SHADOW = "var(--aeo-shadow-float)";

export default function ServiceMechanismSection() {
  return (
    <section className="px-4 py-8 md:py-12" style={{ background: "transparent" }}>
      <div className="max-w-[1020px] mx-auto">

        {/* 섹션 타이틀 */}
        <div className="text-center mb-8 fade-up">
          <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
            서비스 기준
          </p>
          <h2
            className="text-xl md:text-2xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            AEOlab은 어떤 기준으로 도와드리나요?
          </h2>
          <p className="text-sm md:text-base mt-2 break-keep max-w-xl mx-auto" style={{ color: "#475569" }}>
            네이버 공식 노출 조건을 분석하고, 사장님이 5분 안에 실행하도록 AI가 가이드를 자동 생성합니다
          </p>
        </div>

        {/* ── 1. 게이트 3조건 ── */}
        <div className="mb-8">
          <p className="text-sm font-bold tracking-widest mb-4 fade-up" style={{ color: "#2563EB" }}>
            [1] 노출 가능 여부 — 게이트 3조건
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <GateCard
              num="①"
              title="AI 브리핑 대상 업종"
              active="음식점·카페·베이커리·바·숙박"
              detail="그 외 업종은 ChatGPT·Gemini·Google AI + 네이버 AI탭(음식점·쇼핑 우선 베타) 노출 개선으로 가치 전달"
              variant="blue"
            />
            <GateCard
              num="②"
              title="프랜차이즈 가맹점 아님"
              active="개인 사업장만 대상"
              detail="네이버 공식: 프랜차이즈는 현재 제외 (추후 확대 예정)"
              variant="green"
            />
            <GateCard
              num="③"
              title="리뷰 수 기준 충족"
              active="영수증 리뷰 10건 이상 권장"
              detail="부족 시 QR 카드 매장 비치 + 리뷰 답변 자동 생성으로 지원"
              variant="amber"
            />
          </div>
        </div>

        {/* ── 2. 점수 4항목 100점 ── */}
        <div className="mb-8">
          <p className="text-sm font-bold tracking-widest mb-4 fade-up" style={{ color: "#2563EB" }}>
            [2] AI 검색 노출을 높이는 4가지 핵심 항목 (AI 브리핑·AI탭 공통)
          </p>
          <div
            className="rounded-xl border p-4 md:p-6 fade-up"
            style={{ background: "#FFFFFF", borderColor: "#BFDBFE", boxShadow: FLOAT_SHADOW }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
              <ScorePill points={25} title="스마트플레이스 등록" desc="자동 감지" />
              <ScorePill points={30} title="네이버 지역검색 순위" desc="실시간 측정" />
              <ScorePill points={25} title="소식·리뷰 활성도" desc="AI 자동 초안" />
              <ScorePill points={20} title="소개글 품질" desc="AI 소개글 자동 생성" />
            </div>
            <p className="text-sm text-center break-keep" style={{ color: "#475569" }}>
              이 4가지가 갖춰질수록 AI 브리핑 노출 확률이 높아집니다 —{" "}
              <a href="/how-it-works#step2" style={{ color: "#2563EB" }} className="hover:underline">
                자세한 내용 보기
              </a>
            </p>
          </div>
        </div>

        {/* ── 3. 접기 — 상세 내용 ── */}
        <details
          className="group rounded-xl border overflow-hidden fade-up"
          style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: FLOAT_SHADOW }}
          onToggle={(e) =>
            trackDetailsToggle("service_mechanism", (e.currentTarget as HTMLDetailsElement).open)
          }
        >
          <summary
            className="flex items-center justify-between gap-3 cursor-pointer list-none p-4 md:p-5 transition-colors hover:bg-[#F8FAFC]"
            style={{ minHeight: "56px" }}
          >
            <span
              className="text-sm md:text-base font-semibold break-keep"
              style={{ color: "#0F172A" }}
            >
              더 자세한 동작 원리·정직한 한계·공식 데이터 보기
            </span>
            <span
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold transition-transform group-open:rotate-45"
              style={{ background: "#2563EB", color: "#FFFFFF" }}
              aria-hidden="true"
            >
              +
            </span>
          </summary>

          <div
            className="px-4 pb-5 md:px-5 md:pb-6 space-y-5"
            style={{ borderTop: "1px solid #E2E8F0" }}
          >
            {/* 가능 vs 불가능 */}
            <div className="pt-5">
              <p className="text-sm font-bold tracking-widest mb-4" style={{ color: "#2563EB" }}>
                [3] 정직한 약속 — 가능 vs 불가능
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {/* 가능 */}
                <div
                  className="rounded-xl border p-4 md:p-5"
                  style={{ background: "#ECFDF5", borderColor: "#6EE7B7" }}
                >
                  <p className="text-sm font-black mb-3 break-keep" style={{ color: "#065F46" }}>
                    ✅ 가능
                  </p>
                  <ul className="space-y-2 text-sm leading-relaxed" style={{ color: "#0F172A" }}>
                    <li>• 노출 조건 분석 + 자동 콘텐츠 생성</li>
                    <li>• 비대상 업종도 글로벌 AI 노출 개선</li>
                    <li>• 매주 4개 AI 스캔 + 결과 검증</li>
                    <li>• 경쟁사 비교 + 키워드 갭 분석</li>
                  </ul>
                </div>
                {/* 불가능 */}
                <div
                  className="rounded-xl border p-4 md:p-5"
                  style={{ background: "#FEF2F2", borderColor: "#FECACA" }}
                >
                  <p className="text-sm font-black mb-3 break-keep" style={{ color: "#9F1239" }}>
                    ❌ 불가능
                  </p>
                  <ul className="space-y-2 text-sm leading-relaxed" style={{ color: "#0F172A" }}>
                    <li>• 노출 자체를 100% 보장 (네이버 알고리즘 비공개)</li>
                    <li>• 네이버 AI 브리핑 비대상 업종을 대상으로 전환하기</li>
                    <li>• AI 정보 탭 토글을 대신 켜기</li>
                    <li>• 네이버 정책 위반 우회</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 네이버 공식 데이터 */}
            <div
              className="rounded-xl border p-4 md:p-5"
              style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
            >
              <p className="text-sm font-bold mb-3 break-keep" style={{ color: "#1D4ED8" }}>
                네이버 공식 발표 데이터 (2025–2026)
              </p>
              <ul className="space-y-2 text-sm leading-relaxed mb-3" style={{ color: "#1E293B" }}>
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold" style={{ color: "#2563EB" }}>•</span>
                  AI 브리핑 사용자 <strong>3,000만명+</strong> <span style={{ color: "#64748B", fontSize: "0.75rem" }}>(추정치)</span>, 통합검색 질의 약 <strong>20%</strong> 적용
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold" style={{ color: "#2563EB" }}>•</span>
                  음식점 적용 후 — 체류시간 <strong>+10.4%</strong> / 클릭률 <strong>+27.4%</strong> / 예약 <strong>+8%</strong>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold" style={{ color: "#2563EB" }}>•</span>
                  숙박 <strong>1만 5천 개</strong> 업체 적용 (2026년 기준)
                </li>
              </ul>
              <p className="text-sm break-keep" style={{ color: "#475569" }}>
                네이버 공식 발표 기준 · 실제 결과는 업종·지역에 따라 다를 수 있습니다.{" "}
                <a
                  href="https://www.mt.co.kr/tech/2026/04/07/2026040709261836765"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563EB" }}
                  className="hover:underline"
                >
                  출처 →
                </a>
              </p>
            </div>

            {/* 매뉴얼 CTA — 흰색 배경 + 파란 테두리 카드 */}
            <div
              className="rounded-xl border-2 p-5 md:p-6 text-center"
              style={{ background: "#FFFFFF", borderColor: "#2563EB" }}
            >
              <p className="text-base font-bold mb-1 break-keep" style={{ color: "#0F172A" }}>
                동작 원리·요금제별 기능·역할 분담까지 — 5분 안에 모두 이해할 수 있습니다
              </p>
              <p className="text-sm mb-4 break-keep" style={{ color: "#475569" }}>
                매뉴얼 페이지에서 9개 섹션 종합 안내 (목차 + 앵커 점프 지원)
              </p>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-xl text-sm font-bold px-7 py-3 transition-colors hover:bg-[#1D4ED8]"
                style={{ background: "#2563EB", color: "#FFFFFF" }}
              >
                서비스 안내 매뉴얼 →
              </Link>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

interface GateCardProps {
  num: string;
  title: string;
  active: string;
  detail: string;
  variant: "blue" | "green" | "amber";
}

const GATE_COLORS = {
  blue:  { bg: "#EFF6FF", border: "#BFDBFE", activeTxt: "#2563EB", numBg: "#BFDBFE", numTxt: "#1D4ED8" },
  green: { bg: "#ECFDF5", border: "#6EE7B7", activeTxt: "#059669", numBg: "#6EE7B7", numTxt: "#065F46" },
  amber: { bg: "#FFFBEB", border: "#FDE68A", activeTxt: "#D97706", numBg: "#FDE68A", numTxt: "#92400E" },
} as const;

function GateCard({ num, title, active, detail, variant }: GateCardProps) {
  const c = GATE_COLORS[variant];
  return (
    <div
      className="rounded-xl border p-4 md:p-5 fade-up"
      style={{ background: c.bg, borderColor: c.border, boxShadow: FLOAT_SHADOW, minHeight: "96px" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-base font-black w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: c.numBg, color: c.numTxt }}
        >
          {num}
        </span>
        <p className="text-sm font-bold break-keep" style={{ color: "#0F172A" }}>{title}</p>
      </div>
      <p className="text-sm font-semibold mb-1.5 break-keep" style={{ color: c.activeTxt }}>{active}</p>
      <p className="text-sm leading-relaxed break-keep" style={{ color: "#475569" }}>{detail}</p>
    </div>
  );
}

interface ScorePillProps {
  points: number;
  title: string;
  desc: string;
}

function ScorePill({ points, title, desc }: ScorePillProps) {
  return (
    <div
      className="rounded-xl border p-3 md:p-4 text-center"
      style={{ background: "#F8FAFC", borderColor: "#E2E8F0", minHeight: "96px" }}
    >
      <p
        className="text-3xl md:text-4xl font-black mb-1 leading-none"
        style={{ color: "#2563EB", fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
      >
        {points}
        <span className="text-sm font-normal" style={{ color: "#475569" }}>점</span>
      </p>
      <p className="text-sm font-bold mb-0.5 break-keep" style={{ color: "#0F172A" }}>{title}</p>
      <p className="text-sm break-keep" style={{ color: "#475569" }}>{desc}</p>
    </div>
  );
}
