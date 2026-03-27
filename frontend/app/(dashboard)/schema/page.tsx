'use client'

import { useState } from 'react'
import { generateSchema } from '@/lib/api'
import { CATEGORY_GROUPS } from '@/lib/categories'
import { Bot, Search, MapPin, CheckCircle2, Globe, FileText, MessageSquare, Lightbulb, ClipboardCopy, Check } from 'lucide-react'

// 영업시간 빌더용 상수
const DAYS = [
  { key: 'Mo', label: '월' },
  { key: 'Tu', label: '화' },
  { key: 'We', label: '수' },
  { key: 'Th', label: '목' },
  { key: 'Fr', label: '금' },
  { key: 'Sa', label: '토' },
  { key: 'Su', label: '일' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0')
  return { value: `${h}:00`, label: i === 0 ? '자정' : i < 12 ? `오전 ${i}시` : i === 12 ? '정오' : `오후 ${i - 12}시` }
})

interface HoursRow {
  id: string
  days: string[]
  open: string
  close: string
  closed: boolean
}

function buildOpeningHoursString(rows: HoursRow[]): string {
  return rows
    .filter((r) => !r.closed && r.days.length > 0)
    .map((r) => `${r.days.join(',')} ${r.open}-${r.close}`)
    .join(', ')
}

