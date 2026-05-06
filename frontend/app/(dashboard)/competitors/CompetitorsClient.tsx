'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSafeSession } from '@/lib/supabase/client'
import {
  Users, Search, Plus, Lock, Star, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Target, Award, BarChart2, AlertCircle,
  MapPin, Trash2, RefreshCw, Share2, Crown, Zap, Shield, CheckCircle2,
  Info, ArrowRight, Building2, PlayCircle, Clock, X, Pencil, Pin,
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { CompetitorPlaceCard } from '@/components/competitors/CompetitorPlaceCard'
import { ScanProgress } from '@/components/scan/ScanProgress'
import { syncCompetitorPlace } from '@/lib/api'
import CompetitorTimeline from '@/components/dashboard/CompetitorTimeline'
import { KeywordManagerModal } from '@/components/dashboard/KeywordManagerModal'
import { Settings as SettingsIcon } from 'lucide-react'
import { GapAnalysisCard } from '@/components/dashboard/GapAnalysisCard'
import PioneerKeywordsCard from '@/app/(dashboard)/competitors/PioneerKeywordsCard'
import CompetitorKeywordCompare from '@/components/dashboard/CompetitorKeywordCompare'
import { PlaceCompareTable } from '@/components/dashboard/PlaceCompareTable'
import type { GapAnalysis } from '@/types/gap'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Business { id: string; name: string; category: string; region: string }
interface Competitor {
  id: string
  name: string
  address?: string
  naver_place_id?: string
  lat?: number | null
  lng?: number | null
  place_review_count?: number | null
  place_avg_rating?: number | null
  place_has_faq?: boolean
  place_has_recent_post?: boolean
  place_has_menu?: boolean
  place_photo_count?: number | null
  place_synced_at?: string | null
  // 신규 필드 (v3.1)
  blog_mention_count?: number | null
  website_url?: string | null
  website_seo_score?: number | null
  website_seo_result?: Record<string, boolean | number | string> | null
  comp_keywords?: Record<string, string[]> | null
  detail_synced_at?: string | null
  // 신규 필드 (v5.5)
  place_has_intro?: boolean
  ai_excerpt?: string | null
  faq_questions?: string[] | null
  // 신규 필드 (v5.6)
  weakness_data?: {
    competitor_name: string
    total_posts_analyzed: number
    has_weakness: boolean
    weaknesses: Array<{ keyword: string; count: number; opportunity: string }>
    recent_posts?: Array<{ title: string; link: string; pubDate: string }>
  } | null
}
interface Suggestion { name: string; address: string; phone?: string; category_name?: string; ai_competitor?: boolean }
interface SearchResult {
  name: string
  address: string
  category: string
  phone: string
  naver_url: string
  naver_place_id?: string
  kakao_url?: string
  google_url?: string
  lat?: string
  lng?: string
  source?: string
}

declare global {
  interface Window {
    navermap_authFailure?: () => void
    _naverMapReady?: () => void
    naver?: {
      maps: {
        Map: new (el: HTMLElement, opts: object) => NaverMap
        Marker: new (opts: object) => NaverMarker
        LatLng: new (lat: number, lng: number) => NaverLatLng
        LatLngBounds: new () => NaverBounds
        InfoWindow: new (opts: object) => NaverInfoWindow
        Event: { addListener(target: object, event: string, handler: () => void): void }
      }
    }
  }
}
interface NaverMap {
  setCenter(latlng: NaverLatLng): void
  fitBounds(bounds: NaverBounds): void
}
interface NaverMarker { setMap(map: NaverMap | null): void }
interface NaverLatLng { lat(): number; lng(): number }
interface NaverBounds { extend(latlng: NaverLatLng): void; isEmpty(): boolean }
interface NaverInfoWindow { open(map: NaverMap, marker: NaverMarker): void; close(): void }

interface TrendScan {
  scanned_at: string
  total_score: number
  competitor_scores: Record<string, { name: string; score: number; mentioned: boolean }> | null
}
interface CompetitorScore {
  name: string
  mentioned: boolean
  score: number
  excerpt?: string
  breakdown: { [key: string]: number }
}

const TRACK1_ESTIMATED_NOTE = '경쟁사 데이터는 Gemini AI 단일 스캔 기반 추정값입니다'
const TRACK1_LABELS: Record<string, string> = {
  keyword_gap_score:        '키워드 커버리지 (추정)',
  review_quality:           '리뷰·평점 (추정)',
  smart_place_completeness: '스마트플레이스 완성도 (추정)',
  naver_exposure_confirmed: '네이버 AI 브리핑 노출 (추정)',
}
const TRACK2_LABELS: Record<string, string> = {
  multi_ai_exposure:  'AI 검색 노출 (추정)',
  schema_seo:         '웹사이트 구조화 (추정)',
  online_mentions_t2: '온라인 언급 수 (추정)',
  google_presence:    'Google AI 노출 (추정)',
}
const LEGACY_LABELS: Record<string, string> = {
  exposure_freq:     'AI 노출',
  schema_score:      'AI 코드',
  online_mentions:   '온라인 언급',
  info_completeness: '정보 완성도',
  content_freshness: '최신성',
}
const BREAKDOWN_LABELS: Record<string, string> = {
  ...TRACK1_LABELS, ...TRACK2_LABELS, ...LEGACY_LABELS,
}
const TRACK1_KEYS = Object.keys(TRACK1_LABELS)
const TRACK2_KEYS = Object.keys(TRACK2_LABELS)

function sortBreakdownEntries(entries: [string, number][]): [string, number][] {
  const order = [...TRACK1_KEYS, ...TRACK2_KEYS]
  return [
    ...order.filter(k => entries.some(([ek]) => ek === k)).map(k => entries.find(([ek]) => ek === k)!),
    ...entries.filter(([k]) => !order.includes(k)),
  ]
}

const PLAN_RANK: Record<string, number> = {
  free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3,
}

const PLAN_COMPETITOR_LIMIT: Record<string, number> = {
  free: 0, basic: 3, startup: 5, pro: 10, biz: 999,
}
function planAtLeast(current: string, required: string): boolean {
  return (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[required] ?? 99)
}

// 점수 색상 유틸
function getScoreColor(score: number, compare?: number): string {
  if (compare !== undefined) {
    return score >= compare ? 'text-red-500' : 'text-emerald-600'
  }
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-500'
}
function getScoreBarColor(score: number, compare?: number): string {
  if (compare !== undefined) {
    return score >= compare ? 'bg-red-400' : 'bg-emerald-400'
  }
  if (score >= 70) return 'bg-emerald-400'
  if (score >= 40) return 'bg-amber-400'
  return 'bg-red-400'
}
function getScoreBadgeCls(score: number): string {
  if (score >= 70) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (score >= 40) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

// 순위 배지
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-white font-black text-sm shadow-sm">1</span>
  )
  if (rank === 2) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-white font-black text-sm shadow-sm">2</span>
  )
  if (rank === 3) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-300 text-white font-black text-sm shadow-sm">3</span>
  )
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 font-bold text-sm">{rank}</span>
  )
}

// 잠금 기능 오버레이
function LockedFeature({ requiredPlan, feature }: { requiredPlan: string; feature: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden mt-3">
      <div className="blur-sm pointer-events-none select-none p-4 bg-gray-50 rounded-xl">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center gap-3">
              <div className="h-3 bg-gray-200 rounded w-28" />
              <div className="h-1.5 flex-1 bg-gray-200 rounded-full" />
              <div className="h-3 bg-gray-200 rounded w-10" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm rounded-xl">
        <Lock className="w-5 h-5 text-gray-400 mb-1.5" />
        <p className="text-sm font-semibold text-gray-700">{requiredPlan} 플랜 전용</p>
        <p className="text-sm text-gray-500 mb-3 text-center px-4">{feature}</p>
        <a href="/pricing" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium">
          업그레이드
        </a>
      </div>
    </div>
  )
}

