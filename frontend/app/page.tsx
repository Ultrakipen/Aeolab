import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import { PLANS } from "@/lib/plans";
import {
  Stethoscope, BookOpen, Scale, Scissors, UtensilsCrossed, ShoppingBag,
  TrendingUp, MessageSquare, Store, Newspaper, CheckSquare, Lock,
} from "lucide-react";

// v3.0 듀얼트랙 가중치 — Track 1(네이버 AI) + Track 2(글로벌 AI)
const BREAKDOWN_ITEMS = [
  // Track 1: 네이버 AI 브리핑 준비도 (오프라인 매장 핵심)
  { label: "키워드 커버리지",         weight: "35%", track: "T1", desc: "리뷰에 담긴 키워드 분포 — 없는 키워드 3개 즉시 확인" },
  { label: "리뷰 수·평점·다양성",     weight: "25%", track: "T1", desc: "리뷰가 많고 평점 높을수록 AI가 더 자주 추천" },
  { label: "스마트플레이스 완성도",   weight: "25%", track: "T1", desc: "FAQ·소개글·최근 소식 — AI 브리핑의 직접 인용 경로" },
  { label: "네이버 AI 브리핑 노출",   weight: "15%", track: "T1", desc: "실제 네이버 AI 브리핑에 가게 이름이 언급되는지 확인" },
  // Track 2: 글로벌 AI 가시성 (ChatGPT·Gemini·Google AI 등)
  { label: "글로벌 AI 노출 빈도",     weight: "40%", track: "T2", desc: "Gemini 100회 반복 검색 — 정확한 AI 노출 확률(%) 측정" },
  { label: "웹사이트·정보 구조화",    weight: "30%", track: "T2", desc: "AI가 직접 읽을 수 있는 JSON-LD·블로그 콘텐츠 최적화 수준" },
  { label: "온라인 언급 빈도",        weight: "20%", track: "T2", desc: "블로그·SNS·카페에서 가게 이름이 언급된 횟수" },
  { label: "Google AI 노출",          weight: "10%", track: "T2", desc: "Google AI Overview에서 가게 정보가 보이는지 확인" },
];

const EFFECT_LAYERS = [
  {
    step: "1단계",
    title: "AI 노출 점수",
    desc: "AI가 100번 물어봤을 때 내 가게가 몇 번 나오는지 + 경쟁사 순위 + 변화 추이를 수치로 보여줍니다",
    badge: "데이터 수치",
    color: "bg-blue-50 border-blue-200",
  },
  {
    step: "2단계",
    title: "Before / After 화면 비교",
    desc: "스캔할 때마다 AI 검색 결과 화면이 자동으로 저장됩니다. 개선 전·후 화면을 나란히 놓고 어떤 가게가 먼저 나왔는지 눈으로 직접 비교합니다.",
    badge: "눈으로 확인",
    color: "bg-green-50 border-green-200",
  },
  {
    step: "3단계",
    title: "경쟁사 갭 분석 + 성장 단계",
    desc: "1위 경쟁사와 6개 차원 격차를 수치로 보여주고, 내 가게가 현재 생존기·안정기·성장기·지배기 중 어느 단계인지, 이번 주 무엇을 해야 할지 알려줍니다.",
    badge: "전략 가이드",
    color: "bg-orange-50 border-orange-200",
  },
];

