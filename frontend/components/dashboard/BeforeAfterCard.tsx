"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { X, ZoomIn, Search } from "lucide-react"

interface BeforeAfterItem {
  id: string
  capture_type: string
  image_url: string
  created_at: string
  query_used?: string | null
}

interface BeforeAfterCardProps {
  items: BeforeAfterItem[]
  businessName: string
}

const TYPE_LABEL: Record<string, string> = {
  before: "가입 시점",
  before_naver_ai: "가입 시점",
  before_google: "가입 시점",
  after_7d: "1주 후",
  after_14d: "2주 후",
  after_30d: "30일 후",
  after_7d_naver_ai: "1주 후",
  after_14d_naver_ai: "2주 후",
  after_30d_naver_ai: "30일 후",
  after_7d_google: "1주 후",
  after_14d_google: "2주 후",
  after_30d_google: "30일 후",
  // 구 데이터 하위호환
  after_60d: "60일 후",
  after_90d: "90일 후",
}

function getPlatform(captureType: string): "naver_blog" | "naver_ai" | "google" | "other" {
  if (captureType.includes("naver_ai")) return "naver_ai"
  if (captureType.includes("google")) return "google"
  if (
    captureType === "before" ||
    captureType === "naver" ||
    (captureType.startsWith("after_") &&
      !captureType.includes("_naver_ai") &&
      !captureType.includes("_google"))
  )
    return "naver_blog"
  return "other"
}

const PLATFORM_LABEL: Record<string, string> = {
  naver_blog: "네이버 블로그",
  naver_ai: "네이버 AI 브리핑",
  google: "Google 검색",
}

const PLATFORM_COLOR: Record<string, string> = {
  naver_blog: "text-green-600 bg-green-50 border-green-200",
  naver_ai: "text-blue-600 bg-blue-50 border-blue-200",
  google: "text-orange-600 bg-orange-50 border-orange-200",
}

interface LightboxProps {
  src: string
  alt: string
  label: string
  date: string
  onClose: () => void
}

function Lightbox({ src, alt, label, date, onClose }: LightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 md:p-8"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        onClick={onClose}
        aria-label="닫기"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div
        className="relative w-full max-w-sm sm:max-w-xl md:max-w-3xl lg:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-white font-semibold text-base md:text-lg">{label}</span>
          <span className="text-white/60 text-sm">{date}</span>
        </div>

        <img
          src={src}
          alt={alt}
          className="w-full rounded-xl shadow-2xl object-contain max-h-[75vh]"
        />

        <p className="mt-3 text-center text-white/50 text-sm">
          ESC 키 또는 바깥 영역 클릭 시 닫힙니다
        </p>
      </div>
    </div>
  )
}

interface ImageThumbProps {
  item: BeforeAfterItem
  label: string
  isBefore?: boolean
  onClick: () => void
}

