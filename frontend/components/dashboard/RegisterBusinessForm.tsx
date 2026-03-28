'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_GROUPS } from '@/lib/categories'
import { CATEGORY_ICON_MAP } from '@/lib/categoryIcons'
import { Search, ChevronLeft } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface LookupResult {
  status: string
  is_active: boolean
  tax_type: string
}

interface AddressCandidate {
  name: string
  address: string
  phone: string
  category: string
}

interface RegisterBusinessFormProps {
  userId: string
}

type Step = 'category' | 'tags' | 'info'

export function RegisterBusinessForm({ userId }: RegisterBusinessFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 단계 관리
  const [step, setStep] = useState<Step>('category')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // 사업자등록번호 조회
  const [regNo, setRegNo] = useState('')
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [looking, setLooking] = useState(false)
  const [isPreStartup, setIsPreStartup] = useState(false)

  // 주소 검색
  const [addressCandidates, setAddressCandidates] = useState<AddressCandidate[]>([])
  const [addressSearching, setAddressSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    name: '',
    region: '',
    address: '',
    phone: '',
    website_url: '',
  })

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatRegNo = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }

  const handleRegNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRegNo(e.target.value)
    setRegNo(formatted)
    const digits = formatted.replace(/-/g, '')
    if (digits.length === 10) {
      setTimeout(() => handleLookup(digits), 100)
    }
  }

  const handleLookup = async (overrideDigits?: string) => {
    const digits = overrideDigits ?? regNo.replace(/-/g, '')
    if (digits.length !== 10) {
      setLookupError('사업자등록번호 10자리를 입력하세요')
      return
    }
    setLooking(true)
    setLookupError('')
    setLookupResult(null)
    try {
      const res = await fetch(`${BACKEND}/api/businesses/lookup?reg_no=${digits}`)
      const data = await res.json()
      if (!res.ok) { setLookupError(data.detail || '조회 실패'); return }
      setLookupResult(data)
      if (!data.is_active) setLookupError(`${data.status} — 계속사업자만 등록 가능합니다`)
    } catch {
      setLookupError('국세청 API 연결 실패. 잠시 후 다시 시도하세요.')
    } finally {
      setLooking(false)
    }
  }

  const handleAddressSearch = async () => {
    if (!form.name.trim()) { setError('사업장 이름을 먼저 입력하세요.'); return }
    setError('')
    setAddressSearching(true)
    setShowDropdown(false)
    try {
      const params = new URLSearchParams({ name: form.name, region: form.region })
      const res = await fetch(`${BACKEND}/api/businesses/search-address?${params}`)
      const data = await res.json()
      if (!res.ok || !Array.isArray(data) || data.length === 0) {
        setError('주소 검색 결과가 없습니다. 이름·지역을 확인하거나 직접 입력하세요.')
        return
      }
      setAddressCandidates(data)
      setShowDropdown(true)
    } catch {
      setError('주소 검색 중 오류가 발생했습니다.')
    } finally {
      setAddressSearching(false)
    }
  }

  const handleSelectAddress = (candidate: AddressCandidate) => {
    setForm((prev) => ({
      ...prev,
      address: candidate.address,
      phone: candidate.phone || prev.phone,
      name: candidate.name || prev.name,
    }))
    setShowDropdown(false)
    setAddressCandidates([])
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const currentCategoryGroup = CATEGORY_GROUPS.find((g) => g.value === selectedCategory)

  const canSubmit = isPreStartup || (lookupResult?.is_active === true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) {
      setError('사업자등록번호를 먼저 조회하거나 창업 예정을 선택하세요.')
      return
    }
    if (!selectedCategory) {
      setError('업종을 선택해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BACKEND}/api/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          ...form,
          category: selectedCategory,
          keywords: selectedTags,
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setError('사업장 등록 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // ── STEP 1: 업종 선택 ──────────────────────────────────────────────
  if (step === 'category') {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm max-w-lg">
        <h2 className="font-semibold text-gray-900 mb-1">사업장 등록</h2>
        <p className="text-sm text-gray-500 mb-4">내 사업장이 속하는 업종을 선택하세요.</p>
        <div className="grid grid-cols-2 gap-2.5">
          {CATEGORY_GROUPS.map((g) => {
            const cfg = CATEGORY_ICON_MAP[g.value]
            const Icon = cfg?.Icon
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => {
                  setSelectedCategory(g.value)
                  setSelectedTags([])
                  setStep('tags')
                }}
                className="flex items-center gap-3 p-3.5 border-2 border-gray-100 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-left group"
              >
                {Icon && (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-5 h-5 ${cfg.text}`} strokeWidth={1.8} />
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-700 leading-tight">{g.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── STEP 2: 서비스 태그 선택 ──────────────────────────────────────
  if (step === 'tags') {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm max-w-lg">
        <button
          type="button"
          onClick={() => setStep('category')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> 업종 다시 선택
        </button>

        {(() => {
          const cfg = currentCategoryGroup ? CATEGORY_ICON_MAP[currentCategoryGroup.value] : null
          const Icon = cfg?.Icon
          return (
            <div className="flex items-center gap-2.5 mb-1">
              {Icon && (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg?.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg?.text}`} strokeWidth={1.8} />
                </div>
              )}
              <h2 className="font-semibold text-gray-900">{currentCategoryGroup?.label}</h2>
            </div>
          )
        })()}
        <p className="text-sm text-gray-500 mb-4">
          내 사업장과 관련된 서비스를 모두 선택하세요. <span className="text-blue-600">AI가 이 키워드로 검색합니다.</span>
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          {currentCategoryGroup?.tags.map((tag) => {
            const selected = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  selected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {selected && <span className="mr-1">✓</span>}
                {tag}
              </button>
            )
          })}
        </div>

        {selectedTags.length > 0 && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-blue-700 font-medium mb-1">선택된 서비스 키워드 ({selectedTags.length}개)</p>
            <p className="text-sm text-blue-800">{selectedTags.join(', ')}</p>
          </div>
        )}

        <button
          type="button"
          disabled={selectedTags.length === 0}
          onClick={() => setStep('info')}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {selectedTags.length === 0 ? '서비스를 1개 이상 선택하세요' : `${selectedTags.length}개 선택 완료 → 다음`}
        </button>
      </div>
    )
  }

  // ── STEP 3: 사업장 정보 입력 ──────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm max-w-lg">
      <button
        type="button"
        onClick={() => setStep('tags')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> 서비스 다시 선택
      </button>

      {/* 선택 요약 */}
      {(() => {
        const cfg = currentCategoryGroup ? CATEGORY_ICON_MAP[currentCategoryGroup.value] : null
        const Icon = cfg?.Icon
        return (
          <div className={`rounded-xl px-4 py-3 mb-5 flex items-center gap-3 ${cfg?.bg ?? 'bg-gray-50'}`}>
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                <Icon className={`w-5 h-5 ${cfg?.text}`} strokeWidth={1.8} />
              </div>
            )}
            <div>
              <p className={`text-xs font-semibold ${cfg?.text ?? 'text-gray-400'}`}>{currentCategoryGroup?.label}</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {selectedTags.slice(0, 3).join(', ')}{selectedTags.length > 3 ? ` 외 ${selectedTags.length - 3}개` : ''}
              </p>
            </div>
          </div>
        )
      })()}

      <h2 className="font-semibold text-gray-900 mb-1">사업장 정보 입력</h2>
      <p className="text-xs text-gray-400 mb-4">사업자등록번호로 조회하거나, 창업 예정이라면 직접 입력하세요.</p>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 사업자등록번호 조회 */}
        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">사업자등록번호 조회</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isPreStartup}
                onChange={(e) => {
                  setIsPreStartup(e.target.checked)
                  setLookupResult(null)
                  setLookupError('')
                  setRegNo('')
                }}
                className="w-3.5 h-3.5 accent-blue-600"
              />
              <span className="text-xs text-gray-500">창업 예정 (미등록)</span>
            </label>
          </div>

          {isPreStartup ? (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              창업 예정자는 사업자등록 없이 바로 시장 분석을 시작할 수 있습니다.
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={regNo}
                  onChange={(e) => {
                    setLookupResult(null)
                    setLookupError('')
                    handleRegNoChange(e)
                  }}
                  placeholder="000-00-00000"
                  maxLength={12}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleLookup()}
                  disabled={looking}
                  className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {looking ? '조회 중...' : '조회'}
                </button>
              </div>
              {lookupResult && lookupResult.is_active && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <span className="text-green-500 text-base">✓</span>
                  <span><strong>{lookupResult.status}</strong> · {lookupResult.tax_type}</span>
                </div>
              )}
              {lookupError && <p className="text-xs text-red-500">{lookupError}</p>}
            </>
          )}
        </div>

        {/* 사업장 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">사업장 이름 *</label>
          <input
            required
            placeholder="예: 강남 맛있는 치킨"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 지역 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
          <input
            required
            placeholder="예: 강남구 역삼동"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 주소 (자동 검색 + 수동 입력) */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">주소</label>
            <button
              type="button"
              onClick={handleAddressSearch}
              disabled={addressSearching}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <Search className="w-3 h-3" />{addressSearching ? '검색 중...' : ' 네이버 주소 검색'}
            </button>
          </div>
          <input
            placeholder="예: 서울시 강남구 테헤란로 123  (또는 위 검색 버튼 이용)"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {showDropdown && addressCandidates.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              {addressCandidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectAddress(c)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="text-sm font-medium text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{c.address}</div>
                  {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 전화번호 + 웹사이트 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
            <input
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">웹사이트</label>
            <input
              placeholder="https://..."
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '등록 중...' : '사업장 등록 및 AI 스캔 시작'}
        </button>

        {!canSubmit && !isPreStartup && (
          <p className="text-xs text-center text-gray-400">
            사업자등록번호 조회 후 등록할 수 있습니다
          </p>
        )}
      </form>
    </div>
  )
}
