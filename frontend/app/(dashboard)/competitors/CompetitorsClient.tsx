'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Business { id: string; name: string; category: string; region: string }
interface Competitor { id: string; name: string; address?: string }
interface Suggestion { name: string; address: string; region: string; score: number }
interface SearchResult { name: string; address: string; category: string; phone: string; naver_url: string }

interface Props {
  business: Business
  competitors: Competitor[]
  myScore: number
  userId: string
}

type AddTab = 'search' | 'manual'

export function CompetitorsClient({ business, competitors: initial, myScore, userId }: Props) {
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
    } catch (e: any) {
      if (e.message === 'PLAN_LIMIT') setSearchError('경쟁사 등록 한도에 도달했습니다. 플랜을 업그레이드하세요.')
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
    } catch (e: any) {
      if (e.message === 'PLAN_LIMIT') setFormError('경쟁사 등록 한도에 도달했습니다. 플랜을 업그레이드하세요.')
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
