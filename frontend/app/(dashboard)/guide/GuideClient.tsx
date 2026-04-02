'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PlanGate } from '@/components/common/PlanGate'
import {
  Lightbulb, RefreshCw, Copy, Check, ChevronDown, ChevronUp,
  Zap, Star, TrendingUp, MessageSquare, FileText, Hash, HelpCircle,
  Download, CalendarDays,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// 업종 영문 코드 → 한국어 (네이버 검색 URL 구성용)
const CATEGORY_KO: Record<string, string> = {
  restaurant: '음식점', cafe: '카페', beauty: '미용실',
  clinic: '병원', academy: '학원', legal: '법률',
  fitness: '헬스장', pet: '반려동물', shopping: '쇼핑몰',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '바로 가능', medium: '조금 준비', hard: '전문가 도움',
}
const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-orange-100 text-orange-700',
}
const STAGE_COLOR: Record<string, string> = {
  survival: 'bg-red-50 border-red-200 text-red-800',
  stability: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  growth: 'bg-blue-50 border-blue-200 text-blue-800',
  dominance: 'bg-green-50 border-green-200 text-green-800',
}
const URGENCY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
}

interface FAQ {
  question: string
  answer: string
}

interface ReviewDraft {
  review_snippet: string
  rating?: number
  draft_response: string
  tone: string
}

interface BriefingPath {
  path_id: string
  label: string
  urgency: string
  urgency_label: string
  time_required: string
  what_to_do: string
  ready_text: string
  effect: string
  platform_url?: string
}

interface ToolsJson {
  briefing_summary?: string
  direct_briefing_paths?: BriefingPath[]
  review_request_message?: string
  review_response_drafts?: ReviewDraft[]
  naver_post_template?: string
  smart_place_faq_answers?: FAQ[]
  faq_list?: FAQ[]
  keyword_list?: string[]
  smart_place_checklist?: string[]
  seo_checklist?: string[]
}

interface GrowthStage {
  stage: string
  stage_label: string
  score_range: string
  focus_message: string
  this_week_action: string
  do_not_do: string
  estimated_weeks_to_next?: number
}

interface ReviewKeywordGap {
  covered_keywords: string[]
  missing_keywords: string[]
  competitor_only_keywords: string[]
  pioneer_keywords: string[]
  coverage_rate: number
  top_priority_keyword?: string
  qr_card_message: string
  category_scores: Record<string, number>
}

interface GuideItem {
  rank: number
  dimension?: string
  category?: string
  title: string
  action: string
  difficulty: string
  time_required?: string
  competitor_example?: string
  is_quick_win?: boolean
}

interface Guide {
  id: string
  summary: string
  items_json: GuideItem[]
  priority_json: string[]
  generated_at: string
  checklist_done?: number[]
  context?: string
  next_month_goal?: string
  tools_json?: ToolsJson
}

interface Props {
  business: { id: string; name: string; category?: string; region?: string; naver_place_id?: string }
  guide: Guide | null
  latestScanId: string | null
  userId: string
  currentPlan?: string
  guideUsed?: number
  guideLimit?: number
}

// ── 복사 버튼 ─────────────────────────────────────────────────────────────────
function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-sm px-2.5 py-1.5 min-h-[44px] rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {copied ? '복사됨' : label}
    </button>
  )
}

