"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  AlertTriangle,
  PenLine,
  Users,
  Gift,
  MessageCircle,
  Hash,
  Repeat,
  CheckSquare,
  HelpCircle,
  BookOpen,
  BarChart2,
  ExternalLink,
  Lightbulb,
} from "lucide-react";

// ---------------------------------------------------------------------------
// 체크리스트
// ---------------------------------------------------------------------------
function ChecklistSection() {
  const items = [
    "스마트플레이스 '제안하기' 기능으로 블로그 리뷰어 5명 이상 초대",
    "1개월 1회 체험단·시식회·런칭 이벤트 운영 (네이버 카페·인플루언서 활용)",
    "방문 고객에게 '리뷰 작성 시 음료 1잔 무료' 등 가벼운 인센티브 제공 (지나친 대가성은 어뷰징)",
    "고객 리뷰에 진정성 있는 답글 1주 내 작성 — 답글 자체가 검색 신호",
    "사장님이 직접 사장님 블로그 운영 (월 2회 이상, 신메뉴·이벤트·일상 소식)",
    "인스타·페이스북에서 #지역명_업종 해시태그로 노출 → 블로그 유입 유도",
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
            className="h-full bg-rose-500 rounded-full transition-all duration-300"
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
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <span
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              checked[i] ? "bg-rose-500 border-rose-500" : "border-gray-300"
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
// FAQ
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
        <span className="flex-shrink-0 text-gray-500 text-lg leading-none">
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
export default function BlogStrategyGuidePage() {
  return (
    <div className="max-w-[840px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-10">
      {/* 뒤로가기 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href="/guide/ai-info-tab"
          className="inline-flex items-center gap-1 text-sm md:text-base text-gray-500 hover:text-rose-600"
        >
          <ChevronLeft className="w-4 h-4" /> AI 브리핑 5단계 가이드로
        </Link>
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-1 text-sm md:text-base text-rose-600 hover:underline font-medium"
        >
          서비스 안내 매뉴얼 →
        </Link>
      </div>

      {/* 헤더 */}
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep leading-tight">
          외부 블로그 후기 늘리기 전략
        </h1>
        <p className="text-base md:text-lg text-gray-700 leading-relaxed break-keep">
          네이버 AI 브리핑 · AI탭 노출에 가장 강한 신호는 외부 블로그 언급입니다. 월 3건 이상 꾸준한 블로그·SNS 후기 확보 방법
        </p>

        {/* 면책 배너 */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm md:text-base text-amber-800 leading-relaxed">
            <span className="font-semibold">유의: </span>
            대가성 후기 작성 시 네이버 정책상 어뷰징으로 분류될 수 있습니다.
            인센티브는 가볍게(음료 1잔·할인 5% 수준), 후기 내용은 고객의 자발적 표현으로 받는 것이 안전합니다.
          </p>
        </div>
      </div>

      {/* 섹션 1: 왜 블로그 후기가 중요한가 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-rose-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            1. 왜 외부 블로그 후기가 중요한가?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              title: "AI 브리핑 핵심 신호",
              desc: "네이버 AI 브리핑은 외부 블로그 언급을 사업장 신뢰도의 핵심 지표로 사용합니다. 5건 이상 확보 시 노출 우선순위 상승.",
            },
            {
              title: "AI탭 블로그·SNS 후기 풍부도",
              desc: "AI탭은 블로그·SNS 후기가 풍부한 플레이스를 우선 노출합니다. 블로그 후기가 많을수록 노출 우선순위가 높아집니다.",
            },
            {
              title: "ChatGPT·Gemini 학습 소스",
              desc: "외부 공개 블로그(티스토리·자체 블로그 등)는 ChatGPT·Gemini 학습 데이터에 포함될 수 있습니다. 네이버 블로그는 Bing 내 영향력이 매우 제한적이어서 ChatGPT·Gemini 응답에 미치는 효과가 작습니다. 네이버 AI 브리핑·AI탭에는 효과적입니다.",
            },
          ].map(({ title, desc }) => (
            <div
              key={title}
              className="flex flex-col gap-2 p-4 rounded-xl border border-rose-100 bg-rose-50"
            >
              <span className="text-sm md:text-base font-semibold text-rose-900">{title}</span>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 섹션 2: 6가지 실행 전략 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <PenLine className="w-4 h-4 text-violet-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            2. 6가지 실행 전략
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              num: 1,
              icon: <Users className="w-5 h-5 text-indigo-500" />,
              title: "리뷰어 초대 — 스마트플레이스 '제안하기' 활용",
              desc: "스마트플레이스 관리자에서 '리뷰어 제안하기' 기능으로 영향력 있는 네이버 블로거에게 직접 방문을 요청할 수 있습니다. 월 5명 이상 초대 권장. 무리한 요구(긴 후기·별점 5점 등)는 금지.",
            },
            {
              num: 2,
              icon: <Gift className="w-5 h-5 text-emerald-500" />,
              title: "체험단·시식회 운영 — 월 1회 정기 이벤트",
              desc: "네이버 카페(맘카페·지역카페), 인스타 마이크로 인플루언서(팔로워 1천~1만), 체험단 플랫폼(레뷰·디너의여왕 등)을 활용. 신메뉴 출시·시즌 변경 시점에 진행하면 효과 극대.",
            },
            {
              num: 3,
              icon: <Hash className="w-5 h-5 text-blue-500" />,
              title: "고객 자발 후기 유도 — 가벼운 인센티브 + 해시태그",
              desc: '"리뷰 작성 시 음료 1잔 무료" 등 가벼운 수준 권장. 매장 내 안내문에 "#지역명_업종" 해시태그 안내 → 블로그 검색에 노출. 대가성 강조는 어뷰징 위험.',
            },
            {
              num: 4,
              icon: <MessageCircle className="w-5 h-5 text-rose-500" />,
              title: "리뷰 답글 — 모든 후기에 1주 내 진정성 있는 답글",
              desc: "사장님 답글이 달린 리뷰는 검색 알고리즘에서 더 높은 가중치를 받습니다. 단순 감사 인사보다 후기 내용을 인용하며 구체적으로 답글 작성. 부정 후기에도 침착하게 응대.",
            },
            {
              num: 5,
              icon: <BookOpen className="w-5 h-5 text-amber-500" />,
              title: "사장님 블로그 직접 운영 — 월 2회 이상 포스팅",
              desc: "사장님이 직접 네이버 블로그를 운영하면 자체 신호도 함께 강화됩니다. 신메뉴·이벤트·운영 노하우·일상 소식 등 사실 기반 콘텐츠. AI는 일관된 업데이트 패턴을 신뢰합니다.",
            },
            {
              num: 6,
              icon: <Repeat className="w-5 h-5 text-slate-500" />,
              title: "재방문 고객 활용 — 단골에게 후기 부탁",
              desc: "신규 고객보다 단골 고객의 후기가 더 구체적이고 진정성 있게 작성되는 경향이 있습니다. POS·카드 결제 기록으로 3회 이상 방문 고객 식별 → 자연스럽게 후기 작성 부탁.",
            },
          ].map(({ num, icon, title, desc }) => (
            <div
              key={num}
              className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center text-white text-sm font-bold">
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

      {/* 섹션 3: 어뷰징 금지선 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            3. 어뷰징 금지선 — 절대 하지 말 것
          </h2>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {[
            {
              label: "원고 제공 후기",
              value: "사장님이 후기 본문을 작성해 블로거에게 그대로 게시하게 하는 행위. 네이버 알고리즘이 동일 패턴을 감지해 검색 노출에서 제외할 수 있습니다.",
            },
            {
              label: "별점·키워드 강요",
              value: '"별점 5점 + ○○ 키워드 필수 포함" 등의 조건 부여. 진정성 신호가 사라져 오히려 역효과.',
            },
            {
              label: "대량 대가 지급",
              value: "건당 5만원 이상 현금 지급 등 명백한 대가성. 공정거래위원회 표시 광고 위반 소지.",
            },
            {
              label: "단기 폭발",
              value: "1주일 내 10건 이상 동일 패턴 후기 등록. 자연스러운 시간 분포를 따르는 것이 안전.",
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3">
              <span className="text-sm md:text-base font-semibold text-amber-700 sm:w-32 flex-shrink-0">
                {label}
              </span>
              <span className="text-sm md:text-base text-gray-600 leading-relaxed">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 섹션 4: 체크리스트 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-4 h-4 text-rose-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            4. 이번 달 실행 체크리스트
          </h2>
        </div>
        <ChecklistSection />
      </section>

      {/* 섹션 5: FAQ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4 h-4 text-amber-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">5. 자주 묻는 질문</h2>
        </div>

        <div className="space-y-3">
          <FaqItem
            q="블로그 후기 몇 건부터 효과가 있나요?"
            a="네이버 AI 브리핑·AI탭 노출 가능성이 의미 있게 상승하는 기준선은 5건 이상으로 추정됩니다. 단, 측정 시점·업종·지역 경쟁 강도에 따라 달라질 수 있습니다. 음식·카페·숙박은 10건 이상, 의원·법무 등 AI 브리핑 확대 예정·비대상 업종은 3건만 있어도 차별화 효과가 있는 편입니다."
          />
          <FaqItem
            q="체험단을 운영해도 효과가 없으면 어떻게 하나요?"
            a="후기 게시 자체가 끝이 아니라 검색 노출까지가 목표입니다. 체험단 후기에 ① 지역+업종 키워드 자연스럽게 포함 ② 사진 5장 이상 ③ 본문 500자 이상이 충족되어야 검색 노출이 잘됩니다. 체험단 안내 시 이 가이드라인을 부드럽게 제공하세요(강요 금지)."
          />
          <FaqItem
            q="AEOlab이 블로그 후기 수를 어떻게 측정하나요?"
            a="네이버 블로그 검색 결과에서 사업장명 + 지역 키워드 조합으로 언급된 포스팅 수를 집계합니다. 스캔 시점 기준이며, 사장님이 직접 작성한 포스팅과 외부 블로거가 작성한 포스팅을 모두 포함합니다. 정확한 분류는 AEOlab 블로그 분석(/blog-analysis)에서 확인할 수 있습니다."
          />
          <FaqItem
            q="블로그 외에 인스타그램·유튜브 후기도 효과가 있나요?"
            a="네이버 AI 브리핑은 네이버 블로그를 우선 신호로 보며, 인스타·유튜브는 보조 신호입니다. 단, 글로벌 AI(ChatGPT·Gemini)는 인스타·유튜브 콘텐츠도 학습 소스로 활용할 수 있어 AI 브리핑 확대 예정·비대상 업종은 SNS 후기도 가치가 있습니다."
          />
        </div>
      </section>

      {/* 하단 CTA */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200">
        <Link
          href="/dashboard"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-5 py-3 text-sm md:text-base transition-colors min-h-[44px]"
        >
          <BarChart2 className="w-4 h-4" />
          내 블로그 언급 수 확인하기 →
        </Link>
        <Link
          href="/blog-analysis"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-semibold rounded-xl px-5 py-3 text-sm md:text-base transition-colors min-h-[44px]"
        >
          <ExternalLink className="w-4 h-4" />
          블로그 분석 상세 보기
        </Link>
        <Link
          href="/guide/chatgpt-search"
          className="flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-gray-200 text-gray-700 font-semibold rounded-xl px-5 py-3 text-sm md:text-base transition-colors min-h-[44px]"
        >
          <BookOpen className="w-4 h-4" />
          ChatGPT 최적화 가이드 →
        </Link>
      </div>
    </div>
  );
}
