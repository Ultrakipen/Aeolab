import { SearchX, TrendingDown, Award } from "lucide-react";

export default function ProblemSection() {
  const problems = [
    {
      Icon: SearchX,
      text: "검색해도 우리 가게가 안 나온다",
      iconColor: "text-red-500",
      bgColor: "bg-red-50",
    },
    {
      Icon: TrendingDown,
      text: "광고비는 계속 쓰는데 손님이 안 온다",
      iconColor: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      Icon: Award,
      text: "경쟁 가게만 AI에 추천되고 있다",
      iconColor: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
  ];
  return (
    <section className="bg-gray-50 py-8 md:py-10 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-center text-gray-900 mb-2 break-keep">
          혹시 이런 상황인가요?
        </h2>
        <p className="text-sm text-center text-gray-500 mb-7 break-keep">
          광고 문제가 아닙니다 — AI 추천 구조 문제입니다
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {problems.map(({ Icon, text, iconColor, bgColor }) => (
            <div
              key={text}
              className="bg-white rounded-2xl border border-gray-200 p-5 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 mx-auto ${bgColor}`}>
                <Icon size={24} strokeWidth={1.8} className={iconColor} />
              </div>
              <p className="text-sm md:text-base font-medium text-gray-700 break-keep leading-snug">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
