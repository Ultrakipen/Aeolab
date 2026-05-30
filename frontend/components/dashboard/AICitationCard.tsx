'use client'

import { useState, useEffect } from 'react'
import { MessageSquareQuote, ChevronDown, ChevronUp, Search } from 'lucide-react'
import Link from 'next/link'

const PLATFORM_COLORS: Record<string, string> = {
  gemini:  'bg-blue-100 text-blue-700',
  naver:   'bg-green-100 text-green-700',
  chatgpt: 'bg-emerald-100 text-emerald-700',
  claude:  'bg-orange-100 text-orange-700',
  google:  'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-700',
}

const SENTIMENT_BADGE: Record<string, { label: string; cls: string }> = {
  positive: { label: '긍정', cls: 'bg-emerald-50 text-emerald-600' },
  negative: { label: '부정', cls: 'bg-red-50 text-red-600' },
  neutral:  { label: '중립', cls: 'bg-gray-50 text-gray-500' },
}

interface Citation {
  platform: string
  platform_label: string
  query: string
  excerpt: string
  sentiment?: string
}

interface Props {
  bizId: string
  token: string
  briefingEligibility?: "active" | "likely" | "inactive"
}

export default function AICitationCard({ bizId, token, briefingEligibility }: Props) {
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [previewMessage, setPreviewMessage] = useState<string>('')
  // prop(대시보드에서 계산된 값)을 우선, API 응답은 prop이 없을 때만 fallback
  const [apiEligibility, setApiEligibility] = useState<"active" | "likely" | "inactive" | null>(null)

  const eligibility = briefingEligibility ?? apiEligibility ?? "active"
  const isNaverInactive = eligibility === "inactive"

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    fetch(`${BACKEND}/api/report/ai-citations/${bizId}?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.citations?.length > 0) setCitations(data.citations)
        if (data?.eligibility) setApiEligibility(data.eligibility)
        if (data?.is_preview) {
          setIsPreview(true)
          setPreviewMessage(data.preview_message ?? '')
        }
      })
      .catch((e) => console.warn('[AICitation]', e))
      .finally(() => setLoading(false))
  }, [bizId, token])

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  // naver 계열 플랫폼 판별 (platform 값이 null·다른 형태여도 platform_label로 이중 방어)
  const isNaverBriefingItem = (c: Citation) =>
    (c.platform ?? '').toLowerCase().startsWith('naver') ||
    (c.platform_label ?? '').includes('브리핑') ||
    (c.platform_label ?? '').toLowerCase().includes('naver');

  // INACTIVE 업종은 네이버 AI 브리핑 인용 필터링 (이중 방어)
  const filteredCitations = isNaverInactive
    ? citations.filter(c => !isNaverBriefingItem(c))
    : citations

  // (platform + query) 조합 기준 최신 1건만 유지 — 반복 스캔 시 중복 제거
  const dedupedCitations = (() => {
    const seen = new Set<string>();
    return filteredCitations.filter(c => {
      const key = `${c.platform}||${c.query}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const mentionedCount = dedupedCitations.filter(c => c.excerpt && c.excerpt.length > 0).length

  if (dedupedCitations.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareQuote className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-bold text-gray-900">AI 검색 언급 분석</h3>
        </div>
        {isNaverInactive && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-amber-800">이 업종은 네이버 AI 브리핑 대상이 아닙니다</p>
            <p className="text-sm text-amber-700 mt-0.5">네이버 AI탭(업종 공식 제한 없음, 2026-04-28 베타) · ChatGPT · Gemini 노출 현황을 확인합니다.</p>
          </div>
        )}
        <p className="text-sm text-gray-500 leading-relaxed">
          아직 AI 인용 데이터가 없습니다. 스캔을 완료하면 자동으로 분석됩니다.
        </p>
        <div className="mt-4 bg-amber-50 rounded-lg p-3">
          <p className="text-sm font-semibold text-amber-800">AI가 아직 내 가게를 언급하지 않고 있습니다</p>
          <p className="text-sm text-amber-700 mt-1">소개글 Q&A 추가와 키워드 보강이 가장 효과적입니다.</p>
          <Link href="/guide" className="mt-2 inline-flex items-center text-sm font-semibold text-amber-800 hover:underline">
            지금 소개글 편집하러 가기 →
          </Link>
        </div>
      </div>
    )
  }

  const INITIAL_VISIBLE = 10
  // is_preview일 때는 첫 1건만 표시하고 잠금 오버레이를 보여줌
  const visibleCitations = isPreview ? dedupedCitations.slice(0, 1) : dedupedCitations
  const visible = expanded ? visibleCitations : visibleCitations.slice(0, INITIAL_VISIBLE)

  return (
    <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquareQuote className="w-5 h-5 text-blue-500" />
        <div>
          <h3 className="text-base font-bold text-gray-900">AI 검색 언급 분석</h3>
          <p className="text-sm text-gray-500">
            {isNaverInactive
              ? "AI탭 · Gemini · ChatGPT 추천 시뮬레이션 (이 업종은 네이버 AI 브리핑 대상 아님)"
              : "네이버 AI 브리핑 실제 문장 · Gemini/ChatGPT 추천 시뮬레이션"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {visible.map((c, i) => {
          // INACTIVE 업종: 렌더링 레벨에서 네이버 카드 제거 (filteredCitations 이중 방어)
          if (isNaverInactive && isNaverBriefingItem(c)) return null;
          const colorCls = PLATFORM_COLORS[c.platform] ?? PLATFORM_COLORS.default
          const sent = c.sentiment ? SENTIMENT_BADGE[c.sentiment] : null
          return (
            <div key={i} className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${colorCls}`}>
                  {c.platform_label || c.platform}
                </span>
                {sent && c.excerpt && c.excerpt.length > 0 && !c.excerpt.includes('(구체적 인용문 없음)') && (
                  <span className={`text-sm px-2 py-0.5 rounded-full ${sent.cls}`}>
                    {sent.label}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                  <Search className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-500 font-medium">검색어</span>
                  <span className="text-sm font-semibold text-slate-700">&ldquo;{c.query}&rdquo;</span>
                </span>
              </div>
              {c.excerpt && c.excerpt.length > 0 && !c.excerpt.includes('(구체적 인용문 없음)') ? (
                c.platform === 'naver' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <p className="text-sm text-amber-700 font-semibold mb-1">네이버 브리핑에서 발견된 실제 문장</p>
                    <p className="text-sm text-gray-800 leading-relaxed italic">
                      &ldquo;{c.excerpt}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <p className="text-sm text-blue-600 font-semibold mb-1">
                      {c.platform === 'gemini' ? 'Gemini가 추천 시 사용할 표현 (50회 샘플 기반)' : 'ChatGPT가 추천 시 사용할 표현 (50회 샘플 기반)'}
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed italic">
                      &ldquo;{c.excerpt}&rdquo;
                    </p>
                  </div>
                )
              ) : c.platform === 'google' ? (
                <p className="text-sm text-gray-400 italic">
                  Google AI Overview는 현재 자동 측정이 보류 중입니다.
                </p>
              ) : c.platform === 'chatgpt' ? (
                <p className="text-sm text-gray-400 italic">
                  ChatGPT 학습 데이터에 아직 포함되지 않았습니다.
                  한국 소상공인 평균 노출률 1~3% — 현재 수준이 정상입니다.
                </p>
              ) : c.platform === 'gemini' ? (
                <p className="text-sm text-gray-400 italic">
                  이번 스캔에서 Gemini가 가게를 언급하지 않았습니다.
                  구글 비즈니스 프로필 등록 시 개선 가능합니다.
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  이번 스캔에서 인용 문장이 감지되지 않았습니다.
                </p>
              )}
              {/* 부정 sentiment 인용에 개선 링크 */}
              {c.sentiment === 'negative' && (
                <Link href="/guide" className="text-sm text-red-600 hover:underline mt-1 block">
                  이 부분 개선 방법 →
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Free 미리보기 잠금 오버레이 */}
      {isPreview && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-sm font-semibold text-blue-800">
            {previewMessage || 'ChatGPT 인용 전체 분석은 Basic 이상에서 확인하세요'}
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            업그레이드하기 →
          </Link>
        </div>
      )}

      {!isPreview && dedupedCitations.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-800 py-1"
        >
          {expanded ? (
            <><ChevronUp className="w-4 h-4" />접기</>
          ) : (
            <><ChevronDown className="w-4 h-4" />더 보기 ({dedupedCitations.length - INITIAL_VISIBLE}개 더)</>
          )}
        </button>
      )}

      {/* 인용 후 행동 유도 */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        {mentionedCount === 0 ? (
          <div className="bg-amber-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-amber-800">AI가 아직 내 가게를 언급하지 않고 있습니다</p>
            <p className="text-sm text-amber-700">
              <strong>Gemini 개선</strong> — 구글 비즈니스 프로필 등록 후 <strong>2~4주 내 반영 시작</strong>, 안정적 인용까지 3~6개월 소요됩니다.
            </p>
            <p className="text-sm text-amber-700">
              <strong>ChatGPT</strong> — 학습 데이터(컷오프 2024.06) 기반으로 단기 개선이 어렵습니다. 블로그·미디어 언급이 장기적으로 누적되어야 반영됩니다.
            </p>
            <Link href="/guide" className="mt-1 inline-flex items-center text-sm font-semibold text-amber-800 hover:underline">
              Gemini 노출 설정 가이드 →
            </Link>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-800">AI 답변에서 내 가게 언급 {mentionedCount}건 발견</p>
            <p className="text-sm text-blue-700 mt-1">
              검색 후 클릭 없이 AI 답변만 보고 끝나는 비중이 빠르게 늘고 있습니다. 답변 안에 내 가게가 등장하는 것 자체가 노출입니다.
            </p>
            <p className="text-sm text-blue-700 mt-1">언급된 키워드를 소개글 Q&A와 본문에 더 자주 넣으면 노출 빈도가 높아집니다.</p>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600 mt-3 leading-relaxed">
        ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
        측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
      </p>
    </div>
  )
}
