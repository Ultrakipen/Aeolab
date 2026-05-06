'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Bell } from 'lucide-react'
import ActionResultCard, { type ActionCompletion } from '@/components/dashboard/ActionResultCard'
import type { CompetitorChange } from '@/lib/api'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Props {
  bizId: string
  token: string
  actionCopyText: string | null
  topMissingKeyword: string | null
}

export default function ActionCompleteSection({ bizId, token, actionCopyText, topMissingKeyword }: Props) {
  const [actionCompleted, setActionCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actions, setActions] = useState<ActionCompletion[]>([])
  const [changes, setChanges] = useState<CompetitorChange[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!bizId || !token) return

    Promise.all([
      fetch(`${BACKEND}/api/actions/biz/${bizId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
      fetch(`${BACKEND}/api/competitors/${bizId}/changes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    ]).then(([actionData, changeData]) => {
      setActions(Array.isArray(actionData) ? actionData : [])
      setChanges(Array.isArray(changeData) ? changeData : [])
      setLoaded(true)
    })
  }, [bizId, token])

  const handleActionComplete = async () => {
    if (!actionCopyText || submitting) return
    setSubmitting(true)
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
        // 완료 후 목록 재조회
        const updated = await fetch(`${BACKEND}/api/actions/biz/${bizId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : []).catch(() => [])
        setActions(Array.isArray(updated) ? updated : [])
      }
    } catch (e) {
      console.error('action complete error', e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* 경쟁사 변화 알림 배너 */}
      {loaded && changes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <Bell className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-orange-900 text-sm">경쟁사 변화 감지</p>
            {changes.map(c => (
              <p key={c.id} className="text-sm text-orange-700 mt-1 leading-relaxed">
                <span className="font-medium">{c.name}</span>이(가) {c.change_summary}
              </p>
            ))}
            <a href="/competitors" className="text-sm text-orange-600 underline mt-2 inline-block">
              경쟁사 현황 보기 &rarr;
            </a>
          </div>
        </div>
      )}

      {/* 완료 버튼 / 완료 상태 */}
      {actionCopyText && (
        actionCompleted ? (
          <div className="flex items-center gap-2 text-green-700 text-sm font-semibold bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            완료! 7일 후 AI 브리핑 변화를 자동으로 확인해드립니다
          </div>
        ) : (
          <button
            onClick={handleActionComplete}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? '저장 중...' : '완료했어요 ✓'}
          </button>
        )
      )}

      {/* 행동 결과 카드 */}
      {loaded && actions.length > 0 && (
        <ActionResultCard actions={actions} />
      )}
    </>
  )
}