// ── AI 브리핑 직접 관리 경로 ──────────────────────────────────────────────────
function BriefingPathsSection({ paths, naverSearchUrl }: { paths: BriefingPath[]; naverSearchUrl?: string }) {
  const [expanded, setExpanded] = useState<string | null>(paths[0]?.path_id ?? null)

  if (!paths.length) return null

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <div className="text-sm font-semibold text-gray-900">AI 브리핑 직접 관리 — 오늘 바로 할 수 있는 것</div>
        </div>
        {naverSearchUrl && (
          <a
            href={naverSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition-colors shrink-0 font-medium"
          >
            네이버 AI 브리핑 확인 →
          </a>
        )}
      </div>
      <p className="text-base text-gray-500 mb-4">고객 리뷰를 기다리지 않고 사장님이 직접 AI 신호를 강화하는 방법입니다.</p>
      <div className="space-y-2">
        {paths.map((path) => {
          const isOpen = expanded === path.path_id
          return (
            <div key={path.path_id} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : path.path_id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
              >
                <span className={`text-sm px-2 py-0.5 rounded-full font-medium shrink-0 ${URGENCY_COLOR[path.urgency] ?? 'bg-gray-100 text-gray-600'}`}>
                  {path.urgency_label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium text-gray-800">{path.label}</div>
                  <div className="text-base text-gray-500">{path.time_required} · {path.effect}</div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                  <div className="text-base text-gray-700 leading-relaxed">
                    <span className="font-medium text-gray-900">방법: </span>{path.what_to_do}
                  </div>
                  {path.ready_text && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700">바로 붙여넣기 가능한 문구</span>
                        <CopyButton text={path.ready_text} label="문구 복사" />
                      </div>
                      <p className="text-base text-blue-800 leading-relaxed whitespace-pre-wrap">{path.ready_text}</p>
                    </div>
                  )}
                  {path.platform_url && (
                    <a
                      href={path.platform_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      바로 가기 →
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 성장 단계 카드 ─────────────────────────────────────────────────────────────
function GrowthStageCard({ stage }: { stage: GrowthStage }) {
  const colorClass = STAGE_COLOR[stage.stage] ?? 'bg-gray-50 border-gray-200 text-gray-800'
  return (
    <div className={`rounded-2xl border p-5 ${colorClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-semibold">현재 단계: {stage.stage_label}</span>
        </div>
        <span className="text-base opacity-70">{stage.score_range}</span>
      </div>
      <p className="text-base mb-3 leading-relaxed">{stage.focus_message}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-white bg-opacity-60 rounded-xl p-3">
          <div className="text-base font-semibold mb-1">이번 주 집중할 것</div>
          <p className="text-base leading-relaxed">{stage.this_week_action}</p>
        </div>
        <div className="bg-white bg-opacity-40 rounded-xl p-3">
          <div className="text-base font-semibold mb-1 opacity-70">지금 하지 말아야 할 것</div>
          <p className="text-base leading-relaxed opacity-80">{stage.do_not_do}</p>
        </div>
      </div>
      {stage.estimated_weeks_to_next && (
        <p className="text-base opacity-60 mt-2">다음 단계까지 약 {stage.estimated_weeks_to_next}주 예상</p>
      )}
    </div>
  )
}

// ── 키워드 갭 카드 ─────────────────────────────────────────────────────────────
function KeywordGapCard({ gap }: { gap: ReviewKeywordGap }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Hash className="w-4 h-4 text-purple-500" />
        <div className="text-sm font-semibold text-gray-900">리뷰 키워드 현황</div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className="bg-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${gap.coverage_rate * 100}%` }}
          />
        </div>
        <span className="text-base text-gray-500 shrink-0">{Math.round(gap.coverage_rate * 100)}% 충족</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {gap.covered_keywords.length > 0 && (
          <div>
            <div className="text-sm font-medium text-green-700 mb-1.5">보유 키워드 ✓</div>
            <div className="flex flex-wrap gap-1">
              {gap.covered_keywords.slice(0, 8).map((kw) => (
                <span key={kw} className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}
        {gap.missing_keywords.length > 0 && (
          <div>
            <div className="text-sm font-medium text-red-700 mb-1.5">부족한 키워드 ✗</div>
            <div className="flex flex-wrap gap-1">
              {gap.missing_keywords.slice(0, 8).map((kw) => (
                <span key={kw} className="text-sm bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}
        {gap.competitor_only_keywords.length > 0 && (
          <div>
            <div className="text-sm font-medium text-orange-700 mb-1.5">경쟁사만 보유</div>
            <div className="flex flex-wrap gap-1">
              {gap.competitor_only_keywords.slice(0, 8).map((kw) => (
                <span key={kw} className="text-sm bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {gap.pioneer_keywords && gap.pioneer_keywords.length > 0 && (
        <div className="mt-3 bg-emerald-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Star className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">선점 기회 키워드 — 경쟁사도 없음</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {gap.pioneer_keywords.slice(0, 5).map((kw) => (
              <button
                key={kw}
                onClick={() => navigator.clipboard.writeText(kw).catch(() => {})}
                className="text-sm bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full hover:bg-emerald-200 transition-colors"
                title="클릭하여 복사"
              >
                ✦ {kw}
              </button>
            ))}
          </div>
          <p className="text-base text-emerald-600 mt-1.5">지금 먼저 선점하면 경쟁 우위를 오래 유지할 수 있습니다.</p>
        </div>
      )}

      {gap.top_priority_keyword && (
        <div className="bg-purple-50 rounded-xl p-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-purple-900 mb-0.5">지금 가장 필요한 키워드</div>
            <div className="text-sm font-bold text-purple-700">#{gap.top_priority_keyword}</div>
            <p className="text-base text-purple-600 mt-1">리뷰 답변이나 FAQ에 이 키워드를 포함하세요.</p>
          </div>
          <CopyButton text={`#${gap.top_priority_keyword}`} />
        </div>
      )}

      {gap.qr_card_message && (
        <div className="mt-3 bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">QR 리뷰 유도 문구</span>
            <CopyButton text={gap.qr_card_message} />
          </div>
          <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap">{gap.qr_card_message}</p>
        </div>
      )}
    </div>
  )
}

// ── 리뷰 답변 초안 ─────────────────────────────────────────────────────────────
function ReviewDraftsSection({ drafts, naverPlaceId }: { drafts: ReviewDraft[]; naverPlaceId?: string }) {
  const TONE_LABEL: Record<string, string> = {
    grateful: '긍정 리뷰 감사', apologetic: '부정 리뷰 대응', neutral: '일반 리뷰',
  }
  if (!drafts.length) return null
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <div className="text-sm font-semibold text-gray-900">리뷰 답변 초안</div>
        </div>
        <a
          href={naverPlaceId ? `https://smartplace.naver.com/places/${naverPlaceId}/review` : "https://smartplace.naver.com"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 font-medium transition-colors"
        >
          스마트플레이스 리뷰 관리 →
        </a>
      </div>
      <p className="text-base text-gray-500 mb-4">복사 후 스마트플레이스에서 붙여넣으세요. 리뷰 답변율은 AI 브리핑 노출 가중치 #1 신호입니다.</p>
      <div className="space-y-3">
        {drafts.map((d, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{TONE_LABEL[d.tone] ?? d.tone}</span>
                {d.rating && (
                  <span className="text-base text-yellow-500">{'★'.repeat(d.rating)}{'☆'.repeat(5 - d.rating)}</span>
                )}
              </div>
              <CopyButton text={d.draft_response} />
            </div>
            {d.review_snippet && (
              <p className="text-base text-gray-400 italic mb-2 truncate">원본: "{d.review_snippet}"</p>
            )}
            <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{d.draft_response}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 주간 소식 초안 섹션 ──────────────────────────────────────────────────────
function WeeklyPostDraftSection({ businessId, token }: { businessId: string; token: string | null }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    const fetchDraft = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/guide/${businessId}/latest?context=post_draft`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const items = data?.items_json ?? []
          if (items.length > 0) setDraft(items[0].action || null)
        }
      } catch {}
      setLoading(false)
    }
    fetchDraft()
  }, [businessId, token])

  if (loading) return null
  if (!draft) return null

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-gray-900">이번 주 소식 초안</span>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">자동 생성</span>
      </div>
      <div className="bg-green-50 rounded-xl p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base text-gray-700 leading-relaxed flex-1">{draft}</p>
          <CopyButton text={draft} label="복사" />
        </div>
      </div>
      <p className="text-base text-gray-400 mt-2">
        위 초안을 복사해{' '}
        <a
          href="https://smartplace.naver.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          네이버 스마트플레이스
        </a>
        {' '}소식 탭에 붙여넣으세요.
      </p>
    </div>
  )
}

// ── 리뷰 유도 문구 + 소식 템플릿 ──────────────────────────────────────────────
function QuickToolsSection({ tools, businessId, token }: { tools: ToolsJson; businessId: string; token: string | null }) {
  const hasSomething = tools.review_request_message || tools.naver_post_template || (tools.keyword_list?.length)
  if (!hasSomething) return null

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-indigo-500" />
        <div className="text-sm font-semibold text-gray-900">즉시 활용 가능한 도구</div>
      </div>

      {tools.review_request_message && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">QR·영수증용 리뷰 유도 문구</span>
            <CopyButton text={tools.review_request_message} />
          </div>
          <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap">{tools.review_request_message}</p>
        </div>
      )}

      {tools.naver_post_template && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">스마트플레이스 '소식' 공지 초안</span>
            <CopyButton text={tools.naver_post_template} />
          </div>
          <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap">{tools.naver_post_template}</p>
        </div>
      )}

      {tools.keyword_list && tools.keyword_list.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">리뷰·블로그에 넣어야 할 핵심 키워드</span>
            <CopyButton text={tools.keyword_list.join(', ')} label="전체 복사" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tools.keyword_list.map((kw) => (
              <button
                key={kw}
                onClick={() => navigator.clipboard.writeText(kw).catch(() => {})}
                className="text-sm bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors"
                title="클릭하여 복사"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* QR 카드 다운로드 */}
      {businessId && token && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">리뷰 유도 QR 카드</span>
              <p className="text-base text-gray-400 mt-0.5">카운터에 붙이는 인쇄용 A6 카드</p>
            </div>
            <a
              href={`${BACKEND}/api/guide/${businessId}/qr-card`}
              download="review_qr.png"
              onClick={(e) => {
                // Bearer 토큰이 필요하므로 fetch로 처리
                e.preventDefault()
                fetch(`${BACKEND}/api/guide/${businessId}/qr-card`, {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then((r) => r.ok ? r.blob() : Promise.reject())
                  .then((blob) => {
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'review_qr.png'; a.click()
                    URL.revokeObjectURL(url)
                  })
                  .catch(() => alert('QR 카드 생성에 실패했습니다.'))
              }}
              className="flex items-center gap-1.5 text-sm bg-white border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> 다운로드 (PNG)
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FAQ 섹션 ──────────────────────────────────────────────────────────────────
function FAQSection({ faqs, title }: { faqs: FAQ[]; title: string }) {
  const [open, setOpen] = useState(false)
  if (!faqs.length) return null
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className="text-xs bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full">{faqs.length}개</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {faqs.map((faq, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-semibold text-teal-700">Q. {faq.question}</p>
                <CopyButton text={`Q: ${faq.question}\nA: ${faq.answer}`} />
              </div>
              <p className="text-base text-gray-700 leading-relaxed">A. {faq.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function GuideClient({
  business,
  guide: initialGuide,
  latestScanId,
  userId,
  currentPlan = 'free',
  guideUsed = 0,
  guideLimit = 0,
}: Props) {
  const router = useRouter()
  const [guide, setGuide] = useState<Guide | null>(initialGuide)
  const [loading, setLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [scanRequested, setScanRequested] = useState(false)
  const [growthStage, setGrowthStage] = useState<GrowthStage | null>(null)
  const [keywordGap, setKeywordGap] = useState<ReviewKeywordGap | null>(null)
  const [gapLoading, setGapLoading] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Supabase 세션 토큰 확보 (QR 다운로드, 소식 초안 fetch에 필요)
  useEffect(() => {
    const getToken = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) setAuthToken(session.access_token)
      } catch {}
    }
    getToken()
  }, [])

  const STORAGE_KEY = `guide_checklist_${business.id}`

  // DB 저장값 또는 localStorage에서 체크리스트 복원
  useEffect(() => {
    if (guide?.checklist_done && guide.checklist_done.length > 0) {
      setChecked(new Set(guide.checklist_done))
      return
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setChecked(new Set(JSON.parse(saved)))
    } catch {}
  }, [STORAGE_KEY, guide?.id])

  // 격차 분석 (성장 단계 + 키워드 갭) 로드
  const fetchGapData = useCallback(async () => {
    setGapLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/report/gap/${business.id}`, {
        credentials: 'include',
        headers: { 'X-User-Id': userId },
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.growth_stage) setGrowthStage(data.growth_stage)
      if (data.keyword_gap) setKeywordGap(data.keyword_gap)
    } catch {}
    finally { setGapLoading(false) }
  }, [business.id, userId])

  useEffect(() => {
    if (guide) fetchGapData()
  }, [guide?.id, fetchGapData])

  const toggleCheck = (rank: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(rank)) next.delete(rank)
      else next.add(rank)
      const arr = [...next]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)) } catch {}
      if (guide) {
        fetch(`${BACKEND}/api/guide/${guide.id}/checklist`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ done: arr }),
        }).catch(() => {})
      }
      return next
    })
  }

  const generateGuide = async () => {
    if (!latestScanId) {
      setError('먼저 AI 스캔을 실행하세요.')
      return
    }
    setLoading(true)
    setElapsedSeconds(0)
    setError('')

    const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000)

    try {
      await fetch(`${BACKEND}/api/guide/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ business_id: business.id, scan_id: latestScanId }),
      })
      let guideData = null
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise((r) => setTimeout(r, 5000))
        try {
          const res = await fetch(`${BACKEND}/api/guide/${business.id}/latest`, {
            credentials: 'include',
            headers: { 'X-User-Id': userId },
          })
          if (res.ok) {
            guideData = await res.json()
            break
          }
        } catch {}
      }
      if (guideData) {
        setGuide(guideData)
        router.refresh()
      } else {
        setError('가이드 생성에 시간이 걸리고 있습니다. 잠시 후 페이지를 새로고침해주세요.')
      }
    } catch {
      setError('가이드 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  const guideRemaining = guideLimit >= 999 ? null : guideLimit - guideUsed
  const guideExhausted = guideLimit > 0 && guideUsed >= guideLimit
  const isFree = guideLimit === 0

  if (isFree) {
    return (
      <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="AI 개선 가이드">
        <div />
      </PlanGate>
    )
  }

  const tools: ToolsJson = guide?.tools_json ?? {}
  const briefingPaths: BriefingPath[] = tools.direct_briefing_paths ?? []
  const reviewDrafts: ReviewDraft[] = tools.review_response_drafts ?? []
  const spFaqs: FAQ[] = tools.smart_place_faq_answers ?? []
  const aiFaqs: FAQ[] = tools.faq_list ?? []

  return (
    <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="AI 개선 가이드">
      <div className="space-y-6">

        {/* 상단 액션 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {guide && (
              <p className="text-base text-gray-400">
                마지막 생성: {new Date(guide.generated_at).toLocaleDateString('ko-KR')}
              </p>
            )}
            {guideLimit > 0 && (
              <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${
                guideRemaining === 0
                  ? 'bg-red-100 text-red-600'
                  : (guideRemaining ?? 999) <= 1
                    ? 'bg-orange-100 text-orange-600'
                    : 'bg-gray-100 text-gray-500'
              }`}>
                이번 달 {guideUsed}/{guideLimit >= 999 ? '∞' : guideLimit}회 사용
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={generateGuide}
              disabled={loading || !latestScanId || guideExhausted}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '생성 중...' : guideExhausted ? '이번 달 한도 초과' : guide ? '가이드 재생성' : '가이드 생성하기'}
            </button>
            {guideExhausted && (
              <a href="/pricing" className="text-sm text-blue-500 hover:underline">
                플랜 업그레이드 →
              </a>
            )}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {loading && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600 mb-1">AI가 내 가게 맞춤 전략을 작성 중입니다... ({elapsedSeconds}초)</p>
            <p className="text-gray-400 text-sm">
              {elapsedSeconds < 10 ? '보통 10~25초 소요됩니다' :
               elapsedSeconds < 20 ? '거의 다 됐습니다...' :
               '조금만 더 기다려주세요...'}
            </p>
          </div>
        )}

        {guide && !loading && (
          <>
            {/* AI 브리핑 현황 배너 */}
            {tools.briefing_summary && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-start gap-3">
                <Star className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-base text-amber-800 leading-relaxed">{tools.briefing_summary}</p>
              </div>
            )}

            {/* 성장 단계 */}
            {gapLoading && !growthStage ? (
              <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ) : growthStage ? (
              <GrowthStageCard stage={growthStage} />
            ) : null}

            {/* AI 브리핑 직접 관리 경로 (Pro+) */}
            {briefingPaths.length > 0 && (
              <PlanGate requiredPlan="pro" currentPlan={currentPlan} feature="AI 브리핑 직접 관리 4경로">
                <BriefingPathsSection
                  paths={briefingPaths}
                  naverSearchUrl={business.region && business.category
                    ? `https://search.naver.com/search.naver?query=${encodeURIComponent(`${business.region} ${CATEGORY_KO[business.category] ?? business.category} 추천`)}`
                    : `https://search.naver.com/search.naver?query=${encodeURIComponent(business.name)}`
                  }
                />
              </PlanGate>
            )}

            {/* 진행률 */}
            {(guide.items_json ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-700">완료 체크리스트</div>
                    <div className="text-base text-gray-400">체크 항목은 이 기기에 저장됩니다</div>
                  </div>
                  <div className="text-base text-gray-500">
                    {checked.size} / {guide.items_json.length} 완료
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(checked.size / guide.items_json.length) * 100}%` }}
                  />
                </div>
                {checked.size === guide.items_json.length && checked.size > 0 && (
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <p className="text-sm text-green-600 font-medium">모든 항목을 완료했습니다!</p>
                    {!scanRequested ? (
                      <button
                        onClick={async () => {
                          setScanRequested(true)
                          try {
                            await fetch(`${BACKEND}/api/scan/full`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                              body: JSON.stringify({ business_id: business.id }),
                            })
                          } catch {}
                          router.push('/dashboard?rescan=1')
                        }}
                        className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        개선 확인 스캔 시작
                      </button>
                    ) : (
                      <span className="text-base text-blue-500">스캔 시작됨 — 대시보드에서 확인하세요</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 요약 */}
            <div className="bg-blue-50 rounded-2xl p-5">
              <div className="text-sm font-medium text-blue-900 mb-2">현황 요약</div>
              <p className="text-blue-800 text-sm leading-relaxed">{guide.summary}</p>
              {guide.next_month_goal && (
                <p className="text-sm text-blue-600 mt-2 font-medium">목표: {guide.next_month_goal}</p>
              )}
            </div>

            {/* 우선순위 액션 */}
            {guide.priority_json?.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-700 mb-3">지금 당장 할 수 있는 것</div>
                <ul className="space-y-2">
                  {guide.priority_json.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-blue-500 shrink-0">{i + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 개선 항목 */}
            <div className="space-y-4">
              {(guide.items_json ?? []).map((item) => (
                <div
                  key={item.rank}
                  className={`bg-white rounded-2xl p-5 shadow-sm transition-opacity ${checked.has(item.rank) ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCheck(item.rank)}
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 border-2 transition-colors ${
                          checked.has(item.rank)
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'bg-blue-100 border-blue-200 text-blue-600'
                        }`}
                        title={checked.has(item.rank) ? '완료 취소' : '완료 표시'}
                      >
                        {checked.has(item.rank) ? '✓' : item.rank}
                      </button>
                      <div>
                        <span className="text-base text-gray-400">{item.dimension ?? item.category}</span>
                        <div className={`font-semibold ${checked.has(item.rank) ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {item.title}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.time_required && (
                        <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {item.time_required}
                        </span>
                      )}
                      <span className={`text-sm px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[item.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty}
                      </span>
                    </div>
                  </div>
                  <p className="text-base text-gray-700 leading-relaxed mb-2">{item.action}</p>
                  {item.competitor_example && (
                    <p className="text-base text-gray-500 mt-2">
                      참고 사례: {item.competitor_example}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* 리뷰 키워드 갭 (Pro+) */}
            {keywordGap && (
              <PlanGate requiredPlan="pro" currentPlan={currentPlan} feature="경쟁사 키워드 갭 분석">
                <KeywordGapCard gap={keywordGap} />
              </PlanGate>
            )}

            {/* 리뷰 답변 초안 (Pro+) */}
            {reviewDrafts.length > 0 && (
              <PlanGate requiredPlan="pro" currentPlan={currentPlan} feature="리뷰 답변 초안 자동 생성">
                <ReviewDraftsSection drafts={reviewDrafts} naverPlaceId={business.naver_place_id} />
              </PlanGate>
            )}

            {/* 주간 소식 초안 (자동 생성) */}
            <WeeklyPostDraftSection businessId={business.id} token={authToken} />

            {/* 즉시 활용 도구 (리뷰 유도 문구, 소식 초안, 키워드) */}
            <QuickToolsSection tools={tools} businessId={business.id} token={authToken} />

            {/* 스마트플레이스 FAQ */}
            {spFaqs.length > 0 && (
              <FAQSection faqs={spFaqs} title="스마트플레이스 Q&A 등록용 FAQ" />
            )}

            {/* AI 검색 최적화 FAQ */}
            {aiFaqs.length > 0 && (
              <FAQSection faqs={aiFaqs} title="AI 검색 최적화 FAQ" />
            )}
          </>
        )}

        {!guide && !loading && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Lightbulb className="w-10 h-10 text-yellow-400 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-700 font-medium mb-2">아직 개선 가이드가 없습니다.</p>
            <p className="text-base text-gray-400 mb-1">
              {latestScanId
                ? "위의 '가이드 생성하기' 버튼을 눌러주세요."
                : '먼저 대시보드에서 AI 스캔을 실행해주세요.'}
            </p>
            {latestScanId && (
              <p className="text-base text-gray-400">AI가 스캔 결과를 분석해 지금 당장 실천할 수 있는 방법을 알려드립니다.</p>
            )}
          </div>
        )}
      </div>
    </PlanGate>
  )
}
