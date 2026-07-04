"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Download, ExternalLink, Maximize2, RefreshCw, Search, X } from "lucide-react"

interface BlogPost {
  rank: number
  title: string
  url: string
  blog_name: string
  blog_id: string
  date: string
  is_mine: boolean
  is_competitor: boolean
  competitor_name: string | null
}

interface BlogAnalysis {
  keyword: string
  my_rank: number | null
  posts: BlogPost[]
  analyzed_at: string
  blog_id_registered?: boolean
}

// BlogShot 타입 유지 (page.tsx 호환)
interface ShotItem {
  url: string
  captured_at: string
}

interface BlogShot {
  keyword: string
  baseline: ShotItem | null
  latest: ShotItem | null
}

interface Props {
  bizId: string
  accessToken: string
  plan: string
  initialShots: BlogShot[]
  naverBlogId?: string
}

const ALLOWED_PLANS = ["basic", "startup", "pro", "biz", "enterprise"]

function formatAnalyzedAt(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

// ── 이미지 모달 타입 ──────────────────────────────────────────────────────────
type ModalImage = {
  url: string
  keyword: string
  type: "before" | "after"
  date: string
  bizName?: string
} | null

// ── 이미지 다운로드 헬퍼 ─────────────────────────────────────────────────────
async function handleDownload(imageUrl: string, suggestedName: string) {
  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const ext = blob.type.includes("png") ? "png" : "jpg"
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${suggestedName}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    window.open(imageUrl, "_blank")
  }
}

// ── 이미지 전체화면 모달 ──────────────────────────────────────────────────────
interface ImageModalProps {
  image: ModalImage
  onClose: () => void
}

function ImageModal({ image, onClose }: ImageModalProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const prevOverflow = useRef<string>("")

  // body 스크롤 잠금
  useEffect(() => {
    prevOverflow.current = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow.current
    }
  }, [])

  // ESC 키 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  if (!image) return null

  const typeLabel = image.type === "before" ? "Before (가입 시점)" : "After (현재)"
  const fileName = [
    image.bizName ?? "사업장",
    image.keyword,
    image.type === "before" ? "Before" : "After",
    image.date.replace(/\./g, "-"),
  ]
    .filter(Boolean)
    .join("_")

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="이미지 전체화면"
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="닫기"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 이미지 */}
      <div
        className="relative flex items-center justify-center w-full h-full px-4 pb-20"
        onClick={(e) => e.stopPropagation()}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin h-10 w-10 text-white/60"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}
        <img
          src={image.url}
          alt={`${image.keyword} ${typeLabel}`}
          className="max-h-[80vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
          style={{ display: imgLoaded ? "block" : "none" }}
          onLoad={() => setImgLoaded(true)}
        />
      </div>

      {/* 하단 툴바 */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-black/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            <span className="bg-blue-500 text-white text-sm px-2 py-0.5 rounded-full mr-2">
              {image.keyword}
            </span>
            {typeLabel}
          </p>
          {image.date && (
            <p className="text-white/60 text-sm mt-0.5">{image.date}</p>
          )}
        </div>
        <button
          onClick={() => handleDownload(image.url, fileName)}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Download className="w-4 h-4" />
          다른 이름으로 저장하기
        </button>
      </div>
    </div>
  )
}

// ── 블로그 포스팅 아이템 ───────────────────────────────────────────────────────
interface PostItemProps {
  post: BlogPost
}

