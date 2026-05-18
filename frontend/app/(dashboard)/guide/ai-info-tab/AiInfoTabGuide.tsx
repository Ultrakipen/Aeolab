"use client"

import Link from 'next/link'
import { useState } from 'react'

// §3.4 필수 사진 5종 카드
const PHOTO_ITEMS = [
  { id: "exterior", label: "외관 사진 (입구·간판)" },
  { id: "interior", label: "내부 인테리어" },
  { id: "menu_board", label: "메뉴판 (가격 포함)" },
  { id: "signature", label: "시그니처 메뉴 사진" },
  { id: "price_sign", label: "가격판·서비스 안내판" },
]

// §3.8 C-rank 4요소 항목
const CRANK_ITEMS = [
  {
    num: 1,
    key: "Context",
    label: "Context (집중도)",
    desc: "한 가지 주제를 지속적으로 다루는 콘텐츠",
  },
  {
    num: 2,
    key: "Content",
    label: "Content (품질)",
    desc: "정보의 정확성과 실용성",
  },
  {
    num: 3,
    key: "Chain",
    label: "Chain (상호작용)",
    desc: "리뷰 답변·예약·전화·길찾기 클릭 등 실행 데이터",
  },
  {
    num: 4,
    key: "Creator",
    label: "Creator (신뢰도)",
    desc: "운영자의 일관성과 전문성",
  },
]

type Eligibility = "active" | "likely" | "inactive"

interface BusinessLite {
  id: string
  name: string
  category: string
  is_franchise?: boolean
  naver_place_url?: string | null
  naver_place_id?: string | null
  has_intro?: boolean
  has_recent_post?: boolean
  ai_info_tab_status?: string
  review_count?: number
}

interface Props {
  business: BusinessLite | null
  eligibility: Eligibility
  plan: string  // free | basic | startup | pro | biz | enterprise
  blogMentionCount?: number
}

// 플랜별 소개글/FAQ 자동 생성 한도 (faq_monthly 공유, plan_gate.py 기준)
// 백엔드 plan_gate.py PLAN_LIMITS.faq_monthly와 동기화 (Pro·창업패키지·Biz·Enterprise = 무제한 999)
const PLAN_LIMITS: Record<string, { intro_faq: number; label: string; color: string }> = {
  free:       { intro_faq: 0,   label: "Free",     color: "gray" },
  basic:      { intro_faq: 5,   label: "Basic",    color: "blue" },
  startup:    { intro_faq: 999, label: "창업패키지", color: "indigo" },
  pro:        { intro_faq: 999, label: "Pro",      color: "purple" },
  biz:        { intro_faq: 999, label: "Biz",      color: "green" },
  enterprise: { intro_faq: 999, label: "Enterprise", color: "emerald" },
}

