'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Search, Plus, Lock, Star, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Target, Award, BarChart2, AlertCircle,
  MapPin, Trash2, RefreshCw, Share2, Crown, Zap, Shield, CheckCircle2,
  Info, ArrowRight, Building2,
} from 'lucide-react'
import { CompetitorPlaceCard } from '@/components/competitors/CompetitorPlaceCard'
import { syncCompetitorPlace } from '@/lib/api'

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
  } | null
}
interface Suggestion { name: string; address: string; region: string; score: number }
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

interface LeafletMarker { remove(): void }
interface LeafletMap { setView(c: [number, number], z: number): LeafletMap; fitBounds(b: LeafletBounds): void }
interface LeafletBounds { pad(p: number): LeafletBounds }
interface LeafletLib {
  map(el: HTMLDivElement, opts: Record<string, unknown>): LeafletMap
  tileLayer(url: string, opts: Record<string, unknown>): { addTo(m: LeafletMap): void }
  divIcon(opts: Record<string, unknown>): unknown
  marker(latlng: [number, number], opts: Record<string, unknown>): { addTo(m: LeafletMap): LeafletMarker & { bindPopup(s: string): LeafletMarker & { addTo(m: LeafletMap): LeafletMarker } } }
  featureGroup(markers: LeafletMarker[]): { getBounds(): LeafletBounds }
}
declare global { interface Window { L?: LeafletLib } }

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

const TRACK1_LABELS: Record<string, string> = {
  keyword_gap_score:        '키워드 커버리지',
  review_quality:           '리뷰·평점',
  smart_place_completeness: '스마트플레이스 완성도',
  naver_exposure_confirmed: '네이버 AI 브리핑 노출',
}
const TRACK2_LABELS: Record<string, string> = {
  multi_ai_exposure:  'AI 검색 노출',
  schema_seo:         '웹사이트 구조화',
  online_mentions_t2: '온라인 언급 수',
  google_presence:    'Google AI 노출',
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
  free: 0, basic: 1, startup: 2, pro: 3, biz: 4, enterprise: 5,
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
function GapCard({ bizId, bizName, myScore }: { bizId: string; bizName: string; myScore: number }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
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
        {!imgUrl && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />생성 중</> : '카드 생성'}
          </button>
        )}
      </div>
      {imgUrl && (
        <div className="space-y-2">
          <img src={imgUrl} alt="경쟁 현황 카드" className="w-full rounded-xl border border-gray-100" />
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 text-sm bg-amber-400 text-gray-900 font-semibold py-2 rounded-lg hover:bg-amber-500 transition-colors flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied ? '저장됨 ✓' : '공유 / 저장'}
            </button>
            <button
              onClick={() => { setImgUrl(null); generate() }}
              className="text-sm border border-gray-200 text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
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
  userId: string
  trendScans?: TrendScan[]
  competitorScores?: Record<string, CompetitorScore> | null
  lastScannedAt?: string | null
  currentPlan?: string
  planLimit?: number
  accessToken?: string
}

