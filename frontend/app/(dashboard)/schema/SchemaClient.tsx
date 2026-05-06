'use client'

import { useState, useCallback } from 'react'
import { generateSchema } from '@/lib/api'
import { CATEGORY_GROUPS } from '@/lib/categories'
import type { SchemaResult, IntroScore, BlogDraft } from '@/types'
import {
  CheckCircle2, ClipboardCopy, Check, ChevronDown, ChevronUp,
  MapPin, FileText, ListChecks, Lightbulb, AlertCircle,
  BarChart2, Globe, ExternalLink,
} from 'lucide-react'

// 영업시간 빌더
const DAYS = [
  { key: 'Mo', label: '월' }, { key: 'Tu', label: '화' }, { key: 'We', label: '수' },
  { key: 'Th', label: '목' }, { key: 'Fr', label: '금' }, { key: 'Sa', label: '토' }, { key: 'Su', label: '일' },
]
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0')
  return { value: `${h}:00`, label: i === 0 ? '자정' : i < 12 ? `오전 ${i}시` : i === 12 ? '정오' : `오후 ${i - 12}시` }
})

interface HoursRow { id: string; days: string[]; open: string; close: string; closed: boolean }

function buildOpeningHoursString(rows: HoursRow[]): string {
  return rows.filter((r) => !r.closed && r.days.length > 0)
    .map((r) => `${r.days.join(',')} ${r.open}-${r.close}`).join(', ')
}

function OpeningHoursBuilder({ rows, onChange }: { rows: HoursRow[]; onChange: (r: HoursRow[]) => void }) {
  const toggleDay = (id: string, key: string) =>
    onChange(rows.map((r) => r.id === id ? { ...r, days: r.days.includes(key) ? r.days.filter((d) => d !== key) : [...r.days, key] } : r))
  const updateRow = (id: string, field: keyof HoursRow, val: string | boolean) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  const addRow = () => onChange([...rows, { id: Date.now().toString(), days: [], open: '09:00', close: '21:00', closed: false }])
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id))

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
          <div className="flex gap-1 flex-wrap">
            {DAYS.map((d) => (
              <button key={d.key} type="button" onClick={() => toggleDay(row.id, d.key)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${row.days.includes(d.key) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {d.label}
              </button>
            ))}
            <button type="button" onClick={() => removeRow(row.id)} className="ml-auto text-sm text-gray-400 hover:text-red-400 px-2">삭제</button>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
              <input type="checkbox" checked={row.closed} onChange={(e) => updateRow(row.id, 'closed', e.target.checked)} className="accent-red-500" />
              휴무
            </label>
            {!row.closed && (
              <>
                <select value={row.open} onChange={(e) => updateRow(row.id, 'open', e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                  {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                <span className="text-gray-400 text-sm">~</span>
                <select value={row.close} onChange={(e) => updateRow(row.id, 'close', e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                  {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={addRow}
        className="w-full border border-dashed border-gray-300 text-gray-400 text-sm py-2 rounded-xl hover:border-blue-400 hover:text-blue-500 transition-colors">
        + 시간대 추가 (예: 주말 별도 설정)
      </button>
    </div>
  )
}

// 복사 버튼
function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }
  return (
    <button onClick={handleCopy}
      className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
      {copied ? <><Check className="w-3.5 h-3.5" />복사됨!</> : <><ClipboardCopy className="w-3.5 h-3.5" />{label}</>}
    </button>
  )
}

// 체크리스트 아이템 (localStorage 연동)
function ChecklistItem({
  item, tip, storageKey, index,
  onToggle,
}: {
  item: string; tip: string; storageKey: string; index: number
  onToggle?: (checked: boolean) => void
}) {
  const [checked, setChecked] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const arr = JSON.parse(stored) as number[]
        return arr.includes(index)
      }
    } catch {}
    return false
  })
  const [open, setOpen] = useState(false)

  const toggle = () => {
    const next = !checked
    setChecked(next)
    try {
      const stored = localStorage.getItem(storageKey)
      const arr: number[] = stored ? JSON.parse(stored) : []
      const updated = next ? [...arr, index] : arr.filter((i) => i !== index)
      localStorage.setItem(storageKey, JSON.stringify(updated))
    } catch {}
    onToggle?.(next)
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${checked ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={toggle} className="shrink-0">
          {checked
            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
            : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
        </button>
        <span className={`flex-1 text-sm ${checked ? 'text-green-700 line-through' : 'text-gray-700'}`}>{item}</span>
        <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-gray-600 shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 text-sm text-blue-700 bg-blue-50 border-t border-blue-100 flex items-start gap-2 pt-2">
          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{tip}</span>
        </div>
      )}
    </div>
  )
}

// AI 브리핑 최적화 점수 게이지
function IntroScoreGauge({ introScore }: { introScore: IntroScore }) {
  const GRADE_COLOR: Record<string, { ring: string; text: string; bg: string }> = {
    A: { ring: 'stroke-green-500', text: 'text-green-600', bg: 'bg-green-50' },
    B: { ring: 'stroke-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' },
    C: { ring: 'stroke-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50' },
    D: { ring: 'stroke-red-500', text: 'text-red-600', bg: 'bg-red-50' },
  }
  const color = GRADE_COLOR[introScore.grade] ?? GRADE_COLOR.C
  const circumference = 2 * Math.PI * 40
  const strokeDash = (introScore.score / 100) * circumference

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      {/* 원형 게이지 */}
      <div className="relative shrink-0">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            className={color.ring}
            strokeWidth="10"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color.text}`}>{introScore.score}</span>
          <span className={`text-sm font-semibold ${color.text}`}>{introScore.grade}등급</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 mb-1">
          총 {introScore.total_checked}개 키워드 중 {introScore.matched_keywords.length}개 포함됨
        </p>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full ${introScore.score >= 80 ? 'bg-green-500' : introScore.score >= 60 ? 'bg-blue-500' : introScore.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${introScore.score}%` }}
          />
        </div>
        {introScore.grade === 'A' ? (
          <p className="text-sm text-green-700 font-medium">AI 브리핑 최적화 우수! 현재 소개글이 잘 작성되어 있습니다.</p>
        ) : (
          <p className="text-sm text-gray-600 leading-relaxed">
            아래 부족한 키워드를 소개글에 추가하면 <span className="font-semibold text-blue-600">AI 브리핑 노출 가능성이 높아집니다.</span>
          </p>
        )}
      </div>
    </div>
  )
}

