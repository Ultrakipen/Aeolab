'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_GROUPS } from '@/lib/categories'
import { CATEGORY_ICON_MAP } from '@/lib/categoryIcons'
import { createClient } from '@/lib/supabase/client'
import {
  UtensilsCrossed, Coffee, Croissant, Wine,
  Scissors, Sparkles, Stethoscope, Pill, Dumbbell, PersonStanding,
  PawPrint, BookOpen, GraduationCap,
  Scale, Building2, Sofa, Car, WashingMachine,
  ShoppingBag, Shirt, BedDouble, Store,
  Camera, Film, Palette,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Search, ChevronLeft, Loader2 } from 'lucide-react'
import BusinessSearchDropdown, { mapKakaoCategory } from '@/components/dashboard/BusinessSearchDropdown'
import type { BusinessSearchResult } from '@/types'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed, Coffee, Croissant, Wine,
  Scissors, Sparkles, Stethoscope, Pill, Dumbbell, PersonStanding,
  PawPrint, BookOpen, GraduationCap,
  Scale, Building2, Sofa, Car, WashingMachine,
  ShoppingBag, Shirt, BedDouble, Store,
  Camera, Film, Palette,
}

const COLOR_MAP: Record<string, { bg: string; icon: string; border: string; ring: string; gradient: string }> = {
  orange:  { bg: "bg-orange-50",  icon: "text-orange-500",  border: "border-orange-300",  ring: "ring-orange-300",  gradient: "from-orange-400 to-rose-500" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   border: "border-amber-300",   ring: "ring-amber-300",   gradient: "from-amber-400 to-orange-500" },
  yellow:  { bg: "bg-yellow-50",  icon: "text-yellow-600",  border: "border-yellow-300",  ring: "ring-yellow-300",  gradient: "from-yellow-400 to-amber-500" },
  purple:  { bg: "bg-purple-50",  icon: "text-purple-500",  border: "border-purple-300",  ring: "ring-purple-300",  gradient: "from-purple-500 to-violet-600" },
  pink:    { bg: "bg-pink-50",    icon: "text-pink-500",    border: "border-pink-300",    ring: "ring-pink-300",    gradient: "from-pink-400 to-rose-500" },
  rose:    { bg: "bg-rose-50",    icon: "text-rose-500",    border: "border-rose-300",    ring: "ring-rose-300",    gradient: "from-rose-400 to-pink-500" },
  blue:    { bg: "bg-blue-50",    icon: "text-blue-500",    border: "border-blue-300",    ring: "ring-blue-300",    gradient: "from-blue-500 to-indigo-600" },
  green:   { bg: "bg-green-50",   icon: "text-green-600",   border: "border-green-300",   ring: "ring-green-300",   gradient: "from-green-400 to-emerald-500" },
  red:     { bg: "bg-red-50",     icon: "text-red-500",     border: "border-red-300",     ring: "ring-red-300",     gradient: "from-red-400 to-rose-500" },
  teal:    { bg: "bg-teal-50",    icon: "text-teal-600",    border: "border-teal-300",    ring: "ring-teal-300",    gradient: "from-teal-400 to-cyan-500" },
  lime:    { bg: "bg-lime-50",    icon: "text-lime-600",    border: "border-lime-300",    ring: "ring-lime-300",    gradient: "from-lime-400 to-green-500" },
  indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-500",  border: "border-indigo-300",  ring: "ring-indigo-300",  gradient: "from-indigo-500 to-blue-600" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-500",  border: "border-violet-300",  ring: "ring-violet-300",  gradient: "from-violet-500 to-purple-600" },
  slate:   { bg: "bg-slate-50",   icon: "text-slate-500",   border: "border-slate-300",   ring: "ring-slate-300",   gradient: "from-slate-500 to-gray-600" },
  sky:     { bg: "bg-sky-50",     icon: "text-sky-500",     border: "border-sky-300",     ring: "ring-sky-300",     gradient: "from-sky-400 to-blue-500" },
  stone:   { bg: "bg-stone-50",   icon: "text-stone-500",   border: "border-stone-300",   ring: "ring-stone-300",   gradient: "from-stone-400 to-slate-500" },
  zinc:    { bg: "bg-zinc-50",    icon: "text-zinc-500",    border: "border-zinc-300",    ring: "ring-zinc-300",    gradient: "from-zinc-400 to-slate-500" },
  cyan:    { bg: "bg-cyan-50",    icon: "text-cyan-600",    border: "border-cyan-300",    ring: "ring-cyan-300",    gradient: "from-cyan-400 to-teal-500" },
  fuchsia: { bg: "bg-fuchsia-50", icon: "text-fuchsia-500", border: "border-fuchsia-300", ring: "ring-fuchsia-300", gradient: "from-fuchsia-500 to-pink-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-300", ring: "ring-emerald-300", gradient: "from-emerald-400 to-teal-500" },
  gray:    { bg: "bg-gray-50",    icon: "text-gray-500",    border: "border-gray-300",    ring: "ring-gray-300",    gradient: "from-gray-400 to-slate-500" },
}

