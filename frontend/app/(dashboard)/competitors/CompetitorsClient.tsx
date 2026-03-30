'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Business { id: string; name: string; category: string; region: string }
interface Competitor { id: string; name: string; address?: string }
interface Suggestion { name: string; address: string; region: string; score: number }
interface SearchResult { name: string; address: string; category: string; phone: string; naver_url: string }
interface TrendScan {
  scanned_at: string
  total_score: number
  competitor_scores: Record<string, { name: string; score: number; mentioned: boolean }> | null
}

function GapCard({ bizId, bizName, myScore }: { bizId: string; bizName: string; myScore: number }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/report/gap-card/${bizId}`)
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
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${bizName} AI 경쟁 현황` })
      } else {
        const a = document.createElement('a')
        a.href = imgUrl
        a.download = 'gap_card.png'
        a.click()
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {}
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-gray-700">AI 경쟁 현황 카드</div>
          <div className="text-xs text-gray-400">카카오톡·SNS 공유용 이미지</div>
        </div>
        {!imgUrl && (
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? '생성 중...' : '카드 생성'}
          </button>
        )}
      </div>
      {imgUrl && (
        <div className="space-y-2">
          <img src={imgUrl} alt="경쟁 현황 카드" className="w-full rounded-xl border border-gray-100" />
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="flex-1 text-xs bg-yellow-400 text-gray-900 font-semibold py-2 rounded-lg hover:bg-yellow-500 transition-colors"
            >
              {copied ? '저장됨 ✓' : '📤 공유 / 저장'}
            </button>
            <button
              onClick={() => { setImgUrl(null); generate() }}
              className="text-xs border border-gray-200 text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              새로고침
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
  userId: string
  trendScans?: TrendScan[]
}

// 경쟁사 점수 추이 시각화 (최근 스캔 기록)
function CompetitorTrendChart({ trendScans, bizName }: { trendScans: TrendScan[]; bizName: string }) {
  if (trendScans.length < 2) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="text-sm font-medium text-gray-700 mb-1">경쟁사 점수 추이</div>
        <p className="text-xs text-gray-400">스캔을 2회 이상 실행하면 경쟁사와의 점수 변화 추이를 확인할 수 있습니다.</p>
      </div>
    )
  }

  // 등장하는 모든 경쟁사 이름 수집
  const compNames = new Set<string>()
  trendScans.forEach((s) => {
    if (s.competitor_scores) {
      Object.values(s.competitor_scores).forEach((c) => compNames.add(c.name))
    }
  })

  // 색상 팔레트
  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6','#ec4899','#14b8a6']
  const compList = [...compNames].slice(0, 5)

  // 추이 데이터 구성
  const points = trendScans.map((s) => {
    const date = new Date(s.scanned_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    const row: Record<string, string | number> = { date, me: Math.round(s.total_score) }
    compList.forEach((name) => {
      const entry = s.competitor_scores
        ? Object.values(s.competitor_scores).find((c) => c.name === name)
        : undefined
      row[name] = entry ? entry.score : 0
    })
    return row
  })

  // 최신 점수 기준 내 순위
  const latest = points[points.length - 1]
  const allScores = [{ name: bizName, score: latest.me as number }, ...compList.map((n) => ({ name: n, score: latest[n] as number }))]
  allScores.sort((a, b) => b.score - a.score)
  const myRank = allScores.findIndex((x) => x.name === bizName) + 1

  const maxY = Math.max(...points.flatMap((p) => [p.me as number, ...compList.map((n) => p[n] as number)]), 10)

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-gray-700">경쟁사 점수 추이</div>
          <div className="text-xs text-gray-400">최근 {trendScans.length}회 스캔 기준</div>
        </div>
        <div className={`text-xs font-semibold px-2 py-1 rounded-full ${myRank === 1 ? 'bg-green-100 text-green-700' : myRank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
          현재 {myRank}위
        </div>
      </div>

      {/* 간이 꺾은선 차트 */}
      <div className="relative h-32 flex items-end gap-1 mb-3">
        {points.map((p, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            {/* 내 점수 막대 */}
            <div
              className="w-full bg-blue-500 rounded-t-sm opacity-90 transition-all"
              style={{ height: `${((p.me as number) / maxY) * 100}%` }}
              title={`내 가게: ${p.me}점`}
            />
          </div>
        ))}
        {/* 경쟁사 오버레이 선 (SVG) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          {compList.map((name, ci) => {
            const pts = points.map((p, i) => {
              const x = ((i + 0.5) / points.length) * 100
              const y = 100 - ((p[name] as number) / maxY) * 100
              return `${x},${y}`
            })
            return (
              <polyline
                key={name}
                points={pts.join(' ')}
                fill="none"
                stroke={COLORS[ci % COLORS.length]}
                strokeWidth="1.5"
                strokeDasharray="3,2"
              />
            )
          })}
          {/* 내 점수 선 */}
          <polyline
            points={points.map((p, i) => `${((i + 0.5) / points.length) * 100},${100 - ((p.me as number) / maxY) * 100}`).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* X축 날짜 */}
      <div className="flex justify-between text-xs text-gray-400 mb-3">
        {points.map((p, i) => (
          <span key={i} className="flex-1 text-center truncate">{p.date}</span>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <div className="flex items-center gap-1 text-xs text-gray-700">
          <div className="w-3 h-1.5 bg-blue-500 rounded" />
          <span className="font-medium">{bizName} (내 가게)</span>
        </div>
        {compList.map((name, ci) => (
          <div key={name} className="flex items-center gap-1 text-xs text-gray-500">
            <div className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: COLORS[ci % COLORS.length] }} />
            <span>{name}</span>
          </div>
        ))}
      </div>

      {/* 최신 순위표 */}
      <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
        {allScores.map((x, i) => (
          <div key={x.name} className={`flex items-center justify-between text-xs ${x.name === bizName ? 'font-semibold text-blue-700' : 'text-gray-600'}`}>
            <span>{i + 1}위 {x.name === bizName ? `${x.name} ← 내 가게` : x.name}</span>
            <span>{x.score}점</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type AddTab = 'search' | 'manual'

export function CompetitorsClient({ business, competitors: initial, myScore, userId, trendScans = [] }: Props) {
  const router = useRouter()
  const [competitors, setCompetitors] = useState(initial)
  const [tab, setTab] = useState<AddTab>('search')
  const [scanPromptName, setScanPromptName] = useState<string | null>(null)

  // 검색
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [addingName, setAddingName] = useState<string | null>(null)

  // 직접 입력
  const [form, setForm] = useState({ name: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // AEOlab 내 추천
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggest, setLoadingSuggest] = useState(false)

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoadingSuggest(true)
      try {
        const res = await fetch(
          `${BACKEND}/api/competitors/suggest/list?category=${business.category}&region=${encodeURIComponent(business.region)}&business_id=${business.id}`
        )
        if (res.ok) setSuggestions(await res.json())
      } catch {}
      finally { setLoadingSuggest(false) }
    }
    fetchSuggestions()
  }, [business.id, business.category, business.region])

  // 네이버 지역 검색
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const res = await fetch(
        `${BACKEND}/api/competitors/search?query=${encodeURIComponent(searchQuery)}&region=${encodeURIComponent(business.region)}`
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

  // 경쟁사 등록 공통 함수
  const doAdd = async (name: string, address: string): Promise<boolean> => {
    const res = await fetch(`${BACKEND}/api/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ business_id: business.id, name, address }),
    })
    if (!res.ok) {
      const err = await res.json()
      if (err?.detail?.code === 'PLAN_REQUIRED') throw new Error('PLAN_LIMIT')
      throw new Error('ADD_FAIL')
    }
    const newComp = await res.json()
    setCompetitors((prev) => [...prev, newComp])
    setScanPromptName(name)  // 추가 성공 → 스캔 제안 모달
    router.refresh()
    return true
  }

  // 검색 결과에서 즉시 추가
  const addFromSearch = async (result: SearchResult) => {
    setAddingName(result.name)
    try {
      await doAdd(result.name, result.address)
      setSearchResults((prev) => prev.filter((r) => r.name !== result.name))
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'PLAN_LIMIT') setSearchError('경쟁사 등록 한도에 도달했습니다. 플랜을 업그레이드하세요.')
      else setSearchError('등록 중 오류가 발생했습니다.')
    } finally {
      setAddingName(null)
    }
  }

  // 직접 입력 등록
  const addManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setFormError('')
    try {
      await doAdd(form.name, form.address)
      setForm({ name: '', address: '' })
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'PLAN_LIMIT') setFormError('경쟁사 등록 한도에 도달했습니다. 플랜을 업그레이드하세요.')
      else setFormError('경쟁사 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const removeCompetitor = async (id: string) => {
    await fetch(`${BACKEND}/api/competitors/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    })
    setCompetitors(competitors.filter((c) => c.id !== id))
    router.refresh()
  }

  const alreadyAdded = new Set(competitors.map((c) => c.name))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 등록된 경쟁사 목록 */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              등록된 경쟁사 ({competitors.length}개)
            </span>
            <span className="text-xs text-gray-400">플랜별 최대 5~20개</span>
          </div>
          {competitors.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              경쟁사를 등록하면 AI 노출 순위를 비교할 수 있습니다.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {competitors.map((c) => (
                <li key={c.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.address && <div className="text-xs text-gray-400 mt-0.5">{c.address}</div>}
                  </div>
                  <button
                    onClick={() => removeCompetitor(c.id)}
                    className="text-sm text-red-400 hover:text-red-600 transition-colors"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 오른쪽 패널 */}
      <div className="space-y-4">
        {/* 탭 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab('search')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === 'search' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              지역 검색
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              직접 입력
            </button>
          </div>

          <div className="p-5">
            {/* 지역 검색 탭 */}
            {tab === 'search' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{business.region}</span> 내 업체를 키워드로 검색합니다.
                </p>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    placeholder="예: 치킨, 피자, 헬스장"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={searching}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {searching ? '검색 중' : '검색'}
                  </button>
                </form>

                {searchError && <p className="text-xs text-red-500">{searchError}</p>}

                {searchResults.length > 0 && (
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {searchResults.map((r, idx) => {
                      const added = alreadyAdded.has(r.name)
                      return (
                        <li key={`${r.name}-${idx}`} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-gray-900 truncate">{r.name}</span>
                              {r.naver_url && (
                                <a
                                  href={r.naver_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-green-500 hover:text-green-700 shrink-0"
                                  title="네이버 지도에서 확인"
                                >
                                  지도
                                </a>
                              )}
                            </div>
                            {r.address && <div className="text-xs text-gray-400 truncate">{r.address}</div>}
                            {r.category && <div className="text-xs text-gray-300 truncate">{r.category}</div>}
                          </div>
                          <button
                            onClick={() => addFromSearch(r)}
                            disabled={added || addingName === r.name}
                            className={`shrink-0 text-xs px-2 py-1 rounded border transition-colors ${
                              added
                                ? 'border-gray-200 text-gray-300 cursor-default'
                                : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            {added ? '등록됨' : addingName === r.name ? '...' : '추가'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* 직접 입력 탭 */}
            {tab === 'manual' && (
              <form onSubmit={addManual} className="space-y-3">
                <input
                  required
                  placeholder="경쟁 사업장 이름 *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  placeholder="주소 (선택)"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formError && <p className="text-red-500 text-xs">{formError}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? '추가 중...' : '경쟁사 추가'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* AEOlab 내 추천 */}
        {(loadingSuggest || suggestions.length > 0) && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-700 mb-1">AEOlab 추천 경쟁사</div>
            <div className="text-xs text-gray-400 mb-3">같은 지역·업종에서 AEOlab을 사용 중인 업체</div>
            {loadingSuggest ? (
              <div className="text-xs text-gray-400 text-center py-3">불러오는 중...</div>
            ) : (
              <ul className="space-y-2">
                {suggestions.filter((s) => !alreadyAdded.has(s.name)).map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 truncate">{s.name}</div>
                      {s.address && <div className="text-xs text-gray-400 truncate">{s.address}</div>}
                    </div>
                    <button
                      onClick={() => doAdd(s.name, s.address).catch(() => {})}
                      className="shrink-0 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 transition-colors"
                    >
                      추가
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="bg-blue-50 rounded-2xl p-4 text-xs text-blue-700">
          <p className="font-medium mb-1">경쟁사 선택 팁</p>
          <p>같은 지역·업종의 가게를 등록하세요. 스캔 시 AI 노출 순위를 자동으로 비교합니다.</p>
        </div>

        {/* 경쟁 현황 카드 (Gap Card) */}
        <GapCard bizId={business.id} bizName={business.name} myScore={myScore} />

        {/* 경쟁사 점수 추이 차트 */}
        <CompetitorTrendChart trendScans={trendScans} bizName={business.name} />
      </div>
      {/* 경쟁사 추가 후 즉시 스캔 제안 모달 */}
      {scanPromptName && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">경쟁사가 추가되었습니다</h3>
            <p className="text-sm text-gray-500 mb-5">
              지금 바로 스캔하면 <strong>{scanPromptName}</strong>와의
              AI 노출 점수를 비교할 수 있습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setScanPromptName(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                나중에
              </button>
              <button
                onClick={() => { setScanPromptName(null); router.push('/dashboard') }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                지금 비교 스캔 실행 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
