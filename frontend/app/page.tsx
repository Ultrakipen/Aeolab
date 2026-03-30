import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LandingLogout } from "./LandingLogout";
import {
  Stethoscope, BookOpen, Scale, Scissors, UtensilsCrossed, ShoppingBag,
  TrendingUp, MessageSquare, Store, Newspaper, CheckSquare, Lock,
} from "lucide-react";

const BREAKDOWN_ITEMS = [
  { label: "AI 검색 노출 빈도", weight: "30%", desc: "AI가 100번 물어봤을 때 내 가게가 몇 번 나오는지" },
  { label: "리뷰 수·평점·다양성", weight: "20%", desc: "리뷰가 많고 평점 높을수록 AI가 더 자주 추천" },
  { label: "온라인 정보 정리",   weight: "15%", desc: "영업시간·메뉴·주소 등 AI가 인식하는 가게 정보" },
  { label: "온라인 언급 빈도",    weight: "15%", desc: "블로그·SNS·카페에서 내 가게가 언급된 횟수" },
  { label: "정보 완성도",         weight: "10%", desc: "전화번호·사진·메뉴판 등 기본 정보 등록 여부" },
  { label: "콘텐츠 최신성",       weight: "10%", desc: "최근 리뷰·게시글이 있어야 지금도 운영 중으로 인식" },
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
    title: "실제 검색 유입 변화",
    desc: "네이버 플레이스 조회수·저장수가 개선 전후로 얼마나 달라졌는지 연동해 보여줍니다",
    badge: "실제 변화",
    color: "bg-green-50 border-green-200",
  },
  {
    step: "3단계",
    title: "눈으로 보는 비교",
    desc: "가입 즉시 AI 검색 결과 화면이 자동으로 저장됩니다. 30·60·90일 후 화면과 나란히 비교해 개선 효과를 눈으로 직접 확인합니다.",
    badge: "눈으로 확인",
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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600">AEOlab</span>
            <span className="text-xs text-gray-400 hidden sm:block">AI 검색 노출 관리 서비스</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">요금제</Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">대시보드</Link>
                <LandingLogout email={user.email ?? ""} />
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
      <section className="max-w-4xl mx-auto px-6 py-12 sm:py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-full mb-4">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          ChatGPT 광고 미국 시작 (2026.02) — 한국도 곧 옵니다
        </div>
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full mb-6">
          ChatGPT 한국 MAU 2,293만명 · 유료 구독 세계 2위
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          AI가 내 가게를
          <br />
          <span className="text-blue-600">추천하게 만드는</span> 서비스
        </h1>
        <p className="text-base sm:text-xl text-gray-600 mb-3 max-w-2xl mx-auto">
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
            href="/demo"
            className="border border-gray-300 text-gray-700 text-lg px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors"
          >
            결과 화면 미리보기
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">
          신용카드 불필요 · 1분 안에 결과 확인
        </p>
      </section>

      {/* 샘플 결과 미리보기 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
              실제 분석 화면 미리보기
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-4 text-gray-900">이런 분석 결과를 받게 됩니다</h2>
            <p className="text-sm sm:text-base text-gray-500 mt-2">8개 AI 플랫폼에서의 노출 현황을 한눈에 파악하세요</p>
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
                  <div className="text-4xl sm:text-5xl font-bold text-blue-500">67</div>
                  <div className="text-xs sm:text-sm text-gray-400">/ 100점 · B등급</div>
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
              <p className="text-xs text-gray-500 mt-3">
                코딩 지식 없이도 AEOlab이 사업장 정보를 바탕으로 <strong>AI가 읽을 수 있는 구조화 코드를 자동으로 만들어드립니다.</strong> 복사 후 홈페이지에 붙여넣기만 하면 됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 무료 AI vs AEOlab 비교 */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">
            &ldquo;무료 AI로 직접 확인하면 되지 않나요?&rdquo;
          </h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">직접 해보셨다면 알겠지만, 매번 다른 답이 나옵니다.</p>
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
                  "AI 100번 질문 → 정확한 노출 확률(%) 측정",
                  "8개 AI 한 곳에서 통합 분석",
                  "전후 비교 카드로 개선 효과 눈으로 확인",
                  "경쟁사 격차 분석 + 맞춤 개선 가이드 제공",
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
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">AI 노출 점수, 이렇게 계산합니다</h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">6개 항목으로 경쟁사와 비교해 내 가게의 약점을 수치로 알려줍니다</p>
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

      {/* 8개 AI 플랫폼 */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">8개 AI 플랫폼 한 번에 분석</h2>
          <p className="text-sm sm:text-base text-gray-500 mb-3">소상공인이 8개 AI를 일일이 확인하는 것은 불가능합니다.</p>
          <p className="text-xs sm:text-sm text-gray-400 mb-8">
            ChatGPT 2,293만 · Grok 153만 · Perplexity 152만 · Claude 77만 명 (와이즈앱 2026.02 기준)
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {[
              { name: "Gemini", mau: "주력 AI" },
              { name: "ChatGPT", mau: "2,293만" },
              { name: "네이버 AI", mau: "AI 브리핑" },
              { name: "Google AI", mau: "AI 오버뷰" },
              { name: "Perplexity", mau: "152만" },
              { name: "Grok AI", mau: "153만" },
              { name: "Claude", mau: "77만" },
              { name: "뤼튼", mau: "국내 AI" },
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
            AI에 100번 물어봤을 때 내 가게가 몇 번 나오는지 정확한 확률(%)로 측정합니다
          </p>
        </div>
      </section>

      {/* 채널 분리 점수 */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">네이버 AI vs 글로벌 AI, 채널별로 점수가 나옵니다</h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">같은 가게라도 네이버에서 강하고 ChatGPT에서 약할 수 있습니다. 채널별 약점을 정확히 파악하세요.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🇰🇷</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-green-800">네이버 AI 채널</div>
                  <div className="text-xs text-gray-500">네이버 AI 브리핑 · 플레이스</div>
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-green-600">82</div>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-green-500">✓</span>네이버 AI 브리핑 노출 여부</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>네이버 플레이스 정보 완성도</li>
                <li className="flex gap-2"><span className="text-green-500">✓</span>지역 리뷰 품질 및 키워드 다양성</li>
              </ul>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🌐</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-blue-800">글로벌 AI 채널</div>
                  <div className="text-xs text-gray-500">ChatGPT · Gemini · Perplexity · Grok</div>
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-blue-600">41</div>
              </div>
              <ul className="text-xs text-gray-600 space-y-1.5">
                <li className="flex gap-2"><span className="text-blue-500">✓</span>ChatGPT · Gemini 인용 여부</li>
                <li className="flex gap-2"><span className="text-blue-500">✓</span>Google AI Overview 노출 확인</li>
                <li className="flex gap-2"><span className="text-blue-500">✓</span>웹사이트 Schema 구조화 수준</li>
              </ul>
            </div>
          </div>
          <p className="text-center text-sm text-gray-400 mt-6">
            글로벌 AI 점수가 낮으면 → Schema JSON-LD 자동 생성으로 즉시 개선 가능
          </p>
        </div>
      </section>

      {/* 샘플 결과 미리보기 */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">이런 결과를 받아보실 수 있습니다</h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">실제 대시보드 화면 — 가입 후 첫 스캔 완료 시 표시됩니다</p>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            {/* 점수 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">AI Visibility Score</div>
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">67</div>
                <div className="text-xs text-green-500 font-medium">↑ 지난주 대비 +8점</div>
                <div className="text-xs text-gray-400 mt-1">업종 내 4위 / 23개 중</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">Gemini 100회 노출</div>
                <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-1">31%</div>
                <div className="text-xs text-gray-500">100회 중 31회 내 가게 언급</div>
                <div className="text-xs text-gray-400 mt-1">경쟁사 평균 18%</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <div className="text-xs text-gray-400 mb-1">AI 플랫폼 노출</div>
                <div className="text-3xl sm:text-4xl font-bold text-purple-600 mb-1">5/8</div>
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
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">효과 증명 3단계 시스템</h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">
            점수 변화뿐 아니라 실제 AI 결과 화면으로 효과를 직접 확인하세요
          </p>
          <div className="space-y-4">
            {EFFECT_LAYERS.map((layer) => (
              <div key={layer.step} className={`border rounded-2xl p-6 ${layer.color}`}>
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <span className="text-xs font-medium text-gray-500">{layer.step}</span>
                    <div className="text-base font-bold text-gray-900 mt-0.5">{layer.title}</div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">{layer.desc}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="text-xs font-medium text-gray-400 bg-white/60 px-2 py-1 rounded-full">{layer.badge}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 업종별 진입 전략 */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">업종별 AI 검색 노출 현황</h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">
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
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">주간 카카오톡 알림 5유형</h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">의미 있는 변화가 생겼을 때만 발송 — 불필요한 알림 없음</p>
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

      {/* 요금제 요약 */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">요금제</h2>
          <p className="text-sm sm:text-base text-center text-gray-500 mb-10">무료 체험으로 시작하고, 필요할 때 업그레이드하세요</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              {
                name: "Basic",
                price: "9,900원",
                period: "/ 월",
                highlight: true,
                badge: "가장 인기",
                desc: "AI 검색 모니터링",
                features: ["Gemini+네이버 자동 스캔 매일", "8개 AI 전체 스캔 주 1회", "경쟁사 3개 비교", "AI 개선 가이드 월 2회", "점수 히스토리 30일", "주간 카카오톡 알림"],
                href: "/signup",
                cta: "1분 무료 회원가입",
              },
              {
                name: "Pro",
                price: "29,900원",
                period: "/ 월",
                highlight: false,
                badge: "적극 관리형",
                desc: "전채널 분석 + 개선",
                features: ["8개 AI 자동 스캔 매일", "수동 스캔 하루 5회", "경쟁사 10개 비교", "AI 개선 가이드 월 10회", "PDF · CSV 내보내기", "히스토리 90일"],
                href: "/pricing",
                cta: "자세히 보기",
              },
              {
                name: "창업 패키지",
                price: "39,900원",
                period: "/ 3개월",
                highlight: false,
                badge: "예비 창업자",
                desc: "창업 전 시장 분석 특화",
                features: ["8개 AI 자동 스캔 매일", "업종 경쟁 강도 분석", "틈새 시장 발굴 가이드", "경쟁사 10개 분석", "3개월 추세 추적"],
                href: "/pricing",
                cta: "자세히 보기",
              },
            ] as const).map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border flex flex-col ${plan.highlight ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200"}`}
              >
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mb-3 inline-block self-start ${plan.highlight ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"}`}>
                  {plan.badge}
                </span>
                <div className={`text-lg sm:text-xl font-bold mb-0.5 ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.name}</div>
                <div className={`text-sm mb-4 ${plan.highlight ? "text-blue-100" : "text-gray-500"}`}>{plan.desc}</div>
                <div className="mb-4">
                  <span className={`text-2xl sm:text-3xl font-bold ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.price}</span>
                  <span className={`text-sm ml-1 ${plan.highlight ? "text-blue-200" : "text-gray-400"}`}>{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`text-xs flex gap-2 ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>
                      <span className={plan.highlight ? "text-blue-200 shrink-0" : "text-blue-500 shrink-0"}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${plan.highlight ? "bg-white text-blue-600 hover:bg-blue-50" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-6">
            가입 후 Full 스캔 1회 무료 제공 · 이후 월 9,900원 · 언제든 해지 · 위약금 없음
          </p>
        </div>
      </section>

      {/* 최종 CTA */}
      <section className="bg-blue-600 py-16 px-6">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">지금 내 가게가 AI에서 어떻게 보이는지 확인해보세요</h2>
          <p className="text-sm sm:text-base text-blue-100 mb-2">
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
          <div className="text-sm text-gray-400">
            AEOlab · AI Engine Optimization Lab · 한국 소상공인 AI 검색 성장 플랫폼
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <Link href="/pricing" className="hover:text-gray-600">요금제</Link>
            <Link href="/demo"    className="hover:text-gray-600">미리보기</Link>
            <Link href="/trial"   className="hover:text-gray-600">무료 체험</Link>
            <a href="mailto:hello@aeolab.co.kr" className="hover:text-gray-600">문의</a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
          <p>상호: 케이엔디 커뮤니티 (KND Community) &nbsp;|&nbsp; 대표자: 김봉후 &nbsp;|&nbsp; 사업자등록번호: 202-19-10353</p>
          <p>사업장 소재지: 경상남도 김해시 계동로 76-22, 701-903 &nbsp;|&nbsp; 통신판매업번호: 2020-김해장유-0252</p>
        </div>
      </footer>
    </main>
  );
}
