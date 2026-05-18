"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  AlertTriangle,
  Brain,
  BarChart2,
  Lightbulb,
  FlaskConical,
  Table2,
  CheckSquare,
  HelpCircle,
  Sparkles,
  Target,
  FileText,
  MessageSquare,
  BookOpen,
  TrendingUp,
  Search,
  Award,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// 체크리스트 섹션 (useState 필요)
// ---------------------------------------------------------------------------
function ChecklistSection() {
  const items = [
    "스마트플레이스 소개글 200자 이상 + 키워드 3개 이상 포함 확인",
    "스마트플레이스에 사진 10장 이상 등록",
    "최근 30일 내 소식 1회 이상 게시",
    "구글 지도/네이버 지도에 사업장 등록 완료",
    "웹사이트가 있다면 JSON-LD 구조화 데이터 적용 (AEOlab 자동 생성 → /schema)",
    "AEOlab 스캔 결과에서 ChatGPT 노출률 40% 미만이면 소개글 개선 우선",
  ];

  const [checked, setChecked] = useState<boolean[]>(Array(items.length).fill(false));

  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const done = checked.filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm md:text-base font-semibold text-gray-700">
          완료 {done}/{items.length}
        </span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => toggle(i)}
          className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
            checked[i]
              ? "bg-indigo-50 border-indigo-200 text-indigo-800"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <span
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              checked[i] ? "bg-indigo-500 border-indigo-500" : "border-gray-300"
            }`}
          >
            {checked[i] && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="text-sm md:text-base leading-snug">{item}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ 아이템
// ---------------------------------------------------------------------------
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm md:text-base font-medium text-gray-800">{q}</span>
        <span className="flex-shrink-0 text-gray-400 text-lg leading-none">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 bg-gray-50 text-sm md:text-base text-gray-700 leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 페이지
// ---------------------------------------------------------------------------
export default function ChatGPTSearchGuidePage() {
  return (
    <div className="max-w-[840px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-10">
      {/* 뒤로가기 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href="/guide"
          className="inline-flex items-center gap-1 text-sm md:text-base text-gray-500 hover:text-indigo-600"
        >
          <ChevronLeft className="w-4 h-4" /> 가이드로 돌아가기
        </Link>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-1 text-sm md:text-base text-indigo-600 hover:underline font-medium"
        >
          서비스 안내 매뉴얼 →
        </Link>
      </div>

      {/* 헤더 */}
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep leading-tight">
          ChatGPT · Gemini · Google AI 노출 최적화 가이드
        </h1>
        <p className="text-base md:text-lg text-gray-700 leading-relaxed break-keep">
          AI가 우리 가게를 어떻게 학습하는지 이해하고, 노출 가능성을 높이는 7가지 방법
        </p>

        {/* 면책 배너 #1 */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm md:text-base text-amber-800 leading-relaxed">
            <span className="font-semibold">측정 한계 안내: </span>
            ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
            측정 시점·기기·로그인 상태에 따라 달라질 수 있음.
          </p>
        </div>
      </div>

      {/* 섹션 1: AI 학습 원리 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            1. AI는 어떻게 가게를 학습하나요?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: <MessageSquare className="w-5 h-5 text-violet-500" />,
              color: "border-violet-100 bg-violet-50",
              title: "ChatGPT (GPT-4o-mini)",
              desc: "인터넷 공개 데이터를 학습. 업데이트 주기가 불규칙하며 실시간 검색이 아님. 학습 완료 시점의 데이터 기준으로 답변.",
            },
            {
              icon: <Search className="w-5 h-5 text-blue-500" />,
              color: "border-blue-100 bg-blue-50",
              title: "Gemini",
              desc: "Google 검색 데이터 + 웹 인덱싱. 스마트플레이스·Google 지도 정보와 연동 가능. 최신 콘텐츠에 빠르게 반응.",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-slate-500" />,
              color: "border-slate-100 bg-slate-50",
              title: "Google AI Overview",
              desc: "실시간 검색 결과 기반. 구조화 데이터(JSON-LD)를 우선 인용. 빠른 색인이 유리.",
            },
            {
              icon: <BarChart2 className="w-5 h-5 text-indigo-500" />,
              color: "border-indigo-100 bg-indigo-50",
              title: "AEOlab 측정 방식",
              desc: "Gemini 50회 + ChatGPT 50회 병렬 질의 → 언급 빈도(%) 산출. 단순 있다/없다가 아닌 통계적 신뢰도 포함.",
            },
          ].map(({ icon, color, title, desc }) => (
            <div
              key={title}
              className={`flex flex-col gap-2 p-4 rounded-xl border ${color}`}
            >
              <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm md:text-base font-semibold text-gray-800">
                  {title}
                </span>
              </div>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 섹션 2: 측정 결과 해석 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            2. 측정 결과 해석 방법
          </h2>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {[
            {
              label: "exposure_rate",
              value: "전체 질의 중 언급된 비율 (예: 50회 중 30회 = 60%)",
            },
            {
              label: "신뢰 구간 (Wilson CI)",
              value: "50회 샘플의 오차 범위 포함 — 60% ± 13%p 수준으로 이해",
            },
            {
              label: "'60% 노출'의 의미",
              value: "비슷한 질문 10번 중 약 6번 언급됨 (추정). 절대값이 아닌 상대적 지표.",
            },
            {
              label: "INACTIVE 업종 특이사항",
              value: "AI 브리핑 대상은 아니지만 ChatGPT·Gemini 노출은 동등하게 측정·개선 가능.",
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3">
              <span className="text-sm md:text-base font-semibold text-gray-700 sm:w-48 flex-shrink-0">
                {label}
              </span>
              <span className="text-sm md:text-base text-gray-600 leading-relaxed">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 섹션 3: 7가지 최적화 방법 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-violet-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            3. 7가지 최적화 방법
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              num: 1,
              icon: <FileText className="w-5 h-5 text-indigo-500" />,
              title: "스마트플레이스 소개글 최적화",
              desc: "200자 이상, 지역+업종 키워드 포함, Q&A 형식으로 작성. ChatGPT는 공개된 소개글 텍스트를 학습 소스로 활용합니다.",
            },
            {
              num: 2,
              icon: <Sparkles className="w-5 h-5 text-violet-500" />,
              title: "블로그·SNS 외부 언급 확대",
              desc: "네이버 블로그, 카카오 채널, 인스타그램에 가게명+업종 키워드 조합으로 꾸준히 게시. 외부 언급 횟수가 학습 확률을 높입니다.",
            },
            {
              num: 3,
              icon: <Search className="w-5 h-5 text-blue-500" />,
              title: "웹사이트 구조화 데이터(JSON-LD)",
              desc: "LocalBusiness 스키마 추가 시 Google AI Overview 인용 확률 상승. AEOlab에서 자동 생성을 제공합니다 (→ /schema).",
            },
            {
              num: 4,
              icon: <MessageSquare className="w-5 h-5 text-emerald-500" />,
              title: "리뷰 키워드 관리",
              desc: "긍정 키워드가 포함된 리뷰 답글을 작성하세요. ChatGPT 학습 데이터에 리뷰 텍스트가 포함될 수 있습니다.",
            },
            {
              num: 5,
              icon: <TrendingUp className="w-5 h-5 text-amber-500" />,
              title: "소식 정기 업로드",
              desc: "스마트플레이스 소식을 주 1회 이상 게시 → 최신성 신호 제공. Gemini는 최신 콘텐츠를 우선 인용하는 경향이 있습니다.",
            },
            {
              num: 6,
              icon: <Target className="w-5 h-5 text-rose-500" />,
              title: "업종+지역 키워드 조합 최적화",
              desc: '"강남 의원", "홍대 인테리어" 등 롱테일 키워드를 소개글·소식에 자연스럽게 포함하세요. AI는 구체적 키워드 조합에 더 잘 반응합니다.',
            },
            {
              num: 7,
              icon: <Award className="w-5 h-5 text-slate-500" />,
              title: "경쟁사 대비 콘텐츠 품질",
              desc: "경쟁사보다 FAQ·소개글이 풍부하면 AI가 우선 인용합니다. AEOlab 키워드 갭 분석을 활용해 부족한 영역을 찾아보세요.",
            },
          ].map(({ num, icon, title, desc }) => (
            <div
              key={num}
              className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                {num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {icon}
                  <span className="text-sm md:text-base font-semibold text-gray-800">
                    {title}
                  </span>
                </div>
                <p className="text-sm md:text-base text-gray-600 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 섹션 4: 측정 방식 투명성 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-4 h-4 text-slate-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            4. AEOlab의 ChatGPT 측정 방식 (투명성)
          </h2>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-6 space-y-3">
          {[
            {
              label: "측정 흐름",
              value: "Gemini·ChatGPT 각 50회 질의 → 언급 여부 집계 → 노출률 산출",
            },
            { label: "사용 모델", value: "OpenAI GPT-4o-mini (ChatGPT 계열, 저비용·고속)" },
            {
              label: "질의 방식",
              value: "지역+업종 키워드 3가지 변형으로 다양화 (단일 패턴 편향 방지)",
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-4">
              <span className="text-sm md:text-base font-semibold text-slate-700 sm:w-32 flex-shrink-0">
                {label}
              </span>
              <span className="text-sm md:text-base text-slate-600 leading-relaxed">{value}</span>
            </div>
          ))}

          {/* 면책 배너 #2 */}
          <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              <span className="font-semibold">한계: </span>
              ChatGPT 실시간 답변과 다를 수 있습니다. 모델 내부 확률 기반 추정값이며
              ChatGPT 앱 사용 결과와 차이가 있을 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 섹션 5: 업종별 중요도 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Table2 className="w-4 h-4 text-emerald-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            5. 업종별 ChatGPT 최적화 중요도
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-[480px] w-full text-sm md:text-base">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">그룹</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">업종 예시</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">주요 채널</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="bg-white">
                <td className="px-4 py-3">
                  <span className="inline-block bg-emerald-100 text-emerald-700 text-sm font-semibold px-2 py-0.5 rounded-lg">
                    ACTIVE
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">음식점·카페·숙박</td>
                <td className="px-4 py-3 text-gray-600 leading-relaxed">
                  네이버 AI브리핑 + AI탭 + ChatGPT 3중 채널
                </td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-3">
                  <span className="inline-block bg-blue-100 text-blue-700 text-sm font-semibold px-2 py-0.5 rounded-lg">
                    LIKELY
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">뷰티·피트니스</td>
                <td className="px-4 py-3 text-gray-600 leading-relaxed">
                  AI브리핑 확대 예정 + ChatGPT 핵심 채널
                </td>
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-3">
                  <span className="inline-block bg-slate-100 text-slate-700 text-sm font-semibold px-2 py-0.5 rounded-lg">
                    INACTIVE
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">의원·법무·교육</td>
                <td className="px-4 py-3 text-gray-600 leading-relaxed">
                  ChatGPT·Gemini·Google AI가 주요 채널 → 특히 중요
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 섹션 6: 체크리스트 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            6. 빠른 시작 체크리스트
          </h2>
        </div>
        <ChecklistSection />
      </section>

      {/* 섹션 7: FAQ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">7. 자주 묻는 질문</h2>
        </div>

        <div className="space-y-3">
          <FaqItem
            q="ChatGPT 노출률이 0%면 아무도 못 찾나요?"
            a="50회 질의에서 언급이 없었음을 의미합니다. 소개글·블로그 콘텐츠를 보강한 후 재스캔하면 달라질 수 있습니다. 노출률 0%는 현재 학습 데이터 기준이며, 콘텐츠 개선 효과는 수 주에서 수 개월 후 반영됩니다."
          />
          <FaqItem
            q="ChatGPT에 광고를 하면 더 잘 나오나요?"
            a="아닙니다. ChatGPT는 광고 시스템이 없으며 학습 데이터 기반으로만 답변합니다. 콘텐츠 품질과 외부 언급 빈도가 핵심이며, 광고비로 노출을 구매하는 것은 불가능합니다."
          />
          <FaqItem
            q="측정에 사용하는 ChatGPT 버전이 실제 ChatGPT앱과 다른가요?"
            a="AEOlab은 OpenAI API(GPT-4o-mini)를 사용합니다. 실제 ChatGPT앱(GPT-4o)과 학습 데이터 기반은 동일하지만 내부 가중치가 다를 수 있어 결과 차이가 있을 수 있습니다. 이 면책 사항은 측정 결과 옆에 항상 표시됩니다."
          />
        </div>
      </section>

      {/* 하단 CTA */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200">
        <Link
          href="/dashboard"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-3 text-sm md:text-base transition-colors min-h-[44px]"
        >
          <BarChart2 className="w-4 h-4" />
          ChatGPT 노출률 지금 측정하기 →
        </Link>
        <Link
          href="/trial"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold rounded-xl px-5 py-3 text-sm md:text-base transition-colors min-h-[44px]"
        >
          <ExternalLink className="w-4 h-4" />
          무료 체험으로 먼저 확인하기
        </Link>
        <Link
          href="/guide/ai-info-tab"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-gray-200 text-gray-700 font-semibold rounded-xl px-5 py-3 text-sm md:text-base transition-colors min-h-[44px]"
        >
          <BookOpen className="w-4 h-4" />
          AI탭 최적화 가이드 →
        </Link>
      </div>
    </div>
  );
}
