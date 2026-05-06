'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PlanGate } from '@/components/common/PlanGate'
import {
  Lightbulb, RefreshCw, Copy, Check, ChevronDown, ChevronUp,
  Zap, Star, TrendingUp, MessageSquare, FileText, Hash, HelpCircle,
  Download, CalendarDays, Target, Clock, ExternalLink, Share2,
} from 'lucide-react'
import { ActionTimelineCard } from '@/components/guide/ActionTimelineCard'
import { AICitationHighlight } from '@/components/guide/AICitationHighlight'
import { KeywordCompletenessGauge } from '@/components/guide/KeywordCompletenessGauge'
import { CompetitorKeywordAlert } from '@/components/guide/CompetitorKeywordAlert'
import { getBriefingEligibility, type BriefingEligibility } from '@/lib/userGroup'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// 기술 용어 → 쉬운 말 치환 (DB에 이미 저장된 텍스트 대응)
function simplify(text: string | undefined | null): string {
  if (!text) return ''
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
    .replace(/AI 브리핑 직접 관리 경로/g, 'AI가 내 가게 얘기하게 만드는 방법')
    .replace(/AI 브리핑 직접 관리/g, 'AI가 내 가게 얘기하게 만드는 방법')
    .replace(/선점 기회 키워드/g, '아무도 안 쓰는 기회 키워드')
    .replace(/선점 키워드/g, '아무도 안 쓰는 기회 키워드')
    .replace(/pioneer_keywords/g, '아무도 안 쓰는 기회 키워드')
    .replace(/Pioneer keywords/gi, '아무도 안 쓰는 기회 키워드')
    .replace(/keyword_gap/gi, '내가 놓친 키워드')
    .replace(/briefing_path/gi, 'AI가 내 가게 얘기하게 만드는 방법')
    .replace(/FAQ 템플릿/g, '자주 묻는 질문 답변 예시')
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
    .replace(/"@context"\s*:\s*"https?:\/\/schema\.org"/g, '"@context": "schema.org"')
    .replace(/"@type"\s*:\s*"LocalBusiness"/g, '"@type": "사업장 정보"')
}

// 업종 영문 코드 → 한국어 (네이버 검색 URL 구성용) — v3.5 업종 25개
const CATEGORY_KO: Record<string, string> = {
  restaurant: '음식점', cafe: '카페', bakery: '베이커리·빵집',
  bar: '주점·바', beauty: '미용·뷰티', nail: '네일샵',
  medical: '병원·의원', pharmacy: '약국', fitness: '운동·헬스',
  yoga: '요가·필라테스', pet: '반려동물', education: '교육·학원',
  tutoring: '과외·튜터링', legal: '법률·행정', realestate: '부동산',
  interior: '인테리어', auto: '자동차', cleaning: '청소·세탁',
  shopping: '쇼핑몰', fashion: '패션·의류', photo: '사진·영상',
  video: '영상제작', design: '디자인', accommodation: '숙박·펜션',
  other: '기타',
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '바로 가능', medium: '조금 준비', hard: '전문가 도움',
}
const DIMENSION_LABEL: Record<string, string> = {
  // 매핑된 값
  exposure_freq:     'AI 검색 노출',
  review_quality:    '리뷰 키워드',
  info_completeness: '기본 정보',
  schema_score:      '검색 노출 개선',
  content_freshness: '최근 활동',
  online_mentions:   '입소문',
  naver_visibility:  '네이버 노출',
  kakao_visibility:  '카카오 등록',
  website_health:    '홈페이지 상태',
  // Claude 원문 반환값 대응 (legacy 저장 데이터)
  '리뷰': '리뷰 키워드',
  '리뷰키워드': '리뷰 키워드',
  '스마트플레이스': '기본 정보',
  '키워드': '키워드 최적화',
  'Schema': '검색 노출 개선',
  '콘텐츠': '최근 활동',
  '정보완성도': '기본 정보',
  '채널최적화': '검색 노출 개선',
  'AI노출': 'AI 검색 노출',
  review: '리뷰 키워드',
  keyword: '키워드 최적화',
  content: '최근 활동',
  schema: '검색 노출 개선',
  naver: '네이버 노출',
  kakao: '카카오 등록',
  website: '홈페이지 상태',
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
  { key: 'survival',  label: '생존기 (처음 시작)',     emoji: '' },
  { key: 'stability', label: '안정기 (기본 탄탄)',     emoji: '' },
  { key: 'growth',    label: '성장기 (경쟁력 높음)',   emoji: '' },
  { key: 'dominance', label: '지배기 (업계 최상위)',   emoji: '' },
]

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3,
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

interface ScanSnapshot {
  my_score?: number
  my_freq?: number
  track1_score?: number | null
  track2_score?: number | null
  naver_in_briefing?: boolean
  chatgpt_mentioned?: boolean
  keyword_gap_count?: number
  coverage_rate?: number
  competitor_count?: number
}

