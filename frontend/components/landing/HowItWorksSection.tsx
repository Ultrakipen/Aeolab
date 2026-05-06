import { Search, BarChart2, TrendingUp } from "lucide-react";
import TrackedCTA from "@/components/analytics/TrackedCTA";

const steps = [
  {
    number: "01",
    badgeClass: "bg-blue-100 text-blue-700",
    Icon: Search,
    iconColor: "text-blue-500",
    title: "업종·가게명 입력",
    description:
      "네이버·ChatGPT·Google AI가 내 가게를 얼마나 언급하는지 즉시 측정합니다",
    tags: ["AI 노출 점수", "키워드 공백 확인"],
    emphasis: "가입 불필요 · 5분 소요",
    emphasisClass: "text-blue-600",
  },
  {
    number: "02",
    badgeClass: "bg-purple-100 text-purple-700",
    Icon: BarChart2,
    iconColor: "text-purple-500",
    title: "점수와 개선점 확인",
    description:
      "0~100점 AI 노출 점수와 경쟁 가게 대비 부족한 키워드·정보 3가지를 알려줍니다",
    tags: ["경쟁사 비교", "개선 우선순위"],
    emphasis: "한 페이지로 현재 상태 파악",
    emphasisClass: "text-purple-600",
  },
  {
    number: "03",
    badgeClass: "bg-emerald-100 text-emerald-700",
    Icon: TrendingUp,
    iconColor: "text-emerald-500",
    title: "AI 가이드로 꾸준히 개선",
    description:
      "7일마다 자동 재측정, AI 맞춤 개선 가이드로 지속 개선합니다. 개선 조치 후 보통 2~4주 안에 점수 변화가 나타납니다.",
    tags: ["7일 자동 재측정", "AI 개선 가이드"],
    emphasis: "월 9,900원 · 언제든 해지",
    emphasisClass: "text-emerald-600",
  },
] as const;

export default function HowItWorksSection() {
  return (
    <section className="bg-gray-50 py-10 md:py-14 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        {/* 섹션 타이틀 */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep">
            이렇게 사용하시면 됩니다
          </h2>
          <p className="text-base md:text-lg text-gray-600 mt-2 break-keep">
            복잡한 설정 없이 3단계로 AI 검색 노출을 시작할 수 있습니다
          </p>
        </div>

        {/* 3단계 카드 + 화살표 */}
        <div className="flex flex-col sm:flex-row items-stretch gap-4 sm:gap-0">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex flex-col sm:flex-row items-center flex-1 min-w-0">
              {/* 카드 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 md:p-6 flex flex-col gap-3 flex-1 w-full h-full">
                {/* 번호 배지 */}
                <span
                  className={`self-start text-sm sm:text-base font-bold px-2.5 py-1 rounded-full ${step.badgeClass}`}
                >
                  STEP {step.number}
                </span>

                {/* 아이콘 + 제목 */}
                <div className="flex items-center gap-2">
                  <step.Icon size={24} className={step.iconColor} strokeWidth={2} />
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 break-keep">
                    {step.title}
                  </h3>
                </div>

                {/* 설명 */}
                <p className="text-base md:text-lg text-gray-700 leading-relaxed break-keep">
                  {step.description}
                </p>

                {/* 결과 태그 */}
                <div className="flex flex-wrap gap-1.5">
                  {step.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 강조 문구 */}
                <p className={`text-base font-semibold ${step.emphasisClass}`}>
                  {step.emphasis}
                </p>
              </div>

              {/* PC 화살표 (마지막 카드 뒤에는 없음) */}
              {idx < steps.length - 1 && (
                <div
                  className="hidden sm:flex items-center justify-center px-2 text-gray-300 text-2xl font-light shrink-0"
                  aria-hidden="true"
                >
                  →
                </div>
              )}

              {/* 모바일 아래 방향 화살표 (마지막 카드 뒤에는 없음) */}
              {idx < steps.length - 1 && (
                <div
                  className="flex sm:hidden items-center justify-center py-1 text-gray-300 text-2xl font-light"
                  aria-hidden="true"
                >
                  ↓
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 하단 CTA */}
        <div className="text-center mt-8">
          <TrackedCTA
            href="/trial"
            location="how_it_works"
            label="trial_start"
            className="inline-block bg-blue-600 text-white text-base font-bold px-7 py-3 rounded-xl hover:bg-blue-700 transition-colors"
          >
            지금 바로 무료 진단 시작하기
          </TrackedCTA>
          <p className="text-sm text-gray-500 mt-2">가입 없이 바로 시작 · 5분 소요</p>
        </div>
      </div>
    </section>
  );
}
