"use client"

import Link from 'next/link'
import { useState } from 'react'

// §3.4 필수 사진 5종 카드
const PHOTO_ITEMS = [
  { id: "exterior", label: "외관 사진 (입구·간판)" },
  { id: "interior", label: "내부 공간 사진 (인테리어)" },
  { id: "menu_board", label: "메뉴판·이용요금표 (가격 포함)" },
  { id: "signature", label: "대표 메뉴·서비스 현장 사진" },
  { id: "price_sign", label: "서비스 안내판·가격표" },
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
  review_count?: number | null
}

interface Props {
  business: BusinessLite | null
  eligibility: Eligibility
  plan: string  // free | basic | startup | pro | biz | enterprise
  // null = 아직 스캔 전이라 미측정, number = 실측된 리뷰 수
  blogMentionCount?: number | null
  // P1-B-1 (2026-05-18 연결): smart_place_auto_check.py에서 측정된 네이버 예약 연동 여부.
  // null = 미측정 (스마트플레이스 미연결 또는 스캔 전), boolean = 측정 완료.
  hasReservation?: boolean | null
  // P1-B-2: 등록 사진 수 추정값. null = 미측정.
  photoCount?: number | null
}

// 플랜별 소개글/FAQ 자동 생성 한도 (faq_monthly 공유, plan_gate.py 기준)
// 백엔드 plan_gate.py PLAN_LIMITS.faq_monthly와 동기화 필수 — 값 변경 시 양쪽 동시 수정
const PLAN_LIMITS: Record<string, { intro_faq: number; label: string; color: string }> = {
  free:       { intro_faq: 0,   label: "Free",     color: "gray" },
  basic:      { intro_faq: 10,  label: "Basic",    color: "blue" },
  startup:    { intro_faq: 20,  label: "창업패키지", color: "indigo" },
  pro:        { intro_faq: 30,  label: "Pro",      color: "purple" },
  biz:        { intro_faq: 60,  label: "Biz",      color: "green" },
  enterprise: { intro_faq: 999, label: "Enterprise", color: "emerald" },
}

