'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PlanGate } from '@/components/common/PlanGate'
import { Lightbulb } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '바로 가능', medium: '조금 준비', hard: '전문가 도움',
}
const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-orange-100 text-orange-700',
}

interface GuideItem {
  rank: number
  category: string
  title: string
  action: string
  expected_effect?: string
  difficulty: string
  time_required?: string
  competitor_example?: string
}

interface Guide {
  id: string
  summary: string
  items_json: GuideItem[]
  priority_json: string[]
  generated_at: string
}

interface Props {
  business: { id: string; name: string }
  guide: Guide | null
  latestScanId: string | null
  userId: string
}

export function GuideClient({ business, guide: initialGuide, latestScanId, userId }: Props) {
  const router = useRouter()
  const [guide, setGuide] = useState<Guide | null>(initialGuide)
  const [loading, setLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const STORAGE_KEY = `guide_checklist_${business.id}`

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setChecked(new Set(JSON.parse(saved)))
    } catch {}
  }, [STORAGE_KEY])

  const toggleCheck = (rank: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(rank)) next.delete(rank)
      else next.add(rank)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch {}
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
      // 백그라운드 생성 — 3초 후 재조회
      await new Promise((r) => setTimeout(r, 3000))
      const res = await fetch(`${BACKEND}/api/guide/${business.id}/latest`)
      if (res.ok) setGuide(await res.json())
      router.refresh()
    } catch {
      setError('가이드 생성 중 오류가 발생했습니다.')
    } finally {
      clearInterval(timer)
      setLoading(false)
    }
  }

  return (
    <PlanGate requiredPlan="basic" currentPlan="basic" feature="AI 개선 가이드">
      <div className="space-y-6">
        {/* 상단 액션 */}
        <div className="flex items-center justify-between">
          {guide && (
            <p className="text-sm text-gray-400">
              마지막 생성: {new Date(guide.generated_at).toLocaleDateString('ko-KR')}
            </p>
          )}
          <button
            onClick={generateGuide}
            disabled={loading || !latestScanId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? '생성 중...' : guide ? '가이드 재생성' : '가이드 생성하기'}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {loading && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600 mb-1">AI가 맞춤 전략을 작성 중입니다... ({elapsedSeconds}초)</p>
            <p className="text-gray-400 text-xs">보통 10~15초 소요됩니다</p>
          </div>
        )}

        {guide && !loading && (
          <>
            {/* 진행률 */}
            {(guide.items_json ?? []).length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-700">완료 체크리스트</div>
                  <div className="text-sm text-gray-500">
                    {checked.size} / {guide.items_json.length} 완료
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(checked.size / guide.items_json.length) * 100}%` }}
                  />
                </div>
                {checked.size === guide.items_json.length && (
                  <p className="text-xs text-green-600 mt-2 font-medium">모든 항목을 완료했습니다!</p>
                )}
              </div>
            )}

            {/* 요약 */}
            <div className="bg-blue-50 rounded-2xl p-5">
              <div className="text-sm font-medium text-blue-900 mb-2">현황 요약</div>
              <p className="text-blue-800 text-sm leading-relaxed">{guide.summary}</p>
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
                        <span className="text-xs text-gray-400">{item.category}</span>
                        <div className={`font-semibold ${checked.has(item.rank) ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {item.title}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.time_required && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {item.time_required}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DIFFICULTY_COLOR[item.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                        {DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">{item.action}</p>
                  {item.expected_effect && (
                    <p className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                      예상 효과: {item.expected_effect}
                    </p>
                  )}
                  {item.competitor_example && (
                    <p className="text-xs text-gray-500 mt-2">
                      참고 사례: {item.competitor_example}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!guide && !loading && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Lightbulb className="w-10 h-10 text-yellow-400 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-700 font-medium mb-2">아직 개선 가이드가 없습니다.</p>
            <p className="text-sm text-gray-400 mb-1">
              {latestScanId
                ? '위의 \'가이드 생성하기\' 버튼을 눌러주세요.'
                : '먼저 대시보드에서 AI 스캔을 실행해주세요.'}
            </p>
            {latestScanId && (
              <p className="text-xs text-gray-400">AI가 스캔 결과를 분석해 지금 당장 실천할 수 있는 방법을 알려드립니다.</p>
            )}
          </div>
        )}
      </div>
    </PlanGate>
  )
}
