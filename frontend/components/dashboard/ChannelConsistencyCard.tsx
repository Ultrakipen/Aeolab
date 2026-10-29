'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Loader2, Lock, MinusCircle } from 'lucide-react'
import {
  ConsistencyApiError,
  getConsistencyStatus,
  linkGooglePlace,
  runConsistencyCheck,
  searchGoogleCandidates,
  type ConsistencyChannel,
  type ConsistencyField,
  type ConsistencyResult,
  type ConsistencyStatus,
  type ConsistencyStatusInfo,
  type GoogleCandidate,
} from '@/lib/api'

/**
 * 채널 정보 일치 점검 (Basic 이상) — 입력한 이름·주소·전화·웹사이트가 카카오맵·네이버·구글 지도에서 같은지.
 * 설계: docs/naver_independence_design_v2.0_final_2026_10_29.md §5-2
 * - AI Visibility 점수·등급을 만들지 않는다. 항목별 일치/다름/확인 못함만 보여준다.
 * - 구글 지도 정보는 약관상 저장하지 않고 점검할 때마다 새로 불러온다. 표시할 때 Google Maps 출처를 함께 적는다.
 * - "확인 못함"은 조회 실패·채널이 값을 제공하지 않는 경우이며 "다름"이 아니다.
 */

const PAID_PLANS = ['basic', 'startup', 'pro', 'biz', 'enterprise']

const FIELD_ROWS: { key: 'name' | 'address' | 'phone' | 'website'; label: string }[] = [
  { key: 'name', label: '가게 이름' },
  { key: 'address', label: '주소' },
  { key: 'phone', label: '전화번호' },
  { key: 'website', label: '웹사이트' },
]

const CHANNELS: { key: 'kakao' | 'naver' | 'google'; label: string }[] = [
  { key: 'kakao', label: '카카오맵' },
  { key: 'naver', label: '네이버 지도' },
  { key: 'google', label: '구글 지도' },
]

const STATUS_VIEW: Record<ConsistencyStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  match: { label: '일치', cls: 'text-green-800 bg-green-50 border-green-200', Icon: CheckCircle2 },
  mismatch: { label: '다름', cls: 'text-red-800 bg-red-50 border-red-200', Icon: AlertTriangle },
  unknown: { label: '확인 못함', cls: 'text-gray-700 bg-gray-50 border-gray-200', Icon: MinusCircle },
}