// 점수 추이 차트
function CompetitorTrendChart({ trendScans, bizName }: { trendScans: TrendScan[]; bizName: string }) {
  if (trendScans.length < 2) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          <div className="text-sm font-semibold text-gray-700">점수 변화 추이</div>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">스캔을 2회 이상 실행하면 경쟁사와의 점수 변화를 확인할 수 있습니다.</p>
      </div>
    )
  }

  const compNames = new Set<string>()
  trendScans.forEach(s => {
    if (s.competitor_scores) Object.values(s.competitor_scores).forEach(c => compNames.add(c.name))
  })

  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6']
  const compList = [...compNames].slice(0, 5)

  const points = trendScans.map(s => {
    const date = new Date(s.scanned_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    const row: Record<string, string | number> = { date, me: Math.round(s.total_score) }
    compList.forEach(name => {
      const entry = s.competitor_scores ? Object.values(s.competitor_scores).find(c => c.name === name) : undefined
      row[name] = entry ? entry.score : 0
    })
    return row
  })

  const latest = points[points.length - 1]
  const allScores = [
    { name: bizName, score: latest.me as number },
    ...compList.map(n => ({ name: n, score: latest[n] as number })),
  ].sort((a, b) => b.score - a.score)
  const myRank = allScores.findIndex(x => x.name === bizName) + 1
  const maxY = Math.max(...points.flatMap(p => [p.me as number, ...compList.map(n => p[n] as number)]), 10)

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          <div>
            <div className="text-sm font-semibold text-gray-700">점수 변화 추이</div>
            <div className="text-sm text-gray-400">최근 {trendScans.length}회 스캔</div>
          </div>
        </div>
        <div className={`text-sm font-semibold px-2.5 py-1 rounded-full border ${
          myRank === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : myRank <= 3 ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-gray-50 text-gray-600 border-gray-200'
        }`}>
          현재 {myRank}위
        </div>
      </div>

      <div className="relative h-28 flex items-end gap-1 mb-3">
        {points.map((p, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <div
              className="w-full bg-blue-500 rounded-t-sm opacity-90"
              style={{ height: `${((p.me as number) / maxY) * 100}%` }}
              title={`내 가게: ${p.me}점`}
            />
          </div>
        ))}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {compList.map((name, ci) => {
            const pts = points.map((p, i) => {
              const x = ((i + 0.5) / points.length) * 100
              const y = 100 - ((p[name] as number) / maxY) * 100
              return `${x},${y}`
            })
            return <polyline key={name} points={pts.join(' ')} fill="none" stroke={COLORS[ci % COLORS.length]} strokeWidth="1.5" strokeDasharray="3,2" />
          })}
          <polyline
            points={points.map((p, i) => `${((i + 0.5) / points.length) * 100},${100 - ((p.me as number) / maxY) * 100}`).join(' ')}
            fill="none" stroke="#3b82f6" strokeWidth="2"
          />
        </svg>
      </div>

      <div className="flex justify-between text-sm text-gray-400 mb-3">
        {points.map((p, i) => (
          <span key={i} className="flex-1 text-center truncate">{p.date}</span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        <div className="flex items-center gap-1 text-sm text-gray-700">
          <div className="w-3 h-1.5 bg-blue-500 rounded" />
          <span className="font-medium">{bizName}</span>
        </div>
        {compList.map((name, ci) => (
          <div key={name} className="flex items-center gap-1 text-sm text-gray-500">
            <div className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: COLORS[ci % COLORS.length] }} />
            <span>{name}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        {allScores.map((x, i) => (
          <div key={x.name} className={`flex items-center justify-between text-sm ${x.name === bizName ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
            <span className="flex items-center gap-2">
              <RankBadge rank={i + 1} />
              {x.name === bizName ? `${x.name} (내 가게)` : x.name}
            </span>
            <span className={`font-semibold px-2 py-0.5 rounded-lg text-sm border ${getScoreBadgeCls(x.score)}`}>{x.score}점</span>
          </div>
        ))}
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
  const leafletMap = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LeafletMarker[]>([])

  useEffect(() => {
    if (!mapRef.current) return
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const init = (L: LeafletLib) => {
      if (!mapRef.current) return
      const center = getRegionCenter(region)
      if (!leafletMap.current) {
        leafletMap.current = L.map(mapRef.current, { zoomControl: true }).setView(center, 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 18,
        }).addTo(leafletMap.current)
      } else {
        leafletMap.current.setView(center, 13)
      }
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      // 검색 결과 마커 (파란색)
      const searchIcon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;background:#2563eb;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>`,
        iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16],
      })
      if (results.length > 0) {
        results.forEach((r, i) => {
          const rLat = parseFloat(r.lat ?? '')
          const rLng = parseFloat(r.lng ?? '')
          const hasCoord = !isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0
          const angle = (i / Math.max(results.length, 1)) * 2 * Math.PI
          const radius = 0.003 + i * 0.0008
          const lat = hasCoord ? rLat : center[0] + radius * Math.sin(angle)
          const lng = hasCoord ? rLng : center[1] + radius * Math.cos(angle)
          const marker = L.marker([lat, lng], { icon: searchIcon })
            .addTo(leafletMap.current!)
            .bindPopup(`<div style="font-size:13px;font-weight:600;margin-bottom:2px">${r.name}</div><div style="font-size:11px;color:#666">${r.address}</div>`)
          markersRef.current.push(marker)
        })
      }

      // 등록된 경쟁사 마커 (주황색 — 좌표 있는 경우만)
      const registeredIcon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;background:#f97316;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>`,
        iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
      })
      registeredCompetitors.forEach((c) => {
        if (!c.lat || !c.lng) return
        const marker = L.marker([c.lat, c.lng], { icon: registeredIcon })
          .addTo(leafletMap.current!)
          .bindPopup(`<div style="font-size:13px;font-weight:700;margin-bottom:2px;color:#f97316">★ 등록된 경쟁사</div><div style="font-size:13px;font-weight:600;margin-bottom:2px">${c.name}</div><div style="font-size:11px;color:#666">${c.address ?? ''}</div>`)
        markersRef.current.push(marker)
      })

      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current)
        leafletMap.current!.fitBounds(group.getBounds().pad(0.3))
      }
    }

    if (window.L) {
      init(window.L)
    } else {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => { if (window.L) init(window.L) }
      document.head.appendChild(script)
    }
  }, [results, region, registeredCompetitors])

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50" style={{ height: 220, position: 'relative', zIndex: 0 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
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

