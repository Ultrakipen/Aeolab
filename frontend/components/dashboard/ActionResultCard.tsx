'use client'

import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export interface ActionCompletion {
  id: string
  action_type: string
  keyword: string
  completed_at: string
  rescan_done: boolean
  before_mentioned: boolean | null
  after_mentioned: boolean | null
  before_score: number | null
  after_score: number | null
  result_summary: string | null
}

interface Props {
  actions: ActionCompletion[]
}

function daysUntilRescan(completedAt: string): number {
  const completed = new Date(completedAt)
  const rescanAt = new Date(completed.getTime() + 7 * 24 * 60 * 60 * 1000)
  const now = new Date()
  const diff = Math.ceil((rescanAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function ActionTypeLabel({ type }: { type: string }): React.ReactElement {
  const map: Record<string, string> = {
    faq_keyword: 'FAQ 키워드 등록',
    review_reply: '리뷰 답변',
    naver_post: '소식 등록',
    intro_update: '소개글 수정',
    keyword_add: '키워드 추가',
  }
  return <span className="text-sm text-gray-500">{map[type] ?? type}</span>
}

export default function ActionResultCard({ actions }: Props) {
  const done = actions.filter(a => a.rescan_done)
  const pending = actions.filter(a => !a.rescan_done)

  if (actions.length === 0) return null

  return (
    <div className="space-y-4">
      {/* 완료된 결과 */}
      {done.length > 0 && (
        <div className="bg-white rounded-xl border p-4 md:p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            행동 결과 확인
          </h3>
          <div className="space-y-3">
            {done.map(a => (
              <div
                key={a.id}
                className={`rounded-lg p-3 md:p-4 border ${
                  a.after_mentioned
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <ActionTypeLabel type={a.action_type} />
                      {a.keyword && (
                        <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {a.keyword}
                        </span>
                      )}
                    </div>
                    {a.after_mentioned ? (
                      <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        AI 브리핑에 노출됐습니다
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        아직 반영 중입니다. 조금 더 기다려주세요
                      </p>
                    )}
                    {a.result_summary && (
                      <p className="text-sm text-gray-600 mt-1">{a.result_summary}</p>
                    )}
                    {(a.before_score !== null && a.after_score !== null) && (
                      <p className="text-sm text-gray-500 mt-1">
                        점수 변화: {a.before_score}점 &rarr; <strong className="text-gray-700">{a.after_score}점</strong>
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 shrink-0">{formatDate(a.completed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 대기 중 항목 */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border p-4 md:p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            분석 대기 중
          </h3>
          <div className="space-y-3">
            {pending.map(a => {
              const daysLeft = daysUntilRescan(a.completed_at)
              return (
                <div key={a.id} className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ActionTypeLabel type={a.action_type} />
                      {a.keyword && (
                        <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {a.keyword}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {daysLeft > 0
                          ? `${daysLeft}일 후 자동 확인 예정`
                          : '곧 자동 확인됩니다'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{formatDate(a.completed_at)} 완료 등록</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