function OpeningHoursBuilder({
  rows,
  onChange,
}: {
  rows: HoursRow[]
  onChange: (rows: HoursRow[]) => void
}) {
  const toggleDay = (rowId: string, dayKey: string) => {
    onChange(
      rows.map((r) =>
        r.id === rowId
          ? { ...r, days: r.days.includes(dayKey) ? r.days.filter((d) => d !== dayKey) : [...r.days, dayKey] }
          : r
      )
    )
  }
  const updateRow = (rowId: string, field: keyof HoursRow, value: string | boolean) => {
    onChange(rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)))
  }
  const addRow = () => {
    onChange([...rows, { id: Date.now().toString(), days: [], open: '09:00', close: '21:00', closed: false }])
  }
  const removeRow = (rowId: string) => {
    onChange(rows.filter((r) => r.id !== rowId))
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
          {/* 요일 선택 */}
          <div className="flex gap-1 flex-wrap">
            {DAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(row.id, d.key)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  row.days.includes(d.key)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="ml-auto text-xs text-gray-400 hover:text-red-400 px-2"
            >
              삭제
            </button>
          </div>

          {/* 시간 or 휴무 */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={row.closed}
                onChange={(e) => updateRow(row.id, 'closed', e.target.checked)}
                className="accent-red-500"
              />
              휴무
            </label>
            {!row.closed && (
              <>
                <select
                  value={row.open}
                  onChange={(e) => updateRow(row.id, 'open', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
                <span className="text-gray-400 text-sm">~</span>
                <select
                  value={row.close}
                  onChange={(e) => updateRow(row.id, 'close', e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  {HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="w-full border border-dashed border-gray-300 text-gray-400 text-sm py-2 rounded-xl hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        + 시간대 추가 (예: 주말 별도 설정)
      </button>
    </div>
  )
}

export default function SchemaPage() {
  const [form, setForm] = useState({
    business_name: '',
    category: 'restaurant',
    region: '',
    address: '',
    phone: '',
    website_url: '',
    description: '',
  })
  const [hoursRows, setHoursRows] = useState<HoursRow[]>([
    { id: '1', days: ['Mo', 'Tu', 'We', 'Th', 'Fr'], open: '09:00', close: '21:00', closed: false },
    { id: '2', days: ['Sa', 'Su'], open: '10:00', close: '20:00', closed: false },
  ])
  const [noWebsite, setNoWebsite] = useState(false)
  const [result, setResult] = useState<{ schema: object; script_tag: string; instructions: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const opening_hours = buildOpeningHoursString(hoursRows)
      const data = await generateSchema({
        ...form,
        opening_hours,
      }) as { schema: object; script_tag: string; instructions: string }
      setResult(data)
      // 결과로 스크롤
      setTimeout(() => document.getElementById('schema-result')?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      alert('코드 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (result?.script_tag) {
      navigator.clipboard.writeText(result.script_tag)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI 검색 등록 코드 만들기</h1>
        <p className="text-gray-500 text-sm mt-1">
          내 가게 정보를 입력하면 구글·ChatGPT·네이버 AI가 정확하게 읽을 수 있는 코드를 만들어 드립니다.
        </p>
        {/* 효과 설명 배너 */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {[
            { Icon: Bot,    text: 'AI 검색 인식률 향상' },
            { Icon: Search, text: '구글 검색 노출 개선' },
            { Icon: MapPin, text: '가게 정보 정확도 향상' },
          ].map((b) => (
            <span key={b.text} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
              <b.Icon className="w-3 h-3" /> {b.text}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleGenerate} className="bg-white rounded-2xl p-6 shadow-sm space-y-5 mb-6">

        {/* 기본 정보 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">기본 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가게 이름 *</label>
              <input
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 강남 맛있는 치킨"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">업종 *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 위치 정보 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">위치 · 연락처</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <input
                  required
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 강남구"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="02-0000-0000"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="서울시 강남구 테헤란로 123"
              />
            </div>
          </div>
        </div>

        {/* 웹사이트 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">홈페이지 주소</label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={noWebsite}
                onChange={(e) => { setNoWebsite(e.target.checked); if (e.target.checked) setForm({ ...form, website_url: '' }) }}
                className="w-3.5 h-3.5 accent-blue-600"
              />
              <span className="text-xs text-gray-500">홈페이지 없음</span>
            </label>
          </div>
          {noWebsite ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              홈페이지가 없어도 괜찮습니다. 생성된 코드를 <strong>네이버 블로그, 카카오 채널, 인스타그램 프로필</strong>에 활용하는 방법을 함께 안내해 드립니다.
            </div>
          ) : (
            <input
              value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="https://내가게.com"
            />
          )}
        </div>

        {/* 영업시간 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">영업시간</h2>
          <p className="text-xs text-gray-400 mb-3">요일을 선택하고 여는 시간과 닫는 시간을 설정하세요.</p>
          <OpeningHoursBuilder rows={hoursRows} onChange={setHoursRows} />
        </div>

        {/* 가게 소개 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            가게 소개 <span className="text-gray-400 font-normal text-xs">(선택 — 비워두면 자동 작성)</span>
          </label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="예: 20년 전통 강남 치킨집. 바삭한 튀김과 비법 양념으로 유명합니다."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? '코드 생성 중...' : 'AI 검색 등록 코드 만들기'}
        </button>
      </form>

      {/* 결과 */}
      {result && (
        <div id="schema-result" className="space-y-4">
          {/* 완성 메시지 */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" strokeWidth={1.5} />
              <span className="font-semibold text-green-800">AI 검색 등록 코드가 완성됐습니다!</span>
            </div>
            <p className="text-sm text-green-700">{result.instructions}</p>
          </div>

          {/* 적용 가이드 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">적용 방법 선택</h3>
            <div className="space-y-3">
              {/* 홈페이지 있는 경우 */}
              {!noWebsite && (
                <details className="border border-gray-100 rounded-xl overflow-hidden">
                  <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm font-medium text-gray-700">
                    <Globe className="w-4 h-4" strokeWidth={1.5} /> 홈페이지가 있어요
                  </summary>
                  <div className="px-4 pb-4 text-sm text-gray-600 space-y-1 border-t border-gray-50 pt-3">
                    <p>1. 홈페이지 관리자 페이지에 접속</p>
                    <p>2. HTML 편집기에서 <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> 태그 안을 찾기</p>
                    <p>3. 아래 코드를 <code className="bg-gray-100 px-1 rounded">&lt;/head&gt;</code> 바로 위에 붙여넣기</p>
                    <p className="text-xs text-gray-400 mt-2">* 워드프레스: 외모 → 테마편집기 → header.php</p>
                  </div>
                </details>
              )}
              {/* 네이버 블로그 */}
              <details className="border border-gray-100 rounded-xl overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm font-medium text-gray-700">
                  <FileText className="w-4 h-4" strokeWidth={1.5} /> 네이버 블로그로 활용할게요
                </summary>
                <div className="px-4 pb-4 text-sm text-gray-600 space-y-1 border-t border-gray-50 pt-3">
                  <p>1. 네이버 블로그 → 새 포스트 작성</p>
                  <p>2. 오른쪽 상단 <strong>HTML</strong> 모드로 전환</p>
                  <p>3. 포스트 맨 위 또는 맨 아래에 코드 붙여넣기</p>
                  <p>4. 포스트 제목을 <strong>"가게이름 + 지역 + 업종"</strong>으로 설정</p>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> 블로그 포스트 하나가 AI 검색 소스가 됩니다!</p>
                </div>
              </details>
              {/* 카카오 채널 */}
              <details className="border border-gray-100 rounded-xl overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm font-medium text-gray-700">
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} /> 카카오 채널로 활용할게요
                </summary>
                <div className="px-4 pb-4 text-sm text-gray-600 space-y-1 border-t border-gray-50 pt-3">
                  <p>카카오 채널은 HTML 코드 삽입이 제한됩니다.</p>
                  <p>대신 채널 소개글에 아래 정보를 채워주세요:</p>
                  <ul className="list-disc list-inside text-xs text-gray-500 mt-1 space-y-0.5">
                    <li>정확한 가게 이름 + 지역 + 업종 명시</li>
                    <li>전화번호 · 주소 · 영업시간 최신 정보 유지</li>
                    <li>서비스/메뉴 키워드 포함</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          {/* 코드 영역 */}
          <div className="bg-gray-900 rounded-2xl p-4 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400">생성된 코드 (복사 후 붙여넣기)</span>
              <button
                onClick={copyToClipboard}
                className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {copied
                  ? <><Check className="w-3.5 h-3.5 inline mr-1" />복사됨!</>
                  : <><ClipboardCopy className="w-3.5 h-3.5 inline mr-1" />코드 복사</>
                }
              </button>
            </div>
            <pre className="text-green-400 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {result.script_tag}
            </pre>
          </div>

          <p className="text-xs text-center text-gray-400">
            코드를 적용한 후 2~4주 뒤 AEOlab 스캔에서 점수 변화를 확인하세요.
          </p>
        </div>
      )}
    </div>
  )
}
