'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, ChevronRight, CheckCircle2, Bell } from 'lucide-react'
import ActionResultCard, { type ActionCompletion } from '@/components/dashboard/ActionResultCard'
import type { CompetitorChange } from '@/lib/api'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// gap_analyzer.py _DIMENSION_LABELS 키와 일치
const DIMENSION_MESSAGES: Record<string, {
  reason: string
  action: string
  link: string
  linkLabel: string
}> = {
  keyword_gap_score: {
    reason: '업종 핵심 키워드가 부족해 AI 검색 노출이 낮습니다',
    action: '소개글 Q&A에 빠진 키워드를 추가하면 AI 검색 노출 가능성이 높아집니다',
    link: '/guide',
    linkLabel: '없는 키워드 확인하기',
  },
  review_quality: {
    reason: '리뷰 수나 키워드 다양성이 경쟁 가게보다 부족합니다',
    action: '리뷰 답변에 가게 특징 키워드를 한 줄 추가하면 됩니다',
    link: '/guide',
    linkLabel: '리뷰 답변 초안 보기',
  },
  smart_place_completeness: {
    reason: '스마트플레이스 정보가 부족해서 AI가 내 가게를 잘 모릅니다',
    action: '소개글 Q&A·소식을 채우면 AI가 가게를 더 잘 추천합니다',
    link: '/guide',
    linkLabel: '소개글 편집하러 가기',
  },
  naver_exposure_confirmed: {
    reason: '네이버 AI 검색에 아직 내 가게가 확인되지 않았습니다',
    action: '소개글에 Q&A 형식으로 가게 특징 3가지를 추가하면 AI가 가게를 더 잘 인식합니다',
    link: '/guide',
    linkLabel: '소개글 Q&A 복사하러 가기',
  },
  multi_ai_exposure: {
    reason: 'ChatGPT·Gemini에서 이 사업장 인식도를 높일 수 있습니다',
    action: 'Google 비즈니스 프로필 등록이 Gemini 노출의 첫 단계입니다. Gemini는 Google 검색 실시간 연동으로 수 주~수개월, ChatGPT는 AI 학습 데이터 기반으로 수개월~1년이 소요됩니다.',
    link: '/guide',
    linkLabel: '개선 가이드 보기',
  },
  schema_seo: {
    reason: '소개글 키워드 추가 최적화 또는 홈페이지 AI 정보 코드 등록으로 노출을 더 높일 수 있습니다',
    action: '소개글에 업종 핵심 키워드를 추가 점검하거나, 홈페이지가 있다면 AI 가게 정보 코드를 등록하세요.',
    link: '/schema',
    linkLabel: 'AI 최적화 도구 열기',
  },
}

interface Dimension {
  dimension_key: string
  dimension_label: string
  current_score: number
  max_score: number
  gap_to_top: number
  gap_reason: string
  priority: number
}

// INACTIVE 업종에서 "오늘 할 일"로 후순위 처리할 글로벌 채널 차원.
// (글로벌 노출은 수개월~1년 소요 — 사장님의 즉시 실행 미션으로는 네이버 quick-win 우선)
const GLOBAL_DIMS = new Set(["multi_ai_exposure", "schema_seo"])

/**
 * 최상위 미션 차원 선택.
 * deprioritizeGlobal=true(INACTIVE)면, 실제 개선 여지(gap_to_top>0)가 있는 차원 중
 * 네이버 차원을 글로벌 차원보다 우선. 네이버 갭이 없으면 글로벌을 그대로 노출(정직성 유지).
 */
function pickTopDimension(dims: Dimension[], deprioritizeGlobal: boolean): Dimension | null {
  const withGap = dims.filter((d) => d.gap_to_top > 0)
  const pool = withGap.length > 0 ? withGap : dims
  const sorted = [...pool].sort((a, b) => {
    if (deprioritizeGlobal) {
      const ag = GLOBAL_DIMS.has(a.dimension_key) ? 1 : 0
      const bg = GLOBAL_DIMS.has(b.dimension_key) ? 1 : 0
      if (ag !== bg) return ag - bg
    }
    return b.gap_to_top - a.gap_to_top
  })
  return sorted[0] ?? null
}

