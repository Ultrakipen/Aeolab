'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings, X, Plus, Loader2, CheckCircle2, AlertTriangle, Tag, EyeOff } from 'lucide-react'
import {
  getUserKeywords,
  addCustomKeyword,
  removeCustomKeyword,
  addExcludedKeyword,
  removeExcludedKeyword,
} from '@/lib/api'

const MAX_CUSTOM = 10
const MIN_LEN = 2
const MAX_LEN = 20

interface Props {
  bizId: string
  accessToken: string
  isOpen: boolean
  onClose: () => void
  onChange?: () => void
}

type TabKey = 'custom' | 'excluded'
type ToastKind = 'success' | 'error' | 'info'

interface ToastState {
  kind: ToastKind
  message: string
}

function isMigrationError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const anyErr = err as { status?: number; detail?: unknown }
  if (anyErr.status === 503) return true
  const detail = anyErr.detail
  if (typeof detail === 'object' && detail) {
    const msg = (detail as { message?: string; code?: string }).message ?? ''
    const code = (detail as { message?: string; code?: string }).code ?? ''
    if (code === 'DB_MIGRATION_NEEDED' || code === 'DB_MIGRATION_REQUIRED') return true
    if (msg.includes('마이그레이션')) return true
  }
  if (err instanceof Error && err.message.includes('마이그레이션')) return true
  return false
}

function extractDetailMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const detail = (err as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const msg = (detail as { message?: string }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  if (err instanceof Error && err.message) return err.message
  return null
}

export function KeywordManagerModal({
  bizId,
  accessToken,
  isOpen,
  onClose,
  onChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('custom')
  const [custom, setCustom] = useState<string[]>([])
  const [excluded, setExcluded] = useState<string[]>([])
  const [taxonomyCount, setTaxonomyCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToast({ kind, message })
    window.setTimeout(() => {
      setToast((prev) => (prev && prev.message === message ? null : prev))
    }, 2500)
  }, [])

  const loadKeywords = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setFatalError(null)
    try {
      const data = await getUserKeywords(bizId, accessToken) as {
        custom?: string[]
        excluded?: string[]
        taxonomy_count?: number
      }
      setCustom(Array.isArray(data?.custom) ? data.custom : [])
      setExcluded(Array.isArray(data?.excluded) ? data.excluded : [])
      setTaxonomyCount(typeof data?.taxonomy_count === 'number' ? data.taxonomy_count : 0)
    } catch (err) {
      if (isMigrationError(err)) {
        setFatalError('서버 준비 중입니다. 잠시 후 다시 시도해주세요.')
      } else {
        setFatalError(extractDetailMessage(err) ?? '키워드 정보를 불러오지 못했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }, [bizId, accessToken])

  // ESC to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [isOpen])

  // Load on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('custom')
      setInput('')
      loadKeywords()
      // focus input after paint
      window.setTimeout(() => { inputRef.current?.focus() }, 50)
    }
  }, [isOpen, loadKeywords])

  const notifyChange = useCallback(() => {
    onChange?.()
  }, [onChange])

  const validateKeyword = (raw: string): string | null => {
    const kw = raw.trim()
    if (!kw) return '키워드를 입력해 주세요.'
    if (kw.length < MIN_LEN) return `최소 ${MIN_LEN}자 이상 입력해 주세요.`
    if (kw.length > MAX_LEN) return `최대 ${MAX_LEN}자까지 입력 가능합니다.`
    return null
  }

  const handleAddCustom = async () => {
    const err = validateKeyword(input)
    if (err) {
      showToast('error', err)
      return
    }
    if (custom.length >= MAX_CUSTOM) {
      showToast('error', `최대 ${MAX_CUSTOM}개까지 추가할 수 있습니다.`)
      return
    }
    const kw = input.trim()
    if (custom.includes(kw)) {
      showToast('info', '이미 추가된 키워드입니다.')
      return
    }
    setSubmitting(true)
    try {
      await addCustomKeyword(bizId, kw, accessToken)
      setCustom((prev) => [...prev, kw])
      setInput('')
      showToast('success', `"${kw}" 추가됨`)
      notifyChange()
    } catch (e) {
      if (isMigrationError(e)) {
        showToast('error', '서버 준비 중입니다. 잠시 후 다시 시도해주세요.')
      } else {
        showToast('error', extractDetailMessage(e) ?? '추가하지 못했습니다. 연결 오류가 발생했습니다.')
      }
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }

  const handleRemoveCustom = async (kw: string) => {
    setSubmitting(true)
    try {
      await removeCustomKeyword(bizId, kw, accessToken)
      setCustom((prev) => prev.filter((x) => x !== kw))
      showToast('success', `"${kw}" 삭제됨`)
      notifyChange()
    } catch (e) {
      if (isMigrationError(e)) {
        showToast('error', '서버 준비 중입니다. 잠시 후 다시 시도해주세요.')
      } else {
        showToast('error', extractDetailMessage(e) ?? '삭제하지 못했습니다.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveExcluded = async (kw: string) => {
    setSubmitting(true)
    try {
      await removeExcludedKeyword(bizId, kw, accessToken)
      setExcluded((prev) => prev.filter((x) => x !== kw))
      showToast('success', `"${kw}" 제외 해제됨`)
      notifyChange()
    } catch (e) {
      if (isMigrationError(e)) {
        showToast('error', '서버 준비 중입니다. 잠시 후 다시 시도해주세요.')
      } else {
        showToast('error', extractDetailMessage(e) ?? '제외 해제에 실패했습니다.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddExcluded = async () => {
    const err = validateKeyword(input)
    if (err) {
      showToast('error', err)
      return
    }
    const kw = input.trim()
    if (excluded.includes(kw)) {
      showToast('info', '이미 제외된 키워드입니다.')
      return
    }
    setSubmitting(true)
    try {
      await addExcludedKeyword(bizId, kw, accessToken)
      setExcluded((prev) => [...prev, kw])
      setInput('')
      showToast('success', `"${kw}" 제외됨`)
      notifyChange()
    } catch (e) {
      if (isMigrationError(e)) {
        showToast('error', '서버 준비 중입니다. 잠시 후 다시 시도해주세요.')
      } else {
        showToast('error', extractDetailMessage(e) ?? '제외 처리에 실패했습니다.')
      }
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }

  if (!isOpen) return null

  const customAtLimit = custom.length >= MAX_CUSTOM
  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeTab === 'custom') handleAddCustom()
      else handleAddExcluded()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 p-3 md:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyword-manager-title"
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 md:px-6 pt-5 md:pt-6 pb-3 md:pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h2 id="keyword-manager-title" className="text-lg md:text-xl font-bold text-gray-900">
                내 키워드 설정
              </h2>
              <p className="text-sm md:text-base text-gray-500 mt-0.5 leading-relaxed">
                추가한 키워드는 내 강점으로 반영되고, 제외한 키워드는 분석에서 빠집니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 md:px-6 pt-4">
          <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => { setActiveTab('custom'); setInput('') }}
              className={`px-3 md:px-4 py-2.5 text-base md:text-lg font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'custom'
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Tag className="w-4 h-4" />
                내가 추가한 키워드
                <span className="text-sm font-bold">{custom.length}/{MAX_CUSTOM}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('excluded'); setInput('') }}
              className={`px-3 md:px-4 py-2.5 text-base md:text-lg font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === 'excluded'
                  ? 'border-gray-700 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <EyeOff className="w-4 h-4" />
                내가 제외한 키워드
                <span className="text-sm font-bold">{excluded.length}</span>
              </span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 md:px-6 py-4 md:py-5">
          {fatalError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm md:text-base text-red-700 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{fatalError}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-base">불러오는 중...</span>
            </div>
          ) : (
            <>
              {activeTab === 'custom' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 md:p-4 text-sm md:text-base text-emerald-800 leading-relaxed">
                    업종 기본 키워드 <span className="font-semibold">{taxonomyCount}개</span> 외에 내 가게만의 강점 키워드를 최대 <span className="font-semibold">{MAX_CUSTOM}개</span>까지 추가할 수 있습니다.
                  </div>

                  {/* Input row */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={submitOnEnter}
                      placeholder={customAtLimit ? '최대 개수에 도달했습니다' : '예: 무알콜 칵테일, 반려견 동반'}
                      maxLength={MAX_LEN}
                      disabled={submitting || customAtLimit || !!fatalError}
                      className="flex-1 text-base md:text-lg px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustom}
                      disabled={submitting || customAtLimit || !!fatalError || !input.trim()}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-semibold text-base md:text-lg px-4 py-3 rounded-xl transition-colors"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      추가
                    </button>
                  </div>

                  {/* Badges */}
                  {custom.length === 0 ? (
                    <div className="text-center py-8 text-sm md:text-base text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      아직 추가한 키워드가 없습니다. 위 입력창에 내 가게 강점을 적어 보세요.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {custom.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-base md:text-lg font-semibold px-4 py-2 rounded-full border border-emerald-200"
                        >
                          {kw}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustom(kw)}
                            disabled={submitting}
                            aria-label={`${kw} 삭제`}
                            title={`${kw} 삭제`}
                            className="ml-1 w-6 h-6 rounded-full hover:bg-emerald-200 text-emerald-600 hover:text-red-600 flex items-center justify-center disabled:opacity-40"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'excluded' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 md:p-4 text-sm md:text-base text-gray-700 leading-relaxed">
                    제외한 키워드는 스캔·블로그 진단·가이드·경쟁사 갭·QR 등 모든 분석에서 빠집니다. 내가 제공하지 않는 서비스나 관련 없는 키워드를 제외하세요.
                  </div>

                  {/* Input row (excluded 추가) */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={submitOnEnter}
                      placeholder="제외할 키워드 입력"
                      maxLength={MAX_LEN}
                      disabled={submitting || !!fatalError}
                      className="flex-1 text-base md:text-lg px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddExcluded}
                      disabled={submitting || !!fatalError || !input.trim()}
                      className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-base md:text-lg px-4 py-3 rounded-xl transition-colors"
                    >
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <EyeOff className="w-5 h-5" />}
                      제외
                    </button>
                  </div>

                  {/* Badges */}
                  {excluded.length === 0 ? (
                    <div className="text-center py-8 text-sm md:text-base text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      제외된 키워드가 없습니다.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {excluded.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-base md:text-lg font-semibold px-4 py-2 rounded-full border border-gray-200"
                        >
                          {kw}
                          <button
                            type="button"
                            onClick={() => handleRemoveExcluded(kw)}
                            disabled={submitting}
                            aria-label={`${kw} 제외 해제`}
                            title={`${kw} 제외 해제`}
                            className="ml-1 w-6 h-6 rounded-full hover:bg-gray-200 text-gray-500 hover:text-emerald-600 flex items-center justify-center disabled:opacity-40"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 md:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-gray-500 leading-relaxed">
            변경 사항은 즉시 반영되며, 다음 스캔·분석부터 적용됩니다.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center justify-center bg-gray-900 hover:bg-black text-white font-semibold text-base px-5 py-3 rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-[60] max-w-sm shadow-lg rounded-xl px-4 py-3 border-2 flex items-start gap-2 ${
            toast.kind === 'success'
              ? 'bg-green-50 border-green-300 text-green-800'
              : toast.kind === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : toast.kind === 'error' ? (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <Loader2 className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <p className="text-sm md:text-base font-semibold leading-relaxed">{toast.message}</p>
        </div>
      )}
    </div>
  )
}

export default KeywordManagerModal
