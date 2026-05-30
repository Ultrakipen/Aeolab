import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, CheckCircle2 } from 'lucide-react'
import { getBriefingEligibility } from '@/lib/userGroup'
import { getActiveBusinessId } from '@/lib/active-business'

/**
 * 네이버 AI탭 — 5항목 설정 가이드 (모든 업종 대상)
 *
 * 네이버 AI 브리핑(/guide/ai-info-tab)과 다른 노출 경로:
 *  - AI탭: 검색결과 상단 "AI" 탭 메뉴, 2026-04-28 베타, 업종·프랜차이즈 제한 없음
 *  - AI 브리핑: 검색결과 상단 AI 자동 추천 박스, 음식점·카페 등 ACTIVE 업종만, 프랜차이즈 제외
 *
 * 핵심 항목 5종 (네이버 공식 + 실측 기반):
 *  1. 소개글 200자 이상 (Q&A 구조 포함 권장)
 *  2. 사진 10장 이상 (외관·내부·서비스)
 *  3. 예약 연동 (선택, AI탭 결과에 예약 버튼 추가)
 *  4. 리뷰 10건 이상 (업종 키워드 포함, 권장값)
 *  5. 블로그·SNS 후기 유도
 */
export default async function AiTabGuidePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user || error) redirect('/login')

  const params = await searchParams
  const selectedBizId = params.biz_id ?? null
  const activeBizId = selectedBizId ?? await getActiveBusinessId(user.id)

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, category, is_franchise, naver_place_url, naver_place_id, review_count, blog_mention_count, sp_completeness_json')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(10)

  const business = (activeBizId
    ? businesses?.find(b => b.id === activeBizId)
    : businesses?.[0]) ?? null

  const sp = (business as { sp_completeness_json?: { has_reservation?: boolean; photo_count?: number } } | null)?.sp_completeness_json
  const hasReservation = sp && typeof sp.has_reservation === 'boolean' ? sp.has_reservation : null
  const photoCount = sp && typeof sp.photo_count === 'number' ? sp.photo_count : null
  const reviewCount = business?.review_count ?? 0
  const blogMentionCount = (business as { blog_mention_count?: number } | null)?.blog_mention_count ?? 0

  const briefingElig = business
    ? getBriefingEligibility(business.category, !!business.is_franchise)
    : 'inactive'

  const items = [
    {
      num: 1,
      title: '소개글 200자 이상 (Q&A 구조 권장)',
      desc: 'Q&A 구조의 소개글이 AI탭 인용 가능성이 높습니다 (실측 기반 권장값, 알고리즘 미공개). 자주 묻는 질문 3~5개를 답변과 함께 포함하세요.',
      example: '예: "Q. 주차 가능한가요? A. 건물 지하 1층 무료 주차 10대 가능합니다."',
      status: '직접 확인',
    },
    {
      num: 2,
      title: '사진 10장 이상 등록',
      desc: '외관·내부·서비스 현장 사진. AI탭이 검색결과에 노출할 때 썸네일 후보로 사용합니다.',
      example: '필수: 외관·내부·메뉴판·시그니처(또는 대표 서비스) 사진',
      status: photoCount !== null ? (photoCount >= 10 ? `✓ ${photoCount}장 등록됨` : `현재 ${photoCount}장`) : '미측정',
      statusOk: photoCount !== null && photoCount >= 10,
    },
    {
      num: 3,
      title: '예약 연동 (선택)',
      desc: '네이버 예약 연동 시 AI탭 결과에 예약 버튼이 추가로 표시됩니다. 음식점·미용·숙박 등 예약 기반 업종 권장.',
      example: 'partner.naver.com → 예약 채널 설정',
      status: hasReservation === true ? '✓ 연동됨' : hasReservation === false ? '미연동' : '미측정',
      statusOk: hasReservation === true,
      externalUrl: 'https://partner.naver.com/',
    },
    {
      num: 4,
      title: '리뷰 확보 (10건 이상 권장, 업종 키워드 포함)',
      desc: '업종 핵심 키워드가 포함된 리뷰가 AI탭 인용 가능성을 높입니다. 영수증 리뷰·블로그 리뷰 유도. 공식 임계값은 비공개이며 10건은 권장 기준입니다.',
      example: '음식점 → "분위기·맛·재방문" 키워드, 미용 → "시술·만족도·서비스" 키워드',
      status: reviewCount >= 10 ? `✓ ${reviewCount}건` : `현재 ${reviewCount}건`,
      statusOk: reviewCount >= 10,
    },
    {
      num: 5,
      title: '블로그·SNS 후기 유도',
      desc: 'AI탭은 외부 블로그 언급도 신호로 사용합니다. 손님 블로그 후기 유도 + 사장님 직접 운영 블로그.',
      example: '리뷰 인증 이벤트, 블로그 체험단, 메뉴 출시 공지 등',
      status: blogMentionCount >= 5 ? `✓ ${blogMentionCount}건 발견` : blogMentionCount > 0 ? `${blogMentionCount}건 발견` : '미발견',
      statusOk: blogMentionCount >= 5,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href="/guide"
          className="inline-flex items-center gap-1 text-sm md:text-base text-gray-500 hover:text-blue-600"
        >
          <ChevronLeft className="w-4 h-4" /> 가이드로 돌아가기
        </Link>
        <Link
          href="/guide/ai-info-tab"
          className="inline-flex items-center gap-1 text-sm md:text-base text-blue-600 hover:underline font-medium"
        >
          AI 브리핑 5단계 가이드 →
        </Link>
      </div>

      {/* 두 경로 분기 안내 — 가이드 진입 직후 명확화 */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 md:p-5">
        <p className="text-sm md:text-base font-bold text-indigo-900 mb-1.5">
          🆕 네이버 AI탭 — 검색결과 상단 &quot;AI&quot; 탭 (2026-04-28 베타)
        </p>
        <p className="text-sm md:text-base text-indigo-800 leading-relaxed break-keep">
          AI 브리핑(검색결과 상단 자동 추천 박스)과는 다른 노출 경로입니다.
          AI탭은 <strong>업종·프랜차이즈 제한 없이 모든 사업장</strong>이 노출 가능합니다.
          2026-04-28 베타 출시, 2026년 6월 정식 출시 예정입니다 (현재 베타 서비스 중).
        </p>
        {briefingElig === 'active' && (
          <p className="mt-2 text-sm text-indigo-700 bg-white border border-indigo-100 rounded px-2.5 py-1.5">
            ℹ️ 내 업종은 <strong>AI 브리핑 대상 업종</strong>입니다. AI 브리핑 가이드도 함께 진행하세요.{' '}
            <Link href="/guide/ai-info-tab" className="underline font-semibold">AI 브리핑 5단계 →</Link>
          </p>
        )}
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-keep">
          네이버 AI탭 — 5항목 설정 가이드
        </h1>
        <p className="text-base md:text-lg text-gray-700 leading-relaxed break-keep">
          AI탭에 내 사업장이 노출되도록 핵심 항목 5개를 점검합니다. 평균 소요 20분.
        </p>
        <p className="mt-2 text-sm md:text-base text-gray-500">
          출처:{" "}
          <a
            href="https://search.naver.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            네이버 AI탭 베타 출시 2026-04-28
          </a>{" "}
          · 항목 기준은 실측 기반 권장값
        </p>
      </div>

      {/* 내 사업장 안내 박스 */}
      <div className="rounded-xl p-4 md:p-5 bg-slate-50 border border-slate-200">
        {business ? (
          <p className="text-sm md:text-base text-gray-700 leading-relaxed break-keep">
            <strong>{business.name}</strong>: AI탭은 업종 공식 제한 없이 모든 사업장이 노출 가능합니다 (2026-04-28 베타, 2026년 6월 정식 출시 예정). 아래 5개 항목을 충실히 갖출수록 노출 확률이 높아집니다.
          </p>
        ) : (
          <p className="text-sm md:text-base text-gray-700">
            먼저 사업장을 등록해주세요.{" "}
            <Link href="/onboarding" className="text-blue-600 hover:underline font-medium">
              사업장 등록하기 →
            </Link>
          </p>
        )}
      </div>

      {/* 5항목 카드 */}
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.num}
            className={`rounded-xl border p-5 md:p-6 ${
              item.statusOk
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3 mb-2">
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black shrink-0 ${
                  item.statusOk ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white'
                }`}
              >
                {item.statusOk ? <CheckCircle2 className="w-5 h-5" /> : item.num}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-0.5 break-keep">
                  {item.title}
                </h3>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-sm font-semibold ${
                    item.statusOk
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-2 break-keep">
              {item.desc}
            </p>
            <p className="text-sm text-gray-500 italic break-keep">{item.example}</p>
            {item.externalUrl && (
              <a
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              >
                네이버 파트너센터에서 설정하기 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>

      {/* 면책 문구 */}
      <p className="text-sm text-gray-500 leading-snug break-keep">
        AI탭 노출은 네이버 알고리즘 기준이며 보장되지 않습니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
        AI탭은 2026-04-28 베타 출시 · 2026년 6월 정식 출시 예정이며, 노출 조건은 정식 출시 후 변경될 수 있습니다.
      </p>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:p-5">
        <p className="text-sm md:text-base text-gray-800 mb-3 leading-relaxed break-keep">
          <strong>AI 브리핑도 함께 점검</strong> — 음식점·카페·베이커리·바·숙박업이거나 AI 브리핑 확대 예정 업종이면 5단계 설정도 완료하세요.
        </p>
        <Link
          href="/guide/ai-info-tab"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base font-bold px-4 py-2 transition-colors"
        >
          AI 브리핑 5단계 가이드 →
        </Link>
      </div>
    </div>
  )
}