interface TodayTask {
  no: number
  title: string
  desc: string
  time: string
  link: string
}

interface Props {
  bizId: string
  token: string
  initialDimensions?: Dimension[]
  todayTasks: TodayTask[]
  actionCopyText: string | null
  topMissingKeyword: string | null
  /** INACTIVE 업종 — 글로벌 채널 차원을 오늘 미션에서 후순위로 */
  deprioritizeGlobal?: boolean
}

export default function DailyMissionCard({
  bizId,
  token,
  initialDimensions,
  todayTasks,
  actionCopyText,
  topMissingKeyword,
  deprioritizeGlobal = false,
}: Props) {
  // ── TopPriority 상태 ──
  const [topDimension, setTopDimension] = useState<Dimension | null>(null)
  const [topLoading, setTopLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  // ── ActionComplete 상태 ──
  const [actionCompleted, setActionCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [actions, setActions] = useState<ActionCompletion[]>([])
  const [changes, setChanges] = useState<CompetitorChange[]>([])
  const [actionsLoaded, setActionsLoaded] = useState(false)

  // TopPriority 로직
  useEffect(() => {
    const key = `top_action_dismissed_${bizId}`
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(key) === today) {
      setDismissed(true)
      setTopLoading(false)
      return
    }
    if (initialDimensions !== undefined) {
      setTopDimension(pickTopDimension(initialDimensions, deprioritizeGlobal))
      setTopLoading(false)
      return
    }
    fetch(`${BACKEND}/api/report/gap/${bizId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.dimensions?.length > 0) {
          setTopDimension(pickTopDimension(data.dimensions as Dimension[], deprioritizeGlobal))
        }
      })
      .catch((e) => console.warn('[DailyMission/gap]', e))
      .finally(() => setTopLoading(false))
  }, [bizId, token, initialDimensions, deprioritizeGlobal])

  // ActionComplete 데이터 로드
  useEffect(() => {
    if (!bizId || !token) return
    Promise.all([
      fetch(`${BACKEND}/api/actions/biz/${bizId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (!r.ok) {
            if (r.status !== 404) console.warn('[DailyMission/actions] HTTP', r.status)
            return []
          }
          return r.json()
        })
        .catch((e) => { console.warn('[DailyMission/actions]', e); return [] }),
      fetch(`${BACKEND}/api/competitors/${bizId}/changes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([actionData, changeData]) => {
      setActions(Array.isArray(actionData) ? actionData : [])
      setChanges(Array.isArray(changeData) ? changeData : [])
      setActionsLoaded(true)
    })
  }, [bizId, token])

  const handleDismiss = () => {
    const key = `top_action_dismissed_${bizId}`
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(key, today)
    setDismissed(true)
  }

  const handleActionComplete = async () => {
    if (!actionCopyText || submitting) return
    setSubmitting(true)
    setSubmitError(false)
    try {
      const res = await fetch(`${BACKEND}/api/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: bizId,
          action_type: 'faq_keyword',
          keyword: topMissingKeyword || '',
          action_text: actionCopyText,
        }),
      })
      if (res.ok) {
        setActionCompleted(true)
        const updated = await fetch(`${BACKEND}/api/actions/biz/${bizId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])
        setActions(Array.isArray(updated) ? updated : [])
      }
    } catch (e) {
      console.error('action complete error', e)
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const msg =
    !dismissed && topDimension
      ? (DIMENSION_MESSAGES[topDimension.dimension_key] ?? {
          reason: topDimension.gap_reason || 'AI 노출 점수를 높일 수 있습니다',
          action: '개선 가이드에서 방법을 확인하세요',
          link: '/guide',
          linkLabel: '가이드 보기',
        })
      : null

  const improvablePoints =
    topDimension && topDimension.gap_to_top > 0 ? Math.round(topDimension.gap_to_top) : null

  const hasReasonSection = !dismissed && (topLoading || msg)
  const hasTasks = todayTasks.length > 0
  const hasBottomSection = hasTasks || actionCopyText != null

  if (!hasReasonSection && !hasBottomSection) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

      {/* ── 상단: 이유 영역 (amber 배경) ── */}
      {!dismissed && (
        topLoading ? (
          <div className="bg-amber-50 p-4 animate-pulse">
            <div className="h-4 bg-amber-200 rounded w-1/3 mb-2" />
            <div className="h-5 bg-amber-200 rounded w-2/3" />
          </div>
        ) : msg ? (
          <div className="bg-amber-50 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900 mb-0.5">
                  지금 개선하면 AI 검색 노출이 올라갑니다
                </p>
                <p className="text-base font-semibold text-amber-800 mb-1">{msg.reason}</p>
                <p className="text-sm text-amber-700 mb-3">{msg.action}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={msg.link}
                    className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    {msg.linkLabel}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={handleDismiss}
                    className="text-sm text-amber-600 underline hover:text-amber-800"
                  >
                    오늘 하루 숨기기
                  </button>
                </div>
              </div>
              {improvablePoints != null && (
                <div className="shrink-0 text-right">
                  <p className="text-sm text-amber-600">개선 여지</p>
                  <p className={`text-base font-bold leading-tight mt-0.5 px-2 py-1 rounded-full ${
                    improvablePoints >= 10
                      ? "bg-red-100 text-red-700"
                      : improvablePoints >= 5
                      ? "bg-amber-100 text-amber-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {improvablePoints >= 10 ? "높음" : improvablePoints >= 5 ? "중간" : "있음"}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null
      )}

      {/* 구분선 (이유+할일 둘 다 있을 때) */}
      {!dismissed && msg && hasBottomSection && (
        <div className="border-t border-gray-100" />
      )}

      {/* ── 중하단: 할 일 + ActionComplete ── */}
      {hasBottomSection && (
        <div className="p-4 md:p-5">

          {/* 오늘 할 일 목록 */}
          {hasTasks && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-3">오늘 할 일</h2>
              <div className="space-y-2 mb-4">
                {todayTasks.map((task, idx) => (
                  <Link
                    key={task.no}
                    href={task.link}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors"
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-gray-700">{task.title}</span>
                        <span className="text-sm text-gray-500">({task.time})</span>
                      </div>
                      <p className="text-sm text-gray-600">{task.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1.5" />
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* 경쟁사 변화 알림 */}
          {actionsLoaded && changes.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 mb-3">
              <Bell className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-orange-900 text-sm">경쟁사 변화 감지</p>
                {changes.map((c) => (
                  <p key={c.id} className="text-sm text-orange-700 mt-1 leading-relaxed">
                    <span className="font-medium">{c.name}</span>이(가) {c.change_summary}
                  </p>
                ))}
                <a
                  href="/competitors"
                  className="text-sm text-orange-600 underline mt-2 inline-block"
                >
                  경쟁사 현황 보기 &rarr;
                </a>
              </div>
            </div>
          )}

          {/* 완료 버튼 */}
          {actionCopyText && (
            actionCompleted ? (
              <div className="flex items-center gap-2 text-green-700 text-sm font-semibold bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                완료! 다음 스캔에서 개선 효과를 확인해보세요 (반영까지 2~4주 소요)
              </div>
            ) : (
              <div>
                <button
                  onClick={handleActionComplete}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors mb-3"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {submitting ? '저장 중...' : '완료했어요 ✓'}
                </button>
                {submitError && (
                  <p className="text-sm text-red-600 mb-3">저장하지 못했습니다. 다시 시도해주세요.</p>
                )}
              </div>
            )
          )}

          {/* 행동 결과 카드 */}
          {actionsLoaded && actions.length > 0 && (
            <ActionResultCard actions={actions} />
          )}
        </div>
      )}
    </div>
  )
}