// 메인 컴포넌트
// ========================
export function CompetitorsClient({
  business,
  competitors: initial,
  myScore,
  myReviewCount = 0,
  myAvgRating = 0,
  userId,
  trendScans = [],
  competitorScores,
  lastScannedAt,
  currentPlan = 'basic',
  planLimit = 3,
  accessToken = '',
}: Props) {
  const router = useRouter()
  const [competitors, setCompetitors] = useState(initial)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<AddTab>('search')
  // 모바일 탭 상태 (목록 / 등록 / 분석)
  const [mobileTab, setMobileTab] = useState<'list' | 'add' | 'analysis'>('list')
  const [scanPromptName, setScanPromptName] = useState<string | null>(null)
  const [planLimitHit, setPlanLimitHit] = useState(false)

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

  const canViewBasic   = planAtLeast(currentPlan, 'basic')
  const canViewTrack1  = planAtLeast(currentPlan, 'startup')
  const canViewTrack2  = planAtLeast(currentPlan, 'pro')
  const canViewTrend   = planAtLeast(currentPlan, 'startup')
  const canViewRanking = planAtLeast(currentPlan, 'basic')

  const hasCompetitorData = competitors.length > 0 && competitorScores && Object.keys(competitorScores).length > 0

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoadingSuggest(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${BACKEND}/api/competitors/suggest/list?category=${business.category}&region=${encodeURIComponent(business.region)}&business_id=${business.id}`,
          { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } }
        )
        if (res.ok) setSuggestions(await res.json())
      } catch {}
      finally { setLoadingSuggest(false) }
    }
    fetchSuggestions()
  }, [business.id, business.category, business.region])

  const getFreshToken = async (): Promise<string> => {
    const { data: { session } } = await createClient().auth.getSession()
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
    const token = await getFreshToken()
    await fetch(`${BACKEND}/api/competitors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    setCompetitors(competitors.filter(c => c.id !== id))
    router.refresh()
  }

  const alreadyAdded = new Set(competitors.map(c => c.name))

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
          <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${
            limitReached
              ? 'bg-red-50 text-red-600 border-red-200'
              : 'bg-blue-50 text-blue-600 border-blue-200'
          }`}>
            {planLimit >= 999 ? `${competitors.length}개` : `${competitors.length} / ${planLimit}개`}
          </span>
        </div>
      </div>

      {/* 내 가게 기준 바 */}
      {myScore > 0 && competitors.length > 0 && (
        <div className="px-4 md:px-6 py-3 bg-blue-50/60 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-24 md:w-32 shrink-0">
              <Star className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm text-blue-700 font-bold">내 가게</span>
            </div>
            <div className="flex-1 h-2.5 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(myScore, 100)}%` }} />
            </div>
            <span className={`text-sm font-bold w-14 text-right border rounded-lg px-2 py-0.5 ${getScoreBadgeCls(myScore)}`}>
              {Math.round(myScore)}점
            </span>
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {competitors.length === 0 ? (
        <div className="p-8 md:p-10 text-center">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-100">
            <Building2 className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
          </div>
          <p className="text-base md:text-lg font-bold text-gray-800 mb-2">아직 경쟁 가게가 없습니다</p>
          <p className="text-sm md:text-base text-gray-400 mb-6 leading-relaxed max-w-xs mx-auto">
            주변 경쟁 가게를 등록하면<br />AI 검색 노출 점수를 비교할 수 있습니다.
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left space-y-2 text-sm text-gray-500 max-w-sm mx-auto">
            <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-500" />사용 방법
            </p>
            <p className="flex items-start gap-2"><span className="text-blue-500 font-bold shrink-0">1.</span> 오른쪽 &quot;지역 검색&quot; 탭에서 경쟁 가게 이름 입력</p>
            <p className="flex items-start gap-2"><span className="text-blue-500 font-bold shrink-0">2.</span> 검색 결과에서 경쟁 가게 선택 후 등록</p>
            <p className="flex items-start gap-2"><span className="text-blue-500 font-bold shrink-0">3.</span> 대시보드에서 &quot;AI 스캔 시작&quot; → 점수 비교 확인</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {competitors.map((c, idx) => {
            const cs = competitorScores?.[c.id]
            const isExpanded = expandedId === c.id

            const compRank = (() => {
              if (!cs || !competitorScores) return idx + 1
              const all = [
                { score: myScore },
                ...competitors.map(cc => ({ score: competitorScores[cc.id]?.score ?? 0 })),
              ].sort((a, b) => b.score - a.score)
              return all.findIndex(x => Math.abs(x.score - (competitorScores[c.id]?.score ?? 0)) < 0.01) + 1
            })()

            return (
              <li key={c.id} className="overflow-hidden transition-colors hover:bg-gray-50/50">
                <div className="px-4 md:px-6 py-4 min-h-[4rem]">
                  <div className="flex items-start justify-between gap-3">
                    {/* 순위 + 정보 */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        {cs ? <RankBadge rank={compRank} /> : (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-400 font-bold text-sm">{idx + 1}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm md:text-base">{c.name}</span>
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

                        {/* 점수 게이지 바 */}
                        {cs ? (
                          <>
                            <div className="flex items-center gap-2 mt-2.5">
                              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getScoreBarColor(cs.score, myScore)} rounded-full transition-all duration-500`}
                                  style={{ width: `${Math.min(cs.score, 100)}%` }}
                                />
                              </div>
                              <span className={`text-sm font-bold ${getScoreColor(cs.score, myScore)} min-w-[3rem] text-right`}>
                                {Math.round(cs.score)}점
                              </span>
                              {cs.score > myScore
                                ? <TrendingUp className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                : <TrendingDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              }
                            </div>
                            {/* 점수 격차 한 줄 요약 */}
                            {myScore > 0 && (
                              <div className="mt-1.5">
                                {cs.score > myScore ? (
                                  <span className="text-sm text-red-500 font-medium">
                                    경쟁사가 내 가게보다 <strong>{Math.round(cs.score - myScore)}점 높음</strong> — 격차를 줄이려면 가이드를 확인하세요
                                  </span>
                                ) : cs.score < myScore ? (
                                  <span className="text-sm text-emerald-600 font-medium">
                                    내 가게가 이 경쟁사보다 <strong>{Math.round(myScore - cs.score)}점 앞섬</strong>
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400 font-medium">경쟁사와 동점</span>
                                )}
                              </div>
                            )}
                            {/* AI 검색 발췌 — excerpt 있으면 표시 */}
                            {cs.excerpt && (
                              <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                                <p className="text-sm text-gray-400 font-semibold mb-1">AI 검색에서 이 가게를 이렇게 소개합니다</p>
                                <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{cs.excerpt}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-400 mt-1.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />스캔 실행 후 점수가 표시됩니다
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 버튼 영역 */}
                    <div className="flex items-center gap-2 shrink-0">
                      {cs && canViewTrack1 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 transition-colors border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 font-medium"
                          title={isExpanded ? '상세 접기' : '상세 분석 보기'}
                        >
                          {isExpanded ? <><ChevronUp className="w-3.5 h-3.5" />접기</> : <><ChevronDown className="w-3.5 h-3.5" />상세</>}
                        </button>
                      )}
                      {cs && canViewBasic && !canViewTrack1 && (
                        <span
                          className="flex items-center gap-1 text-sm text-gray-300 cursor-default select-none border border-gray-200 rounded-lg px-2.5 py-1.5"
                          title="창업패키지 플랜부터 상세 분석을 볼 수 있습니다"
                        >
                          <Lock className="w-3.5 h-3.5" />상세
                        </span>
                      )}
                      <button
                        onClick={() => removeCompetitor(c.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                        title="경쟁사 삭제하기"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 확장: 네이버 플레이스 카드 */}
                  {isExpanded && canViewTrack1 && (
                    <CompetitorPlaceCard
                      competitor={{
                        ...c,
                        weakness_data: c.weakness_data ?? null,
                      }}
                      myReviewCount={myReviewCount}
                      myAvgRating={myAvgRating}
                      accessToken={accessToken}
                      myBlogMentions={0}
                      canViewStartup={canViewTrack1}
                      onSyncRequest={async () => {
                        const token = await getFreshToken()
                        await syncCompetitorPlace(c.id, token)
                        router.refresh()
                      }}
                      onPlaceIdSaved={() => router.refresh()}
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
                      </div>
                    )
                  })()}
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
          <div className="px-4 md:px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            대시보드에서 &quot;AI 스캔 시작&quot;을 누르면 각 경쟁 가게의 점수를 자동으로 비교합니다.
          </div>
        )
      )}
    </div>
  )

  // ── 등록 패널 ──
  const addPanel = (
    <div className="space-y-4">
      {/* 한도 초과 */}
      {(planLimitHit || limitReached) && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
            <div className="text-sm font-bold text-orange-900">
              경쟁사 등록 한도 ({planLimit}개)에 도달했습니다
            </div>
          </div>
          <p className="text-sm text-orange-700 mb-3">
            {currentPlan === 'basic'
              ? '창업패키지·Pro 플랜으로 업그레이드하면 경쟁사 10개까지 비교할 수 있습니다.'
              : currentPlan === 'pro'
              ? 'Biz 플랜으로 업그레이드하면 경쟁사를 무제한으로 등록할 수 있습니다.'
              : '현재 플랜의 최대 경쟁사 수에 도달했습니다.'}
          </p>
          <a href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors">
            요금제 보기 <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* 경쟁 가게 등록 카드 */}
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
              onClick={() => setTab('search')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'search'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Search className="w-3.5 h-3.5" />지역 검색
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === 'manual'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />직접 입력
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
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
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
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
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
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
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
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
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
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />추가 중...</> : <><Plus className="w-4 h-4" />경쟁 가게 추가하기</>}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* AEOlab 추천 */}
      {(loadingSuggest || suggestions.length > 0) && (
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">AEOlab 추천 경쟁 가게</div>
              <div className="text-sm text-gray-400">동종업계에서 AI 노출 상위 가게</div>
            </div>
          </div>
          {loadingSuggest ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {suggestions.filter(s => !alreadyAdded.has(s.name)).map(s => (
                <li key={s.name} className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-800 truncate">{s.name}</div>
                    {s.address && <div className="text-sm text-gray-400 truncate mt-0.5">{s.address}</div>}
                  </div>
                  <button
                    onClick={() => doAdd(s.name, s.address).catch(() => {})}
                    className="shrink-0 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 transition-colors hover:bg-blue-50 font-semibold"
                  >
                    + 추가
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

  // ── 분석 패널 ──
  const analysisPanel = (
    <div className="space-y-4">
      {/* AI 노출 순위 비교 */}
      {canViewRanking && hasCompetitorData && (() => {
        const ranked = competitors
          .map(c => ({ ...c, cs: competitorScores![c.id] }))
          .filter(c => c.cs)
          .sort((a, b) => b.cs!.score - a.cs!.score)
        if (ranked.length === 0) return null

        const leader = ranked[0]
        const allEntries: { name: string; score: number; isMe: boolean }[] = [
          { name: business.name, score: myScore, isMe: true },
          ...ranked.map(c => ({ name: c.name, score: Math.round(c.cs!.score), isMe: false })),
        ].sort((a, b) => b.score - a.score)

        return (
          <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <BarChart2 className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-sm md:text-base font-bold text-gray-800">AI 검색 노출 순위 비교</span>
            </div>
            <div className="space-y-2">
              {allEntries.map((entry, i) => (
                <div key={entry.name} className={`flex items-center gap-3 py-2.5 px-3 rounded-xl ${entry.isMe ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                  <RankBadge rank={i + 1} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm truncate block ${entry.isMe ? 'font-bold text-blue-700' : 'text-gray-700 font-medium'}`}>
                      {entry.name}{entry.isMe ? ' (내 가게)' : ''}
                    </span>
                  </div>
                  <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg border ${getScoreBadgeCls(entry.score)}`}>
                    {entry.score}점
                  </span>
                </div>
              ))}
            </div>
            {leader.cs && leader.cs.score > myScore && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                <TrendingUp className="w-4 h-4 text-red-400 shrink-0" />
                <span>1위 <strong className="text-gray-900">{leader.name}</strong>보다 <strong className="text-red-500">{Math.round(leader.cs.score - myScore)}점</strong> 낮습니다</span>
              </div>
            )}
            {allEntries[0]?.isMe && (
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
                <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>현재 <strong>1위</strong>입니다. 이 위치를 유지하세요!</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* 경쟁 현황 카드 공유 */}
      {canViewBasic && (
        <GapCard bizId={business.id} bizName={business.name} myScore={myScore} />
      )}

      {/* 점수 변화 추이 */}
      {canViewTrend ? (
        <CompetitorTrendChart trendScans={trendScans} bizName={business.name} />
      ) : canViewBasic ? (
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <div className="text-sm font-semibold text-gray-700">점수 변화 추이</div>
          </div>
          <LockedFeature requiredPlan="창업패키지" feature="경쟁사와 내 점수 변화를 시간순으로 비교" />
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      {/* ──────────────────────────────────
          PC 레이아웃 (md 이상)
      ────────────────────────────────── */}
      <div className="hidden md:grid md:grid-cols-5 gap-6">
        {/* 플랜 업그레이드 배너 */}
        {canViewBasic && !canViewTrack1 && (
          <div className="md:col-span-5 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800">창업패키지부터 경쟁사 상세 분석 가능</p>
                <p className="text-sm text-blue-600 mt-0.5">네이버 노출 점수 항목별 비교, 점수 추이 차트 제공</p>
              </div>
            </div>
            <a href="/pricing" className="shrink-0 text-sm font-bold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap flex items-center gap-1.5">
              업그레이드 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
        {canViewTrack1 && !canViewTrack2 && (
          <div className="md:col-span-5 bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
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

        {/* 좌측: 경쟁사 목록 (3/5) */}
        <div className="md:col-span-3 space-y-4">
          {competitorListSection}
        </div>

        {/* 우측: 등록 + 분석 (2/5) */}
        <div className="md:col-span-2 space-y-4">
          {addPanel}
          {analysisPanel}
        </div>
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
              <p className="text-sm font-bold text-blue-800">창업패키지부터 경쟁사 상세 분석 가능</p>
            </div>
            <a href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              업그레이드 <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* 모바일 탭 네비게이션 */}
        <div className="flex gap-1.5 bg-gray-100 rounded-2xl p-1.5 mb-4">
          {[
            { key: 'list' as const, label: '경쟁사 목록', icon: Users },
            { key: 'add' as const, label: '경쟁사 등록', icon: Plus },
            { key: 'analysis' as const, label: '분석', icon: BarChart2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mobileTab === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* 모바일 탭 콘텐츠 */}
        {mobileTab === 'list' && competitorListSection}
        {mobileTab === 'add' && addPanel}
        {mobileTab === 'analysis' && analysisPanel}
      </div>

      {/* 스캔 제안 모달 */}
      {scanPromptName && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-base md:text-lg mb-2 text-center">경쟁 가게가 추가되었습니다!</h3>
            <p className="text-sm md:text-base text-gray-500 mb-6 text-center leading-relaxed">
              지금 바로 스캔하면 <strong className="text-gray-900">{scanPromptName}</strong>과의<br />
              AI 검색 노출 점수를 비교할 수 있습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setScanPromptName(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                나중에
              </button>
              <button
                onClick={() => { setScanPromptName(null); router.push('/dashboard') }}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
              >
                지금 비교 스캔 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