// Free 플랜 미리보기
function FreePlanPreview() {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 rounded-xl p-3 shrink-0">
            <BarChart2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-base md:text-lg font-bold text-blue-900 mb-1">
              경쟁사를 분석하면 이런 정보를 알 수 있어요
            </p>
            <p className="text-sm md:text-base text-blue-700 leading-relaxed">
              내 가게와 주변 경쟁 가게의 AI 검색 노출 점수를 비교하고, 어디서 격차가 생기는지 파악할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Basic */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-blue-600 px-4 py-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-sm">Basic 플랜</span>
            <span className="ml-auto text-blue-200 text-sm font-medium">월 9,900원</span>
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">경쟁 가게 AI 노출 점수 비교</p>
            <div className="space-y-2 blur-sm pointer-events-none select-none">
              {[{ label: '내 가게', score: 52, color: 'bg-blue-500' }, { label: '경쟁 A', score: 71, color: 'bg-red-400' }, { label: '경쟁 B', score: 38, color: 'bg-emerald-400' }].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span className={item.label === '내 가게' ? 'font-semibold text-blue-700' : ''}>{item.label}</span>
                    <span className={`font-bold ${item.label === '내 가게' ? 'text-blue-700' : item.score >= 70 ? 'text-red-500' : 'text-emerald-600'}`}>{item.score}점</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <a href="/pricing" className="mt-4 block w-full text-center bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
              Basic 시작하기
            </a>
          </div>
        </div>

        {/* Pro */}
        <div className="bg-white rounded-2xl border border-purple-200 shadow-sm overflow-hidden">
          <div className="bg-purple-600 px-4 py-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-sm">Pro 플랜</span>
            <span className="ml-auto text-purple-200 text-sm font-medium">월 18,900원</span>
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">키워드 차이 분석 + 성장 단계 비교</p>
            <div className="space-y-2 blur-sm pointer-events-none select-none">
              <div className="flex flex-wrap gap-1.5">
                {['혼밥', '혼술', '웨이팅'].map(k => (
                  <span key={k} className="bg-red-100 text-red-600 text-sm px-2 py-0.5 rounded-full border border-red-200">{k}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['분위기 맛집', 'SNS 핫플'].map(k => (
                  <span key={k} className="bg-emerald-100 text-emerald-700 text-sm px-2 py-0.5 rounded-full border border-emerald-200">{k}</span>
                ))}
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-sm text-gray-500">
                성장 단계: <span className="font-semibold text-amber-600">안정기</span> → <span className="font-semibold text-emerald-600">성장기</span> 진입 가능
              </div>
            </div>
            <a href="/pricing" className="mt-4 block w-full text-center bg-purple-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-purple-700 transition-colors">
              Pro 시작하기
            </a>
          </div>
        </div>

        {/* Biz */}
        <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 px-4 py-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-sm">Biz 플랜</span>
            <span className="ml-auto text-yellow-100 text-sm font-medium">월 49,900원</span>
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">전체 경쟁 지형도 + AI 채널별 분석</p>
            <div className="space-y-1.5 blur-sm pointer-events-none select-none">
              {[{ name: '내 가게', score: 52, color: 'bg-blue-500' }, { name: '경쟁 A', score: 71, color: 'bg-red-400' }, { name: '경쟁 B', score: 38, color: 'bg-amber-400' }].map(item => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <span className="w-14 text-gray-600 truncate">{item.name}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.score}%` }} />
                  </div>
                  <span className="text-gray-500 w-8 text-right">{item.score}</span>
                </div>
              ))}
            </div>
            <a href="/pricing" className="mt-4 block w-full text-center bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              Biz 시작하기
            </a>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-5 md:p-6 text-center">
        <p className="text-white font-bold text-base md:text-lg mb-1">지금 시작하면 14일 무료 체험</p>
        <p className="text-gray-400 text-sm mb-4">신용카드 없이 시작, 언제든지 취소 가능</p>
        <a href="/pricing" className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-gray-100 transition-colors">
          요금제 보기 <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}

// AI 경쟁 현황 카드
function GapCard({
  bizId,
  bizName,
  myScore,
  competitorScores,
  onRequestScan,
}: {
  bizId: string
  bizName: string
  myScore: number
  competitorScores?: Record<string, { score: number; name: string; mentioned: boolean }> | null
  onRequestScan?: () => void
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [enlarged, setEnlarged] = useState(false)
  const autoGenerated = useRef(false)

  // 경쟁사 점수가 모두 비슷한지 감지 (최대-최소 차이 5점 이내, 경쟁사 2개 이상)
  const isScoreSuspect = (() => {
    if (!competitorScores) return false
    const scores = Object.values(competitorScores).map((c) => c.score)
    if (scores.length < 2) return false
    const max = Math.max(...scores)
    const min = Math.min(...scores)
    return max - min <= 5
  })()

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getSafeSession()
      const res = await fetch(`${BACKEND}/api/report/gap-card/${bizId}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) return
      const blob = await res.blob()
      setImgUrl(URL.createObjectURL(blob))
    } finally {
      setLoading(false)
    }
  }, [bizId])

  // 마운트 시 자동 생성 — 새로고침 후에도 카드가 바로 표시됨
  useEffect(() => {
    if (!autoGenerated.current) {
      autoGenerated.current = true
      void generate()
    }
  }, [generate])

  const handleShare = async () => {
    if (!imgUrl) return
    try {
      const res = await fetch(imgUrl)
      const blob = await res.blob()
      const file = new File([blob], 'gap_card.png', { type: 'image/png' })
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${bizName} AI 경쟁 현황` }).catch(() => {})
      } else {
        const a = document.createElement('a')
        a.href = imgUrl
        a.download = 'gap_card.png'
        a.click()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // 공유 취소 무시
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-gray-500" />
          <div>
            <div className="text-sm font-semibold text-gray-700">AI 경쟁 현황 카드</div>
            <div className="text-sm text-gray-400">카카오톡·SNS 공유용 이미지</div>
          </div>
        </div>
        {loading && (
          <span className="text-sm text-gray-400 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />생성 중...
          </span>
        )}
      </div>
      {imgUrl && (
        <div className="space-y-3">
          {/* 카드 이미지 미리보기 — 클릭하면 확대 */}
          <div
            className="relative rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in group bg-gray-50"
            onClick={() => setEnlarged(true)}
          >
            <img
              src={imgUrl}
              alt="경쟁 현황 카드"
              className="w-full h-auto block max-h-52 object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <span className="bg-white/95 text-gray-800 text-sm font-semibold px-3 py-1.5 rounded-lg shadow">
                크게 보기
              </span>
            </div>
          </div>
          {/* 버튼 영역 */}
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 text-sm bg-amber-400 text-gray-900 font-semibold py-2.5 rounded-xl hover:bg-amber-500 transition-colors flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              {copied ? '저장됨 ✓' : '카카오톡·SNS 공유'}
            </button>
            <button
              onClick={() => { setImgUrl(null); generate() }}
              className="text-sm border border-gray-200 text-gray-500 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              title="카드 새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {isScoreSuspect && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-1">경쟁사 점수가 비슷하게 나타납니다.</p>
                <p>처음 등록된 경쟁사는 기본 점수(약 30점)로 시작합니다. AI 스캔을 실행하면 각 경쟁사의 실제 점수가 계산됩니다.</p>
                {onRequestScan && (
                  <button
                    onClick={onRequestScan}
                    className="mt-2 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    지금 AI 스캔 실행
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* 확대 라이트박스 */}
      {enlarged && imgUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setEnlarged(false)}
        >
          <img
            src={imgUrl}
            alt="경쟁 현황 카드 확대"
            className="max-w-[95vw] max-h-[95vh] rounded-xl shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold leading-none hover:text-gray-300"
            onClick={() => setEnlarged(false)}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}



interface Props {
  business: Business
  competitors: Competitor[]
  myScore: number
  myReviewCount?: number
  myAvgRating?: number
  myBlogMentions?: number
  userId: string
  trendScans?: TrendScan[]
  competitorScores?: Record<string, CompetitorScore> | null
  lastScannedAt?: string | null
  currentPlan?: string
  planLimit?: number
  accessToken?: string
  gapAnalysis?: GapAnalysis | null
}

// ── 인라인 스캔 모달 ──
// 경쟁사 페이지에서 대시보드 이동 없이 직접 AI 스캔을 실행합니다.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

function InlineScanModal({
  businessId,
  onClose,
  onComplete,
}: {
  businessId: string
  onClose: () => void
  onComplete: () => void
}) {
  const [step, setStep] = useState<'idle' | 'loading' | 'scanning' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [enrichMsg, setEnrichMsg] = useState('')
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  const startScan = async () => {
    setStep('loading')
    setErrorMsg('')
    try {
      const session = await getSafeSession()
      if (!session?.access_token) {
        setErrorMsg('로그인이 필요합니다.')
        setStep('error')
        return
      }
      const prepRes = await fetch(
        `${BACKEND_URL}/api/scan/stream/prepare?biz_id=${encodeURIComponent(businessId)}`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (!prepRes.ok) {
        const err = await prepRes.json().catch(() => ({}))
        const code = err?.detail?.code
        if (code === 'SCAN_IN_PROGRESS') setErrorMsg('이미 스캔이 진행 중입니다. 잠시 후 다시 시도해주세요.')
        else if (code === 'SCAN_LIMIT' || code === 'SCAN_DAILY_LIMIT') setErrorMsg('오늘 수동 스캔 횟수를 모두 사용했습니다.')
        else if (code === 'PLAN_REQUIRED') setErrorMsg('무료 체험 스캔을 이미 사용했습니다. Basic 이상 플랜이 필요합니다.')
        else setErrorMsg('스캔을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.')
        setStep('error')
        return
      }
      const { stream_token } = await prepRes.json()
      const es = new EventSource(
        `${BACKEND_URL}/api/scan/stream?stream_token=${encodeURIComponent(stream_token)}`
      )
      eventSourceRef.current = es
      setEventSource(es)
      setStep('scanning')
    } catch {
      setErrorMsg('스캔 시작 중 오류가 발생했습니다.')
      setStep('error')
    }
  }

  const handleScanComplete = () => {
    setStep('done')
    setEnrichMsg('경쟁사 AI 분석 중...')
    eventSourceRef.current = null
    setEventSource(null)

    // 백그라운드 competitor_scores 처리 완료를 폴링으로 감지 (최대 30초)
    const startedAt = Date.now()
    const poll = async () => {
      try {
        const session = await getSafeSession()
        const token = session?.access_token ?? ''
        const res = await fetch(
          `${BACKEND_URL}/api/report/score/${businessId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (res.ok) {
          const data = await res.json()
          // competitor_scores가 채워졌으면 완료
          if (data?.competitor_scores && Object.keys(data.competitor_scores).length > 0) {
            setEnrichMsg('결과를 불러옵니다...')
            setTimeout(() => onComplete(), 800)
            return
          }
        }
      } catch { /* ignore */ }
      // 최대 30초 대기 후 강제 완료
      if (Date.now() - startedAt < 30000) {
        pollRef.current = setTimeout(poll, 3000)
      } else {
        setEnrichMsg('결과를 불러옵니다...')
        setTimeout(() => onComplete(), 800)
      }
    }
    pollRef.current = setTimeout(poll, 3000)
  }

  const handleScanError = () => {
    setStep('error')
    eventSourceRef.current = null
    setEventSource(null)
    setErrorMsg('스캔 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      {step === 'scanning' ? (
        <div className="w-full max-w-md">
          <ScanProgress
            eventSource={eventSource}
            onComplete={handleScanComplete}
            onError={handleScanError}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          {step === 'done' ? (
            <>
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-base md:text-lg mb-2 text-center">스캔 완료!</h3>
              <p className="text-sm text-gray-500 text-center">{enrichMsg || '경쟁사 분석 중...'}</p>
              <div className="mt-3 flex justify-center">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <PlayCircle className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-base md:text-lg mb-2 text-center">AI 스캔 실행</h3>
              <p className="text-sm text-gray-500 mb-1 text-center leading-relaxed">
                내 가게와 등록된 경쟁사를 동시에 분석합니다.
              </p>
              <p className="text-sm text-gray-400 mb-5 text-center">약 1~2분 소요됩니다</p>

              {step === 'error' && errorMsg && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 mb-4 border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={startScan}
                  disabled={step === 'loading'}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {step === 'loading' ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />준비 중…</>
                  ) : (
                    <><Zap className="w-4 h-4" />스캔 시작</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// 점수 비교 차트 — 가로 막대 방식 (경쟁사 중첩 문제 해결)
function CompetitorTrendChart({ trendScans, bizName }: { trendScans: TrendScan[]; bizName: string }) {
  if (trendScans.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <div className="text-sm font-semibold text-gray-700">경쟁사 점수 비교</div>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">AI 스캔을 실행하면 경쟁사와의 점수를 비교할 수 있습니다.</p>
      </div>
    )
  }

  // page.tsx에서 DESC 정렬로 오므로 ASC로 재정렬
  const sorted = [...trendScans].sort((a, b) =>
    new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
  )

  const compNames = new Set<string>()
  sorted.forEach(s => {
    if (s.competitor_scores) Object.values(s.competitor_scores).forEach(c => compNames.add(c.name))
  })
  const compList = [...compNames]

  // [0]이 최신 (DESC 정렬)이 아니라 sorted 기준 마지막이 최신
  const latest = sorted[sorted.length - 1]
  const prev   = sorted.length >= 2 ? sorted[sorted.length - 2] : null

  interface EntityRow { name: string; score: number; delta: number | null; isMe: boolean }

  const entities: EntityRow[] = [
    {
      name: bizName,
      score: Math.round(latest.total_score),
      delta: prev ? Math.round(latest.total_score) - Math.round(prev.total_score) : null,
      isMe: true,
    },
    ...compList.map(name => {
      const latestVal = latest.competitor_scores
        ? Object.values(latest.competitor_scores).find(c => c.name === name)?.score ?? 0
        : 0
      const prevVal = prev?.competitor_scores
        ? Object.values(prev.competitor_scores).find(c => c.name === name)?.score ?? null
        : null
      return {
        name,
        score: Math.round(latestVal),
        delta: prevVal !== null ? Math.round(latestVal) - Math.round(prevVal) : null,
        isMe: false,
      }
    }),
  ].sort((a, b) => b.score - a.score)

  const myRank  = entities.findIndex(e => e.isMe) + 1
  const maxScore = Math.max(...entities.map(e => e.score), 10)
  const COMP_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6']
  let compColorIdx = 0

  const latestDate = new Date(latest.scanned_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  const prevDate   = prev ? new Date(prev.scanned_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : null

  return (
    <div className="bg-white rounded-2xl p-3 md:p-4 shadow-sm border border-gray-100">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-500" />
          <div>
            <div className="text-sm font-semibold text-gray-700">경쟁사 점수 비교</div>
            <div className="text-sm text-gray-400">
              {latestDate} 기준{prevDate ? ` · ${prevDate} 대비 변화` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* 가로 막대 차트 — 각 업체가 독립 행으로 표시 */}
      <div className="space-y-2">
        {entities.map((e, i) => {
          const barColor = e.isMe ? '#3b82f6' : COMP_COLORS[compColorIdx++ % COMP_COLORS.length]
          const barPct   = Math.round((e.score / maxScore) * 100)
          return (
            <div key={e.name}>
              <div className="flex items-center gap-2 mb-1">
                <RankBadge rank={i + 1} />
                <span className={`text-sm flex-1 min-w-0 truncate ${e.isMe ? 'font-bold text-blue-700' : 'text-gray-700'}`}>
                  {e.isMe ? `${e.name} (내 가게)` : e.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {e.delta !== null && e.delta !== 0 && (
                    <span className={`text-sm font-bold ${e.delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {e.delta > 0 ? `+${e.delta}` : e.delta}
                    </span>
                  )}
                  <span className={`text-sm font-bold px-1.5 py-0.5 rounded-lg border ${
                    e.isMe ? 'bg-blue-50 text-blue-700 border-blue-200' : getScoreBadgeCls(e.score)
                  }`}>
                    {e.score}점
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 안내 */}
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
        {compList.some(name =>
          !sorted.some(s => s.competitor_scores &&
            Object.values(s.competitor_scores).some(c => c.name === name)
          )
        ) ? (
          <p className="text-sm text-blue-500">※ 스캔 미완료 경쟁사는 다음 스캔 후 그래프에 나타납니다.</p>
        ) : null}
        <p className="text-sm text-gray-400">막대 길이 = 최신 점수 · 숫자 변화량 = 이전 스캔 대비</p>
      </div>
    </div>
  )
}

// 지역 중심 좌표
const REGION_CENTER: Record<string, [number, number]> = {
  '서울': [37.5665, 126.9780], '부산': [35.1796, 129.0756],
  '대구': [35.8714, 128.6014], '인천': [37.4563, 126.7052],
  '광주': [35.1595, 126.8526], '대전': [36.3504, 127.3845],
  '울산': [35.5384, 129.3114], '수원': [37.2636, 127.0286],
  '창원': [35.2280, 128.6811], '고양': [37.6584, 126.8320],
  '용인': [37.2411, 127.1776], '성남': [37.4200, 127.1270],
  '청주': [36.6424, 127.4890], '전주': [35.8242, 127.1480],
  '천안': [36.8151, 127.1139], '안산': [37.3219, 126.8309],
  '안양': [37.3943, 126.9568], '평택': [36.9921, 127.1128],
  '제주': [33.4890, 126.4983], '세종': [36.4800, 127.2890],
}
function getRegionCenter(region: string): [number, number] {
  const city = Object.keys(REGION_CENTER).find(k => region.includes(k))
  return city ? REGION_CENTER[city] : [36.5, 127.8]
}

function CompetitorMap({
  results,
  region,
  registeredCompetitors = [],
}: {
  results: SearchResult[]
  region: string
  registeredCompetitors?: Competitor[]
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const naverMap = useRef<NaverMap | null>(null)
  const markersRef = useRef<NaverMarker[]>([])
  const infoWindowsRef = useRef<NaverInfoWindow[]>([])
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapLoading, setMapLoading] = useState(true)

  useEffect(() => {
    if (!mapRef.current) return

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || '50dxi9xd6i'

    const initMap = () => {
      if (!mapRef.current || !window.naver) return
      setMapLoading(false)
      const nMaps = window.naver.maps
      const center = getRegionCenter(region)

      if (!naverMap.current) {
        naverMap.current = new nMaps.Map(mapRef.current, {
          center: new nMaps.LatLng(center[0], center[1]),
          zoom: 14,
          zoomControl: true,
        })
      } else {
        naverMap.current.setCenter(new nMaps.LatLng(center[0], center[1]))
      }

      // 기존 마커 제거
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
      infoWindowsRef.current.forEach(iw => iw.close())
      infoWindowsRef.current = []

      // 검색 결과 마커 (파란색)
      if (results.length > 0) {
        const bounds = new nMaps.LatLngBounds()
        let boundsHasPoints = false
        results.forEach((r, i) => {
          const rLat = parseFloat(r.lat ?? '')
          const rLng = parseFloat(r.lng ?? '')
          const hasCoord = !isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0
          const angle = (i / Math.max(results.length, 1)) * 2 * Math.PI
          const radius = 0.003 + i * 0.0008
          const lat = hasCoord ? rLat : center[0] + radius * Math.sin(angle)
          const lng = hasCoord ? rLng : center[1] + radius * Math.cos(angle)
          const latlng = new nMaps.LatLng(lat, lng)
          bounds.extend(latlng)
          boundsHasPoints = true

          const marker = new nMaps.Marker({
            position: latlng,
            map: naverMap.current!,
            icon: {
              content: `<div style="width:28px;height:28px;background:#2563eb;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
            },
          })
          const iw = new nMaps.InfoWindow({
            content: `<div style="padding:8px 12px;font-size:13px"><div style="font-weight:600;margin-bottom:2px">${r.name}</div><div style="color:#666;font-size:12px">${r.address}</div></div>`,
          })
          nMaps.Event.addListener(marker, 'click', () => {
            infoWindowsRef.current.forEach(w => w.close())
            iw.open(naverMap.current!, marker)
          })
          markersRef.current.push(marker)
          infoWindowsRef.current.push(iw)
        })
        if (boundsHasPoints) naverMap.current!.fitBounds(bounds)
      }

      // 등록된 경쟁사 마커 (주황색)
      registeredCompetitors.forEach((c) => {
        if (!c.lat || !c.lng) return
        const cLat = parseFloat(String(c.lat))
        const cLng = parseFloat(String(c.lng))
        if (isNaN(cLat) || isNaN(cLng)) return
        const latlng = new nMaps.LatLng(cLat, cLng)
        const marker = new nMaps.Marker({
          position: latlng,
          map: naverMap.current!,
          icon: {
            content: `<div style="width:32px;height:32px;background:#f97316;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35)"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>`,
          },
        })
        const iw = new nMaps.InfoWindow({
          content: `<div style="padding:8px 12px;font-size:13px"><div style="font-weight:600;color:#f97316;margin-bottom:2px">등록된 경쟁사</div><div style="font-weight:600;margin-bottom:1px">${c.name}</div>${c.address ? `<div style="color:#666;font-size:12px">${c.address}</div>` : ''}</div>`,
        })
        nMaps.Event.addListener(marker, 'click', () => {
          infoWindowsRef.current.forEach(w => w.close())
          iw.open(naverMap.current!, marker)
        })
        markersRef.current.push(marker)
        infoWindowsRef.current.push(iw)
      })
    }

    // 네이버 지도 SDK 동적 로드
    const scriptId = 'naver-map-script'

    // 인증 실패 시 호출되는 네이버 전역 콜백
    window.navermap_authFailure = () => {
      setMapError('네이버 지도 API 인증 실패 — NCP 콘솔에서 키 설정을 확인하세요.')
      setMapLoading(false)
    }

    const tryInit = (attempts: number = 50) => {
      if (window.naver?.maps?.Map) {
        initMap()
        return
      }
      if (attempts <= 0) {
        setMapError('지도 초기화 실패 — NCP API 키를 확인하세요.')
        setMapLoading(false)
        return
      }
      setTimeout(() => tryInit(attempts - 1), 100)
    }

    if (window.naver?.maps?.Map) {
      initMap()
    } else if (!document.getElementById(scriptId)) {
      window._naverMapReady = () => {
        delete window._naverMapReady
        tryInit(10)
      }
      const script = document.createElement('script')
      script.id = scriptId
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&callback=_naverMapReady`
      script.async = true
      script.onerror = () => { setMapError('지도 스크립트 로드 실패'); setMapLoading(false) }
      document.head.appendChild(script)
    } else {
      tryInit()
    }
  }, [results, registeredCompetitors, region])

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ height: 220, position: 'relative', zIndex: 0 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {mapLoading && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50" style={{ zIndex: 5 }}>
          <div className="text-center text-gray-500 text-sm">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
            지도 불러오는 중...
          </div>
        </div>
      )}
      {mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', zIndex: 5 }}>
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, padding: '0 16px' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>⚠️</div>
            {mapError}
          </div>
        </div>
      )}
      {registeredCompetitors.some(c => c.lat && c.lng) && (
        <div className="absolute bottom-2 left-2 flex gap-2 z-10 pointer-events-none">
          <span className="flex items-center gap-1 bg-white bg-opacity-90 rounded px-2 py-0.5 text-sm font-medium shadow">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }} />
            검색 결과
          </span>
          <span className="flex items-center gap-1 bg-white bg-opacity-90 rounded px-2 py-0.5 text-sm font-medium shadow">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
            등록된 경쟁사
          </span>
        </div>
      )}
    </div>
  )
}

type AddTab = 'search' | 'manual'

// ========================
// 경쟁사 점수 처리 중 안내 + 자동 새로고침
function CompetitorScoreWaiting({ onRefresh }: { onRefresh: () => void }) {
  const [countdown, setCountdown] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) {
          clearInterval(iv)
          setRefreshing(true)
          onRefresh()
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [onRefresh])

  return (
    <div className="px-4 md:px-6 py-4 bg-blue-50 border-t border-blue-100">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2.5 flex-1">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-900">경쟁사 점수를 분석하는 중입니다</p>
            <p className="text-sm text-blue-700 mt-0.5">
              스캔 완료 후 경쟁사 Gemini 분석이 백그라운드에서 실행됩니다.
              {countdown > 0 && <> <strong>{countdown}초</strong> 후 자동으로 새로고침됩니다.</>}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setRefreshing(true); onRefresh() }}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? '새로고침 중…' : '지금 새로고침'}
        </button>
      </div>
    </div>
  )
}

// ── 경쟁사 점수 스파크라인 ──
function CompetitorSparkline({ competitorName, trendScans }: { competitorName: string; trendScans: TrendScan[] }) {
  const sorted = [...trendScans].sort((a, b) =>
    new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
  )
  const data = sorted.flatMap(s => {
    const v = s.competitor_scores
      ? Object.values(s.competitor_scores).find(c => c.name === competitorName)?.score
      : undefined
    return v !== undefined ? [{ v: Math.round(v) }] : []
  })
  if (data.length < 2) return null
  const trend = data[data.length - 1].v - data[data.length - 2].v
  const color = trend > 0 ? '#ef4444' : trend < 0 ? '#22c55e' : '#9ca3af'
  return (
    <div className="flex items-center gap-1 shrink-0">
      <div style={{ width: 44, height: 18 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {trend !== 0 && (
        <span className={`text-xs sm:text-sm font-bold ${trend > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
          {trend > 0 ? `+${Math.round(trend)}` : `${Math.round(trend)}`}
        </span>
      )}
    </div>
  )
}

// ── 1:1 상세 비교 모달 ──
interface CompareModalProps {
  bizName: string
  myScore: number
  myReviewCount: number
  myAvgRating: number
  myBlogMentions: number
  competitor: {
    name: string
    place_review_count?: number | null
    place_avg_rating?: number | null
    blog_mention_count?: number | null
    place_has_faq?: boolean
    place_has_recent_post?: boolean
    place_has_menu?: boolean
    place_has_intro?: boolean
    place_photo_count?: number | null
    website_url?: string | null
    website_seo_score?: number | null
  }
  compScore: { score: number; mentioned: boolean; breakdown: Record<string, number> } | null
  onClose: () => void
}

const COMPARE_BREAKDOWN_LABELS: Record<string, string> = {
  keyword_gap_score:        '키워드 커버리지 (추정)',
  review_quality:           '리뷰·평점 (추정)',
  smart_place_completeness: '스마트플레이스 (추정)',
  naver_exposure_confirmed: '네이버 AI 브리핑 (추정)',
  multi_ai_exposure:        'ChatGPT/Gemini 노출 (추정)',
  schema_seo:               '웹사이트 구조화 (추정)',
  online_mentions_t2:       '온라인 언급 (추정)',
  google_presence:          'Google AI 노출 (추정)',
}

function CompareModal({ bizName, myScore, myReviewCount, myAvgRating, myBlogMentions, competitor, compScore, onClose }: CompareModalProps) {
  const compReview = competitor.place_review_count ?? 0
  const compRating = competitor.place_avg_rating ?? 0
  const compBlog   = competitor.blog_mention_count ?? 0
  const compTotal  = compScore ? Math.round(compScore.score) : 0
  const myTotal    = Math.round(myScore)
  const maxScore   = Math.max(myTotal, compTotal, 1)

  const statRows = [
    { label: '리뷰 수',     myVal: myReviewCount, compVal: compReview, unit: '개' },
    { label: '평점',        myVal: myAvgRating,   compVal: compRating,  unit: '점', decimals: 1 },
    { label: '블로그 언급', myVal: myBlogMentions, compVal: compBlog,   unit: '회' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <p className="text-base md:text-lg font-bold text-gray-900">1:1 상세 비교</p>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="text-blue-600 font-semibold">{bizName}</span>
              <span className="mx-2 text-gray-300 font-bold">vs</span>
              <span className="text-gray-800 font-semibold">{competitor.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6">
          {/* PC: 2열 레이아웃 / 모바일: 1열 */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6 gap-y-5">

            {/* ── 왼쪽 열 ── */}
            <div className="space-y-5">
              {/* AI 노출 총점 */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-gray-400" />AI 노출 총점
                </p>
                {[
                  { name: `${bizName}`, label: '내 가게', score: myTotal, isMe: true },
                  { name: competitor.name, label: '경쟁사', score: compTotal, isMe: false },
                ].map(e => (
                  <div key={e.name} className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className={`font-semibold truncate max-w-[180px] ${e.isMe ? 'text-blue-700' : 'text-gray-700'}`}>
                        <span className="text-xs sm:text-sm text-gray-400 mr-1">{e.label}</span>{e.name}
                      </span>
                      <span className={`font-bold px-2 py-0.5 rounded-lg border text-sm shrink-0 ml-2 ${e.isMe
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : e.score > myTotal ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>{e.score}점</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${e.isMe ? 'bg-blue-500' : e.score > myTotal ? 'bg-red-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.round((e.score / maxScore) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className={`text-sm font-semibold mt-1 px-3 py-2 rounded-lg ${
                  compTotal > myTotal ? 'bg-red-50 text-red-600' :
                  compTotal < myTotal ? 'bg-emerald-50 text-emerald-700' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  {compTotal > myTotal
                    ? `경쟁사가 ${compTotal - myTotal}점 앞서 있습니다`
                    : compTotal < myTotal
                    ? `내 가게가 ${myTotal - compTotal}점 앞서 있습니다`
                    : '두 가게 동점'}
                </div>
              </div>

              {/* 수치 비교 */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-gray-400" />주요 수치 비교
                </p>
                <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                  <div className="grid grid-cols-3 text-sm font-semibold text-gray-500 px-4 py-2.5 border-b border-gray-200 bg-gray-100">
                    <span>항목</span>
                    <span className="text-center text-blue-600">내 가게</span>
                    <span className="text-center text-gray-600">경쟁사</span>
                  </div>
                  {statRows.map(row => {
                    const myV   = row.decimals ? row.myVal.toFixed(row.decimals) : String(row.myVal)
                    const cmpV  = row.decimals ? row.compVal.toFixed(row.decimals) : String(row.compVal)
                    const myWin = row.myVal > row.compVal
                    const tie   = row.myVal === row.compVal
                    return (
                      <div key={row.label} className="grid grid-cols-3 px-4 py-3 border-b border-gray-100 last:border-0 items-center">
                        <span className="text-sm text-gray-600 font-medium">{row.label}</span>
                        <span className={`text-center text-sm font-bold ${!tie && myWin ? 'text-emerald-600' : !tie ? 'text-red-500' : 'text-gray-500'}`}>
                          {myV}{row.unit}
                        </span>
                        <span className={`text-center text-sm font-bold ${!tie && !myWin ? 'text-red-500' : !tie ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {cmpV}{row.unit}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── 오른쪽 열 ── */}
            <div className="space-y-5">
              {/* 스마트플레이스 현황 */}
              {(competitor.place_has_faq !== undefined || competitor.place_has_menu !== undefined) && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400" />스마트플레이스 (경쟁사)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '소개글',      val: competitor.place_has_intro },
                      { label: '소개글Q&A', val: competitor.place_has_faq },
                      { label: '최신 소식', val: competitor.place_has_recent_post },
                      { label: '메뉴·가격', val: competitor.place_has_menu },
                    ].map(({ label, val }) => val !== undefined ? (
                      <div key={label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border ${
                        val ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}>
                        {val
                          ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                          : <X className="w-4 h-4 shrink-0" />}
                        {label}
                      </div>
                    ) : null)}
                  </div>
                  {competitor.place_photo_count != null && (
                    <p className="text-sm text-gray-500 mt-2.5 flex items-center gap-1.5">
                      <span className="text-gray-400">사진</span>
                      <strong className="text-gray-700">{competitor.place_photo_count}장</strong>
                    </p>
                  )}
                </div>
              )}

              {/* 웹사이트 */}
              <div>
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-gray-400" />웹사이트
                </p>
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  competitor.website_url ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <span className="text-sm font-semibold text-gray-700">경쟁사 웹사이트</span>
                  {competitor.website_url ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600">있음</span>
                      {competitor.website_seo_score != null && (
                        <span className="text-sm bg-white border border-emerald-200 text-emerald-700 font-semibold px-2 py-0.5 rounded-lg">
                          SEO {competitor.website_seo_score}점
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-gray-400">없음</span>
                  )}
                </div>
                {!competitor.website_url && (
                  <p className="text-sm text-blue-600 mt-2">내 가게에 웹사이트가 있다면 ChatGPT·Gemini 노출에서 유리합니다.</p>
                )}
              </div>
            </div>
          </div>

          {/* 경쟁사 항목별 점수 — PC에서 2열 그리드 */}
          {compScore && Object.keys(compScore.breakdown).length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-gray-400" />경쟁사 항목별 점수
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {Object.entries(compScore.breakdown)
                  .filter(([, v]) => typeof v === 'number')
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([key, val]) => {
                    const label = COMPARE_BREAKDOWN_LABELS[key] ?? key
                    const pct   = Math.min(Math.round(val as number), 100)
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">{label}</span>
                          <span className={`font-bold text-sm ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                            {pct}점
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
              <p className="text-sm text-gray-400 mt-3">낮은 점수 항목이 내 가게의 선점 기회입니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 메인 컴포넌트
// ========================
function SectionDivider({ title, icon: Icon }: { title: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-gray-200" />
      <div className="flex items-center gap-1.5 shrink-0">
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
        <span className="text-sm font-semibold text-gray-400 tracking-wide">{title}</span>
      </div>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

export function CompetitorsClient({
  business,
  competitors: initial,
  myScore,
  myReviewCount = 0,
  myAvgRating = 0,
  myBlogMentions = 0,
  userId,
  trendScans = [],
  competitorScores,
  lastScannedAt,
  currentPlan = 'basic',
  planLimit = 3,
  accessToken = '',
  gapAnalysis = null,
}: Props) {
  const router = useRouter()
  const [competitors, setCompetitors] = useState(initial)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<AddTab>('search')
  // 모바일 탭 상태 (목록 / 등록 / 분석 / 데이터)
  const [mobileTab, setMobileTab] = useState<'list' | 'add' | 'analysis' | 'data'>('list')
  const [kwTab, setKwTab] = useState<'exclusive' | 'pioneer' | 'common' | 'compare'>('exclusive')
  const [topTip, setTopTip] = useState<string | null>(null)
  const [scanPromptName, setScanPromptName] = useState<string | null>(null)
  const [planLimitHit, setPlanLimitHit] = useState(false)
  const [showInlineScan, setShowInlineScan] = useState(false)
  const [keywordModalOpen, setKeywordModalOpen] = useState(false)
  const [showGapCard, setShowGapCard] = useState(false)

  // 변화 감지 상태
  const [changedCompetitorIds, setChangedCompetitorIds] = useState<Set<string>>(new Set())
  const [changeDetails, setChangeDetails] = useState<Record<string, string>>({})

  // 네이버 플레이스 동기화 상태 (경쟁사 ID → 상태)
  const [syncingIds, setSyncingIds] = useState<Record<string, 'loading' | 'success' | 'error'>>({})

  // 전체 평점 동기화 상태
  const [syncAllState, setSyncAllState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [syncAllProgress, setSyncAllProgress] = useState({ done: 0, total: 0 })

  // FAQ 수집 상태 (경쟁사 ID)
  const [fetchingFaqId, setFetchingFaqId] = useState<string | null>(null)

  // 약점 분석 수집 상태 (경쟁사 ID)
  const [fetchingWeaknessId, setFetchingWeaknessId] = useState<string | null>(null)

  // 경쟁사 메모 (localStorage 저장)
  const [memos, setMemos] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`competitor_memos_${business.id}`) ?? '{}') } catch { return {} }
  })
  const [openMemoId, setOpenMemoId] = useState<string | null>(null)
  const [memoInput, setMemoInput] = useState('')
  const [compareCompId, setCompareCompId] = useState<string | null>(null)

  // 경쟁사 고정(핀) 상태 (localStorage 저장)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`pinned_competitors_${business.id}`) ?? '[]')) } catch { return new Set() }
  })

  const saveMemo = (competitorId: string, text: string) => {
    const next = { ...memos, [competitorId]: text }
    if (!text.trim()) delete next[competitorId]
    setMemos(next)
    try { localStorage.setItem(`competitor_memos_${business.id}`, JSON.stringify(next)) } catch {}
  }

  const togglePin = (competitorId: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(competitorId)) next.delete(competitorId)
      else next.add(competitorId)
      try { localStorage.setItem(`pinned_competitors_${business.id}`, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const handleFetchWeakness = async (competitorId: string) => {
    if (!accessToken) return
    setFetchingWeaknessId(competitorId)
    try {
      const res = await fetch(`${BACKEND}/api/competitors/${competitorId}/weakness`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setCompetitors(prev =>
        prev.map(c => c.id === competitorId ? { ...c, weakness_data: data } : c)
      )
    } catch {
      // silent fail
    } finally {
      setFetchingWeaknessId(null)
    }
  }

  const handleFetchFaq = async (competitorId: string) => {
    if (!accessToken) return
    setFetchingFaqId(competitorId)
    try {
      const token = await getFreshToken()
      const res = await fetch(`${BACKEND}/api/competitors/${competitorId}/faq-items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      // deprecated 응답: 빈 배열 + 안내 메시지 sentinel 저장
      const questions = data.deprecated
        ? ['__deprecated__']
        : (Array.isArray(data.questions) ? data.questions : [])
      setCompetitors(prev =>
        prev.map(c => c.id === competitorId ? { ...c, faq_questions: questions } : c)
      )
    } catch {
      // 네트워크 오류 — 조용히 무시 (다음 시도 가능)
    } finally {
      setFetchingFaqId(null)
    }
  }

  const handleSyncAllRatings = useCallback(async () => {
    // 한 번도 동기화되지 않은 경쟁사만 대상 (동기화 후 실제 별점 없는 경우는 제외)
    const targets = competitors.filter(
      c => !(typeof c.place_avg_rating === 'number' && c.place_avg_rating > 0)
        && !c.detail_synced_at
    )
    if (targets.length === 0) return

    setSyncAllState('loading')
    setSyncAllProgress({ done: 0, total: targets.length })

    const session = await getSafeSession()
    const token = session?.access_token ?? ''

    for (let i = 0; i < targets.length; i++) {
      const c = targets[i]
      try {
        await fetch(`${BACKEND}/api/competitors/${c.id}/sync-place`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // 개별 실패는 무시하고 계속
      }
      setSyncAllProgress({ done: i + 1, total: targets.length })
      // 서버 부하 방지: 요청 간 1초 대기
      if (i < targets.length - 1) {
        await new Promise(res => setTimeout(res, 1000))
      }
    }

    setSyncAllState('done')
    setTimeout(() => {
      setSyncAllState('idle')
      router.refresh()
    }, 1500)
  }, [competitors, router])

  const handleSyncPlace = useCallback(async (competitorId: string) => {
    setSyncingIds(prev => ({ ...prev, [competitorId]: 'loading' }))
    try {
      const session = await getSafeSession()
      const token = session?.access_token ?? ''
      const res = await fetch(`${BACKEND}/api/competitors/${competitorId}/sync-place`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || '동기화 실패')
      }
      setSyncingIds(prev => ({ ...prev, [competitorId]: 'success' }))
      setTimeout(() => { router.refresh() }, 2000)
    } catch {
      setSyncingIds(prev => ({ ...prev, [competitorId]: 'error' }))
      setTimeout(() => {
        setSyncingIds(prev => { const next = { ...prev }; delete next[competitorId]; return next })
      }, 4000)
    }
  }, [router])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [addingName, setAddingName] = useState<string | null>(null)
  const [pendingResult, setPendingResult] = useState<SearchResult | null>(null)
  const [pendingPlaceId, setPendingPlaceId] = useState('')

  const [form, setForm] = useState({ name: '', address: '', naver_place_id: '' })
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const limitReached = planLimit < 999 && competitors.length >= planLimit

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => {
    try {
      const key = `dismissed_suggestions_${business.id}`
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'))
    } catch { return new Set() }
  })

  const canViewBasic   = planAtLeast(currentPlan, 'basic')
  const canViewTrack1  = planAtLeast(currentPlan, 'startup')
  const canViewTrack2  = planAtLeast(currentPlan, 'pro')
  const canViewTrend   = planAtLeast(currentPlan, 'startup')

  // 변화 감지 데이터 로드
  useEffect(() => {
    if (!accessToken || !business.id) return
    fetch(`${BACKEND}/api/competitors/${business.id}/changes`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ id: string; change_summary: string; change_detected_at: string }>) => {
        setChangedCompetitorIds(new Set(rows.map(r => r.id)))
        setChangeDetails(Object.fromEntries(rows.map(r => [r.id, r.change_summary ?? ''])))
      })
      .catch(() => {})
  }, [business.id, accessToken])

  useEffect(() => {
    if (!accessToken || !business.id || !competitorScores) return
    fetch(`${BACKEND}/api/report/conversion-tips/${business.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const tips = data?.tips ?? data?.conversion_tips ?? []
        if (tips.length > 0) {
          const t = tips[0]
          setTopTip(t.action ?? t.title ?? t.text ?? null)
        }
      })
      .catch(() => {})
  }, [business.id, accessToken, competitorScores])

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoadingSuggest(true)
      try {
        const session = await getSafeSession()
        const res = await fetch(
          `${BACKEND}/api/competitors/suggestions?biz_id=${business.id}`,
          { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } }
        )
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions ?? [])
        }
      } catch (err) {
        console.warn('[CompetitorsClient] suggest fetch failed', err)
      } finally { setLoadingSuggest(false) }
    }
    fetchSuggestions()
  }, [business.id])

  const getFreshToken = async (): Promise<string> => {
    const session = await getSafeSession()
    return session?.access_token ?? ''
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const token = await getFreshToken()
      const res = await fetch(
        `${BACKEND}/api/competitors/search?query=${encodeURIComponent(searchQuery)}&region=${encodeURIComponent(business.region)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSearchResults(data)
      if (data.length === 0) setSearchError('검색 결과가 없습니다. 다른 키워드로 시도해보세요.')
    } catch {
      setSearchError('검색 중 오류가 발생했습니다.')
    } finally {
      setSearching(false)
    }
  }

  const doAdd = async (
    name: string,
    address: string,
    naverPlaceId?: string,
    lat?: number,
    lng?: number,
  ): Promise<boolean> => {
    const token = await getFreshToken()
    const body: Record<string, unknown> = { business_id: business.id, name, address }
    if (naverPlaceId?.trim()) body.naver_place_id = naverPlaceId.trim()
    if (lat !== undefined && !isNaN(lat)) body.lat = lat
    if (lng !== undefined && !isNaN(lng)) body.lng = lng
    const res = await fetch(`${BACKEND}/api/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json()
      if (err?.detail?.code === 'PLAN_REQUIRED') {
        setPlanLimitHit(true)
        throw new Error('PLAN_LIMIT')
      }
      throw new Error('ADD_FAIL')
    }
    const newComp = await res.json()
    setCompetitors(prev => [...prev, newComp])
    setScanPromptName(name)
    router.refresh()
    return true
  }

  const addFromSearch = (result: SearchResult) => {
    setPendingResult(result)
    setPendingPlaceId('')
  }

  const doAddFromPending = async (placeId?: string) => {
    if (!pendingResult) return
    const result = pendingResult
    setPendingResult(null)
    setPendingPlaceId('')
    setAddingName(result.name)
    try {
      const lat = result.lat ? parseFloat(result.lat) : undefined
      const lng = result.lng ? parseFloat(result.lng) : undefined
      await doAdd(result.name, result.address, placeId, lat, lng)
      setSearchResults(prev => prev.filter(r => r.name !== result.name))
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'PLAN_LIMIT') setSearchError('등록 중 오류가 발생했습니다.')
    } finally {
      setAddingName(null)
    }
  }

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setFormError('')
    try {
      await doAdd(form.name, form.address, form.naver_place_id)
      setForm({ name: '', address: '', naver_place_id: '' })
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'PLAN_LIMIT') setFormError('경쟁사 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const removeCompetitor = async (id: string) => {
    if (!window.confirm("이 경쟁사를 삭제하시겠습니까? 삭제 후 복구가 되지 않습니다.")) return
    const token = await getFreshToken()
    await fetch(`${BACKEND}/api/competitors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    setCompetitors(competitors.filter(c => c.id !== id))
    router.refresh()
  }

  const alreadyAdded = new Set(competitors.map(c => c.name))

  const handleDismissSuggestion = (name: string) => {
    setDismissedSuggestions(prev => {
      const next = new Set([...prev, name])
      try { localStorage.setItem(`dismissed_suggestions_${business.id}`, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const visibleSuggestions = suggestions.filter(
    s => !alreadyAdded.has(s.name) && !dismissedSuggestions.has(s.name)
  )

  // Free 플랜
  if (!canViewBasic) {
    return (
      <div className="space-y-6">
        <FreePlanPreview />
      </div>
    )
  }

  // ── 경쟁사 목록 섹션 ──
  const competitorListSection = (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-sm md:text-base font-bold text-gray-900">
                등록된 경쟁 가게
              </div>
              {lastScannedAt && (
                <div className="text-sm text-gray-400">
                  마지막 스캔 {new Date(lastScannedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setKeywordModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm md:text-base font-semibold px-3 py-2 rounded-xl transition-colors"
              aria-label="내 키워드 설정 열기"
              title="내 키워드 설정"
            >
              <SettingsIcon className="w-4 h-4" />
              내 키워드 설정
            </button>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${
              limitReached
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}>
              {planLimit >= 999 ? `${competitors.length}개` : `${competitors.length} / ${planLimit}개`}
            </span>
          </div>
        </div>
      </div>


      {/* 스캔 미포함 경쟁사 안내 배너 */}
      {(() => {
        const unscannedCount = competitors.filter(c => !competitorScores?.[c.id]).length
        return unscannedCount > 0 && competitorScores && Object.keys(competitorScores).length > 0 ? (
          <div className="px-4 md:px-6 py-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              <strong>{unscannedCount}개 경쟁사</strong>는 이번 스캔에 포함되지 않았습니다. AI 스캔을 다시 실행하면 모든 경쟁사 점수를 최신화합니다.
            </p>
            <button
              onClick={() => setShowInlineScan(true)}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" />지금 스캔
            </button>
          </div>
        ) : null
      })()}

      {/* 네이버 플레이스 미동기화 일괄 안내 카드 */}
      {(() => {
        const unsyncedCount = competitors.filter(c => !c.place_synced_at).length
        // 한 번도 동기화 안 한 경쟁사만 카운트 (동기화 후 실제로 별점 없는 가게 제외)
        const noRatingCount = competitors.filter(
          c => !(typeof c.place_avg_rating === 'number' && c.place_avg_rating > 0)
            && !c.detail_synced_at
        ).length
        // 동기화했지만 네이버에 별점 자체가 없는 경쟁사 수
        const syncedNoRatingCount = competitors.filter(
          c => !(typeof c.place_avg_rating === 'number' && c.place_avg_rating > 0)
            && !!c.detail_synced_at
        ).length
        return (unsyncedCount > 0 || noRatingCount > 0 || syncedNoRatingCount > 0) && competitors.length > 0 ? (
          <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-200 flex flex-col sm:flex-row sm:items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-600 shrink-0 sm:mt-0" />
            <p className="text-sm text-blue-800 flex-1">
              {unsyncedCount > 0 ? (
                <><strong>{unsyncedCount}개 경쟁사</strong>의 리뷰 수·평점 데이터가 없습니다.
                각 경쟁사 카드에서 &quot;네이버 데이터 동기화&quot;를 실행하면 실제 리뷰 수·평점·소개글 Q&A 여부를 비교할 수 있습니다.</>
              ) : noRatingCount > 0 ? (
                <><strong>{noRatingCount}개 경쟁사</strong>의 평점을 아직 가져오지 못했습니다.</>
              ) : (
                <><strong>{syncedNoRatingCount}개 경쟁사</strong>는 동기화되었지만 네이버에 등록된 별점이 없습니다. 리뷰가 0개인 신규 가게는 별점이 없을 수 있습니다.</>
              )}
            </p>
            {noRatingCount > 0 && (
              <button
                onClick={() => void handleSyncAllRatings()}
                disabled={syncAllState === 'loading'}
                className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncAllState === 'loading' ? 'animate-spin' : ''}`} />
                {syncAllState === 'loading'
                  ? `동기화 중 (${syncAllProgress.done}/${syncAllProgress.total})`
                  : syncAllState === 'done'
                  ? '동기화 완료!'
                  : '미동기화 경쟁사 동기화'}
              </button>
            )}
          </div>
        ) : null
      })()}

      {/* 빈 상태 */}
      {competitors.length === 0 ? (
        <div className="p-6 md:p-8">
          {/* 상단 강조 배너 */}
          <div className="bg-blue-600 rounded-2xl p-4 md:p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-base md:text-lg font-bold text-white mb-1">
                경쟁사 1곳을 추가하면 AI 노출 비교 분석을 받을 수 있습니다
              </p>
              <p className="text-sm text-blue-200 leading-relaxed">
                어느 가게가 AI에 더 잘 나오는지, 내가 없는 키워드는 무엇인지 바로 확인하세요.
              </p>
            </div>
            <button
              onClick={() => setMobileTab('add')}
              className="shrink-0 bg-white text-blue-600 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              경쟁사 추가하기
            </button>
          </div>

          {/* 기존 안내 카드 */}
          <div className="text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <Building2 className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-base font-bold text-gray-800 mb-1">아직 경쟁 가게가 없습니다</p>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed max-w-xs mx-auto">
              주변 경쟁 가게를 등록하면 AI 검색 노출 점수를 비교할 수 있습니다.
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left space-y-2 text-sm text-gray-500 max-w-sm mx-auto">
              <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-500" />사용 방법
              </p>
              <p className="flex items-start gap-2"><span className="text-blue-500 font-bold shrink-0">1.</span> 아래 &quot;지역 검색&quot; 탭에서 경쟁 가게 이름 입력</p>
              <p className="flex items-start gap-2"><span className="text-blue-500 font-bold shrink-0">2.</span> 검색 결과에서 경쟁 가게 선택 후 등록</p>
              <p className="flex items-start gap-2"><span className="text-blue-500 font-bold shrink-0">3.</span> 대시보드에서 &quot;AI 스캔 시작&quot; → 점수 비교 확인</p>
            </div>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {(competitorScores
            ? [...competitors].sort((a, b) => {
                const aPinned = pinnedIds.has(a.id) ? 1 : 0
                const bPinned = pinnedIds.has(b.id) ? 1 : 0
                if (bPinned !== aPinned) return bPinned - aPinned
                return (competitorScores[b.id]?.score ?? -1) - (competitorScores[a.id]?.score ?? -1)
              })
            : [...competitors].sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0))
          ).map((c, idx) => {
            const cs = competitorScores?.[c.id]
            const isExpanded = expandedId === c.id
            const compRank = idx + 1

            // 지난 스캔 대비 변화량 (trendScans는 DESC 정렬 — [0]=최신, [1]=이전)
            const prevScan = trendScans.length >= 2 ? trendScans[1] : null
            const prevCsScore = prevScan?.competitor_scores
              ? Object.values(prevScan.competitor_scores).find(x => x.name === c.name)?.score ?? null
              : null
            const csDelta = cs && prevCsScore !== null ? Math.round(cs.score - prevCsScore) : null

            return (
              <li key={c.id} className="overflow-hidden transition-colors hover:bg-gray-50/50">
                <div className="px-4 md:px-6 py-4 min-h-[4rem]">
                  <div className="flex items-start justify-between gap-3">
                    {/* 순위 + 정보 */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        {cs ? <RankBadge rank={compRank} /> : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-400 font-bold text-sm">{compRank}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {pinnedIds.has(c.id) && (
                            <Pin className="w-3 h-3 text-blue-500 fill-blue-400 shrink-0" />
                          )}
                          <span className="font-bold text-gray-900 text-sm md:text-base">{c.name}</span>
                          {memos[c.id] && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="메모 있음" />
                          )}
                          {changedCompetitorIds.has(c.id) && (
                            <span
                              className="inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap"
                              title={changeDetails[c.id] || '최근 7일 내 변화가 감지되었습니다'}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                              변화 감지
                            </span>
                          )}
                          {cs && (
                            <span className={`text-sm font-bold px-2 py-0.5 rounded-lg border ${getScoreBadgeCls(cs.score)}`}>
                              {Math.round(cs.score)}점
                            </span>
                          )}
                          {csDelta !== null && csDelta !== 0 && (
                            <span className={`text-sm font-bold px-1.5 py-0.5 rounded-full ${csDelta > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}
                              title={csDelta > 0 ? `지난 스캔 대비 +${csDelta}점 상승` : `지난 스캔 대비 ${csDelta}점 하락`}>
                              {csDelta > 0 ? `↑${csDelta}` : `↓${Math.abs(csDelta)}`}
                            </span>
                          )}
                          {/* 스파크라인 — 2회 이상 스캔 시 추이 표시 */}
                          {trendScans.length >= 2 && cs && (
                            <CompetitorSparkline competitorName={c.name} trendScans={trendScans} />
                          )}
                          {cs && (
                            <span className={`text-sm px-2 py-0.5 rounded-full font-medium border ${
                              cs.mentioned
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}>
                              {cs.mentioned ? 'AI 노출됨' : 'AI 미노출'}
                            </span>
                          )}
                        </div>
                        {c.address && (
                          <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        )}

                        {/* 네이버 플레이스 미동기화 배너 */}
                        {!c.place_synced_at && (
                          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            {syncingIds[c.id] === 'success' ? (
                              <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                동기화 완료! 페이지를 새로고침합니다.
                              </div>
                            ) : syncingIds[c.id] === 'error' ? (
                              <div className="flex items-center gap-2 text-sm text-red-600 font-semibold">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                네이버에서 업체를 찾지 못했습니다. 잠시 후 다시 시도하세요.
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-amber-900">네이버 플레이스 데이터 미연동</p>
                                  <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
                                    실제 리뷰수·평점 등을 가져오려면 동기화가 필요합니다.
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleSyncPlace(c.id)}
                                  disabled={syncingIds[c.id] === 'loading'}
                                  className="inline-flex items-center gap-1.5 shrink-0 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
                                >
                                  {syncingIds[c.id] === 'loading' ? (
                                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" />동기화 중...</>
                                  ) : (
                                    <><RefreshCw className="w-3.5 h-3.5" />네이버 데이터 동기화</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 네이버 플레이스 핵심 수치 — 동기화 완료 시 인라인 표시 */}
                        {c.place_synced_at && (c.place_review_count !== null || c.place_avg_rating !== null) && (
                          <div className="flex items-center gap-2 flex-wrap mt-1.5 text-sm text-gray-500">
                            {typeof c.place_review_count === 'number' && (
                              <span>
                                리뷰 <strong className={c.place_review_count > myReviewCount ? 'text-red-600' : 'text-emerald-600'}>{c.place_review_count}개</strong>
                              </span>
                            )}
                            {typeof c.place_avg_rating === 'number' && c.place_avg_rating > 0 ? (
                              <span>⭐ <strong>{c.place_avg_rating.toFixed(1)}</strong></span>
                            ) : c.detail_synced_at ? (
                              <span className="text-sm text-gray-400">별점 없음</span>
                            ) : (
                              <button
                                onClick={() => handleSyncPlace(c.id)}
                                disabled={syncingIds[c.id] === 'loading'}
                                className="flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                title="평점을 가져옵니다"
                              >
                                <RefreshCw className={`w-3 h-3 ${syncingIds[c.id] === 'loading' ? 'animate-spin' : ''}`} />
                                평점 동기화
                              </button>
                            )}
                            {typeof c.place_has_faq === 'boolean' && (
                              <span className={c.place_has_faq ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                                소개글Q&A {c.place_has_faq ? '✓' : '✗'}
                              </span>
                            )}
                            {typeof c.place_has_recent_post === 'boolean' && (
                              <span className={c.place_has_recent_post ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                                포스팅 {c.place_has_recent_post ? '최신' : '미갱신'}
                              </span>
                            )}
                          </div>
                        )}

                        {cs ? (
                          <>
                            {/* AI 채널별 노출 배지 */}
                            {cs.breakdown && (() => {
                              const naverOn = (cs.breakdown.naver_exposure_confirmed ?? 0) >= 50
                              const globalOn = (cs.breakdown.multi_ai_exposure ?? 0) >= 50
                              return (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${naverOn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    네이버AI {naverOn ? '✓' : '✗'}
                                  </span>
                                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${globalOn ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    ChatGPT/Gemini {globalOn ? '✓' : '✗'}
                                  </span>
                                </div>
                              )
                            })()}
                            {/* 점수 격차 1줄 */}
                            {myScore > 0 && (
                              <div className="mt-1.5">
                                {cs.score > myScore ? (
                                  <span className="text-sm text-red-500 font-medium">
                                    내 가게보다 <strong>{Math.round(cs.score - myScore)}점 높음</strong>
                                    <a href="/guide" className="ml-1.5 text-sm text-red-600 underline underline-offset-2">가이드 →</a>
                                  </span>
                                ) : cs.score < myScore ? (
                                  <span className="text-sm text-emerald-600 font-medium">내 가게보다 <strong>{Math.round(myScore - cs.score)}점 낮음</strong></span>
                                ) : (
                                  <span className="text-sm text-gray-400 font-medium">내 가게와 동점</span>
                                )}
                              </div>
                            )}
                            {/* AI 검색 발췌 — 축약 1줄 */}
                            {cs.excerpt && (
                              <p className="mt-1.5 text-sm text-gray-400 truncate max-w-full overflow-hidden" title={cs.excerpt}>
                                AI 소개: {cs.excerpt}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 text-sm font-semibold">
                              <Clock className="w-3 h-3" />
                              스캔 대기
                            </span>
                            <button
                              onClick={() => setShowInlineScan(true)}
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 transition-colors"
                            >
                              <Zap className="w-3 h-3" />지금 스캔하기
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 버튼 영역 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 1:1 비교 버튼 */}
                      {cs && (
                        <button
                          onClick={() => setCompareCompId(compareCompId === c.id ? null : c.id)}
                          className={`flex items-center gap-1 text-sm font-medium border rounded-lg px-2.5 py-1.5 transition-colors ${
                            compareCompId === c.id
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'text-purple-600 border-purple-200 hover:bg-purple-50'
                          }`}
                          title="1:1 상세 비교"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />비교
                        </button>
                      )}
                      {cs && canViewBasic && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 transition-colors border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 font-medium"
                          title={isExpanded ? '상세 접기' : '상세 분석 보기'}
                        >
                          {isExpanded ? <><ChevronUp className="w-3.5 h-3.5" />접기</> : <><ChevronDown className="w-3.5 h-3.5" />상세</>}
                        </button>
                      )}
                      <button
                        onClick={() => togglePin(c.id)}
                        className={`p-1.5 rounded-lg transition-colors ${pinnedIds.has(c.id) ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}
                        title={pinnedIds.has(c.id) ? '고정 해제' : '상단 고정'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${pinnedIds.has(c.id) ? 'fill-blue-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => {
                          if (openMemoId === c.id) { setOpenMemoId(null) }
                          else { setOpenMemoId(c.id); setMemoInput(memos[c.id] ?? '') }
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${memos[c.id] ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}
                        title={memos[c.id] ? '메모 보기/편집' : '메모 추가'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeCompetitor(c.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                        title="경쟁사 삭제하기"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 확장: 변화 감지 상세 */}
                  {isExpanded && changedCompetitorIds.has(c.id) && changeDetails[c.id] && (
                    <div className="mx-4 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <span className="text-base shrink-0">📢</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">최근 변화 감지</p>
                        <p className="text-sm text-amber-700 leading-relaxed mt-0.5">{changeDetails[c.id]}</p>
                      </div>
                    </div>
                  )}

                  {/* 확장: 네이버 플레이스 카드 — Basic+ 모두 접근 가능, 내부에서 플랜별 잠금 처리 */}
                  {isExpanded && canViewBasic && (
                    <CompetitorPlaceCard
                      competitor={{
                        ...c,
                        ai_excerpt: cs?.excerpt ?? c.ai_excerpt ?? null,
                        weakness_data: c.weakness_data ?? null,
                      }}
                      myReviewCount={myReviewCount}
                      myAvgRating={myAvgRating}
                      accessToken={accessToken}
                      myBlogMentions={myBlogMentions}
                      canViewStartup={canViewTrack1}
                      onSyncRequest={async () => {
                        const token = await getFreshToken()
                        await syncCompetitorPlace(c.id, token)
                        router.refresh()
                      }}
                      onPlaceIdSaved={() => router.refresh()}
                      onFetchFaq={() => handleFetchFaq(c.id)}
                      isFetchingFaq={fetchingFaqId === c.id}
                      onFetchWeakness={() => handleFetchWeakness(c.id)}
                      isFetchingWeakness={fetchingWeaknessId === c.id}
                    />
                  )}

                  {/* 확장: breakdown 상세 */}
                  {isExpanded && cs?.breakdown && canViewTrack1 && (() => {
                    const allEntries = sortBreakdownEntries(
                      Object.entries(cs.breakdown).filter(([, v]) => typeof v === 'number')
                    )
                    const t1 = allEntries.filter(([k]) => TRACK1_KEYS.includes(k))
                    const t2 = allEntries.filter(([k]) => TRACK2_KEYS.includes(k))
                    const legacy = allEntries.filter(([k]) => !TRACK1_KEYS.includes(k) && !TRACK2_KEYS.includes(k))

                    const renderItems = (items: [string, number][], barCls: string) =>
                      items.map(([key, val]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">{BREAKDOWN_LABELS[key] ?? key}</span>
                            <span className="text-sm font-semibold text-gray-700">{Math.round(val)}점</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barCls} rounded-full transition-all`} style={{ width: `${Math.min(val, 100)}%` }} />
                          </div>
                        </div>
                      ))

                    return (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-5">
                        {t1.length > 0 && (
                          <div>
                            <p className="text-sm text-amber-600 bg-amber-50 rounded px-2 py-1 mb-2">
                              {TRACK1_ESTIMATED_NOTE}
                            </p>
                            <div className="flex items-center gap-1.5 text-sm font-bold text-blue-700 mb-3">
                              <Target className="w-3.5 h-3.5" />네이버 노출 점수 상세
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                              {renderItems(t1, 'bg-blue-400')}
                            </div>
                          </div>
                        )}
                        {t2.length > 0 && (
                          canViewTrack2 ? (
                            <div>
                              <div className="flex items-center gap-1.5 text-sm font-bold text-purple-700 mb-3">
                                <Award className="w-3.5 h-3.5" />AI 검색 노출 점수 상세
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                {renderItems(t2, 'bg-purple-400')}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5 text-sm font-bold text-purple-400 mb-1">
                                <Award className="w-3.5 h-3.5" />AI 검색 노출 점수 상세
                              </div>
                              <LockedFeature requiredPlan="Pro" feature="ChatGPT·Gemini·Google AI 채널 상세 분석" />
                            </div>
                          )
                        )}
                        {legacy.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                            {renderItems(legacy, 'bg-orange-300')}
                          </div>
                        )}
                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                          <p className="text-sm text-gray-400">막대 길이 = 최신 점수 · 숫자 변화량 = 이전 스캔 대비</p>
                          {allEntries.some(([k]) => TRACK1_KEYS.includes(k)) && (
                            <p className="text-sm text-gray-400">* (추정) 항목은 Gemini AI 단일 스캔 기반 간접 측정값입니다</p>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 메모 에디터 */}
                  {openMemoId === c.id && (
                    <div className="mx-4 mt-3 mb-1 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                          <Pencil className="w-3.5 h-3.5" />내 메모
                        </span>
                        <button onClick={() => setOpenMemoId(null)} className="text-amber-400 hover:text-amber-600 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        value={memoInput}
                        onChange={e => setMemoInput(e.target.value)}
                        placeholder="이 경쟁사에 대한 메모를 남기세요 (전략, 특이사항 등)"
                        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                        rows={3}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => { saveMemo(c.id, memoInput); setOpenMemoId(null) }}
                          className="text-sm bg-amber-500 text-white px-4 py-1.5 rounded-lg hover:bg-amber-600 transition-colors font-semibold"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 저장된 메모 표시 (열려있지 않을 때) */}
                  {memos[c.id] && openMemoId !== c.id && (
                    <div
                      className="mx-4 mt-2 mb-1 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 cursor-pointer hover:bg-amber-100 transition-colors"
                      onClick={() => { setOpenMemoId(c.id); setMemoInput(memos[c.id]) }}
                    >
                      <div className="flex items-start gap-1.5">
                        <Pencil className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800 leading-snug line-clamp-2">{memos[c.id]}</p>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* 스캔 안내 / 처리 중 배너 */}
      {competitors.length > 0 && !competitorScores && (
        lastScannedAt ? (
          /* 스캔은 했지만 경쟁사 점수가 아직 없음 → 백그라운드 처리 중 */
          <CompetitorScoreWaiting onRefresh={() => router.refresh()} />
        ) : (
          /* 아직 스캔 안 함 */
          <div className="px-4 md:px-6 py-4 bg-amber-50 border-t border-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-2.5 flex-1">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">AI 스캔이 아직 실행되지 않았습니다</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    스캔을 실행하면 경쟁 가게 {competitors.length}곳의 점수를 자동으로 분석해 비교합니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInlineScan(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm shrink-0"
              >
                <Zap className="w-4 h-4" />
                AI 스캔 시작
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )

  // ── 등록 패널 ──
  const addPanel = (
    <div className="space-y-4">
      {/* 한도 초과 amber 배너 */}
      {(planLimitHit || limitReached) && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 md:p-5">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm md:text-base font-bold text-amber-900">
                경쟁사 등록 한도 ({PLAN_COMPETITOR_LIMIT[currentPlan ?? 'free']}개)에 도달했습니다
              </p>
              <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                {currentPlan === 'basic'
                  ? 'Pro로 업그레이드하면 경쟁사 10개까지 비교할 수 있습니다.'
                  : currentPlan === 'startup'
                  ? 'Pro로 업그레이드하면 경쟁사 5개 → 10개까지 비교할 수 있습니다.'
                  : currentPlan === 'pro'
                  ? 'Biz 플랜으로 업그레이드하면 경쟁사를 무제한으로 등록할 수 있습니다.'
                  : '현재 플랜의 최대 경쟁사 수에 도달했습니다.'}
              </p>
            </div>
          </div>
          <a
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-bold bg-amber-500 text-white px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors"
          >
            요금제 보기 <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}      {/* 경쟁 가게 등록 카드 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-sm md:text-base font-bold text-gray-800">경쟁 가게 추가하기</span>
          </div>
        </div>

        {/* pill 스타일 탭 */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => !limitReached && setTab('search')}
              disabled={limitReached}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                limitReached
                  ? 'text-gray-300 cursor-not-allowed'
                  : tab === 'search'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1 text-sm font-semibold whitespace-nowrap">
                <Search className="w-3.5 h-3.5 shrink-0" />지역 검색
              </span>
              <span className="text-sm font-normal text-gray-400 leading-tight whitespace-nowrap">카카오맵 근처 동종업체</span>
            </button>
            <button
              onClick={() => !limitReached && setTab('manual')}
              disabled={limitReached}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
                limitReached
                  ? 'text-gray-300 cursor-not-allowed'
                  : tab === 'manual'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1 text-sm font-semibold whitespace-nowrap">
                <Plus className="w-3.5 h-3.5 shrink-0" />직접 입력
              </span>
              <span className="text-sm font-normal text-gray-400 leading-tight whitespace-nowrap">이름·주소 직접 입력</span>
            </button>
          </div>
        </div>

        <div className="p-4">
          {tab === 'search' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">{business.region}</span> 지역 내 경쟁 가게를 검색합니다.
                같은 업종의 가게 이름이나 업종을 입력하세요.
              </p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  placeholder="예: 치킨집, 헬스장, 피자"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={searching || limitReached}
                  className="bg-blue-600 text-white px-4 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 min-h-[48px]"
                >
                  {searching ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />검색 중</> : <><Search className="w-3.5 h-3.5" />검색</>}
                </button>
              </form>

              {searchError && (
                <div className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{searchError}
                </div>
              )}

              {searchResults.length > 0 && (
                <CompetitorMap results={searchResults} region={business.region} registeredCompetitors={competitors} />
              )}

              {searchResults.length > 0 && (
                <ul className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                  {searchResults.map((r, idx) => {
                    const added = alreadyAdded.has(r.name)
                    const isPending = pendingResult?.name === r.name
                    return (
                      <li key={`${r.name}-${idx}`} className={`rounded-xl border transition-all ${
                        isPending ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                      }`}>
                        <div className="flex items-start gap-3 p-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Building2 className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-900">{r.name}</span>
                                  {r.category && (
                                    <span className="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{r.category}</span>
                                  )}
                                </div>
                                {r.address && (
                                  <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{r.address}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  {r.kakao_url && (
                                    <a href={r.kakao_url} target="_blank" rel="noopener noreferrer"
                                      className="text-sm text-amber-600 hover:text-amber-800 underline" title="카카오맵에서 확인">
                                      카카오맵
                                    </a>
                                  )}
                                  {(r.naver_place_id || r.naver_url) && (() => {
                                    const href = r.naver_place_id
                                      ? `https://map.naver.com/p/entry/place/${r.naver_place_id}`
                                      : r.naver_url
                                    return (
                                      <a href={href} target="_blank" rel="noopener noreferrer"
                                        className="text-sm text-emerald-600 hover:text-emerald-800 underline"
                                        title={r.naver_place_id ? "네이버 플레이스 바로가기" : "네이버 지도에서 확인"}>
                                        네이버지도{r.naver_place_id && ' ↗'}
                                      </a>
                                    )
                                  })()}
                                </div>
                              </div>
                              <button
                                onClick={() => addFromSearch(r)}
                                disabled={added || addingName === r.name || isPending}
                                className={`shrink-0 text-sm px-3 py-1.5 rounded-lg border transition-colors font-semibold ${
                                  added
                                    ? 'border-gray-200 text-gray-300 cursor-default bg-gray-50'
                                    : isPending
                                    ? 'border-blue-300 text-blue-400 cursor-default bg-blue-50'
                                    : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white'
                                }`}
                              >
                                {added ? <CheckCircle2 className="w-4 h-4" /> : addingName === r.name ? <RefreshCw className="w-4 h-4 animate-spin" /> : isPending ? '입력 중' : '+ 추가'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 플레이스 ID 인라인 입력 */}
                        {isPending && (
                          <div className="mx-3 mb-3 bg-white border border-blue-200 rounded-xl p-3 space-y-2.5">
                            <div className="text-sm font-semibold text-gray-800">
                              네이버 플레이스 ID
                              <span className="font-normal text-gray-400 text-sm ml-1">(선택 사항)</span>
                            </div>
                            <input
                              autoFocus
                              type="text"
                              inputMode="numeric"
                              placeholder="예: 1234567890"
                              value={pendingPlaceId}
                              onChange={e => setPendingPlaceId(e.target.value.replace(/\D/g, ''))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                            />
                            <p className="text-sm text-gray-400 leading-relaxed">
                              네이버 지도 URL의 숫자를 복사 (map.naver.com/p/entry/place/<strong>1234567890</strong>)
                            </p>
                            <p className="text-sm text-blue-500 font-medium">입력 시 리뷰 수·평점을 자동으로 가져옵니다</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => doAddFromPending(pendingPlaceId || undefined)}
                                disabled={addingName !== null}
                                className="flex-1 bg-blue-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                {addingName ? '등록 중...' : '경쟁사 추가하기'}
                              </button>
                              <button
                                onClick={() => doAddFromPending(undefined)}
                                disabled={addingName !== null}
                                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                              >
                                ID 없이 등록
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'manual' && (
            <form onSubmit={addManual} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  경쟁 가게 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  placeholder="예: 홍대 치킨집, 강남 헬스장"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  주소 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  placeholder="예: 서울시 마포구 홍대 앞"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  네이버 플레이스 ID <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  placeholder="예: 123456789"
                  value={form.naver_place_id}
                  onChange={e => setForm({ ...form, naver_place_id: e.target.value.replace(/\D/g, '') })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
                <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                  네이버 지도에서 업체 검색 후 URL의 숫자 복사 (map.naver.com/p/entry/place/<strong>1234567890</strong>)
                </p>
                <p className="text-sm text-blue-500 mt-1 font-medium">입력 시 리뷰 수·평점을 자동으로 가져옵니다</p>
              </div>
              {formError && (
                <div className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{formError}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || limitReached}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-base font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
              >
                {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />추가 중...</> : <><Plus className="w-4 h-4" />경쟁 가게 추가하기</>}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 추천 경쟁사 */}
      <div className="rounded-2xl border-2 border-blue-200 overflow-hidden shadow-sm">
        {/* 헤더 — 그라디언트 배경으로 시각적 강조 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-white shrink-0" />
            <span className="text-sm font-bold text-white">추천 경쟁사</span>
            <span className="text-sm font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">최대 5개</span>
          </div>
          <span className="text-sm text-blue-100">같은 업종·지역 미등록 업체</span>
        </div>

        {/* 본문 */}
        <div className="bg-white p-3">
          {loadingSuggest ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-blue-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : visibleSuggestions.length > 0 ? (
            <ul className="space-y-1.5">
              {visibleSuggestions.map((s, idx) => (
                <li
                  key={s.name}
                  className={`flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl border transition-colors ${
                    s.ai_competitor
                      ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-gray-400 font-bold w-4 shrink-0">{idx + 1}</span>
                      <span className="text-sm font-semibold text-gray-800 truncate">{s.name}</span>
                      {s.ai_competitor && (
                        <span className="shrink-0 text-sm font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full">AI 언급</span>
                      )}
                      {s.category_name && (
                        <span className="shrink-0 text-sm text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full truncate max-w-[110px]">{s.category_name}</span>
                      )}
                    </div>
                    {s.address && (
                      <div className="text-sm text-gray-400 truncate mt-0.5 pl-5">
                        <MapPin className="w-3 h-3 inline mr-0.5" />{s.address}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => doAdd(s.name, s.address).catch(() => {})}
                      className="text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg px-3 py-1.5 transition-colors font-semibold"
                    >
                      + 추가
                    </button>
                    <button
                      onClick={() => handleDismissSuggestion(s.name)}
                      className="text-gray-300 hover:text-gray-500 transition-colors p-1"
                      title="이 추천 숨기기"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-5">
              <Search className="w-8 h-8 text-blue-200 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-500">AI 스캔 후 경쟁사가 자동으로 발견됩니다</p>
              <p className="text-sm text-gray-400 mt-1">스캔을 먼저 실행해주세요</p>
            </div>
          )}
        </div>
      </div>

      {/* 선택 팁 */}
      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-800 mb-1">경쟁 가게 선택 팁</p>
            <p className="text-sm text-blue-700 leading-relaxed">같은 지역·업종의 가게를 등록하세요. 스캔 시 AI 검색 노출 순위를 자동으로 비교합니다.</p>
          </div>
        </div>
      </div>
    </div>
  )

  // analysisPanel 제거됨 — PC 레이아웃에서 추이 차트를 직접 렌더링, 순위 비교는 Hero 카드와 중복으로 제거

  // ── 격차 분석 패널 — PlaceCompareTable 통합 + 키워드 탭 ──
  const gapPanel = gapAnalysis ? (
    <div className="space-y-4">
      {/* 네이버 전용 리스크 경고 */}
      {gapAnalysis.naver_only_risk && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">웹사이트 없음 — ChatGPT·Gemini 노출 제한</p>
            <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
              네이버는 글로벌 AI 크롤러를 차단합니다. 독립 웹사이트가 없으면 ChatGPT·Gemini에서 내 가게를 찾지 못합니다.
              {gapAnalysis.naver_only_risk_score_impact > 0 && (
                <span className="font-semibold"> 웹사이트 구축 시 최대 +{gapAnalysis.naver_only_risk_score_impact.toFixed(1)}점 상승 예상.</span>
              )}
            </p>
            <a href="/guide" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 mt-2 underline underline-offset-2">
              웹사이트 없이도 노출 높이는 방법 보기 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* GapAnalysisCard + 가이드 링크 */}
      {(gapAnalysis.dimensions?.length ?? 0) > 0 && (
        <div>
          <GapAnalysisCard gap={gapAnalysis} />
          <div className="flex justify-end mt-2">
            <a href="/guide" className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
              AI 가이드에서 항목별 개선 방법 보기 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* 스마트플레이스 비교표 — 격차 분석 내로 이동 */}
      {canViewBasic && (
        <PlaceCompareTable
          bizId={business.id}
          currentPlan={currentPlan}
          authToken={accessToken}
        />
      )}

      {/* 키워드 격차 — 탭으로 압축 */}
      {gapAnalysis.keyword_gap && (() => {
        const kw = gapAnalysis.keyword_gap!
        const hasExclusive = (kw.competitor_only_keywords?.length ?? 0) > 0
        const hasPioneer = (kw.pioneer_keywords?.length ?? 0) > 0
        const hasCommon = (kw.present_keywords?.length ?? 0) > 0
        const hasCompare = !!(gapAnalysis.keyword_gap?.competitor_keyword_sources &&
          Object.keys(gapAnalysis.keyword_gap.competitor_keyword_sources).length > 0)

        const tabs = [
          { key: 'exclusive' as const, label: '경쟁사 독점', count: kw.competitor_only_keywords?.length ?? 0, show: hasExclusive },
          { key: 'pioneer' as const, label: '내 선점', count: kw.pioneer_keywords?.length ?? 0, show: hasPioneer },
          { key: 'common' as const, label: '공통', count: kw.present_keywords?.length ?? 0, show: hasCommon },
          { key: 'compare' as const, label: '경쟁사별', count: 0, show: hasCompare },
        ].filter(t => t.show)

        if (tabs.length === 0) return null

        // 현재 kwTab에 해당하는 데이터가 없으면 첫 번째 유효 탭으로 폴백
        const activeTabKey = tabs.find(t => t.key === kwTab)?.key ?? tabs[0].key

        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-bold text-gray-700">키워드 격차 분석</span>
            </div>
            {/* 탭 */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 overflow-x-auto">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setKwTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTabKey === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-sm px-1.5 py-0.5 rounded-full font-bold ${
                      activeTabKey === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                    }`}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            {activeTabKey === 'exclusive' && hasExclusive && (
              <div>
                <p className="text-sm text-red-600 mb-3">경쟁 가게 리뷰에는 있지만 내 리뷰에는 없는 키워드입니다. 리뷰 유도 문구에 반영하세요.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {kw.competitor_only_keywords.map((w: string) => (
                    <span key={w} className="bg-red-100 text-red-700 text-sm font-medium px-3 py-1 rounded-full border border-red-200">{w}</span>
                  ))}
                </div>
                <a href="/guide" className="inline-flex items-center gap-1 text-sm text-red-600 font-semibold hover:underline">
                  가이드에서 이 키워드 개선 방법 보기 <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {activeTabKey === 'pioneer' && hasPioneer && (
              <PioneerKeywordsCard
                bizId={business.id}
                pioneerKeywords={kw.pioneer_keywords}
                accessToken={accessToken}
              />
            )}

            {activeTabKey === 'common' && hasCommon && (
              <div>
                <p className="text-sm text-blue-600 mb-3">이미 보유한 키워드이지만 경쟁사도 동일하게 가지고 있어 차별화가 되지 않습니다.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {kw.present_keywords.slice(0, 10).map((w: string) => (
                    <span key={w} className="bg-blue-100 text-blue-600 text-sm px-3 py-1 rounded-full border border-blue-200">{w}</span>
                  ))}
                </div>
                <a href="/guide" className="inline-flex items-center gap-1 text-sm text-blue-600 font-semibold hover:underline">
                  차별화 키워드 만드는 방법 가이드 보기 <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {activeTabKey === 'compare' && hasCompare && gapAnalysis.keyword_gap?.competitor_keyword_sources && (
              <CompetitorKeywordCompare
                competitorKeywordSources={gapAnalysis.keyword_gap.competitor_keyword_sources}
              />
            )}
          </div>
        )
      })()}
    </div>
  ) : null

  // ── Hero 비교 카드 ──
  const heroCard = (() => {
    if (competitors.length === 0) return null
    if (!competitorScores) return null
    const allEntries: { name: string; score: number; isMe: boolean }[] = [
      { name: business.name, score: Math.round(myScore), isMe: true },
      ...competitors
        .filter(c => competitorScores[c.id])
        .map(c => ({ name: c.name, score: Math.round(competitorScores[c.id]!.score), isMe: false })),
    ].sort((a, b) => b.score - a.score)
    const myRankIdx = allEntries.findIndex(e => e.isMe)
    const myRank = myRankIdx + 1
    const total = allEntries.length
    const leader = allEntries[0]
    const gap = leader && !leader.isMe ? leader.score - Math.round(myScore) : 0

    const isEstimated = competitorScores === null
    return (
      <div className={`rounded-2xl border p-4 md:p-5 mb-5 ${isEstimated ? 'bg-amber-50 border-amber-200' : myRank === 1 ? 'bg-emerald-50 border-emerald-200' : gap > 15 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-4">
          {/* 순위 배지 */}
          <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 ${isEstimated ? 'bg-amber-500' : myRank === 1 ? 'bg-emerald-600' : gap > 15 ? 'bg-red-500' : 'bg-amber-500'}`}>
            <span className="text-white font-black text-2xl md:text-3xl leading-none">{myRank}위</span>
            <span className="text-white/80 text-sm font-medium">/ {total}곳</span>
          </div>
          {/* 상황 요약 + topTip */}
          <div className="flex-1 min-w-0">
            <p className="text-base md:text-lg font-bold text-gray-900">
              {isEstimated ? '스캔 전 임시 순위' : myRank === 1 ? '현재 1위입니다!' : `${leader?.name}에 ${gap}점 뒤처져 있어요`}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEstimated
                ? 'AI 스캔을 실행하면 경쟁사와의 실제 점수를 비교할 수 있습니다.'
                : myRank === 1
                ? '이 위치를 유지하려면 가이드의 개선 방법을 꾸준히 실천하세요.'
                : gap > 15
                ? '격차가 큽니다. 가이드에서 우선 순위 높은 항목부터 개선하세요.'
                : '조금만 더 노력하면 1위에 올라갈 수 있습니다.'}
            </p>
            {topTip && (
              <div className="flex items-center gap-2 mt-2.5 bg-white/80 rounded-xl px-3 py-2 border border-gray-200">
                <Zap className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-sm text-gray-700 flex-1 min-w-0"><strong className="text-gray-900">지금 할 일:</strong> {topTip}</span>
                <a href="/guide" className="text-sm text-blue-600 font-semibold shrink-0 hover:underline whitespace-nowrap">가이드 →</a>
              </div>
            )}
          </div>
        </div>

        {/* 점수 진행바 — 1위 대비 내 위치 */}
        {!isEstimated && total > 1 && (
          <div className="mt-3 pt-3 border-t border-black/5">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className={`font-semibold ${myRank === 1 ? 'text-emerald-700' : gap > 15 ? 'text-red-600' : 'text-amber-700'}`}>
                내 점수 <strong className="text-base">{Math.round(myScore)}</strong>점
              </span>
              {!leader.isMe && (
                <span className="text-gray-500">
                  1위({leader.name}) <strong className="text-gray-700">{leader.score}</strong>점
                </span>
              )}
            </div>
            <div className="h-2.5 bg-black/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${myRank === 1 ? 'bg-emerald-500' : gap > 15 ? 'bg-red-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(Math.round((Math.round(myScore) / Math.max(leader.score, 1)) * 100), 100)}%` }}
              />
            </div>
            {!leader.isMe && gap > 0 && (
              <p className="text-sm mt-1 text-gray-500">
                1위까지 <strong className={gap > 15 ? 'text-red-600' : 'text-amber-600'}>{gap}점</strong> 격차 — 가이드 개선 시 평균 2~4주 내 추격 가능
              </p>
            )}
          </div>
        )}
      </div>
    )
  })()

  return (
    <>
      {/* Hero 비교 카드 */}
      {heroCard}

      {/* ──────────────────────────────────
          PC 레이아웃 (md 이상)
      ────────────────────────────────── */}
      <div className="hidden md:block space-y-6">
        {/* 플랜 업그레이드 배너 */}
        {canViewBasic && !canViewTrack1 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800">창업패키지 · Pro · Biz에서 경쟁사 상세 분석 가능</p>
                <p className="text-sm text-blue-600 mt-0.5">네이버 노출 점수 항목별 비교, 점수 추이 차트 제공</p>
              </div>
            </div>
            <a href="/pricing" className="shrink-0 text-sm font-bold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap flex items-center gap-1.5">
              업그레이드 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
        {canViewTrack1 && !canViewTrack2 && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-purple-800">Pro 플랜에서 AI 검색 채널 상세 분석 해제</p>
                <p className="text-sm text-purple-600 mt-0.5">ChatGPT·Gemini·Google AI 노출 항목별 비교</p>
              </div>
            </div>
            <a href="/pricing" className="shrink-0 text-sm font-bold bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap flex items-center gap-1.5">
              Pro 보기 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* 1. 경쟁사 관리 — SectionDivider 없이 그리드만 */}
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3 space-y-4">
            {competitorListSection}
          </div>
          <div className="col-span-2 space-y-4">
            {addPanel}
          </div>
        </div>

        {/* 2. 점수 비교 — 스캔 1회 이상 + 창업패키지 이상 */}
        {trendScans.length >= 1 && canViewTrend && (
          <>
            <SectionDivider title="점수 비교" icon={BarChart2} />
            <CompetitorTrendChart trendScans={trendScans} bizName={business.name} />
          </>
        )}

        {/* 3. 격차 분석 */}
        {gapPanel && (
          <>
            <SectionDivider title="격차 분석" icon={Target} />
            <p className="text-sm text-gray-500 -mt-3 mb-1">경쟁사와 차이가 나는 항목입니다. 점수 차이가 가장 큰 항목부터 개선하세요.</p>
            {gapPanel}
          </>
        )}

        {/* 4. SNS/카카오 공유 카드 — 기본 접힘, 버튼 클릭 시 생성 */}
        {canViewBasic && competitorScores && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowGapCard(v => !v)}
              className="w-full flex items-center justify-between px-4 md:px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">경쟁 현황 카드 만들기</span>
                <span className="text-sm text-gray-400">SNS · 카카오톡 공유용</span>
              </div>
              {showGapCard
                ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              }
            </button>
            {showGapCard && (
              <div className="px-4 md:px-5 pb-4">
                <GapCard
                  bizId={business.id}
                  bizName={business.name}
                  myScore={myScore}
                  competitorScores={competitorScores}
                  onRequestScan={() => setShowInlineScan(true)}
                />
              </div>
            )}
          </div>
        )}

        {/* 5. 진단·이력 */}
        <SectionDivider title="진단·이력" icon={Clock} />
        {canViewBasic && accessToken && (
          <CompetitorTimeline
            bizId={business.id}
            accessToken={accessToken}
            plan={currentPlan}
            bizName={business.name}
            competitors={competitors.map(c => ({ id: c.id, name: c.name }))}
          />
        )}
      </div>

      {/* ──────────────────────────────────
          모바일 레이아웃 (md 미만)
      ────────────────────────────────── */}
      <div className="md:hidden">
        {/* 플랜 업그레이드 배너 */}
        {canViewBasic && !canViewTrack1 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
            <div className="flex items-start gap-2 mb-2">
              <Lock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm font-bold text-blue-800">창업패키지 · Pro · Biz에서 경쟁사 상세 분석 가능</p>
            </div>
            <a href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              업그레이드 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* 모바일 탭 네비게이션 — 4탭 */}
        <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1.5 mb-4">
          {[
            { key: 'list' as const, label: '경쟁사 목록', shortLabel: '목록', icon: Users },
            { key: 'add' as const, label: '경쟁사 등록', shortLabel: '등록', icon: Plus },
            { key: 'analysis' as const, label: '격차 분석', shortLabel: '격차', icon: Target },
            { key: 'data' as const, label: '점수 비교', shortLabel: '비교', icon: BarChart2 },
          ].map(({ key, label, shortLabel, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mobileTab === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </button>
          ))}
        </div>

        {/* 모바일 탭 콘텐츠 */}
        {mobileTab === 'list' && competitorListSection}
        {mobileTab === 'add' && addPanel}
        {mobileTab === 'analysis' && (
          <div className="space-y-4">
            {gapPanel ? (
              <>
                <p className="text-sm text-gray-500">경쟁사와 차이가 나는 항목입니다. 점수 차이가 가장 큰 항목부터 개선하세요.</p>
                {gapPanel}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                경쟁사를 등록하고 AI 스캔을 실행하면 격차 분석이 표시됩니다.
              </div>
            )}
          </div>
        )}
        {mobileTab === 'data' && (
          <div className="space-y-4">
            {trendScans.length >= 1 && canViewTrend && (
              <CompetitorTrendChart trendScans={trendScans} bizName={business.name} />
            )}
            {/* 공유 카드 — 기본 접힘 */}
            {canViewBasic && competitorScores && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setShowGapCard(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">경쟁 현황 카드 만들기</span>
                    <span className="text-sm text-gray-400">SNS · 카카오</span>
                  </div>
                  {showGapCard
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                </button>
                {showGapCard && (
                  <div className="px-4 pb-4">
                    <GapCard
                      bizId={business.id}
                      bizName={business.name}
                      myScore={myScore}
                      competitorScores={competitorScores}
                      onRequestScan={() => setShowInlineScan(true)}
                    />
                  </div>
                )}
              </div>
            )}
            {canViewBasic && accessToken && (
              <CompetitorTimeline
                bizId={business.id}
                accessToken={accessToken}
                plan={currentPlan}
                bizName={business.name}
                competitors={competitors.map(c => ({ id: c.id, name: c.name }))}
              />
            )}
          </div>
        )}
      </div>

      {/* 1:1 비교 모달 */}
      {compareCompId && (() => {
        const comp = competitors.find(c => c.id === compareCompId)
        const cs   = competitorScores?.[compareCompId] ?? null
        if (!comp) return null
        return (
          <CompareModal
            bizName={business.name}
            myScore={myScore}
            myReviewCount={myReviewCount}
            myAvgRating={myAvgRating}
            myBlogMentions={myBlogMentions}
            competitor={comp}
            compScore={cs}
            onClose={() => setCompareCompId(null)}
          />
        )
      })()}

      {/* 인라인 스캔 모달 */}
      {showInlineScan && (
        <InlineScanModal
          businessId={business.id}
          onClose={() => setShowInlineScan(false)}
          onComplete={() => {
            setShowInlineScan(false)
            window.location.reload()
          }}
        />
      )}

      {/* 스캔 제안 모달 */}
      {scanPromptName && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-base md:text-lg mb-2 text-center">경쟁 가게가 추가되었습니다!</h3>
            <p className="text-sm md:text-base text-gray-500 mb-1 text-center leading-relaxed">
              지금 바로 스캔하면 <strong className="text-gray-900">{scanPromptName}</strong>과의<br />
              AI 검색 노출 점수를 비교할 수 있습니다.
            </p>
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2 text-center leading-relaxed">
              스캔하지 않으면 경쟁사 점수가 표시되지 않습니다.<br />
              지금 스캔하지 않으면 다음 자동 스캔(새벽 2시)에 비교 데이터가 나타납니다.
            </p>
            <p className="text-sm text-gray-500 mt-1 mb-3 text-center">
              키워드 비교 데이터는 <strong>내일 새벽 4시</strong> 자동 수집 후 가이드 페이지에 표시됩니다.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => { setScanPromptName(null); setShowInlineScan(true) }}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />지금 여기서 AI 스캔 실행
              </button>
              <button
                onClick={() => { setScanPromptName(null); router.push('/dashboard') }}
                className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
              >
                대시보드에서 스캔하기 <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setScanPromptName(null)}
                className="w-full text-gray-400 py-1.5 text-sm hover:text-gray-600 transition-colors"
              >
                나중에 하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 내 키워드 설정 모달 */}
      <KeywordManagerModal
        bizId={business.id}
        accessToken={accessToken}
        isOpen={keywordModalOpen}
        onClose={() => setKeywordModalOpen(false)}
        onChange={() => {
          // 변경 반영을 위해 페이지 재조회 — Gap/Pioneer 키워드 재계산
          router.refresh()
        }}
      />
    </>
  )
}
