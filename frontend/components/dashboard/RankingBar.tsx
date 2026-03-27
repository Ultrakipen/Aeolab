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

export function RankingBar({ items, title = '경쟁사 비교' }: RankingBarProps) {
  const max = Math.max(...items.map((i) => i.score), 1)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="text-sm font-medium text-gray-700 mb-4">{title}</div>
      <div className="space-y-3">
        {items
          .sort((a, b) => b.score - a.score)
          .map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-5 text-xs text-gray-400 shrink-0 text-right">{idx + 1}</div>
              <div
                className={`text-sm shrink-0 w-28 truncate font-medium ${
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
              <div className="text-sm text-gray-600 w-10 text-right shrink-0">{Math.round(item.score)}</div>
            </div>
          ))}
      </div>
    </div>
  )
}
