'use client'

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export interface ChannelTrendPoint {
  scan_date: string               // "YYYY-MM-DD"
  gemini_exposure_rate: number | null    // 0~100 정수 %
  gemini_exposure_freq: number | null    // 원본 언급 횟수(정수)
  gemini_sample_size: number | null      // 표본수(정수, 50 또는 100)
  chatgpt_exposure_rate: number | null
  chatgpt_exposure_freq: number | null
  chatgpt_sample_size: number | null
}

const SMOOTH_WINDOW = 5  // 최근 측정 N회 기준(달력일 아님) — 조정 시 이 상수만 변경

/**
 * 표본크기 가중 이동평균 (풀링 비율 추정량)
 * data는 오름차순(과거→현재) 전제 — 호출 전 반드시 reverse 완료 상태여야 함.
 * Pro 플랜은 표본 50/100이 교대되어 단순 평균 시 노이즈가 생기므로
 * 분모(표본크기 합)로 나눠 편향을 없앤다.
 */
function weightedMovingAvg(
  data: ChannelTrendPoint[],
  freqKey: 'gemini_exposure_freq' | 'chatgpt_exposure_freq',
  sizeKey: 'gemini_sample_size' | 'chatgpt_sample_size',
  n: number = SMOOTH_WINDOW
): (number | null)[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - n + 1)
    const window = data.slice(start, i + 1)
    const valid = window.filter(p => p[freqKey] !== null && p[sizeKey] !== null)
    if (valid.length === 0) return null
    const totalMentions = valid.reduce((s, p) => s + (p[freqKey] as number), 0)
    const totalSamples  = valid.reduce((s, p) => s + (p[sizeKey] as number), 0)
    return totalSamples > 0 ? Math.round((totalMentions / totalSamples) * 100) : null
  })
}

interface ChartEntry {
  date: string
  gemini_raw: number | null
  gemini_avg: number | null
  chatgpt_raw: number | null
  chatgpt_avg: number | null
  gemini_freq: number | null
  gemini_size: number | null
  chatgpt_freq: number | null
  chatgpt_size: number | null
}

