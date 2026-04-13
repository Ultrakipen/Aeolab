import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import { PLANS } from "@/lib/plans";
import { Lock } from "lucide-react";

// AI 플랫폼 목록 — 채널 역할 구분
const AI_PLATFORMS = [
  { name: "네이버 AI 브리핑", role: "주력 노출 경로", highlight: true },
  { name: "Google AI Overview", role: "구글 노출 진단", highlight: false },
  { name: "Gemini", role: "AI 언급 측정", highlight: false },
  { name: "ChatGPT", role: "AI 언급 측정", highlight: false },
  { name: "Perplexity", role: "AI 언급 측정", highlight: false },
  { name: "Grok", role: "AI 언급 측정", highlight: false },
  { name: "Claude", role: "AI 언급 측정", highlight: false },
];

// 임팩트 숫자 데이터
const IMPACT_STATS = [
  {
    number: "2,293만명",
    label: "ChatGPT 한국 월 이용자 수",
    sub: "와이즈앱 2026.02 기준",
  },
  {
    number: "+27.4%",
    label: "AI 브리핑 클릭률 증가",
    sub: "네이버 공식 발표 (2025.08)",
  },
  {
    number: "국내 유일",
    label: "AI 검색 노출 자동 관리",
    sub: "7개 AI 플랫폼 동시 분석",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-white">

      {/* ── 섹션 1: 헤더 ── */}
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600">AEOlab</span>
            <span className="text-sm text-gray-400 hidden sm:block">AI 검색 노출 관리 서비스</span>
          </div>
          <nav className="flex items-center gap-3 lg:gap-8">
            <Link href="/pricing#faq" className="hidden md:block text-base text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/pricing" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">요금제</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-base text-gray-600 hover:text-gray-900 whitespace-nowrap">대시보드</Link>
                <LandingLogout email={user.email ?? ""} />
              </>
            ) : (
              <>
                <Link href="/login" className="text-base text-gray-600 hover:text-gray-900 whitespace-nowrap">로그인</Link>
                <Link href="/signup" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">회원가입</Link>
                <Link
                  href="/trial"
                  className="bg-blue-600 text-white text-base px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  무료 체험
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── 섹션 2: 히어로 ── */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

          {/* 왼쪽: 텍스트 + CTA */}
          <div className="text-center lg:text-left">
            {/* 배지 */}
            <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-sm px-3 py-1.5 rounded-full mb-5">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shrink-0" />
              ChatGPT 광고 미국 시작 (2026.02) — 한국도 곧 옵니다
            </div>

            {/* 헤드라인 — 소상공인 직접 문제 제기 */}
            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-4 leading-tight break-keep">
              지금 네이버에서{" "}
              <br />
              <span className="text-blue-600">손님을 뺏기고 있는지</span>
              <br className="sm:hidden" />{" "}
              3분 만에 확인하세요
            </h1>

            {/* 서브 문구 — 소상공인 언어로 경쟁·비교 강조 */}
            <p className="text-lg sm:text-xl text-gray-600 mb-3 break-keep leading-relaxed">
              경쟁 가게와 비교해서 내 가게의 온라인 순위,
              <br className="hidden sm:block" />
              블로그 후기 격차를 바로 알 수 있습니다.
            </p>

            {/* 서브 문구 — 행동 유도 구체화 */}
            <p className="text-base text-gray-500 mb-6 break-keep leading-relaxed">
              가게 이름과 지역만 입력하면 네이버·카카오·ChatGPT에서
              <br className="hidden sm:block" />
              <span className="text-gray-400">내 가게가 얼마나 보이는지 즉시 확인합니다.</span>
            </p>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-4">
              <Link
                href="/trial"
                className="bg-blue-600 text-white text-lg px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-center"
              >
                내 가게 무료 진단받기
              </Link>
              <Link
                href="/demo"
                className="border border-gray-300 text-gray-700 text-lg px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors text-center"
              >
                결과 화면 미리보기
              </Link>
            </div>
            <p className="text-sm text-gray-400">신용카드 불필요 · 3분 안에 결과 확인</p>

            {/* 모바일 전용 샘플 카드 */}
            <div className="lg:hidden bg-blue-50 rounded-2xl p-4 border border-blue-100 mt-4">
              <p className="text-xs text-gray-400 mb-2">샘플 · 강남구 음식점</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500 mb-0.5">AI 노출 점수</div>
                  <div className="text-3xl font-black text-blue-600 leading-none">67점</div>
                  <div className="text-xs text-gray-400 mt-0.5">B등급</div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 shrink-0">
                  {[
                    { name: "Gemini",   ok: true },
                    { name: "ChatGPT",  ok: true },
                    { name: "네이버AI", ok: true },
                    { name: "GoogleAI", ok: true },
                  ].map((ai) => (
                    <div
                      key={ai.name}
                      className="bg-green-50 text-green-700 text-xs rounded-lg px-2 py-1 text-center font-medium"
                    >
                      {ai.name} ✓
                    </div>
                  ))}
                </div>
              </div>
              <Link href="/trial" className="block mt-3 text-sm text-blue-600 font-medium text-center">
                → 내 가게는 몇 점일까요?
              </Link>
            </div>

            {/* AI 플랫폼 띠 — 역할 구분 표기 */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-sm text-gray-400 mb-3 text-center lg:text-left">분석 대상 AI 플랫폼</p>
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                {AI_PLATFORMS.map((ai) => (
                  <span
                    key={ai.name}
                    title={ai.role}
                    className={`text-sm px-3 py-1 rounded-full border ${
                      ai.highlight
                        ? "bg-blue-50 text-blue-700 border-blue-200 font-semibold"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    {ai.name}
                    {ai.highlight && (
                      <span className="ml-1.5 text-xs text-blue-500">★ 주력</span>
                    )}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center lg:text-left">
                ★ 네이버 AI 브리핑은 한국 소상공인에게 가장 빠른 노출 경로입니다
              </p>
            </div>
          </div>

          {/* 오른쪽: PC 전용 샘플 점수 카드 */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400">강남구 · 음식점</p>
                  <p className="text-base font-bold text-gray-900">샘플 가게</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-blue-600">67</div>
                  <div className="text-xs text-gray-400">/ 100 · B등급</div>
                </div>
              </div>
              {[
                { label: "키워드 커버리지", score: 38, color: "bg-red-400" },
                { label: "리뷰 평판",       score: 72, color: "bg-green-500" },
                { label: "스마트플레이스",  score: 55, color: "bg-yellow-500" },
                { label: "네이버 AI 노출",  score: 30, color: "bg-red-400" },
                { label: "글로벌 AI 노출",  score: 68, color: "bg-blue-500" },
                { label: "웹사이트 구조화", score: 42, color: "bg-yellow-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 mb-2">
                  <div className="text-xs text-gray-400 w-28 shrink-0 whitespace-nowrap">{item.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className={`${item.color} h-1.5 rounded-full`} style={{ width: `${item.score}%` }} />
                  </div>
                  <div className="text-xs font-medium text-gray-600 w-6 text-right">{item.score}</div>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-1.5">
                {[
                  { name: "Gemini",     ok: true  },
                  { name: "ChatGPT",    ok: true  },
                  { name: "네이버AI",   ok: true  },
                  { name: "GoogleAI",   ok: true  },
                  { name: "Perplexity", ok: false },
                ].map((ai) => (
                  <div
                    key={ai.name}
                    className={`rounded-lg p-1.5 text-center text-xs ${
                      ai.ok ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    {ai.name}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <span className="text-sm text-blue-600 font-medium">→ 내 가게는 몇 점일까요?</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 섹션 3: 임팩트 숫자 띠 ── */}
      <section className="bg-blue-600 py-8 md:py-10 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 text-white text-center">
            {IMPACT_STATS.map((stat) => (
              <div key={stat.number} className="flex flex-col items-center">
                <div className="text-3xl sm:text-4xl font-black mb-1 tracking-tight">{stat.number}</div>
                <div className="text-base sm:text-lg font-semibold text-blue-100 mb-1">{stat.label}</div>
                <div className="text-sm text-blue-300">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 섹션 3-B: 소셜 프루프 ── */}
      <section className="bg-gray-50 py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-6 break-keep">
            이런 가게들이 AI 검색 노출을 높이고 있습니다
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 카드 1 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">서울 마포구 · 카페</span>
                <span className="text-yellow-400 text-sm">★★★★★</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mt-2 mb-3 flex-1">
                스캔 결과를 보고 스마트플레이스 소개글을 FAQ 형식으로 바꿨더니 한 달 만에 네이버 AI 브리핑에 처음으로 노출됐어요.
              </p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-base font-bold text-blue-600">38점 → 71점</span>
                <span className="text-xs text-gray-400">2개월</span>
              </div>
              <div className="text-xs text-gray-400">브런치 카페 운영 2년차</div>
            </div>
            {/* 카드 2 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">경기 분당 · 피부관리실</span>
                <span className="text-yellow-400 text-sm">★★★★★</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mt-2 mb-3 flex-1">
                경쟁 샵이 왜 저보다 AI 검색에 더 잘 나오는지 이유를 처음 알았어요. 없는 키워드 3개를 보고 바로 수정했어요.
              </p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-base font-bold text-blue-600">45점 → 68점</span>
                <span className="text-xs text-gray-400">6주</span>
              </div>
              <div className="text-xs text-gray-400">1인 샵 원장</div>
            </div>
            {/* 카드 3 */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">부산 해운대 · 음식점</span>
                <span className="text-yellow-400 text-sm">★★★★★</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mt-2 mb-3 flex-1">
                매주 자동으로 스캔되니까 경쟁 가게보다 내가 뒤처지는 순간을 바로 알 수 있어요. 광고비보다 훨씬 효율적이에요.
              </p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-base font-bold text-blue-600">52점 → 79점</span>
                <span className="text-xs text-gray-400">3개월</span>
              </div>
              <div className="text-xs text-gray-400">10년 경력 식당 사장</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-5">
            ※ 위 후기는 실사용자 사례를 바탕으로 재구성한 참고용 내용입니다.
          </p>
        </div>
      </section>

      {/* ── 섹션 4: 샘플 결과 미리보기 ── */}
      <section className="py-8 md:py-12 px-4 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">
            가입 후 첫 스캔에서 이렇게 확인됩니다
          </h2>
          <p className="text-base sm:text-lg text-center text-gray-500 mb-6 break-keep">
            무료 제공 항목과 유료 플랜 추가 항목을 함께 확인하세요
          </p>

          {/* 무료 제공 영역 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">무료 제공</span>
              <span className="text-sm text-gray-500">가입 후 첫 스캔 시 바로 확인</span>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 md:p-5 border border-blue-100">
              {/* 점수 카드 2개 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="bg-white rounded-xl p-4 border border-blue-100 text-center">
                  <div className="text-sm text-gray-400 mb-1">AI 노출 종합 점수</div>
                  <div className="text-4xl font-bold text-blue-600 mb-1">67</div>
                  <div className="text-sm text-gray-400">B등급 · 7개 AI 분석 기준</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-blue-100 text-center">
                  <div className="text-sm text-gray-400 mb-1">Gemini 100회 측정</div>
                  <div className="text-4xl font-bold text-green-600 mb-1">31%</div>
                  <div className="text-sm text-gray-500">100회 중 31회 내 가게 언급</div>
                </div>
              </div>

              {/* AI별 노출 현황 */}
              <div className="bg-white rounded-xl p-4 border border-blue-100 mb-3">
                <div className="text-sm font-semibold text-gray-700 mb-3">AI 플랫폼별 노출 현황</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: "Gemini",     result: "노출",   ok: true  },
                    { name: "ChatGPT",    result: "노출",   ok: true  },
                    { name: "네이버 AI",  result: "노출",   ok: true  },
                    { name: "Perplexity", result: "노출",   ok: true  },
                    { name: "Google AI",  result: "노출",   ok: true  },
                    { name: "Grok",       result: "노출",   ok: true  },
                    { name: "Claude",     result: "노출",   ok: true  },
                  ].map((ai) => (
                    <div
                      key={ai.name}
                      className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${
                        ai.ok ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"
                      }`}
                    >
                      <div className="text-gray-600 mb-0.5 text-xs">{ai.name}</div>
                      <div>{ai.result}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 채널 분리 점수 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-green-800">네이버 AI 채널</div>
                      <div className="text-xs text-gray-500">AI 브리핑 · 플레이스</div>
                    </div>
                    <div className="text-3xl font-bold text-green-600">82</div>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex gap-1.5"><span className="text-green-500">✓</span>네이버 AI 브리핑 노출 여부</li>
                    <li className="flex gap-1.5"><span className="text-green-500">✓</span>플레이스 정보 완성도</li>
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-blue-800">글로벌 AI 채널</div>
                      <div className="text-xs text-gray-500">ChatGPT · Gemini · Google AI</div>
                    </div>
                    <div className="text-3xl font-bold text-blue-600">41</div>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className="flex gap-1.5"><span className="text-blue-500">✓</span>ChatGPT · Gemini 인용 여부</li>
                    <li className="flex gap-1.5"><span className="text-blue-500">✓</span>Google AI Overview 노출</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 유료 제공 영역 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-gray-700 text-white text-xs font-bold px-2.5 py-1 rounded-full">유료 플랜 추가 제공</span>
              <span className="text-sm text-gray-500">구독 시 아래 기능이 추가됩니다</span>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 md:p-5 border border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 border border-orange-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-700">경쟁사 갭 분석</div>
                    <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Basic+</span>
                  </div>
                  <ul className="space-y-2 mt-2">
                    {[
                      { label: "AI 검색 노출 빈도", my: 31, gap: 37 },
                      { label: "정보 구조화",       my: 30, gap: 45 },
                    ].map((d) => (
                      <li key={d.label}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{d.label}</span>
                          <span className="text-orange-500 font-medium">-{d.gap}점</span>
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${d.my}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-700">Claude AI 개선 가이드</div>
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Basic+</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mt-2">
                    스마트플레이스 FAQ 문구, 리뷰 유도 메시지, 소개글 키워드를 AI가 자동 생성 — 복사·붙여넣기만 하면 됩니다.
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-orange-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-700">30일 추세 · 업종 순위</div>
                    <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Basic+</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mt-2">
                    30일 점수 변화 추세, 업종·지역 내 AI 노출 순위, 경쟁사 갭 히스토리 관리
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-4">
            ※ 위 화면은 샘플 데이터입니다. 실제 결과는 사업장에 따라 다릅니다.
          </p>
        </div>
      </section>

      {/* ── 섹션 5: 비교 ── */}
      <section className="bg-gray-50 py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* 네이버 크롤링 차단 안내 */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 md:p-5 mb-6 flex items-start gap-3">
            <Lock className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-base font-bold text-gray-900 mb-1">
                2025년부터 네이버가 ChatGPT 크롤링을 전면 차단했습니다
              </div>
              <p className="text-sm text-gray-600 break-keep">
                ChatGPT는 더 이상 네이버 플레이스 정보를 직접 읽을 수 없습니다.
                <strong> 스마트플레이스 소개글·블로그 포스트</strong>를 AI가 잘 읽을 수 있도록 최적화하는 것이 핵심입니다.
                홈페이지 없어도 됩니다 — AEOlab이 문구를 자동 생성하면 복사·붙여넣기만 하세요.
              </p>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">
            &ldquo;무료 AI로 직접 확인하면 되지 않나요?&rdquo;
          </h2>
          <p className="text-base sm:text-lg text-center text-gray-500 mb-6 break-keep">
            직접 해보셨다면 알겠지만, 매번 다른 답이 나옵니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 md:p-6 border border-gray-200">
              <div className="text-red-500 font-semibold text-base mb-3">무료 AI 직접 사용</div>
              <ul className="space-y-2.5">
                {[
                  "매주 25번+ 직접 질문, 수동 기록",
                  "같은 질문에 매번 다른 답 (비일관성)",
                  "ChatGPT·네이버·구글 각각 따로",
                  "변화 추적 불가 — 직접 기록해야 함",
                  "왜 안 나오는지, 어떻게 고치는지 모름",
                ].map((item) => (
                  <li key={item} className="flex gap-2 text-base text-gray-600">
                    <span className="text-red-400 shrink-0">✗</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-600 rounded-xl p-5 md:p-6 text-white">
              <div className="font-semibold text-base mb-3">AEOlab</div>
              <ul className="space-y-2.5">
                {[
                  { text: "AI 100번 질문 → 정확한 노출 확률(%) 측정",        badge: "무료",    badgeColor: "bg-white/20 text-white" },
                  { text: "3채널 핵심 AI 통합 분석",                            badge: "무료",    badgeColor: "bg-white/20 text-white" },
                  { text: "경쟁사 AI 노출 점수 비교",                          badge: "Basic+",  badgeColor: "bg-orange-300/40 text-orange-100" },
                  { text: "Claude AI 맞춤 개선 가이드 + 복사 가능 문구",       badge: "Basic+",  badgeColor: "bg-orange-300/40 text-orange-100" },
                  { text: "자동 스캔, 변화 시 카카오톡 알림",                  badge: "Pro+",    badgeColor: "bg-purple-300/40 text-purple-100" },
                  { text: "업종·지역 시장 순위와 분포 확인",                   badge: "Pro+",    badgeColor: "bg-purple-300/40 text-purple-100" },
                  { text: "30일 점수 추세 · 재스캔으로 효과 즉시 확인",        badge: "Pro+",    badgeColor: "bg-purple-300/40 text-purple-100" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2 text-base">
                    <span className="text-blue-200 shrink-0 mt-0.5">✓</span>
                    <span className="flex-1">{item.text}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 섹션 6: 요금제 ── */}
      <section className="py-8 md:py-12 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2">요금제</h2>
          <p className="text-base sm:text-lg text-center text-gray-500 mb-4 break-keep">
            무료 체험으로 시작하고, 필요할 때 업그레이드하세요
          </p>

          {/* 광고비 비교 배너 */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-center">
            <span className="text-sm text-green-700 font-medium">
              광고비 300,000원/일 vs AEOlab 9,900원/월 — AI 추천 순위는 정보 최적화로만 바뀝니다
            </span>
          </div>

          {/* 유료 플랜 3개 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[PLANS[1], PLANS[2], PLANS[3]].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-5 flex flex-col ${
                  plan.highlight
                    ? "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2"
                    : "bg-white border border-gray-200"
                }`}
              >
                {plan.badge && (
                  <div className={`text-sm font-medium mb-2 ${plan.highlight ? "text-blue-100" : "text-blue-600"}`}>
                    {plan.badge}
                  </div>
                )}
                {/* valueTag */}
                {plan.valueTag && (
                  <div className={`text-xs mb-3 px-2 py-1 rounded-lg inline-block ${
                    plan.highlight ? "bg-blue-500 text-blue-100" : "bg-green-50 text-green-700 border border-green-100"
                  }`}>
                    {plan.valueTag}
                  </div>
                )}
                <div className={`text-xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </div>
                <div className={`text-sm mb-3 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>
                  {plan.description}
                </div>
                <div className={`text-3xl font-bold mb-2 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  {plan.price}
                  <span className={`text-sm font-normal ml-1 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>
                    {plan.period}
                  </span>
                </div>
                {plan.killerFeature && (
                  <div className={`mb-4 text-sm font-medium p-2.5 rounded-lg leading-snug ${
                    plan.highlight
                      ? "bg-blue-500/60 text-blue-100"
                      : "bg-amber-50 text-amber-800 border border-amber-100"
                  }`}>
                    ★ {plan.killerFeature}
                  </div>
                )}
                <ul className="mb-5 space-y-2 flex-1">
                  {plan.features.map((f) => {
                    const isUnlimited = !plan.highlight && f.includes("무제한");
                    return (
                      <li
                        key={f}
                        className={`text-sm flex gap-2 leading-snug ${
                          plan.highlight
                            ? "text-blue-100"
                            : isUnlimited
                            ? "text-emerald-700 font-medium"
                            : "text-gray-600"
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 font-bold ${
                          plan.highlight ? "text-blue-200" : isUnlimited ? "text-emerald-500" : "text-blue-500"
                        }`}>✓</span>
                        {f}
                      </li>
                    );
                  })}
                </ul>
                {plan.href.startsWith("mailto:") ? (
                  <a
                    href={plan.href}
                    className={`block text-center py-3 rounded-xl font-semibold text-base transition-colors ${
                      plan.highlight
                        ? "bg-white text-blue-600 hover:bg-blue-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    href={plan.href}
                    className={`block text-center py-3 rounded-xl font-semibold text-base transition-colors ${
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

          {/* 창업 패키지 */}
          {(() => {
            const startupPlan = PLANS[4];
            return (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-sm font-semibold text-gray-500 shrink-0 px-1">예비 창업자를 위한 특별 플랜</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-2xl overflow-hidden">
                  <div className="bg-amber-50 px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full inline-block mb-2">
                        {startupPlan.badge}
                      </span>
                      <div className="text-lg font-bold text-gray-900">{startupPlan.name}</div>
                      <div className="text-sm text-gray-500">{startupPlan.description}</div>
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <span className="text-3xl font-bold text-gray-900">{startupPlan.price}</span>
                      <span className="text-sm text-gray-400 ml-1">{startupPlan.period}</span>
                    </div>
                  </div>
                  <div className="px-4 md:px-6 py-3 border-b border-amber-100 bg-amber-50/40">
                    <div className="text-sm font-medium text-amber-800">★ {startupPlan.killerFeature}</div>
                  </div>
                  <div className="p-4 md:p-6">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-5">
                      {startupPlan.features.map((f) => (
                        <li key={f} className="text-sm flex gap-2 text-gray-600 leading-snug">
                          <span className="text-amber-500 mt-0.5 shrink-0 font-bold">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={startupPlan.href}
                      className="block text-center py-3 rounded-xl font-semibold text-base bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      {startupPlan.cta}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          <p className="text-center text-sm text-gray-400 mb-3">
            언제든 해지 · 위약금 없음 · 가입 후 Full 스캔 1회 무료 제공
          </p>
          <div className="text-center">
            <Link href="/pricing" className="text-sm text-blue-600 hover:underline font-medium">
              전체 플랜 상세 비교 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 최종 CTA 배너 ── */}
      <section className="bg-blue-600 py-10 md:py-14 px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 break-keep">
            지금 무료로 시작하세요
          </h2>
          <p className="text-base sm:text-lg text-blue-100 mb-2 break-keep">
            광고비를 써도 AI 추천 순위는 바뀌지 않습니다. 정보 최적화만이 답입니다.
          </p>
          <p className="text-sm text-blue-200 mb-6">신용카드 불필요 · 1분 안에 결과 확인</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/trial"
              className="bg-white text-blue-600 text-lg px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors font-semibold"
            >
              무료 체험 시작
            </Link>
            <Link
              href="/signup"
              className="border border-blue-400 text-white text-lg px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors"
            >
              1분 무료 회원가입
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-base text-gray-400 text-center sm:text-left break-keep">
            AEOlab · AI Engine Optimization Lab · 한국 소상공인 AI 검색 성장 플랫폼
          </div>
          <div className="flex items-center gap-4 text-base text-gray-400 flex-wrap justify-center sm:justify-end">
            <Link href="/pricing"  className="hover:text-gray-600">요금제</Link>
            <Link href="/demo"     className="hover:text-gray-600">미리보기</Link>
            <Link href="/trial"    className="hover:text-gray-600">무료 체험</Link>
            <a href="mailto:hello@aeolab.co.kr" className="hover:text-gray-600">문의</a>
            <Link href="/terms"    className="hover:text-gray-600">이용약관</Link>
            <Link href="/privacy"  className="hover:text-gray-600">개인정보처리방침</Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-gray-100 text-sm text-gray-400 leading-relaxed text-center sm:text-left break-keep">
          <p>상호: 케이엔디 커뮤니티 (KND Community) &nbsp;|&nbsp; 대표자: 김봉후 &nbsp;|&nbsp; 사업자등록번호: 202-19-10353</p>
          <p>사업장 소재지: 경상남도 김해시 계동로 76-22, 701-903 &nbsp;|&nbsp; 통신판매업번호: 2020-김해장유-0252</p>
          <p>고객센터: 070-8095-1478</p>
        </div>
      </footer>

    </main>
  );
}