export function AiInfoTabGuide({ business, eligibility, plan, blogMentionCount = null, hasReservation = null, photoCount = null }: Props) {
  const blogScanned = blogMentionCount !== null
  const blogCount = blogMentionCount ?? 0
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
                ? "프랜차이즈 가맹점은 '플레이스형' 네이버 AI 브리핑 제공 대상에서 제외됩니다(네이버 공식 정책). 단, 블로그·콘텐츠 기반 '정보형 AI 브리핑'과 AI탭·일반 검색·ChatGPT·Gemini에서는 노출 가능합니다."
                : isInactive
                ? "이 업종은 '플레이스형' AI 브리핑 비대상이지만, 블로그·콘텐츠로 '정보형 AI 브리핑' 노출도 가능합니다. 네이버 AI탭(2026-06-25 정식 출시, 업종 제한 발표 없음)을 통한 노출도 준비하세요. 일반 검색 노출과 병행 가능합니다."
                : isLikely
                ? "이 업종은 AI 브리핑 확대 예상 업종입니다. 미리 5단계를 완료해두면 확대 즉시 노출됩니다. (네이버 AI탭은 2026-06-25 정식 출시 → 아래 AI탭 가이드 참고)"
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
            {/* 네이버 SEO 일석이조 강조 배너 */}
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 md:p-5">
              <p className="text-sm md:text-base font-bold text-emerald-900 mb-2">
                📈 아래 단계는 네이버 검색 상위노출에도 직접 도움이 됩니다
              </p>
              <ul className="space-y-1.5 text-sm md:text-base text-emerald-800">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span><strong>소개글 200자 이상</strong> → 네이버 플레이스 검색 노출 점수 상승</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span><strong>소식 월 1건 이상</strong> → 최신성 신호로 검색 순위 유지</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span><strong>리뷰 10건 이상</strong> → 네이버 검색 순위 직접 영향</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span><strong>블로그·SNS 후기</strong> → 외부 언급이 많을수록 검색 노출 빈도 상승</span>
                </li>
              </ul>
              <p className="mt-2 text-sm text-emerald-700">
                AI탭·ChatGPT·Gemini 노출까지 한 번에 — 동일한 작업으로 두 가지 효과를 동시에 얻습니다.
              </p>
            </div>
            <StepSkipped
              num={1}
              title="🎯 네이버 스마트플레이스 AI 정보 탭 찾기 (AI 브리핑)"
              reason={
                business?.is_franchise
                  ? "프랜차이즈 가맹점은 '플레이스형' 네이버 AI 브리핑 제공 대상에서 제외됩니다 (네이버 공식 정책)."
                  : "이 업종은 '플레이스형' 네이버 AI 브리핑 비대상입니다. AI 정보 탭(브리핑 연동)이 노출되지 않습니다."
              }
              alternative={
                <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                  블로그·콘텐츠로 &apos;정보형 AI 브리핑&apos; 노출은 지금도 가능합니다. 아래 AI탭 준비 안내를 확인하세요.
                </p>
              }
            />
            {/* AI탭 준비 안내 — INACTIVE/프랜차이즈도 AI탭은 모든 업종 가능 */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 md:p-5">
              <p className="text-sm md:text-base font-semibold text-indigo-800 mb-2">
                🆕 네이버 AI탭 준비 — 업종 제한 발표 없음 (정식 출시)
              </p>
              <p className="text-sm md:text-base text-indigo-700 mb-3 leading-relaxed">
                네이버 AI탭(2026-06-25 정식 출시)은 업종 제한 발표 없이 모든 사업장이 노출 가능합니다.
                지금 아래 항목을 준비해두면 노출 우위를 가질 수 있습니다.
              </p>
              <ul className="space-y-2 text-sm md:text-base text-indigo-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">①</span>
                  <span><strong>소개글 200자 이상</strong> + 자주 묻는 질문 3~5개 Q&amp;A 형식 포함
                    <span className="ml-1 text-indigo-400">(Q&amp;A 구조가 AI탭 인용 가능성 높음 — 실측 기반 권장)</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">②</span>
                  <span>
                    <strong>사진 10장 이상</strong> 등록 — 외관·내부·서비스 현장 사진
                    <span className="ml-1 text-indigo-400">(개수 기준. 아래 &apos;필수 사진 5종&apos;은 어떤 종류를 채워야 하는지 안내)</span>
                    {photoCount !== null && (
                      <span
                        className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold ${
                          photoCount >= 10
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {photoCount >= 10 ? '✓ 통과' : `현재 ${photoCount}장`}
                      </span>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 font-bold">③</span>
                  <span>
                    <strong>예약 연동</strong> (선택) — AI탭 결과에 예약 버튼이 추가로 표시됨
                    {hasReservation === true && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 text-sm font-semibold">
                        ✓ 연동됨
                      </span>
                    )}
                    {hasReservation === false && (
                      <>
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-sm font-semibold">
                          미연동
                        </span>
                        <a
                          href="https://partner.naver.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-sm text-indigo-700 underline hover:text-indigo-900"
                        >
                          지금 설정하기 →
                        </a>
                      </>
                    )}
                  </span>
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
              <p className="mt-3 text-sm text-indigo-600">
                * AI탭은 정식 출시됐으며, 전체 스캔 시 AI탭 노출 여부(사업장명 언급)를 실측합니다. 노출을 100% 보장하지는 않습니다.
              </p>
            </div>
          </>
        ) : (
          <Step
            num={1}
            title="🔍 네이버 스마트플레이스에서 AI 정보 탭 찾기"
            time="2분"
            done={business?.ai_info_tab_status === "on" || business?.ai_info_tab_status === "off" || business?.ai_info_tab_status === "disabled"}
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
                <strong>AI 브리핑 확대 예상 업종:</strong> 현재 일부 계정에만 AI 정보 탭이 노출됩니다.
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
              <div>
                <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-2">
                  AI 브리핑 토글 대신, 위 <strong>AI탭 준비 5항목</strong>과 아래 3·4·5단계(소개글·소식·리뷰)로
                  <strong>AI탭 + ChatGPT·Gemini·Google AI</strong> 노출을 동시에 개선합니다.
                </p>
                <Link
                  href="/guide"
                  className="inline-flex items-center gap-1 text-sm md:text-base font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
                >
                  전체 가이드 목록에서 ChatGPT·Gemini 최적화 보기 →
                </Link>
              </div>
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
              저장은 즉시되며, AI 브리핑 노출 반영까지는 <strong>2~4주</strong> 소요될 수 있습니다.
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
            <div className="mt-3">
              <a
                href="https://smartplace.naver.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded font-medium hover:bg-blue-700"
              >
                스마트플레이스 &rarr; AI 정보 탭에서 토글을 ON으로 설정 &#8599;
              </a>
              <p className="text-sm text-gray-500 mt-1">저장은 즉시. 실제 노출 반영까지 2~4주 소요될 수 있습니다</p>
            </div>
          </Step>
        )}

        {/* 단계 3: 소개글 작성 (150~500자) */}
        <Step
          num={3}
          title="🖊️ 소개글 작성 — 200자 이상 + 키워드 + USP"
          time="5분"
          done={!!business?.has_intro}
        >
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
            {isInactive
              ? <>Gemini·Google AI는 <strong>구글 비즈니스 프로필</strong>을 실시간 참조합니다. ChatGPT는 학습 데이터 기반(컷오프 2024.06)이며 신규 콘텐츠 반영까지 수개월 소요됩니다. 아래 소개글을 홈페이지·구글 비즈니스 프로필에도 활용하세요.</>

              : <>AI 브리핑은 소개글의 <strong>핵심 정보를 학습 소스로 활용</strong>합니다.</>}
            {" "}200자 이상(AI 브리핑은 500자 이상 권장) 분량에 사업장의 강점·서비스·키워드를 자연스럽게 포함하세요.
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-700 mb-3">
            <li>키워드를 단순 나열이 아닌 문장 안에 자연스럽게 배치</li>
            <li>소개글에 Q&A 5개 포함 — 스마트플레이스 사장님 Q&A 탭이 폐기된 현재, 소개글 안의 Q&A 섹션이 인용 후보 경로 중 하나입니다</li>
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
              ? <>네이버 일반 검색은 소식의 <strong>최신성</strong>을 중요하게 평가합니다.
                  30일에 1건 이상 신규 소식을 등록하면 네이버 노출 확률이 상승합니다.
                  ChatGPT·Gemini는 네이버 소식 포스트보다 사업장 웹사이트·구글 비즈니스 프로필 업데이트가 더 직접적입니다.</>
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
              <strong>{planInfo.label} 플랜:</strong> 매주 월요일 오전 9시, AI가 업종별 소식 초안을 자동 작성합니다.{" "}
              <Link href="/guide" className="text-purple-700 underline hover:text-purple-900">가이드 페이지의 이번 주 소식 초안</Link>에서 확인하세요.
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
          done={typeof business?.review_count === "number" && business.review_count >= 10}
        >
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
            {isInactive
              ? <>리뷰 수와 품질은 네이버 일반 검색 순위에 영향을 줍니다. ChatGPT·Gemini는 구글 비즈니스 프로필의 리뷰가 더 직접적입니다.
                  영수증 리뷰 <strong>10건 이상</strong>을 목표로 하세요.</>
              : <>네이버 공식 안내: <strong>리뷰수가 기준에 맞지 않을 경우 AI 브리핑 서비스 제공 안 됨.</strong>
                  정확한 임계값은 비공개이나, 영수증 리뷰 10건 이상이면 안전합니다.</>}
          </p>
          <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">
            {typeof business?.review_count === "number"
              ? <>현재 리뷰: <strong>{business.review_count}건</strong>{business.review_count < 10 && " — 10건 이상 권장"}</>
              : <>현재 리뷰: <strong>스캔 후 확인 가능</strong> — 첫 스캔을 진행하면 실측 리뷰 수가 표시됩니다.</>}
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

        {/* ── 스마트플레이스 AI 부가 기능 안내 ────────────────────── */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:p-5">
          <p className="text-sm md:text-base font-semibold text-emerald-900 mb-3">
            🤖 스마트플레이스 AI 부가 기능 — 추가로 활용하세요
          </p>
          <div className="space-y-4">
            {business?.category === "restaurant" && (
              <div className="flex items-start gap-3">
                <span className="shrink-0 text-lg mt-0.5">💬</span>
                <div>
                  <p className="text-sm md:text-base font-medium text-gray-900">
                    플레이스 플러스(beta) AI 리뷰 답글 초안
                    <span className="ml-2 text-sm bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-normal">
                      음식점 전용
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-1">
                    스마트플레이스 자체 AI가 리뷰 등록 시 답글 초안을 자동 생성합니다.
                    답글 스타일·길이 설정이 가능하며, 네이버플러스 구독 계정 대상 베타 서비스입니다.
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    * AEOlab{" "}
                    <Link href="/review-inbox" className="underline">리뷰 답변 관리</Link>
                    는 Claude AI 기반으로 모든 업종을 지원하는 별개 서비스입니다.
                  </p>
                  <a
                    href="https://smartplace.naver.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm text-emerald-700 font-medium hover:text-emerald-900 underline underline-offset-2"
                  >
                    스마트플레이스 → 업체 홈 → 리뷰 →
                  </a>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-lg mt-0.5">🔔</span>
              <div>
                <p className="text-sm md:text-base font-medium text-gray-900">
                  리뷰 민감 이슈 알림
                  <span className="ml-2 text-sm bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5 font-normal">
                    전 업종
                  </span>
                </p>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">
                  부정·민감 이슈가 포함된 리뷰가 등록되면 스마트플레이스 앱으로 즉시 알림을 받을 수 있습니다.
                  빠른 답글 응대는 플레이스 신뢰도 신호에 긍정적 영향을 줍니다.
                </p>
                <a
                  href="https://smartplace.naver.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm text-emerald-700 font-medium hover:text-emerald-900 underline underline-offset-2"
                >
                  스마트플레이스 → 설정 → 알림 설정 →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── §3.4 필수 사진 5종 체크리스트 카드 ────────────────────── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1 break-keep">
          {isInactive ? '검색 노출을 높이는 필수 사진 5종' : 'AI 브리핑 노출을 높이는 필수 사진 5종'}
        </h3>
        <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
          {isInactive
            ? '네이버 일반 검색은 사진 수·다양성·최신성을 노출 신호로 활용합니다. Gemini는 구글 비즈니스 프로필의 사진을, ChatGPT는 사업장 웹사이트 이미지 정보를 간접 참조합니다.'
            : '네이버 AI 브리핑은 사업장의 사진 수·다양성·최신성을 노출 신호로 활용합니다.'}
          {" "}아래 5종을 모두 등록하고, <strong>월 1회 이상 새 사진 추가를 권장합니다.</strong>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {PHOTO_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={checkedPhotos[item.id] ?? false}
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
        <p className="text-sm text-gray-600 leading-relaxed break-keep">
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
          네이버 검색 상위노출을 위한 콘텐츠 품질 4요소 (C-rank)
        </h3>
        <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed break-keep">
          네이버가 콘텐츠 품질을 평가하는 4가지 기준입니다. 소개글·소식·블로그 작성 시 이 요소를 충족할수록 검색 상위노출 가능성이 높아집니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {CRANK_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="checkbox"
              aria-checked={checkedCrank[item.key] ?? false}
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
                <p className="text-sm md:text-base text-gray-600 leading-relaxed break-keep">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed break-keep">
          네이버 콘텐츠 품질 점수는 비공개 알고리즘이며, 위 항목은 영향 요소 추정입니다.
        </p>
      </div>

      {/* ── §M2-3 블로그 UGC 강화 카드 ──────────────────────────── */}
      <div className={`rounded-xl border p-4 md:p-6 ${
        !blogScanned
          ? "border-gray-200 bg-gray-50"
          : blogCount === 0
          ? "border-rose-200 bg-rose-50"
          : "border-green-200 bg-green-50"
      }`}>
        <div className="flex items-start gap-3 mb-3">
          <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            !blogScanned ? "bg-gray-100 text-gray-500" : blogCount === 0 ? "bg-rose-100 text-rose-700" : "bg-green-100 text-green-700"
          }`}>
            {!blogScanned ? "?" : blogCount === 0 ? "!" : blogCount}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base md:text-lg font-bold mb-0.5 break-keep ${
              !blogScanned ? "text-gray-800" : blogCount === 0 ? "text-rose-900" : "text-green-900"
            }`}>
              블로그·SNS 후기
            </h3>
            <p className={`text-sm md:text-base leading-relaxed break-keep ${
              !blogScanned ? "text-gray-600" : blogCount === 0 ? "text-rose-700" : "text-green-700"
            }`}>
              {!blogScanned
                ? "아직 스캔 전이라 블로그 언급 수를 확인할 수 없습니다. 첫 스캔을 진행하면 실측 결과가 표시됩니다."
                : blogCount === 0
                ? "아직 블로그 후기가 감지되지 않았습니다. AI 검색 노출에 블로그 언급은 핵심 신호입니다."
                : `네이버 블로그에서 "${blogCount}건" 검색 결과가 발견되었습니다 (가게명 키워드 검색 기준). AI탭은 블로그·SNS 후기가 풍부한 플레이스를 우선 노출하는 경향이 있습니다 (실측 기반 권장값, 알고리즘 미공개).`}
            </p>
          </div>
        </div>
        {blogScanned && blogCount === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-700 leading-relaxed break-keep">
              외부 블로그 후기 5개 이상 확보 시 AI 브리핑·AI탭 노출 가능성이 높아집니다 (AEOlab 권장 기준, 네이버 알고리즘 비공개).
              리뷰어 초대, 체험단 운영, 소셜 공유 이벤트를 활용해보세요.
            </p>
            <Link
              href="/guide/blog-strategy"
              className="inline-block mt-1 px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-colors"
            >
              블로그 후기 늘리기 전략 →
            </Link>
          </div>
        ) : blogScanned ? (
          <p className="text-sm text-green-700 leading-relaxed break-keep">
            블로그 언급 수를 꾸준히 늘리면 AI 탭 노출 빈도와 인용 가능성이 함께 상승합니다.
            목표: <strong>월 3건 이상</strong> 신규 블로그 후기 유지 (AEOlab 권장 기준).
          </p>
        ) : null}
        {blogScanned && (
          <p className="text-sm text-gray-600 mt-3 leading-relaxed break-keep">
            블로그 언급 수는 스캔 시점 기준이며, 측정 방식에 따라 실제와 차이가 있을 수 있습니다.
          </p>
        )}
      </div>

      {/* ── 플랜 업그레이드 CTA (free 사용자) ────────────────────── */}
      {plan === "free" && (
        <div className="rounded-xl p-5 md:p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
          <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 break-keep">
            소개글·채팅방 메뉴 AI 자동 생성으로 시간을 절약하세요
          </h3>
          <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
            Basic 플랜(월 11,900원)부터 소개글·톡톡 채팅방 메뉴 AI 자동 생성을 사용할 수 있습니다.
            첫 달 50% 할인(5,950원).
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