function PostItem({ post }: PostItemProps) {
  let containerCls = "flex items-start gap-3 px-4 py-3.5 rounded-xl border "
  let badge: React.ReactNode = null

  if (post.is_mine) {
    containerCls += "bg-green-50 border-green-200"
    badge = (
      <span className="shrink-0 text-sm font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        내 사업장
      </span>
    )
  } else if (post.is_competitor) {
    containerCls += "bg-orange-50 border-orange-100"
    badge = (
      <span className="shrink-0 text-sm font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
        경쟁사{post.competitor_name ? `: ${post.competitor_name}` : ""}
      </span>
    )
  } else {
    containerCls += "bg-white border-gray-100"
  }

  return (
    <div className={containerCls}>
      {/* 순위 번호 */}
      <span
        className={[
          "shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-base font-bold",
          post.is_mine
            ? "bg-green-600 text-white"
            : post.is_competitor
            ? "bg-orange-500 text-white"
            : "bg-gray-100 text-gray-600",
        ].join(" ")}
      >
        {post.rank}
      </span>

      {/* 제목 + 메타 */}
      <div className="flex-1 min-w-0">
        {badge && <div className="mb-1">{badge}</div>}
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-medium text-gray-800 hover:text-blue-600 hover:underline break-all leading-snug"
        >
          {post.title}
        </a>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
          <span className="truncate max-w-[160px]">{post.blog_name}</span>
          {post.date && (
            <>
              <span className="text-gray-300">·</span>
              <span className="shrink-0">{post.date}</span>
            </>
          )}
        </div>
      </div>

      {/* 외부 링크 아이콘 */}
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 p-1 text-gray-400 hover:text-blue-500 transition-colors mt-0.5"
        aria-label="새 탭에서 열기"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function BlogScreenshotSection({
  bizId,
  accessToken,
  plan,
  initialShots,
  naverBlogId: initialBlogId = "",
}: Props) {
  const [analyses, setAnalyses] = useState<BlogAnalysis[]>([])
  const [captchaKeywords, setCaptchaKeywords] = useState<string[]>([])
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blogIdInput, setBlogIdInput] = useState(initialBlogId)
  const [savedBlogId, setSavedBlogId] = useState(initialBlogId)
  const [blogIdSaving, setBlogIdSaving] = useState(false)
  const [blogIdSaved, setBlogIdSaved] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captureTriggered, setCaptureTriggered] = useState(false)
  const [captureReadyIn, setCaptureReadyIn] = useState(0) // 남은 대기 초
  const [modalImage, setModalImage] = useState<ModalImage>(null)

  // 페이지 이동 후 복귀 시에도 "스크린샷 확인" 버튼 유지 (localStorage v2)
  // v2 키: 이전 8분 공식으로 생성된 구버전 키(v1) 자동 무효화
  useEffect(() => {
    const key = `blog_capture_ready_v2_${bizId}`
    const stored = localStorage.getItem(key)
    if (!stored) return
    try {
      const { readyAt } = JSON.parse(stored)
      // 최대 70초 이상은 무시 — 구버전 잔재 방어
      let remaining = Math.min(70, Math.max(0, Math.ceil((readyAt - Date.now()) / 1000)))
      setCaptureTriggered(true)
      setCaptureReadyIn(remaining)
      if (remaining > 0) {
        const timer = setInterval(() => {
          remaining -= 1
          setCaptureReadyIn(remaining)
          if (remaining <= 0) clearInterval(timer)
        }, 1000)
        return () => clearInterval(timer)
      }
    } catch { /* ignore */ }
  }, [bizId])

  const openModal = useCallback((img: ModalImage) => setModalImage(img), [])
  const closeModal = useCallback(() => setModalImage(null), [])

  const isPlanOk = ALLOWED_PLANS.includes(plan)
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

  // 클라이언트 사이드 is_mine 보정: savedBlogId 기준으로 즉시 재판별
  const applyBlogIdCorrection = (data: BlogAnalysis[], blogId: string): BlogAnalysis[] => {
    if (!blogId) return data
    const bid = blogId.trim().toLowerCase()
    return data.map((analysis) => {
      let myRank: number | null = null
      const posts = analysis.posts.map((post) => {
        const postUrl = (post.url || "").toLowerCase()
        const extractedId = (post.blog_id || "").toLowerCase()
        const isMatch = extractedId === bid || postUrl.includes(`/blog.naver.com/${bid}/`) || postUrl.includes(`blog.naver.com/${bid}/`)
        if (isMatch && myRank === null) myRank = post.rank
        return { ...post, is_mine: isMatch }
      })
      return { ...analysis, posts, my_rank: myRank, blog_id_registered: true }
    })
  }

  // 키워드 목록: 분석 결과 우선, 없으면 initialShots에서 추출
  const allKeywords: string[] = analyses.length > 0
    ? analyses.map((a) => a.keyword)
    : (initialShots ?? []).map((s) => s.keyword)

  const displayAnalyses = savedBlogId ? applyBlogIdCorrection(analyses, savedBlogId) : analyses

  // 마운트 시 자동 로드
  useEffect(() => {
    loadAnalyses()
    loadCaptchaStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId])

  const loadAnalyses = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${backendUrl}/api/report/blog-analysis/${bizId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data: BlogAnalysis[] = await res.json()
        setAnalyses(Array.isArray(data) ? data : [])
      }
    } catch {
      // 조용히 처리 — 빈 상태로 유지
    } finally {
      setLoading(false)
    }
  }

  // 최근 분석 시도 중 CAPTCHA/차단으로 실패한 키워드 조회 — 실패해도 이전 결과가
  // 그대로 유지되므로(백엔드 저장 생략), "왜 안 바뀌었는지" 별도로 안내하기 위함
  const loadCaptchaStatus = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/report/blog-analysis-status/${bizId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data: { captcha_keywords?: string[] } = await res.json()
        setCaptchaKeywords(Array.isArray(data.captcha_keywords) ? data.captcha_keywords : [])
      }
    } catch {
      // 조용히 처리 — 경고 배너만 생략, 핵심 기능에는 영향 없음
    }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`${backendUrl}/api/report/blog-analysis/${bizId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.status === 403) {
        setError("Basic 이상 구독이 필요합니다.")
        return
      }
      if (res.status === 202 || res.ok) {
        setMessage("분석을 시작했습니다. 약 1~3분 후 새로고침 버튼을 누르세요.")
      } else {
        const data = await res.json().catch(() => ({}))
        setError((data as { detail?: string }).detail || "분석 요청에 실패했습니다.")
      }
    } catch {
      setError("서버에 연결할 수 없습니다.")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRefresh = async () => {
    setMessage(null)
    await Promise.all([loadAnalyses(), loadCaptchaStatus()])
  }

  const handleCapture = async () => {
    setCapturing(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`${backendUrl}/api/report/capture-blog/${bizId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const kwCount: number = (data as { keywords?: string[] }).keywords?.length ?? 3
        // 실측(2026-05-15): 5개 키워드 31초 완료 → 키워드당 약 8초 + 여유 20초
        const waitSec = kwCount * 8 + 20
        const readyAt = Date.now() + waitSec * 1000
        // 페이지 이동 후 복귀해도 버튼 상태 유지 (v2 키 — 구버전 자동 무효화)
        localStorage.setItem(`blog_capture_ready_v2_${bizId}`, JSON.stringify({ readyAt }))
        setCaptureTriggered(true)
        setCaptureReadyIn(waitSec)
        setMessage(`키워드 ${kwCount}개 촬영을 시작했습니다 (약 ${Math.ceil(waitSec / 60)}분 소요). 촬영은 서버에서 진행되므로 다른 페이지로 이동하셔도 됩니다. 완료 후 이 페이지로 돌아와 아래 버튼을 누르세요.`)
        // 카운트다운
        let remaining = waitSec
        const timer = setInterval(() => {
          remaining -= 1
          setCaptureReadyIn(remaining)
          if (remaining <= 0) clearInterval(timer)
        }, 1000)
      } else {
        const data = await res.json().catch(() => ({}))
        setError((data as { detail?: string }).detail || "재촬영 요청에 실패했습니다.")
      }
    } catch {
      setError("서버에 연결할 수 없습니다.")
    } finally {
      setCapturing(false)
    }
  }

  const handleSaveBlogId = async () => {
    const id = blogIdInput.trim().replace(/^https?:\/\/blog\.naver\.com\//i, "").replace(/\/$/, "")
    if (!id) return
    setBlogIdSaving(true)
    setBlogIdSaved(false)
    try {
      const res = await fetch(`${backendUrl}/api/businesses/${bizId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ naver_blog_id: id }),
      })
      if (res.ok) {
        setBlogIdInput(id)
        setSavedBlogId(id)
        setBlogIdSaved(true)
        setMessage("블로그 ID가 저장됐습니다. 순위 판별이 즉시 업데이트됩니다.")
        setTimeout(() => setBlogIdSaved(false), 3000)
      } else {
        setError("저장에 실패했습니다.")
      }
    } catch {
      setError("서버에 연결할 수 없습니다.")
    } finally {
      setBlogIdSaving(false)
    }
  }

  // ── 빈 키워드 상태 ────────────────────────────────────────────────────────
  if (!loading && allKeywords.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600 mb-1">등록된 키워드가 없습니다.</p>
        <p className="text-sm text-gray-400">
          사업장 설정에서 키워드를 등록하면 블로그 노출 분석을 확인할 수 있습니다.
        </p>
      </div>
    )
  }

  return (
    <>
    {/* 이미지 전체화면 모달 */}
    {modalImage && <ImageModal image={modalImage} onClose={closeModal} />}

    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* ── 헤더 ── */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-800">
              키워드별 블로그 노출 순위
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              AI 스캔 결과로 스마트플레이스·블로그를 개선하면 이 순위가 올라갑니다. 현재 키워드별 노출 순위를 확인하고 변화를 추적하세요.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="최신 분석 결과 불러오기"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">새로고침</span>
            </button>

            {isPlanOk ? (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {analyzing ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    분석 중...
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    지금 분석
                  </>
                )}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-400 text-sm rounded-lg cursor-not-allowed">
                <Search className="w-3.5 h-3.5" />
                Basic 이상
              </span>
            )}
          </div>
        </div>

        {/* 피드백 메시지 */}
        {message && (
          <p className="mt-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* 최근 분석 시도 중 일부 키워드가 CAPTCHA/차단으로 측정 실패한 경우 — 이전 결과 유지 안내 */}
        {captchaKeywords.length > 0 && (
          <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ &quot;{captchaKeywords.join(", ")}&quot; 키워드는 네이버 측 일시적 차단으로 측정하지 못해 이전 결과를 그대로 표시 중입니다. 잠시 후 &quot;지금 분석&quot;을 다시 시도해 주세요.
          </p>
        )}

        {/* 키워드 변경 안내 */}
        <div className="mt-3 flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="shrink-0 mt-0.5">💡</span>
          <span>
            분석에 사용되는 키워드는{" "}
            <a href="/onboarding" className="underline font-medium hover:text-blue-900">
              사업장 설정
            </a>
            에서 변경할 수 있습니다. 키워드 변경 후 다시 "지금 분석"을 실행하세요.
          </span>
        </div>
      </div>

      {/* ── 네이버 블로그 ID 등록 ── */}
      <div className="px-4 md:px-6 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-500 mb-2">
          내 네이버 블로그 ID를 등록하면 검색 결과에서 내 포스팅 순위를 정확히 표시합니다.
          <span className="ml-1 text-gray-400">(blog.naver.com/<strong>여기</strong> 부분)</span>
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={blogIdInput}
            onChange={(e) => setBlogIdInput(e.target.value)}
            placeholder="예: hongstudio123"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
            onKeyDown={(e) => e.key === "Enter" && handleSaveBlogId()}
          />
          <button
            onClick={handleSaveBlogId}
            disabled={blogIdSaving || !blogIdInput.trim()}
            className="shrink-0 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {blogIdSaving ? "저장 중..." : blogIdSaved ? "✓ 저장됨" : "저장"}
          </button>
        </div>
      </div>

      {/* ── 요약 표 + 행 클릭 펼침 ── */}
      <div>
        {/* 로딩 skeleton */}
        {loading && (
          <div className="p-4 space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
          </div>
        )}

        {/* 분석 결과 없음 */}
        {!loading && displayAnalyses.length === 0 && (
          <div className="text-center py-10 px-4">
            <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">아직 분석 결과가 없습니다.</p>
            <p className="text-sm text-gray-400 mb-4">"지금 분석" 버튼을 눌러 블로그 노출 순위를 확인하세요.</p>
          </div>
        )}

        {/* 요약 표 */}
        {!loading && displayAnalyses.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 md:px-6 py-3.5 text-sm font-semibold text-gray-600">키워드</th>
                  <th className="text-left px-4 md:px-6 py-3.5 text-sm font-semibold text-gray-600">내 순위</th>
                  <th className="text-left px-4 md:px-6 py-3.5 text-sm font-semibold text-gray-600 hidden sm:table-cell">1위 블로그</th>
                  <th className="text-left px-4 md:px-6 py-3.5 text-sm font-semibold text-gray-600 hidden md:table-cell">분석 시각</th>
                  <th className="px-4 md:px-6 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayAnalyses.map((analysis) => {
                  const isOpen = expandedKeyword === analysis.keyword
                  const top1 = analysis.posts[0]
                  return (
                    <React.Fragment key={analysis.keyword}>
                      <tr
                        onClick={() => setExpandedKeyword(isOpen ? null : analysis.keyword)}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 md:px-6 py-4 text-base font-semibold text-gray-800 whitespace-nowrap">
                          {analysis.keyword}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          {analysis.my_rank !== null ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                              {analysis.my_rank}위
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-600">
                              미노출
                            </span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-600 hidden sm:table-cell max-w-[180px]">
                          <span className="truncate block">{top1?.blog_name || top1?.title || "—"}</span>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-500 hidden md:table-cell whitespace-nowrap">
                          {formatAnalyzedAt(analysis.analyzed_at)}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            {isOpen ? "접기 ▲" : `${analysis.posts.length}개 보기 ▼`}
                          </span>
                        </td>
                      </tr>

                      {/* 펼침: 포스팅 목록 */}
                      {isOpen && (
                        <tr>
                          <td colSpan={5} className="px-4 md:px-6 py-4 bg-gray-50">
                            {/* 블로그 ID 미등록 경고 */}
                            {analysis.blog_id_registered === false && analysis.my_rank === null && (
                              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                                <span className="shrink-0 mt-0.5">⚠️</span>
                                <span>블로그 ID 미등록 시 자동 판별이 어렵습니다. 위 입력창에 네이버 블로그 ID를 등록하면 정확히 찾아드립니다.</span>
                              </div>
                            )}
                            {analysis.posts.length > 0 ? (
                              <div className="space-y-2">
                                {analysis.posts.map((post) => (
                                  <PostItem key={`${post.rank}-${post.url}`} post={post} />
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 text-center py-4">포스팅 데이터가 없습니다.</p>
                            )}
                            <div className="pt-3 text-right">
                              <a
                                href={`https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(analysis.keyword)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                네이버에서 직접 확인
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* ── Before / After 스크린샷 섹션 — 스크린샷 없어도 항상 표시 ── */}
    {isPlanOk && (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-4">
        <div className="px-4 md:px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-800">키워드별 네이버 블로그 검색 화면 변화</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                개선 행동 전후의 네이버 블로그 탭 화면을 비교합니다. 광고 없이 블로그 결과만 표시됩니다.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {captureTriggered && (
                <button
                  onClick={() => {
                    localStorage.removeItem(`blog_capture_ready_v2_${bizId}`)
                    window.location.reload()
                  }}
                  disabled={captureReadyIn > 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={captureReadyIn > 0 ? `${captureReadyIn}초 후 활성화됩니다` : "클릭하면 새 스크린샷을 확인합니다"}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {captureReadyIn > 0
                    ? `${Math.floor(captureReadyIn / 60)}:${String(captureReadyIn % 60).padStart(2, "0")} 후 확인 가능`
                    : "스크린샷 확인 (새로고침)"}
                </button>
              )}
              <button
                onClick={handleCapture}
                disabled={capturing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="블로그 스크린샷을 촬영합니다"
              >
                {capturing ? (
                  <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>촬영 중...</>
                ) : (
                  <><Camera className="w-3.5 h-3.5" />{initialShots.some(s => s.baseline || s.latest) ? "재촬영" : "첫 스크린샷 촬영"}</>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-6">
          {!initialShots.some(s => s.baseline || s.latest) ? (
            <div className="text-center py-10">
              <Camera className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 mb-1">아직 캡처된 스크린샷이 없습니다.</p>
              <p className="text-sm text-gray-400">"첫 스크린샷 촬영" 버튼을 누르면 현재 네이버 블로그 검색 화면을 저장합니다.<br />약 1~2분 후 새로고침하세요.</p>
            </div>
          ) : initialShots.filter((s) => s.baseline || s.latest).map((shot) => (
            <div key={shot.keyword}>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm">{shot.keyword}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Baseline */}
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                    가입 시점 (Before)
                    {shot.baseline?.captured_at && (
                      <span className="ml-auto text-gray-400">
                        {new Date(shot.baseline.captured_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                  {shot.baseline ? (
                    <div
                      className="relative group cursor-zoom-in"
                      onClick={() =>
                        openModal({
                          url: shot.baseline!.url,
                          keyword: shot.keyword,
                          type: "before",
                          date: shot.baseline?.captured_at
                            ? new Date(shot.baseline.captured_at).toLocaleDateString("ko-KR")
                            : "",
                        })
                      }
                    >
                      <img
                        src={shot.baseline.url}
                        alt={`${shot.keyword} 가입시점`}
                        className="w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow">
                          <Maximize2 className="w-5 h-5 text-gray-700" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-sm text-gray-300">
                      캡처 없음
                    </div>
                  )}
                </div>
                {/* Latest */}
                <div className="rounded-xl border border-blue-100 overflow-hidden">
                  <div className="bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    현재 (After)
                    {shot.latest?.captured_at && (
                      <span className="ml-auto text-blue-400">
                        {new Date(shot.latest.captured_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                  {shot.latest && shot.latest.url !== shot.baseline?.url ? (
                    <div
                      className="relative group cursor-zoom-in"
                      onClick={() =>
                        openModal({
                          url: shot.latest!.url,
                          keyword: shot.keyword,
                          type: "after",
                          date: shot.latest?.captured_at
                            ? new Date(shot.latest.captured_at).toLocaleDateString("ko-KR")
                            : "",
                        })
                      }
                    >
                      <img
                        src={shot.latest.url}
                        alt={`${shot.keyword} 현재`}
                        className="w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow">
                          <Maximize2 className="w-5 h-5 text-gray-700" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-sm text-gray-300">
                      {shot.baseline ? "아직 변화 없음 (스캔 후 업데이트)" : "캡처 없음"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </>
  )
}