type Tab = 'briefing' | 'smartplace' | 'blog' | 'checklist' | 'website' | 'nowebsite'
type BlogDraftType = 'new_open' | 'menu' | 'review'

const BLOG_DRAFT_MAP: Record<BlogDraftType, { label: string; templateType: string }> = {
  new_open: { label: '신규 오픈 소식', templateType: '신규_오픈' },
  menu:     { label: '메뉴·서비스 소개', templateType: '메뉴_소개' },
  review:   { label: '리뷰 모음', templateType: '리뷰_모음' },
}

function makeChecklistStorageKey(businessName: string): string {
  // 간단한 해시: 가게 이름 기반 localStorage 키 (GuideClient 키와 충돌 방지)
  let hash = 0
  for (let i = 0; i < businessName.length; i++) {
    hash = (hash * 31 + businessName.charCodeAt(i)) & 0xffff
  }
  return `schema-checklist-${hash}`
}

export default function SchemaPageContent({ userId }: { userId: string }) {
  const [form, setForm] = useState({
    business_name: '', category: 'restaurant', region: '', address: '',
    phone: '', website_url: '', description: '', menu_items: '', specialty: '',
  })
  const [hoursRows, setHoursRows] = useState<HoursRow[]>([
    { id: '1', days: ['Mo', 'Tu', 'We', 'Th', 'Fr'], open: '09:00', close: '21:00', closed: false },
    { id: '2', days: ['Sa', 'Su'], open: '10:00', close: '20:00', closed: false },
  ])
  const [result, setResult] = useState<SchemaResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('briefing')
  const [blogDraftType, setBlogDraftType] = useState<BlogDraftType>('new_open')
  const [checkedCount, setCheckedCount] = useState(0)

  const checklistStorageKey = makeChecklistStorageKey(form.business_name)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const opening_hours = buildOpeningHoursString(hoursRows)
      const data = await generateSchema({ ...form, opening_hours }, userId) as SchemaResult
      setResult(data)
      setTab('briefing')
      setCheckedCount(0)
      setTimeout(() => document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      alert('생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  // 체크리스트 항목 수 초기화 (localStorage에서 복원)
  const recalcChecked = useCallback(() => {
    try {
      const stored = localStorage.getItem(checklistStorageKey)
      if (stored) {
        const arr = JSON.parse(stored) as number[]
        setCheckedCount(arr.length)
      }
    } catch {}
  }, [checklistStorageKey])

  const checklist = result?.extended_checklist ?? result?.smartplace_checklist ?? []
  const totalChecklist = checklist.length

  // 활성 탭 목록 결정
  const hasWebsite = !!result?.script_tag
  const hasNoWebsiteGuide = !!result?.no_website_guide

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'briefing',    label: 'AI 브리핑 최적화 점수', icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'smartplace',  label: '스마트플레이스 소개글',  icon: <MapPin className="w-4 h-4" /> },
    { key: 'blog',        label: '블로그 포스트 초안',      icon: <FileText className="w-4 h-4" /> },
    { key: 'checklist',   label: '최적화 체크리스트',       icon: <ListChecks className="w-4 h-4" /> },
    ...(hasWebsite
      ? [{ key: 'website' as Tab, label: '홈페이지 AI 연결', icon: <AlertCircle className="w-4 h-4" /> }]
      : hasNoWebsiteGuide
        ? [{ key: 'nowebsite' as Tab, label: '플레이스 등록 가이드', icon: <Globe className="w-4 h-4" /> }]
        : []),
  ]

  // 현재 블로그 초안 선택
  const selectedDraft: BlogDraft | null = result?.blog_drafts
    ? (result.blog_drafts.find((d) => d.template_type === BLOG_DRAFT_MAP[blogDraftType].templateType) ?? result.blog_drafts[0] ?? null)
    : null

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">스마트플레이스 · 블로그 AI 최적화</h1>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">
          가게 정보를 입력하면 스마트플레이스 소개글과 네이버 블로그 포스트 초안을 자동으로 만들어 드립니다.
        </p>
        <div className="mt-3 space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            <strong>✅ 홈페이지 없어도 OK.</strong> 소상공인 대부분은 <strong>스마트플레이스 소개글 탭</strong>만으로 AI 검색 노출을 높일 수 있습니다.
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
            홈페이지가 있다면 <strong>홈페이지 AI 연결 탭</strong>에서 JSON-LD 코드를 적용하면 ChatGPT·구글 AI 노출이 추가됩니다.
          </div>
        </div>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleGenerate} className="bg-white rounded-2xl p-4 md:p-6 shadow-sm space-y-5 mb-6">

        {/* 기본 정보 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">기본 정보</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가게 이름 *</label>
              <input required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 강남 맛있는 치킨" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">업종 *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORY_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.emoji} {g.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 위치·연락처 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">위치 · 연락처</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
              <input required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 강남구" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="02-0000-0000" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="서울시 강남구 테헤란로 123" />
          </div>
        </div>

        {/* 메뉴·서비스 (핵심) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            메뉴 · 서비스 <span className="text-gray-400 font-normal text-sm">(AI가 가장 많이 활용하는 정보)</span>
          </label>
          <textarea rows={2} value={form.menu_items} onChange={(e) => setForm({ ...form, menu_items: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="예: 후라이드치킨, 양념치킨, 간장치킨, 치킨무, 콜라 — 주력 메뉴나 서비스를 입력하세요" />
        </div>

        {/* 특징·강점 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            가게 특징 · 강점 <span className="text-gray-400 font-normal text-sm">(소개글에 반영됩니다)</span>
          </label>
          <textarea rows={2} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="예: 20년 전통, 주문 즉시 튀김, 배달 30분 이내, 무료 주차, 아이 동반 가능" />
        </div>

        {/* 영업시간 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">영업시간</h2>
          <p className="text-sm text-gray-400 mb-3">요일을 선택하고 시간을 설정하세요.</p>
          <OpeningHoursBuilder rows={hoursRows} onChange={setHoursRows} />
        </div>

        {/* 홈페이지 (선택) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            홈페이지 주소 <span className="text-gray-400 font-normal text-sm">(없으면 비워도 됩니다)</span>
          </label>
          <input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="https://내가게.com (없으면 비워두세요)" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI가 소개글과 블로그 초안을 작성하는 중...
            </>
          ) : '스마트플레이스 · 블로그 최적화 글 만들기'}
        </button>
      </form>

      {/* 결과 */}
      {result && (
        <div id="result-section" className="space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" strokeWidth={1.5} />
            <span className="text-sm font-medium text-green-800">완성됐습니다! 아래 탭에서 복사해 바로 사용하세요.</span>
          </div>

          {/* 탭 */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.label.slice(0, 4)}</span>
                </button>
              ))}
            </div>

            <div className="p-4 md:p-6">

              {/* ── AI 브리핑 최적화 점수 탭 ── */}
              {tab === 'briefing' && (
                <div className="space-y-5">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-1">AI 브리핑 최적화 점수</div>
                    <p className="text-sm text-gray-500">소개글에 AI가 검색할 때 중요한 키워드가 얼마나 포함됐는지 분석합니다.</p>
                  </div>

                  {result.intro_score ? (
                    <IntroScoreGauge introScore={result.intro_score} />
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
                      소개글 점수 분석 결과가 아직 없습니다. 소개글을 입력 후 생성해주세요.
                    </div>
                  )}

                  {result.intro_score && result.intro_score.matched_keywords.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2">소개글에 포함된 키워드</div>
                      <div className="flex flex-wrap gap-2">
                        {result.intro_score.matched_keywords.map((kw) => (
                          <span key={kw} className="text-sm bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.intro_score && result.intro_score.missing_top_keywords.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        부족한 키워드 <span className="text-red-500">— 소개글에 추가 권장</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {result.intro_score.missing_top_keywords.map((kw) => (
                          <button
                            key={kw}
                            onClick={() => navigator.clipboard.writeText(kw).catch(() => {})}
                            className="text-sm bg-red-50 text-red-600 px-2.5 py-1 rounded-full border border-red-200 hover:bg-red-100 transition-colors"
                            title="클릭하여 복사"
                          >
                            {kw}
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        위 키워드를 스마트플레이스 소개글에 자연스럽게 포함하면 AI 브리핑 노출 가능성이 높아집니다.
                      </p>
                    </div>
                  )}

                  {result.category_tips?.smartplace_tip && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="text-sm font-semibold text-blue-800 mb-1">업종 맞춤 팁</div>
                      <p className="text-sm text-blue-700 leading-relaxed">{result.category_tips.smartplace_tip}</p>
                    </div>
                  )}

                  {/* AI 핵심 키워드 */}
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-2">AI 검색 핵심 키워드 {result.keywords.length}개</div>
                    <p className="text-sm text-gray-500 mb-3">스마트플레이스 소개글·메뉴명·소식 포스트에 자연스럽게 포함하세요.</p>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw) => (
                        <button
                          key={kw}
                          onClick={() => navigator.clipboard.writeText(kw).catch(() => {})}
                          className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors"
                          title="클릭하여 복사"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 스마트플레이스 소개글 탭 ── */}
              {tab === 'smartplace' && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">스마트플레이스 소개글</div>
                      <p className="text-sm text-gray-500 mt-0.5">복사 → 네이버 스마트플레이스 관리 → 기본 정보 → 소개글에 붙여넣기</p>
                    </div>
                    <CopyButton text={result.smartplace_intro} label="소개글 복사" />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100">
                    {result.smartplace_intro}
                  </div>

                  {/* 스마트플레이스 적용 경로 */}
                  <div className="bg-blue-50 rounded-xl p-4 space-y-1.5">
                    <div className="text-sm font-semibold text-blue-800 mb-2">스마트플레이스 적용 방법</div>
                    {[
                      '1. 네이버 검색에서 "스마트플레이스 관리" 검색 → 로그인',
                      '2. 내 가게 선택 → [기본 정보] 탭',
                      '3. [소개글] 항목 클릭 → 기존 내용 삭제 후 위 텍스트 붙여넣기',
                      '4. [저장] 클릭 — 반영까지 최대 24시간 소요',
                    ].map((step) => (
                      <p key={step} className="text-sm text-blue-700">{step}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 블로그 포스트 탭 ── */}
              {tab === 'blog' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-1">블로그 포스트 초안 3종</div>
                    <p className="text-sm text-gray-500">목적에 맞는 초안을 선택해 복사하세요.</p>
                  </div>

                  {/* 3종 탭 선택 */}
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(BLOG_DRAFT_MAP) as [BlogDraftType, { label: string; templateType: string }][]).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setBlogDraftType(key)}
                        className={`text-sm px-3 py-2 rounded-lg font-medium transition-colors ${blogDraftType === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {val.label}
                      </button>
                    ))}
                  </div>

                  {/* 선택된 초안 */}
                  {selectedDraft ? (
                    <div className="space-y-3">
                      {/* target_keyword amber 뱃지 */}
                      {selectedDraft.target_keyword && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-amber-700 bg-amber-100 px-3 py-1 rounded-full font-medium">
                            목표 키워드: {selectedDraft.target_keyword}
                          </span>
                        </div>
                      )}

                      {/* 제목 */}
                      <div>
                        <div className="text-sm text-gray-500 mb-1">포스트 제목</div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <span className="flex-1 text-sm font-medium text-gray-800">{selectedDraft.title}</span>
                          <CopyButton text={selectedDraft.title} label="제목 복사" />
                        </div>
                      </div>

                      {/* 본문 */}
                      <div>
                        <div className="text-sm text-gray-500 mb-1">포스트 본문</div>
                        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100 max-h-80 overflow-y-auto">
                          {selectedDraft.content}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-400">복사 후 네이버 블로그 글쓰기에 붙여넣기</span>
                          <CopyButton text={`${selectedDraft.title}\n\n${selectedDraft.content}`} label="전체 복사" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* blog_drafts가 없으면 기존 단일 초안 표시 (하위호환) */
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">포스트 제목</div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <span className="flex-1 text-sm font-medium text-gray-800">{result.blog_title}</span>
                          <CopyButton text={result.blog_title} label="제목 복사" />
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">포스트 본문</div>
                        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100 max-h-80 overflow-y-auto">
                          {result.blog_content}
                        </div>
                        <div className="flex justify-end mt-2">
                          <CopyButton text={result.blog_content} label="본문 복사" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* category_tips.blog_tip */}
                  {result.category_tips?.blog_tip && (
                    <div className="bg-amber-50 rounded-xl p-4">
                      <div className="text-sm font-semibold text-amber-800 mb-1">업종 맞춤 블로그 팁</div>
                      <p className="text-sm text-amber-700 leading-relaxed">{result.category_tips.blog_tip}</p>
                    </div>
                  )}

                  {/* 일반 블로그 팁 */}
                  <div className="bg-amber-50 rounded-xl p-4 space-y-1.5">
                    <div className="text-sm font-semibold text-amber-800 mb-2">블로그 포스트 효과를 높이는 팁</div>
                    {[
                      '사진 5장 이상 첨부 — 내부·메뉴·외부 골고루',
                      '포스트 발행 후 스마트플레이스 관리 → [블로그 연결] 등록',
                      '월 1~2회 꾸준히 올리면 AI 검색 최신성 점수 상승',
                      '리뷰 답글과 동일한 키워드 사용 권장',
                    ].map((tip) => (
                      <p key={tip} className="text-sm text-amber-700 flex items-start gap-1.5">
                        <span className="shrink-0">•</span>{tip}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 체크리스트 탭 ── */}
              {tab === 'checklist' && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">스마트플레이스 AI 최적화 체크리스트</div>
                      <p className="text-sm text-gray-500 mt-0.5">항목을 클릭해 완료 표시, 물음표(▾)를 눌러 이유를 확인하세요.</p>
                    </div>
                  </div>

                  {/* 진행률 바 */}
                  {totalChecklist > 0 && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-600">전체 진행률</span>
                        <span className="text-sm font-semibold text-blue-600">{checkedCount} / {totalChecklist} 완료</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${totalChecklist > 0 ? (checkedCount / totalChecklist) * 100 : 0}%` }}
                        />
                      </div>
                      {checkedCount === totalChecklist && totalChecklist > 0 && (
                        <p className="text-sm text-green-600 font-medium mt-2">모든 항목을 완료했습니다!</p>
                      )}
                    </div>
                  )}

                  {checklist.map((c, i) => (
                    <ChecklistItem
                      key={`${c.item}-${i}`}
                      item={c.item}
                      tip={c.tip}
                      storageKey={checklistStorageKey}
                      index={i}
                      onToggle={() => recalcChecked()}
                    />
                  ))}
                </div>
              )}

              {/* ── 홈페이지 AI 연결 탭 (있는 경우만) ── */}
              {tab === 'website' && result.script_tag && (
                <div className="space-y-4">
                  {/* 이 코드 어디에 넣나요? 안내 카드 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-blue-800 mb-2">📌 이 코드를 어디에 넣나요?</p>
                    <p className="text-sm text-blue-700 mb-3 leading-relaxed">
                      홈페이지 HTML 소스에서 <code className="bg-blue-100 px-1 rounded">&lt;/head&gt;</code> 태그 바로 위에 붙여넣으면 됩니다.<br />
                      홈페이지가 없다면 이 코드 대신 <strong>스마트플레이스 소개글 탭</strong>을 사용하세요.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-700">
                      <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                        <strong>워드프레스:</strong><br />
                        외모 → 테마 편집기 → header.php → <code>&lt;/head&gt;</code> 위
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                        <strong>카페24 / 고도몰:</strong><br />
                        쇼핑몰 관리 → HTML 편집 → header 영역에 삽입
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                        <strong>Wix / 식스샵:</strong><br />
                        사이트 설정 → SEO → 커스텀 코드 → head 영역
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                        <strong>직접 만든 홈페이지:</strong><br />
                        모든 페이지 HTML의 &lt;/head&gt; 바로 위
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">AI 검색 최적화 코드 (JSON-LD)</div>
                      <p className="text-sm text-gray-500 mt-0.5">복사 후 홈페이지 &lt;/head&gt; 바로 위에 붙여넣기</p>
                    </div>
                    <CopyButton text={result.script_tag} label="코드 복사" />
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4">
                    <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {result.script_tag}
                    </pre>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                    💡 적용 후 구글 서치 콘솔(search.google.com/search-console)에서 URL을 검사하면 코드가 인식됐는지 확인할 수 있습니다.
                  </div>
                </div>
              )}

              {/* ── 플레이스 등록 가이드 탭 (홈페이지 없는 경우) ── */}
              {tab === 'nowebsite' && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-1">홈페이지 없이 AI 검색 노출 높이는 방법</div>
                    <p className="text-sm text-gray-500">홈페이지가 없어도 아래 3가지 플랫폼 등록만으로 AI 검색 노출을 높일 수 있습니다.</p>
                  </div>

                  {result.no_website_guide && (
                    <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                      {result.no_website_guide}
                    </div>
                  )}

                  {/* 3대 플랫폼 등록 안내 카드 */}
                  {[
                    {
                      name: '네이버 스마트플레이스',
                      desc: '네이버 지도·AI 브리핑 노출의 핵심. FAQ·소식·소개글 등록 시 AI 검색 노출 가능성 향상.',
                      url: 'https://smartplace.naver.com',
                      badge: '가장 중요',
                      badgeColor: 'bg-red-100 text-red-700',
                    },
                    {
                      name: '카카오맵 비즈니스',
                      desc: '카카오맵·카카오내비 검색 노출. 2,500만 사용자 도달 가능.',
                      url: 'https://business.kakao.com',
                      badge: '추천',
                      badgeColor: 'bg-yellow-100 text-yellow-700',
                    },
                    {
                      name: '구글 비즈니스 프로필',
                      desc: '구글 지도·구글 AI Overview 노출. 글로벌 AI 채널 점수에 반영됨.',
                      url: 'https://business.google.com',
                      badge: '글로벌 AI',
                      badgeColor: 'bg-blue-100 text-blue-700',
                    },
                  ].map((platform) => (
                    <div key={platform.name} className="flex items-start justify-between gap-3 border border-gray-100 rounded-xl p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-800">{platform.name}</span>
                          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${platform.badgeColor}`}>{platform.badge}</span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{platform.desc}</p>
                      </div>
                      <a
                        href={platform.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 shrink-0 mt-1"
                      >
                        등록하기 <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-center text-gray-400">
            적용 후 2~4주 뒤 AEOlab 스캔에서 점수 변화를 확인하세요.
          </p>
        </div>
      )}
    </div>
  )
}
