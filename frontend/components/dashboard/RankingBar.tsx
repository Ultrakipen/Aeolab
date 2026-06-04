'use client'

interface RankingItem {
  name: string
  score: number
  isMe?: boolean
}

interface RankingBarProps {
  items: RankingItem[]
  title?: string
}

function relativeLabel(diff: number): { text: string; className: string } {
  if (diff === 0) return { text: '비슷한 수준', className: 'text-gray-400' }
  if (diff > 0) {
    // 경쟁사가 내 가게보다 앞선 경우
    if (diff <= 5) return { text: '비슷한 수준이에요', className: 'text-gray-500' }
    if (diff <= 20) return { text: 'AI에 더 많이 노출돼요', className: 'text-orange-500' }
    return { text: 'AI에 훨씬 더 노출돼요', className: 'text-red-500 font-semibold' }
  }
  // 내 가게가 앞서는 경우
  const ahead = Math.abs(diff)
  if (ahead <= 5) return { text: '비슷한 수준이에요', className: 'text-gray-500' }
  if (ahead <= 20) return { text: '내가 더 많이 노출돼요', className: 'text-emerald-600' }
  return { text: '내가 훨씬 더 노출돼요', className: 'text-emerald-600 font-semibold' }
}

export function RankingBar({ items, title = '경쟁사 비교' }: RankingBarProps) {
  const sorted = [...items].sort((a, b) => b.score - a.score)
  const max = Math.max(...sorted.map((i) => i.score), 1)
  const myScore = items.find((i) => i.isMe)?.score ?? null

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="text-sm font-medium text-gray-700 mb-4">{title}</div>
      <div className="space-y-3">
        {sorted.map((item, idx) => {
          const diff = myScore !== null && !item.isMe ? Math.round(item.score - myScore) : null
          const label = diff !== null ? relativeLabel(diff) : null

          return (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-5 text-sm text-gray-400 shrink-0 text-right">{idx + 1}</div>
              <div
                className={`text-sm shrink-0 w-20 md:w-28 truncate font-medium ${
                  item.isMe ? 'text-blue-600' : 'text-gray-700'
                }`}
              >
                {item.isMe ? `★ ${item.name}` : item.name}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    item.isMe ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  style={{ width: `${(item.score / max) * 100}%` }}
                />
              </div>
              <div className="w-28 text-right shrink-0">
                {item.isMe ? (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    내 가게
                  </span>
                ) : label ? (
                  <span className={`text-xs whitespace-nowrap ${label.className}`}>{label.text}</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
