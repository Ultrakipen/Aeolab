import Link from "next/link"
import type { Metadata } from "next"
import { SiteFooter } from "@/components/common/SiteFooter"

export const metadata: Metadata = {
  title: "AEOlab은 어떻게 네이버 AI 브리핑 노출을 도와주나요? | AEOlab",
  description:
    "AEOlab의 네이버 AI 브리핑 노출 지원 기준을 처음부터 끝까지 설명합니다. 게이트 3조건, 점수 100점 4항목, 5단계 행동, AEOlab과 사장님 역할 분담, 요금제별 기능, 한계까지.",
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">AEOlab</Link>
          <div className="flex items-center gap-3 md:gap-4">
            <Link href="/faq" className="hidden md:block text-sm text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/pricing" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">요금제</Link>
            <Link href="/trial" className="bg-blue-600 text-white text-sm md:text-base px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              무료 진단
            </Link>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* ─── Hero ─── */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight break-keep">
          AEOlab은 어떻게 내 가게의<br className="hidden md:block" />
          네이버 AI 브리핑 노출을 도와주나요?
        </h1>
        <p className="text-base md:text-lg text-gray-600 mb-2 leading-relaxed break-keep">
          이 페이지는 <strong>AEOlab의 동작 원리·도움 범위·한계</strong>를 빠짐없이 설명하는 매뉴얼입니다.
          소상공인이 5분 안에 서비스 가치를 정확히 이해할 수 있도록 작성했습니다.
        </p>
        <p className="text-sm md:text-base text-gray-500 mb-8">
          마지막 업데이트: 2026-05-01 · 출처:{" "}
          <a
            href="https://help.naver.com/service/30026/contents/24632"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            네이버 스마트플레이스 공식 안내
          </a>
        </p>

        {/* ─── 한 줄 요약 ─── */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5 md:p-6 mb-6">
          <p className="text-base md:text-lg text-gray-900 leading-relaxed break-keep">
            <strong>한 줄 요약:</strong> 네이버가 공개한 노출 4요소(소개글·소식·리뷰·블로그)와
            게이트 3조건(업종·프랜차이즈·리뷰수)을 점수화하고, 사장님이 5분 안에 실행할 수
            있도록 AI가 콘텐츠 초안을 자동 생성합니다. 매주 실제 노출 결과를 검증합니다.
          </p>
          <p className="text-sm md:text-base text-gray-700 mt-3 leading-relaxed break-keep">
            광고처럼 노출을 사는 게 아니라, <strong>노출 조건을 채우는 일을 자동화</strong>하는 서비스입니다.
          </p>
        </div>

        {/* ─── 지금 바로 알아야 할 3가지 — 이탈 전 핵심 ─── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-10">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">시간이 없다면 이것만 — 3가지 핵심</p>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-start gap-3 px-4 py-3.5">
              <span className="shrink-0 text-lg mt-0.5">📍</span>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-800">내 업종에 따라 점수 기준이 다릅니다</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">음식점·카페는 네이버 AI 브리핑 비중이 70%, 법률·교육·온라인몰은 ChatGPT·Google AI 비중이 60~90%입니다. 같은 점수라도 업종이 다르면 개선 방향이 다릅니다.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3.5">
              <span className="shrink-0 text-lg mt-0.5">📊</span>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-800">성장 단계는 네이버 채널 점수만으로 결정됩니다</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">대시보드의 통합 점수(예: 62점)와 성장 단계(예: 시작 단계)가 달라 보일 수 있습니다. 업종별 비율 차이를 보정하기 위해 성장 단계는 네이버 채널 점수만 기준으로 판정합니다.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3.5">
              <span className="shrink-0 text-lg mt-0.5">⚡</span>
              <div>
                <p className="text-sm md:text-base font-semibold text-gray-800">지금 당장 점수를 올리는 가장 빠른 방법</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">스마트플레이스 <strong>소개글 작성(+20점)</strong> + <strong>소식 탭 최근 게시물(+25점)</strong>. 두 항목만 완성해도 최대 +45점 가능합니다. 광고비 없이 콘텐츠만으로 가능한 가장 확실한 개선입니다.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── TOC ─── */}
        <nav className="bg-gray-50 rounded-xl p-5 mb-10">
          <p className="text-sm font-semibold text-gray-700 mb-3">목차</p>
          <ol className="space-y-1.5 text-sm md:text-base text-blue-600">
            <li><a href="#search-intent" className="hover:underline">어떤 검색에서 AI 브리핑이 노출될까?</a></li>
            <li><a href="#step1" className="hover:underline">1단계. 게이트 3조건 (노출 가능 여부)</a></li>
            <li><a href="#step2" className="hover:underline">2단계. 콘텐츠 점수 100점 (Track1 = 네이버)</a></li>
            <li><a href="#step3" className="hover:underline">3단계. AI 브리핑 인용 강화 (콘텐츠 품질)</a></li>
            <li><a href="#step4" className="hover:underline">4단계. AI 정보 탭 토글 추적</a></li>
            <li><a href="#phase-a" className="hover:underline">Phase A. AI 검색 노출을 위한 통합 측정</a></li>
            <li><a href="#step5" className="hover:underline">5단계. 결과 측정 (실제 노출 확인)</a></li>
            <li><a href="#dia" className="hover:underline">AI가 평가하는 5요소 + 2026 변화</a></li>
            <li><a href="#plans" className="hover:underline">요금제별 사용 가능 기능</a></li>
            <li><a href="#roles" className="hover:underline">AEOlab vs 사장님 역할 분담</a></li>
            <li><a href="#limits" className="hover:underline">한계와 면책 — 정직한 약속</a></li>
            <li><a href="#start" className="hover:underline">시작하는 법</a></li>
          </ol>
        </nav>

        {/* ─── §3.7 검색 의도 분류 ─── */}
        <section id="search-intent" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            어떤 검색에서 AI 브리핑이 노출될까?
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            모든 검색 쿼리에서 AI 브리핑이 노출되는 것은 아닙니다. 검색 의도(Intent)에 따라 노출 여부가 달라집니다.
          </p>

          {/* PC: 테이블 / 모바일: 카드 */}
          <div className="hidden md:block overflow-x-auto mb-4">
            <table className="w-full text-sm md:text-base border-collapse min-w-[540px]">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-800 border-b border-blue-200">검색 유형</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-800 border-b border-blue-200">예시</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-800 border-b border-blue-200">AI 브리핑 노출</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-green-50/40">
                  <td className="py-3 px-4 align-top font-medium text-gray-900">정보형</td>
                  <td className="py-3 px-4 align-top text-gray-700">"강남 데이트 맛집", "부산 오션뷰 호텔"</td>
                  <td className="py-3 px-4 align-top text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      노출 가능
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-amber-50/40">
                  <td className="py-3 px-4 align-top font-medium text-gray-900">탐색형</td>
                  <td className="py-3 px-4 align-top text-gray-700">"스타벅스 강남점", "롯데호텔 서울"</td>
                  <td className="py-3 px-4 align-top text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold">
                      제한적
                    </span>
                  </td>
                </tr>
                <tr className="bg-red-50/30">
                  <td className="py-3 px-4 align-top font-medium text-gray-900">거래형</td>
                  <td className="py-3 px-4 align-top text-gray-700">"스타벅스 예약", "호텔 바로 예약"</td>
                  <td className="py-3 px-4 align-top text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-sm font-semibold">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      노출 안 됨
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 형태 */}
          <div className="md:hidden space-y-3 mb-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">정보형</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  노출 가능
                </span>
              </div>
              <p className="text-sm text-gray-600 break-keep">"강남 데이트 맛집", "부산 오션뷰 호텔"</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">탐색형</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold">제한적</span>
              </div>
              <p className="text-sm text-gray-600 break-keep">"스타벅스 강남점", "롯데호텔 서울"</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">거래형</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-sm font-semibold">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  노출 안 됨
                </span>
              </div>
              <p className="text-sm text-gray-600 break-keep">"스타벅스 예약", "호텔 바로 예약"</p>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 md:p-4 text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            따라서 AEOlab은 <strong>정보형 검색 쿼리에서의 노출을 집중 분석합니다.</strong>
            "우리 동네 맛집", "근처 카페 추천"처럼 AI가 다양한 옵션을 제안하는 검색에서 사업장이 먼저 언급되도록 최적화합니다.
          </div>
        </section>

        {/* ─── §3.6 네이버 공식 발표 데이터 인용 박스 ─── */}
        <div className="mb-10 rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-6">
          <h3 className="text-sm md:text-base font-bold text-blue-900 mb-3 break-keep">
            네이버 공식 발표 데이터 (2025-2026)
          </h3>
          <ul className="space-y-2 text-sm md:text-base text-gray-700 leading-relaxed mb-4">
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
          <p className="text-sm text-gray-400 leading-relaxed break-keep">
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

        {/* ─── 1단계: 게이트 ─── */}
        <section id="step1" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            1단계. 게이트 3조건 — 노출 가능 여부 먼저 확인
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            네이버 AI 브리핑은 모든 가게에 노출되지 않습니다. 아래 3가지 조건 중 하나라도 안 되면
            콘텐츠가 아무리 좋아도 노출되지 않으므로, AEOlab은 가장 먼저 이를 점검합니다.
          </p>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm md:text-base border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left py-3 px-3 font-semibold text-gray-800 border-b border-blue-200">게이트</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-800 border-b border-blue-200">AEOlab이 하는 일</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-800 border-b border-blue-200">사장님이 해야 하는 일</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-3 align-top">
                    <strong>① 노출 가능 업종?</strong>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">음식점·카페·베이커리·바·숙박</p>
                  </td>
                  <td className="py-3 px-3 align-top text-gray-700">업종 선택 시 자동 판정. 비대상 업종은 대시보드에 안내 배너 표시 + 글로벌 AI 채널로 가치 전달</td>
                  <td className="py-3 px-3 align-top text-gray-700">업종 선택</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-3 align-top">
                    <strong>② 프랜차이즈 가맹점 아님?</strong>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">네이버 공식: 프랜차이즈는 현재 제외</p>
                  </td>
                  <td className="py-3 px-3 align-top text-gray-700">체크하면 자동 INACTIVE 처리 + 대체 채널(글로벌 AI) 노출 개선으로 전환</td>
                  <td className="py-3 px-3 align-top text-gray-700">사업장 등록 시 체크박스로 답변</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 align-top">
                    <strong>③ 리뷰 수 기준 충족?</strong>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">영수증 리뷰 10건 이상 권장</p>
                  </td>
                  <td className="py-3 px-3 align-top text-gray-700">리뷰 수 자동 추적. 10건 미만 시 5단계 가이드에서 경고 + QR 카드 다운로드 제공</td>
                  <td className="py-3 px-3 align-top text-gray-700">QR 카드를 매장에 비치해 리뷰 유도</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3 md:p-4 text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            <strong>게이트 통과 못한 경우:</strong> AEOlab은 거짓 약속 대신 ChatGPT·Gemini·Google AI Overview·카카오맵
            노출 개선으로 가치를 전달합니다. 비대상 업종도 구독 가치는 동일합니다.
          </div>
        </section>

        {/* ─── 2단계: 점수 100점 (현재 v3.0 5항목 / v3.1 6항목 예정) ─── */}
        <section id="step2" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            2단계. 콘텐츠 점수 100점 — Track1(네이버) 5항목 <span className="text-sm font-normal text-gray-400">(v3.1에서 6항목으로 확장 예정)</span>
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            현재 v3.0 모델(5항목)이 적용 중입니다. 베타 사용자 5명+ 데이터 확보 후 v3.1 모델로 전환되며,
            사용자 그룹(ACTIVE/LIKELY/INACTIVE)에 따라 가중치를 자동 재분배할 예정입니다.
            AI 브리핑 비대상 업종이라도 점수상 불이익이 없도록 키워드 검색·스마트플레이스로 보강합니다.
          </p>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs sm:text-sm uppercase text-gray-500">
                  <th className="px-3 py-2 font-medium">항목</th>
                  <th className="px-3 py-2 font-medium text-center">ACTIVE</th>
                  <th className="px-3 py-2 font-medium text-center">LIKELY</th>
                  <th className="px-3 py-2 font-medium text-center">INACTIVE</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">측정 방법</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">네이버 키워드 검색 노출 (신규)</td>
                  <td className="px-3 py-2 text-center">25%</td>
                  <td className="px-3 py-2 text-center">30%</td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700">35%</td>
                  <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-500">사장님이 등록한 키워드 PC/모바일/플레이스 순위 (Playwright 실측)</td>
                </tr>
                <tr className="border-t border-gray-100 bg-gray-50/40">
                  <td className="px-3 py-2 font-medium">리뷰 품질</td>
                  <td className="px-3 py-2 text-center">15%</td>
                  <td className="px-3 py-2 text-center">17%</td>
                  <td className="px-3 py-2 text-center">20%</td>
                  <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-500">리뷰수·평점·영수증 리뷰·최신성</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">스마트플레이스 완성도</td>
                  <td className="px-3 py-2 text-center">15%</td>
                  <td className="px-3 py-2 text-center">18%</td>
                  <td className="px-3 py-2 text-center">20%</td>
                  <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-500">소개글·소식·메뉴·사진·영업시간 + 키워드 콘텐츠 매칭</td>
                </tr>
                <tr className="border-t border-gray-100 bg-gray-50/40">
                  <td className="px-3 py-2 font-medium">블로그 생태계 (C-rank 추정)</td>
                  <td className="px-3 py-2 text-center">10%</td>
                  <td className="px-3 py-2 text-center">10%</td>
                  <td className="px-3 py-2 text-center">10%</td>
                  <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-500">30일 내 발행 + 외부 인용 + 업체명 매칭</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">지도/플레이스 + 카카오맵</td>
                  <td className="px-3 py-2 text-center">10%</td>
                  <td className="px-3 py-2 text-center">10%</td>
                  <td className="px-3 py-2 text-center">15%</td>
                  <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-500">네이버 지도 순위 50% + 카카오맵 50%</td>
                </tr>
                <tr className="border-t border-gray-100 bg-gray-50/40">
                  <td className="px-3 py-2 font-medium">AI 브리핑 인용</td>
                  <td className="px-3 py-2 text-center font-bold text-emerald-700">25%</td>
                  <td className="px-3 py-2 text-center">15%</td>
                  <td className="px-3 py-2 text-center text-gray-400">0%</td>
                  <td className="px-3 py-2 hidden md:table-cell text-sm text-gray-500">Gemini·Naver 스캐너 실측 + 토글 ON 여부</td>
                </tr>
                <tr className="border-t-2 border-gray-300 font-semibold bg-blue-50">
                  <td className="px-3 py-2">합계</td>
                  <td className="px-3 py-2 text-center">100%</td>
                  <td className="px-3 py-2 text-center">100%</td>
                  <td className="px-3 py-2 text-center">100%</td>
                  <td className="px-3 py-2 hidden md:table-cell"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-3">
            <p className="text-sm text-amber-900 leading-relaxed">
              ※ 키워드 순위·AI 인용 등 변동 데이터는 측정 시점·기기·검색 환경에 따라 달라질 수 있습니다.
              AEOlab은 서울 기준 비로그인 PC/모바일로 측정합니다. (가짜 수치 표시 금지)
            </p>
          </div>

          <p className="text-sm md:text-base text-gray-600 leading-relaxed break-keep">
            점수 산출 상세는{" "}
            <Link href="/score-guide" className="text-blue-600 hover:underline font-medium">
              점수 계산 가이드
            </Link>
            를 참고하세요.
          </p>
        </section>

        {/* ─── 3단계: 콘텐츠 인용 강화 ─── */}
        <section id="step3" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            3단계. AI 브리핑 노출 강화 — 콘텐츠 품질
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            네이버 공식: AI 브리핑은 <strong>소개글·소식·리뷰·연계 블로그</strong>의 텍스트를 주요 정보 소스로 활용합니다.
            따라서 이 4가지 텍스트의 <strong>AI 친화적 구조</strong>가 핵심입니다.
          </p>

          <div className="space-y-3 mb-4">
            <ContentCard
              icon="📝"
              title="소개글"
              detail="Claude Sonnet이 Q&A 5개를 자연스럽게 삽입하고 키워드·USP·서비스를 명시합니다. 네이버 블로그 분석에 따르면 'FAQ 구조 + 즉답형 첫 문단'이 AI 브리핑 인용 후보로 적합합니다. 스마트플레이스 사장님 Q&A 탭이 폐기된 현재(2026-05), 소개글 안의 Q&A 섹션이 사장님이 직접 컨트롤할 수 있는 가장 효과적인 인용 경로입니다."
            />
            <ContentCard
              icon="📰"
              title="소식"
              detail="30일 주기로 자동 초안을 작성합니다. 사장님은 1분 만에 복사·등록만 하면 최신성 점수가 유지됩니다."
            />
            <ContentCard
              icon="⭐"
              title="리뷰"
              detail="QR 카드(매장 비치용) 자동 생성 + 리뷰 답변 자동 작성으로 리뷰 수·다양성·반응성을 모두 강화합니다."
            />
            <ContentCard
              icon="📚"
              title="연계 블로그"
              detail="블로그 URL 입력 시 키워드 매칭·C-rank 평가를 진행해 '이 키워드를 보강하라'는 가이드를 제공합니다."
            />
          </div>
        </section>

        {/* ─── 4단계: 토글 추적 ─── */}
        <section id="step4" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            4단계. AI 정보 탭 토글 추적
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            네이버 공식: 사장님이 <strong>스마트플레이스 → 업체정보 → AI 정보</strong> 탭에서
            토글을 직접 ON으로 설정해야 노출됩니다(설정 후 1일 이내 반영). AEOlab은 상태를 추적하고
            안내할 뿐, <strong>대신 ON 할 수 없습니다.</strong>
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b">상태</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b">의미</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-700 border-b">AEOlab의 안내</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 font-mono text-sm">not_visible</td><td className="py-2.5 px-3">메뉴 자체 없음</td><td className="py-2.5 px-3 text-gray-600">비대상 업종 안내</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 font-mono text-sm">off</td><td className="py-2.5 px-3">사장님 OFF</td><td className="py-2.5 px-3 text-gray-600">5단계 가이드 단계 2로 유도</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 font-mono text-sm">on</td><td className="py-2.5 px-3">사장님 ON</td><td className="py-2.5 px-3 text-gray-600">정상 — 콘텐츠 점수에 집중</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3 font-mono text-sm">disabled</td><td className="py-2.5 px-3">조건 미달로 비활성</td><td className="py-2.5 px-3 text-gray-600">리뷰 수 등 조건 안내</td></tr>
                <tr><td className="py-2.5 px-3 font-mono text-sm">unknown</td><td className="py-2.5 px-3">미확인</td><td className="py-2.5 px-3 text-gray-600">사장님 자기 보고 요청</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── Phase A: 통합 측정 ─── */}
        <section id="phase-a" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            Phase A. AI 검색 노출을 위한 통합 측정
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            단순 점수 산출을 넘어 <strong>키워드 검색 순위·FAQ 자동 생성·블로그 지수</strong>를 통합 측정합니다.
            각 기능은 플랜별로 측정 주기와 한도가 다릅니다.
          </p>

          <div className="space-y-4 mb-6">
            {/* 1. 키워드 검색 순위 추적 */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 md:p-5">
              <div className="flex items-start gap-3 mb-2">
                <span className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">1</span>
                <h3 className="text-base md:text-lg font-bold text-gray-900 break-keep">네이버 키워드 검색 순위 추적</h3>
              </div>
              <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed break-keep">
                사장님이 등록한 키워드를 Playwright로 PC·모바일·플레이스 탭에서 각각 실측합니다.
                순위가 ±3 이상 변동하거나 TOP10 진입·이탈 시 카카오 알림을 발송합니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[480px]">
                  <thead>
                    <tr className="bg-white/80">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b border-blue-100">플랜</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-700 border-b border-blue-100">측정 주기</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 border-b border-blue-100">비고</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr className="border-b border-blue-50"><td className="py-2 px-3">Free</td><td className="py-2 px-3 text-center">월 1회</td><td className="py-2 px-3 text-gray-500">수동 스캔 시에만</td></tr>
                    <tr className="border-b border-blue-50"><td className="py-2 px-3">Basic</td><td className="py-2 px-3 text-center">주 1회</td><td className="py-2 px-3 text-gray-500">매주 월요일 04:00 자동</td></tr>
                    <tr className="border-b border-blue-50"><td className="py-2 px-3">Pro</td><td className="py-2 px-3 text-center">매일</td><td className="py-2 px-3 text-gray-500">매일 04:30 자동</td></tr>
                    <tr><td className="py-2 px-3">Biz / Enterprise</td><td className="py-2 px-3 text-center">6시간 / 시간</td><td className="py-2 px-3 text-gray-500">서버 업그레이드 후 순차 적용</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. 키워드 자동 추천 */}
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 md:p-5">
              <div className="flex items-start gap-3 mb-2">
                <span className="shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">2</span>
                <h3 className="text-base md:text-lg font-bold text-gray-900 break-keep">키워드 자동 추천</h3>
              </div>
              <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed break-keep">
                Claude Haiku가 업종·지역·리뷰 키워드를 분석해 최적의 검색 키워드를 추천합니다.
                사업장 등록·수정 시 또는 대시보드에서 요청할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600">Free: 월 1회</span>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700">Basic: 월 1회</span>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700">Pro: 월 4회</span>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">Biz: 월 10회</span>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">Enterprise: 무제한</span>
              </div>
            </div>

            {/* 3. 톡톡 채팅방 메뉴 자동 생성 */}
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 md:p-5">
              <div className="flex items-start gap-3 mb-2">
                <span className="shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">3</span>
                <h3 className="text-base md:text-lg font-bold text-gray-900 break-keep">톡톡 채팅방 메뉴 자동 생성</h3>
              </div>
              <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed break-keep">
                톡톡 채팅방 하단에 노출되는 메뉴 6개를 자동 생성합니다.
                메뉴 클릭 시 메시지 또는 URL 실행을 선택할 수 있어, 예약·메뉴·블로그로 즉시 연결됩니다.
                채팅방 메뉴는 챗봇 UI 안에서 작동하므로 AI 브리핑 노출보다는
                <strong> 고객 응대 자동화 + 사장님이 작성한 텍스트의 노출 확대</strong> 효과가 핵심입니다.
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500">Free: 0건/월</span>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700">Basic: 5건/월</span>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700">Pro: 무제한</span>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">Biz: 무제한</span>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">Enterprise: 무제한</span>
              </div>
            </div>

            {/* 4. 블로그 C-rank 추정 */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 md:p-5">
              <div className="flex items-start gap-3 mb-2">
                <span className="shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">4</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 break-keep">블로그 C-rank 추정</h3>
                  <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full font-medium">(추정)</span>
                </div>
              </div>
              <p className="text-sm md:text-base text-gray-700 mb-2 leading-relaxed break-keep">
                네이버 블로그 C-rank는 비공개 지수입니다. AEOlab은 <strong>30일 발행 빈도·외부 인용·업체명 매칭</strong>
                3가지를 실측해 C-rank를 추정합니다. 실제 C-rank와 오차가 발생할 수 있습니다.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-700 mb-2">
                <li>30일 내 블로그 발행 건수 (직접 발행 + 체험단)</li>
                <li>외부 사이트에서 블로그 인용 횟수</li>
                <li>업체명이 키워드로 포함된 포스트 비율</li>
              </ul>
              <p className="text-sm text-amber-800 bg-amber-100 rounded px-3 py-2 leading-relaxed">
                이 수치에는 <strong>(추정)</strong> 배지가 표시됩니다. 실제 네이버 C-rank와 다를 수 있으며,
                참고 지표로만 활용하세요.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 md:p-4 text-sm md:text-base text-gray-600 leading-relaxed break-keep">
            <strong>면책:</strong> 키워드 순위·AI 인용 횟수 등 모든 변동 데이터는 측정 시점·기기·검색 환경(로그인 여부, 지역 설정)에
            따라 달라질 수 있습니다. AEOlab은 서울 기준 비로그인 PC/모바일로 측정합니다.
          </div>
        </section>

        {/* ─── 5단계: 결과 측정 ─── */}
        <section id="step5" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            5단계. 결과 측정 — 실제 노출 확인
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            매주 자동으로 다음을 확인해 <strong>실제로 노출되었는지 객관적으로 측정</strong>합니다.
            점수만 올리는 게 아니라 결과를 검증합니다.
          </p>
          <ul className="space-y-3 text-sm md:text-base text-gray-700 leading-relaxed">
            <li className="flex gap-3">
              <span className="text-blue-500 shrink-0">●</span>
              <div>
                <strong>네이버 AI 브리핑 DOM 파싱</strong> (Playwright) — 가게명 검색 시 브리핑 영역에 노출되는지 직접 확인
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 shrink-0">●</span>
              <div>
                <strong>AI 인용 실증</strong> — 어떤 키워드로 어떻게 인용됐는지 누적 (ChatGPT·Gemini·Google·네이버)
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 shrink-0">●</span>
              <div>
                <strong>30일 점수 추세</strong> — 사장님의 개선 행동이 점수에 반영되는지 검증
              </div>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-500 shrink-0">●</span>
              <div>
                <strong>경쟁사 비교</strong> — 같은 업종·지역의 상위 10% 사업장과 갭 분석
              </div>
            </li>
          </ul>
        </section>

        {/* ─── D.I.A. 5요소 + 2026 변화 ─── */}
        <section id="dia" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            AI가 평가하는 5요소(D.I.A.) + 2026 변화
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            네이버 AI 브리핑은 C-rank 위에 <strong>D.I.A.(Deep Intent Analysis)</strong> 알고리즘으로
            콘텐츠의 5가지 측면을 딥러닝으로 평가합니다. 이 5요소가 충족될수록 인용 확률이 높아집니다.
          </p>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed break-keep bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            ※ D.I.A. 5요소는 네이버 비공개 알고리즘을 외부 분석 기반으로 추정한 것입니다. 실제 평가 방식과 다를 수 있습니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-900 mb-1">1. 주제 적합도</p>
              <p className="text-sm md:text-base text-gray-700 break-keep">
                검색 키워드와 콘텐츠 주제가 얼마나 정확히 일치하는가. AEOlab은 업종별 의미 클러스터(LSI)
                연관 키워드를 자동 추천해 적합도를 강화합니다.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-900 mb-1">2. 경험 정보</p>
              <p className="text-sm md:text-base text-gray-700 break-keep">
                실제 방문·이용 경험에서 비롯된 정보인가. 영수증 리뷰·사장님 답변 등 실증 데이터를 우선 평가합니다.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-900 mb-1">3. 정보 충실성</p>
              <p className="text-sm md:text-base text-gray-700 break-keep">
                가격·시간·조건 등 구체 수치가 명시되어 있는가. AEOlab의 FAQ 자동 생성은 첫 문장을 30~60자
                즉답형으로 작성하도록 가이드합니다.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-900 mb-1">4. 독창성</p>
              <p className="text-sm md:text-base text-gray-700 break-keep">
                다른 사업장과 차별화된 표현·관점이 있는가. 사장님이 직접 채워야 할 USP(고유 강점) 영역으로,
                AEOlab 초안의 [직접 입력] 플레이스홀더에 본인의 특징을 추가하세요.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 md:col-span-2">
              <p className="font-semibold text-gray-900 mb-1">5. 적시성</p>
              <p className="text-sm md:text-base text-gray-700 break-keep">
                정보가 최신인가, 정기적으로 업데이트되는가. AEOlab은 블로그 초안에
                <strong> &ldquo;[YYYY년 M월 업데이트]&rdquo; 표기</strong>를 자동 삽입하고, 소식 7일 이상 미업데이트 시 알림을 보냅니다.
              </p>
            </div>
          </div>

          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-keep">
            2026년 변화 — 미리 대비하세요
          </h3>
          <ul className="space-y-2 text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
            <li>
              <strong>2026-04-06 별점 도입</strong> — 5점 척도 별점이 리뷰 옆에 표시됩니다.
              일반 공개 여부는 <strong>사업주가 스마트플레이스에서 직접 선택</strong>합니다.
            </li>
            <li>
              <strong>네이버 통합검색 별도 &lsquo;AI 탭&rsquo; 2026년 4월 베타 공개</strong> — 연속적 대화형 검색이 별도 탭으로 분리되어 AI 브리핑 노출 영역이 더 커집니다.
              현재 네이버플러스 멤버십 우선 공개 중이며, 상반기 내 전체 이용자 확대 예정입니다.
            </li>
            <li>
              <strong>인용 콘텐츠 배지</strong> — AI 브리핑에 인용된 블로그·콘텐츠에 배지가 표시되어
              추가 트래픽이 유입됩니다. <strong>사장님 자체 블로그 운영의 가치가 높아집니다.</strong>
            </li>
          </ul>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 md:p-4 text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            <strong>지금 해야 할 일:</strong> ① 사장님 블로그에 가게 소개 글을 1편 발행(AEOlab 초안 활용)
            ② 매월 1회 업데이트로 적시성 신호 유지 ③ Q&A 답변 첫 문장을 30~60자 즉답형으로 작성.
            세 가지가 2026년 AI 탭 시대의 인용 배지 후보 자격이 됩니다.
          </div>
        </section>

        {/* ─── 요금제별 기능 ─── */}
        <section id="plans" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            요금제별 사용 가능 기능
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            요금제마다 자동화 도구의 사용 한도가 다릅니다. 모든 요금제는 점수 측정·게이트 점검·결과 검증을 포함합니다.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">기능</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Free</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Basic<br /><span className="text-xs font-normal">9,900원</span></th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Pro<br /><span className="text-xs font-normal">18,900원</span></th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-800 border-b border-blue-200">Biz<br /><span className="text-xs font-normal">49,900원</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">무료 진단(1회)</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">매주 자동 스캔 (4개 AI)</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">소개글 AI 자동 생성</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5">월 5회</td><td className="text-center py-2.5">월 20회</td><td className="text-center py-2.5">무제한</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">톡톡 채팅방 메뉴 AI 생성</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5">월 5회</td><td className="text-center py-2.5">월 20회</td><td className="text-center py-2.5">무제한</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">소식 자동 초안 (매주)</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">리뷰 답변 생성</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5">월 10회</td><td className="text-center py-2.5">월 30회</td><td className="text-center py-2.5">무제한</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">QR 리뷰 카드 다운로드</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td><td className="text-center py-2.5">✅</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2.5 px-3">경쟁사 분석</td><td className="text-center py-2.5 text-gray-400">—</td><td className="text-center py-2.5">3개</td><td className="text-center py-2.5">10개</td><td className="text-center py-2.5">무제한</td></tr>
                <tr><td className="py-2.5 px-3">멀티 사업장</td><td className="text-center py-2.5">1개</td><td className="text-center py-2.5">1개</td><td className="text-center py-2.5">1개</td><td className="text-center py-2.5">5개</td></tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm md:text-base text-gray-600 leading-relaxed break-keep">
            전체 요금제 비교는{" "}
            <Link href="/pricing" className="text-blue-600 hover:underline font-medium">요금제 페이지</Link>를,
            창업패키지·Enterprise 정보는 직접 문의 부탁드립니다.
          </p>
        </section>

        {/* ─── 역할 분담 ─── */}
        <section id="roles" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            AEOlab vs 사장님 — 역할 분담
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            AEOlab은 사장님의 시간을 줄이는 도구이지, 사장님의 권한을 대신하는 시스템이 아닙니다.
            아래 분담을 명확히 인지하시면 가장 효율적으로 사용할 수 있습니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-5">
              <h3 className="text-base md:text-lg font-bold text-blue-900 mb-3">AEOlab이 하는 일</h3>
              <ul className="space-y-2 text-sm md:text-base text-gray-700 leading-relaxed">
                <li>✅ 노출 조건 4요소 점수화·시각화</li>
                <li>✅ AI 콘텐츠 초안 자동 생성 (소개글·채팅방 메뉴 + 소개글 Q&A·소식)</li>
                <li>✅ 매주 4개 AI 스캔 + 결과 추적</li>
                <li>✅ 경쟁사 비교 + 키워드 갭 분석</li>
                <li>✅ 카카오 알림 + 이메일 다이제스트</li>
                <li>✅ QR 카드·리뷰 답변 도구 제공</li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5">
              <h3 className="text-base md:text-lg font-bold text-amber-900 mb-3">사장님이 하는 일</h3>
              <ul className="space-y-2 text-sm md:text-base text-gray-700 leading-relaxed">
                <li>📝 AI 정보 탭 토글 ON 직접 설정</li>
                <li>📝 자동 생성된 소개글 복사·붙여넣기</li>
                <li>📝 자동 초안 소식을 1분 만에 등록</li>
                <li>📝 QR 카드 출력해 매장에 비치</li>
                <li>📝 자동 생성된 리뷰 답변 검토·등록</li>
                <li>📝 프랜차이즈 여부 정직히 답변</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ─── 한계와 면책 ─── */}
        <section id="limits" className="mb-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            한계와 면책 — 정직한 약속
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
            네이버 알고리즘은 비공개이며 외부 도구가 노출 자체를 보장할 수 없습니다.
            AEOlab은 다음을 정직하게 명시합니다.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-semibold text-green-700 border-b">가능</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-red-700 border-b">불가능</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 px-3 align-top">노출 조건 점수화 + 자동 콘텐츠 생성</td>
                  <td className="py-2.5 px-3 align-top text-gray-700"><strong>노출 자체를 보장</strong> (네이버 알고리즘 비공개)</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 px-3 align-top">비대상 업종에 대해 글로벌 AI 노출 개선</td>
                  <td className="py-2.5 px-3 align-top text-gray-700">비대상 업종을 ACTIVE로 만들기</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 px-3 align-top">사장님 5단계 행동 가이드</td>
                  <td className="py-2.5 px-3 align-top text-gray-700">AI 정보 탭 토글을 대신 켜기</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2.5 px-3 align-top">리뷰 유도 도구(QR·답변 생성)</td>
                  <td className="py-2.5 px-3 align-top text-gray-700">리뷰 수 조작</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 align-top">콘텐츠 품질 개선 (C-rank 향상)</td>
                  <td className="py-2.5 px-3 align-top text-gray-700">네이버 정책 위반 우회</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 md:p-4 text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            <strong>업종 안내:</strong> 병원·법무·교육·쇼핑몰·사진/영상/디자인·프랜차이즈는 현재 네이버 AI
            브리핑 비대상입니다. 그러나 ChatGPT·Gemini·Google AI Overview·카카오맵 등 다른 채널의 AI 가시성은
            AEOlab으로 동일하게 향상됩니다. 구독 전{" "}
            <Link href="/trial" className="text-blue-600 hover:underline font-medium">무료 진단</Link>으로
            자신의 업종을 확인하세요.
          </div>

          <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-3 md:p-4 text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            <strong>2026-04-06 별점 도입 안내:</strong> 네이버는 2026년 4월 6일부터 플레이스 리뷰에
            5점 척도 별점을 도입했습니다. 별점의 일반 이용자 공개 여부는 사업주가 스마트플레이스에서
            직접 선택할 수 있으며, 측정 시점·기기·로그인 상태에 따라 표시가 달라질 수 있습니다.
            초기 3개월간 작성자·사업주에게만 공개 → 이후 전체 이용자 공개 (어뷰징 방지)
          </div>
        </section>

        {/* ─── 시작하는 법 ─── */}
        <section id="start" className="mb-8 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 break-keep">
            시작하는 법
          </h2>
          <ol className="space-y-3 text-sm md:text-base text-gray-700 leading-relaxed mb-6">
            <li>
              <strong>1.</strong>{" "}
              <Link href="/trial" className="text-blue-600 hover:underline font-medium">무료 진단</Link>{" "}
              — 비로그인으로 가게 이름·업종만 입력하면 1분 만에 현재 점수 확인
            </li>
            <li>
              <strong>2.</strong>{" "}
              <Link href="/pricing" className="text-blue-600 hover:underline font-medium">요금제 보기</Link>{" "}
              — Basic 첫 달 50% 할인(4,950원)으로 시작
            </li>
            <li>
              <strong>3.</strong>{" "}
              가입 후 대시보드 → <strong>AI 브리핑 5단계 가이드</strong>를 따라 15분간 설정
            </li>
            <li>
              <strong>4.</strong>{" "}
              매주 월요일 자동 스캔 결과 + 카카오 알림으로 변화 추적
            </li>
          </ol>

          <div className="flex flex-col md:flex-row gap-3">
            <Link
              href="/trial"
              className="flex-1 text-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 진단 시작 →
            </Link>
            <Link
              href="/pricing"
              className="flex-1 text-center px-6 py-3 border border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
            >
              요금제 보기
            </Link>
          </div>
        </section>

        {/* ─── 더 알아보기 ─── */}
        <section className="border-t border-gray-100 pt-6 mt-8">
          <p className="text-sm font-semibold text-gray-700 mb-3">더 알아보기</p>
          <ul className="space-y-1.5 text-sm md:text-base text-blue-600">
            <li><Link href="/score-guide" className="hover:underline">점수 계산 가이드 — 100점이 어떻게 산출되는지</Link></li>
            <li><Link href="/faq" className="hover:underline">자주 묻는 질문</Link></li>
            <li><Link href="/demo" className="hover:underline">실제 화면 미리보기</Link></li>
            <li>
              <a
                href="https://help.naver.com/service/30026/contents/24632"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                네이버 스마트플레이스 공식 안내 (출처)
              </a>
            </li>
          </ul>
        </section>
      </article>

      <SiteFooter activePage="/how-it-works" />
    </main>
  )
}

interface ScoreCardProps {
  num: string
  title: string
  what: string
  how: string
}

function ScoreCard({ num, title, what, how }: ScoreCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 md:p-5">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl md:text-3xl font-bold text-blue-600">{num}</span>
        <span className="text-base md:text-lg font-semibold text-gray-900">{title}</span>
      </div>
      <p className="text-sm md:text-base text-gray-600 mb-1.5 leading-relaxed">
        <strong className="text-gray-700">측정:</strong> {what}
      </p>
      <p className="text-sm md:text-base text-gray-600 leading-relaxed">
        <strong className="text-gray-700">AEOlab 도움:</strong> {how}
      </p>
    </div>
  )
}

interface ContentCardProps {
  icon: string
  title: string
  detail: string
}

function ContentCard({ icon, title, detail }: ContentCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 md:p-5 flex gap-3">
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">{detail}</p>
      </div>
    </div>
  )
}
