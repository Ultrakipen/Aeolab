import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";

export const metadata: Metadata = {
  title: "업종별 AI 검색 노출 가이드 | AEOlab",
  description:
    "음식점·카페·미용실 등 업종별 네이버·ChatGPT AI 검색 노출 체크리스트. 무료 제공.",
};

const GUIDES = [
  {
    category: "restaurant",
    label: "음식점",
    icon: "★",
    tip: "스마트플레이스 소개글·사진·예약 연동이 노출 핵심",
  },
  {
    category: "cafe",
    label: "카페",
    icon: "◆",
    tip: "시그니처 음료 사진과 소식 주 1회가 방문 유도 핵심",
  },
  {
    category: "bakery",
    label: "베이커리",
    icon: "▲",
    tip: "당일 생산 품목·소식 게시로 AI 검색 노출 경쟁력 향상",
  },
  {
    category: "beauty",
    label: "미용실·헤어",
    icon: "●",
    tip: "시술 전후 사진과 예약 연동이 검색 전환 핵심",
  },
  {
    category: "nail",
    label: "네일샵",
    icon: "■",
    tip: "디자인 사진·포트폴리오 태그로 AI 키워드 커버리지 확대",
  },
  {
    category: "fitness",
    label: "헬스장·PT",
    icon: "▶",
    tip: "트레이너 소개·시설 사진·체험 프로그램 안내가 핵심",
  },
  {
    category: "bar",
    label: "주점·바",
    icon: "◈",
    tip: "주류 메뉴·안주·분위기 사진 + 영업시간(라스트오더) 정확 입력이 노출 핵심",
  },
  {
    category: "accommodation",
    label: "숙박",
    icon: "◇",
    tip: "객실 사진·편의시설·주변 관광지 키워드 연결이 노출 핵심",
  },
  {
    category: "pet",
    label: "반려동물샵",
    icon: "○",
    tip: "서비스별 비용·전후 사진·자격증 정보가 신뢰도 핵심",
  },
  {
    category: "education",
    label: "교육·학원",
    icon: "△",
    tip: "커리큘럼·강사 소개·수강 후기가 등록 전환 핵심",
  },
];

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl md:text-2xl font-bold text-blue-600">
            AEOlab
          </Link>
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              href="/how-it-works"
              className="hidden md:block text-sm text-gray-600 hover:text-gray-900"
            >
              서비스 안내
            </Link>
            <Link
              href="/pricing"
              className="hidden sm:block text-sm text-gray-600 hover:text-gray-900"
            >
              요금제
            </Link>
            <AuthNavControlClient />
            <Link
              href="/trial"
              className="bg-blue-600 text-white text-sm md:text-base px-3 md:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              무료 진단
            </Link>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="mb-2">
          <span className="inline-block bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-3">
            무료 가이드
          </span>
        </div>
        <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight break-keep mb-3">
          업종별 AI 검색 노출 가이드
        </h1>
        <p className="text-base md:text-lg text-gray-600 max-w-2xl leading-relaxed break-keep mb-2">
          네이버 AI 브리핑·AI탭·ChatGPT·Gemini에서 우리 가게가 먼저 언급되려면 무엇을 준비해야 할까요?
          업종별 체크리스트로 지금 바로 확인하세요.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          10개 업종 · 각 10~12개 항목 · 로그인 불필요
        </p>

        {/* 업종 카드 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {GUIDES.map((g) => (
            <Link
              key={g.category}
              href={`/resources/${g.category}`}
              className="group bg-white border border-gray-200 rounded-xl p-4 md:p-5 hover:border-blue-300 hover:shadow-md transition-all"
            >
              {/* 아이콘 영역 */}
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3 text-blue-600 text-xl font-bold select-none" aria-hidden="true">
                {g.icon}
              </div>
              {/* 업종명 */}
              <div className="font-bold text-gray-900 text-base md:text-lg leading-tight break-keep mb-1">
                {g.label}
              </div>
              {/* 핵심 팁 */}
              <p className="text-sm text-gray-500 leading-snug break-keep mb-3 line-clamp-2">
                {g.tip}
              </p>
              {/* CTA */}
              <span className="text-sm font-medium text-blue-600 group-hover:underline">
                가이드 보기 →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="bg-blue-50 rounded-xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-bold text-gray-900 text-base md:text-lg break-keep mb-1">
              가이드만으로 부족하다면?
            </div>
            <p className="text-sm md:text-base text-gray-600 break-keep">
              AEOlab이 내 사업장을 직접 분석해 부족한 항목과 우선순위를 알려드립니다.
            </p>
          </div>
          <Link
            href="/trial"
            className="shrink-0 bg-blue-600 text-white font-medium text-sm md:text-base px-5 py-3 rounded-xl hover:bg-blue-700 transition-colors text-center"
          >
            직접 진단받기 → 무료 체험
          </Link>
        </div>
      </section>

      {/* 면책 문구 */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pb-8">
        <p className="text-sm text-gray-500 leading-relaxed break-keep">
          이 가이드는 일반적인 권장 사항이며, 실제 노출 결과는 업종·지역·경쟁 강도에 따라 다를 수 있습니다.
        </p>
      </section>

      <SiteFooter activePage="/resources" />
    </main>
  );
}