const CATEGORIES = [
  // 음식·음료
  { value: "restaurant", label: "음식점",      icon: "UtensilsCrossed", color: "orange" },
  { value: "cafe",       label: "카페",         icon: "Coffee",          color: "amber"  },
  { value: "bakery",     label: "베이커리",     icon: "Croissant",       color: "yellow" },
  { value: "bar",        label: "술집·바",      icon: "Wine",            color: "purple" },
  // 뷰티·건강
  { value: "beauty",     label: "미용·헤어",    icon: "Scissors",        color: "pink"   },
  { value: "nail",       label: "네일·피부",    icon: "Sparkles",        color: "rose"   },
  { value: "medical",    label: "병원·의원",    icon: "Stethoscope",     color: "blue"   },
  { value: "pharmacy",   label: "약국",         icon: "Pill",            color: "green"  },
  { value: "fitness",    label: "헬스·피트니스",icon: "Dumbbell",        color: "red"    },
  { value: "yoga",       label: "요가·필라테스",icon: "PersonStanding",  color: "teal"   },
  // 반려동물
  { value: "pet",        label: "반려동물",     icon: "PawPrint",        color: "lime"   },
  // 교육
  { value: "education",  label: "학원·교육",    icon: "BookOpen",        color: "indigo" },
  { value: "tutoring",   label: "과외·튜터링",  icon: "GraduationCap",   color: "violet" },
  // 전문직·서비스
  { value: "legal",      label: "법률·세무",    icon: "Scale",           color: "slate"  },
  { value: "realestate", label: "부동산",       icon: "Building2",       color: "sky"    },
  { value: "interior",   label: "인테리어",     icon: "Sofa",            color: "stone"  },
  { value: "auto",       label: "자동차·정비",  icon: "Car",             color: "zinc"   },
  { value: "cleaning",   label: "청소·세탁",    icon: "WashingMachine",  color: "cyan"   },
  // 쇼핑
  { value: "shopping",   label: "쇼핑몰",       icon: "ShoppingBag",     color: "fuchsia"},
  { value: "fashion",    label: "의류·패션",    icon: "Shirt",           color: "emerald"},
  // 사진·영상·디자인
  { value: "photo",         label: "사진·영상",      icon: "Camera",          color: "indigo"  },
  { value: "video",         label: "영상·드론",     icon: "Film",            color: "red"     },
  { value: "design",        label: "디자인·인쇄",   icon: "Palette",         color: "violet"  },
  // 숙박
  { value: "accommodation", label: "숙박·펜션", icon: "BedDouble",       color: "blue"   },
  // 기타
  { value: "other",      label: "기타",         icon: "Store",           color: "gray"   },
]

interface AddressCandidate {
  name: string
  address: string
  phone: string
  category: string
}

interface RegisterBusinessFormProps {
  userId: string
  onSuccess?: () => void
}

type Step = 'category' | 'tags' | 'info'

