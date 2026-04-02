import Link from "next/link";
import { PayButton } from "./PayButton";
import { BizContactButton } from "./BizContactButton";
import { PLANS } from "@/lib/plans";

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

      <section className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-3">요금제</h1>
        <p className="text-center text-base md:text-lg text-gray-500 mb-4">
          네이버 AI 브리핑 · ChatGPT · Gemini — AI가 내 가게를 먼저 추천하게 만드세요
        </p>
        <div className="text-center mb-8">
          <span className="inline-block bg-orange-50 text-orange-700 text-sm px-4 py-1.5 rounded-full font-medium">
            광고비를 아무리 써도 AI 추천 순위는 바뀌지 않습니다. 정보 최적화가 유일한 방법입니다.
          </span>
        </div>

        {/* 가치 비교 배너 */}
        <div className="bg-gray-50 rounded-2xl p-4 md:p-6 mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-red-500 mb-1">300,000원</div>
            <div className="text-sm text-gray-500">키워드 광고 월 1일치</div>
            <div className="text-xs text-gray-400 mt-1">광고 끄면 즉시 노출 0</div>
          </div>
          <div className="flex items-center justify-center text-gray-300 text-3xl font-thin hidden sm:flex">vs</div>
          <div className="sm:hidden border-t border-gray-200 pt-3" />
          <div>
            <div className="text-2xl font-bold text-blue-600 mb-1">9,900원</div>
            <div className="text-sm text-gray-500">AEOlab Basic 한 달</div>
            <div className="text-xs text-gray-400 mt-1">AI 노출 구조 자체를 개선</div>
          </div>
        </div>

        {/* 상단 3개 플랜 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {PLANS.slice(0, 3).map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-5 md:p-6 flex flex-col ${
                plan.highlight
                  ? "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2"
                  : "bg-white border border-gray-200"
              }`}
            >
              {plan.badge && (
                <div className={`text-sm font-semibold mb-3 ${plan.highlight ? "text-blue-100" : "text-blue-600"}`}>
                  {plan.badge}
                </div>
              )}
              <div className={`text-xl font-bold mb-0.5 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.name}
              </div>
              <div className={`text-sm mb-1 ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}>
                {plan.description}
              </div>
              {plan.valueTag && (
                <div className={`text-xs font-medium mb-3 px-2 py-1 rounded-full inline-block self-start ${
                  plan.highlight ? "bg-blue-500 text-blue-100" : "bg-green-50 text-green-700"
                }`}>
                  {plan.valueTag}
                </div>
              )}
              <div className={`text-3xl font-bold mb-1 mt-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.price}
                <span className={`text-sm font-normal ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>
                  {plan.period}
                </span>
              </div>

              <ul className="mt-4 mb-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`text-sm flex gap-2 leading-snug ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>
                    <span className={`mt-0.5 shrink-0 ${plan.highlight ? "text-blue-200" : "text-blue-500"}`}>✓</span>
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
            <div key={plan.name} className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 flex flex-col">
              {plan.badge && (
                <div className="text-sm font-semibold text-blue-600 mb-2">{plan.badge}</div>
              )}
              <div className="text-xl font-bold text-gray-900 mb-0.5">{plan.name}</div>
              <div className="text-sm text-gray-500 mb-1">{plan.description}</div>
              {plan.valueTag && (
                <div className="text-xs font-medium mb-3 px-2 py-1 rounded-full inline-block self-start bg-green-50 text-green-700">
                  {plan.valueTag}
                </div>
              )}
              <div className="text-3xl font-bold text-gray-900 mb-1 mt-1">
                {plan.price}
                <span className="text-sm font-normal text-gray-400">{plan.period}</span>
              </div>
              <ul className="mt-4 mb-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm flex gap-2 text-gray-600 leading-snug">
                    <span className="text-blue-500 mt-0.5 shrink-0">✓</span>
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
              ) : plan.href.startsWith("mailto:") ? (
                <BizContactButton cta={plan.cta} />
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

        {/* 플랜별 한도 요약 비교표 */}
        <div className="mt-12 overflow-x-auto">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">플랜 기능 비교</h2>
          <table className="w-full min-w-[560px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-gray-500 font-medium w-36">기능</th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Basic<br/><span className="font-normal text-gray-400 text-xs">9,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">창업패키지<br/><span className="font-normal text-gray-400 text-xs">16,900원</span></th>
                <th className="text-center py-3 px-2 text-blue-600 font-semibold">Pro<br/><span className="font-normal text-blue-400 text-xs">22,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Biz<br/><span className="font-normal text-gray-400 text-xs">49,900원</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["자동 스캔", "주 1회", "주 1회", "주 3회", "매일"],
                ["경쟁사 비교", "3개", "10개", "10개", "무제한"],
                ["AI 개선 가이드", "월 1회", "월 5회", "월 8회", "월 20회"],
                ["리뷰 답변 초안", "월 10회", "월 20회", "월 50회", "무제한"],
                ["히스토리 보관", "30일", "90일", "90일", "무제한"],
                ["엑셀(CSV) 내보내기", "—", "✓", "✓", "✓"],
                ["PDF 리포트", "—", "—", "✓", "✓"],
                ["광고 대응 가이드", "—", "—", "✓", "✓"],
                ["창업 시장 분석", "—", "✓", "—", "✓"],
                ["팀 계정", "—", "—", "—", "5명"],
                ["사업장 수", "1개", "1개", "1개", "5개"],
              ].map(([feature, ...vals]) => (
                <tr key={feature as string} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-600">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`py-2.5 px-2 text-center ${i === 2 ? "text-blue-600 font-medium" : "text-gray-600"} ${v === "—" ? "text-gray-300" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div className="mt-14">
          <h2 className="text-lg font-bold text-gray-900 mb-6 text-center">자주 묻는 질문</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              {
                q: "네이버 AI 브리핑과 ChatGPT, 어디에 집중해야 하나요?",
                a: "업종마다 다릅니다. 음식점·카페는 손님의 약 70%가 네이버로 찾기 때문에 네이버 AI 브리핑 준비도가 더 중요합니다. 법률·쇼핑몰은 ChatGPT·Gemini 노출이 더 중요합니다. AEOlab은 업종을 입력하면 자동으로 가중치를 조정해 가장 중요한 채널을 먼저 개선합니다.",
              },
              {
                q: "무료 체험과 유료 플랜의 차이는?",
                a: "무료 체험은 지금 당장의 네이버 AI 브리핑 준비도와 글로벌 AI 가시성을 1회 진단하고, 없는 키워드 3개와 FAQ 문구를 바로 확인할 수 있습니다. 유료 플랜은 매일 자동 추적해 성장 단계 변화를 알림으로 받고, 경쟁사 대비 키워드 갭을 지속 관리할 수 있습니다.",
              },
              {
                q: "ChatGPT가 네이버를 못 크롤링한다던데 의미가 있나요?",
                a: "네이버가 ChatGPT·Gemini 등 AI 크롤러를 차단했기 때문에, 소상공인이 AI가 직접 읽을 수 있는 구조화된 정보를 별도로 만들어야 합니다. AEOlab은 그 코드(JSON-LD)와 FAQ를 자동으로 생성해 드립니다.",
              },
              {
                q: "Pro와 창업패키지 중 어떤 걸 골라야 하나요?",
                a: "현재 운영 중인 사업장이 있고 경쟁사 대비 AI 노출을 적극 개선하고 싶다면 Pro를 선택하세요. 아직 창업 전이거나 새 매장 오픈을 준비 중이라면 창업패키지가 맞습니다. 창업패키지는 시장 진입 난이도와 틈새 키워드 분석에 특화되어 있습니다.",
              },
              {
                q: "구독은 언제든지 해지할 수 있나요?",
                a: "네. 언제든지 해지 가능하며, 해지 시 현재 결제 기간 만료일까지 서비스를 계속 이용할 수 있습니다.",
              },
              {
                q: "카카오톡 알림은 어떻게 받나요?",
                a: "설정 페이지에서 수신 전화번호를 등록하면, 성장 단계 변화, 경쟁사 순위 변동, 이번 주 할 일을 카카오톡으로 받아보실 수 있습니다.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-gray-100 rounded-xl p-4">
                <div className="font-medium text-gray-900 text-base mb-2">{q}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
        </div>
        {/* 법적 고지 */}
        <p className="text-xs text-center text-gray-400 mt-10">
          구독 신청 시{" "}
          <a href="/terms" className="underline hover:text-gray-600">이용약관</a>
          {" "}및{" "}
          <a href="/privacy" className="underline hover:text-gray-600">개인정보처리방침</a>
          에 동의하는 것으로 간주됩니다.
        </p>
      </section>
    </main>
  );
}
