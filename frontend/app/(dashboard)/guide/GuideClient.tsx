'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PlanGate } from '@/components/common/PlanGate'
import { BlogDiagnosisCard } from '@/components/guide/BlogDiagnosisCard'
import {
  Lightbulb, RefreshCw, Copy, Check, ChevronDown, ChevronUp,
  Zap, Star, TrendingUp, MessageSquare, FileText, Hash, HelpCircle,
  Download, CalendarDays, Target, Clock, ExternalLink,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// 기술 용어 → 쉬운 말 치환 (DB에 이미 저장된 텍스트 대응)
function simplify(text: string): string {
  return text
    .replace(/JSON-LD/gi, 'AI 인식 정보 코드')
    .replace(/Schema\.org/gi, '검색 최적화')
    .replace(/LocalBusiness/gi, '사업장 정보')
    .replace(/Open Graph/gi, 'SNS 미리보기 코드')
    .replace(/생존기/g, '시작 단계')
    .replace(/안정기/g, '성장 중')
    .replace(/성장기/g, '빠른 성장')
    .replace(/선도기/g, '지역 1등')
    .replace(/지배기/g, '지역 1등')
    .replace(/키워드\s*커버리지/g, '키워드 충족률')
    .replace(/커버리지/g, '충족률')
    .replace(/AI 브리핑 직접 관리 경로/g, '내가 직접 할 수 있는 것')
    .replace(/선점 기회 키워드/g, '아직 경쟁자가 없는 검색어')
    .replace(/pioneer_keywords/g, '선점 검색어')
    .replace(/coverage_rate/g, '충족률')
    // v3.0 기술 용어 → 소상공인 친화적 표현
    .replace(/Track\s*1\s*점수/gi, '네이버 채널 점수')
    .replace(/Track\s*2\s*점수/gi, '글로벌 AI 채널 점수')
    .replace(/Track\s*1/gi, '네이버 채널')
    .replace(/Track\s*2/gi, '글로벌 AI 채널')
    .replace(/unified_score/g, 'AI 노출 종합 점수')
    .replace(/track1_score/g, '네이버 채널 점수')
    .replace(/track2_score/g, '글로벌 AI 채널 점수')
    .replace(/is_keyword_estimated/g, '')
    .replace(/dual.?track/gi, '통합 AI 분석')
    .replace(/DualTrack/g, '통합 AI 분석')
    .replace(/GrowthStage/g, '성장 단계')
    .replace(/naver_weight/g, '네이버 비중')
    .replace(/global_weight/g, '글로벌 AI 비중')
    // ⚠️ Bug Fix: AI 브리핑 미노출 상태에서 "노출된다" 오해 방지
    // Claude 가이드 텍스트가 현재형으로 "노출된다"고 표현할 수 있으나 실제 미노출 상태일 수 있음
    .replace(/AI\s*브리핑에\s*(노출됩니다|노출된다|노출됨)/g, 'AI 브리핑에 노출될 수 있습니다')
    .replace(/네이버\s*AI\s*브리핑에\s*(노출됩니다|노출된다|노출됨)/g, '네이버 AI 브리핑에 노출될 수 있습니다')
}

// 업종 영문 코드 → 한국어 (네이버 검색 URL 구성용)
const CATEGORY_KO: Record<string, string> = {
  restaurant: '음식점', cafe: '카페', beauty: '미용·뷰티',
  clinic: '병원', hospital: '병원·의원', academy: '학원·교육',
  legal: '법률·행정', fitness: '운동·헬스', pet: '반려동물',
  shopping: '쇼핑몰', photo: '사진·영상', wedding: '웨딩',
  travel: '여행·숙박', auto: '자동차', home: '인테리어·홈',
  kids: '육아·아동', finance: '금융·보험', law: '법률',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '바로 가능', medium: '조금 준비', hard: '전문가 도움',
}
const DIMENSION_LABEL: Record<string, string> = {
  exposure_freq:     'AI 검색 노출',
  review_quality:    '리뷰 키워드',
  info_completeness: '기본 정보',
  schema_score:      '검색 노출 개선',
  content_freshness: '최근 활동',
  online_mentions:   '입소문',
  naver_visibility:  '네이버 노출',
  kakao_visibility:  '카카오 등록',
  website_health:    '홈페이지 상태',
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

const STAGE_INDEX: Record<string, number> = {
  survival: 0, stability: 1, growth: 2, dominance: 3,
}
const STAGE_LABELS = [
  { key: 'survival', label: '시작 단계', emoji: '' },
  { key: 'stability', label: '성장 중', emoji: '' },
  { key: 'growth', label: '빠른 성장', emoji: '' },
  { key: 'dominance', label: '지역 1등', emoji: '' },
]

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3, enterprise: 4,
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

interface WeeklyRoadmapWeek {
  week: number
  title: string
  tasks: string[]
  focus?: string
}

interface ThisWeekMission {
  title: string
  why?: string
  why_urgent?: string
  steps: string[]
  time_required?: string
  estimated_minutes?: number
  deep_link?: string
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
  weekly_roadmap?: WeeklyRoadmapWeek[]
  this_week_mission?: ThisWeekMission
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
  deep_link?: string
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
  business: {
    id: string; name: string; category?: string; region?: string; naver_place_id?: string
    is_smart_place?: boolean; has_faq?: boolean; has_intro?: boolean; has_recent_post?: boolean
    review_count?: number
  }
  guide: Guide | null
  latestScanId: string | null
  userId: string
  currentPlan?: string
  guideUsed?: number
  guideLimit?: number
  category?: string
  region?: string
  latestScanMentioned?: boolean | null
}

// ── 스마트플레이스 현황 업데이트 카드 ─────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

function SmartPlaceStatusCard({
  bizId,
  initial,
  authToken,
  onSaved,
}: {
  bizId: string
  initial: { is_smart_place: boolean; has_faq: boolean; has_intro: boolean; has_recent_post: boolean }
  authToken: string | null
  onSaved: (saved?: { is_smart_place: boolean; has_faq: boolean; has_intro: boolean; has_recent_post: boolean }) => void
}) {
  const [status, setStatus] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const ITEMS = [
    { key: 'is_smart_place' as const, label: '스마트플레이스 등록',  desc: '네이버 스마트플레이스에 사업장이 등록되어 있음' },
    { key: 'has_intro'       as const, label: '소개글 등록',          desc: '기본정보 탭에 소개글이 작성되어 있음' },
    { key: 'has_faq'         as const, label: 'FAQ 등록',             desc: 'Q&A 탭에 자주 묻는 질문이 3개 이상 등록됨' },
    { key: 'has_recent_post' as const, label: '소식 게시물',          desc: '소식 탭에 최근 게시물이 있음' },
  ]

  const toggle = (key: keyof typeof status) => {
    setStatus(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/businesses/${bizId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(status),
      })
      if (res.ok) {
        setSaved(true)
        onSaved(status)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (e) {
      console.error('SmartPlace 저장 실패:', e)
      setSaveError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">스마트플레이스 실제 현황</h3>
          <p className="text-sm text-gray-400 mt-0.5">현재 완료된 항목을 체크하면 가이드가 정확해집니다</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: saved ? '#dcfce7' : '#f0fdf4', color: saved ? '#166534' : '#16a34a' }}
        >
          {saving ? '저장 중...' : saved ? '저장됨' : '저장'}
        </button>
      </div>
      {saveError && <p className="text-sm text-red-500 mt-1">{saveError}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => toggle(item.key)}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors ${
              status[item.key]
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
              status[item.key] ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
            }`}>
              {status[item.key] && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${status[item.key] ? 'text-green-800' : 'text-gray-700'}`}>{item.label}</div>
              <div className="text-sm text-gray-400 leading-tight">{item.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
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

// ── 이번 주 미션 카드 (신규) ─────────────────────────────────────────────────
function ThisWeekMissionCard({
  mission,
  fallbackPriority,
}: {
  mission?: ThisWeekMission | null
  fallbackPriority?: string[]
}) {
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  const data = useMemo(() => {
    if (mission) return mission
    if (fallbackPriority && fallbackPriority.length > 0) {
      return {
        title: fallbackPriority[0],
        why_urgent: '가이드 우선순위 1번 항목입니다.',
        steps: fallbackPriority.slice(0, 3),
        estimated_minutes: 15,
        deep_link: undefined,
      } as ThisWeekMission
    }
    return null
  }, [mission, fallbackPriority])

  if (!data) return null

  const toggleStep = (idx: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 md:p-6 border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-blue-600" />
        <span className="text-base font-bold text-blue-900">이번 주 미션</span>
      </div>
      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-1">{simplify(data.title)}</h3>
      <p className="text-sm text-gray-500 mb-4">{simplify(data.why_urgent || data.why || '')}</p>

      <div className="space-y-2 mb-4">
        {data.steps.map((step, i) => (
          <button
            key={i}
            onClick={() => toggleStep(i)}
            className="flex items-start gap-3 w-full text-left group"
          >
            <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
              checkedSteps.has(i)
                ? 'bg-blue-600 border-blue-600'
                : 'bg-white border-gray-300 group-hover:border-blue-400'
            }`}>
              {checkedSteps.has(i) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            <span className={`text-base leading-relaxed ${
              checkedSteps.has(i) ? 'text-gray-400 line-through' : 'text-gray-700'
            }`}>
              {i + 1}단계: {simplify(step)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>예상 {data.time_required || (data.estimated_minutes ? `${data.estimated_minutes}분` : '15분')}</span>
        </div>
        {data.deep_link && (
          <a
            href={data.deep_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            바로 실행
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── 완료 체크리스트 진행률 (독립 컴포넌트로 분리) ──────────────────────────────
function ChecklistProgress({
  total,
  checked,
  onRescan,
  scanRequested,
}: {
  total: number
  checked: number
  onRescan: () => void
  scanRequested: boolean
}) {
  if (total === 0) return null
  const pct = Math.round((checked / total) * 100)

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-gray-700">완료 체크리스트</div>
          <div className="text-sm text-gray-400">체크 항목은 이 기기에 저장됩니다</div>
        </div>
        <div className="text-sm font-semibold text-gray-600">
          {checked} / {total} 완료 ({pct}%)
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className="bg-green-500 h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {checked === total && checked > 0 && (
        <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <p className="text-sm text-green-600 font-medium">모든 항목을 완료했습니다!</p>
          {!scanRequested ? (
            <button
              onClick={onRescan}
              className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              개선 확인 스캔 시작
            </button>
          ) : (
            <span className="text-sm text-blue-500">스캔 시작됨 -- 대시보드에서 확인하세요</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── 성장 단계 타임라인 시각화 (개선) ─────────────────────────────────────────
function GrowthStageCard({ stage }: { stage: GrowthStage }) {
  const colorClass = STAGE_COLOR[stage.stage] ?? 'bg-gray-50 border-gray-200 text-gray-800'
  const currentIdx = STAGE_INDEX[stage.stage] ?? 0

  return (
    <div className={`rounded-2xl border p-4 md:p-5 ${colorClass}`}>
      {/* 4단계 프로그레스 타임라인 */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-1 mb-2">
          {STAGE_LABELS.map((s, i) => {
            const isActive = i === currentIdx
            const isPast = i < currentIdx
            return (
              <div key={s.key} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  isActive
                    ? 'bg-white border-current scale-110 shadow-md'
                    : isPast
                      ? 'bg-white/60 border-current opacity-70'
                      : 'bg-white/30 border-current/30 opacity-40'
                }`}>
                  {isActive ? s.emoji || '>' : isPast ? <Check className="w-3.5 h-3.5" /> : (i + 1)}
                </div>
                <span className={`text-sm mt-1 font-medium ${isActive ? 'font-bold' : 'opacity-60'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
        {/* 연결선 */}
        <div className="flex items-center px-6 -mt-8 mb-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`flex-1 h-0.5 ${i < currentIdx ? 'bg-current opacity-50' : 'bg-current/20'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <span className="text-base font-semibold">현재 단계: {simplify(stage.stage_label)}</span>
        </div>
        <span className="text-sm opacity-70">{stage.score_range}</span>
      </div>
      <p className="text-base mb-3 leading-relaxed">{simplify(stage.focus_message)}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-white bg-opacity-60 rounded-xl p-3">
          <div className="text-sm font-semibold mb-1">이번 주 집중할 것</div>
          <p className="text-base leading-relaxed">{simplify(stage.this_week_action)}</p>
        </div>
        <div className="bg-white bg-opacity-40 rounded-xl p-3">
          <div className="text-sm font-semibold mb-1 opacity-70">지금 하지 말아야 할 것</div>
          <p className="text-base leading-relaxed opacity-80">{simplify(stage.do_not_do)}</p>
        </div>
      </div>
      {stage.estimated_weeks_to_next && (
        <p className="text-sm opacity-60 mt-2">다음 단계까지 약 {stage.estimated_weeks_to_next}주 예상</p>
      )}
    </div>
  )
}

// ── 주간 로드맵 (4주 타임라인) ──────────────────────────────────────────────
function WeeklyRoadmapSection({ roadmap, guideGeneratedAt }: { roadmap: WeeklyRoadmapWeek[]; guideGeneratedAt: string }) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  // 현재 주차 계산 (가이드 생성일 기준)
  const currentWeek = useMemo(() => {
    const generated = new Date(guideGeneratedAt)
    const now = new Date()
    const diffMs = now.getTime() - generated.getTime()
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
    return Math.min(Math.max(diffWeeks + 1, 1), roadmap.length)
  }, [guideGeneratedAt, roadmap.length])

  if (!roadmap.length) return null

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-gray-900">4주 실행 로드맵</span>
        <span className="text-sm text-gray-400">현재 {currentWeek}주차</span>
      </div>

      {/* PC: 가로 타임라인 */}
      <div className="hidden sm:block mb-4">
        <div className="flex items-start">
          {roadmap.map((week, i) => {
            const isCurrent = (i + 1) === currentWeek
            const isPast = (i + 1) < currentWeek
            const isLast = i === roadmap.length - 1
            return (
              <div key={week.week} className="flex-1 flex flex-col items-center">
                <div className="flex items-center w-full">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mx-auto transition-all ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-100'
                      : isPast
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isPast ? <Check className="w-4 h-4" /> : week.week}
                  </div>
                </div>
                {!isLast && (
                  <div className={`w-full h-0.5 mt-[-16px] mx-4 ${
                    isPast ? 'bg-indigo-200' : 'bg-gray-200'
                  }`} style={{ position: 'relative', top: '0' }} />
                )}
                <button
                  onClick={() => setExpandedWeek(expandedWeek === i ? null : i)}
                  className={`mt-2 text-center cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors w-full ${
                    isCurrent ? 'font-bold' : ''
                  }`}
                >
                  <div className={`text-sm ${isCurrent ? 'text-indigo-700' : isPast ? 'text-gray-500' : 'text-gray-400'}`}>
                    {week.week}주차
                  </div>
                  <div className={`text-sm mt-0.5 ${isCurrent ? 'text-gray-900' : 'text-gray-600'}`}>
                    {week.title}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 모바일: 세로 타임라인 */}
      <div className="sm:hidden space-y-3 mb-2">
        {roadmap.map((week, i) => {
          const isCurrent = (i + 1) === currentWeek
          const isPast = (i + 1) < currentWeek
          return (
            <button
              key={week.week}
              onClick={() => setExpandedWeek(expandedWeek === i ? null : i)}
              className="flex items-start gap-3 w-full text-left"
            >
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-100'
                    : isPast
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {isPast ? <Check className="w-3.5 h-3.5" /> : week.week}
                </div>
                {i < roadmap.length - 1 && (
                  <div className={`w-0.5 h-6 ${isPast ? 'bg-indigo-200' : 'bg-gray-200'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className={`text-sm font-medium ${isCurrent ? 'text-indigo-700 font-bold' : isPast ? 'text-gray-500' : 'text-gray-400'}`}>
                  {week.week}주차{isCurrent && ' (현재)'}
                </div>
                <div className={`text-base ${isCurrent ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>
                  {week.title}
                </div>
              </div>
              {expandedWeek === i
                ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 mt-1 shrink-0" />}
            </button>
          )
        })}
      </div>

      {/* 펼쳐진 주차 tasks */}
      {expandedWeek !== null && roadmap[expandedWeek] && (
        <div className="bg-gray-50 rounded-xl p-4 mt-2">
          <div className="text-sm font-semibold text-gray-700 mb-2">
            {roadmap[expandedWeek].week}주차: {roadmap[expandedWeek].title}
          </div>
          {roadmap[expandedWeek].focus && (
            <p className="text-sm text-gray-500 mb-2">{roadmap[expandedWeek].focus}</p>
          )}
          <ul className="space-y-1.5">
            {roadmap[expandedWeek].tasks.map((task, ti) => (
              <li key={ti} className="flex items-start gap-2 text-base text-gray-700">
                <span className="text-indigo-400 shrink-0 mt-0.5">-</span>
                {task}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── AI 브리핑 직접 관리 경로 (Basic 부분 해제) ──────────────────────────────
function BriefingPathsSection({
  paths,
  naverSearchUrl,
  currentPlan,
}: {
  paths: BriefingPath[]
  naverSearchUrl?: string
  currentPlan: string
}) {
  const [expanded, setExpanded] = useState<string | null>(paths[0]?.path_id ?? null)
  const isPro = (PLAN_HIERARCHY[currentPlan] ?? 0) >= PLAN_HIERARCHY['pro']

  if (!paths.length) return null

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <div className="text-sm font-semibold text-gray-900">내가 직접 할 수 있는 것 -- 오늘 바로 시작</div>
        </div>
        {naverSearchUrl && (
          <a
            href={naverSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 transition-colors shrink-0 font-medium"
          >
            네이버 AI 브리핑 확인
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <p className="text-base text-gray-500 mb-4">고객 리뷰를 기다리지 않고 사장님이 직접 AI 신호를 강화하는 방법입니다.</p>
      <div className="space-y-2">
        {paths.map((path, pathIdx) => {
          const isOpen = expanded === path.path_id
          // Basic: 3개 경로(FAQ/리뷰답변/소식)까지 노출, 4번째(소개글 수정)부터 Pro 잠금
          const isReadyTextLocked = !isPro && pathIdx >= 3

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
                  <div className="text-sm text-gray-500">{path.time_required} · {path.effect}</div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
                  <div className="text-base text-gray-700 leading-relaxed">
                    <span className="font-medium text-gray-900">방법: </span>{path.what_to_do}
                  </div>
                  {path.ready_text && (
                    <div className="relative">
                      <div className={`bg-blue-50 rounded-lg p-3 ${isReadyTextLocked ? 'blur-sm select-none' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">바로 붙여넣기 가능한 문구</span>
                          {!isReadyTextLocked && <CopyButton text={path.ready_text} label="문구 복사" />}
                        </div>
                        <p className="text-base text-blue-800 leading-relaxed whitespace-pre-wrap">{path.ready_text}</p>
                      </div>
                      {isReadyTextLocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
                          <div className="text-center px-4">
                            <p className="text-sm font-semibold text-gray-700">Pro 플랜에서 전체 복사 문구를 확인하세요</p>
                            <a href="/pricing" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                              업그레이드하기 →
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {path.platform_url && (
                    <a
                      href={path.platform_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      바로 가기
                      <ExternalLink className="w-3 h-3" />
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

// ── 키워드 갭 카드 (Basic 부분 해제) ─────────────────────────────────────────
function KeywordGapCard({
  gap,
  bizId,
  volumes = {},
  volLoading = false,
  currentPlan,
}: {
  gap: ReviewKeywordGap
  bizId: string
  volumes?: Record<string, { monthly_total: number }>
  volLoading?: boolean
  currentPlan: string
}) {
  const isPro = (PLAN_HIERARCHY[currentPlan] ?? 0) >= PLAN_HIERARCHY['pro']
  const STORAGE_KEY = `excluded_pioneer_${bizId}`
  const [excludedPioneer, setExcludedPioneer] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setExcludedPioneer(JSON.parse(stored) as string[])
    } catch {}
  }, [STORAGE_KEY])

  const handleExcludePioneer = (kw: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = [...excludedPioneer, kw]
    setExcludedPioneer(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  const visiblePioneer = (gap.pioneer_keywords ?? []).filter(
    (kw) => !excludedPioneer.includes(kw)
  )
  // 검색량 기준으로 missing_keywords 정렬 (검색량 있는 것 상위)
  const sortedMissing = [...gap.missing_keywords].sort((a, b) => {
    const va = volumes[a]?.monthly_total ?? 0
    const vb = volumes[b]?.monthly_total ?? 0
    return vb - va
  })

  // Basic: missing_keywords 3개만 노출, 나머지 블러
  const visibleMissing = isPro ? sortedMissing : sortedMissing.slice(0, 3)
  const hiddenMissingCount = isPro ? 0 : Math.max(sortedMissing.length - 3, 0)

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
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
        <span className="text-sm text-gray-500 shrink-0">{Math.round(gap.coverage_rate * 100)}% 충족</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {gap.covered_keywords.length > 0 && (
          <div>
            <div className="text-sm font-medium text-green-700 mb-1.5">보유 키워드</div>
            <div className="flex flex-wrap gap-1">
              {gap.covered_keywords.slice(0, 8).map((kw) => (
                <span key={kw} className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}
        {sortedMissing.length > 0 && (
          <div>
            <div className="text-sm font-medium text-red-700 mb-1.5">부족한 키워드</div>
            <div className="flex flex-wrap gap-1 items-center">
              {volLoading && (
                <span className="text-sm text-gray-300 animate-pulse">검색량 로딩 중...</span>
              )}
              {visibleMissing.map((kw) => {
                const vol = volumes[kw]?.monthly_total
                return (
                  <span key={kw} className="flex items-center gap-1">
                    <span className="text-sm bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{kw}</span>
                    {vol && vol > 0 && (
                      <span className="text-sm bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        월 {vol >= 10000 ? `${Math.round(vol / 1000)}k` : vol.toLocaleString()}건
                      </span>
                    )}
                  </span>
                )
              })}
              {hiddenMissingCount > 0 && (
                <a href="/pricing" className="text-sm text-blue-600 hover:underline ml-1">
                  +{hiddenMissingCount}개 더 (Pro에서 확인)
                </a>
              )}
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

      {visiblePioneer.length > 0 && (
        <div className="mt-3 bg-emerald-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Star className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">아직 경쟁자가 없는 검색어 -- 지금 선점 가능 (클릭하여 복사, X로 제외)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {visiblePioneer.slice(0, 5).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-0.5 text-sm bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"
              >
                <button
                  onClick={() => navigator.clipboard.writeText(kw).catch(() => {})}
                  className="hover:underline"
                  title="클릭하여 복사"
                >
                  {kw}
                </button>
                <button
                  onClick={(e) => handleExcludePioneer(kw, e)}
                  className="ml-1 text-emerald-500 hover:text-red-500 font-bold text-sm leading-none"
                  title={`"${kw}" 제외`}
                  aria-label={`"${kw}" 제외`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <p className="text-sm text-emerald-600 mt-1.5">지금 먼저 선점하면 경쟁 우위를 오래 유지할 수 있습니다.</p>
        </div>
      )}

      {gap.top_priority_keyword && (
        <div className="bg-purple-50 rounded-xl p-3 mt-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-purple-900 mb-0.5">지금 가장 필요한 키워드</div>
            <div className="text-base font-bold text-purple-700">#{gap.top_priority_keyword}</div>
            <p className="text-sm text-purple-600 mt-1">리뷰 답변이나 FAQ에 이 키워드를 포함하세요.</p>
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
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{gap.qr_card_message}</p>
        </div>
      )}
    </div>
  )
}

// ── 리뷰 답변 초안 (Basic 1개 해제) ─────────────────────────────────────────
function ReviewDraftsSection({
  drafts,
  naverPlaceId,
  currentPlan,
}: {
  drafts: ReviewDraft[]
  naverPlaceId?: string
  currentPlan: string
}) {
  const isPro = (PLAN_HIERARCHY[currentPlan] ?? 0) >= PLAN_HIERARCHY['pro']
  const TONE_LABEL: Record<string, string> = {
    grateful: '긍정 리뷰 감사', apologetic: '부정 리뷰 대응', neutral: '일반 리뷰',
  }
  if (!drafts.length) return null

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
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
          스마트플레이스 리뷰 관리
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <p className="text-base text-gray-500 mb-4">복사 후 스마트플레이스에서 붙여넣으세요. 리뷰 답변율은 AI 브리핑 노출 가중치 #1 신호입니다.</p>
      <div className="space-y-3">
        {drafts.map((d, i) => {
          const isLocked = !isPro && i >= 3
          return (
            <div key={i} className="relative">
              <div className={`border border-gray-100 rounded-xl p-3 ${isLocked ? 'blur-sm select-none' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{TONE_LABEL[d.tone] ?? d.tone}</span>
                    {d.rating && (
                      <span className="text-sm text-yellow-500">{'*'.repeat(d.rating)}{'*'.repeat(5 - d.rating)}</span>
                    )}
                  </div>
                  {!isLocked && <CopyButton text={d.draft_response} />}
                </div>
                {d.review_snippet && (
                  <p className="text-sm text-gray-400 italic mb-2 truncate">원본: &quot;{d.review_snippet}&quot;</p>
                )}
                <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{d.draft_response}</p>
              </div>
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                  <div className="text-center px-4">
                    <p className="text-sm font-semibold text-gray-700">Pro 플랜에서 전체 리뷰 답변 초안을 확인하세요</p>
                    <a href="/pricing" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                      업그레이드하기 →
                    </a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-green-600" />
        <span className="text-sm font-semibold text-gray-900">이번 주 소식 초안</span>
        <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full">자동 생성</span>
      </div>
      <div className="bg-green-50 rounded-xl p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base text-gray-700 leading-relaxed flex-1">{draft}</p>
          <CopyButton text={draft} label="복사" />
        </div>
      </div>
      <p className="text-sm text-gray-400 mt-2">
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
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-indigo-500" />
        <div className="text-sm font-semibold text-gray-900">즉시 활용 가능한 도구</div>
      </div>

      {tools.review_request_message && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">QR/영수증용 리뷰 유도 문구</span>
            <CopyButton text={tools.review_request_message} />
          </div>
          <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap">{tools.review_request_message}</p>
        </div>
      )}

      {tools.naver_post_template && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">스마트플레이스 소식 공지 초안</span>
            <CopyButton text={tools.naver_post_template} />
          </div>
          <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap">{tools.naver_post_template}</p>
        </div>
      )}

      {tools.keyword_list && tools.keyword_list.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">리뷰/블로그에 넣어야 할 핵심 키워드</span>
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
              <p className="text-sm text-gray-400 mt-0.5">카운터에 붙이는 인쇄용 A6 카드</p>
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

// ── FAQ 섹션 (기본 열기) ──────────────────────────────────────────────────────
function FAQSection({ faqs, title }: { faqs: FAQ[]; title: string }) {
  const [open, setOpen] = useState(true)
  if (!faqs.length) return null
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <span className="text-sm bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full">{faqs.length}개</span>
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

// ── 개선 항목 카드 (강화: deep_link + 복사 가능 예시 + 왜 필요한가?) ─────────
function GuideItemCard({
  item,
  isChecked,
  alreadyDone,
  onToggle,
}: {
  item: GuideItem
  isChecked: boolean
  alreadyDone: boolean
  onToggle: () => void
}) {
  const [showWhy, setShowWhy] = useState(false)
  const done = isChecked || alreadyDone

  // action 텍스트에서 복사 가능한 예시 추출 (``` 또는 "예시:" 이후 텍스트)
  const extractCopyable = (text: string): { main: string; copyable: string | null } => {
    // ```으로 감싸진 부분
    const codeMatch = text.match(/```([\s\S]*?)```/)
    if (codeMatch) {
      return {
        main: text.replace(/```[\s\S]*?```/, '').trim(),
        copyable: codeMatch[1].trim(),
      }
    }
    // "예시:" 이후 텍스트
    const exMatch = text.match(/예시[:\s]+(.+)$/m)
    if (exMatch) {
      return {
        main: text.replace(/예시[:\s]+.+$/m, '').trim(),
        copyable: exMatch[1].trim(),
      }
    }
    return { main: text, copyable: null }
  }

  const { main: actionMain, copyable } = extractCopyable(item.action)

  return (
    <div className={`bg-white rounded-2xl p-4 md:p-5 shadow-sm transition-opacity ${done ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {alreadyDone && (
            <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">완료됨</span>
          )}
          {!alreadyDone && item.is_quick_win && (
            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">빠른 실행</span>
          )}
          <button
            onClick={onToggle}
            disabled={alreadyDone}
            className={`w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center shrink-0 border-2 transition-colors ${
              done
                ? 'bg-green-500 border-green-500 text-white'
                : 'bg-blue-100 border-blue-200 text-blue-600'
            }`}
            title={alreadyDone ? '스마트플레이스 현황에서 완료 표시됨' : isChecked ? '완료 취소' : '완료 표시'}
          >
            {done ? <Check className="w-3 h-3" /> : item.rank}
          </button>
          <div>
            <span className="text-sm text-gray-400">
              {DIMENSION_LABEL[item.dimension ?? ''] ?? DIMENSION_LABEL[item.category ?? ''] ?? item.dimension ?? item.category}
            </span>
            <div className={`font-semibold ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {simplify(item.title)}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
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

      <p className="text-base text-gray-700 leading-relaxed mb-2">{simplify(actionMain)}</p>

      {/* 복사 가능한 예시 */}
      {copyable && (
        <div className="bg-blue-50 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-blue-700">복사 가능한 예시</span>
            <CopyButton text={copyable} />
          </div>
          <p className="text-base text-blue-800 leading-relaxed whitespace-pre-wrap">{copyable}</p>
        </div>
      )}

      {/* 바로 실행 버튼 */}
      {item.deep_link && !done && (
        <a
          href={item.deep_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors mb-2"
        >
          바로 실행
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* 왜 필요한가? (접이식) */}
      {item.competitor_example && (
        <div className="mt-1">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showWhy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            왜 필요한가?
          </button>
          {showWhy && (
            <div className="mt-2 bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600 leading-relaxed">
                <span className="font-medium text-gray-700">참고 사례: </span>
                {item.competitor_example}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 오늘 당장 할 일 히어로 카드 ──────────────────────────────────────────────
function TodayHeroCard({
  business,
  tools,
  latestScanMentioned,
  naverPlaceId,
}: {
  business: Props['business']
  tools: ToolsJson
  latestScanMentioned?: boolean | null
  naverPlaceId?: string
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const bizName = business.name || '내 가게'
  const isExposed = latestScanMentioned === true
  const faqPath = tools.direct_briefing_paths?.[0]
  // FAQ 경로에서 Q&A 목록 추출 — ready_text를 줄 단위로 파싱
  const faqItems: { q: string; a: string }[] = []
  if (faqPath?.ready_text) {
    const lines = faqPath.ready_text.split('\n')
    let currentQ = ''
    let currentA = ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (/^Q[:\s]/.test(trimmed)) {
        if (currentQ && currentA) faqItems.push({ q: currentQ, a: currentA })
        currentQ = trimmed.replace(/^Q[:\s]+/, '')
        currentA = ''
      } else if (/^A[:\s]/.test(trimmed) || (/^답변[:\s]/.test(trimmed))) {
        currentA = trimmed.replace(/^(A|답변)[:\s]+/, '')
      } else if (currentA && trimmed) {
        currentA += ' ' + trimmed
      }
    }
    if (currentQ && currentA) faqItems.push({ q: currentQ, a: currentA })
  }

  // FAQ 아이템이 없으면 ready_text 전체를 하나로 표시
  const hasFaqItems = faqItems.length > 0
  const smartPlaceUrl = naverPlaceId
    ? `https://smartplace.naver.com/places/${naverPlaceId}/review`
    : 'https://smartplace.naver.com'

  // direct_briefing_paths 없으면 fallback 카드
  if (!tools.direct_briefing_paths || tools.direct_briefing_paths.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5">
        <p className="text-sm font-semibold text-amber-800 mb-1">
          가이드를 생성하면 오늘 할 일이 여기에 나타납니다
        </p>
        <p className="text-sm text-amber-600 mt-1">
          스캔 완료 후 "가이드 생성" 버튼을 눌러주세요
        </p>
        <button
          onClick={() => document.getElementById('guide-generate-btn')?.scrollIntoView({ behavior: 'smooth' })}
          className="mt-2 text-sm text-amber-700 underline"
        >
          가이드 생성하기 →
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border-2 p-4 md:p-5 ${
      isExposed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
    }`}>
      {/* 노출 상태 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{isExposed ? '🟢' : '🔴'}</span>
        <p className={`text-sm font-bold ${isExposed ? 'text-green-800' : 'text-red-800'}`}>
          {isExposed
            ? `네이버 AI 브리핑에 ${bizName}이(가) 노출되고 있습니다`
            : `지금 네이버 AI 브리핑에 ${bizName}이(가) 나오지 않습니다`}
        </p>
      </div>

      {/* 구분선 */}
      <div className={`border-t mb-4 ${isExposed ? 'border-green-200' : 'border-red-200'}`} />

      {/* 오늘 가장 효과적인 행동 */}
      <div className="mb-3">
        <p className="text-base font-bold text-gray-900 mb-1">오늘 가장 효과적인 행동 1가지</p>
        <p className="text-sm text-gray-600">
          스마트플레이스 Q&A 탭에 아래 질문을 등록하세요
          <span className="ml-1 text-gray-400">(AI 브리핑이 가장 직접적으로 인용하는 경로입니다)</span>
        </p>
      </div>

      {/* FAQ 아이템 목록 */}
      {hasFaqItems ? (
        <div className="space-y-2 mb-4">
          {faqItems.slice(0, 2).map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl p-3 border border-gray-100">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-teal-700 flex-1">Q: {item.q}</p>
                <button
                  onClick={() => copyToClipboard(`Q: ${item.q}\nA: ${item.a}`, idx * 2)}
                  className={`shrink-0 text-sm px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    copiedIdx === idx * 2
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copiedIdx === idx * 2 ? '✓ 복사됨' : '복사'}
                </button>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">A: {item.a}</p>
            </div>
          ))}
        </div>
      ) : faqPath?.ready_text ? (
        <div className="bg-white rounded-xl p-3 border border-gray-100 mb-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-blue-700">바로 붙여넣기 가능한 FAQ 문구</span>
            <button
              onClick={() => copyToClipboard(faqPath.ready_text, 0)}
              className={`shrink-0 text-sm px-2.5 py-1 rounded-lg font-medium transition-colors ${
                copiedIdx === 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copiedIdx === 0 ? '✓ 복사됨' : '복사'}
            </button>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{faqPath.ready_text}</p>
        </div>
      ) : null}

      {/* 스마트플레이스 바로가기 */}
      <a
        href={smartPlaceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-white border border-blue-200 hover:border-blue-400 px-4 py-2 rounded-xl transition-colors"
      >
        스마트플레이스 Q&A 탭 바로가기
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      {/* 구분선 + 하단 안내 */}
      <div className={`border-t mt-4 pt-3 ${isExposed ? 'border-green-200' : 'border-red-200'}`}>
        <p className={`text-sm ${isExposed ? 'text-green-700' : 'text-red-700'}`}>
          {isExposed
            ? '지금 노출 중이라도 FAQ를 추가하면 더 많은 키워드에서 인용됩니다 · 5분이면 충분합니다'
            : '등록 후 1~3일 내 AI 브리핑 반영 · 5분이면 충분합니다'}
        </p>
      </div>
    </div>
  )
}

// ── 탭 전환 뷰 (3탭: 오늘 할 일 / 내 현황 / 도구함) ────────────────────────
const TAB_ITEMS = [
  { key: 'today', label: '오늘 할 일' },
  { key: 'status', label: '내 현황' },
  { key: 'tools', label: '도구함' },
] as const

type TabKey = (typeof TAB_ITEMS)[number]['key']

function GuideTabView({
  guide,
  tools,
  itemsJson,
  thisWeekMission,
  briefingPaths,
  reviewDrafts,
  spFaqs,
  aiFaqs,
  weeklyRoadmap,
  growthStage,
  gapLoading,
  keywordGap,
  keywordVolumes,
  volLoading,
  checked,
  scanRequested,
  spStatus,
  spSavedNotice,
  business,
  currentPlan,
  authToken,
  naverSearchUrl,
  guideExhausted,
  loading,
  latestScanMentioned,
  isSpDone,
  toggleCheck,
  handleRescan,
  generateGuide,
  fetchGapData,
  setSpStatus,
  setSpSavedNotice,
}: {
  guide: Guide
  tools: ToolsJson
  itemsJson: GuideItem[]
  thisWeekMission?: ThisWeekMission | null
  briefingPaths: BriefingPath[]
  reviewDrafts: ReviewDraft[]
  spFaqs: FAQ[]
  aiFaqs: FAQ[]
  weeklyRoadmap: WeeklyRoadmapWeek[]
  growthStage: GrowthStage | null
  gapLoading: boolean
  keywordGap: ReviewKeywordGap | null
  keywordVolumes: Record<string, { monthly_total: number }>
  volLoading: boolean
  checked: Set<number>
  scanRequested: boolean
  spStatus: { is_smart_place: boolean; has_faq: boolean; has_intro: boolean; has_recent_post: boolean }
  spSavedNotice: boolean
  business: Props['business']
  currentPlan: string
  authToken: string | null
  naverSearchUrl: string
  guideExhausted: boolean
  loading: boolean
  latestScanMentioned?: boolean | null
  isSpDone: (text: string) => boolean
  toggleCheck: (rank: number) => void
  handleRescan: () => void
  generateGuide: () => void
  fetchGapData: () => void
  setSpStatus: (s: { is_smart_place: boolean; has_faq: boolean; has_intro: boolean; has_recent_post: boolean }) => void
  setSpSavedNotice: (v: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('today')

  return (
    <>
      {/* 탭 바 */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-full w-fit">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 오늘 할 일 ── */}
      {activeTab === 'today' && (
        <div className="space-y-6">
          {/* 히어로 카드: 오늘 당장 할 일 1가지 — 페이지 열자마자 5초 안에 파악 */}
          <TodayHeroCard
            business={business}
            tools={tools}
            latestScanMentioned={latestScanMentioned}
            naverPlaceId={business.naver_place_id}
          />

          <ThisWeekMissionCard
            mission={thisWeekMission}
            fallbackPriority={guide.priority_json}
          />

          <ChecklistProgress
            total={itemsJson.length}
            checked={checked.size}
            onRescan={handleRescan}
            scanRequested={scanRequested}
          />

          {briefingPaths.length > 0 ? (
            <BriefingPathsSection
              paths={briefingPaths}
              naverSearchUrl={naverSearchUrl}
              currentPlan={currentPlan}
            />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-amber-800">
                가이드를 생성하면 오늘 할 일이 여기에 나타납니다
              </p>
              <p className="text-sm text-amber-600 mt-1">
                스캔 완료 후 "가이드 생성" 버튼을 눌러주세요
              </p>
              <button
                onClick={() => document.getElementById('guide-generate-btn')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-2 text-sm text-amber-700 underline"
              >
                가이드 생성하기 →
              </button>
            </div>
          )}

          {reviewDrafts.length > 0 && (
            <>
              <ReviewDraftsSection
                drafts={reviewDrafts}
                naverPlaceId={business.naver_place_id}
                currentPlan={currentPlan}
              />
              {!business.naver_place_id && (
                <p className="text-sm text-gray-400 -mt-4 px-1">
                  💡 사업장 설정에서 네이버 플레이스 ID를 등록하면 리뷰 관리 페이지로 바로 이동합니다
                </p>
              )}
            </>
          )}

          <WeeklyPostDraftSection businessId={business.id} token={authToken} />
        </div>
      )}

      {/* ── 탭 2: 내 현황 ── */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {gapLoading && !growthStage ? (
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ) : growthStage ? (
            <GrowthStageCard stage={growthStage} />
          ) : null}

          {/* ✅ AI 브리핑 실제 노출 상태 배너 — 스캔 결과와 일치하는 명확한 현황 표시 */}
          {latestScanMentioned === false && (
            <div className="bg-orange-50 border border-orange-300 rounded-2xl px-4 md:px-5 py-4 flex items-start gap-3">
              <span className="text-orange-500 text-xl shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-base font-bold text-orange-800 mb-1">현재 네이버 AI 브리핑에 노출되지 않고 있습니다</p>
                <p className="text-sm text-orange-700 leading-relaxed">
                  아래 개선 가이드를 따라 실천하면 AI 브리핑에 노출될 가능성이 높아집니다.
                  가이드 내 "노출됩니다" 표현은 개선 후 기대 효과를 의미합니다.
                </p>
              </div>
            </div>
          )}
          {latestScanMentioned === true && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 md:px-5 py-3 flex items-start gap-3">
              <span className="text-green-500 text-xl shrink-0 mt-0.5">✅</span>
              <div>
                <p className="text-base font-bold text-green-800">현재 네이버 AI 브리핑에 노출 중입니다!</p>
                <p className="text-sm text-green-700 mt-0.5">아래 가이드로 노출 빈도를 더 높일 수 있습니다.</p>
              </div>
            </div>
          )}

          {/* AI 브리핑 직접 관리 요약 배너 */}
          {tools.briefing_summary && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 md:px-5 py-3 flex items-start gap-3">
              <Star className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-base text-amber-800 leading-relaxed">{tools.briefing_summary}</p>
            </div>
          )}

          {/* 현황 요약 */}
          <div className="bg-blue-50 rounded-2xl p-4 md:p-5">
            <div className="text-sm font-medium text-blue-900 mb-2">현황 요약</div>
            <p className="text-blue-800 text-base leading-relaxed">{guide.summary}</p>
            {guide.next_month_goal && (
              <p className="text-sm text-blue-600 mt-2 font-medium">목표: {guide.next_month_goal}</p>
            )}
          </div>

          {keywordGap && (
            <KeywordGapCard
              gap={keywordGap}
              bizId={business.id}
              volumes={keywordVolumes}
              volLoading={volLoading}
              currentPlan={currentPlan}
            />
          )}

          <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="블로그 AI 최적화 진단">
            <BlogDiagnosisCard
              businessId={business.id}
              currentPlan={currentPlan}
            />
          </PlanGate>

          <SmartPlaceStatusCard
            bizId={business.id}
            initial={spStatus}
            authToken={authToken}
            onSaved={(saved) => {
              if (saved) setSpStatus(saved)
              fetchGapData()
              setSpSavedNotice(true)
              setTimeout(() => setSpSavedNotice(false), 5000)
            }}
          />

          {spSavedNotice && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-green-700">현황이 저장됐습니다. 가이드를 재생성하면 완료된 항목이 자동으로 제외됩니다.</p>
              <button
                onClick={generateGuide}
                disabled={loading || guideExhausted}
                className="shrink-0 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                재생성
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 탭 3: 도구함 ── */}
      {activeTab === 'tools' && (
        <div className="space-y-6">
          {itemsJson.length > 0 && (
            <div className="space-y-4">
              {itemsJson.map((item) => (
                <GuideItemCard
                  key={item.rank}
                  item={item}
                  isChecked={checked.has(item.rank)}
                  alreadyDone={isSpDone(item.title)}
                  onToggle={() => toggleCheck(item.rank)}
                />
              ))}
            </div>
          )}

          <QuickToolsSection tools={tools} businessId={business.id} token={authToken} />

          {spFaqs.length > 0 && (
            <FAQSection faqs={spFaqs} title="스마트플레이스 Q&A 등록용 FAQ" />
          )}
          {aiFaqs.length > 0 && (
            <FAQSection faqs={aiFaqs} title="AI 검색 최적화 FAQ" />
          )}

          {weeklyRoadmap.length > 0 && (
            <WeeklyRoadmapSection
              roadmap={weeklyRoadmap}
              guideGeneratedAt={guide.generated_at}
            />
          )}
        </div>
      )}
    </>
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
  category,
  region,
  latestScanMentioned,
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
  const [keywordVolumes, setKeywordVolumes] = useState<Record<string, { monthly_total: number }>>({})
  const [volLoading, setVolLoading] = useState(false)
  const [spStatus, setSpStatus] = useState({
    is_smart_place: !!business.is_smart_place,
    has_faq: !!business.has_faq,
    has_intro: !!business.has_intro,
    has_recent_post: !!business.has_recent_post,
  })
  const [spSavedNotice, setSpSavedNotice] = useState(false)

  // 스마트플레이스 현황 기준으로 이미 완료된 항목 필터링
  // title만 검사 (action 텍스트는 Claude 생성 텍스트라 오매칭 위험)
  const isSpDone = (text: string): boolean => {
    const t = text ?? ''
    if (spStatus.has_intro && /^소개글/.test(t)) return true
    if (spStatus.has_faq && /^(FAQ|Q&A|자주\s*묻는)/.test(t)) return true
    if (spStatus.has_recent_post && /^소식\s*(탭|게시물|업데이트)/.test(t)) return true
    return false
  }

  // Supabase 세션 토큰 확보 (QR 다운로드, 소식 초안 fetch에 필요)
  useEffect(() => {
    const getTokenInit = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) setAuthToken(session.access_token)
      } catch {}
    }
    getTokenInit()
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

  // 항상 최신 Supabase 세션 토큰 반환 (만료 토큰 자동 갱신)
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token ?? null
      if (t) setAuthToken(t)
      return t
    } catch {
      return null
    }
  }, [])

  // 격차 분석 (성장 단계 + 키워드 갭) 로드
  const fetchGapData = useCallback(async () => {
    setGapLoading(true)
    try {
      const gapToken = await getToken()
      const res = await fetch(`${BACKEND}/api/report/gap/${business.id}`, {
        headers: gapToken ? { 'Authorization': `Bearer ${gapToken}` } : {},
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.growth_stage) setGrowthStage(data.growth_stage)
      if (data.keyword_gap) setKeywordGap(data.keyword_gap)
    } catch {}
    finally { setGapLoading(false) }
  }, [business.id, getToken])

  useEffect(() => {
    if (guide) fetchGapData()
  }, [guide?.id, fetchGapData])

  // 키워드 검색량 fetch
  useEffect(() => {
    if (!guide) return
    let cancelled = false
    const fetchVols = async () => {
      setVolLoading(true)
      try {
        const volToken = await getToken()
        const res = await fetch(`${BACKEND}/api/report/keyword-volumes/${business.id}`, {
          headers: volToken ? { Authorization: `Bearer ${volToken}` } : {},
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setKeywordVolumes(data?.volumes ?? data)
        }
      } catch {}
      if (!cancelled) setVolLoading(false)
    }
    fetchVols()
    return () => { cancelled = true }
  }, [guide?.id, business.id, getToken])

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
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
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

    // 항상 getSession()으로 최신 토큰 취득 (캐시된 만료 토큰 방지)
    let token: string | null = null
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token ?? null
      if (token) setAuthToken(token)
    } catch {}
    if (!token) {
      setError('로그인 세션이 만료되었습니다. 페이지를 새로고침 후 다시 시도해주세요.')
      clearInterval(timer)
      setLoading(false)
      return
    }

    try {
      await fetch(`${BACKEND}/api/guide/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ business_id: business.id, scan_id: latestScanId }),
      })
      let guideData = null
      // 최대 14회 x 10초 = 140초 대기 (Sonnet 529 재시도 최대 60초 + 생성 시간 여유)
      for (let attempt = 0; attempt < 14; attempt++) {
        await new Promise((r) => setTimeout(r, 10000))
        try {
          const res = await fetch(`${BACKEND}/api/guide/${business.id}/latest`, {
            headers: { 'Authorization': `Bearer ${token}` },
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
        setError('가이드 생성에 시간이 걸리고 있습니다. 페이지를 새로고침해주세요.')
      }
    } catch {
      setError('가이드 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  const handleRescan = async () => {
    setScanRequested(true)
    try {
      const { createClient: _sc } = await import('@/lib/supabase/client')
      const _sup = _sc()
      const { data: { session: _sess } } = await _sup.auth.getSession()
      const _tk = _sess?.access_token ?? authToken
      await fetch(`${BACKEND}/api/scan/full`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(_tk ? { 'Authorization': `Bearer ${_tk}` } : {}),
        },
        body: JSON.stringify({ business_id: business.id }),
      })
    } catch {}
    router.push('/dashboard?rescan=1')
  }

  const guideRemaining = guideLimit >= 999 ? null : guideLimit - guideUsed
  const guideExhausted = guideLimit > 0 && guideUsed >= guideLimit
  const isFree = guideLimit === 0 || currentPlan === 'free'

  if (isFree) {
    return (
      <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="AI 개선 가이드">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-6 text-center">
          <p className="text-base font-semibold text-amber-800 mb-2">
            AI 개선 가이드는 Basic 플랜부터 이용 가능합니다
          </p>
          <p className="text-sm text-amber-700 mb-4">
            월 9,900원으로 AI 브리핑 개선 가이드, 리뷰 답변 초안, FAQ 자동 생성 기능을 이용하세요.
          </p>
          <a
            href="/pricing"
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            플랜 보기 →
          </a>
        </div>
      </PlanGate>
    )
  }

  const tools: ToolsJson = guide?.tools_json ?? {}
  const briefingPaths: BriefingPath[] = tools.direct_briefing_paths ?? []
  const reviewDrafts: ReviewDraft[] = tools.review_response_drafts ?? []
  const spFaqs: FAQ[] = tools.smart_place_faq_answers ?? []
  const aiFaqs: FAQ[] = tools.faq_list ?? []
  const weeklyRoadmap: WeeklyRoadmapWeek[] = tools.weekly_roadmap ?? []
  const thisWeekMission: ThisWeekMission | undefined = tools.this_week_mission ?? undefined

  const naverSearchUrl = (() => {
    const biz = business as { keywords?: string[]; region?: string; category?: string; name?: string }
    const city = (biz.region ?? '').trim().split(' ')[0].replace(/(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$/, '')
    const kw = (biz as { keywords?: string[] }).keywords?.[0] ?? CATEGORY_KO[biz.category ?? ''] ?? biz.category ?? ''
    const q = city && kw ? `${city} ${kw} 추천` : biz.name ?? ''
    return `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`
  })()

  const itemsJson = guide?.items_json ?? []

  return (
    <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="AI 개선 가이드">
      <div className="space-y-6">

        {/* 상단 액션 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {guide && (
              <p className="text-sm text-gray-400">
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
                이번 달 {guideUsed}/{guideLimit >= 999 ? '무제한' : guideLimit}회 사용
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              id="guide-generate-btn"
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
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600 mb-1">AI가 내 가게 맞춤 전략을 작성 중입니다... ({elapsedSeconds}초)</p>
            <p className="text-gray-400 text-sm">
              {elapsedSeconds < 10 ? '보통 10~25초 소요됩니다' :
               elapsedSeconds < 20 ? '거의 다 됐습니다...' :
               '조금만 더 기다려주세요...'}
            </p>
          </div>
        )}

        {/* ✅ AI 브리핑 노출 상태 — 가이드 위에 항상 표시 (스캔 결과와 일치) */}
        {guide && !loading && latestScanMentioned === false && (
          <div className="bg-orange-50 border border-orange-300 rounded-2xl px-4 md:px-5 py-4 flex items-start gap-3">
            <span className="text-orange-500 text-xl shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-base font-bold text-orange-800 mb-1">현재 네이버 AI 브리핑에 노출되지 않고 있습니다</p>
              <p className="text-sm text-orange-700 leading-relaxed">
                아래 가이드를 따라 실천하면 AI 브리핑에 노출될 가능성이 높아집니다.
                가이드 내 "노출됩니다" 표현은 개선 후 기대 효과입니다.
              </p>
            </div>
          </div>
        )}
        {guide && !loading && latestScanMentioned === true && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 md:px-5 py-3 flex items-start gap-3">
            <span className="text-green-500 text-xl shrink-0 mt-0.5">✅</span>
            <p className="text-base font-semibold text-green-800">현재 네이버 AI 브리핑에 노출 중입니다! 아래 가이드로 빈도를 더 높이세요.</p>
          </div>
        )}

        {guide && !loading && (
          <GuideTabView
            guide={guide}
            tools={tools}
            itemsJson={itemsJson}
            thisWeekMission={thisWeekMission}
            briefingPaths={briefingPaths}
            reviewDrafts={reviewDrafts}
            spFaqs={spFaqs}
            aiFaqs={aiFaqs}
            weeklyRoadmap={weeklyRoadmap}
            growthStage={growthStage}
            gapLoading={gapLoading}
            keywordGap={keywordGap}
            keywordVolumes={keywordVolumes}
            volLoading={volLoading}
            checked={checked}
            scanRequested={scanRequested}
            spStatus={spStatus}
            spSavedNotice={spSavedNotice}
            business={business}
            currentPlan={currentPlan}
            authToken={authToken}
            naverSearchUrl={naverSearchUrl}
            guideExhausted={guideExhausted}
            loading={loading}
            latestScanMentioned={latestScanMentioned}
            isSpDone={isSpDone}
            toggleCheck={toggleCheck}
            handleRescan={handleRescan}
            generateGuide={generateGuide}
            fetchGapData={fetchGapData}
            setSpStatus={setSpStatus}
            setSpSavedNotice={setSpSavedNotice}
          />
        )}

        {!guide && !loading && (
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <Lightbulb className="w-10 h-10 text-yellow-400 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-700 font-medium mb-2">아직 개선 가이드가 없습니다.</p>
            <p className="text-sm text-gray-400 mb-1">
              {latestScanId
                ? "위의 '가이드 생성하기' 버튼을 눌러주세요."
                : '먼저 대시보드에서 AI 스캔을 실행해주세요.'}
            </p>
            {latestScanId && (
              <p className="text-sm text-gray-400">AI가 스캔 결과를 분석해 지금 당장 실천할 수 있는 방법을 알려드립니다.</p>
            )}
          </div>
        )}
      </div>
    </PlanGate>
  )
}