export function RegisterBusinessForm({ userId, onSuccess }: RegisterBusinessFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 단계 관리
  const [step, setStep] = useState<Step>('category')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [businessType, setBusinessType] = useState<'location_based' | 'non_location'>('location_based')

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
    google_place_id: '',
    kakao_place_id: '',
    naver_place_url: '',
    naver_place_id: '',
    review_sample: '',
    review_count: '',
    avg_rating: '',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [autoFillMsg, setAutoFillMsg] = useState('')

  const handleBusinessSelect = (result: BusinessSearchResult) => {
    setForm(prev => ({
      ...prev,
      name: result.name,
      address: result.address || prev.address,
      phone: result.phone || prev.phone,
      naver_place_url: result.naver_place_url || prev.naver_place_url,
      naver_place_id: result.naver_place_id || prev.naver_place_id,
      kakao_place_id: result.kakao_place_id || prev.kakao_place_id,
    }))
    if (result.category) {
      const mapped = mapKakaoCategory(result.category)
      if (mapped !== 'other') {
        setSelectedCategory(mapped)
      }
    }
    setAutoFillMsg('가게 정보가 자동으로 입력되었습니다 ✓')
    setTimeout(() => setAutoFillMsg(''), 4000)
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategory) {
      setError('업종을 선택해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(`${BACKEND}/api/businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name,
          region: form.region,
          address: form.address,
          phone: form.phone,
          website_url: form.website_url,
          google_place_id: form.google_place_id || undefined,
          kakao_place_id: form.kakao_place_id || undefined,
          naver_place_url: form.naver_place_url || undefined,
          naver_place_id: form.naver_place_id || undefined,
          category: selectedCategory,
          keywords: selectedTags,
          business_type: businessType,
          review_sample: form.review_sample || undefined,
          review_count: form.review_count ? parseInt(form.review_count, 10) : undefined,
          avg_rating: form.avg_rating ? parseFloat(form.avg_rating) : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      if (onSuccess) {
        onSuccess()
      } else {
        router.push("/dashboard")
      }
    } catch {
      setError('사업장 등록 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // ── STEP 1: 업종 선택 ──────────────────────────────────────────────
  if (step === 'category') {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm max-w-lg">
        <h2 className="font-semibold text-gray-900 mb-1">사업장 등록</h2>
        <p className="text-sm text-gray-500 mb-3">내 사업장이 속하는 업종을 선택하세요.</p>

        {/* 사업 형태 선택 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setBusinessType('location_based')}
            className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
              businessType === 'location_based'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            🏪 오프라인 매장
          </button>
          <button
            type="button"
            onClick={() => setBusinessType('non_location')}
            className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
              businessType === 'non_location'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            💻 온라인·전문직
          </button>
        </div>

        {/* 업종 카드형 선택 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => {
            const colors = COLOR_MAP[cat.color] ?? COLOR_MAP.gray
            const IconComponent = ICON_MAP[cat.icon]
            const selected = selectedCategory === cat.value
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.value)
                  setSelectedTags([])
                  setStep('tags')
                }}
                className={`
                  group flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border cursor-pointer
                  transition-all duration-200 hover:-translate-y-1 hover:shadow-lg
                  ${selected
                    ? `bg-white ${colors.border} ring-2 ${colors.ring} ring-offset-1 shadow-md`
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                  }
                `}
              >
                <div className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200
                  ${selected
                    ? `bg-gradient-to-br ${colors.gradient} shadow-md`
                    : `${colors.bg} group-hover:scale-110`
                  }
                `}>
                  {IconComponent && (
                    <IconComponent
                      className={`w-6 h-6 transition-colors duration-200 ${selected ? 'text-white drop-shadow-sm' : colors.icon}`}
                      strokeWidth={1.6}
                    />
                  )}
                </div>
                <span className={`text-xs font-semibold text-center leading-tight transition-colors duration-200 ${selected ? colors.icon : 'text-gray-600 group-hover:text-gray-800'}`}>
                  {cat.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── STEP 2: 서비스 태그 선택 ──────────────────────────────────────
  if (step === 'tags') {
    const cat = CATEGORIES.find((c) => c.value === selectedCategory)
    const catColors = cat ? (COLOR_MAP[cat.color] ?? COLOR_MAP.gray) : COLOR_MAP.gray
    const CatIcon = cat ? ICON_MAP[cat.icon] : null
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm max-w-lg">
        <button
          type="button"
          onClick={() => setStep('category')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> 업종 다시 선택
        </button>

        {(() => {
          return (
            <div className="flex items-center gap-2.5 mb-1">
              {CatIcon && (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${catColors.bg}`}>
                  <CatIcon className={`w-5 h-5 ${catColors.icon}`} strokeWidth={1.8} />
                </div>
              )}
              <h2 className="font-semibold text-gray-900">{currentCategoryGroup?.label ?? cat?.label}</h2>
            </div>
          )
        })()}
        <p className="text-sm text-gray-500 mb-4">
          내 사업장과 관련된 서비스를 모두 선택하세요. <span className="text-blue-600">AI가 이 키워드로 검색합니다.</span>
        </p>

        {currentCategoryGroup ? (
          <div className="flex flex-wrap gap-2 mb-5">
            {currentCategoryGroup.tags.map((tag) => {
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
        ) : (
          <p className="text-sm text-gray-400 mb-5">이 업종은 바로 다음 단계로 진행합니다.</p>
        )}

        {selectedTags.length > 0 && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-blue-700 font-medium mb-1">선택된 서비스 키워드 ({selectedTags.length}개)</p>
            <p className="text-sm text-blue-800">{selectedTags.join(', ')}</p>
          </div>
        )}

        <button
          type="button"
          disabled={!!currentCategoryGroup && selectedTags.length === 0}
          onClick={() => setStep('info')}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {currentCategoryGroup && selectedTags.length === 0
            ? '서비스를 1개 이상 선택하세요'
            : selectedTags.length > 0
              ? `${selectedTags.length}개 선택 완료 → 다음`
              : '다음 단계로'}
        </button>
      </div>
    )
  }

  // ── STEP 3: 사업장 정보 입력 ──────────────────────────────────────
  const cat = CATEGORIES.find((c) => c.value === selectedCategory)
  const step3Colors = cat ? (COLOR_MAP[cat.color] ?? COLOR_MAP.gray) : COLOR_MAP.gray
  const Step3Icon = cat ? ICON_MAP[cat.icon] : null
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm max-w-lg">
      <button
        type="button"
        onClick={() => setStep('tags')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> 서비스 다시 선택
      </button>

      {/* 선택 요약 */}
      <div className={`rounded-xl px-4 py-3 mb-5 flex items-center gap-3 ${step3Colors.bg}`}>
        {Step3Icon && (
          <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
            <Step3Icon className={`w-5 h-5 ${step3Colors.icon}`} strokeWidth={1.8} />
          </div>
        )}
        <div>
          <p className={`text-sm font-semibold ${step3Colors.icon}`}>
            {currentCategoryGroup?.label ?? cat?.label}
          </p>
          {selectedTags.length > 0 && (
            <p className="text-sm font-medium text-gray-800 mt-0.5">
              {selectedTags.slice(0, 3).join(', ')}{selectedTags.length > 3 ? ` 외 ${selectedTags.length - 3}개` : ''}
            </p>
          )}
        </div>
      </div>

      <h2 className="font-semibold text-gray-900 mb-1">사업장 정보 입력</h2>
      <p className="text-sm text-gray-400 mb-4">가게 이름으로 검색하면 정보가 자동으로 입력됩니다.</p>

      {/* 가게 이름으로 자동완성 검색 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          가게 검색 <span className="text-gray-400 font-normal">(네이버·카카오 자동입력)</span>
        </label>
        <p className="text-sm text-gray-500 mb-1.5">가게 이름으로 검색하면 정보를 자동으로 입력합니다</p>
        <BusinessSearchDropdown
          region={form.region}
          onSelect={handleBusinessSelect}
        />
        {autoFillMsg && (
          <p className="text-sm text-green-600 font-medium mt-1.5">{autoFillMsg}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 사업장 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">사업장 이름 *</label>
          <input
            required
            placeholder="사업장 이름을 입력하세요"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 지역 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            지역{businessType === 'location_based' ? ' *' : <span className="text-gray-400 font-normal ml-1">(선택)</span>}
          </label>
          <input
            required={businessType === 'location_based'}
            placeholder={businessType === 'location_based' ? '시·구·동 단위로 입력 (예: 수원시 팔달구)' : '서울 강남 등 (비워두면 전국 기준)'}
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
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {addressSearching ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> 검색 중...</>
              ) : (
                <><Search className="w-3 h-3" /> 네이버 주소 검색</>
              )}
            </button>
          </div>
          <input
            placeholder="도로명 또는 지번 주소 (위 검색 버튼으로 자동 입력 가능)"
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
                  <div className="text-sm text-gray-500 mt-0.5">{c.address}</div>
                  {c.phone && <div className="text-sm text-gray-400">{c.phone}</div>}
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

        {/* 고객 리뷰 샘플 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            고객 리뷰 샘플 <span className="text-gray-400 font-normal">(선택 · AI 분석에 활용)</span>
          </label>
          <textarea
            rows={3}
            placeholder="실제 고객 리뷰를 붙여넣으세요. AI 키워드 분석 정확도가 높아집니다."
            value={form.review_sample}
            onChange={(e) => setForm({ ...form, review_sample: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* AI 채널 등록 정보 (글로벌 AI 노출용) */}
        <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/50 space-y-3">
          <div>
            <p className="text-sm font-semibold text-blue-700 mb-0.5">글로벌 AI 채널 등록 정보</p>
            <p className="text-sm text-blue-600">
              ChatGPT·Perplexity에서 노출되려면 구글·카카오 등록이 필요합니다.
              <strong> 정보완성도 점수에 반영됩니다.</strong>
            </p>
          </div>
          {/* Place ID — 고급 설정 (접기/펼치기) */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between text-sm text-gray-400 hover:text-blue-600 transition-colors py-1"
          >
            <span>📌 Google / 카카오 Place ID 입력 <span className="text-gray-300">(선택 · 고급)</span></span>
            <span>{showAdvanced ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 gap-3 border border-gray-100 rounded-xl p-3 bg-gray-50">
              <p className="text-sm text-gray-500">
                <strong>Place ID란?</strong> Google 지도·카카오맵에서 내 가게를 식별하는 고유 번호입니다.
                모르는 경우 그냥 건너뛰어도 됩니다. 나중에 설정 메뉴에서 추가할 수 있습니다.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  네이버 스마트플레이스 URL
                  <span className="text-gray-400 font-normal ml-1">(선택 · FAQ/소식 자동 체크)</span>
                </label>
                <input
                  placeholder="예: https://naver.me/xxxxx 또는 https://map.naver.com/p/entry/place/12345"
                  value={form.naver_place_url}
                  onChange={(e) => setForm({ ...form, naver_place_url: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-sm text-gray-400 mt-1">
                  입력 시 스캔 때 FAQ·소식·소개글 등록 여부를 자동으로 확인합니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google 비즈니스 프로필 ID
                  <span className="text-gray-400 font-normal ml-1">(선택)</span>
                </label>
                <input
                  placeholder="예: ChIJN1t_tDeuEmsRUsoyG83frY4"
                  value={form.google_place_id}
                  onChange={(e) => setForm({ ...form, google_place_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Google 지도 → 내 가게 클릭 → 주소창 URL에서 <code className="bg-gray-100 px-1 rounded">place_id=</code> 뒤의 값
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카카오맵 Place ID
                  <span className="text-gray-400 font-normal ml-1">(선택)</span>
                </label>
                <input
                  placeholder="예: 1234567890"
                  value={form.kakao_place_id}
                  onChange={(e) => setForm({ ...form, kakao_place_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <p className="text-sm text-gray-400 mt-1">
                  카카오맵 → 내 가게 클릭 → 주소창 URL 맨 끝 숫자 (예: map.kakao.com/장소/1234567890)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    네이버 리뷰 수
                    <span className="text-gray-400 font-normal ml-1">(선택)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="예: 42"
                    value={form.review_count}
                    onChange={(e) => setForm({ ...form, review_count: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    평균 평점
                    <span className="text-gray-400 font-normal ml-1">(선택)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    placeholder="예: 4.3"
                    value={form.avg_rating}
                    onChange={(e) => setForm({ ...form, avg_rating: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <p className="col-span-2 text-sm text-gray-400">
                  네이버 플레이스 URL을 입력하면 스캔 시 자동으로 갱신됩니다. 없는 경우 직접 입력하세요.
                </p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              등록 중...
            </>
          ) : (
            '사업장 등록 및 AI 스캔 시작'
          )}
        </button>
      </form>
    </div>
  )
}