interface ToolsJson {
  briefing_summary?: string
  direct_briefing_paths?: BriefingPath[]
  review_request_message?: string
  review_response_drafts?: ReviewDraft[]
  naver_post_template?: string
  naver_map_url?: string
  smart_place_faq_answers?: FAQ[]
  faq_list?: FAQ[]
  keyword_list?: string[]
  smart_place_checklist?: string[]
  seo_checklist?: string[]
  weekly_roadmap?: WeeklyRoadmapWeek[]
  this_week_mission?: ThisWeekMission
  scan_snapshot?: ScanSnapshot
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
    excluded_keywords?: string[]
    is_franchise?: boolean
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
    { key: 'has_faq'         as const, label: '소개글 Q&A 포함',      desc: '소개글에 Q&A 형태 질문이 3개 이상 포함됨 (스마트플레이스 → 업체정보 → 소개글)' },
    { key: 'has_recent_post' as const, label: '소식 게시물',          desc: '소식 탭에 최근 게시물이 있음' },
  ]

  const toggle = (key: keyof typeof status) => {
    setStatus(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    // 새로 체크된 항목 감지 (행동 로그용)
    const ACTION_LOG_MAP: Record<string, { action_type: string; action_label: string }> = {
      has_faq:         { action_type: 'faq_registered',  action_label: '소개글 Q&A 포함' },
      has_intro:       { action_type: 'intro_updated',   action_label: '소개글 등록' },
      has_recent_post: { action_type: 'post_published',  action_label: '소식 게시물 등록' },
    }
    const newlyChecked = (Object.keys(ACTION_LOG_MAP) as (keyof typeof status)[])
      .filter(k => !initial[k] && status[k])
    try {
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}`, {
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
        // 새로 체크된 항목 action_log 저장
        if (authToken && newlyChecked.length > 0) {
          await Promise.allSettled(
            newlyChecked.map(k => {
              const meta = ACTION_LOG_MAP[k as string]
              return fetch(
                `${BACKEND}/api/report/action-log/${bizId}?action_type=${encodeURIComponent(meta.action_type)}&action_label=${encodeURIComponent(meta.action_label)}`,
                { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } },
              )
            })
          )
        }
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

// ── 스캔 수치 스냅샷 카드 (가이드 라이브러리 탭 최상단) ───────────────────────
function ScanSnapshotCard({ snapshot, isInactive = false }: { snapshot: ScanSnapshot; isInactive?: boolean }) {
  const score = snapshot.my_score ?? 0
  const freq = snapshot.my_freq ?? 0
  const naverOk = snapshot.naver_in_briefing ?? false
  const gapCount = snapshot.keyword_gap_count ?? 0
  const coverageRate = snapshot.coverage_rate ?? 0

  const scoreColor = score >= 70 ? 'text-green-700' : score >= 50 ? 'text-yellow-700' : 'text-red-600'
  const scoreBg   = score >= 70 ? 'bg-green-50 border-green-200' : score >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
  const freqColor = freq >= 30 ? 'text-blue-700' : freq >= 10 ? 'text-yellow-700' : 'text-red-600'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5">
      <div className="text-sm font-semibold text-gray-700 mb-3">현재 AI 노출 지표</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* AI 노출 점수 */}
        <div className={`rounded-xl border p-3 ${scoreBg}`}>
          <div className="text-xs text-gray-500 mb-1">AI 노출 종합점수</div>
          <div className={`text-2xl font-bold ${scoreColor}`}>{score.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-0.5">/ 100점</div>
        </div>
        {/* 노출 빈도 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs text-gray-500 mb-1">AI 검색 노출</div>
          <div className={`text-2xl font-bold ${freqColor}`}>{freq}</div>
          <div className="text-xs text-gray-400 mt-0.5">/ 100회 쿼리</div>
        </div>
        {/* 네이버 AI 브리핑 / 비대상 업종은 AI 검색으로 표시 */}
        <div className={`rounded-xl border p-3 ${isInactive ? 'bg-gray-50 border-gray-200' : naverOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-xs text-gray-500 mb-1">
            {isInactive ? "AI 검색 노출" : "네이버 AI 브리핑"}
          </div>
          {isInactive ? (
            <div className="text-sm font-semibold mt-1 text-gray-600">
              비대상 업종
            </div>
          ) : (
            <>
              <div className={`text-base font-bold mt-1 ${naverOk ? 'text-green-700' : 'text-red-600'}`}>
                {naverOk ? '✓ 노출 중' : '✗ 미노출'}
              </div>
              {!naverOk && <div className="text-xs text-red-500 mt-0.5">최우선 해결 과제</div>}
            </>
          )}
        </div>
        {/* 키워드 충족률 */}
        <div className={`rounded-xl border p-3 ${gapCount === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="text-xs text-gray-500 mb-1">키워드 충족률</div>
          <div className={`text-2xl font-bold ${gapCount === 0 ? 'text-green-700' : 'text-amber-700'}`}>
            {coverageRate > 0 ? `${Math.round(coverageRate)}%` : gapCount === 0 ? '100%' : '-'}
          </div>
          {gapCount > 0 && <div className="text-xs text-amber-600 mt-0.5">{gapCount}개 키워드 부족</div>}
        </div>
      </div>
      {/* ChatGPT 노출 여부 (보조 정보) */}
      {snapshot.chatgpt_mentioned !== undefined && (
        <div className="mt-2 flex gap-2 text-xs text-gray-500">
          <span className={snapshot.chatgpt_mentioned ? 'text-green-600' : 'text-gray-400'}>
            ChatGPT {snapshot.chatgpt_mentioned ? '✓ 노출' : '미노출'}
          </span>
          {snapshot.competitor_count !== undefined && snapshot.competitor_count > 0 && (
            <span>· 경쟁사 {snapshot.competitor_count}곳 비교 기반</span>
          )}
        </div>
      )}
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
          <div className="text-sm text-gray-400">체크 항목은 자동 저장됩니다</div>
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

// ── 2주 실행 타임라인 ────────────────────────────────────────────────────────
const WEEK1_TASKS: Record<string, string[]> = {
  '생존기': [
    '{region} {category} 소개글에 {keyword1} 포함하여 스마트플레이스 수정',
    '소개글 하단에 Q&A 3개 추가 (가이드에서 문구 복사)',
    '최근 리뷰 3개에 키워드 포함 답변 달기',
  ],
  '안정기': [
    '소개글 하단에 Q&A 2개 추가 ({keyword1} 포함)',
    '리뷰 10개 이상이면 — 구글 지도·카카오맵 등록 확인',
    '스마트플레이스 소식 1개 업로드 ({keyword1} 포함)',
  ],
  '성장기': [
    '소개글 하단에 Q&A 3개 추가 ({keyword1} 질문 형식)',
    '최근 리뷰 5개 키워드 포함 답변',
    '구글 지도·카카오맵 리뷰 답변 달기',
  ],
  '지배기': [
    '스마트플레이스 소식 주 1회 유지',
    '네이버 지식인 답변 2회 이상 (내 가게 자연 언급)',
    '경쟁사 동향 주 1회 확인',
  ],
}

const WEEK2_TASKS: Record<string, string[]> = {
  '생존기': [
    '리뷰 유도 문구 QR 카드 출력 → 계산대 앞 비치',
    '소식 1개 업로드 ({keyword2} 포함)',
    '카카오맵 등록 완료',
  ],
  '안정기': [
    '리뷰 답변 2개 키워드 포함 재작성',
    '스마트플레이스 사진 5장 교체·추가 (최신 사진)',
    'FAQ 2개 추가 등록',
  ],
  '성장기': [
    '내가 놓친 키워드 2개 FAQ에 추가',
    '네이버 AI 브리핑 노출 확인 (수동 스캔)',
    '경쟁사 리뷰 분석 — 없는 키워드 파악',
  ],
  '지배기': [
    '업종 대표 키워드 선점 유지',
    '신규 경쟁사 모니터링',
    '월 리포트 확인 및 전략 조정',
  ],
}

const STAGE_KEY_MAP: Record<string, string> = {
  survival: '생존기',
  stability: '안정기',
  growth: '성장기',
  dominance: '지배기',
}

function TwoWeekPlanSection({
  growthStage,
  missingKeywords,
  bizId,
  bizName,
  region,
  category,
}: {
  growthStage: GrowthStage
  missingKeywords: string[]
  bizId: string
  bizName: string
  region?: string
  category?: string
}) {
  const stageKey = STAGE_KEY_MAP[growthStage.stage] ?? '생존기'
  const kw1 = missingKeywords[0] ?? '주요 키워드'
  const kw2 = missingKeywords[1] ?? kw1
  const regionStr = region ?? ''
  const categoryStr = category ?? ''

  const interpolate = (text: string) =>
    text
      .replace('{region}', regionStr)
      .replace('{category}', categoryStr)
      .replace('{keyword1}', kw1)
      .replace('{keyword2}', kw2)
      .replace('{bizName}', bizName)

  const week1Tasks = (WEEK1_TASKS[stageKey] ?? WEEK1_TASKS['생존기']).map(interpolate)
  const week2Tasks = (WEEK2_TASKS[stageKey] ?? WEEK2_TASKS['생존기']).map(interpolate)
  const totalTasks = week1Tasks.length + week2Tasks.length

  const STORAGE_KEY_W1 = `aeolab_2week_plan_${bizId}_1`
  const STORAGE_KEY_W2 = `aeolab_2week_plan_${bizId}_2`

  const [checked1, setChecked1] = useState<boolean[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_W1)
      if (stored) return JSON.parse(stored) as boolean[]
    } catch {}
    return new Array(week1Tasks.length).fill(false)
  })
  const [checked2, setChecked2] = useState<boolean[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_W2)
      if (stored) return JSON.parse(stored) as boolean[]
    } catch {}
    return new Array(week2Tasks.length).fill(false)
  })

  const toggleW1 = (idx: number) => {
    setChecked1(prev => {
      const next = [...prev]
      next[idx] = !next[idx]
      try { localStorage.setItem(STORAGE_KEY_W1, JSON.stringify(next)) } catch {}
      return next
    })
  }
  const toggleW2 = (idx: number) => {
    setChecked2(prev => {
      const next = [...prev]
      next[idx] = !next[idx]
      try { localStorage.setItem(STORAGE_KEY_W2, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const doneCount = checked1.filter(Boolean).length + checked2.filter(Boolean).length
  const pct = Math.round((doneCount / totalTasks) * 100)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-indigo-500 shrink-0" />
          <span className="text-base font-bold text-gray-900">2주 실행 플랜</span>
          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[growthStage.stage] ?? 'bg-gray-100 text-gray-700'}`}>
            {simplify(growthStage.stage_label)}
          </span>
        </div>
        <span className="text-sm text-gray-500">완료 {doneCount}/{totalTasks}</span>
      </div>

      {/* 진행률 바 */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-5">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {pct === 100 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-center">
          <p className="text-sm font-semibold text-green-700">2주 플랜 완료! 가이드를 재생성하면 다음 단계 플랜을 받을 수 있습니다.</p>
        </div>
      )}

      {/* 1주차·2주차 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* 1주차 */}
        <div className="bg-indigo-50 rounded-xl p-4">
          <div className="text-sm font-semibold text-indigo-700 mb-3">1주차</div>
          <div className="space-y-2.5">
            {week1Tasks.map((task, idx) => (
              <button
                key={idx}
                onClick={() => toggleW1(idx)}
                className="flex items-start gap-2.5 w-full text-left group"
              >
                <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  checked1[idx]
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'bg-white border-gray-300 group-hover:border-indigo-400'
                }`}>
                  {checked1[idx] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm leading-relaxed ${checked1[idx] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {task}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 2주차 */}
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="text-sm font-semibold text-purple-700 mb-3">2주차</div>
          <div className="space-y-2.5">
            {week2Tasks.map((task, idx) => (
              <button
                key={idx}
                onClick={() => toggleW2(idx)}
                className="flex items-start gap-2.5 w-full text-left group"
              >
                <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  checked2[idx]
                    ? 'bg-purple-600 border-purple-600'
                    : 'bg-white border-gray-300 group-hover:border-purple-400'
                }`}>
                  {checked2[idx] && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm leading-relaxed ${checked2[idx] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {task}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 CTA */}
      <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-500 leading-relaxed">
          이 플랜을 완료하면 스캔 점수 변화를 확인하세요.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          스캔 시작
        </a>
      </div>
    </div>
  )
}

// ── 업종별 소식 콘텐츠 캘린더 ──────────────────────────────────────────────
const CONTENT_CALENDAR: Record<string, { theme: string; ideas: string[] }[]> = {
  restaurant: [
    { theme: '1~2월: 설날·겨울 메뉴', ideas: ['설날 특선 메뉴 소개', '겨울 뜨끈한 국물 요리 후기', '신년 단체 예약 안내'] },
    { theme: '3~4월: 봄·벚꽃 시즌', ideas: ['봄 신메뉴 출시 소식', '꽃구경 후 들리기 좋은 맛집', '봄 나들이 도시락 포장 안내'] },
    { theme: '5~6월: 가정의 달·여름 준비', ideas: ['어버이날 가족 외식 코스', '아이와 함께 오기 좋은 이유', '여름 시원한 메뉴 예고'] },
    { theme: '7~8월: 여름·휴가철', ideas: ['여름 시즌 특선 메뉴', '냉방 완비 단체석 안내', '휴가철 예약 마감 임박 소식'] },
    { theme: '9~10월: 가을·추석', ideas: ['추석 연휴 영업 안내', '가을 제철 재료 신메뉴', '단풍 시즌 데이트 코스'] },
    { theme: '11~12월: 연말·겨울', ideas: ['연말 모임 예약 안내', '연말 특선 세트 메뉴', '연말 감사 이벤트'] },
  ],
  hair: [
    { theme: '1~2월: 새해 변신', ideas: ['새해 헤어스타일 추천 TOP5', '설 명절 전 방문 고객 할인', '겨울 두피 관리 팁'] },
    { theme: '3~4월: 봄 헤어', ideas: ['봄 트렌드 헤어컬러 소개', '입학·입사 헤어스타일 추천', '봄 펌 시술 전후 사진'] },
    { theme: '5~6월: 여름 준비', ideas: ['여름 앞두고 탈색·염색 타이밍', '장마철 헤어 관리법', '가정의 달 엄마 헤어 변신'] },
    { theme: '7~8월: 여름 휴가', ideas: ['휴가 전 헤어 시술 추천', '물놀이 후 손상 헤어 케어', '여름 두피 스케일링 안내'] },
    { theme: '9~10월: 가을 변신', ideas: ['가을 헤어컬러 트렌드', '환절기 두피 관리 팁', '수능 수험생 헤어 추천'] },
    { theme: '11~12월: 연말 변신', ideas: ['연말 파티 헤어스타일', '크리스마스 특별 이벤트', '연말 전 정기 관리 예약'] },
  ],
  default: [
    { theme: '1~2월', ideas: ['신년 이벤트 안내', '겨울 시즌 서비스 소개', '설 연휴 영업 안내'] },
    { theme: '3~4월', ideas: ['봄 맞이 서비스 업데이트', '봄 시즌 이벤트', '신규 고객 할인 안내'] },
    { theme: '5~6월', ideas: ['가정의 달 이벤트', '여름 준비 서비스', '상반기 감사 이벤트'] },
    { theme: '7~8월', ideas: ['여름 성수기 이벤트', '휴가철 예약 안내', '여름 시즌 한정 서비스'] },
    { theme: '9~10월', ideas: ['가을 시즌 새 서비스', '추석 연휴 안내', '가을 이벤트'] },
    { theme: '11~12월', ideas: ['연말 이벤트 안내', '연말 모임 특별 서비스', '새해 예약 오픈'] },
  ],
}

function getCalendarKey(category?: string): keyof typeof CONTENT_CALENDAR {
  if (!category) return 'default'
  const c = category.toLowerCase()
  if (c.includes('restaurant') || c.includes('cafe') || c.includes('음식') || c.includes('카페') || c.includes('식당')) return 'restaurant'
  if (c.includes('hair') || c.includes('nail') || c.includes('beauty') || c.includes('미용') || c.includes('헤어') || c.includes('네일')) return 'hair'
  return 'default'
}

function getMonthBand(month: number): number {
  // 1~2월 → 0, 3~4월 → 1, 5~6월 → 2, 7~8월 → 3, 9~10월 → 4, 11~12월 → 5
  return Math.floor((month - 1) / 2)
}

function ContentCalendarSection({ category }: { category?: string }) {
  const calendarKey = getCalendarKey(category)
  const calendar = CONTENT_CALENDAR[calendarKey] ?? CONTENT_CALENDAR['default']
  const currentMonth = new Date().getMonth() + 1
  const [bandOffset, setBandOffset] = useState(0)
  const bandIdx = Math.min(Math.max(getMonthBand(currentMonth) + bandOffset, 0), calendar.length - 1)
  const current = calendar[bandIdx]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-teal-500 shrink-0" />
          <span className="text-base font-bold text-gray-900">이달의 소식 아이디어</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBandOffset(v => Math.max(v - 1, -getMonthBand(currentMonth)))}
            disabled={bandOffset <= -getMonthBand(currentMonth)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-30 text-sm"
            aria-label="이전 달"
          >
            &lt;
          </button>
          <span className="text-sm text-gray-500 px-1">{current.theme}</span>
          <button
            onClick={() => setBandOffset(v => Math.min(v + 1, calendar.length - 1 - getMonthBand(currentMonth)))}
            disabled={bandOffset >= calendar.length - 1 - getMonthBand(currentMonth)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-30 text-sm"
            aria-label="다음 달"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* 아이디어 목록 */}
      <div className="space-y-2 mb-4">
        {current.ideas.map((idea, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 bg-teal-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-800 leading-relaxed flex-1">{idea}</span>
            <a
              href="https://smartplace.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 text-sm font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              소식으로 올리기
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-sm text-gray-500">
          소식은 주 1회 업로드가 최신성 점수에 가장 효과적입니다.<br />
          <span className="text-teal-600">소식으로 올리기 → 스마트플레이스 관리 화면으로 이동합니다.</span>
        </p>
      </div>
    </div>
  )
}

// ── 내 가게를 위한 블로그 주제 아이디어 (BlogTopicsSection) ─────────────────
// Claude/Gemini가 업종·지역·keyword_gap 기반으로 블로그 글 제목 5개 자동 생성
// 백엔드: POST /api/guide/{biz_id}/blog-topics (Basic+, 1시간 캐시)
function BlogTopicsSection({ bizId, token, plan }: { bizId: string; token: string | null; plan: string }) {
  const [topics, setTopics] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const isBasicPlus = ['basic', 'startup', 'pro', 'biz', 'enterprise'].includes(plan)

  async function load() {
    if (!token) {
      setError('로그인이 필요합니다')
      return
    }
    if (!isBasicPlus) {
      setError('Basic 이상 플랜이 필요합니다')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/guide/${bizId}/blog-topics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail?.message ?? body?.detail ?? '생성 실패')
      }
      const data = await res.json()
      setTopics(data.topics ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setLoading(false)
    }
  }

  function copyTopic(idx: number, text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <FileText className="w-4 h-4 text-purple-500" />
        <div className="text-sm font-semibold text-gray-900">내 가게를 위한 블로그 주제 아이디어</div>
        {!isBasicPlus && <span className="text-sm bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🔒 Basic+</span>}
      </div>
      <p className="text-sm text-gray-500 mb-3 leading-relaxed">
        내 업종·지역·부족한 키워드 기반으로 AI가 블로그 제목 5개를 만들어 드립니다.
        네이버 블로그나 티스토리에 바로 쓸 수 있습니다.
      </p>

      {!topics && !loading && (
        <button
          onClick={load}
          disabled={!isBasicPlus}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
            isBasicPlus
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isBasicPlus ? '블로그 주제 5개 받기' : 'Basic 플랜 업그레이드 필요'}
        </button>
      )}

      {loading && (
        <div className="py-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-500">AI가 주제를 만들고 있어요...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {topics && topics.length > 0 && (
        <div className="space-y-2">
          {topics.map((topic, idx) => {
            const isCopied = copiedIdx === idx
            return (
              <div key={idx} className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-start justify-between gap-2">
                <p className="text-sm text-gray-800 font-medium flex-1 leading-relaxed break-keep">
                  {idx + 1}. {topic}
                </p>
                <button
                  onClick={() => copyTopic(idx, topic)}
                  className={`shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    isCopied ? 'bg-green-100 text-green-700' : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  {isCopied ? '✓ 복사됨' : '복사'}
                </button>
              </div>
            )
          })}
          <p className="text-sm text-gray-400 mt-3">
            💡 이 주제 중 1개를 골라 네이버 블로그에 작성해 보세요. AI 검색에 노출될 확률이 높습니다.
          </p>
        </div>
      )}
    </div>
  )
}

// ── 우리 지역 TOP5 소개글 초안 (ListContentSection) ─────────────────────────
// 등록된 경쟁사 상위 5곳 데이터 기반으로 "OO지역 베스트 5" 리스트형 블로그 초안 생성
function ListContentSection({ bizId, token, region, category, bizName }: {
  bizId: string
  token: string | null
  region?: string
  category?: string
  bizName?: string
}) {
  interface CompetitorItem {
    id: string
    name: string
    region?: string | null
  }
  const [competitors, setCompetitors] = useState<CompetitorItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categoryKo = category ? (CATEGORY_KO[category] ?? category) : '가게'
  const displayRegion = region || '우리 지역'

  async function loadCompetitors() {
    if (!token) {
      setError('로그인이 필요합니다')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/competitors/${bizId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('경쟁사 데이터를 불러오지 못했습니다')
      const data = await res.json()
      const list: CompetitorItem[] = Array.isArray(data) ? data : data.competitors ?? []
      setCompetitors(list.slice(0, 5))
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  // 리스트형 초안 텍스트 생성
  const buildDraft = (): string => {
    const list = competitors ?? []
    const myBiz = bizName || '우리 가게'
    const header = `[${displayRegion} ${categoryKo} 베스트 5] ${displayRegion}에서 ${categoryKo}을(를) 찾고 있다면 꼭 참고해 보세요.`
    const intro = `${displayRegion} 지역에서 많이 찾는 ${categoryKo} 5곳을 직접 비교해 정리했습니다. 각 가게마다 특징이 다르니 상황에 맞게 선택하시면 좋을 것 같습니다.\n`

    const items = [myBiz, ...list.map((c) => c.name)].slice(0, 5)
    const body = items
      .map((name, idx) => `${idx + 1}위. ${name}\n- 특징: [여기에 특징을 써넣으세요 — 예: 분위기 좋음, 주차 가능, 가족 단위 추천]\n- 위치: ${displayRegion}\n- 추천 포인트: [간단한 한 줄 설명]\n`)
      .join('\n')

    const footer = `\n※ 각 가게의 특징은 방문자 후기 및 공개 정보를 참고하여 작성되었습니다. 실제 방문 시 최신 정보를 확인해 주세요.`
    return `${header}\n\n${intro}\n${body}${footer}`
  }

  function copyDraft() {
    navigator.clipboard.writeText(buildDraft()).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <FileText className="w-4 h-4 text-emerald-500" />
        <div className="text-sm font-semibold text-gray-900">우리 지역 TOP5 소개글 초안</div>
        <span className="text-sm bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">리스트형</span>
      </div>
      <p className="text-sm text-gray-500 mb-3 leading-relaxed">
        &ldquo;{displayRegion} {categoryKo} 베스트 5&rdquo; 같은 리스트형 글은 AI가 인용하기 쉬운 구조입니다.
        등록된 경쟁사 데이터를 바탕으로 초안을 만들어 드립니다.
      </p>

      {!competitors && !loading && (
        <button
          onClick={loadCompetitors}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
        >
          경쟁사 데이터 불러와서 초안 만들기
        </button>
      )}

      {loading && (
        <div className="py-6 text-center">
          <div className="inline-block w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-2" />
          <p className="text-sm text-gray-500">경쟁사 데이터 불러오는 중...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {competitors && competitors.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-sm text-amber-700 leading-relaxed">
            등록된 경쟁사가 없습니다. <a href="/competitors" className="underline font-semibold">경쟁사 관리</a> 페이지에서 먼저 등록해 주세요.
          </p>
        </div>
      )}

      {competitors && competitors.length > 0 && (
        <div>
          <div className="bg-emerald-50 rounded-xl p-3 mb-3">
            <p className="text-sm font-semibold text-emerald-800 mb-2">포함될 가게 목록</p>
            <ol className="space-y-1">
              <li className="text-sm text-emerald-900">
                <span className="font-semibold">1.</span> {bizName || '우리 가게'} <span className="text-emerald-600">(내 가게)</span>
              </li>
              {competitors.slice(0, 4).map((c, idx) => (
                <li key={c.id} className="text-sm text-emerald-900">
                  <span className="font-semibold">{idx + 2}.</span> {c.name}
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 mb-3">
            <p className="text-sm font-medium text-gray-700 mb-2">초안 미리보기</p>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans break-keep">
              {buildDraft().slice(0, 300)}...
            </pre>
          </div>
          <button
            onClick={copyDraft}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
              copied ? 'bg-green-100 text-green-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {copied ? '✓ 전체 초안 복사됨' : '전체 초안 복사하기'}
          </button>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">
            💡 복사한 초안의 <strong>[대괄호]</strong> 부분을 채워 넣고 네이버 블로그에 업로드하세요.
            실제 특징·후기를 직접 쓰면 AI가 더 잘 인용합니다.
          </p>
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
          <span className="text-base font-semibold">지금 내 가게 단계: {simplify(stage.stage_label)}</span>
        </div>
        <span className="text-sm opacity-70">{stage.score_range}</span>
      </div>
      <p className="text-sm mb-4 leading-relaxed">{simplify(stage.focus_message)}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white bg-opacity-60 rounded-xl p-4">
          <div className="text-sm font-semibold mb-2">이번 주 집중할 것</div>
          <p className="text-sm leading-relaxed">{simplify(stage.this_week_action)}</p>
        </div>
        <div className="bg-white bg-opacity-40 rounded-xl p-4">
          <div className="text-sm font-semibold mb-2 opacity-70">지금 하지 말아야 할 것</div>
          <p className="text-sm leading-relaxed opacity-80">{simplify(stage.do_not_do)}</p>
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
  isInactive = false,
}: {
  paths: BriefingPath[]
  naverSearchUrl?: string
  currentPlan: string
  isInactive?: boolean
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
            {isInactive ? "AI 검색 노출 확인" : "네이버 AI 브리핑 확인"}
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
                    isReadyTextLocked ? (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                        <p className="text-sm text-gray-500">복사 문구는 Pro 플랜에서 제공됩니다</p>
                        <a href="/pricing" className="mt-2 inline-block text-sm text-blue-600 underline hover:text-blue-800">
                          Pro로 업그레이드 →
                        </a>
                      </div>
                    ) : (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">바로 붙여넣기 가능한 문구</span>
                          <CopyButton text={path.ready_text} label="문구 복사" />
                        </div>
                        <p className="text-base text-blue-800 leading-relaxed whitespace-pre-wrap">{path.ready_text}</p>
                      </div>
                    )
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
  highlightKeyword = null,
  accessToken = '',
  onChange,
}: {
  gap: ReviewKeywordGap
  bizId: string
  volumes?: Record<string, { monthly_total: number }>
  volLoading?: boolean
  currentPlan: string
  highlightKeyword?: string | null
  accessToken?: string
  onChange?: () => void
}) {
  const isPro = (PLAN_HIERARCHY[currentPlan] ?? 0) >= PLAN_HIERARCHY['pro']
  const STORAGE_KEY = `excluded_pioneer_${bizId}`
  const [excludedPioneer, setExcludedPioneer] = useState<string[]>([])
  const [excluding, setExcluding] = useState<Set<string>>(new Set())

  useEffect(() => {
    // DB 우선, 실패 시 localStorage fallback
    let cancelled = false
    const loadFromCache = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored && !cancelled) setExcludedPioneer(JSON.parse(stored) as string[])
      } catch {}
    }
    if (!accessToken) {
      loadFromCache()
      return () => { cancelled = true }
    }
    import('@/lib/api')
      .then(({ getUserKeywords }) => getUserKeywords(bizId, accessToken))
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.excluded)) {
          setExcludedPioneer(data.excluded)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.excluded)) } catch {}
        } else {
          loadFromCache()
        }
      })
      .catch(() => loadFromCache())
    return () => { cancelled = true }
  }, [STORAGE_KEY, bizId, accessToken])

  const handleExcludePioneer = useCallback(async (kw: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (excluding.has(kw)) return
    const prev = excludedPioneer
    const next = [...excludedPioneer, kw]
    setExcludedPioneer(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}

    if (!accessToken) return
    setExcluding((s) => { const n = new Set(s); n.add(kw); return n })
    try {
      const { addExcludedKeyword } = await import('@/lib/api')
      await addExcludedKeyword(bizId, kw, accessToken)
      onChange?.()
    } catch {
      // 롤백
      setExcludedPioneer(prev)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)) } catch {}
    } finally {
      setExcluding((s) => { const n = new Set(s); n.delete(kw); return n })
    }
  }, [accessToken, bizId, excludedPioneer, excluding, STORAGE_KEY, onChange])

  const handleExcludeOther = useCallback(async (kw: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!accessToken) return
    if (excluding.has(kw)) return
    setExcluding((s) => { const n = new Set(s); n.add(kw); return n })
    try {
      const { addExcludedKeyword } = await import('@/lib/api')
      await addExcludedKeyword(bizId, kw, accessToken)
      onChange?.()
    } catch {
      // silent — 사용자가 재시도 가능
    } finally {
      setExcluding((s) => { const n = new Set(s); n.delete(kw); return n })
    }
  }, [accessToken, bizId, excluding, onChange])

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
        <div className="text-sm font-semibold text-gray-900">내가 놓친 키워드 현황</div>
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

      <p className="text-sm text-gray-500 mb-3">
        리뷰·AI 스캔 텍스트 기반 분석입니다. 실제 서비스를 제공해도 리뷰에 해당 키워드가 없으면 '부족'으로 표시될 수 있습니다.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {gap.covered_keywords.length > 0 && (
          <div>
            <div className="text-sm font-medium text-green-700 mb-1.5">보유 키워드</div>
            <div className="flex flex-wrap gap-1">
              {gap.covered_keywords.slice(0, 8).map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full"
                >
                  {kw}
                  {accessToken && (
                    <button
                      type="button"
                      onClick={(e) => handleExcludeOther(kw, e)}
                      disabled={excluding.has(kw)}
                      className="text-green-400 hover:text-red-600 font-bold leading-none disabled:opacity-40"
                      title={`"${kw}" 분석에서 제외`}
                      aria-label={`"${kw}" 분석에서 제외`}
                    >
                      ×
                    </button>
                  )}
                </span>
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
                    <span
                      className={`inline-flex items-center gap-1 text-sm bg-red-50 text-red-600 px-2 py-0.5 rounded-full${highlightKeyword === kw ? ' ring-2 ring-amber-400 ring-offset-1' : ''}`}
                    >
                      {kw}
                      {accessToken && (
                        <button
                          type="button"
                          onClick={(e) => handleExcludeOther(kw, e)}
                          disabled={excluding.has(kw)}
                          className="text-red-400 hover:text-red-700 font-bold leading-none disabled:opacity-40"
                          title={`"${kw}" 분석에서 제외`}
                          aria-label={`"${kw}" 분석에서 제외`}
                        >
                          ×
                        </button>
                      )}
                    </span>
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
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 text-sm bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full"
                >
                  {kw}
                  {accessToken && (
                    <button
                      type="button"
                      onClick={(e) => handleExcludeOther(kw, e)}
                      disabled={excluding.has(kw)}
                      className="text-orange-400 hover:text-red-600 font-bold leading-none disabled:opacity-40"
                      title={`"${kw}" 분석에서 제외`}
                      aria-label={`"${kw}" 분석에서 제외`}
                    >
                      ×
                    </button>
                  )}
                </span>
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
          {(!gap.competitor_only_keywords?.length) && (
            <p className="text-sm text-gray-500 mt-1">
              * 경쟁사 스캔 데이터 부족으로 비교 정확도가 낮을 수 있습니다. 스캔 후 재확인하세요.
            </p>
          )}
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
  const [expandedIdx, setExpandedIdx] = useState<number>(0) // 첫 번째 기본 펼침
  const TONE_LABEL: Record<string, string> = {
    grateful: '긍정 리뷰 감사', apologetic: '부정 리뷰 대응', neutral: '일반 리뷰',
  }
  const TONE_STYLE: Record<string, string> = {
    grateful: 'bg-green-100 text-green-700',
    apologetic: 'bg-red-100 text-red-700',
    neutral: 'bg-gray-100 text-gray-600',
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
      <p className="text-sm text-gray-500 mb-2">업종 키워드 기반으로 미리 생성된 답변 초안입니다. 실제 리뷰에 맞게 내용을 수정한 뒤 복사해 사용하세요.</p>
      <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">특정 리뷰에 맞춘 AI 답변은 <a href="/review-inbox" className="underline font-medium">리뷰 답변 관리</a> 메뉴에서 생성할 수 있습니다.</p>
      <div className="space-y-2">
        {drafts.map((d, i) => {
          const isLocked = !isPro && i >= 5
          const isExpanded = expandedIdx === i
          return (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              {/* 헤더 버튼 (항상 표시) */}
              <button
                onClick={() => !isLocked && setExpandedIdx(isExpanded ? -1 : i)}
                className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                  isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'
                } ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TONE_STYLE[d.tone] ?? 'bg-blue-50 text-blue-600'}`}>
                    {TONE_LABEL[d.tone] ?? d.tone}
                  </span>
                  {d.rating && (
                    <span className="text-xs text-amber-500">
                      {'★'.repeat(d.rating ?? 0)}{'☆'.repeat(5 - (d.rating ?? 0))}
                    </span>
                  )}
                  {!isExpanded && !isLocked && (
                    <span className="text-xs text-gray-400 truncate max-w-[180px] sm:max-w-[280px]">
                      {d.draft_response.slice(0, 40)}...
                    </span>
                  )}
                </div>
                {isLocked ? (
                  <span className="text-xs text-gray-400 shrink-0">Pro</span>
                ) : (
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* 펼쳐진 내용 — grid animation */}
              <div className={`grid transition-all duration-200 ease-in-out ${isExpanded && !isLocked ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                    {d.review_snippet && (
                      <p className="text-sm text-gray-400 italic mb-2">원본: &quot;{d.review_snippet}&quot;</p>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">{d.draft_response}</p>
                    <CopyButton text={d.draft_response} />
                  </div>
                </div>
              </div>

              {/* Pro 잠금 안내 */}
              {isLocked && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-sm font-medium text-gray-600 mb-0.5">Pro 플랜에서 전체 초안 확인</p>
                  <a href="/pricing" className="text-sm text-blue-600 hover:underline">업그레이드 →</a>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── 커뮤니티 글 초안 섹션 ────────────────────────────────────────────────────
interface CommunityDraft {
  channel: string
  label: string
  text: string
}

function CommunityDraftsSection({ paths }: { paths: BriefingPath[] }) {
  const communityPath = paths.find((p) => p.path_id === 'community')
  const [openChannel, setOpenChannel] = useState<string | null>(null)
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null)

  if (!communityPath) return null

  // ready_text에서 채널별 초안 파싱
  // 형식: "## 채널명\n내용\n\n## 채널명\n내용" 또는 줄바꿈 구분
  const parseDrafts = (text: string): CommunityDraft[] => {
    const sectionPattern = /##\s*(.+?)\n([\s\S]*?)(?=##|$)/g
    const sections: CommunityDraft[] = []
    let match
    while ((match = sectionPattern.exec(text)) !== null) {
      const channel = match[1].trim()
      const content = match[2].trim()
      if (channel && content) {
        sections.push({ channel, label: '바로 붙여넣기 가능', text: content })
      }
    }
    if (sections.length > 0) return sections

    // fallback: 기본 3개 채널 목록 생성
    return [
      { channel: '네이버 카페 (지역 맘카페)', label: '후기 게시판', text: text },
      { channel: '네이버 지식인', label: '질문 답변', text: text },
      { channel: '인스타그램', label: '위치 태그 게시물', text: text },
    ]
  }

  // ready_text가 있으면 파싱, 없으면 what_to_do로 단일 초안 생성
  const rawText = communityPath.ready_text || communityPath.what_to_do || ''
  const drafts = parseDrafts(rawText)

  const copyDraft = (channel: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedChannel(channel)
    setTimeout(() => setCopiedChannel(null), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">💬</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900">커뮤니티 언급 초안</h3>
          <p className="text-sm text-gray-500">맘카페·지식인·지역카페 언급이 ChatGPT 신뢰도를 높입니다</p>
        </div>
        <span className="ml-auto text-sm bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full shrink-0">이번 주</span>
      </div>

      {/* 투명성 안내 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
        <span className="text-amber-500 text-lg shrink-0 mt-0.5">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800 mb-0.5">사업주 신분을 반드시 밝혀주세요</p>
          <p className="text-sm text-amber-700 leading-relaxed">
            아래 초안은 <strong>사업주가 직접 가게를 소개하는 글</strong>로 작성되어 있습니다.
            고객인 척 후기를 올리는 것은 <strong>네이버 정책 위반 및 공정위 기만광고 규정에 해당</strong>할 수 있습니다.
            반드시 사업주임을 밝히고 게시해 주세요.
          </p>
        </div>
      </div>

      {/* 채널별 아코디언 */}
      <div className="space-y-2">
        {drafts.map((draft) => {
          const isOpen = openChannel === draft.channel
          const isCopied = copiedChannel === draft.channel
          return (
            <div key={draft.channel} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenChannel(isOpen ? null : draft.channel)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-800">{draft.channel}</span>
                  <span className="text-sm text-gray-400 ml-2">{draft.label}</span>
                </div>
                <span className="text-gray-400 text-sm shrink-0 ml-2">
                  {isOpen ? '접기 ▴' : '펼치기 ▾'}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 border-t border-gray-50">
                  <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-keep">
                    {draft.text}
                  </div>
                  <button
                    onClick={() => copyDraft(draft.channel, draft.text)}
                    className={`mt-2 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      isCopied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCopied ? '✓ 복사됨' : '복사하기'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 네이버 지도 링크 복사 박스 ─────────────────────────────────────────────────
function MapLinkBox({
  bizName,
  bizRegion,
  naverMapUrl,
}: {
  bizName?: string
  bizRegion?: string
  naverMapUrl?: string
}) {
  const [copied, setCopied] = useState(false)

  const url = naverMapUrl
    || `https://map.naver.com/v5/search/${encodeURIComponent(((bizRegion || '') + ' ' + (bizName || '')).trim())}`

  const copy = () => {
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">📍</span>
        <p className="text-sm font-bold text-blue-800">내 네이버 지도 링크</p>
      </div>
      <p className="text-sm text-gray-600 mb-3 break-keep leading-relaxed">
        이 링크를 인스타그램 프로필·스토리·카카오채널에 넣으면 찜·저장·길찾기 클릭이 늘어납니다
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 text-sm bg-white border border-blue-200 rounded-lg px-3 py-2 text-gray-700 min-w-0"
        />
        <button
          onClick={copy}
          className={`text-sm px-3 py-2 rounded-lg font-semibold shrink-0 transition-colors ${
            copied
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <p className="text-sm text-gray-400 mt-2">
        💡 인스타 프로필 링크, 카카오채널 홈, SNS 소개란에 꼭 넣어두세요
      </p>
    </div>
  )
}

// ── 상호명 통일 확인 박스 ─────────────────────────────────────────────────────
function BrandNameCheckBox({ bizName, bizRegion }: { bizName?: string; bizRegion?: string }) {
  const name = bizName || ''
  const region = bizRegion || ''
  const links = [
    {
      label: '카카오맵 확인',
      url: `https://map.kakao.com/link/search/${encodeURIComponent(name)}`,
    },
    {
      label: '구글맵 확인',
      url: `https://www.google.com/maps/search/${encodeURIComponent((region + ' ' + name).trim())}`,
    },
    {
      label: '인스타 확인',
      url: `https://www.instagram.com/explore/search/?q=${encodeURIComponent(name)}`,
    },
  ]

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
      <p className="text-sm font-bold text-amber-800 mb-1">⚠️ 상호명 통일 확인 필수</p>
      <p className="text-sm text-gray-600 mb-2 break-keep leading-relaxed">
        아래 플랫폼에서{' '}
        <strong className="text-gray-800">{name || '내 가게 이름'}</strong>{' '}
        이름으로 검색해서 동일하게 등록됐는지 확인하세요.
        이름이 다르면 ChatGPT가 다른 가게로 인식합니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-white border border-amber-200 text-amber-700 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
          >
            {link.label} →
          </a>
        ))}
      </div>
    </div>
  )
}

// ── 외부 플랫폼 체크리스트 ────────────────────────────────────────────────────
const PLATFORM_LIST = [
  { key: 'naver_smartplace', label: '네이버 스마트플레이스', hint: '기본 등록 · AI 브리핑 직접 연결', icon: 'N', required: true,  link: 'https://smartplace.naver.com', linkLabel: '등록 방법' },
  { key: 'kakao_map',        label: '카카오맵',             hint: '카카오맵 사장님 서비스 등록',   icon: 'K', required: false, link: 'https://biz.kakao.com',         linkLabel: '등록 방법' },
  { key: 'google_map',       label: '구글 지도',            hint: 'Google Business Profile 등록', icon: 'G', required: false, link: 'https://business.google.com',   linkLabel: '등록 방법' },
  { key: 'instagram',        label: '인스타그램',           hint: '업체 계정 운영',               icon: 'I', required: false, link: 'https://www.instagram.com',     linkLabel: '시작하기' },
  { key: 'youtube',          label: '유튜브',               hint: '짧은 영상 1개라도 업로드',     icon: 'Y', required: false, link: 'https://www.youtube.com',       linkLabel: '시작하기' },
]

function ExternalPlatformChecklist({
  bizId,
  bizName,
  bizRegion,
  naverMapUrl,
}: {
  bizId: string
  bizName?: string
  bizRegion?: string
  naverMapUrl?: string
}) {
  const LS_KEY = `aeolab_platform_check_${bizId}`
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setChecked(JSON.parse(saved))
    } catch {}
  }, [LS_KEY])

  const toggle = (key: string) => {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
  }

  const checkedCount = PLATFORM_LIST.filter(p => checked[p.key]).length

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
      {/* 섹션 C: 네이버 지도 링크 복사 */}
      <MapLinkBox bizName={bizName} bizRegion={bizRegion} naverMapUrl={naverMapUrl} />

      {/* 섹션 D: 상호명 통일 확인 */}
      <BrandNameCheckBox bizName={bizName} bizRegion={bizRegion} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base">🌐</span>
            <span className="text-base font-bold text-gray-900">외부 플랫폼 등록 현황</span>
          </div>
          <p className="text-sm text-gray-500">더 많은 플랫폼에 등록할수록 ChatGPT·Google AI 노출 확률이 올라갑니다.</p>
        </div>
        <div className="shrink-0 text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full whitespace-nowrap">
          {checkedCount} / {PLATFORM_LIST.length} 플랫폼 등록됨
        </div>
      </div>
      <div className="space-y-2">
        {PLATFORM_LIST.map((p) => {
          const isChecked = !!checked[p.key]
          return (
            <div
              key={p.key}
              className={`flex items-center gap-3 rounded-xl p-3 border transition-colors cursor-pointer ${
                isChecked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
              }`}
              onClick={() => toggle(p.key)}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                isChecked ? 'bg-green-200 text-green-800' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${isChecked ? 'text-green-800' : 'text-gray-800'}`}>{p.label}</span>
                  {p.required && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">필수</span>}
                  {!isChecked && !p.required && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium hidden sm:inline">등록하면 ChatGPT 노출 확률 상승</span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{p.hint}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm text-blue-600 hover:text-blue-800 underline font-medium whitespace-nowrap"
                >
                  {p.linkLabel} →
                </a>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isChecked ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}>
                  {isChecked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-sm text-gray-400 mt-3 text-center">체크 상태는 이 기기에 자동 저장됩니다.</p>
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
          <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap flex-1">{draft}</p>
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

      {/* QR 카드 다운로드 — token 로딩 중에도 섹션 표시 */}
      {businessId && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span className="text-sm font-semibold text-gray-700">리뷰 유도 QR 카드</span>
              <p className="text-sm text-gray-500 mt-0.5">손님에게 보여주거나 테이블에 올려두세요</p>
            </div>
          </div>
          {!token ? (
            <p className="text-sm text-gray-400 py-2">로그인 정보를 확인하는 중입니다...</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {/* 이미지 다운로드 */}
              <button
                onClick={() => {
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
                className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" /> 이미지 다운로드
              </button>
              {/* 바로 인쇄 */}
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${BACKEND}/api/guide/${businessId}/qr-card`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    if (!res.ok) { alert('QR 카드 생성에 실패했습니다.'); return }
                    const blob = await res.blob()
                    const imgUrl = URL.createObjectURL(blob)
                    const printWindow = window.open('', '_blank')
                    if (!printWindow) { alert('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return }
                    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>리뷰 유도 QR 카드</title>
<style>* { margin:0; padding:0; box-sizing:border-box; }
body { display:flex; justify-content:center; align-items:center; min-height:100vh; background:white; }
img { max-width:148mm; max-height:210mm; object-fit:contain; }
@media print { body { margin:0; } }</style></head>
<body><img src="${imgUrl}" onload="window.print();setTimeout(()=>window.close(),500)" onerror="alert('이미지 로드 실패');window.close()" /></body></html>`)
                    printWindow.document.close()
                  } catch {
                    alert('인쇄 준비 중 오류가 발생했습니다.')
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors font-medium"
              >
                <span>🖨️</span> 바로 인쇄
              </button>
            </div>
          )}
          <p className="text-sm text-gray-400 mt-2.5">A4/A5로 인쇄하여 카운터에 비치하세요</p>
        </div>
      )}
    </div>
  )
}

// ── 스마트플레이스 Q&A 초안 생성 섹션 ─────────────────────────────────────────
function PioneerDetailSection({ bizId, token }: { bizId: string; token: string }) {
  const [items, setItems] = useState<Array<{ keyword: string; reason: string; example: string }>>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/guide/${bizId}/pioneer-detail`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setItems(data.items || [])
      setLoaded(true)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  function copy(idx: number, text: string) {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  if (items.length === 0 && !loaded) {
    return (
      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 md:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm md:text-base font-bold text-emerald-800">아무도 안 쓰는 기회 키워드 상세 분석</h3>
            <p className="text-sm text-emerald-700 mt-0.5">왜 기회 키워드인지 이유 + 바로 쓸 예시 문장</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            {loading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {loading ? "분석 중..." : "상세 분석 보기"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 md:p-5">
      <h3 className="text-sm md:text-base font-bold text-emerald-800 mb-3">아무도 안 쓰는 기회 키워드 — 왜 기회인가?</h3>
      {items.length === 0 ? (
        <p className="text-sm text-emerald-600">현재 분석 가능한 기회 키워드가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full">{item.keyword}</span>
                <button
                  onClick={() => copy(idx, item.example)}
                  className="text-sm px-2 py-1 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50"
                >
                  {copiedIdx === idx ? "✓ 복사됨" : "예시 복사"}
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-1"><span className="font-medium">이유:</span> {item.reason}</p>
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1"><span className="font-medium">예시:</span> {item.example}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CATEGORY_FAQ_KEYWORDS: Record<string, string[]> = {
  restaurant: ['주차 가능', '포장 가능', '단체 예약', '배달 가능', '웨이팅', '런치 메뉴', '세트 메뉴', '예약 방법', '영업 시간', '주류 판매'],
  cafe: ['커피 종류', '디저트 메뉴', '주차 가능', '와이파이', '콘센트', '포장 가능', '브런치', '케이크 주문', '스터디 가능', '반려동물'],
  bakery: ['케이크 종류', '주문 제작', '당일 픽업', '알레르기 정보', '재료 원산지', '조각 케이크', '예약 구매', '냉동 보관'],
  bar: ['예약 방법', '안주 종류', '주류 종류', '주차 가능', '단체 대관', '콜키지', '영업 시간', '드레스 코드'],
  beauty: ['예약 방법', '소요 시간', '가격표', '주차 가능', '케어 방법', '재료 안전성', '남성 가능', '야간 예약'],
  nail: ['예약 방법', '소요 시간', '젤 네일 가격', '케어 방법', '제거 방법', '연장 가능', '발 네일', '패키지 할인'],
  medical: ['진료 시간', '예약 방법', '보험 적용', '주차 가능', '전문 분야', '야간 진료', '당일 예약', '초진 절차'],
  pharmacy: ['영업 시간', '야간 운영', '처방전 없이', '건강기능식품', '주차 가능', '전문 상담', '주사 처방'],
  fitness: ['등록 방법', '1:1 PT 가격', '트레이너 자격', '주차 가능', '샤워 시설', '운영 시간', '체험 수업', '락커 이용'],
  yoga: ['초보자 가능', '수업 종류', '예약 방법', '복장 안내', '매트 대여', '체험 수업', '소규모 수업', '주차 가능'],
  pet: ['미용 예약', '목욕 포함', '견종 제한', '주차 가능', '호텔링', '픽드롭', '예방 접종', '건강 검진'],
  education: ['수강 신청', '수업 정원', '레벨 테스트', '교재 비용', '환불 정책', '온라인 수업', '무료 체험', '자격증'],
  tutoring: ['과외 방식', '선생님 자격', '수업 장소', '수업료', '무료 상담', '교재 선택', '시간 조정', '체험 수업'],
  legal: ['상담 가능 분야', '상담 비용', '상담 예약', '주차 가능', '사건 비용', '초기 상담 무료', '출장 상담'],
  realestate: ['매물 종류', '수수료', '주차 가능', '전세 대출', '매물 검색 방법', '계약 절차', '투자 상담'],
  interior: ['시공 기간', '비용 견적', '무료 상담', '시공 사례', '자재 종류', '보증 기간', 'AS 정책', '3D 도면'],
  auto: ['예약 방법', '정비 종류', '비용 견적', '대기 시간', '대차 서비스', '보험 처리', '부품 보증', '주차 가능'],
  cleaning: ['출장 비용', '소요 시간', '청소 범위', '예약 방법', '약품 안전성', '정기 계약', '입주 청소', '에어컨 청소'],
  shopping: ['반품 정책', '교환 방법', '배송 기간', '포장 서비스', '대량 주문', '제품 원산지', 'AS 정책', '할인 혜택'],
  fashion: ['사이즈 안내', '반품 정책', '교환 방법', '소재 정보', '세탁 방법', '맞춤 제작', '체형 상담', '배송 기간'],
  photo: ['촬영 시간', '보정 포함', '원본 제공', '의상 대여', '주차 가능', '예약 방법', '가격표', '결과물 전달'],
  video: ['제작 기간', '가격 견적', '포맷 제공', '수정 횟수', '저작권', '예약 방법', '포트폴리오 확인'],
  design: ['작업 기간', '가격 견적', '파일 포맷', '수정 횟수', '저작권', '견적 문의 방법', '포트폴리오'],
  accommodation: ['체크인/아웃', '조식 포함', '주차 가능', '반려동물', '취소 정책', '바베큐', '추가 침대', '예약 방법'],
  other: ['영업 시간', '예약 방법', '주차 가능', '가격표', '문의 방법', '위치 안내', '결제 방법', '할인 혜택'],
}

function SmartplaceFAQSection({
  bizId,
  plan,
  topMissingKeywords,
  category,
}: {
  bizId: string
  plan: string
  topMissingKeywords?: string[]
  category?: string
}) {
  const [loading, setLoading] = useState(false)
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [selectedFaqKeywords, setSelectedFaqKeywords] = useState<string[]>([])

  const [faqExcluded, setFaqExcluded] = useState<string[]>([])

  const canUse = ['basic', 'startup', 'pro', 'biz'].includes(plan)

  // 제외된 키워드 필터링
  const suggestedKeywords = (topMissingKeywords ?? []).filter(kw => !faqExcluded.includes(kw))

  // 업종별 추가 추천 키워드 (제외 키워드가 있을 때 노출)
  const catKey = category ?? 'other'
  const categoryKeywords = (CATEGORY_FAQ_KEYWORDS[catKey] ?? CATEGORY_FAQ_KEYWORDS['other'])
    .filter(kw => !faqExcluded.includes(kw) && !(topMissingKeywords ?? []).includes(kw))
    .slice(0, 6)
  const showCategoryKeywords = faqExcluded.length > 0 && categoryKeywords.length > 0

  async function generate(keywords: string[] = []) {
    if (!canUse) return
    setLoading(true)
    setError('')
    try {
      const { getSafeSession } = await import('@/lib/supabase/client')
      const sess = await getSafeSession()
      const token = sess?.access_token
      const res = await fetch(`${BACKEND}/api/guide/${bizId}/smartplace-faq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ keywords }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(err.detail || '생성 실패')
      }
      const data = await res.json() as { faqs?: Array<{ question: string; answer: string }>; used?: number; limit?: number }
      setFaqs(data.faqs || [])
      if (data.used !== undefined && data.limit !== undefined) {
        setUsage({ used: data.used, limit: data.limit })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function copyFAQ(idx: number, q: string, a: string) {
    navigator.clipboard.writeText(`Q. ${q}
A. ${a}`).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="text-base md:text-lg font-bold text-gray-900">
            스마트플레이스 Q&A 초안 생성
          </h3>
          <p className="text-base text-gray-500 mt-0.5">
            소개글 Q&A 섹션 초안 — 사장님이 직접 컨트롤할 수 있는 인용 후보 경로 중 하나입니다
          </p>
        </div>
        {usage && (
          <span className="text-sm text-gray-400">
            이번 달 {usage.used}/{usage.limit}회 사용
          </span>
        )}
      </div>

      {!canUse ? (
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500">Basic 이상 플랜에서 사용 가능합니다</p>
          <a href="/pricing" className="text-sm text-blue-600 hover:underline mt-1 inline-block">플랜 보기 →</a>
        </div>
      ) : (
        <>
          {/* 키워드 선택 UI (작업 3) */}
          {suggestedKeywords.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                키워드 기반 생성 <span className="text-gray-400 font-normal">(선택 — 비워두면 자동 추출)</span>
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {suggestedKeywords.map((kw) => (
                  <div key={kw} className={`flex items-center rounded-full border transition-all ${
                    selectedFaqKeywords.includes(kw)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}>
                    <button
                      onClick={() => setSelectedFaqKeywords(prev =>
                        prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
                      )}
                      className="px-3 py-1 text-sm"
                    >
                      {kw}
                    </button>
                    <button
                      onClick={() => {
                        setFaqExcluded(prev => [...prev, kw])
                        setSelectedFaqKeywords(prev => prev.filter(k => k !== kw))
                      }}
                      className={`pr-2 text-xs font-bold leading-none transition-colors ${
                        selectedFaqKeywords.includes(kw) ? 'text-blue-200 hover:text-white' : 'text-gray-400 hover:text-red-500'
                      }`}
                      title="관련 없는 키워드 제외"
                      aria-label={`"${kw}" 제외`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* 업종별 추가 추천 키워드 (제외 키워드가 있을 때) */}
              {showCategoryKeywords && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500 mb-2">
                    업종 추천 키워드 <span className="text-gray-400">(클릭해서 추가)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categoryKeywords.map(kw => (
                      <button
                        key={kw}
                        onClick={() => setSelectedFaqKeywords(prev =>
                          prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
                        )}
                        className={`px-3 py-1 rounded-full text-sm border transition-all ${
                          selectedFaqKeywords.includes(kw)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400 hover:bg-white'
                        }`}
                      >
                        + {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedFaqKeywords.length > 0 && (
                <p className="text-sm text-blue-600 mt-2">
                  선택됨: {selectedFaqKeywords.join(', ')} — 이 키워드 중심으로 FAQ 생성
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => generate(selectedFaqKeywords)}
            disabled={loading}
            className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                생성 중...
              </>
            ) : (
              'FAQ 초안 5개 생성'
            )}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}

          {faqs.length > 0 && (
            <div className="mt-4 space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-blue-50 rounded-xl p-4 relative">
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => {
                      if (!window.confirm('이 FAQ 항목을 삭제할까요?')) return
                      setFaqs(prev => prev.filter((_, i) => i !== idx))
                    }}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                    title="이 항목 삭제"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-blue-900 mb-1">
                        Q. {faq.question}
                      </p>
                      <p className="text-base text-blue-800 leading-relaxed">
                        A. {faq.answer}
                      </p>
                    </div>
                    <button
                      onClick={() => copyFAQ(idx, faq.question, faq.answer)}
                      disabled={!faq.question && !faq.answer}
                      className="shrink-0 text-sm px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {copiedIdx === idx ? '✓ 복사됨' : (!faq.question && !faq.answer) ? '복사할 내용 없음' : '복사'}
                    </button>
                  </div>
                </div>
              ))}
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                ⚠️ <strong>[ ] 괄호 안 내용은 실제 정보로 바꿔주세요</strong> — 그대로 복사하면 괄호가 노출됩니다
              </div>
              <p className="text-sm text-gray-400 text-center mt-2">
                네이버 스마트플레이스 파트너센터 → Q&A 관리에서 붙여넣기 하세요
              </p>
            </div>
          )}
        </>
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
  const extractCopyable = (text: string | undefined | null): { main: string; copyable: string | null } => {
    if (!text) return { main: "", copyable: null };
    // ```(언어힌트 포함)으로 감싸진 부분
    const codeMatch = text.match(/```(?:json|JSON|html|HTML|javascript|js)?\s*([\s\S]*?)```/)
    if (codeMatch) {
      return {
        main: text.replace(/```(?:json|JSON|html|HTML|javascript|js)?\s*[\s\S]*?```/, '').trim(),
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
    // 백틱 없는 JSON 블록 감지 (예: schema.org LocalBusiness 마크업)
    const jsonBlockMatch = text.match(/([\s\S]*?)(\{[\s\S]{20,}\})([\s\S]*)/)
    if (jsonBlockMatch && jsonBlockMatch[2]) {
      try {
        JSON.parse(jsonBlockMatch[2])
        const before = jsonBlockMatch[1].trim()
        const after = (jsonBlockMatch[3] || '').trim()
        return {
          main: [before, after].filter(Boolean).join('\n').trim() || 'AI 검색 인식 코드',
          copyable: jsonBlockMatch[2].trim(),
        }
      } catch { /* not valid JSON */ }
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
            {done ? <Check className="w-3 h-3" /> : (item.rank ?? '')}
          </button>
          <div className="min-w-0 flex-1">
            {(item.dimension || item.category) && (
              <span className="text-sm text-gray-400 block">
                {DIMENSION_LABEL[item.dimension ?? ''] ?? DIMENSION_LABEL[item.category ?? ''] ?? item.dimension ?? item.category}
              </span>
            )}
            <div className={`font-semibold leading-snug ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {simplify(((item as unknown) as Record<string, unknown>).title as string
                ?? ((item as unknown) as Record<string, unknown>).text as string
                ?? ((item as unknown) as Record<string, unknown>).description as string
                ?? '개선 항목')}
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


// ── 지금 바로 할 것 — 키워드 선택형 히어로 ────────────────────────────────────
function TodayKeywordHero({
  keywords,
  bizId,
  initialExcluded = [],
}: {
  keywords: string[]
  bizId: string
  initialExcluded?: string[]
}) {
  const STORAGE_KEY = `aeolab_hero_excluded_${bizId}`
  const [excluded, setExcluded] = useState<string[]>(() => {
    try {
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]
      // DB 값과 병합 (중복 제거)
      const merged = Array.from(new Set([...initialExcluded, ...local]))
      return merged
    } catch { return initialExcluded }
  })
  const [selectedKw, setSelectedKw] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const visible = keywords.filter(kw => !excluded.includes(kw)).slice(0, 5)
  const active = (selectedKw && visible.includes(selectedKw)) ? selectedKw : (visible[0] ?? null)

  const excludeKw = (kw: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = [...excluded, kw]
    setExcluded(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
    if (selectedKw === kw) setSelectedKw(null)
    // DB 반영 (fire-and-forget)
    import('@/lib/supabase/client').then(({ getSafeSession }) =>
      getSafeSession().then(sess => {
        if (!sess?.access_token) return
        fetch(`${BACKEND}/api/businesses/${bizId}/keywords/exclude`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.access_token}` },
          body: JSON.stringify({ keyword: kw }),
        }).catch(() => {})
      })
    ).catch(() => {})
  }

  const faqText = active
    ? `Q: ${active}는 어떤가요?\nA: 저희 가게는 ${active} 관련 서비스를 제공하고 있습니다. 궁금한 점은 언제든지 문의해 주세요.`
    : null

  if (!active) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">🎯</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-700 mb-1">지금 바로 할 것 1가지</p>
          <p className="text-base font-bold text-gray-900 mb-1">부족한 키워드를 선택해 소개글 안 Q&A에 추가하세요</p>
          <p className="text-sm text-gray-500 mb-3 leading-relaxed">
            이 키워드들이 없어서 AI 브리핑 노출 기회를 놓치고 있습니다. 키워드를 선택하면 FAQ 문구가 자동 생성됩니다.
            관련 없는 키워드는 <strong>✕</strong>로 제외하세요.
          </p>

          {/* 키워드 칩 선택 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {visible.map(kw => (
              <div
                key={kw}
                onClick={() => setSelectedKw(kw)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 cursor-pointer select-none transition-all ${
                  active === kw
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                <span className="text-sm font-medium">{kw}</span>
                <button
                  onClick={(e) => excludeKw(kw, e)}
                  className={`text-xs font-bold leading-none transition-colors ${
                    active === kw ? 'text-blue-200 hover:text-white' : 'text-gray-400 hover:text-red-500'
                  }`}
                  title="관련 없는 키워드 제외"
                  aria-label={`"${kw}" 제외`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* FAQ 복사 문구 미리보기 */}
          {faqText && (
            <div className="bg-white rounded-lg border border-amber-200 p-3 mb-3">
              <p className="text-sm text-amber-600 font-semibold mb-1.5">스마트플레이스 Q&A 복사 문구</p>
              <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{faqText}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {faqText && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(faqText).catch(() => {})
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                  copied ? 'bg-green-600 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
                }`}
              >
                {copied ? '✓ 복사됨' : '복사하기 →'}
              </button>
            )}
            <a
              href="https://smartplace.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              스마트플레이스 바로 가기 <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── 탭 전환 뷰 (3탭: 지금 복사 / 이번 주 할 것 / 전체 라이브러리) ────────────
const TAB_ITEMS = [
  { key: 'now',     icon: '✅', label: '오늘 활용' },
  { key: 'week',    icon: '📅', label: '이번 주 할 것' },
  { key: 'library', icon: '📚', label: '전체 라이브러리' },
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
  highlightKeyword = null,
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
  region,
  category,
  briefingEligibility = "active",
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
  highlightKeyword?: string | null
  region?: string
  category?: string
  briefingEligibility?: BriefingEligibility
}) {
  const isTabInactive = briefingEligibility !== "active"
  const [activeTab, setActiveTab] = useState<TabKey>('now')
  const [showBriefingPaths, setShowBriefingPaths] = useState(false)
  const [showReviewDrafts, setShowReviewDrafts] = useState(false)
  const [showQuickTools, setShowQuickTools] = useState(false)
  const [showFAQSection, setShowFAQSection] = useState(false)

  // "오늘 당장 할 것" 히어로 액션 결정 (우선순위: gap > actionPlan > briefingPaths)
  const todayHeroAction = (() => {
    if (keywordGap?.missing_keywords && keywordGap.missing_keywords.length > 0) {
      const kw = keywordGap.missing_keywords[0]
      return {
        label: `"${kw}" 키워드를 스마트플레이스 소개글에 포함하세요`,
        reason: `이 키워드가 소개글에 없으면 AI 브리핑 인용 후보에서 누락될 수 있습니다. 소개글은 사장님이 직접 컨트롤할 수 있는 인용 후보 경로 중 하나입니다.`,
        copyText: `Q: ${kw}는 어떤 곳인가요?\nA: 저희 가게는 ${kw} 분야에서 최선을 다하고 있습니다. 언제든지 방문해 주세요.`,
      }
    }
    if (thisWeekMission?.title) {
      return {
        label: thisWeekMission.title,
        reason: thisWeekMission.why ?? '',
        copyText: null,
      }
    }
    if (briefingPaths.length > 0) {
      const path = briefingPaths[0]
      return {
        label: path.label ?? 'AI 브리핑 인용 후보 경로 개선',
        reason: path.effect ?? 'AI 브리핑 인용 후보가 될 수 있는 경로를 보완합니다.',
        copyText: path.ready_text ?? null,
      }
    }
    return null
  })()

  // ?keyword= 파라미터가 있으면 '지금 복사' 탭 포커스 (이미 'now'가 기본값이므로 별도 처리 불필요)

  return (
    <>
      {/* 안내 배너 */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <span className="text-lg mt-0.5">💡</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">이 가이드는 AI 스캔 결과 기반으로 자동 생성됩니다</p>
          <p className="text-sm text-amber-600 mt-0.5">
            복사 버튼을 눌러 스마트플레이스에 바로 붙여넣기 하세요.
            {isTabInactive
              ? " 실천할수록 ChatGPT·Gemini·Google·네이버 AI 검색 노출이 올라갑니다."
              : " 실천할수록 네이버 AI 브리핑 노출이 올라갑니다."}
          </p>
        </div>
      </div>

      {/* 소개글 Q&A 등록 배너 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
        <span className="text-xl">📍</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800">소개글에 Q&A 포함하는 방법</p>
          <p className="text-sm text-blue-600">스마트플레이스 관리자 → <strong>업체정보 → 소개글</strong>에 Q&A를 자연스럽게 포함하세요</p>
        </div>
        <a href="https://smartplace.naver.com" target="_blank" rel="noopener noreferrer"
           className="text-sm font-medium text-blue-700 underline whitespace-nowrap shrink-0">바로 가기 →</a>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="hidden sm:inline">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── 탭 1: 지금 복사 ── */}
      {activeTab === 'now' && (
        <div className="space-y-5">
          {/* 오늘 당장 할 것 1가지 — 키워드 선택형 히어로 */}
          {(keywordGap?.missing_keywords?.length ?? 0) > 0 ? (
            <TodayKeywordHero
              keywords={keywordGap!.missing_keywords}
              bizId={business.id}
              initialExcluded={business.excluded_keywords ?? []}
            />
          ) : todayHeroAction && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">🎯</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-700 mb-1">지금 바로 할 것 1가지</p>
                  <p className="text-base md:text-lg font-bold text-gray-900">{todayHeroAction.label}</p>
                  {todayHeroAction.reason && (
                    <p className="text-sm text-gray-600 mt-1">{todayHeroAction.reason}</p>
                  )}
                  {todayHeroAction.copyText && (
                    <div className="mt-3">
                      <CopyButton text={todayHeroAction.copyText} label="복사하기 →" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 이번 주 가장 중요한 1가지 */}
          {thisWeekMission && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 md:p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5" />
                <span className="text-sm font-medium opacity-90">이번 주 가장 중요한 1가지</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold mb-2">{thisWeekMission.title}</h2>
              <p className="text-base opacity-90 mb-4">{thisWeekMission.why}</p>
              {thisWeekMission.steps && thisWeekMission.steps.length > 0 && (
                <div className="space-y-2 mb-4">
                  {thisWeekMission.steps.map((step: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-base">
                      <span className="bg-white bg-opacity-20 rounded-full w-5 h-5 flex items-center justify-center text-sm shrink-0 mt-0.5">{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-75">⏱ {thisWeekMission.time_required}</span>
                {thisWeekMission.deep_link && (
                  <a href={thisWeekMission.deep_link} target="_blank" rel="noopener noreferrer"
                     className="bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                    바로 가기 →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 블로그 AI 최적화 진단 — 전용 페이지 링크 */}
          <a
            href="/blog"
            className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              <div>
                <span className="text-sm font-semibold text-gray-800">내 블로그 AI 최적화 진단</span>
                <p className="text-sm text-gray-400 mt-0.5">블로그가 AI 브리핑에 얼마나 최적화됐는지 확인하세요</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0" />
          </a>

          {/* AI 브리핑 직접 관리 경로 — 기본 접힘 */}
          <div>
            <button
              onClick={() => setShowBriefingPaths(!showBriefingPaths)}
              className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-800 text-sm md:text-base">📋 AI가 내 가게 얘기하게 만드는 방법 (4가지)</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showBriefingPaths ? 'rotate-180' : ''}`} />
            </button>
            {showBriefingPaths && (
              briefingPaths.length > 0 ? (
                <div className="mt-2">
                  <BriefingPathsSection
                    paths={briefingPaths}
                    naverSearchUrl={naverSearchUrl}
                    currentPlan={currentPlan}
                    isInactive={isTabInactive}
                  />
                </div>
              ) : (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-amber-800">
                    가이드를 생성하면 복사할 수 있는 문구가 여기에 나타납니다
                  </p>
                  <p className="text-sm text-amber-600 mt-1">
                    스캔 완료 후 &ldquo;가이드 생성&rdquo; 버튼을 눌러주세요
                  </p>
                  <button
                    onClick={() => document.getElementById('guide-generate-btn')?.scrollIntoView({ behavior: 'smooth' })}
                    className="mt-2 text-sm text-amber-700 underline"
                  >
                    가이드 생성하기 →
                  </button>
                </div>
              )
            )}
          </div>

          {/* 스마트플레이스 Q&A 초안 생성 */}
          <SmartplaceFAQSection
            bizId={business.id}
            plan={currentPlan}
            topMissingKeywords={keywordGap?.missing_keywords ?? []}
            category={business.category}
          />

          {/* 리뷰 답변 초안 — 기본 접힘 */}
          {reviewDrafts.length > 0 && (
            <div>
              <button
                onClick={() => setShowReviewDrafts(!showReviewDrafts)}
                className={`w-full flex items-center justify-between p-4 border rounded-xl transition-all duration-200 text-left
                  ${showReviewDrafts
                    ? 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'bg-white border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className={`w-4 h-4 transition-colors ${showReviewDrafts ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className={`font-semibold text-sm md:text-base transition-colors ${showReviewDrafts ? 'text-blue-900' : 'text-gray-800'}`}>
                    리뷰 답변 초안 ({reviewDrafts.length}개)
                  </span>
                  {!showReviewDrafts && (
                    <span className="text-sm text-gray-400 font-normal hidden sm:inline">키워드 포함 초안</span>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 transition-all duration-300 ${showReviewDrafts ? 'text-blue-500 rotate-180' : 'text-gray-400'}`} />
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${showReviewDrafts ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <div className="mt-2">
                    <ReviewDraftsSection
                      drafts={reviewDrafts}
                      naverPlaceId={business.naver_place_id}
                      currentPlan={currentPlan}
                    />
                    {!business.naver_place_id && (
                      <p className="text-sm text-gray-400 mt-2 px-1">
                        사업장 설정에서 네이버 플레이스 ID를 등록하면 리뷰 관리 페이지로 바로 이동합니다
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 즉시 활용 도구 중 리뷰 유도 문구 */}
          {tools.review_request_message && (
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-amber-500" />
                <div className="text-sm font-semibold text-gray-900">QR 카드용 리뷰 유도 문구</div>
                <span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">인쇄용</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">이 문구를 영수증·테이블 카드·QR 카드에 인쇄하여 리뷰를 유도하세요.</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">{tools.review_request_message}</p>
                <div className="flex items-center justify-between pt-3 border-t border-amber-200">
                  <span className="text-sm text-amber-700 font-medium">복사 후 바로 사용 가능</span>
                  <CopyButton text={tools.review_request_message} />
                </div>
              </div>
            </div>
          )}

          {/* 외부 언급 3채널 — 맘카페·지식인·인스타 (각각 다른 접근법) */}
          {(() => {
            const topKeyword = keywordGap?.missing_keywords?.[0]
            const bizRegion = region || '우리 지역'
            const bizCategory = category ? (CATEGORY_KO[category] ?? category) : '가게'
            const bizName = business.name || '우리 가게'

            // 업종별 채널 분기
            const cat = category ?? 'other'
            const isFoodDrink = ['restaurant', 'cafe', 'bakery', 'bar'].includes(cat)
            const isBeauty = ['beauty', 'nail'].includes(cat)
            const isMedical = ['medical', 'pharmacy'].includes(cat)
            const isFitness = ['fitness', 'yoga'].includes(cat)
            const isEducation = ['education', 'tutoring'].includes(cat)
            const isPet = cat === 'pet'
            const isCreative = ['photo', 'video', 'design'].includes(cat)
            const isFashion = ['shopping', 'fashion'].includes(cat)
            const isService = ['interior', 'auto', 'cleaning'].includes(cat)

            type Channel = { key: string; icon: string; title: string; approach: string; hint: string; text: string }
            let channels: Channel[]

            if (isMedical) {
              channels = [
                {
                  key: 'knowledge',
                  icon: '💬',
                  title: '네이버 지식인 — 건강 전문 답변',
                  approach: '의료·건강 관련 질문에 전문가 답변 — AI가 지식인 의료 답변을 높은 신뢰도로 학습',
                  hint: topKeyword ? `"${topKeyword} 증상·치료" 관련 질문 검색 후 전문 답변` : `"${bizRegion} ${bizCategory} 진료" 질문에 답변`,
                  text: topKeyword
                    ? `${topKeyword} 관련 질문을 하셨군요. ${bizName}에서 진료 가능합니다. 구체적인 상담은 방문 또는 지도 검색 '${bizName}'으로 문의해 주세요. (답변자: ${bizName} 의료진)`
                    : `${bizRegion} ${bizCategory} 관련 문의는 ${bizName}에서 도움드릴 수 있습니다. 지도 검색 '${bizName}'으로 예약·문의해 주세요. (답변자: ${bizName} 의료진)`,
                },
                {
                  key: 'cafe',
                  icon: '🏠',
                  title: '네이버 카페 — 지역 건강 커뮤니티',
                  approach: '지역 건강 정보 카페에서 건강 정보 공유 형식으로 자연스럽게 소개',
                  hint: `"${bizRegion} 건강 정보" 또는 "${bizCategory} 추천" 관련 카페 검색 후 참여`,
                  text: `안녕하세요, ${bizRegion}에서 ${bizCategory}을 운영하는 ${bizName}입니다. ${topKeyword || bizCategory} 관련 건강 정보를 공유드립니다. 더 자세한 상담이 필요하시면 지도에서 '${bizName}'을 검색해 주세요. (사업주 작성)`,
                },
                {
                  key: 'blog',
                  icon: '📝',
                  title: '네이버 블로그 — 건강 정보 콘텐츠',
                  approach: `${topKeyword || bizCategory} 관련 정보성 블로그 포스팅 — 전문성이 AI 신뢰도를 높임`,
                  hint: topKeyword ? `"${topKeyword}이란?" "증상·예방법" 같은 정보성 주제로 작성` : `"${bizCategory} 선택 기준" 같은 정보성 주제`,
                  text: `[${bizName} 건강 정보]\n${topKeyword || bizCategory} 관련 안내:\n- 증상과 예방법\n- 언제 방문해야 할까\n- ${bizName} 진료 안내\n\n${bizRegion} 지도에서 '${bizName}' 검색`,
                },
              ]
            } else if (isBeauty) {
              channels = [
                {
                  key: 'community',
                  icon: '💄',
                  title: '네이버 카페 — 뷰티·헤어 커뮤니티',
                  approach: '뷰티·헤어 관심사 카페에서 시술 정보 공유 형식으로 참여',
                  hint: topKeyword ? `"${bizRegion} ${topKeyword}" 관련 카페 검색 후 시술 정보 공유` : `"${bizRegion} 미용·뷰티" 카페에서 활동`,
                  text: `안녕하세요, ${bizRegion} ${bizCategory} ${bizName}입니다. ${topKeyword ? `${topKeyword} 관련 시술 정보를 공유드립니다.` : '다양한 스타일 시술이 가능합니다.'} 상담 및 예약은 지도 검색 '${bizName}'으로 문의해 주세요. (사업주 작성)`,
                },
                {
                  key: 'instagram',
                  icon: '📸',
                  title: '인스타그램 — Before/After 시술 사진',
                  approach: '시술 전후 사진은 뷰티 업종 최강 콘텐츠 — 고객 동의 후 업로드, Google 이미지 검색에 반영',
                  hint: `고객 동의 받고 시술 전후 사진 → 위치 태그 + #${(topKeyword || bizCategory).replace(/\s+/g, '')} #${bizRegion.replace(/\s+/g, '')}미용`,
                  text: `${bizName} ${topKeyword || bizCategory} 시술 ✂️\n\n고객님 동의 후 공개합니다.\n\n📍위치: ${bizRegion} ${bizName}\n\n#${bizRegion.replace(/\s+/g, '')}미용 #${(topKeyword || bizCategory).replace(/\s+/g, '')} #${bizName.replace(/\s+/g, '')}`,
                },
                {
                  key: 'knowledge',
                  icon: '💬',
                  title: '네이버 지식인 — 뷰티 전문 답변',
                  approach: '"○○ 시술 어디서 받아야 하나요?" 질문에 전문가 답변으로 신뢰 구축',
                  hint: topKeyword ? `"${bizRegion} ${topKeyword} 추천" 질문 검색 후 전문 답변` : `"${bizRegion} ${bizCategory} 추천" 질문에 답변`,
                  text: topKeyword
                    ? `${topKeyword} 시술을 찾고 계신다면 ${bizName}에서 상담받아 보세요. ${bizRegion} 위치이며 지도 검색 '${bizName}'으로 예약 가능합니다. (답변자: ${bizName} 원장)`
                    : `${bizRegion} ${bizCategory}을 찾으신다면 ${bizName}을 추천드립니다. 지도 검색으로 바로 찾을 수 있습니다. (답변자: ${bizName} 원장)`,
                },
              ]
            } else if (isFitness) {
              channels = [
                {
                  key: 'community',
                  icon: '💪',
                  title: '네이버 카페 — 운동·다이어트 커뮤니티',
                  approach: '운동 관심사 카페에서 운동 팁 공유 형식으로 자연스럽게 참여',
                  hint: topKeyword ? `"${topKeyword} 운동법" 정보 공유 후 ${bizName} 소개` : `"${bizRegion} 운동" 관련 카페 참여`,
                  text: `안녕하세요, ${bizRegion} ${bizCategory} ${bizName}입니다. ${topKeyword ? `${topKeyword} 운동에 관심 있는 분들께 도움이 될 것 같아 공유합니다.` : '운동 관련 궁금한 점 있으시면 도움드릴게요.'} 체험 수업 문의는 지도에서 '${bizName}' 검색해 주세요. (사업주 작성)`,
                },
                {
                  key: 'instagram',
                  icon: '📸',
                  title: '인스타그램 — 운동 인증·클래스 분위기',
                  approach: '클래스 분위기·운동 인증 사진·영상 — 피트니스 업종 필수 채널',
                  hint: `클래스 분위기 사진 + 위치 태그 + #${(topKeyword || '운동').replace(/\s+/g, '')} #${bizRegion.replace(/\s+/g, '')}헬스`,
                  text: `${bizName} 클래스 소개 💪\n\n${topKeyword ? `${topKeyword} 전문 수업` : '다양한 운동 프로그램'} 운영 중입니다.\n\n첫 체험 수업 문의: 📍${bizRegion} ${bizName}\n\n#${bizRegion.replace(/\s+/g, '')}헬스 #${(topKeyword || '운동').replace(/\s+/g, '')} #${bizName.replace(/\s+/g, '')}`,
                },
                {
                  key: 'knowledge',
                  icon: '💬',
                  title: '네이버 지식인 — 운동 전문 답변',
                  approach: '"○○ 운동 어디서 배우나요?" 질문에 답변 — AI 검색 데이터 학습',
                  hint: topKeyword ? `"${bizRegion} ${topKeyword} 강습" 질문에 답변` : `"${bizRegion} ${bizCategory} 추천" 질문에 답변`,
                  text: topKeyword
                    ? `${topKeyword}를 배우고 싶으시다면 ${bizName}에서 체험 수업을 받아보세요. ${bizRegion} 위치, 지도에서 '${bizName}' 검색 가능합니다. (답변자: ${bizName} 트레이너)`
                    : `${bizRegion} ${bizCategory}은 ${bizName}에서 체험 가능합니다. 첫 수업 부담 없이 오세요. (답변자: ${bizName} 트레이너)`,
                },
              ]
            } else if (isEducation) {
              channels = [
                {
                  key: 'cafe',
                  icon: '🏠',
                  title: '네이버 카페 — 학부모·교육 커뮤니티',
                  approach: '"우리 지역 학원 어디가 좋나요?" 형식의 글에 답변으로 참여',
                  hint: topKeyword ? `"${bizRegion} ${topKeyword} 학원" 관련 카페 검색 후 참여` : `"${bizRegion} 교육" 학부모 카페 참여`,
                  text: `안녕하세요, ${bizRegion} ${bizName}입니다. ${topKeyword ? `${topKeyword} 교육 전문` : bizCategory}으로 운영 중입니다. 자녀 교육 관련 궁금한 점 있으시면 지도에서 '${bizName}'으로 문의해 주세요. (사업주 작성)`,
                },
                {
                  key: 'knowledge',
                  icon: '💬',
                  title: '네이버 지식인 — 학습법 전문 답변',
                  approach: '학습 관련 질문에 전문 답변 — 교육 전문성 자연스럽게 어필',
                  hint: topKeyword ? `"${topKeyword} 효과적인 학습법" 질문에 답변` : `"${bizRegion} ${bizCategory} 추천" 질문에 답변`,
                  text: topKeyword
                    ? `${topKeyword} 학습을 위한 팁 안내드립니다. 체계적인 지도가 필요하시면 ${bizName}에서 상담받아 보세요. (답변자: ${bizName} 강사)`
                    : `${bizRegion} ${bizCategory}을 찾으신다면 ${bizName}을 추천드립니다. 체험 수업도 가능합니다. (답변자: ${bizName} 강사)`,
                },
                {
                  key: 'blog',
                  icon: '📝',
                  title: '네이버 블로그 — 교육 정보 콘텐츠',
                  approach: '학습법·교육 트렌드 정보성 포스팅 — 학부모 검색 유입·AI 인용',
                  hint: topKeyword ? `"${topKeyword} 효과적으로 배우는 법" 같은 정보성 주제` : `"${bizRegion} ${bizCategory} 선택 기준" 같은 학부모 관심 주제`,
                  text: `[${bizName} 교육 정보]\n${topKeyword || bizCategory} 학습 가이드:\n- 효과적인 학습 방법\n- 연령별 학습 포인트\n- ${bizName} 수업 안내\n\n${bizRegion} 지도에서 '${bizName}' 검색`,
                },
              ]
            } else if (isPet) {
              channels = [
                {
                  key: 'cafe',
                  icon: '🐾',
                  title: '네이버 카페 — 반려동물 커뮤니티',
                  approach: '지역 반려동물 카페에서 정보 공유 — 반려인 커뮤니티는 신뢰 기반이 강함',
                  hint: topKeyword ? `"${bizRegion} ${topKeyword}" 관련 반려동물 카페 검색 후 참여` : `"${bizRegion} 반려동물" 카페 참여`,
                  text: `안녕하세요, ${bizRegion} ${bizName}입니다. ${topKeyword ? `${topKeyword} 전문 서비스` : '반려동물 전문'}으로 운영 중입니다. 소중한 반려동물 관련 궁금한 점 있으시면 지도 검색 '${bizName}'으로 문의해 주세요. (사업주 작성)`,
                },
                {
                  key: 'instagram',
                  icon: '📸',
                  title: '인스타그램 — 반려동물 사진',
                  approach: '반려동물 사진은 인스타그램 최고 인기 콘텐츠 — 고객 동의 후 귀여운 사진 공유',
                  hint: `고객 반려동물 사진 (동의 후) + 위치 태그 + #${bizRegion.replace(/\s+/g, '')}반려동물 #${(topKeyword || '펫').replace(/\s+/g, '')}`,
                  text: `${bizName} 방문 고객 🐾\n\n${topKeyword ? topKeyword + ' 전문 서비스 제공' : '전문적인 반려동물 관리'}\n\n📍${bizRegion} ${bizName}\n\n#${bizRegion.replace(/\s+/g, '')}반려동물 #${(topKeyword || '펫').replace(/\s+/g, '')} #${bizName.replace(/\s+/g, '')}`,
                },
                {
                  key: 'knowledge',
                  icon: '💬',
                  title: '네이버 지식인 — 반려동물 전문 답변',
                  approach: '반려동물 건강·관리 질문에 전문 답변으로 신뢰 구축',
                  hint: topKeyword ? `"${topKeyword}" 관련 반려동물 질문에 전문 답변` : `"${bizRegion} 반려동물 ${bizCategory}" 질문에 답변`,
                  text: topKeyword
                    ? `반려동물 ${topKeyword} 관련 문의는 ${bizName}에서 도움드릴 수 있습니다. ${bizRegion} 위치, 지도에서 '${bizName}' 검색해 주세요. (답변자: ${bizName} 전문가)`
                    : `${bizRegion} ${bizCategory}은 ${bizName}에서 전문적으로 관리해 드립니다. (답변자: ${bizName} 전문가)`,
                },
              ]
            } else {
              // 기본 (food, legal, realestate, service, creative, fashion, accommodation, other)
              channels = [
                {
                  key: 'cafe',
                  icon: '🏠',
                  title: isFoodDrink ? '네이버 카페 — 맘카페·지역 맛집 카페' : '네이버 지역 카페',
                  approach: isFoodDrink
                    ? '"이 동네 맛집 추천해주세요" 형식 글에 사업주로 답글'
                    : '지역 커뮤니티 카페에서 관련 질문에 사업주로 답글',
                  hint: '사업주 신분 밝히고 솔직한 소개 + 위치 정보 포함',
                  text: topKeyword
                    ? `안녕하세요, ${bizRegion}에서 ${bizCategory} 운영 중인 ${bizName} 사장입니다. ${topKeyword}을(를) 찾으시는 분이 있으시다면 도움이 될 것 같아 답글 남깁니다. 저희 가게는 ${bizRegion} 내에 위치해 있고, 지도에서 '${bizName}' 검색하시면 바로 찾으실 수 있습니다. (사업주 작성)`
                    : `안녕하세요, ${bizRegion} ${bizCategory} ${bizName} 사장입니다. 저희 정보가 도움이 될 것 같아 소개드립니다. 지도 검색 '${bizName}'으로 바로 찾으실 수 있습니다. (사업주 작성)`,
                },
                {
                  key: 'knowledge',
                  icon: '💬',
                  title: '네이버 지식인',
                  approach: '이미 올라온 질문에 답변 — AI가 지식인 데이터를 학습합니다',
                  hint: topKeyword
                    ? `"${bizRegion}에서 ${topKeyword} ${bizCategory} 어디가 좋나요?" 같은 질문 검색 후 답변`
                    : `"${bizRegion} ${bizCategory} 추천" 질문에 답변`,
                  text: topKeyword
                    ? `${bizRegion}에서 ${topKeyword}을(를) 잘하는 ${bizCategory}을(를) 찾으신다면 '${bizName}' 추천드립니다. ${bizRegion} 내에 위치하고 있으며 지도에서 바로 검색 가능합니다. (답변자: 해당 가게 사업주)`
                    : `${bizRegion} ${bizCategory}을(를) 찾으신다면 '${bizName}' 참고해보세요. 지도 검색으로 바로 찾을 수 있습니다. (답변자: 해당 가게 사업주)`,
                },
                {
                  key: 'instagram',
                  icon: '📸',
                  title: isCreative ? '인스타그램 — 포트폴리오' : isFashion ? '인스타그램 — 스타일 룩북' : isService ? '인스타그램 — 작업 전후 사진' : '인스타그램 위치 태그',
                  approach: isCreative
                    ? '작업물 포트폴리오 — 실력이 곧 마케팅, Google 이미지 검색에 반영'
                    : isFashion
                      ? '착용 사진 + 아이템 태그 — 패션 업종 필수 채널'
                      : isService
                        ? '작업 전후 사진 — 고객 신뢰 구축에 효과적'
                        : '위치 태그 + 해시태그 조합 — Google 이미지 검색에 반영',
                  hint: '가게 위치를 태그하고 지역 해시태그 3개 이상 포함',
                  text: topKeyword
                    ? `${bizRegion} ${bizCategory} ${bizName} 🏪\n\n${topKeyword} 찾으시는 분들께 추천드려요.\n\n위치 태그 📍${bizName}\n\n#${bizRegion.replace(/\s+/g, '')} #${bizCategory} #${topKeyword.replace(/\s+/g, '')} #${bizName.replace(/\s+/g, '')}`
                    : `${bizRegion} ${bizCategory} ${bizName} 🏪\n\n지역 주민들이 자주 찾는 가게입니다.\n\n위치 태그 📍${bizName}\n\n#${bizRegion.replace(/\s+/g, '')} #${bizCategory} #${bizName.replace(/\s+/g, '')}`,
                },
              ]
            }

            return (
              <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Share2 className="w-4 h-4 text-indigo-500" />
                  <div className="text-sm font-semibold text-gray-900">
                    {isMedical ? '외부 언급 3채널 (지식인·건강 카페·블로그)' :
                     isBeauty ? '외부 언급 3채널 (뷰티 카페·인스타·지식인)' :
                     isFitness ? '외부 언급 3채널 (운동 카페·인스타·지식인)' :
                     isEducation ? '외부 언급 3채널 (학부모 카페·지식인·블로그)' :
                     isPet ? '외부 언급 3채널 (반려동물 카페·인스타·지식인)' :
                     isFoodDrink ? '외부 언급 3채널 (맘카페·지식인·인스타)' :
                     '외부 언급 3채널 (지역 카페·지식인·인스타)'}
                  </div>
                  <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">이번 달</span>
                </div>
                <p className="text-sm text-gray-500 mb-3 leading-relaxed">
                  AI는 여러 곳에서 언급되는 가게를 신뢰합니다. 각 채널마다 접근법이 다릅니다 — 본인 상황에 맞는 채널 1~2개만 골라 시도해 보세요.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                  <p className="text-sm text-amber-700 leading-relaxed">
                    ⚠️ 반드시 <strong>사업주 신분을 밝히세요</strong>. 고객인 척 후기를 올리면 네이버 정책 위반·공정위 기만광고에 해당할 수 있습니다.
                  </p>
                </div>
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <div key={ch.key} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-lg shrink-0">{ch.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{ch.title}</p>
                          <p className="text-base text-gray-500 leading-relaxed mt-0.5">{ch.approach}</p>
                        </div>
                      </div>
                      <p className="text-sm text-indigo-600 mb-2 pl-7">💡 {ch.hint}</p>
                      <div className="bg-white rounded-lg p-3 pl-7">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700">바로 붙여넣기 가능한 초안</span>
                          <CopyButton text={ch.text} />
                        </div>
                        <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed break-keep">{ch.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

        </div>
      )}

      {/* ── 탭 2: 이번 주 할 것 ── */}
      {activeTab === 'week' && (
        <div className="space-y-5">
          {/* 성장 단계 — 항상 펼쳐짐 (핵심 정보) */}
          {gapLoading && !growthStage ? (
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ) : growthStage ? (
            <>
              <GrowthStageCard stage={growthStage} />
              {/* 다음 단계 링크 */}
              <div className="text-right -mt-2">
                <a href="/competitors" className="text-sm font-semibold text-blue-600 hover:underline">
                  경쟁사와 비교해보기 →
                </a>
              </div>

              {/* 2주 실행 플랜 */}
              <TwoWeekPlanSection
                growthStage={growthStage}
                missingKeywords={keywordGap?.missing_keywords ?? []}
                bizId={business.id}
                bizName={business.name}
                region={region}
                category={category}
              />

              {/* 이달의 소식 아이디어 */}
              <ContentCalendarSection category={category} />
            </>
          ) : null}

          {/* 이번 주 미션 */}
          <ThisWeekMissionCard
            mission={thisWeekMission}
            fallbackPriority={guide.priority_json}
          />

          {/* 완료 체크리스트 진행률 */}
          <ChecklistProgress
            total={itemsJson.length}
            checked={checked.size}
            onRescan={handleRescan}
            scanRequested={scanRequested}
          />

          {/* 4주 로드맵 */}
          {weeklyRoadmap.length > 0 && (
            <WeeklyRoadmapSection
              roadmap={weeklyRoadmap}
              guideGeneratedAt={guide.generated_at}
            />
          )}

          {/* 아무도 안 쓰는 기회 키워드 상세 분석 */}
          {keywordGap && (keywordGap.pioneer_keywords?.length ?? 0) > 0 && authToken && (
            <PioneerDetailSection bizId={business.id} token={authToken ?? ""} />
          )}
        </div>
      )}

      {/* ── 탭 3: 전체 라이브러리 ── */}
      {activeTab === 'library' && (
        <div className="space-y-5">
          {/* 실제 스캔 수치 카드 — DB에서 가져온 hard data */}
          {guide.tools_json?.scan_snapshot && (
            <ScanSnapshotCard snapshot={guide.tools_json.scan_snapshot} isInactive={isTabInactive} />
          )}

          {/* AI 가이드 요약 — summary가 raw JSON일 경우 안전 처리 */}
          {(() => {
            const raw = guide.summary || ''
            let displaySummary = raw
            if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
              try {
                const parsed = JSON.parse(raw)
                displaySummary = parsed?.summary || ''
              } catch { displaySummary = '' }
            }
            if (!displaySummary || displaySummary.length < 5) {
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5">
                  <div className="text-sm font-medium text-amber-800 mb-1">가이드 재생성 필요</div>
                  <p className="text-sm text-amber-700">이전에 생성된 가이드 데이터를 불러오지 못했습니다. 상단의 <strong>가이드 생성</strong> 버튼을 눌러 새 가이드를 받아보세요.</p>
                </div>
              )
            }
            return (
              <div className="bg-blue-50 rounded-2xl p-4 md:p-5">
                <div className="text-sm font-medium text-blue-900 mb-2">AI 가이드 요약</div>
                <p className="text-blue-800 text-base leading-relaxed">{simplify(displaySummary)}</p>
                {guide.next_month_goal && (
                  <p className="text-sm text-blue-600 mt-2 font-medium">목표: {guide.next_month_goal}</p>
                )}
              </div>
            )
          })()}

          {/* 키워드 갭 현황 — 항상 펼쳐짐 (핵심 정보) */}
          {keywordGap && (
            <>
              <KeywordGapCard
                gap={keywordGap}
                bizId={business.id}
                volumes={keywordVolumes}
                volLoading={volLoading}
                currentPlan={currentPlan}
                highlightKeyword={highlightKeyword}
                accessToken={authToken ?? ''}
                onChange={() => { fetchGapData() }}
              />
              {/* 다음 단계: FAQ 만들기 */}
              {(keywordGap.missing_keywords?.length ?? 0) > 0 && (
                <div className="text-right -mt-2">
                  <button
                    onClick={() => { setActiveTab('now'); setShowBriefingPaths(true) }}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    이 키워드로 FAQ 만들기 →
                  </button>
                </div>
              )}
            </>
          )}

          {/* 나머지 즉시 도구 (소식 초안 + 키워드 목록 + QR 카드) */}
          <QuickToolsSection tools={tools} businessId={business.id} token={authToken} />

          {/* 섹션 B: 커뮤니티 글 초안 */}
          {briefingPaths.length > 0 && (
            <CommunityDraftsSection paths={briefingPaths} />
          )}

          {/* 외부 플랫폼 체크리스트 (섹션 C·D 포함) */}
          <ExternalPlatformChecklist
            bizId={business.id}
            bizName={business.name}
            bizRegion={region}
            naverMapUrl={tools.naver_map_url}
          />

          {/* 이번 주 소식 초안 */}
          <WeeklyPostDraftSection businessId={business.id} token={authToken} />

          {/* 내 가게를 위한 블로그 주제 아이디어 — AI 자동 생성 */}
          <BlogTopicsSection bizId={business.id} token={authToken} plan={currentPlan} />

          {/* 우리 지역 TOP5 소개글 초안 — 경쟁사 데이터 기반 리스트형 */}
          <ListContentSection
            bizId={business.id}
            token={authToken}
            region={region}
            category={category}
            bizName={business.name}
          />

          {/* 스마트플레이스 현황 업데이트 */}
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

          {/* Claude 가이드 전체 항목 */}
          {itemsJson.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-semibold text-gray-900">전체 개선 항목 ({itemsJson.length}개)</span>
              </div>
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
          {itemsJson.length === 0 && guide && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-center">
              <p className="text-sm text-amber-700 font-medium mb-1">개선 항목이 없습니다</p>
              <p className="text-sm text-amber-600">가이드 생성 중 오류가 발생했을 수 있습니다. <strong>가이드 재생성</strong>을 눌러 다시 받아보세요.</p>
            </div>
          )}

          {/* FAQ 섹션 */}
          {spFaqs.length > 0 && (
            <FAQSection faqs={spFaqs} title="소개글 하단 추가용 Q&A" />
          )}
          {aiFaqs.length > 0 && (
            <FAQSection faqs={aiFaqs} title="AI 검색 최적화 FAQ" />
          )}
          {spFaqs.length === 0 && aiFaqs.length === 0 && guide && (
            <div className="bg-gray-50 rounded-xl px-4 py-4 text-center">
              <p className="text-sm text-gray-500">아직 FAQ가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-1">"오늘 활용" 탭에서 스마트플레이스 Q&A 초안을 생성하면 여기에 표시됩니다.</p>
            </div>
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
  const searchParams = useSearchParams()
  const highlightKeyword = searchParams.get('keyword')
  const [guide, setGuide] = useState<Guide | null>(initialGuide)
  const [loading, setLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [lastCheckedDate, setLastCheckedDate] = useState<Date | null>(null)
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
  const [showGuideDetail, setShowGuideDetail] = useState(true)

  // AI 브리핑 게이팅 (v4.1) — business.is_franchise 기반
  const briefingEligibility = getBriefingEligibility(
    business.category ?? category,
    !!business.is_franchise,
  )
  const isBriefingInactive = briefingEligibility !== "active"
  const isBriefingLikely   = briefingEligibility === "likely"

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
        const { getSafeSession } = await import('@/lib/supabase/client')
        const session = await getSafeSession()
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
      const { getSafeSession } = await import('@/lib/supabase/client')
      const session = await getSafeSession()
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

  // 키워드 검색량 fetch — missing_keywords 기준으로 최대 5개 요청
  useEffect(() => {
    if (!guide) return
    let cancelled = false
    const fetchVols = async () => {
      // keywordGap이 로딩 완료될 때까지 잠깐 대기 후 재시도하므로
      // 이 effect는 keywordGap 변화에도 반응하도록 별도 로직에서 호출
      setVolLoading(true)
      try {
        const volToken = await getToken()
        // 1차 시도: keyword-volumes 엔드포인트 (biz_id 기반 전체 조회)
        const res1 = await fetch(`${BACKEND}/api/report/keyword-volumes/${business.id}`, {
          headers: volToken ? { Authorization: `Bearer ${volToken}` } : {},
        })
        if (res1.ok && !cancelled) {
          const data = await res1.json() as Record<string, unknown>
          // 응답이 { volumes: { keyword: number } } 또는 { keyword: { monthly_total: number } }
          const raw = data?.volumes ?? data
          if (typeof raw === 'object' && raw !== null) {
            const mapped: Record<string, { monthly_total: number }> = {}
            for (const [kw, val] of Object.entries(raw)) {
              if (typeof val === 'number') {
                mapped[kw] = { monthly_total: val }
              } else if (typeof val === 'object' && val !== null && 'monthly_total' in val) {
                mapped[kw] = val as { monthly_total: number }
              }
            }
            setKeywordVolumes(mapped)
          }
        }
      } catch {}
      if (!cancelled) setVolLoading(false)
    }
    fetchVols()
    return () => { cancelled = true }
  }, [guide?.id, business.id, getToken])

  // missing_keywords 확보 후 keyword-volume API로 보완 (NAVER_SEARCHAD 연동)
  useEffect(() => {
    if (!keywordGap?.missing_keywords?.length) return
    let cancelled = false
    const fetchVolsByKeywords = async () => {
      try {
        const volToken = await getToken()
        const missingKws = keywordGap.missing_keywords.slice(0, 5).join(',')
        const url = `${BACKEND}/api/report/keyword-volume?keywords=${encodeURIComponent(missingKws)}&biz_id=${business.id}`
        const res = await fetch(url, {
          headers: volToken ? { Authorization: `Bearer ${volToken}` } : {},
        })
        if (res.ok && !cancelled) {
          const data = await res.json() as { volumes?: Record<string, number> }
          const raw = data?.volumes ?? {}
          if (Object.keys(raw).length > 0) {
            setKeywordVolumes((prev) => {
              const next = { ...prev }
              for (const [kw, val] of Object.entries(raw)) {
                if (typeof val === 'number' && val > 0) {
                  next[kw] = { monthly_total: val }
                }
              }
              return next
            })
          }
        }
      } catch {}
    }
    fetchVolsByKeywords()
    return () => { cancelled = true }
  }, [keywordGap?.missing_keywords, business.id, getToken])

  const toggleCheck = (rank: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      const wasChecked = next.has(rank)
      if (wasChecked) next.delete(rank)
      else {
        next.add(rank)
        // 새로 체크된 경우 날짜 기록 (7일 후 확인 메시지용)
        setLastCheckedDate(new Date())
      }
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
      const { getSafeSession } = await import('@/lib/supabase/client')
      const session = await getSafeSession()
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
      const { getSafeSession: _gs } = await import('@/lib/supabase/client')
      const _sess = await _gs()
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

  // 지금 당장 할 일 1가지 (briefingPaths에서 첫 번째, 없으면 thisWeekMission 제목)
  const heroTask = (() => {
    const paths: BriefingPath[] = guide?.tools_json?.direct_briefing_paths ?? []
    if (paths.length > 0) return paths[0].what_to_do || paths[0].label
    const mission = guide?.tools_json?.this_week_mission
    if (mission) return mission.title
    const priority = guide?.priority_json?.[0]
    if (priority) return priority
    return null
  })()
  const heroReadyText = guide?.tools_json?.direct_briefing_paths?.[0]?.ready_text ?? null
  const heroTime = guide?.tools_json?.direct_briefing_paths?.[0]?.time_required ?? '5분'

  return (
    <PlanGate requiredPlan="basic" currentPlan={currentPlan} feature="AI 개선 가이드">
      <div className="space-y-4">

        {/* ── 상단: 가이드 생성 버튼 + 사용량 ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-bold text-gray-900">가이드</span>
            {guide && (
              <p className="text-sm text-gray-400">
                {new Date(guide.generated_at).toLocaleDateString('ko-KR')} 생성
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
                {guideLimit >= 999 ? `이번 달 ${guideUsed}회 사용 (무제한)` : `이번 달 ${guideUsed}/${guideLimit}회 사용`}
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              id="guide-generate-btn"
              onClick={generateGuide}
              disabled={loading || !latestScanId || guideExhausted}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
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
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="text-center mb-2">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-700 font-semibold mb-1">Claude AI가 가이드를 만들고 있어요... ({elapsedSeconds}초)</p>
              <p className="text-gray-400 text-sm">
                {elapsedSeconds < 10 ? '보통 10~30초 소요됩니다' :
                 elapsedSeconds < 25 ? '거의 다 됐습니다...' :
                 '조금만 더 기다려주세요...'}
              </p>
            </div>
            <div className="animate-pulse space-y-3">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-5/6" />
              <div className="h-4 bg-gray-100 rounded w-4/6" />
              <div className="h-5 bg-gray-200 rounded w-2/5 mt-2" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        )}

        {/* ── Hero: 지금 당장 할 일 1가지 ── */}
        {guide && !loading && heroTask && (
          <div className="bg-blue-600 text-white rounded-2xl p-5 md:p-6">
            <p className="text-sm font-medium text-blue-200 mb-2">지금 당장 할 일 1가지</p>
            <h3 className="text-lg md:text-xl font-bold mb-3 leading-snug">{heroTask}</h3>
            {heroReadyText && (
              <div className="bg-white/15 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-blue-100">복사해서 바로 붙여넣기</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(heroReadyText).catch(()=>{})}
                    className="text-sm bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg transition-colors"
                  >
                    복사
                  </button>
                </div>
                <p className="text-base text-white leading-relaxed whitespace-pre-wrap">{heroReadyText}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-200">예상 소요: {heroTime}</span>
              <a
                href="https://smartplace.naver.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                스마트플레이스 바로 가기 →
              </a>
            </div>
          </div>
        )}

        {/* ── 사업장 현황 분석 (항상 표시) ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">내 사업장 현황 분석</span>
            <span className="text-sm bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">NEW</span>
          </div>
          <AICitationHighlight businessId={business.id} authToken={authToken} currentPlan={currentPlan} />
          <KeywordCompletenessGauge businessId={business.id} authToken={authToken} currentPlan={currentPlan} />
          <CompetitorKeywordAlert businessId={business.id} authToken={authToken} currentPlan={currentPlan} />
          <ActionTimelineCard businessId={business.id} authToken={authToken} currentPlan={currentPlan} />
        </div>

        {/* AI 브리핑 게이팅 안내 배너 (v4.1) — INACTIVE/LIKELY 업종 대상 */}
        {isBriefingInactive && (
          <div className={`rounded-2xl border px-4 md:px-5 py-4 flex items-start gap-3 ${
            isBriefingLikely ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"
          }`}>
            <span className="text-xl shrink-0 mt-0.5">
              {business.is_franchise ? "🏢" : isBriefingLikely ? "🔮" : "ℹ️"}
            </span>
            <div className="flex-1 min-w-0">
              {business.is_franchise ? (
                <>
                  <p className="text-base font-bold text-gray-900 mb-1">
                    프랜차이즈 가맹점은 현재 AI 브리핑 비대상입니다
                  </p>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    네이버 공식: 프랜차이즈 업종은 현재 AI 브리핑 제공 대상에서 제외됩니다(추후 확대 예정).
                    그동안 아래 가이드는 <strong>ChatGPT·Gemini·Google·네이버 일반 검색 노출</strong>에 동일하게 효과적입니다.
                  </p>
                </>
              ) : isBriefingLikely ? (
                <>
                  <p className="text-base font-bold text-gray-900 mb-1">
                    이 업종은 AI 브리핑 확대 예상 업종입니다
                  </p>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    미리 아래 가이드를 완료해두면 확대 즉시 노출됩니다.
                    현재도 ChatGPT·Gemini·Google AI 노출에 직접 효과적입니다.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-gray-900 mb-1">
                    현재 비대상 업종 — 아래 가이드는 모든 AI 채널에 효과적입니다
                  </p>
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    네이버 AI 브리핑은 음식점·카페·숙박 중심이지만, 아래 개선 항목은
                    <strong> ChatGPT·Gemini·Google·카카오맵 노출</strong>에 동일하게 효과적입니다.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        {!isBriefingInactive && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 md:px-5 py-3 flex items-start gap-3">
            <span className="text-green-500 text-xl shrink-0 mt-0.5">✅</span>
            <p className="text-base font-semibold text-green-800">이 업종은 네이버 AI 브리핑 노출 대상입니다. 아래 가이드로 노출 확률을 높이세요.</p>
          </div>
        )}

        {/* AI 브리핑 노출 상태 (스캔 결과 기반, ACTIVE 업종만) */}
        {!isBriefingInactive && guide && !loading && latestScanMentioned === false && (
          <div className="bg-orange-50 border border-orange-300 rounded-2xl px-4 md:px-5 py-4 flex items-start gap-3">
            <span className="text-orange-500 text-xl shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="text-base font-bold text-orange-800 mb-1">현재 네이버 AI 브리핑에 노출되지 않고 있습니다</p>
              <p className="text-base text-orange-700 leading-relaxed">
                아래 가이드를 따라 실천하면 AI 브리핑에 노출될 가능성이 높아집니다.
                가이드 내 "노출됩니다" 표현은 개선 후 기대 효과입니다.
              </p>
            </div>
          </div>
        )}
        {!isBriefingInactive && guide && !loading && latestScanMentioned === true && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 md:px-5 py-3 flex items-start gap-3">
            <span className="text-green-500 text-xl shrink-0 mt-0.5">✅</span>
            <p className="text-base font-semibold text-green-800">현재 네이버 AI 브리핑에 노출 중입니다! 아래 가이드로 빈도를 더 높이세요.</p>
          </div>
        )}

        {guide && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowGuideDetail((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div>
                <p className="text-base font-bold text-gray-800">상세 가이드 도구 모음</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {isBriefingInactive
                    ? "AI 검색 노출 관리 · 리뷰 답변 · 키워드 현황 · FAQ · 체크리스트"
                    : "AI 브리핑 관리 · 리뷰 답변 · 키워드 현황 · FAQ · 체크리스트"}
                </p>
              </div>
              {showGuideDetail
                ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
              }
            </button>
            <div className={`border-t border-gray-100 ${showGuideDetail ? 'block' : 'hidden'}`}>
              <div className="p-4">
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
                  highlightKeyword={highlightKeyword}
                  region={region}
                  category={category}
                  briefingEligibility={briefingEligibility}
                />
              </div>
            </div>
          </div>
        )}

        {/* 실행 완료 → 7일 후 확인 루프 메시지 */}
        {checked.size > 0 && lastCheckedDate && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="text-emerald-500 text-lg shrink-0">✅</span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-emerald-800 mb-1">
                  실행 완료! {checked.size}개 항목을 완료했습니다
                </p>
                <p className="text-base text-emerald-700 leading-relaxed">
                  {new Date(lastCheckedDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}(7일 후)에 점수 변화를 확인해드립니다.
                  그때 스캔 결과를 보러 오세요.
                </p>
              </div>
              <a
                href="/dashboard"
                className="shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                대시보드 바로가기 →
              </a>
            </div>
          </div>
        )}

        {!guide && !loading && (
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm">
            <Lightbulb className="w-10 h-10 text-yellow-400 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-700 font-medium mb-2">아직 개선 가이드가 없습니다.</p>
            <p className="text-sm text-gray-500 mb-2 leading-relaxed">
              {latestScanId
                ? "위의 '가이드 생성하기' 버튼을 눌러주세요."
                : '먼저 대시보드에서 AI 스캔을 실행해주세요.'}
            </p>
            {latestScanId && (
              <>
                <p className="text-sm text-gray-500 mb-1 leading-relaxed">
                  AI 스캔 결과를 바탕으로 맞춤 가이드를 만들어 드립니다.
                </p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  생성에 약 30초 소요됩니다.
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">다음 단계</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a
              href="/dashboard"
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <div>
                <p className="text-base font-semibold text-gray-800">스캔 재실행</p>
                <p className="text-sm text-gray-400 mt-0.5">대시보드에서 최신 결과 확인</p>
              </div>
              <RefreshCw className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0" />
            </a>
            <a
              href="/competitors"
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <div>
                <p className="text-base font-semibold text-gray-800">경쟁사 분석</p>
                <p className="text-sm text-gray-400 mt-0.5">내 가게와 경쟁사 비교</p>
              </div>
              <TrendingUp className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0" />
            </a>
            <a
              href="/report"
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
            >
              <div>
                <p className="text-base font-semibold text-gray-800">점수 현황</p>
                <p className="text-sm text-gray-400 mt-0.5">AI 노출 점수 상세 리포트</p>
              </div>
              <Star className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </PlanGate>
  )
}