function StatusBadge({ status }: { status: ConsistencyStatus }) {
  const v = STATUS_VIEW[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold ${v.cls}`}>
      <v.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {v.label}
    </span>
  )
}

function errMsg(e: unknown): string {
  return e instanceof ConsistencyApiError ? e.message : '잠시 후 다시 시도해 주세요'
}

function channelNotice(ch: ConsistencyChannel | undefined): string | null {
  if (!ch) return null
  switch (ch.state) {
    case 'found':
      return null
    case 'not_found':
      return ch.lookup_uncertain
        ? '검색 결과에서 찾지 못했어요. 조회에 실패했을 수도 있어요.'
        : '검색 결과에서 내 가게를 찾지 못했어요.'
    case 'ambiguous':
      return '같은 이름의 가게가 여러 곳 보여 어느 지점인지 알 수 없어요.'
    case 'not_linked':
      return '아직 연결하지 않았어요. 위에서 내 가게를 찾아 연결해 주세요.'
    default:
      return '지금은 확인하지 못했어요. 잠시 후 다시 점검해 주세요.'
  }
}

function FieldCell({ field }: { field: ConsistencyField | undefined }) {
  if (!field) return <span className="text-sm text-gray-500">비교 안 함</span>
  return (
    <div className="space-y-1">
      <StatusBadge status={field.status} />
      {field.observed && <p className="break-all text-sm text-gray-800">{field.observed}</p>}
      {field.note && <p className="text-sm text-gray-600">{field.note}</p>}
    </div>
  )
}

export function ChannelConsistencyCard({
  bizId,
  accessToken,
  plan,
}: {
  bizId: string
  accessToken?: string | null
  plan: string
}) {
  const paid = PAID_PLANS.includes(plan)
  const [info, setInfo] = useState<ConsistencyStatusInfo | null>(null)
  const [result, setResult] = useState<ConsistencyResult | null>(null)
  const [candidates, setCandidates] = useState<GoogleCandidate[] | null>(null)
  const [busy, setBusy] = useState<'check' | 'search' | 'link' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!paid || !accessToken) return
    let alive = true
    getConsistencyStatus(bizId, accessToken)
      .then((s) => alive && setInfo(s))
      .catch((e) => alive && setError(errMsg(e)))
    return () => {
      alive = false
    }
  }, [bizId, accessToken, paid])

  const applyUsage = useCallback((used: number, limit: number, remaining: number) => {
    setInfo((prev) => (prev ? { ...prev, used, limit, remaining } : prev))
  }, [])

  const onCheck = async () => {
    if (!accessToken) return
    setBusy('check')
    setError(null)
    try {
      const r = await runConsistencyCheck(bizId, accessToken)
      setResult(r)
      if (r.usage) applyUsage(r.usage.used, r.usage.limit, r.usage.remaining)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const onSearch = async () => {
    if (!accessToken) return
    setBusy('search')
    setError(null)
    try {
      const r = await searchGoogleCandidates(bizId, accessToken)
      setCandidates(r.candidates)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const onLink = async (placeId: string | null) => {
    if (!accessToken) return
    setBusy('link')
    setError(null)
    try {
      const r = await linkGooglePlace(bizId, accessToken, placeId)
      setInfo((prev) => (prev ? { ...prev, google_linked: r.google_linked } : prev))
      setCandidates(null)
      setResult(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  // ── 무료 플랜: 잠금 안내 ──
  if (!paid) {
    return (
      <div className="rounded-xl border bg-white p-4 shadow-sm md:p-6">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-800 md:text-lg">
          <Lock className="h-4 w-4 text-gray-500" aria-hidden="true" />
          채널 정보 일치 점검
        </h3>
        <p className="mt-2 text-sm text-gray-700">
          내가 입력한 이름·주소·전화번호가 카카오맵·네이버·구글 지도에서 같은지 한 번에 확인해요. Basic 이상 플랜에서 사용할 수 있어요.
        </p>
        <Link href="/pricing" className="mt-3 inline-block text-sm font-semibold text-blue-700 underline">
          요금제 보기
        </Link>
      </div>
    )
  }

  const unlimited = info ? info.limit >= 999 : false
  const noneLeft = !!info && !unlimited && info.remaining <= 0
  const s = result?.summary

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm md:p-6">
      <h3 className="text-base font-bold text-gray-800 md:text-lg">채널 정보 일치 점검</h3>
      <p className="mt-1 text-sm text-gray-700">
        내가 입력한 이름·주소·전화번호가 카카오맵·네이버·구글 지도에서 같은지 확인해요. 손님이 길을 찾거나 AI가 가게를 소개할 때 어긋난 정보가 쓰일 수 있어요.
      </p>

      {!info && !error && (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          연결 상태를 불러오는 중이에요
        </p>
      )}

      {/* 구글 지도 연결 */}
      {info && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 md:p-4">
          {info.google_linked ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-800">구글 지도에 연결되어 있어요.</p>
              <button
                type="button"
                onClick={() => onLink(null)}
                disabled={busy !== null}
                className="text-sm text-gray-600 underline disabled:opacity-50"
              >
                연결 해제
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-800">
                구글 지도는 내 가게를 직접 골라 연결해야 비교할 수 있어요. 구글 지도에 등록하지 않았다면 건너뛰어도 돼요.
              </p>
              {candidates === null ? (
                <button
                  type="button"
                  onClick={onSearch}
                  disabled={busy !== null}
                  className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800 disabled:opacity-50"
                >
                  {busy === 'search' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  구글 지도에서 내 가게 찾기
                </button>
              ) : candidates.length === 0 ? (
                <p className="mt-2 text-sm text-gray-700">찾지 못했어요. 구글 지도에 아직 등록되지 않았을 수 있어요.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {candidates.map((c) => (
                    <li key={c.place_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <p className="break-all text-sm text-gray-600">{c.address}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onLink(c.place_id)}
                        disabled={busy !== null}
                        className="min-h-[44px] rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        이 가게예요
                      </button>
                    </li>
                  ))}
                  <li className="text-sm text-gray-500">후보 정보 출처: Google Maps</li>
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* 점검 실행 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCheck}
          disabled={!info || busy !== null || noneLeft}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'check' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          지금 점검
        </button>
        {info && !unlimited && (
          <span className="text-sm text-gray-600">
            오늘 {info.remaining}회 남음 (하루 {info.limit}회)
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* 결과 */}
      {result && s && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-gray-800">
            <span>다름 {s.mismatch}</span>
            <span>일치 {s.match}</span>
            <span>확인 못함 {s.unknown}</span>
          </div>
          {s.mismatch > 0 && (
            <p className="mt-1 text-sm text-gray-700">
              다름으로 나온 항목은 해당 채널에서 직접 고쳐 주세요. 일부러 다르게 등록한 번호(예: 대표번호)라면 그대로 두셔도 돼요.
            </p>
          )}

          {/* PC: 표 */}
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-gray-700">
                  <th scope="col" className="w-28 py-2 pr-3 font-semibold">항목</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">내가 입력한 값</th>
                  {CHANNELS.map((c) => (
                    <th key={c.key} scope="col" className="py-2 pr-3 font-semibold">
                      {c.label}
                      {c.key === 'google' && <span className="block text-sm font-normal text-gray-500">Google Maps</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIELD_ROWS.map((row) => (
                  <tr key={row.key} className="border-b align-top">
                    <th scope="row" className="py-3 pr-3 font-medium text-gray-800">{row.label}</th>
                    <td className="break-all py-3 pr-3 text-gray-800">{result.expected[row.key] || <span className="text-gray-500">입력 없음</span>}</td>
                    {CHANNELS.map((c) => {
                      const ch = result.channels[c.key]
                      return (
                        <td key={c.key} className="py-3 pr-3">
                          {ch.state === 'found' ? <FieldCell field={ch.fields?.[row.key]} /> : <span className="text-gray-400">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {CHANNELS.map((c) => {
              const ch = result.channels[c.key]
              const notice = channelNotice(ch)
              return notice ? (
                <p key={c.key} className="mt-2 text-sm text-gray-700">
                  <span className="font-semibold">{c.label}</span>: {notice}
                  {ch.state === 'ambiguous' && ch.candidates && ch.candidates.length > 0 && (
                    <span className="block text-gray-600">
                      {ch.candidates.map((x) => `${x.name} (${x.address})`).join(' · ')}
                    </span>
                  )}
                </p>
              ) : null
            })}
          </div>

          {/* 모바일: 채널별 카드 */}
          <div className="mt-3 space-y-3 md:hidden">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-bold text-gray-800">내가 입력한 값</p>
              <dl className="mt-2 space-y-1 text-sm">
                {FIELD_ROWS.map((row) => (
                  <div key={row.key} className="flex gap-2">
                    <dt className="w-20 shrink-0 text-gray-600">{row.label}</dt>
                    <dd className="break-all text-gray-900">{result.expected[row.key] || <span className="text-gray-500">입력 없음</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {CHANNELS.map((c) => {
              const ch = result.channels[c.key]
              const notice = channelNotice(ch)
              return (
                <div key={c.key} className="rounded-lg border p-3">
                  <p className="text-sm font-bold text-gray-800">
                    {c.label}
                    {c.key === 'google' && <span className="ml-2 text-sm font-normal text-gray-500">Google Maps</span>}
                  </p>
                  {ch.state === 'found' ? (
                    <ul className="mt-2 space-y-3">
                      {FIELD_ROWS.filter((row) => ch.fields?.[row.key]).map((row) => (
                        <li key={row.key}>
                          <p className="mb-1 text-sm text-gray-600">{row.label}</p>
                          <FieldCell field={ch.fields?.[row.key]} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-gray-700">
                      {notice}
                      {ch.state === 'ambiguous' && ch.candidates && ch.candidates.length > 0 && (
                        <span className="mt-1 block text-gray-600">
                          {ch.candidates.map((x) => `${x.name} (${x.address})`).join(' · ')}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {result.channels.google.state === 'found' && result.channels.google.rating != null && (
            <p className="mt-3 text-sm text-gray-700">
              구글 지도 평점 {result.channels.google.rating}
              {result.channels.google.rating_count != null && ` · 리뷰 ${result.channels.google.rating_count.toLocaleString('ko-KR')}건`}
              <span className="text-gray-500"> (Google Maps, 점검 시점 기준)</span>
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-sm text-gray-500">
        점검하는 순간의 정보를 불러와 비교해요. 구글 지도 정보는 저장하지 않고 점검할 때마다 새로 불러와요. 채널에서 정보를 고쳐도 반영까지 시간이 걸릴 수 있어요.
      </p>
    </div>
  )
}
