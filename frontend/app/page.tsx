import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import {
  Stethoscope, BookOpen, Scale, Scissors, UtensilsCrossed, ShoppingBag,
  TrendingUp, MessageSquare, Store, Newspaper, CheckSquare, Lock,
} from "lucide-react";

const BREAKDOWN_ITEMS = [
  { label: "AI 검색 노출 빈도", weight: "30%", desc: "6개 AI 100회 샘플링 기반" },
  { label: "리뷰 수·평점·다양성", weight: "20%", desc: "키워드 다양성 AI 선호" },
  { label: "Schema 구조화",      weight: "15%", desc: "AI가 읽는 JSON-LD 데이터" },
  { label: "온라인 언급 빈도",    weight: "15%", desc: "블로그·SNS·커뮤니티" },
  { label: "정보 완성도",         weight: "10%", desc: "플레이스·웹사이트 기본 정보" },
  { label: "콘텐츠 최신성",       weight: "10%", desc: "최근 업데이트 빈도" },
];

const EFFECT_LAYERS = [
  {
    layer: "레이어 1",
    title: "AI Visibility Score",
    desc: "100회 샘플링 기반 노출 빈도 + 경쟁사 대비 순위 + 시간 추세",
    star: "★★★☆☆",
    color: "bg-blue-50 border-blue-200",
  },
  {
    layer: "레이어 2",
    title: "검색 유입 신호",
    desc: "네이버 플레이스 조회수·저장수 Before/After 변화 연동",
    star: "★★★★☆",
    color: "bg-green-50 border-green-200",
  },
  {
    layer: "레이어 3",
    title: "Before/After 시각 증거",
    desc: "가입 시점 AI 결과 스크린샷 → 30·60·90일 후 비교 카드 자동 생성",
    star: "★★★★★",
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
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="border-b border-gray-100 px-6 py-4 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600">AEOlab</span>
            <span className="text-xs text-gray-400 hidden sm:block">AI Engine Optimization Lab</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">요금제</Link>
            {session ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">대시보드</Link>
                <LandingLogout email={session.user.email ?? ""} />
              </>
            ) : (
              <>
                <Link href="/login"  className="text-sm text-gray-600 hover:text-gray-900">로그인</Link>
                <Link href="/signup" className="text-sm text-gray-600 hover:text-gray-900">회원가입</Link>
                <Link
                  href="/trial"
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  무료 체험
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* 히어로 */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-full mb-4">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          ChatGPT 광고 미국 시작 (2026.02) — 한국도 곧 옵니다
        </div>
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full mb-6">
          ChatGPT 한국 MAU 2,162만명 · 유료 구독 세계 2위
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight">
          AI가 내 가게를
          <br />
          <span className="text-blue-600">추천하게 만드는</span> 서비스
        </h1>
        <p className="text-xl text-gray-600 mb-3 max-w-2xl mx-auto">
          경쟁 사업체를 분석해 기준을 만들고, 내 사업장을 진단하여
          <br className="hidden sm:block" />
          ChatGPT·네이버 AI·구글에서 더 많이 노출되도록 도와드립니다.
        </p>
        <p className="text-sm text-gray-400 mb-8">
          광고비를 아무리 써도 AI 추천 순위는 바뀌지 않습니다. 정보 최적화가 유일한 방법입니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/trial"
            className="bg-blue-600 text-white text-lg px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            무료로 내 가게 진단받기
          </Link>
          <Link
            href="/pricing"
            className="border border-gray-300 text-gray-700 text-lg px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors"
          >
            요금제 보기 (월 9,900원~)
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">신용카드 불필요 · 1분 안에 결과 확인</p>
      </section>

      {/* 샘플 결과 미리보기 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
              실제 분석 화면 미리보기
            </span>
            <h2 className="text-3xl font-bold mt-4 text-gray-900">이런 분석 결과를 받게 됩니다</h2>
            <p className="text-gray-500 mt-2">8개 AI 플랫폼에서의 노출 현황을 한눈에 파악하세요</p>
          </div>
          <div className="relative">
            {/* 샘플 스코어카드 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">강남구 · 분식</p>
                  <h3 className="text-xl font-bold text-gray-900">강남 맛집 김씨네 떡볶이</h3>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-blue-500">67</div>
                  <div className="text-sm text-gray-400">/ 100점 · B등급</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "AI 검색 노출 빈도", score: 68, color: "bg-blue-500" },
                  { label: "리뷰 품질", score: 72, color: "bg-green-500" },
                  { label: "웹 콘텐츠 구조화", score: 45, color: "bg-yellow-500" },
                  { label: "온라인 언급 빈도", score: 80, color: "bg-green-500" },
                  { label: "정보 완성도", score: 90, color: "bg-green-500" },
                  { label: "콘텐츠 최신성", score: 55, color: "bg-yellow-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="text-xs text-gray-500 w-32 shrink-0">{item.label}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.score}%` }} />
                    </div>
                    <div className="text-xs text-gray-500 w-8 text-right">{item.score}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2">
                {[
                  { name: "Gemini", mentioned: true, freq: "100회 중 68회" },
                  { name: "ChatGPT", mentioned: true, freq: "언급됨" },
                  { name: "Perplexity", mentioned: false, freq: "미언급" },
                  { name: "Naver AI", mentioned: true, freq: "AI 브리핑 포함" },
                  { name: "Claude", mentioned: false, freq: "미언급" },
                  { name: "Grok", mentioned: false, freq: "미언급" },
                ].map((p) => (
                  <div key={p.name} className={`rounded-lg p-2 text-xs text-center ${p.mentioned ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                    <div className="font-medium">{p.name}</div>
                    <div>{p.freq}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 흐림 효과 + CTA 오버레이 */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-gray-50 to-transparent" />
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <Link
                href="/trial"
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors inline-block shadow-lg"
              >
                내 사업장 무료 분석하기 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 네이버 크롤링 차단 브릿지 섹션 */}
      <section className="bg-yellow-50 border-y border-yellow-100 py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-1">
              <Lock className="w-7 h-7 text-yellow-600" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                2025년부터 네이버가 ChatGPT 크롤링을 전면 차단했습니다
              </h2>
              <p className="text-gray-600 text-sm mb-3">
                ChatGPT는 더 이상 네이버 플레이스의 사업장 정보를 직접 읽을 수 없습니다.
                소상공인이 <strong>ChatGPT가 읽을 수 있는 별도 데이터 구조</strong>를 만들어야 하는 이유입니다.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-white border border-yellow-200 text-yellow-800 text-xs px-3 py-1 rounded-full">
                  네이버 플레이스 → ChatGPT 직접 수집 불가
                </span>
                <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                  AEOlab = 그 사이의 브릿지 역할
                </span>
                <span className="bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
                  Schema JSON-LD 자동 생성으로 해결
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 무료 AI vs AEOlab 비교 */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
            &ldquo;무료 AI로 직접 확인하면 되지 않나요?&rdquo;
          </h2>
          <p className="text-center text-gray-500 mb-10">직접 해보셨다면 알겠지만, 매번 다른 답이 나옵니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="text-red-500 font-semibold mb-4">무료 AI 직접 사용</div>
              <ul className="space-y-3 text-sm text-gray-600">
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
            <div className="bg-blue-600 rounded-xl p-6 text-white">
              <div className="font-semibold mb-4">AEOlab</div>
              <ul className="space-y-3 text-sm">
                {[
                  "자동 수집, 변화 시 카카오톡 알림",
                  "100회 샘플링 → 정확한 노출 확률 + 신뢰구간",
                  "6개 AI 한곳에서 통합 분석",
                  "Before/After 자동 추적·비교 카드",
                  "경쟁사 대비 격차 분석 + AI 개선 가이드",
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
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">AI Visibility Score</h2>
          <p className="text-center text-gray-500 mb-10">6개 항목 가중 평균 — 경쟁사와 비교해 격차를 수치로 보여줍니다</p>
          <div className="space-y-3">
            {BREAKDOWN_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                <div className="w-12 text-right">
                  <span className="text-sm font-bold text-blue-600">{item.weight}</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.desc}</div>
                </div>
                <div
                  className="h-2 bg-blue-500 rounded-full"
                  style={{ width: `${parseInt(item.weight)}%`, minWidth: "8px", maxWidth: "100px" }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6개 AI 플랫폼 */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">6개 AI 플랫폼 통합 분석</h2>
          <p className="text-gray-500 mb-3">소상공인이 6개 AI를 개별 추적하는 것은 불가능합니다.</p>
          <p className="text-sm text-gray-400 mb-8">
            ChatGPT 2,162만 · Grok 153만 · Perplexity 152만 · Claude 77만 명 (2026.02 한국 기준)
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {[
              { name: "ChatGPT", mau: "2,162만" },
              { name: "네이버 AI", mau: "AI 브리핑" },
              { name: "Google AI", mau: "AI 오버뷰" },
              { name: "Perplexity", mau: "152만" },
              { name: "Grok AI", mau: "153만" },
              { name: "Claude", mau: "77만" },
            ].map((ai) => (
              <div
                key={ai.name}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center"
              >
                <div className="text-sm font-medium text-gray-900">{ai.name}</div>
                <div className="text-xs text-gray-400">{ai.mau}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-blue-600 font-medium">
            100회 샘플링으로 각 AI에서 내 가게가 언급되는 실제 빈도를 측정합니다
          </p>
        </div>
      </section>

      {/* 샘플 결과 미리보기 */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">이런 결과를 받아보실 수 있습니다</h2>
          <p className="text-center text-gray-500 mb-10">실제 대시보드 화면 — 가입 후 첫 스캔 완료 시 표시됩니다</p>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            {/* 점수 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">AI Visibility Score</div>
                <div className="text-4xl font-bold text-blue-600 mb-1">67</div>
                <div className="text-xs text-green-500 font-medium">↑ 지난주 대비 +8점</div>
                <div className="text-xs text-gray-400 mt-1">업종 내 4위 / 23개 중</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">Gemini 100회 노출</div>
                <div className="text-4xl font-bold text-green-600 mb-1">31%</div>
                <div className="text-xs text-gray-500">100회 중 31회 내 가게 언급</div>
                <div className="text-xs text-gray-400 mt-1">경쟁사 평균 18%</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">AI 플랫폼 노출</div>
                <div className="text-4xl font-bold text-purple-600 mb-1">5/8</div>
                <div className="text-xs text-gray-500">8개 AI 중 5개에서 언급</div>
                <div className="text-xs text-gray-400 mt-1">ChatGPT · 네이버 · Gemini 등</div>
              </div>
            </div>
            {/* AI별 결과 */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
              <div className="text-xs font-semibold text-gray-700 mb-3">AI 플랫폼별 노출 현황</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { name: "Gemini", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "ChatGPT", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "네이버 AI", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "Perplexity", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "Google AI", result: "노출", color: "text-green-600 bg-green-50" },
                  { name: "Claude", result: "미노출", color: "text-gray-400 bg-gray-50" },
                  { name: "Grok", result: "미노출", color: "text-gray-400 bg-gray-50" },
                  { name: "뤼튼", result: "미노출", color: "text-gray-400 bg-gray-50" },
                ].map((ai) => (
                  <div key={ai.name} className={`rounded-lg px-3 py-2 text-center text-xs font-medium ${ai.color}`}>
                    <div className="text-gray-600 mb-0.5">{ai.name}</div>
                    <div>{ai.result}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 개선 가이드 미리보기 */}
            <div className="bg-white rounded-xl p-4 border border-blue-100">
              <div className="text-xs font-semibold text-gray-700 mb-2">AI 개선 가이드 (Claude 자동 생성)</div>
              <ul className="space-y-1.5">
                {[
                  "사업장 소개에 '주차 가능', '예약 불필요' 키워드 추가 → 인용 확률 +15%",
                  "네이버 플레이스 사진 5장 이상 추가 → Google AI Overview 노출 개선",
                  "FAQ Schema 등록: '영업시간', '주소', '메뉴 가격' 구조화 데이터 추가",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-600">
                    <span className="text-blue-500 shrink-0">→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">※ 위 화면은 샘플 데이터입니다. 실제 결과는 사업장에 따라 다릅니다.</p>
        </div>
      </section>

      {/* 효과 증명 3단계 */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">효과 증명 3단계 시스템</h2>
          <p className="text-center text-gray-500 mb-10">
            점수 변화뿐 아니라 실제 AI 결과 화면으로 효과를 직접 확인하세요
          </p>
          <div className="space-y-4">
            {EFFECT_LAYERS.map((layer) => (
              <div key={layer.layer} className={`border rounded-2xl p-6 ${layer.color}`}>
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <span className="text-xs font-medium text-gray-500">{layer.layer}</span>
                    <div className="text-base font-bold text-gray-900 mt-0.5">{layer.title}</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">{layer.desc}</p>
                  </div>
                  <div className="shrink-0 text-sm text-yellow-500">{layer.star}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 업종별 진입 전략 */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">업종별 AI 검색 노출 현황</h2>
          <p className="text-center text-gray-500 mb-10">
            업종마다 AI 검색 빈도와 설득 난이도가 다릅니다
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {INDUSTRY_ITEMS.map((item) => (
              <div key={item.name} className="bg-white rounded-xl p-4 border border-gray-100">
                <item.Icon className="w-6 h-6 text-blue-500 mb-2" strokeWidth={1.5} />
                <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-400 mt-2">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 카카오톡 알림 */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">주간 카카오톡 알림 5유형</h2>
          <p className="text-center text-gray-500 mb-10">의미 있는 변화가 생겼을 때만 발송 — 불필요한 알림 없음</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { type: "점수 변화",    example: "이번 주 AI 노출: 23% → 31% (↑8%p) · 업종 순위 7위 → 4위", Icon: TrendingUp },
              { type: "AI 인용 실증", example: "ChatGPT가 '강남 치킨 맛집' 질문에 내 가게를 3번 언급했습니다.", Icon: MessageSquare },
              { type: "경쟁사 변화",  example: "경쟁 가게 ○○이 AI 노출 순위 2계단 올랐습니다. 대응 가이드 →", Icon: Store },
              { type: "시장 뉴스",    example: "네이버 AI 탭 상반기 출시. 플레이스 연동됩니다. 사전 최적화 →", Icon: Newspaper },
              { type: "할 일 목록",   example: "이번 달 과제: 메뉴 설명에 주차 가능 키워드 추가 → 인용 확률 +12%", Icon: CheckSquare },
            ].map((item) => (
              <div key={item.type} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <item.Icon className="w-4 h-4 text-blue-500 shrink-0" strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-gray-900">{item.type}</span>
                </div>
                <p className="text-xs text-gray-500">{item.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 최종 CTA */}
      <section className="bg-blue-600 py-16 px-6">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="text-2xl font-bold mb-2">지금 내 가게가 AI에서 어떻게 보이는지 확인해보세요</h2>
          <p className="text-blue-100 mb-2">
            광고비를 써도 AI 추천 순위는 바뀌지 않습니다. 정보 최적화만이 답입니다.
          </p>
          <p className="text-blue-200 text-sm mb-8">
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
              href="/pricing"
              className="border border-blue-400 text-white text-lg px-8 py-4 rounded-xl hover:bg-blue-700 transition-colors"
            >
              월 9,900원 시작
            </Link>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            AEOlab · AI Engine Optimization Lab · 한국 소상공인 AI 검색 성장 플랫폼
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <Link href="/pricing" className="hover:text-gray-600">요금제</Link>
            <Link href="/trial"   className="hover:text-gray-600">무료 체험</Link>
            <a href="mailto:hello@aeolab.co.kr" className="hover:text-gray-600">문의</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