const INDUSTRY_ITEMS = [
  { Icon: Stethoscope,    name: "병원·한의원",  desc: "'근처 잘 하는 병원' AI 추천 급증" },
  { Icon: BookOpen,       name: "학원·교육",    desc: "학부모 AI 검색으로 학원 선택" },
  { Icon: Scale,          name: "법률·세무",    desc: "전문직 AI 노출이 신뢰도 직결" },
  { Icon: Scissors,       name: "미용실·뷰티",  desc: "ChatGPT·네이버 AI 추천 빠르게 확산" },
  { Icon: UtensilsCrossed,name: "음식점·카페",  desc: "네이버 AI + Google AI 동시 공략" },
  { Icon: ShoppingBag,    name: "쇼핑몰·매장", desc: "AI 쇼핑 검색 선점 기회" },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600">AEOlab</span>
            <span className="text-sm text-gray-400 hidden sm:block">AI 검색 노출 관리 서비스</span>
          </div>
          <nav className="flex items-center gap-3 lg:gap-8">
            <Link href="/faq" className="hidden md:block text-base text-gray-600 hover:text-gray-900">FAQ</Link>
            <Link href="/notices" className="hidden md:block text-base text-gray-600 hover:text-gray-900">공지사항</Link>
            <Link href="/pricing" className="hidden sm:block text-base text-gray-600 hover:text-gray-900">요금제</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-base text-gray-600 hover:text-gray-900 whitespace-nowrap">대시보드</Link>
                <LandingLogout email={user.email ?? ""} />
              </>
            ) : (
              <>
                <Link href="/login"  className="text-base text-gray-600 hover:text-gray-900 whitespace-nowrap">로그인</Link>
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

      {/* 히어로 */}
      <section className="max-w-7xl mx-auto px-6 py-6 sm:py-8 lg:py-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* 왼쪽: 텍스트 + CTA */}
          <div className="text-center lg:text-left">
            <div className="flex flex-col sm:flex-row gap-2 justify-center lg:justify-start mb-4">
              <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-full">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                ChatGPT 광고 미국 시작 (2026.02) — 한국도 곧 옵니다
              </div>
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full">
                ChatGPT 한국 MAU 2,293만명 · 유료 구독 세계 2위
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold text-gray-900 mb-4 leading-tight break-keep">
              AI가 내 가게를
              <br />
              <span className="text-blue-600">추천하게 만드는</span> 서비스
            </h1>
            <p className="text-base sm:text-xl text-gray-600 mb-3 max-w-2xl mx-auto lg:mx-0 break-keep">
              경쟁 사업체를 분석해 기준을 만들고, 내 사업장을 진단하여 ChatGPT·네이버 AI·구글에서 더 많이 노출되도록 도와드립니다.
            </p>
            <p className="text-base text-gray-400 mb-5 break-keep">
              광고비를 아무리 써도 AI 추천 순위는 바뀌지 않습니다. 정보 최적화가 유일한 방법입니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/trial"
                className="bg-blue-600 text-white text-lg px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                무료로 내 가게 진단받기
              </Link>
              <Link
                href="/demo"
                className="border border-gray-300 text-gray-700 text-lg px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors"
              >
                결과 화면 미리보기
              </Link>
            </div>
            <p className="text-base text-gray-400 mt-4">
              신용카드 불필요 · 1분 안에 결과 확인
            </p>
          </div>

          {/* 오른쪽: PC 전용 샘플 점수카드 미리보기 */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400">강남구 · 음식점</p>
                  <p className="text-sm font-bold text-gray-900">샘플 가게</p>
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
                  { name: "Gemini", ok: true }, { name: "ChatGPT", ok: true },
                  { name: "네이버AI", ok: true }, { name: "GoogleAI", ok: true },
                  { name: "Perplexity", ok: false }, { name: "Claude", ok: false },
                  { name: "Grok", ok: false },
                ].map((ai) => (
                  <div key={ai.name} className={`rounded-lg p-1.5 text-center text-xs ${ai.ok ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
                    {ai.name}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <span className="text-xs text-blue-600 font-medium">→ 내 가게는 몇 점일까요?</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 네이버 크롤링 차단 브릿지 섹션 */}
      <section className="bg-yellow-50 border-y border-yellow-100 py-5 lg:py-6 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-1">
              <Lock className="w-7 h-7 text-yellow-600" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                2025년부터 네이버가 ChatGPT 크롤링을 전면 차단했습니다
              </h2>
              <p className="text-gray-600 text-base mb-3">
                ChatGPT는 더 이상 네이버 플레이스의 사업장 정보를 직접 읽을 수 없습니다.
                대부분의 소상공인은 홈페이지가 없어도 됩니다. <strong>스마트플레이스 소개글과 블로그 포스트</strong>를 AI가 잘 읽을 수 있도록 최적화하는 것이 핵심입니다.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-white border border-yellow-200 text-yellow-800 text-sm px-3 py-1 rounded-full">
                  네이버 플레이스 → ChatGPT 직접 수집 불가
                </span>
                <span className="bg-blue-600 text-white text-sm px-3 py-1 rounded-full">
                  AEOlab = 스마트플레이스·블로그 최적화 자동화
                </span>
                <span className="bg-white border border-gray-200 text-gray-700 text-sm px-3 py-1 rounded-full">
                  홈페이지 없어도 OK
                </span>
              </div>
              <p className="text-base text-gray-500 mt-3">
                코딩 지식 없이도 AEOlab이 <strong>스마트플레이스 소개글과 블로그 포스트 초안을 자동 생성</strong>합니다. 복사 후 스마트플레이스에 붙여넣기만 하면 됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 무료 AI vs AEOlab 비교 */}
      <section className="bg-gray-50 py-5 lg:py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">
            &ldquo;무료 AI로 직접 확인하면 되지 않나요?&rdquo;
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4 break-keep">직접 해보셨다면 알겠지만, 매번 다른 답이 나옵니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 lg:p-6 border border-gray-200">
              <div className="text-red-500 font-semibold mb-3">무료 AI 직접 사용</div>
              <ul className="space-y-2 text-base text-gray-600">
                {[
                  "매주 25번+ 직접 질문, 수동 기록",
                  "같은 질문에 매번 다른 답 (비일관성)",
                  "ChatGPT·네이버·구글 각각 따로",
                  "변화 추적 불가 — 직접 기록해야 함",
                  "왜 안 나오는지, 어떻게 고치는지 모름",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-red-400 shrink-0">✗</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-600 rounded-xl p-4 lg:p-6 text-white">
              <div className="font-semibold mb-3">AEOlab</div>
              <ul className="space-y-2 text-base">
                {[
                  "자동 수집, 변화 시 카카오톡 알림",
                  "AI 100번 질문 → 정확한 노출 확률(%) 측정",
                  "7개 AI 한 곳에서 통합 분석",
                  "경쟁사 6개 차원 격차 분석 — 어디서 밀리는지 정확히",
                  "업종·지역 시장 순위와 분포 확인",
                  "Claude AI 맞춤 개선 가이드 + 실행 체크리스트",
                  "체크리스트 완료 후 재스캔 → 효과 즉시 확인",
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-blue-200 shrink-0">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* AI Visibility Score 가중치 */}
      <section className="py-5 lg:py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">업종별 듀얼트랙으로 점수를 계산합니다</h2>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4">음식점·카페는 네이버 AI 비중이 70%, 법률·쇼핑몰은 글로벌 AI 비중이 80% — 업종에 맞는 가중치로 분석합니다</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <div className="text-base font-bold text-green-700 mb-3">🇰🇷 Track 1 — 네이버 AI 브리핑 준비도</div>
              <div className="space-y-2">
                {BREAKDOWN_ITEMS.filter(i => i.track === "T1").map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-10 text-right shrink-0">
                      <span className="text-base font-bold text-green-600">{item.weight}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-gray-800">{item.label}</div>
                      <div className="text-base text-gray-400">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="text-base font-bold text-blue-700 mb-3">🌐 Track 2 — 글로벌 AI 가시성</div>
              <div className="space-y-2">
                {BREAKDOWN_ITEMS.filter(i => i.track === "T2").map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-10 text-right shrink-0">
                      <span className="text-base font-bold text-blue-600">{item.weight}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-medium text-gray-800">{item.label}</div>
                      <div className="text-base text-gray-400">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7개 AI 플랫폼 */}
      <section className="bg-gray-50 py-5 lg:py-8 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 break-keep">7개 AI 플랫폼 한 번에 분석</h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-500 mb-3">소상공인이 7개 AI를 일일이 확인하는 것은 불가능합니다.</p>
          <p className="text-sm sm:text-base text-gray-400 mb-8">
            ChatGPT 2,293만 · Grok 153만 · Perplexity 152만 · Claude 77만 명 (와이즈앱 2026.02 기준)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            {[
              { name: "Gemini", mau: "주력 AI" },
              { name: "ChatGPT", mau: "2,293만" },
              { name: "네이버 AI", mau: "AI 브리핑" },
              { name: "Google AI", mau: "AI 오버뷰" },
              { name: "Perplexity", mau: "152만" },
              { name: "Grok AI", mau: "153만" },
              { name: "Claude", mau: "77만" },
            ].map((ai) => (
              <div
                key={ai.name}
                className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-center"
              >
                <div className="text-base font-medium text-gray-900">{ai.name}</div>
                <div className="text-base text-gray-400">{ai.mau}</div>
              </div>
            ))}
          </div>
          <p className="text-base text-blue-600 font-medium">
            Gemini에 100번 물어봤을 때 내 가게가 몇 번 나오는지 정확한 확률(%)로 측정합니다
          </p>
        </div>
      </section>

      {/* 채널 분리 점수 */}
      <section className="py-5 lg:py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">네이버 AI vs 글로벌 AI, 채널별로 점수가 나옵니다</h2>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4">같은 가게라도 네이버에서 강하고 ChatGPT에서 약할 수 있습니다. 채널별 약점을 정확히 파악하세요.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 lg:p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🇰🇷</span>
                <div className="flex-1">
                  <div className="text-base font-semibold text-green-800">네이버 AI 채널</div>
                  <div className="text-base text-gray-500">네이버 AI 브리핑 · 플레이스</div>
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-green-600">82</div>
              </div>
              <ul className="text-base text-gray-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-green-500">✓</span>네이버 AI 브리핑 노출 여부</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>네이버 플레이스 정보 완성도</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>지역 리뷰 품질 및 키워드 다양성</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 lg:p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🌐</span>
                <div className="flex-1">
                  <div className="text-base font-semibold text-blue-800">글로벌 AI 채널</div>
                  <div className="text-base text-gray-500">ChatGPT · Gemini · Perplexity · Grok</div>
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-blue-600">41</div>
              </div>
              <ul className="text-base text-gray-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-blue-500">✓</span>ChatGPT · Gemini 인용 여부</li>
                <li className="flex gap-2"><span className="text-blue-500">✓</span>Google AI Overview 노출 확인</li>
                <li className="flex gap-2"><span className="text-blue-500">✓</span>블로그·온라인 언급 정보 구조화 수준</li>
              </ul>
            </div>
          </div>
          <p className="text-center text-base text-gray-400 mt-6">
            글로벌 AI 점수가 낮으면 → 스마트플레이스 소개글·블로그 포스트 최적화로 즉시 개선 가능
          </p>
        </div>
      </section>

      {/* 샘플 결과 미리보기 */}
      <section className="py-5 lg:py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">이런 결과를 받아보실 수 있습니다</h2>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4">실제 대시보드 화면 — 가입 후 첫 스캔 완료 시 표시됩니다</p>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            {/* 점수 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                <div className="text-base text-gray-400 mb-1">AI 노출 점수</div>
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">67</div>
                <div className="text-base text-green-500 font-medium">↑ 지난주 대비 +8점</div>
                <div className="text-base text-gray-400 mt-1">업종 내 4위 / 23개 중</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                <div className="text-base text-gray-400 mb-1">Gemini 100회 노출</div>
                <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-1">31%</div>
                <div className="text-base text-gray-500">100회 중 31회 내 가게 언급</div>
                <div className="text-base text-gray-400 mt-1">경쟁사 평균 18%</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                <div className="text-base text-gray-400 mb-1">AI 플랫폼 노출</div>
                <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-1">5/8</div>
                <div className="text-base text-gray-500">7개 AI 중 5개에서 언급</div>
                <div className="text-base text-gray-400 mt-1">ChatGPT · 네이버 · Gemini 등</div>
              </div>
            </div>
            {/* AI별 결과 */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
              <div className="text-base font-semibold text-gray-700 mb-3">AI 플랫폼별 노출 현황</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { name: "Gemini", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "ChatGPT", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "네이버 AI", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "Perplexity", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "Google AI", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "Claude", result: "미노출", color: "text-gray-400 bg-gray-50" },
                  { name: "Grok", result: "미노출", color: "text-gray-400 bg-gray-50" },
                ].map((ai) => (
                  <div key={ai.name} className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${ai.color}`}>
                    <div className="text-gray-600 mb-0.5">{ai.name}</div>
                    <div>{ai.result}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 경쟁사 갭 분석 미리보기 */}
            <div className="bg-white rounded-xl p-4 border border-orange-100 mb-3">
              <div className="text-base font-semibold text-gray-700 mb-2">경쟁사 대비 취약 차원 (갭 분석)</div>
              <ul className="space-y-1.5">
                {[
                  { label: "정보 구조화 (AI 코드)", my: 30, top: 75, gap: 45 },
                  { label: "AI 검색 노출 빈도",    my: 31, top: 68, gap: 37 },
                  { label: "온라인 언급",           my: 45, top: 72, gap: 27 },
                ].map((d) => (
                  <li key={d.label} className="text-base">
                    <div className="flex justify-between text-gray-600 mb-0.5">
                      <span>{d.label}</span>
                      <span className="text-orange-500 font-medium">-{d.gap}점 격차</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${d.my}%` }} />
                      </div>
                      <span className="text-gray-400 text-base w-10 text-right">{d.my}점</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* 개선 가이드 미리보기 */}
            <div className="bg-white rounded-xl p-4 border border-blue-100">
              <div className="text-base font-semibold text-gray-700 mb-2">Claude AI 맞춤 개선 가이드</div>
              <ul className="space-y-1.5">
                {[
                  "1위 경쟁사 대비 AI 정보 구조화 45점 격차 → AI 읽기 코드 자동 생성으로 즉시 개선 가능",
                  "사업장 소개에 '주차 가능', '예약 불필요' 등 조건 키워드 추가 → AI 조건 검색 노출 확대",
                  "Google 비즈니스 프로필 + 자주 묻는 질문(FAQ) 등록 → ChatGPT·Google AI 노출 확대",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 text-base text-gray-600">
                    <span className="text-blue-500 shrink-0">→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-center text-base text-gray-400 mt-4">※ 위 화면은 샘플 데이터입니다. 실제 결과는 사업장에 따라 다릅니다.</p>
        </div>
      </section>

      {/* 효과 증명 3단계 */}
      <section className="py-5 lg:py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">효과 증명 3단계 시스템</h2>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4">
            점수 변화뿐 아니라 실제 AI 결과 화면으로 효과를 직접 확인하세요
          </p>
          <div className="space-y-3">
            {EFFECT_LAYERS.map((layer) => (
              <div key={layer.step} className={`border rounded-2xl p-4 md:p-5 ${layer.color}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-base font-medium text-gray-500">{layer.step}</span>
                    <div className="text-base font-bold text-gray-900 mt-0.5">{layer.title}</div>
                  </div>
                  <span className="text-sm font-medium text-gray-400 bg-white/60 px-2 py-1 rounded-full shrink-0 whitespace-nowrap">{layer.badge}</span>
                </div>
                <p className="text-base text-gray-600">{layer.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 업종별 진입 전략 */}
      <section className="bg-gray-50 py-5 lg:py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2 break-keep">업종별 AI 검색 노출 현황</h2>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4">
            업종마다 AI 검색 빈도와 설득 난이도가 다릅니다
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {INDUSTRY_ITEMS.map((item) => (
              <div key={item.name} className="bg-white rounded-xl p-4 lg:p-5 border border-gray-100">
                <item.Icon className="w-6 h-6 lg:w-8 lg:h-8 text-blue-500 mb-2" strokeWidth={1.5} />
                <div className="text-base font-semibold text-gray-900">{item.name}</div>
                <div className="text-base text-gray-400 mt-2 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 카카오톡 알림 */}
      <section className="py-5 lg:py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-2 mb-2">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900">카카오톡 알림 5유형</h2>
            <span className="text-sm bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-medium">출시 준비 중</span>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4">의미 있는 변화가 생겼을 때만 발송 — 불필요한 알림 없음</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { type: "점수 변화",    example: "이번 주 AI 노출: 23% → 31% (↑8%p) · 업종 순위 7위 → 4위", Icon: TrendingUp },
              { type: "AI 인용 실증", example: "ChatGPT가 '강남 치킨 맛집' 질문에 내 가게를 3번 언급했습니다.", Icon: MessageSquare },
              { type: "경쟁사 변화",  example: "경쟁 가게 ○○이 AI 노출 순위 2계단 올랐습니다. 대응 가이드 →", Icon: Store },
              { type: "시장 뉴스",    example: "네이버 AI 탭 상반기 출시. 플레이스 연동됩니다. 사전 최적화 →", Icon: Newspaper },
              { type: "할 일 목록",   example: "이번 달 과제: 스마트플레이스 소개글에 '주차 가능', '예약 불필요' 키워드 추가 → AI 조건 검색 노출 개선", Icon: CheckSquare },
            ].map((item) => (
              <div key={item.type} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <item.Icon className="w-4 h-4 text-blue-500 shrink-0" strokeWidth={1.5} />
                  <span className="text-base font-semibold text-gray-900">{item.type}</span>
                </div>
                <p className="text-base text-gray-500">{item.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 요금제 */}
      <section className="py-5 lg:py-8 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-2">요금제</h2>
          <p className="text-base sm:text-lg lg:text-xl text-center text-gray-500 mb-4">무료 체험으로 시작하고, 필요할 때 업그레이드하세요</p>

          {/* 상단 3개 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {PLANS.slice(0, 3).map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-4 md:p-5 flex flex-col ${
                  plan.highlight
                    ? "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2"
                    : "bg-white border border-gray-200"
                }`}
              >
                {plan.badge && (
                  <div className={`text-sm font-medium mb-3 ${plan.highlight ? "text-blue-100" : "text-blue-600"}`}>
                    {plan.badge}
                  </div>
                )}
                <div className={`text-lg font-bold mb-0.5 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </div>
                <div className={`text-base mb-3 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>
                  {plan.description}
                </div>
                <div className={`text-3xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  {plan.price}
                  <span className={`text-sm font-normal ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>
                    {plan.period}
                  </span>
                </div>
                <ul className="mt-3 mb-4 space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`text-base flex gap-2 ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>
                      <span className={plan.highlight ? "text-blue-200 shrink-0" : "text-blue-500 shrink-0"}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
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
              </div>
            ))}
          </div>

          {/* 하단 2개 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLANS.slice(3).map((plan) => (
              <div key={plan.name} className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 flex flex-col">
                {plan.badge && (
                  <div className="text-sm font-medium text-blue-600 mb-2">{plan.badge}</div>
                )}
                <div className="text-lg font-bold text-gray-900 mb-0.5">{plan.name}</div>
                <div className="text-base text-gray-400 mb-3">{plan.description}</div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {plan.price}
                  <span className="text-sm font-normal text-gray-400">{plan.period}</span>
                </div>
                <ul className="mt-3 mb-4 space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-base flex gap-2 text-gray-600">
                      <span className="text-blue-500 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className="block text-center py-3 rounded-xl font-semibold text-base border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-base text-gray-400 mt-4">
            언제든 해지 · 위약금 없음 · 가입 후 Full 스캔 1회 무료 제공
          </p>
        </div>
      </section>

      {/* 최종 CTA */}
      <section className="bg-blue-600 py-5 lg:py-8 px-6">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">지금 내 가게가 AI에서 어떻게 보이는지 확인해보세요</h2>
          <p className="text-base sm:text-lg lg:text-xl text-blue-100 mb-2 break-keep">
            광고비를 써도 AI 추천 순위는 바뀌지 않습니다. 정보 최적화만이 답입니다.
          </p>
          <p className="text-blue-200 text-base lg:text-lg mb-5 break-keep">
            지금 바로 무료로 내 사업장 AI 노출 점수를 확인해보세요.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/trial"
              className="bg-white text-blue-600 text-lg px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors font-semibold"
            >
              무료로 진단받기
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

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-base text-gray-400">
            AEOlab · AI Engine Optimization Lab · 한국 소상공인 AI 검색 성장 플랫폼
          </div>
          <div className="flex items-center gap-4 text-base text-gray-400">
            <Link href="/pricing" className="hover:text-gray-600">요금제</Link>
            <Link href="/demo"    className="hover:text-gray-600">미리보기</Link>
            <Link href="/trial"   className="hover:text-gray-600">무료 체험</Link>
            <a href="mailto:hello@aeolab.co.kr" className="hover:text-gray-600">문의</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-gray-100 text-sm text-gray-400 leading-relaxed">
          <p>상호: 케이엔디 커뮤니티 (KND Community) &nbsp;|&nbsp; 대표자: 김봉후 &nbsp;|&nbsp; 사업자등록번호: 202-19-10353</p>
          <p>사업장 소재지: 경상남도 김해시 계동로 76-22, 701-903 &nbsp;|&nbsp; 통신판매업번호: 2020-김해장유-0252</p>
        </div>
      </footer>
    </main>
  );
}