interface TooltipPayloadItem {
  dataKey: string
  value: number | null
  payload: ChartEntry
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0]?.payload as ChartEntry | undefined
  if (!entry) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow text-sm space-y-1.5" style={{ minWidth: 200 }}>
      <p className="font-medium text-gray-700 mb-1">{label}</p>

      {/* Gemini */}
      <div>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />
        <span className="font-medium text-emerald-800">Gemini</span>
        {entry.gemini_avg !== null && (
          <span className="ml-1 text-emerald-700">
            {entry.gemini_avg}%
            <span className="text-gray-500 font-normal"> (최근 {SMOOTH_WINDOW}회 가중평균)</span>
          </span>
        )}
        {entry.gemini_freq !== null && entry.gemini_size !== null && (
          <div className="text-gray-500 ml-3.5">
            이날 측정 {entry.gemini_size}번 중 {entry.gemini_freq}번
          </div>
        )}
      </div>

      {/* ChatGPT */}
      <div>
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1" />
        <span className="font-medium text-blue-800">ChatGPT</span>
        {entry.chatgpt_avg !== null && (
          <span className="ml-1 text-blue-700">
            {entry.chatgpt_avg}%
            <span className="text-gray-500 font-normal"> (최근 {SMOOTH_WINDOW}회 가중평균)</span>
          </span>
        )}
        {entry.chatgpt_freq !== null && entry.chatgpt_size !== null && (
          <div className="text-gray-500 ml-3.5">
            이날 측정 {entry.chatgpt_size}번 중 {entry.chatgpt_freq}번
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  data: ChannelTrendPoint[]
}

export default function ChannelExposureTrendChart({ data }: Props) {
  // 데이터 없음 — 잠금 UI(PlanGate 패턴) 또는 미측정 안내
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm">
        <h3 className="text-base font-medium text-gray-700 mb-3">AI별 노출률 추이</h3>
        <div className="flex items-center justify-center h-28 text-sm text-gray-600">
          아직 측정 데이터 없음 — 첫 자동 측정 후 표시됩니다
        </div>
      </div>
    )
  }

  // API는 scanned_at DESC(최신이 인덱스 0) — 오름차순으로 뒤집은 뒤 평활화 계산
  // TrendLine.tsx:62 와 동일한 [...data].reverse() 패턴 — 방향 오류 방지
  const sorted = [...data].reverse()

  const geminiAvg  = weightedMovingAvg(sorted, 'gemini_exposure_freq',  'gemini_sample_size')
  const chatgptAvg = weightedMovingAvg(sorted, 'chatgpt_exposure_freq', 'chatgpt_sample_size')

  const chartData: ChartEntry[] = sorted.map((d, i) => ({
    date:          d.scan_date.slice(5),   // "MM-DD"
    gemini_raw:    d.gemini_exposure_rate,
    gemini_avg:    geminiAvg[i],
    chatgpt_raw:   d.chatgpt_exposure_rate,
    chatgpt_avg:   chatgptAvg[i],
    gemini_freq:   d.gemini_exposure_freq,
    gemini_size:   d.gemini_sample_size,
    chatgpt_freq:  d.chatgpt_exposure_freq,
    chatgpt_size:  d.chatgpt_sample_size,
  }))

  // 데이터 1개이면 선 없이 점만 표시
  const singlePoint = chartData.length === 1

  return (
    <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm">
      {/* 헤더 + 범례 */}
      <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-base font-medium text-gray-700">AI별 노출률 추이</h3>
        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
          {/* Gemini 범례 */}
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-0.5 bg-emerald-600 rounded" />
            <span className="inline-block w-3 border-t-2 border-dashed border-emerald-400 opacity-70" />
            <span>Gemini</span>
          </span>
          {/* ChatGPT 범례 */}
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-0.5 bg-blue-600 rounded" />
            <span className="inline-block w-3 border-t-2 border-dashed border-blue-400 opacity-70" />
            <span>ChatGPT</span>
          </span>
          <span className="text-xs text-gray-400">— 가중평균  ···  원시 측정값</span>
        </div>
      </div>

      {/* 차트 — PC: h-56(224px), 모바일: h-40(160px) */}
      <div className="h-40 md:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              interval={singlePoint ? 0 : 'preserveStartEnd'}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={(v: number) => `${v}%`}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* ── Gemini 원시값 — 옅은 점선 언더레이 ── */}
            <Line
              type="monotone"
              dataKey="gemini_raw"
              stroke="#059669"
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              dot={singlePoint ? { r: 3, fill: '#059669' } : false}
              activeDot={{ r: 3, fill: '#059669' }}
              connectNulls={false}
              name="Gemini 원시"
            />
            {/* ── Gemini 가중평균 — 굵은 실선 메인 ── */}
            <Line
              type="monotone"
              dataKey="gemini_avg"
              stroke="#059669"
              strokeWidth={2}
              dot={singlePoint ? { r: 4, fill: '#059669' } : false}
              activeDot={{ r: 4, fill: '#059669' }}
              connectNulls={false}
              name="Gemini 가중평균"
            />

            {/* ── ChatGPT 원시값 — 옅은 점선 언더레이 ── */}
            <Line
              type="monotone"
              dataKey="chatgpt_raw"
              stroke="#2563eb"
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              dot={singlePoint ? { r: 3, fill: '#2563eb' } : false}
              activeDot={{ r: 3, fill: '#2563eb' }}
              connectNulls={false}
              name="ChatGPT 원시"
            />
            {/* ── ChatGPT 가중평균 — 굵은 실선 메인 ── */}
            <Line
              type="monotone"
              dataKey="chatgpt_avg"
              stroke="#2563eb"
              strokeWidth={2}
              dot={singlePoint ? { r: 4, fill: '#2563eb' } : false}
              activeDot={{ r: 4, fill: '#2563eb' }}
              connectNulls={false}
              name="ChatGPT 가중평균"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 필수 캡션 — 채널별 반영 속도 안내 (생략 금지) */}
      <p className="text-sm text-gray-500 mt-2 leading-snug">
        Gemini는 2~4주, ChatGPT는 수개월 단위로 변화가 반영됩니다. 단기 등락보다 방향 추세를 확인하세요.
      </p>
    </div>
  )
}
