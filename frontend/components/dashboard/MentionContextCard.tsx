'use client'

import { MentionContext } from "@/types"

interface Props {
  citation: MentionContext
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "bg-green-50 border-green-200 text-green-800",
  neutral: "bg-gray-50 border-gray-200 text-gray-800",
  negative: "bg-red-50 border-red-200 text-red-800",
}

const MENTION_TYPE_LABEL: Record<string, string> = {
  recommendation: "추천으로 언급됨",
  information: "정보로 언급됨",
  comparison: "비교 대상으로 언급됨",
  warning: "부정적 맥락으로 언급됨",
}

export function MentionContextCard({ citation }: Props) {
  const style = SENTIMENT_STYLE[citation.sentiment] ?? SENTIMENT_STYLE.neutral
  const typeLabel = MENTION_TYPE_LABEL[citation.mention_type] ?? citation.mention_type

  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">{citation.platform}</span>
        <span className="text-sm">{typeLabel}</span>
      </div>
      {citation.excerpt && (
        <blockquote className="text-sm italic border-l-2 border-current pl-3 mt-2 opacity-80">
          &ldquo;{citation.excerpt}&rdquo;
        </blockquote>
      )}
      {citation.mentioned_attributes?.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {citation.mentioned_attributes.map((attr) => (
            <span key={attr} className="text-xs bg-white/70 rounded-full px-2 py-0.5">
              #{attr}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
