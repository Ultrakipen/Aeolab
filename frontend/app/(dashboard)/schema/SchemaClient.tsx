'use client'

import { useState } from 'react'
import { generateSchema } from '@/lib/api'
import { CATEGORY_GROUPS } from '@/lib/categories'
import {
  CheckCircle2, ClipboardCopy, Check, ChevronDown, ChevronUp,
  MapPin, FileText, ListChecks, Lightbulb, AlertCircle
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

// 체크리스트 아이템
function ChecklistItem({ item, tip }: { item: string; tip: string }) {
  const [checked, setChecked] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${checked ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setChecked(!checked)} className="shrink-0">
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

type Tab = 'smartplace' | 'blog' | 'checklist' | 'website'

interface SchemaResult {
  smartplace_intro: string
  blog_title: string
  blog_content: string
  keywords: string[]
  smartplace_checklist: { item: string; tip: string }[]
  script_tag?: string
}

export default function SchemaPageContent() {
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
  const [tab, setTab] = useState<Tab>('smartplace')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const opening_hours = buildOpeningHoursString(hoursRows)
      const data = await generateSchema({ ...form, opening_hours }) as SchemaResult
      setResult(data)
      setTab('smartplace')
      setTimeout(() => document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      alert('생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; available: boolean }[] = [
    { key: 'smartplace', label: '스마트플레이스 소개글', icon: <MapPin className="w-4 h-4" />, available: true },
    { key: 'blog',       label: '블로그 포스트 초안',    icon: <FileText className="w-4 h-4" />,  available: true },
    { key: 'checklist',  label: '최적화 체크리스트',     icon: <ListChecks className="w-4 h-4" />, available: true },
    { key: 'website',    label: '홈페이지 코드',          icon: <AlertCircle className="w-4 h-4" />, available: !!result?.script_tag },
  ]

  return (
    <div className="p-8 max-w-3xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">스마트플레이스 · 블로그 AI 최적화</h1>
        <p className="text-gray-500 text-sm mt-1">
          가게 정보를 입력하면 스마트플레이스 소개글과 네이버 블로그 포스트 초안을 자동으로 만들어 드립니다.
        </p>
        <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          <strong>홈페이지 없어도 OK.</strong> 대부분의 소상공인은 스마트플레이스와 블로그만으로 AI 검색 노출을 높일 수 있습니다.
        </div>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleGenerate} className="bg-white rounded-2xl p-6 shadow-sm space-y-5 mb-6">

        {/* 기본 정보 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">기본 정보</h2>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3 mb-3">
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
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'AI가 소개글과 블로그 초안을 작성하는 중...' : '스마트플레이스 · 블로그 최적화 글 만들기'}
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
              {tabs.filter((t) => t.key !== 'website' || t.available).map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
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

                  {/* 핵심 키워드 */}
                  <div>
                    <div className="text-sm font-semibold text-gray-800 mb-2">AI 검색 핵심 키워드 10개</div>
                    <p className="text-sm text-gray-500 mb-3">스마트플레이스 소개글·메뉴명·소식 포스트에 자연스럽게 포함하세요.</p>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw) => (
                        <span key={kw} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full">{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 블로그 포스트 탭 ── */}
              {tab === 'blog' && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">네이버 블로그 포스트 초안</div>
                      <p className="text-sm text-gray-500 mt-0.5">복사 → 네이버 블로그 새 글쓰기에 붙여넣기 후 사진·링크 추가</p>
                    </div>
                    <CopyButton text={`${result.blog_title}\n\n${result.blog_content}`} label="전체 복사" />
                  </div>

                  {/* 제목 */}
                  <div>
                    <div className="text-sm text-gray-500 mb-1">포스트 제목</div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <span className="flex-1 text-sm font-medium text-gray-800">{result.blog_title}</span>
                      <CopyButton text={result.blog_title} label="제목 복사" />
                    </div>
                  </div>

                  {/* 본문 */}
                  <div>
                    <div className="text-sm text-gray-500 mb-1">포스트 본문</div>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border border-gray-100 max-h-80 overflow-y-auto">
                      {result.blog_content}
                    </div>
                    <div className="flex justify-end mt-2">
                      <CopyButton text={result.blog_content} label="본문 복사" />
                    </div>
                  </div>

                  {/* 블로그 적용 팁 */}
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
                  <div>
                    <div className="text-sm font-semibold text-gray-800">스마트플레이스 AI 최적화 체크리스트</div>
                    <p className="text-sm text-gray-500 mt-0.5">항목을 클릭해 완료 표시, 물음표(▾)를 눌러 이유를 확인하세요.</p>
                  </div>
                  {result.smartplace_checklist.map((c) => (
                    <ChecklistItem key={c.item} item={c.item} tip={c.tip} />
                  ))}
                </div>
              )}

              {/* ── 홈페이지 코드 탭 (있는 경우만) ── */}
              {tab === 'website' && result.script_tag && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">홈페이지용 JSON-LD 코드</div>
                      <p className="text-sm text-gray-500 mt-0.5">홈페이지 HTML의 &lt;/head&gt; 바로 위에 붙여넣기</p>
                    </div>
                    <CopyButton text={result.script_tag} label="코드 복사" />
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4">
                    <pre className="text-green-400 text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {result.script_tag}
                    </pre>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>• 워드프레스: 외모 → 테마 편집기 → header.php의 &lt;/head&gt; 위</p>
                    <p>• 카페24: 쇼핑몰 관리 → HTML 편집 → header에 삽입</p>
                  </div>
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
