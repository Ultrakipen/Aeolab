import Link from "next/link";
import { Metadata } from "next";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { SiteFooter } from "@/components/common/SiteFooter";

export const metadata: Metadata = {
  title: "실사용 화면 미리보기 — AEOlab",
  description: "실제 구독 사업장의 대시보드 화면을 그대로 확인하세요. 상호명만 비공개 처리했습니다.",
};

interface ShowcaseItem {
  file: string;
  width: number;
  height: number;
  title: string;
  desc: string;
}

const ITEMS: ShowcaseItem[] = [
  { file: "01_dashboard.png", width: 1440, height: 4914, title: "대시보드", desc: "네이버·글로벌 AI 노출 현황, 오늘 할 일, 키워드 검색 순위를 한눈에 봅니다." },
  { file: "02_competitors.png", width: 1440, height: 5074, title: "경쟁사 관리", desc: "주변 경쟁 가게와 AI 노출·리뷰·소개글 완성도를 항목별로 비교합니다." },
  { file: "03_history.png", width: 1440, height: 9404, title: "변화 기록", desc: "스캔할 때마다 AI 노출 상태가 어떻게 바뀌었는지 시점별로 기록합니다." },
  { file: "04_growth.png", width: 1440, height: 3780, title: "성장 리포트", desc: "AI 노출 점수 변화, 내가 한 행동과 결과, 업종 내 위치를 정리해 보여줍니다." },
  { file: "05_guide.png", width: 1440, height: 4999, title: "개선 가이드", desc: "지금 바로 실행 가능한 개선 방법을 AI가 사업장별로 맞춤 제시합니다." },
  { file: "06_blog_analysis.png", width: 1440, height: 6239, title: "블로그 진단", desc: "블로그가 AI 브리핑에 얼마나 인용되는지, 키워드 커버리지와 포스팅 상세 분석을 제공합니다." },
  { file: "07_schema.png", width: 1440, height: 1405, title: "소개글·콘텐츠", desc: "AI 검색 등록 코드(JSON-LD)와 스마트플레이스 소개글 초안을 자동 생성합니다." },
  { file: "08_review_inbox.png", width: 1440, height: 900, title: "리뷰 답변", desc: "손님 리뷰를 붙여넣으면 업종 키워드를 포함한 답변 초안을 만들어 줍니다." },
];

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-indigo-600 font-bold text-sm">← AEOlab</Link>
          <AuthNavControlClient />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
            실제 구독 사업장 화면 그대로
          </h1>
          <p className="text-sm md:text-base text-gray-500">
            음악 교습소 사업장이 실제로 사용 중인 8개 화면입니다. 가공 없는 실제 분석 결과입니다.
          </p>
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
            <span className="text-amber-600 text-sm font-semibold">
              실제 데이터 · 상호명만 비공개 처리(OO음악학원) · 나머지는 실측 그대로
            </span>
          </div>
        </div>

        <div className="space-y-10 md:space-y-14">
          {ITEMS.map((item) => (
            <section key={item.file}>
              <div className="mb-3">
                <h2 className="text-lg md:text-xl font-black text-gray-900">{item.title}</h2>
                <p className="text-sm md:text-base text-gray-500 mt-1">{item.desc}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/showcase/${item.file}`}
                  width={item.width}
                  height={item.height}
                  alt={`AEOlab ${item.title} 실제 화면`}
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 md:mt-14 bg-indigo-600 rounded-xl p-6 md:p-8 text-center text-white">
          <p className="text-lg md:text-xl font-black mb-1">내 가게도 이렇게 관리해 보세요</p>
          <p className="text-sm text-indigo-200 mb-4">지금 시작하면 첫 스캔부터 바로 확인할 수 있습니다</p>
          <Link
            href="/pricing"
            className="inline-block bg-white text-indigo-700 font-bold text-base px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            요금제 보기 →
          </Link>
        </div>
      </div>

      <SiteFooter activePage="/showcase" />
    </div>
  );
}
