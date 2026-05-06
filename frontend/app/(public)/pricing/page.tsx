import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { PayButton } from "./PayButton";
import { BizContactButton } from "./BizContactButton";
import PlanRecommender from "./PlanRecommender";
import GroupHeadlineBanner from "./GroupHeadlineBanner";
import { PLANS } from "@/lib/plans";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600">AEOlab</Link>
          <div className="flex items-center gap-4">
            <Link href="/how-it-works" className="hidden lg:block text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap">서비스 안내</Link>
            <Link href="/faq" className="hidden md:block text-sm text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/demo" className="hidden sm:block text-sm text-gray-600 hover:text-gray-900">미리보기</Link>
            <Link href="/trial" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              무료 체험
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
        {/* 타이틀 */}
        <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-3">요금제</h1>
        <p className="text-center text-base md:text-lg text-gray-500 mb-6">
          네이버 AI 브리핑 · ChatGPT · Gemini — AI가 내 가게를 먼저 추천하게 만드세요
        </p>

        {/* 업종 선택 → 그룹별 가치 메시지 */}
        <GroupHeadlineBanner />

        <div className="mb-8" />

        {/* ─── 플랜 카드: 상단 3개 ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[PLANS[1], PLANS[4], PLANS[2]].map((plan) => (
            <div
              key={plan.name}
              id={`plan-${plan.name.replace(/\s+/g, "-")}`}
              className={`scroll-mt-20 rounded-2xl p-5 md:p-6 flex flex-col ${
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
                <div className={`text-sm font-medium mb-3 px-2 py-1 rounded-full inline-block self-start ${
                  plan.highlight ? "bg-blue-500 text-blue-100" : "bg-green-50 text-green-700"
                }`}>
                  {plan.valueTag}
                </div>
              )}
              <div className={`text-3xl font-bold mb-1 mt-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                {plan.price}
                <span className={`text-sm font-normal ${plan.highlight ? "text-blue-200" : "text-gray-500"}`}>
                  {plan.period}
                </span>
              </div>
              {plan.name === "Basic" && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  plan.highlight ? "bg-emerald-400/20 text-emerald-100" : "bg-emerald-50 text-emerald-700"
                }`}>
                  첫 달 50% 할인 — 4,950원 (이후 월 9,900원)
                </div>
              )}

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
                  firstMonthAmount={plan.name === "Basic" ? 4950 : undefined}
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

        {/* ─── Biz 플랜 앵커 안내 ─── */}
        <div className="flex items-center justify-center gap-3 mb-6 -mt-4">
          <span className="text-sm text-gray-400">여러 사업장·팀 계정이 필요하신가요?</span>
          <a href="#plan-Biz" className="text-sm font-semibold text-blue-600 hover:underline">
            Biz 플랜 보기 ↓
          </a>
        </div>

        {/* ─── 플랜 카드: Biz ─── */}
        <div className="grid grid-cols-1 max-w-lg mx-auto gap-6 mb-12">
          {[PLANS[3]].map((plan) => (
            <div
              key={plan.name}
              id={`plan-${plan.name.replace(/\s+/g, "-")}`}
              className="scroll-mt-20 bg-white border border-gray-200 rounded-2xl p-5 md:p-6 flex flex-col"
            >
              {plan.badge && (
                <div className="text-sm font-semibold text-blue-600 mb-2">{plan.badge}</div>
              )}
              <div className="text-xl font-bold text-gray-900 mb-0.5">{plan.name}</div>
              <div className="text-sm text-gray-500 mb-1">{plan.description}</div>
              {plan.valueTag && (
                <div className="text-sm font-medium mb-3 px-2 py-1 rounded-full inline-block self-start bg-green-50 text-green-700">
                  {plan.valueTag}
                </div>
              )}
              <div className="text-3xl font-bold text-gray-900 mb-1 mt-1">
                {plan.price}
                <span className="text-sm font-normal text-gray-500">{plan.period}</span>
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

        {/* ─── 플랜 기능 비교표 ─── */}
        <div className="overflow-x-auto mb-14">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">플랜 기능 비교</h2>
          <table className="w-full min-w-[560px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-gray-500 font-medium w-36">기능</th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Basic<br/><span className="font-normal text-gray-500 text-sm">9,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">창업패키지<br/><span className="font-normal text-gray-500 text-sm">12,900원</span></th>
                <th className="text-center py-3 px-2 text-blue-600 font-semibold">Pro<br/><span className="font-normal text-blue-400 text-sm">18,900원</span></th>
                <th className="text-center py-3 px-2 text-gray-700 font-semibold">Biz<br/><span className="font-normal text-gray-500 text-sm">49,900원</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["자동 스캔", "주 1회", "주 1회", "주 3회", "매일"],
                ["수동 스캔", "하루 2회", "하루 3회", "하루 5회", "하루 15회"],
                ["키워드 순위 측정 주기", "월 1회", "주 1회", "매일", "6시간"],
                ["키워드 자동 추천 (월)", "1회", "1회", "4회", "10회"],
                ["톡톡 채팅방 메뉴 자동 생성 (월)", "5건", "무제한", "무제한", "무제한"],
                ["경쟁사 비교", "3개", "5개", "10개", "무제한"],
                ["AI 개선 가이드", "월 3회", "월 5회", "월 10회", "월 20회"],
                ["리뷰 답변 초안", "월 20회", "무제한", "무제한", "무제한"],
                ["히스토리 보관", "60일", "90일", "90일", "무제한"],
                ["엑셀(CSV) 내보내기", "✓", "✓", "✓", "✓"],
                ["PDF 리포트", "—", "—", "✓", "✓"],
                ["광고 대응 가이드", "—", "—", "✓", "✓"],
                ["창업 시장 분석", "—", "✓", "—", "✓"],
                ["팀 계정", "—", "—", "—", "5명"],
                ["API 키 발급", "—", "—", "—", "✓"],
                ["사업장 수", "1개", "1개", "2개", "5개"],
              ].map(([feature, ...vals]) => (
                <tr key={feature as string} className="hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-600">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={`py-2.5 px-2 text-center ${i === 2 ? "text-blue-600 font-medium" : "text-gray-600"} ${v === "—" ? "text-gray-500" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── 포함된 진단 도구 ─── */}
        <div className="mb-14">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                Basic 이상 포함
              </span>
              <h2 className="text-base md:text-lg font-bold text-gray-900">추가 진단 도구</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5 break-keep">
              AI 노출 점수가 낮은 <strong>원인을 찾는</strong> 도구 두 가지를 구독에 포함해 제공합니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl" aria-hidden="true">📝</span>
                  <p className="font-semibold text-gray-900 text-sm">블로그 AI 진단</p>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed break-keep">
                  내 블로그가 AI 브리핑에 인용되는지 분석 · 홍보형/정보형 비율 · 개선 제목 자동 제안
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl" aria-hidden="true">🏪</span>
                  <p className="font-semibold text-gray-900 text-sm">스마트플레이스 자동 점검</p>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed break-keep">
                  FAQ·소개글·최근 소식 누락 자동 확인 · 즉시 쓸 수 있는 초안 제공
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 상황 질문 → 추천 플랜 ─── */}
        <div className="mb-14">
          <PlanRecommender />
        </div>

        {/* ─── 업종별 노출 범위 안내 (면책 문구) ─── */}
        <div className="mb-12 rounded-2xl border border-amber-200 bg-amber-50 p-5 md:p-6">
          <h3 className="text-base md:text-lg font-bold text-amber-900 mb-2 break-keep">
            업종별 AI 브리핑 노출 범위 안내
          </h3>
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed break-keep">
            네이버 AI 브리핑은 현재 <strong>음식점·카페·베이커리·바·숙박</strong> 등 일부 업종에서만 제공되며,
            <strong> 프랜차이즈 가맹점은 제공 대상에서 제외됩니다</strong>(네이버 공식, 추후 확대 예정).
            병원·법무·교육·쇼핑몰 등 비대상 업종 또는 프랜차이즈는 AEOlab 구독 시{" "}
            <strong>네이버 일반 검색·블로그·ChatGPT·Gemini·카카오맵 등 글로벌 AI 가시성</strong>이 향상됩니다.
          </p>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            구독 전 자신의 업종이 어디에 해당하는지{" "}
            <Link href="/trial" className="text-blue-600 hover:underline font-medium">
              무료 진단
            </Link>
            으로 확인하시거나, AEOlab 동작 원리는{" "}
            <Link href="/how-it-works" className="text-blue-600 hover:underline font-medium">
              서비스 안내 매뉴얼
            </Link>
            을 참고하세요.{" "}
            <a
              href="https://help.naver.com/service/30026/contents/24632"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              네이버 공식 안내
            </a>
            도 함께 보세요.
          </p>
        </div>

        {/* ─── ChatGPT·네이버 광고와 비교 (아코디언) ─── */}
        <details className="group bg-slate-50 border border-slate-200 rounded-2xl mb-12 overflow-hidden">
          <summary className="flex items-center justify-between cursor-pointer px-6 py-5 select-none list-none">
            <span className="text-base md:text-lg font-bold text-slate-900">
              ChatGPT·네이버 광고와 비교
            </span>
            <span className="ml-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </summary>

          <div className="px-6 pb-6">
            {/* 가치 비교 배너 */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-500 mb-1">300,000원</div>
                <div className="text-sm text-gray-500">키워드 광고 월 1일치</div>
                <div className="text-sm text-gray-400 mt-1">광고 끄면 즉시 노출 0</div>
              </div>
              <div className="flex items-center justify-center text-gray-400 text-3xl font-thin hidden sm:flex">vs</div>
              <div className="sm:hidden border-t border-gray-200 pt-3" />
              <div>
                <div className="text-2xl font-bold text-blue-600 mb-1">9,900원</div>
                <div className="text-sm text-gray-500">AEOlab Basic 한 달</div>
                <div className="text-sm text-gray-400 mt-1">AI 노출 구조 자체를 개선</div>
              </div>
            </div>

            {/* ChatGPT 비교 카드 목록 */}
            <p className="text-sm md:text-base text-slate-500 text-center mb-5">
              ChatGPT에게 물어봐도 알 수 없는 것들을 AEOlab은 매주 자동으로 측정·수집·비교합니다
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  icon: "📊",
                  title: "내 가게가 AI에 몇 % 확률로 나오는지",
                  why: "Gemini·ChatGPT 각 50회 (총 100회) 질의 → ± 오차 범위 표시 (ChatGPT 단발 질의는 오차 범위 표시 불가)",
                },
                {
                  icon: "📡",
                  title: "지금 당장 내 가게가 네이버 AI에 나오는지",
                  why: "네이버는 ChatGPT·Gemini 봇 크롤링을 전면 차단 (2023~)",
                },
                {
                  icon: "🔍",
                  title: "옆집 스마트플레이스 소개글 Q&A에 뭐 달려있는지",
                  why: "매주 월요일 05:00 경쟁사 FAQ 자동 수집 → 내 가게에 없는 질문 목록 제공 (ChatGPT는 네이버 스마트플레이스 접근 불가)",
                },
                {
                  icon: "📝",
                  title: "내 블로그 글이 AI 브리핑에 인용될 가능성",
                  why: "네이버 블로그 정보는 ChatGPT가 직접 접근하기 어렵습니다. 홍보형·정보형 비율을 분석해 AI에 인용되기 쉬운 글 제목을 자동 제안합니다. (Basic 이상 포함)",
                },
                {
                  icon: "🔔",
                  title: "근처 경쟁 가게 AI 노출이 이번 주 올랐는지",
                  why: "매주 월요일 03:00 자동 감지 → 변화 시 카카오톡 알림 (ChatGPT는 지속 추적 불가)",
                },
                {
                  icon: "✅",
                  title: "FAQ·소개글 수정 후 7일간 점수가 얼마나 올랐는지",
                  why: "행동 날짜 기록 → 7일 후 자동 재스캔 → 점수 변화 타임라인 (ChatGPT는 전·후 비교 불가)",
                },
                {
                  icon: "🏆",
                  title: "우리 동네에서 AI 검색 순위가 몇 위인지",
                  why: "ChatGPT는 우리 동네 실시간 순위를 알 수 없습니다",
                },
                {
                  icon: "💬",
                  title: "리뷰 답변·FAQ 초안 글쓰기",
                  why: "ChatGPT도 잘합니다. AEOlab에는 내 가게·경쟁사 모니터링 데이터 기반으로 포함됩니다.",
                  isAmber: true,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`flex items-start gap-3 rounded-xl p-4 border ${
                    (item as { isAmber?: boolean }).isAmber
                      ? "bg-amber-50 border-amber-100"
                      : "bg-white border-slate-100"
                  }`}
                >
                  <span className={`text-2xl shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                    (item as { isAmber?: boolean }).isAmber
                      ? "bg-amber-100"
                      : "bg-blue-50"
                  }`}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-sm md:text-base font-semibold text-slate-800">{item.title}</p>
                    <p className={`text-sm mt-0.5 ${(item as { isAmber?: boolean }).isAmber ? "text-amber-700" : "text-slate-500"}`}>
                      {item.why}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400 leading-relaxed text-center">
              ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
              측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
            </p>
          </div>
        </details>

        {/* ─── FAQ ─── */}
        <div className="mb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-6 text-center">자주 묻는 질문</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              {
                q: "내 업종도 네이버 AI 브리핑에 노출되나요?",
                a: "음식점·카페·베이커리·바·숙박 5개 업종이 현재 ACTIVE 노출 대상입니다. 뷰티·네일·반려동물·헬스·요가·약국 등은 2026 AI탭 베타·확대 진행 중. 그 외 업종은 ChatGPT·Gemini·Google AI 노출 개선 중심으로 가치를 제공합니다. 단, 모든 업종에서 프랜차이즈 가맹점은 네이버 정책상 제외됩니다.",
              },
              {
                q: "구독은 언제든지 해지할 수 있나요?",
                a: "네. 언제든지 해지 가능하며, 해지 시 현재 결제 기간 만료일까지 서비스를 계속 이용할 수 있습니다. 환불은 이용약관에 따라 처리됩니다.",
              },
              {
                q: "첫 달 50% 할인은 어떻게 적용되나요?",
                a: "Basic 플랜 신규 가입 시 첫 달은 4,950원으로 결제됩니다. 이후 매달 자동으로 정상가 9,900원이 청구됩니다. 이전에 한 번이라도 구독한 이력이 있는 경우 할인이 적용되지 않습니다.",
              },
              {
                q: "플랜 업그레이드·다운그레이드는 가능한가요?",
                a: "언제든지 설정 페이지에서 플랜을 변경할 수 있습니다. 업그레이드 시 즉시 새 플랜이 적용되며, 다운그레이드 시 현재 결제 기간 만료일 이후부터 적용됩니다.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border border-gray-100 rounded-xl p-4">
                <div className="font-medium text-gray-900 text-base mb-2">{q}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{a}</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/faq" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              전체 FAQ 보기 →
            </Link>
          </div>
        </div>

        {/* 법적 고지 */}
        <p className="text-sm text-center text-gray-500">
          구독 신청 시{" "}
          <a href="/terms" className="underline hover:text-gray-600">이용약관</a>
          {" "}및{" "}
          <a href="/privacy" className="underline hover:text-gray-600">개인정보처리방침</a>
          에 동의하는 것으로 간주됩니다.
        </p>
      </section>

      <SiteFooter activePage="/pricing" />
    </main>
  );
}
