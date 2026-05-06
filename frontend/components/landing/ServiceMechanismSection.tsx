"use client";

import Link from "next/link";
import { trackDetailsToggle } from "@/lib/analytics";

export default function ServiceMechanismSection() {
  return (
    <section className="bg-white py-10 md:py-14 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        {/* 섹션 타이틀 */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep">
            AEOlab은 어떤 기준으로 도와드리나요?
          </h2>
          <p className="text-base md:text-lg text-gray-600 mt-2 break-keep">
            네이버 공식 노출 조건을 점수화하고, 사장님이 5분 안에 실행하도록 AI가 자동 생성합니다
          </p>
        </div>

        {/* ── 1. 게이트 3조건 ───────────────────────────────────── */}
        <div className="mb-10">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 break-keep">
            <span className="text-blue-600">[1]</span> 노출 가능 여부 — 게이트 3조건
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <GateCard
              num="①"
              title="AI 브리핑 대상 업종"
              active="음식점·카페·베이커리·바·숙박"
              detail="네일·피트니스·약국 등은 ChatGPT·Gemini·Google AI 노출 개선으로 가치 전달"
              color="blue"
            />
            <GateCard
              num="②"
              title="프랜차이즈 가맹점 아님"
              active="개인 사업장만 대상"
              detail="네이버 공식: 프랜차이즈는 현재 제외(추후 확대 예정)"
              color="purple"
            />
            <GateCard
              num="③"
              title="리뷰 수 기준 충족"
              active="영수증 리뷰 10건 이상 권장"
              detail="부족 시 QR 카드 매장 비치 + 리뷰 답변 자동 생성으로 지원"
              color="amber"
            />
          </div>
        </div>

        {/* ── 2. 점수 4항목 100점 ───────────────────────────────── */}
        <div className="mb-10">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 break-keep">
            <span className="text-blue-600">[2]</span> 콘텐츠 점수 100점
          </h3>
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50/40 to-white p-4 md:p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <ScorePill points={25} title="스마트플레이스 등록" desc="자동 감지" />
              <ScorePill points={30} title="네이버 지역검색 순위" desc="실시간 측정" />
              <ScorePill points={25} title="소식 최신성 (30일)" desc="AI 자동 초안" />
              <ScorePill points={20} title="소개글 품질" desc="Q&A 5개 자동 생성" />
            </div>
            <p className="text-base text-gray-600 mt-4 text-center break-keep">
              점수가 높을수록 AI 브리핑 인용 확률이 높아집니다 —{" "}
              <a href="/how-it-works#step2" className="text-blue-600 hover:underline">자세한 내용 보기</a>
            </p>
          </div>
        </div>

        {/* ── 더 자세한 내용은 토글로 접어 모바일 스크롤 부담 감소 ─ */}
        <details
          className="group rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden"
          onToggle={(e) => trackDetailsToggle("service_mechanism", (e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex items-center justify-between gap-3 cursor-pointer list-none p-4 md:p-5 hover:bg-gray-100 transition-colors min-h-[56px]">
            <span className="text-base md:text-lg font-semibold text-gray-900 break-keep">
              더 자세한 동작 원리·정직한 한계·공식 데이터 보기
            </span>
            <span className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>

          <div className="px-4 pb-5 md:px-5 md:pb-6 space-y-6">
            {/* ── 3. 정직한 한계 ───────────────────────────────────── */}
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 break-keep">
                <span className="text-blue-600">[3]</span> 정직한 약속 — 가능 vs 불가능
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5">
                  <p className="text-base md:text-lg font-bold text-emerald-900 mb-3 break-keep">
                    ✅ 가능
                  </p>
                  <ul className="space-y-2 text-base md:text-lg text-gray-700 leading-relaxed">
                    <li>• 노출 조건 점수화 + 자동 콘텐츠 생성</li>
                    <li>• 비대상 업종도 글로벌 AI 노출 개선</li>
                    <li>• 매주 4개 AI 스캔 + 결과 검증</li>
                    <li>• 경쟁사 비교 + 키워드 갭 분석</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 md:p-5">
                  <p className="text-base md:text-lg font-bold text-red-900 mb-3 break-keep">
                    ❌ 불가능
                  </p>
                  <ul className="space-y-2 text-base md:text-lg text-gray-700 leading-relaxed">
                    <li>• 노출 자체를 100% 보장 (네이버 알고리즘 비공개)</li>
                    <li>• 네이버 AI 브리핑 비대상 업종을 대상으로 전환하기</li>
                    <li>• AI 정보 탭 토글을 대신 켜기</li>
                    <li>• 네이버 정책 위반 우회</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ── 네이버 공식 발표 데이터 인용 박스 ───────────────────── */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-blue-900 mb-3 break-keep">
                네이버 공식 발표 데이터 (2025-2026)
              </h3>
              <ul className="space-y-2 text-base md:text-lg text-gray-700 leading-relaxed mb-4">
                <li className="flex gap-2">
                  <span className="shrink-0 text-blue-500 font-bold">•</span>
                  <span>AI 브리핑 사용자 <strong>3,000만명+</strong>, 통합검색 질의 약 <strong>20%</strong> 적용</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-blue-500 font-bold">•</span>
                  <span>음식점 적용 후 — 체류시간 <strong>+10.4%</strong> / 클릭률 <strong>+27.4%</strong> / 예약 <strong>+8%</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-blue-500 font-bold">•</span>
                  <span>숙박 <strong>1만 5천 개</strong> 업체 적용 (2026년 기준)</span>
                </li>
              </ul>
              <p className="text-sm text-gray-500 leading-relaxed break-keep">
                데이터는 네이버 공식 발표 기준이며 실제 결과는 업종·지역에 따라 다를 수 있습니다.
                <span className="ml-1">
                  출처:{" "}
                  <a
                    href="https://www.mt.co.kr/tech/2026/04/07/2026040709261836765"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    네이버 공식 발표
                  </a>
                </span>
              </p>
            </div>

            {/* ── 매뉴얼 페이지 CTA ───────────────────────────────────── */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 md:p-6 text-center">
              <p className="text-lg md:text-xl text-white font-semibold mb-1 break-keep">
                동작 원리·요금제별 기능·역할 분담까지 — 5분 안에 모두 이해할 수 있습니다
              </p>
              <p className="text-base md:text-lg text-blue-100 mb-4 break-keep">
                매뉴얼 페이지에서 9개 섹션 종합 안내(목차 + 앵커 점프 지원)
              </p>
              <Link
                href="/how-it-works"
                className="inline-block bg-white text-blue-700 text-base md:text-lg font-bold px-7 py-3 rounded-xl hover:bg-blue-50 transition-colors"
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
  color: "blue" | "purple" | "amber";
}

function GateCard({ num, title, active, detail, color }: GateCardProps) {
  const colorMap = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-700",   numBg: "bg-blue-100",   numText: "text-blue-700"   },
    purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", numBg: "bg-purple-100", numText: "text-purple-700" },
    amber:  { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  numBg: "bg-amber-100",  numText: "text-amber-700"  },
  }[color];

  return (
    <div className={`rounded-xl border ${colorMap.border} ${colorMap.bg} p-4 md:p-5`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg md:text-xl font-bold w-9 h-9 rounded-full ${colorMap.numBg} ${colorMap.numText} flex items-center justify-center shrink-0`}>
          {num}
        </span>
        <p className="text-base md:text-lg font-bold text-gray-900 break-keep">{title}</p>
      </div>
      <p className={`text-base md:text-lg font-semibold mb-1.5 ${colorMap.text} break-keep`}>{active}</p>
      <p className="text-base text-gray-700 leading-relaxed break-keep">{detail}</p>
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
    <div className="rounded-xl bg-white border border-blue-100 p-3 md:p-4 text-center">
      <p className="text-3xl md:text-4xl font-bold text-blue-600 mb-1">{points}<span className="text-base md:text-lg font-normal text-gray-500">점</span></p>
      <p className="text-base md:text-lg font-semibold text-gray-900 mb-0.5 break-keep">{title}</p>
      <p className="text-sm md:text-base text-gray-600 break-keep">{desc}</p>
    </div>
  );
}
