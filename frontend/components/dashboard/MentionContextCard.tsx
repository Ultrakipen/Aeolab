'use client'

import { Search, CheckCircle, XCircle, MinusCircle, AlertCircle } from "lucide-react"
import { MentionContext } from "@/types"

interface Props {
  citation: MentionContext
}

const PLATFORM_COLOR: Record<string, { dot: string; text: string; bg: string; initial: string }> = {
  chatgpt: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-100', initial: 'C' },
  gemini:  { dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-100',  initial: 'G' },
  naver:   { dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-100',    initial: 'N' },
  google:  { dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-100',    initial: 'G' },
}

const PLATFORM_LABEL: Record<string, string> = {
  naver:   '네이버 AI 브리핑',
  gemini:  'Google Gemini',
  chatgpt: 'ChatGPT',
  google:  'Google AI Overview',
}

const MENTION_TYPE_LABEL: Record<string, string> = {
  recommendation: '추천으로 언급됨',
  information:    '정보로 언급됨',
  comparison:     '비교 대상으로 언급됨',
  warning:        '부정적 맥락으로 언급됨',
}

// 언급 카드 — 감성별 배경·테두리
const SENTIMENT_CARD_STYLE: Record<string, string> = {
  positive: 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300',
  neutral:  'bg-gradient-to-br from-sky-50 to-blue-50 border-blue-200',
  negative: 'bg-red-50 border-red-200',
}

// 언급 카드 — 감성별 glow ring + shadow
const SENTIMENT_GLOW: Record<string, string> = {
  positive: 'ring-2 ring-emerald-300/60 shadow-lg shadow-emerald-100',
  neutral:  'ring-2 ring-blue-300/50 shadow-md shadow-blue-50',
  negative: 'ring-1 ring-red-200/60 shadow-sm',
}

// 언급 카드 상단 shimmer bar 색상
const SENTIMENT_SHIMMER: Record<string, string> = {
  positive: 'from-emerald-400 via-green-300 to-emerald-400',
  neutral:  'from-blue-400 via-sky-300 to-blue-400',
  negative: 'from-red-400 via-rose-300 to-red-400',
}

// 언급 카드 pulsing dot 색상
const SENTIMENT_PULSE: Record<string, string> = {
  positive: 'bg-emerald-500',
  neutral:  'bg-blue-500',
  negative: 'bg-red-400',
}

const SENTIMENT_BADGE_STYLE: Record<string, string> = {
  positive: 'bg-green-100 text-green-700 font-semibold',
  neutral:  'bg-blue-100 text-blue-700 font-semibold',
  negative: 'bg-red-100 text-red-700 font-semibold',
}

const SENTIMENT_LABEL: Record<string, string> = {
  positive: '긍정 언급',
  neutral:  '중립 언급',
  negative: '부정 언급',
}

function SentimentIcon({ sentiment, className }: { sentiment: string; className?: string }) {
  const cls = className ?? 'w-3.5 h-3.5'
  if (sentiment === 'positive') return <CheckCircle className={cls} />
  if (sentiment === 'negative') return <AlertCircle className={cls} />
  return <MinusCircle className={cls} />
}

export function MentionContextCard({ citation }: Props) {
  const isNotMentioned = citation.mentioned === false
  const platformKey = citation.platform?.toLowerCase() ?? ''
  const platformColor = PLATFORM_COLOR[platformKey] ?? { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100', initial: '?' }
  const platformLabel = citation.platform_label || PLATFORM_LABEL[platformKey] || citation.platform
  const sentiment = citation.sentiment ?? 'neutral'
  const typeLabel = MENTION_TYPE_LABEL[citation.mention_type] ?? citation.mention_type

  // 미언급 카드
  if (isNotMentioned) {
    return (
      <div className="rounded-xl border bg-gray-50 border-gray-200 opacity-55 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full ${platformColor.dot} flex items-center justify-center opacity-60`}>
              <span className="text-white text-xs font-bold">{platformColor.initial}</span>
            </div>
            <span className="font-semibold text-sm text-gray-500">{platformLabel}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            <XCircle className="w-3 h-3" />
            미언급
          </span>
        </div>
        {citation.query && (
          <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1 mb-3">
            <Search className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <span className="text-sm text-gray-500 font-medium">&ldquo;{citation.query}&rdquo;</span>
          </div>
        )}
        <p className="text-sm text-gray-500">
          이 검색어에서 아직 언급되지 않았습니다.{' '}
          <span className="text-xs">온라인 콘텐츠가 쌓이면 수개월 내 개선됩니다.</span>
        </p>
      </div>
    )
  }

  // 언급된 카드 — glow + shimmer + pulse
  const cardStyle = SENTIMENT_CARD_STYLE[sentiment] ?? SENTIMENT_CARD_STYLE.neutral
  const glowStyle = SENTIMENT_GLOW[sentiment] ?? ''
  const shimmerColor = SENTIMENT_SHIMMER[sentiment] ?? SENTIMENT_SHIMMER.neutral
  const pulseColor = SENTIMENT_PULSE[sentiment] ?? 'bg-emerald-500'
  const badgeStyle = SENTIMENT_BADGE_STYLE[sentiment] ?? SENTIMENT_BADGE_STYLE.neutral

  const hasExcerpt = citation.excerpt && !citation.excerpt.includes('(구체적 인용문 없음)') && citation.excerpt.trim() !== ''

  return (
    <div className={`rounded-xl border p-4 relative overflow-hidden ${cardStyle} ${glowStyle}`}>
      {/* 상단 shimmer bar */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${shimmerColor}`} />

      {/* 1. 헤더 행 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* 플랫폼 아이콘 + pulsing dot */}
          <div className="relative">
            <div className={`w-7 h-7 rounded-full ${platformColor.dot} flex items-center justify-center shrink-0`}>
              <span className="text-white text-xs font-bold">{platformColor.initial}</span>
            </div>
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${pulseColor}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${pulseColor}`} />
            </span>
          </div>
          <span className={`font-semibold text-sm ${platformColor.text}`}>{platformLabel}</span>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${badgeStyle}`}>
          <SentimentIcon sentiment={sentiment} className="w-3 h-3" />
          {SENTIMENT_LABEL[sentiment] ?? sentiment}
        </span>
      </div>

      {/* 2. 검색어 pill */}
      {citation.query && (
        <div className="inline-flex items-center gap-1.5 bg-white/80 border border-white rounded-full px-3 py-1 mb-3">
          <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="text-sm text-gray-700 font-medium">&ldquo;{citation.query}&rdquo;</span>
        </div>
      )}

      {/* 3. 인용문 blockquote */}
      {hasExcerpt && (
        <blockquote className="text-sm italic border-l-2 border-current/30 pl-3 mb-3 text-gray-700 leading-relaxed">
          &ldquo;{citation.excerpt}&rdquo;
        </blockquote>
      )}

      {/* 4. mention_type 라벨 */}
      {typeLabel && (
        <p className="text-xs text-gray-500 mb-2">{typeLabel}</p>
      )}

      {/* 5. 속성 태그들 */}
      {citation.mentioned_attributes && citation.mentioned_attributes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-1">
          {citation.mentioned_attributes.map((attr) => (
            <span key={attr} className="text-xs bg-white/70 border border-white/60 rounded-full px-2 py-0.5 text-gray-600">
              #{attr}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
