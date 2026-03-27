import Link from "next/link";
import { PayButton } from "./PayButton";

const PLANS = [
  {
    name: "무료",
    price: "0원",
    period: "",
    amount: 0,
    highlight: false,
    badge: "",
    description: "AI 검색 노출 1회 체험",
    features: ["Gemini AI 1회 스캔", "AI Visibility Score 확인", "Before 스크린샷 저장", "신용카드 불필요"],
    cta: "무료 체험",
    href: "/trial",
    isPay: false,
  },
  {
    name: "Basic",
    price: "9,900원",
    period: "/ 월",
    amount: 9900,
    highlight: true,
    badge: "가장 인기",
    description: "소상공인 성장 플랜",
    features: [
      "수동 스캔 월 10회",
      "자동 스캔 월 1회 (8개 AI · 100회 샘플링)",
      "경쟁사 5개 벤치마킹",
      "AI 개선 가이드",
      "JSON-LD Schema 자동 생성",
      "Before/After 카드 자동 생성",
      "주간 카카오톡 알림",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  {
    name: "창업 패키지",
    price: "39,900원",
    period: "/ 3개월",
    amount: 39900,
    highlight: false,
    badge: "예비 창업자",
    description: "창업 전 시장 조사 특화",
    features: [
      "수동 스캔 월 10회",
      "자동 스캔 월 1회",
      "경쟁사 10개 분석",
      "업종 경쟁 강도 분석 리포트",
      "틈새 시장 발굴 가이드",
      "3개월 추세 추적",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  {
    name: "Pro",
    price: "29,900원",
    period: "/ 월",
    amount: 29900,
    highlight: false,
    badge: "마케터·컨설턴트",
    description: "무제한 분석 플랜",
    features: [
      "수동 스캔 무제한",
      "자동 스캔 주 1회",
      "경쟁사 10개 분석",
      "PDF 리포트 다운로드",
      "CSV 데이터 내보내기",
      "히스토리 무제한 보관",
    ],
    cta: "시작하기",
    href: "/signup",
    isPay: true,
  },
  {
    name: "Biz",
    price: "79,900원",
    period: "/ 월",
    amount: 79900,
    highlight: false,
    badge: "대행사",
    description: "팀 협업 + API 플랜",
    features: [
      "수동 스캔 무제한",
      "자동 스캔 매일",
      "경쟁사 20개 분석",
      "팀 계정 5명",
      "Public API 키 발급",
      "PDF · CSV 내보내기",
    ],
    cta: "문의하기",
    href: "mailto:hello@aeolab.co.kr",
    isPay: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600">AEOlab</Link>
          <Link href="/trial" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            무료 체험
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">요금제</h1>
        <p className="text-center text-gray-500 mb-3">합리적인 가격으로 AI 검색 노출을 높이세요</p>
        <div className="text-center mb-12">
          <span className="inline-block bg-orange-50 text-orange-700 text-sm px-4 py-1.5 rounded-full font-medium">
            광고비를 아무리 써도 AI 추천 순위는 바뀌지 않습니다. 정보 최적화가 유일한 방법입니다.
          </span>
        </div>

        {/* 상단 3개 플랜 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {PLANS.slice(0, 3).map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2"
                  : "bg-white border border-gray-200"
              }`}
            >
              {plan.badge && (
                <div className={`text-xs font-medium mb-3 ${plan.highlight ? "text-blue-100" : "text-blue-600"}`}>
                  {plan.badge}
                </div>
              )}
              <div className={`text-lg font-bold mb-0.5 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.name}
              </div>
              <div className={`text-xs mb-3 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>
                {plan.description}
              </div>
              <div className={`text-3xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.price}
                <span className={`text-sm font-normal ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>
                  {plan.period}
                </span>
              </div>

              <ul className="mt-4 mb-6 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`text-sm flex gap-2 ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>
                    <span className={plan.highlight ? "text-blue-200" : "text-blue-500"}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.isPay ? (
                <PayButton
                  planName={plan.name}
                  amount={plan.amount}
                  highlight={plan.highlight}
                  signupHref={plan.href}
                />
              ) : (
                <Link
                  href={plan.href}
                  className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                    plan.highlight
                      ? "bg-white text-blue-600 hover:bg-blue-50"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* 하단 2개 플랜 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS.slice(3).map((plan) => (
            <div key={plan.name} className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col">
              {plan.badge && (
                <div className="text-xs font-medium text-blue-600 mb-2">{plan.badge}</div>
              )}
              <div className="text-lg font-bold text-gray-900 mb-0.5">{plan.name}</div>
              <div className="text-xs text-gray-400 mb-3">{plan.description}</div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {plan.price}
                <span className="text-sm font-normal text-gray-400">{plan.period}</span>
              </div>
              <ul className="mt-4 mb-6 space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm flex gap-2 text-gray-600">
                    <span className="text-blue-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.isPay ? (
                <PayButton
                  planName={plan.name}
                  amount={plan.amount}
                  highlight={false}
                  signupHref={plan.href}
                />
              ) : (
                <Link
                  href={plan.href}
                  className="block text-center py-3 rounded-xl font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-lg font-bold text-gray-900 mb-6 text-center">자주 묻는 질문</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              {
                q: "무료 체험과 유료 플랜의 차이는?",
                a: "무료 체험은 Gemini AI 1회 스캔입니다. 유료 플랜은 6개 AI에서 100회씩 샘플링하여 정확한 노출 확률을 측정하고, 경쟁사와 비교해 개선 방안을 제시합니다.",
              },
              {
                q: "ChatGPT가 네이버를 못 크롤링한다던데 의미가 있나요?",
                a: "네이버가 ChatGPT 크롤링을 막았기 때문에, 소상공인이 Schema JSON-LD 등 외부에서 읽히는 데이터를 만들어야 합니다. AEOlab이 바로 그 가이드를 제공합니다.",
              },
              {
                q: "구독은 언제든지 해지할 수 있나요?",
                a: "네. 언제든지 해지 가능하며, 해지 시 현재 결제 기간 만료일까지 서비스를 계속 이용할 수 있습니다.",
              },
              {
                q: "카카오톡 알림은 어떻게 받나요?",
                a: "설정 페이지에서 수신 전화번호를 등록하면, 매주 월요일 AI 노출 점수 변화, 경쟁사 변화, 이번 달 개선 과제를 카카오톡으로 받아보실 수 있습니다.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-gray-100 rounded-xl p-4">
                <div className="font-medium text-gray-900 text-sm mb-2">{q}</div>
                <div className="text-sm text-gray-500">{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