export function AiInfoTabGuide({ business, eligibility, plan, blogMentionCount = 0 }: Props) {
  const planInfo = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const canGenerate = planInfo.intro_faq > 0
  const isInactive = eligibility === "inactive"
  const isLikely = eligibility === "likely"

  // §3.4 사진 체크리스트 상태 (시각용 — DB 저장 없음)
  const [checkedPhotos, setCheckedPhotos] = useState<Record<string, boolean>>({})
  const togglePhoto = (id: string) =>
    setCheckedPhotos((prev) => ({ ...prev, [id]: !prev[id] }))

  // §3.8 C-rank 체크리스트 상태 (시각용 — DB 저장 없음)
  const [checkedCrank, setCheckedCrank] = useState<Record<string, boolean>>({})
  const toggleCrank = (key: string) =>
    setCheckedCrank((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <>
      {/* ── 업종/플랜 안내 배너 ────────────────────────────── */}
      <div
        className={`rounded-xl p-4 md:p-5 ${
          isInactive
            ? "bg-amber-50 border border-amber-200"
            : isLikely
            ? "bg-blue-50 border border-blue-200"
            : "bg-green-50 border border-green-200"
        }`}
      >
        {business ? (
          <>
            <p className="text-sm md:text-base font-semibold text-gray-900 mb-1">
              내 사업장: {business.name}
              <span className="ml-2 inline-block px-2 py-0.5 text-sm bg-white rounded-full font-medium border border-gray-200">
                {planInfo.label}
              </span>
            </p>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
              {business.is_franchise
                ? "프랜차이즈 가맹점은 현재 네이버 AI 브리핑 제공 대상에서 제외됩니다(추후 확대 예정). 그동안 일반 검색·블로그·ChatGPT·Gemini 노출에서 효과를 드립니다."
                : isInactive
                ? "이 업종은 AI 브리핑 비대상이지만, 네이버 AI탭(2026-04-27 베타)은 모든 업종 노출 가능합니다. 아래 단계로 AI탭 대비 + 일반 검색 노출을 동시에 준비하세요."
                : isLikely
                ? "이 업종은 AI 브리핑 확대 예상 업종입니다. 미리 5단계를 완료해두면 확대 즉시 노출됩니다."
                : "이 업종은 현재 AI 브리핑 노출 대상입니다. 5단계를 완료해 노출 확률을 높이세요."}
            </p>
          </>
        ) : (
          <p className="text-sm md:text-base text-gray-700">
            먼저 사업장을 등록해주세요.{" "}
            <Link href="/onboarding" className="text-blue-600 hover:underline font-medium">
              사업장 등록하기 →
            </Link>
          </p>
        )}
      </div>

      {/* ── 5단계 가이드 ────────────────────────────── */}
      <div className="space-y-4">

        {/* 단계 1: AI 정보 탭 찾기 — INACTIVE/프랜차이즈는 AI탭 대비 안내로 대체 */}
        {isInactive || business?.is_franchise ? (
          <>
            <StepSkipped
              num={1}
              title="🎯 네이버 스마트플레이스 AI 정보 탭 찾기 (AI 브리핑)"
              reason={
                business?.is_franchise
                  ? "프랜차이즈 가맹점은 네이버 AI 브리핑 제공 대상에서 제외됩니다 (네이버 공식 정책)."
                  : "이 업종은 네이버 AI 브리핑 비대상입니다. AI 정보 탭이 노출되지 않습니다."
              }
            />
            {/* AI탭 준비 안내 — INACTIVE/프랜차이즈도 AI탭은 모든 업종 가능 */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 md:p-5">
              <p className="text-sm md:text-base font-semibold text-indigo-800 mb-2">
                🆕 네이버 AI탭 준비 — 이 업종도 노출 가능합니다
              </p>
              <p className="text-sm text-indigo-700 mb-3 leading-relaxed">
                네이버 AI탭(2026-04-27 베타)은 AI 브리핑과 달리 <strong>업종·프랜차이즈 제한 없이</strong> 모든 사업장이
                노출될 수 있습니다. 현재 네이버플러스 구독자 대상 베타이며, 상반기 전체 확대 예정입니다.
                지금 아래 항목을 준비해두면 전체 확대 즉시 노출 우위를 가집니다.
              </p>
              <ul className="space-y-2 text-sm text-indigo-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">①</span>
                  <span><strong>소개글 200자 이상</strong> + 자주 묻는 질문 3~5개 Q&amp;A 형식 포함
                    <span className="ml-1 text-indigo-400">(AI탭은 Q&amp;A 구조를 우선 인용)</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">②</span>
                  <span><strong>사진 10장 이상</strong> 등록 — 외관·내부·서비스 현장 사진</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">③</span>
                  <span><strong>예약 연동</strong> (선택) — AI탭 결과에 예약 버튼이 추가로 표시됨</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">④</span>
                  <span><strong>리뷰 10건 이상</strong> — 업종 키워드가 포함된 리뷰가 AI탭 인용 가능성 높임</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">⑤</span>
                  <span><strong>영업시간·가격·서비스 항목</strong> 완성</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-indigo-600">
                * AI탭은 베타 서비스 중이며 실제 노출 여부는 확인하기 어렵습니다. 전체 확대 후 측정 기능이 추가됩니다.
              </p>
            </div>
          </>
        ) : (
          <Step
            num={1}
            title="🔍 네이버 스마트플레이스에서 AI 정보 탭 찾기"
            time="2분"
            done={!!business?.ai_info_tab_status && business.ai_info_tab_status !== "unknown"}
          >
            <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
              스마트플레이스 관리자에 로그인 후 <strong>업체정보 → AI 정보</strong> 탭으로 이동합니다.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm md:text-base text-gray-700 mb-3">
              <li><a href="https://smartplace.naver.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">smartplace.naver.com</a> 접속 → 사업자 로그인</li>
              <li>좌측 메뉴 <strong>업체정보</strong> 클릭</li>
              <li>상단 탭 중 <strong>AI 정보</strong> 선택</li>
            </ol>
            {isLikely && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm md:text-base text-gray-700 mb-2">
                <strong>확대 예상 업종:</strong> 현재 일부 계정에만 AI 정보 탭이 노출됩니다.
                탭이 없더라도 3~5단계를 미리 완료해두면 확대 즉시 노출됩니다.
              </div>
            )}
            {!isLikely && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm md:text-base text-gray-700">
                <strong>탭이 보이지 않는다면?</strong> 리뷰 수가 부족하거나 네이버 내부 기준 미충족입니다.
                5단계를 완료하면 조건이 충족되는 경우 탭이 활성화됩니다.
              </div>
            )}
          </Step>
        )}

        {/* 단계 2: AI 정보 탭 토글 ON — INACTIVE/프랜차이즈는 대체 안내 */}
        {isInactive || business?.is_franchise ? (
          <StepSkipped
            num={2}
            title="⚙️ AI 브리핑 노출 토글 활성화 (ON)"
            reason={
              business?.is_franchise
                ? "프랜차이즈 가맹점은 토글 설정 대상이 아닙니다."
                : "이 업종은 AI 브리핑 토글이 제공되지 않습니다."
            }
            alternative={
              <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                AI 브리핑 토글 대신, 위 <strong>AI탭 준비 5항목</strong>과 아래 3·4·5단계(소개글·소식·리뷰)로
                <strong>AI탭 + ChatGPT·Gemini·Google AI</strong> 노출을 동시에 개선합니다.
              </p>
            }
          />
        ) : (
          <Step
            num={2}
            title="⚙️ AI 브리핑 노출 토글 활성화 (ON)"
            time="1분"
            done={business?.ai_info_tab_status === "on"}
          >
            <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
              AI 정보 탭에서 <strong>AI 브리핑 노출</strong> 스위치를 ON으로 설정합니다.
              저장 후 <strong>1일 이내</strong> 검색 결과에 반영됩니다.
            </p>
            {isLikely ? (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm md:text-base text-gray-700">
                AI 정보 탭이 있는 경우 토글을 ON으로 설정해두세요.
                탭이 없더라도 아래 단계를 완료해두면 확대 시 즉시 반영됩니다.
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm md:text-base text-gray-700">
                토글이 비활성화되어 있다면, 콘텐츠 조건(소개글·소식·리뷰)을 먼저 충족해야 합니다.
                아래 3·4·5단계를 진행하세요.
              </div>
            )}
            {business?.id && (
              <Link
                href="/dashboard"
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded font-medium hover:bg-blue-700"
              >
                대시보드에서 토글 상태 보고하기 →
              </Link>
            )}
          </Step>
        )}

        {/* INACTIVE 전용: AI탭 노출 3단계 + 글로벌 AI 링크 */}
        {isInactive && !business?.is_franchise && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 md:p-6 space-y-4">
            <div>
              <p className="text-sm md:text-base font-semibold text-indigo-900 mb-1">
                이 업종은 네이버 AI 브리핑 비대상이지만, AI탭은 모든 업종 가능합니다
              </p>
              <p className="text-sm text-indigo-700 leading-relaxed">
                네이버 AI탭(2026-04-27 베타)은 업종·프랜차이즈 제한 없이 모든 사업장이 노출될 수 있습니다.
                아래 3단계로 AI탭 노출을 미리 준비하세요.
              </p>
            </div>

            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-200 text-indigo-800 text-sm font-bold flex items-center justify-center mt-0.5">
                  1
                </span>
                <div>
                  <p className="text-sm md:text-base font-semibold text-gray-900">
                    소개글에 Q&amp;A 형식 포함
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    AI탭은 Q&amp;A 콘텐츠를 우선 인용합니다. 자주 묻는 질문 3~5개를 소개글 안에 넣으세요.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-200 text-indigo-800 text-sm font-bold flex items-center justify-center mt-0.5">
                  2
                </span>
                <div>
                  <p className="text-sm md:text-base font-semibold text-gray-900">
                    사진 10장 이상 등록
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    이미지 다양성은 AI탭 신뢰도 신호입니다. 외관·내부·서비스 현장 사진을 다양하게 올리세요.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-200 text-indigo-800 text-sm font-bold flex items-center justify-center mt-0.5">
                  3
                </span>
                <div>
                  <p className="text-sm md:text-base font-semibold text-gray-900">
                    소식 주 1회 업로드
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    최신성 신호는 AI탭 노출 우선순위에 영향을 줍니다. 신메뉴·이벤트·변경 사항을 꾸준히 올리세요.
                  </p>
                </div>
              </li>
            </ol>

            <div className="pt-2 border-t border-indigo-200">
              <p className="text-sm text-indigo-700 mb-2">
                ChatGPT·Gemini도 함께 최적화하려면?
              </p>
              <Link
                href="/guide/chatgpt-search"
                className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
              >
                ChatGPT Search 최적화 가이드 →
              </Link>
            </div>
          </div>
        )}

        {/* 단계 3: 소개글 작성 (150~500자) */}
        <Step
          num={3}
          title="🖊️ 소개글 작성 — 150~500자 + 키워드 + USP"
          time="5분"
          done={!!business?.has_intro}
        >
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
            {isInactive
              ? <>ChatGPT·Gemini·Google AI는 소개글의 <strong>핵심 정보를 학습 소스로 활용</strong>합니다.</>
              : <>AI 브리핑은 소개글의 <strong>핵심 정보를 학습 소스로 활용</strong>합니다.</>}
            {" "}150~500자 분량에 사업장의 강점·서비스·키워드를 자연스럽게 포함하세요.
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-700 mb-3">
            <li>키워드를 단순 나열이 아닌 문장 안에 자연스럽게 배치</li>
            <li>소개글에 Q&A 5개 포함 — 스마트플레이스 사장님 Q&A 탭이 폐기된 현재, 소개글 안의 Q&A 섹션이 가장 효과적인 인용 후보 경로입니다</li>
            <li>최신 정보(영업시간·휴무·시즌 메뉴) 명시</li>
          </ul>
          {/* Q&A 자동 감지 불가 안내 — 사용자 노출 원칙 §7 */}
          <p className="text-sm text-gray-500 leading-snug mb-3">
            * AEOlab는 소개글 안에 Q&amp;A 구조가 포함됐는지 자동으로 감지하지 못합니다.
            소개글 입력 여부(has_intro)만 추적하므로, Q&amp;A 포함 여부는 직접 확인하세요.
          </p>
          {canGenerate ? (
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm md:text-base text-gray-700 mb-3">
              <strong>{planInfo.label} 플랜:</strong> 소개글 AI 자동 생성 월{" "}
              {planInfo.intro_faq >= 999 ? "무제한" : `${planInfo.intro_faq}회`} 가능 (Q&A 5개 자동 포함).
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm md:text-base text-gray-700 mb-3">
              <strong>Free 플랜:</strong> 소개글 AI 자동 생성은 Basic 이상에서 사용 가능합니다.{" "}
              <Link href="/pricing" className="text-blue-600 hover:underline font-medium">플랜 보기 →</Link>
            </div>
          )}
          {business?.id && canGenerate && (
            <Link
              href={`/dashboard?biz_id=${business.id}#intro-generator`}
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded font-medium hover:bg-blue-700"
            >
              대시보드에서 소개글 자동 생성하기 →
            </Link>
          )}
        </Step>

        {/* 단계 3-b: 톡톡 채팅방 메뉴 등록 (선택) */}
        <div className="rounded-xl border bg-purple-50 border-purple-200 p-4 md:p-6 ml-0 md:ml-6">
          <div className="flex items-start gap-3 mb-3">
            <span className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-sm bg-purple-100 text-purple-700">
              3b
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-gray-900 break-keep">
                (선택) 톡톡 채팅방 메뉴 등록
              </h3>
              <p className="text-sm md:text-base text-gray-500 mt-0.5">예상 소요: 2~5분 (AI 자동 생성 이용 시)</p>
            </div>
          </div>
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed break-keep">
            톡톡 채팅방 메뉴는 채팅창 안에서 고객 응대를 자동화합니다.
            AI 브리핑 노출 효과는 보장되지 않으며, 노출 가능성을 높이는 핵심 경로는
            <strong> 소개글 + 소식 + 리뷰 답변</strong>입니다.
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-700 mb-3">
            <li>채팅방 메뉴 6개 (텍스트형 12개도 가능) — 메뉴명 6자 이내</li>
            <li>메뉴 클릭 시 메시지 전송 또는 URL 실행 중 선택</li>
            <li>응대 시간 단축 + 사장님이 작성한 텍스트의 인용 후보 확보</li>
          </ul>
          <div className={`rounded p-3 text-sm md:text-base mb-3 ${
            canGenerate
              ? "bg-white border border-purple-300 text-gray-700"
              : "bg-gray-50 border border-gray-200 text-gray-700"
          }`}>
            {canGenerate ? (
              <>
                <strong>플랜별 AI 자동 생성 한도 (월):</strong>{" "}
                Free 0건 / Basic 5건 / 창업패키지·Pro·Biz 무제한
                <span className="ml-2 text-purple-700 font-medium">
                  (현재: {planInfo.label} — {planInfo.intro_faq >= 999 ? "무제한" : `${planInfo.intro_faq}건`})
                </span>
              </>
            ) : (
              <>
                <strong>Free 플랜:</strong> 채팅방 메뉴 AI 자동 생성은 Basic 이상에서 사용 가능합니다.{" "}
                <Link href="/pricing" className="text-blue-600 hover:underline font-medium">플랜 보기 →</Link>
                <p className="mt-1 text-gray-500">직접 작성은 플랜 제한 없이 가능합니다.</p>
              </>
            )}
          </div>
          {business?.id && canGenerate && (
            <Link
              href={`/dashboard?biz_id=${business.id}#talktalk-faq`}
              className="inline-block px-4 py-2 bg-purple-600 text-white text-sm md:text-base rounded font-medium hover:bg-purple-700"
            >
              대시보드에서 채팅방 메뉴 자동 생성하기 →
            </Link>
          )}
        </div>

        {/* 단계 4: 소식 등록 (최신성) */}
        <Step
          num={4}
          title="📡 소식 등록 — 30일 내 1건 이상 (최신성)"
          time="3분"
          done={!!business?.has_recent_post}
        >
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
            {isInactive
              ? <>네이버 일반 검색과 ChatGPT·Gemini는 <strong>최신성</strong>을 중요하게 평가합니다.
                  30일에 1건 이상 신규 소식을 등록하면 검색 노출 확률이 상승합니다.</>
              : <>네이버 AI 브리핑은 <strong>최신성</strong>을 중요하게 평가합니다.
                  30일에 1건 이상 신규 소식을 등록하면 인용 확률이 상승합니다.</>}
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-700 mb-3">
            <li>새 메뉴, 시즌 이벤트, 영업시간 변경 등 실용 정보 위주로</li>
            <li>이미지 1~3장 첨부 권장</li>
            <li>해시태그·키워드 자연스럽게 포함</li>
          </ul>
          {plan !== "free" && (
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm md:text-base text-gray-700 mb-3">
              <strong>{planInfo.label} 플랜:</strong> 매주 월요일 오전 9시, AI가 업종별 소식 초안을 자동 작성합니다.
              가이드 페이지의 <strong>이번 주 소식 초안</strong>에서 확인하세요.
            </div>
          )}
          <a
            href="https://smartplace.naver.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded font-medium hover:bg-blue-700"
          >
            스마트플레이스 열기 →
          </a>
        </Step>

        {/* 단계 5: 리뷰 확보 */}
        <Step
          num={5}
          title="🌟 리뷰 확보 — 영수증 리뷰 10건 이상 권장"
          time="지속"
          done={!!business?.review_count && business.review_count >= 10}
        >
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
            {isInactive
              ? <>리뷰 수와 품질은 네이버 일반 검색 순위·ChatGPT·Gemini 언급 빈도에 직접 영향을 줍니다.
                  영수증 리뷰 <strong>10건 이상</strong>을 목표로 하세요.</>
              : <>네이버 공식 안내: <strong>리뷰수가 기준에 맞지 않을 경우 AI 브리핑 서비스 제공 안 됨.</strong>
                  정확한 임계값은 비공개이나, 영수증 리뷰 10건 이상이면 안전합니다.</>}
          </p>
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
            현재 리뷰: <strong>{business?.review_count ?? 0}건</strong>
            {(business?.review_count ?? 0) < 10 && " — 10건 이상 권장"}
          </p>
          {plan !== "free" && (
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm md:text-base text-gray-700 mb-3">
              <strong>{planInfo.label} 플랜:</strong> 가이드 페이지의 <strong>QR 카드 다운로드</strong>로
              매장 카운터에 부착해 리뷰를 자연스럽게 유도하세요.
            </div>
          )}
          {business?.id && (
            <Link
              href={`/guide?biz_id=${business.id}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded font-medium hover:bg-blue-700"
            >
              가이드에서 QR 카드 받기 →
            </Link>
          )}
        </Step>
      </div>

      {/* ── §3.4 필수 사진 5종 체크리스트 카드 ────────────────────── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 break-keep">
          {isInactive ? '검색 노출을 높이는 필수 사진 5종' : 'AI 브리핑 노출을 높이는 필수 사진 5종'}
        </h3>
        <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
          {isInactive
            ? '네이버 일반 검색·ChatGPT·Gemini는 사업장의 사진 수·다양성·최신성을 신뢰도 신호로 활용합니다.'
            : '네이버 AI 브리핑은 사업장의 사진 수·다양성·최신성을 노출 신호로 활용합니다.'}
          {" "}아래 5종을 모두 등록하고, <strong>월 1회 이상 새 사진 추가를 권장합니다.</strong>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {PHOTO_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => togglePhoto(item.id)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                checkedPhotos[item.id]
                  ? "bg-green-50 border-green-300 text-green-800"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300"
              }`}
            >
              <span
                className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  checkedPhotos[item.id]
                    ? "bg-green-500 border-green-500 text-white"
                    : "bg-white border-gray-400"
                }`}
              >
                {checkedPhotos[item.id] && (
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm md:text-base font-medium">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500 leading-relaxed break-keep">
          체크는 화면 확인용이며 저장되지 않습니다. 실제 등록은{" "}
          <a
            href="https://smartplace.naver.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium"
          >
            스마트플레이스
          </a>
          에서 직접 진행해주세요.
        </p>
      </div>

      {/* ── §3.8 C-rank 4요소 체크리스트 카드 ────────────────────── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 break-keep">
          C-rank 영향 요소 4가지
        </h3>
        <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
          네이버 블로그·콘텐츠 노출에 영향을 주는 C-rank 요소입니다. 각 항목을 콘텐츠 작성 시 체크해보세요.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {CRANK_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleCrank(item.key)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                checkedCrank[item.key]
                  ? "bg-green-50 border-green-300"
                  : "bg-white border-gray-200 hover:bg-amber-50 hover:border-amber-300"
              }`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  checkedCrank[item.key]
                    ? "bg-green-500 text-white"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {checkedCrank[item.key] ? (
                  <svg className="w-4 h-4" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  item.num
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm md:text-base font-semibold mb-0.5 break-keep ${
                  checkedCrank[item.key] ? "text-green-800" : "text-gray-900"
                }`}>
                  {item.label}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed break-keep">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 leading-relaxed break-keep">
          C-rank 점수는 네이버 비공개 알고리즘이며, 위 항목은 영향 요소 추정입니다.
        </p>
      </div>

      {/* ── §M2-3 블로그 UGC 강화 카드 ──────────────────────────── */}
      <div className={`rounded-xl border p-4 md:p-6 ${
        blogMentionCount === 0
          ? "border-rose-200 bg-rose-50"
          : "border-green-200 bg-green-50"
      }`}>
        <div className="flex items-start gap-3 mb-3">
          <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            blogMentionCount === 0 ? "bg-rose-100 text-rose-700" : "bg-green-100 text-green-700"
          }`}>
            {blogMentionCount === 0 ? "!" : blogMentionCount}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base md:text-lg font-bold mb-0.5 break-keep ${
              blogMentionCount === 0 ? "text-rose-900" : "text-green-900"
            }`}>
              블로그 UGC (사용자 생성 콘텐츠)
            </h3>
            <p className={`text-sm md:text-base leading-relaxed break-keep ${
              blogMentionCount === 0 ? "text-rose-700" : "text-green-700"
            }`}>
              {blogMentionCount === 0
                ? "아직 블로그 후기가 감지되지 않았습니다. AI 검색 노출에 블로그 언급은 핵심 신호입니다."
                : `${blogMentionCount}건의 블로그 언급이 감지되었습니다. AI 탭은 UGC가 풍부한 플레이스를 우선 노출합니다.`}
            </p>
          </div>
        </div>
        {blogMentionCount === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-700 leading-relaxed break-keep">
              외부 블로그 후기 5개 이상 확보 시 AI 브리핑·AI탭 노출 가능성이 높아집니다.
              리뷰어 초대, 체험단 운영, 소셜 공유 이벤트를 활용해보세요.
            </p>
            <Link
              href="/guide/chatgpt-search"
              className="inline-block mt-1 px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors"
            >
              AI 검색 최적화 가이드 →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-green-700 leading-relaxed break-keep">
            블로그 언급 수를 꾸준히 늘리면 AI 탭 노출 빈도와 인용 가능성이 함께 상승합니다.
            목표: <strong>월 3건 이상</strong> 신규 블로그 후기 유지.
          </p>
        )}
        <p className="text-xs text-gray-400 mt-3 leading-relaxed break-keep">
          블로그 언급 수는 스캔 시점 기준이며, 측정 방식에 따라 실제와 차이가 있을 수 있습니다.
        </p>
      </div>

      {/* ── 플랜 업그레이드 CTA (free 사용자) ────────────────────── */}
      {plan === "free" && (
        <div className="rounded-xl p-5 md:p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-keep">
            소개글·채팅방 메뉴 AI 자동 생성으로 시간을 절약하세요
          </h3>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
            Basic 플랜(월 9,900원)부터 소개글·톡톡 채팅방 메뉴 AI 자동 생성을 사용할 수 있습니다.
            첫 달 50% 할인(4,950원).
          </p>
          <Link
            href="/pricing"
            className="inline-block px-5 py-3 bg-blue-600 text-white text-sm md:text-base rounded-lg font-semibold hover:bg-blue-700"
          >
            요금제 보기 →
          </Link>
        </div>
      )}
    </>
  )
}

interface StepProps {
  num: number
  title: string
  time: string
  done?: boolean
  children: React.ReactNode
}

function Step({ num, title, time, done, children }: StepProps) {
  return (
    <div className="rounded-xl border bg-white p-4 md:p-6">
      <div className="flex items-start gap-3 mb-3">
        <span
          className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base ${
            done ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
          }`}
        >
          {done ? "✓" : num}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-bold text-gray-900 break-keep">
            단계 {num}. {title}
          </h3>
          <p className="text-sm md:text-base text-gray-500 mt-0.5">예상 소요: {time}</p>
        </div>
      </div>
      <div className="ml-0 md:ml-14">{children}</div>
    </div>
  )
}

interface StepSkippedProps {
  num: number
  title: string
  reason: string
  alternative?: React.ReactNode
}

function StepSkipped({ num, title, reason, alternative }: StepSkippedProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-6 opacity-70">
      <div className="flex items-start gap-3 mb-2">
        <span className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base bg-gray-200 text-gray-500">
          {num}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-bold text-gray-500 break-keep line-through">
            단계 {num}. {title}
          </h3>
          <p className="text-sm md:text-base text-gray-500 mt-0.5">해당 없음</p>
        </div>
      </div>
      <div className="ml-0 md:ml-14">
        <p className="text-sm md:text-base text-gray-500 mb-2">{reason}</p>
        {alternative}
      </div>
    </div>
  )
}