function ImageThumb({ item, label, isBefore, onClick }: ImageThumbProps) {
  const dateStr = new Date(item.created_at).toLocaleDateString("ko-KR")
  const borderClass = isBefore ? "border-gray-200" : "border-blue-200"
  const labelClass = isBefore ? "text-gray-500" : "text-blue-600 font-medium"
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div>
      <div className={`text-sm ${labelClass} mb-1 text-center`}>{label}</div>
      <div className="relative group cursor-pointer" onClick={!imgError ? onClick : undefined}>
        {imgError ? (
          /* 로딩 실패 fallback */
          <div
            className={`w-full rounded-lg border ${borderClass} bg-gray-50 aspect-video flex flex-col items-center justify-center gap-1`}
          >
            <span className="text-gray-300 text-2xl">🖼</span>
            <span className="text-sm text-gray-400 text-center px-2">이미지를 불러올 수 없습니다</span>
          </div>
        ) : (
          <>
            {/* 로딩 중 skeleton */}
            {!imgLoaded && (
              <div
                className={`absolute inset-0 w-full rounded-lg border ${borderClass} bg-gray-100 animate-pulse aspect-video`}
              />
            )}
            <img
              src={item.image_url}
              alt={label}
              className={`w-full rounded-lg border ${borderClass} object-cover aspect-video transition-opacity group-hover:opacity-80 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        )}
        {!imgError && imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover:bg-black/30 transition-all">
            <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-7 h-7 text-white drop-shadow" />
              <span className="text-white text-sm font-medium drop-shadow">클릭하여 크게 보기</span>
            </div>
          </div>
        )}
      </div>
      <div className="text-sm text-gray-400 text-center mt-1">{dateStr}</div>
    </div>
  )
}

type BeforeGroup = {
  key: string
  query: string | null
  sectionLabel: string
  items: BeforeAfterItem[]
}

export function BeforeAfterCard({ items, businessName }: BeforeAfterCardProps) {
  const [lightbox, setLightbox] = useState<{
    src: string
    alt: string
    label: string
    date: string
  } | null>(null)

  // 플랫폼별 탭 상태
  const platforms = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => {
      const p = getPlatform(i.capture_type)
      if (p !== "other") set.add(p)
    })
    // 표시 순서: naver_blog → naver_ai → google
    const order = ["naver_blog", "naver_ai", "google"]
    return order.filter((p) => set.has(p))
  }, [items])

  const [selectedPlatform, setSelectedPlatform] = useState<string>("")

  useEffect(() => {
    if (platforms.length > 0 && !selectedPlatform) {
      setSelectedPlatform(platforms[0])
    }
  }, [platforms, selectedPlatform])

  const activePlatform = selectedPlatform || platforms[0] || "naver_blog"

  // 현재 플랫폼 항목만 필터
  const platformItems = useMemo(
    () => items.filter((i) => getPlatform(i.capture_type) === activePlatform),
    [items, activePlatform]
  )

  const openLightbox = useCallback((item: BeforeAfterItem, label: string) => {
    setLightbox({
      src: item.image_url,
      alt: label,
      label,
      date: new Date(item.created_at).toLocaleDateString("ko-KR"),
    })
  }, [])

  const closeLightbox = useCallback(() => setLightbox(null), [])

  // 플랫폼 내 before / after 분리
  const befores = platformItems.filter(
    (i) =>
      i.capture_type === "before" ||
      i.capture_type === "before_naver_ai" ||
      i.capture_type === "before_google"
  )
  const afters = platformItems.filter((i) => i.capture_type.startsWith("after_"))

  // 전체 before 존재 여부 (플랫폼 무관)
  const allBefores = items.filter(
    (i) =>
      i.capture_type === "before" ||
      i.capture_type === "before_naver_ai" ||
      i.capture_type === "before_google"
  )

  if (allBefores.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="text-base font-medium text-gray-700 mb-2">Before / After 비교</div>
        <p className="text-sm text-gray-400">Before 스크린샷이 아직 준비되지 않았습니다.</p>
      </div>
    )
  }

  // 단일 before이고 query_used 없으면 구 데이터 호환 단순 레이아웃
  const isSingleLegacy = befores.length === 1 && !befores[0].query_used

  // query_used 기준으로 before 그룹핑
  const groupMap = new Map<string, BeforeGroup>()
  for (const item of befores) {
    const key = item.query_used ?? "__no_query__"
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        query: item.query_used ?? null,
        sectionLabel: item.query_used ?? "가입 시점 스크린샷",
        items: [],
      })
    }
    groupMap.get(key)!.items.push(item)
  }
  const beforeGroups = Array.from(groupMap.values())
  const hasMultipleSections = beforeGroups.length > 1

  return (
    <>
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="text-base font-medium text-gray-700 mb-4">
          {businessName} — Before / After 변화
        </div>

        {/* 플랫폼 탭 (2개 이상일 때만 표시) */}
        {platforms.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activePlatform === p
                    ? PLATFORM_COLOR[p]
                    : "text-gray-500 bg-white border-gray-200 hover:bg-gray-50"
                }`}
              >
                {PLATFORM_LABEL[p] ?? p}
              </button>
            ))}
          </div>
        )}

        {/* 단일 플랫폼일 때 라벨 표시 */}
        {platforms.length === 1 && (
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium border mb-3 ${
              PLATFORM_COLOR[activePlatform] ?? "text-gray-500 bg-gray-50 border-gray-200"
            }`}
          >
            {PLATFORM_LABEL[activePlatform] ?? activePlatform}
          </div>
        )}

        {isSingleLegacy ? (
          /* 구 데이터 호환 단일 레이아웃 */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ImageThumb
              item={befores[0]}
              label="가입 시점 (Before)"
              isBefore
              onClick={() => openLightbox(befores[0], "가입 시점 (Before)")}
            />
            {afters.map((after) => (
              <ImageThumb
                key={after.id}
                item={after}
                label={TYPE_LABEL[after.capture_type] ?? after.capture_type}
                onClick={() =>
                  openLightbox(after, TYPE_LABEL[after.capture_type] ?? after.capture_type)
                }
              />
            ))}
            {afters.length === 0 && (
              <div className="col-span-3 flex items-center justify-center bg-gray-50 rounded-lg h-24">
                <p className="text-sm text-gray-400 text-center px-4">
                  가입 1주 후 After 스크린샷이
                  <br />
                  자동으로 생성됩니다.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* 키워드별 섹션 분리 레이아웃 */
          <div className="space-y-6">
            {beforeGroups.map((group, idx) => (
              <div key={group.key}>
                {/* 섹션 제목 */}
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-3">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate max-w-full">{group.sectionLabel}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {group.items.map((item) => (
                    <ImageThumb
                      key={item.id}
                      item={item}
                      label="가입 시점 (Before)"
                      isBefore
                      onClick={() =>
                        openLightbox(item, `Before — ${group.sectionLabel}`)
                      }
                    />
                  ))}
                  {/* After는 첫 번째 섹션 오른쪽에만 인라인 표시
                      (after.query_used 미저장이므로 공통으로 1회만) */}
                  {idx === 0 &&
                    afters.map((after) => (
                      <ImageThumb
                        key={after.id}
                        item={after}
                        label={TYPE_LABEL[after.capture_type] ?? after.capture_type}
                        onClick={() =>
                          openLightbox(
                            after,
                            TYPE_LABEL[after.capture_type] ?? after.capture_type
                          )
                        }
                      />
                    ))}
                  {idx === 0 && afters.length === 0 && (
                    <div className="col-span-2 md:col-span-3 flex items-center justify-center bg-gray-50 rounded-lg h-20">
                      <p className="text-sm text-gray-400 text-center px-4">
                        1주 후 After 스크린샷이 자동 생성됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* after가 있고 섹션이 여러 개일 때 — 하단에 After 통합 섹션 별도 표시 */}
            {hasMultipleSections && afters.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-blue-600 mb-3">
                  <span>변화 후 (After) — 공통</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {afters.map((after) => (
                    <ImageThumb
                      key={after.id}
                      item={after}
                      label={TYPE_LABEL[after.capture_type] ?? after.capture_type}
                      onClick={() =>
                        openLightbox(
                          after,
                          TYPE_LABEL[after.capture_type] ?? after.capture_type
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          alt={lightbox.alt}
          label={lightbox.label}
          date={lightbox.date}
          onClose={closeLightbox}
        />
      )}
    </>
  )
}
