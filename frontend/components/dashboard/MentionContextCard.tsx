'use client'

import { Search } from "lucide-react"
import { MentionContext } from "@/types"

interface Props {
  citation: MentionContext
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "bg-green-50 border-green-200 text-green-800",
  neutral: "bg-gray-50 border-gray-200 text-gray-800",
  negative: "bg-red-50 border-red-200 text-red-800",
}

const PLATFORM_LABEL: Record<string, string> = {
  naver:   '네이버 AI 브리핑',
  gemini:  'Google Gemini',
  chatgpt: 'ChatGPT',
  google:  'Google AI Overview',
}

const MENTION_TYPE_LABEL: Record<string, string> = {
  recommendation: "추천으로 언급됨",
  information: "정보로 언급됨",
  comparison: "비교 대상으로 언급됨",
  warning: "부정적 맥락으로 언급됨",
}

export function MentionContextCard({ citation }: Props) {
  const isNotMentioned = citation.mentioned === false
  const style = isNotMentioned
    ? "bg-orange-50 border-orange-200 text-orange-800"
    : SENTIMENT_STYLE[citation.sentiment] ?? SENTIMENT_STYLE.neutral
  const typeLabel = isNotMentioned ? "미언급" : (MENTION_TYPE_LABEL[citation.mention_type] ?? citation.mention_type)
  const platformLabel = citation.platform_label || PLATFORM_LABEL[citation.platform] || citation.platform

  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm">{platformLabel}</span>
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${isNotMentioned ? "bg-orange-100 text-orange-700" : "bg-white/60"}`}>
          {isNotMentioned ? "AI 미언급" : typeLabel}
        </span>
      </div>
      {citation.query && (
        <div className="inline-flex items-center gap-1.5 bg-white/70 border border-current/10 rounded-full px-3 py-1 mb-2">
          <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
          <span className="text-sm font-medium">&ldquo;{citation.query}&rdquo;</span>
        </div>
      )}
      {!isNotMentioned && citation.excerpt && !citation.excerpt.includes('(구체적 인용문 없음)') && (
        <blockquote className="text-sm italic border-l-2 border-current pl-3 mt-2 opacity-80">
          &ldquo;{citation.excerpt}&rdquo;
        </blockquote>
      )}
      {isNotMentioned && (
        <p className="text-sm opacity-70 mt-1">이 검색어에서 내 가게가 언급되지 않았습니다.</p>
      )}
      {citation.mentioned_attributes?.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {citation.mentioned_attributes.map((attr) => (
            <span key={attr} className="text-sm bg-white/70 rounded-full px-2 py-0.5">
              #{attr}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
