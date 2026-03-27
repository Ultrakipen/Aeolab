# AEOlab 코드 개선과제 문서 v1.0

> 작성일: 2026-03-27 | 근거: 감사 리포트 (프론트엔드-백엔드 전체 코드 감사)
> 대상: `frontend/` + `backend/` 전체
> 분류: 🔴 긴급 / 🟠 중요 / 🟡 보완 / 🟢 추가기능
>
> **✅ 구현 완료: 2026-03-27 | 20개 항목 전체 구현 완료 (22개 구현체)**
> **📄 반영 문서: `AEOlab_개발문서_v1.2.md`**

---

## 목차

1. [🔴 긴급 수정 사항 (보안·안정성)](#1-긴급-수정-사항)
2. [🟠 중요 버그 및 누락 항목](#2-중요-버그-및-누락-항목)
3. [🟡 품질 보완 사항](#3-품질-보완-사항)
4. [🟢 추가 기능 명세](#4-추가-기능-명세)
5. [구현 우선순위 로드맵](#5-구현-우선순위-로드맵)

---

## 1. 긴급 수정 사항

### 1-1. SSE 스트리밍 인증 취약점 🔴

**파일:** `backend/routers/scan.py`, `frontend/components/scan/ScanProgress.tsx`

**문제:**
`EventSource`는 HTTP 헤더를 커스터마이징할 수 없어 Bearer 토큰을 포함할 수 없다.
현재 구조가 `user_id`를 쿼리 파라미터로 받는다면 다른 사용자의 `biz_id`로 스캔을 실행하는 인증 우회가 가능하다.

**현재 (취약):**
```python
# GET /api/scan/stream?biz_id=xxx&user_id=yyy
# user_id를 쿼리 파라미터로 신뢰 — 변조 가능
```

**수정 방향 (단기 OTP 토큰 방식):**

`backend/routers/scan.py`에 추가:
```python
import secrets
from datetime import datetime, timedelta

# 인메모리 토큰 저장소 (실운영은 Redis 권장)
_stream_tokens: dict[str, dict] = {}

@router.post("/stream/prepare")
async def prepare_stream(
    biz_id: str,
    user=Depends(get_current_user)
):
    """SSE 스트림 시작 전 단기 토큰 발급 (60초 유효)"""
    token = secrets.token_urlsafe(32)
    _stream_tokens[token] = {
        "user_id": user["id"],
        "biz_id": biz_id,
        "expires_at": datetime.utcnow() + timedelta(seconds=60)
    }
    return {"stream_token": token, "expires_in": 60}

@router.get("/stream")
async def stream_scan(stream_token: str):
    """토큰으로 사용자·사업장 검증 후 SSE 스트림 시작"""
    token_data = _stream_tokens.pop(stream_token, None)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired stream token")
    if datetime.utcnow() > token_data["expires_at"]:
        raise HTTPException(status_code=401, detail="Stream token expired")

    user_id = token_data["user_id"]
    biz_id = token_data["biz_id"]
    # ... 이하 기존 SSE 로직
```

`frontend/components/scan/ScanProgress.tsx` 수정:
```typescript
// 1단계: 토큰 발급 (인증 헤더 포함 가능)
const { stream_token } = await apiCall('/api/scan/stream/prepare', {
  method: 'POST',
  body: JSON.stringify({ biz_id }),
})

// 2단계: 토큰으로 EventSource 생성 (토큰은 단기 유효)
const es = new EventSource(`${apiBase}/api/scan/stream?stream_token=${stream_token}`)
```

---

### 1-2. Playwright 동시 실행 서버 과부하 🔴

**파일:** `backend/services/ai_scanner/multi_scanner.py`, `backend/scheduler/jobs.py`

**문제:**
Playwright 인스턴스 1개 = RAM 300~500MB. 8개 동시 실행 시 최대 4GB 소비 → 서버(RAM 4GB) 즉시 OOM.

**수정:**

`backend/services/ai_scanner/multi_scanner.py`:
```python
import asyncio

# 전역 Playwright 세마포어 (최대 동시 2개)
PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(2)

class MultiAIScanner:
    async def _run_playwright_scanner(self, scanner_func, *args):
        """Playwright 기반 스캐너 실행 시 세마포어로 동시성 제한"""
        async with PLAYWRIGHT_SEMAPHORE:
            return await scanner_func(*args)

    async def scan_all_platforms(self, business_info: dict) -> dict:
        # API 기반 스캐너는 동시 실행 허용
        api_tasks = [
            self.gemini_scanner.scan(business_info),
            self.chatgpt_scanner.scan(business_info),
            self.perplexity_scanner.scan(business_info),
            self.grok_scanner.scan(business_info),
            self.claude_scanner.scan(business_info),
        ]
        # Playwright 기반 스캐너는 직렬화
        playwright_tasks = [
            self._run_playwright_scanner(self.naver_scanner.scan, business_info),
            self._run_playwright_scanner(self.google_scanner.scan, business_info),
            self._run_playwright_scanner(self.zeta_scanner.scan, business_info),
        ]

        api_results = await asyncio.gather(*api_tasks, return_exceptions=True)
        playwright_results = []
        for task in playwright_tasks:
            result = await task  # 직렬 실행
            playwright_results.append(result)
            await asyncio.sleep(2)  # 인스턴스 해제 대기

        return {**api_results, **playwright_results}
```

`backend/scheduler/jobs.py`:
```python
# daily_scan_all 내 사업장 간 간격 추가
async def daily_scan_all():
    businesses = await get_all_active_businesses()
    for i, biz in enumerate(businesses):
        try:
            await scan_single_business(biz)
        except Exception as e:
            logger.error(f"스캔 실패: {biz['id']} - {e}")
        finally:
            # Playwright 인스턴스 완전 해제 대기
            await asyncio.sleep(30)
            if i % 5 == 4:
                # 5개마다 1분 휴식 (메모리 GC 유도)
                await asyncio.sleep(60)
```

---

## 2. 중요 버그 및 누락 항목

### 2-1. frontend/lib/api.ts 누락 함수들 🟠

**파일:** `frontend/lib/api.ts`

다음 함수들을 추가해야 합니다:

```typescript
// ① 업종 벤치마크 조회
export async function getBenchmark(category: string, region: string) {
  return apiCall<BenchmarkData>(
    `/api/report/benchmark/${encodeURIComponent(category)}/${encodeURIComponent(region)}`
  )
}

// ② PDF 리포트 다운로드
export async function downloadPdfReport(bizId: string, token: string): Promise<void> {
  const res = await fetch(`${apiBase}/api/report/pdf/${bizId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new ApiError('PDF 생성 실패', 'PDF_ERROR')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aeolab_report_${bizId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ③ ChatGPT 광고 대응 가이드
export async function generateAdDefenseGuide(bizId: string) {
  return apiCall<AdDefenseGuide>(`/api/guide/ad-defense/${bizId}`, {
    method: 'POST',
  })
}

// ④ 창업 시장 분석 리포트
export async function generateStartupReport(req: StartupReportRequest) {
  return apiCall<StartupReport>('/api/startup/report', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

// ⑤ 창업 시장 현황 (공개)
export async function getStartupMarket(category: string, region: string) {
  return apiCall<StartupMarket>(
    `/api/startup/market/${encodeURIComponent(category)}/${encodeURIComponent(region)}`
  )
}

// ⑥ 팀 멤버 목록
export async function getTeamMembers() {
  return apiCall<TeamMember[]>('/api/teams/members')
}

// ⑦ 팀원 초대
export async function inviteTeamMember(email: string, role: string) {
  return apiCall<void>('/api/teams/invite', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}

// ⑧ API 키 목록
export async function getApiKeys() {
  return apiCall<ApiKey[]>('/api/v1/keys')
}

// ⑨ API 키 발급
export async function createApiKey(name: string) {
  return apiCall<ApiKey>('/api/v1/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

// ⑩ API 키 폐기
export async function revokeApiKey(keyId: string) {
  return apiCall<void>(`/api/v1/keys/${keyId}`, { method: 'DELETE' })
}

// ⑪ 경쟁사 지역 검색 (네이버)
export async function searchCompetitors(query: string, region: string) {
  return apiCall<CompetitorSearchResult[]>(
    `/api/competitors/search?query=${encodeURIComponent(query)}&region=${encodeURIComponent(region)}`
  )
}

// ⑫ AEOlab 내 동종업계 추천
export async function getSuggestedCompetitors(bizId: string) {
  return apiCall<CompetitorSuggestion[]>('/api/competitors/suggest/list', {
    method: 'POST',
    body: JSON.stringify({ biz_id: bizId }),
  })
}
```

---

### 2-2. content_freshness 점수 실제 로직 구현 🟠

**파일:** `backend/services/score_engine.py`

**현재 (플레이스홀더):**
```python
def _content_freshness_score(self, scan_result: dict) -> float:
    return 50.0  # 기본값만 반환
```

**수정:**
```python
def _content_freshness_score(self, scan_result: dict) -> float:
    """
    콘텐츠 최신성 점수 계산
    - 마지막 스캔 이후 경과일 기반
    - 네이버 플레이스 최근 리뷰 날짜 활용
    - 웹사이트 최근 업데이트 여부
    """
    score = 50.0  # 기본값

    # 1. 마지막 스캔 날짜 기반 (스캔 데이터 신선도)
    last_scan_at = scan_result.get("created_at")
    if last_scan_at:
        from datetime import datetime, timezone
        try:
            scanned = datetime.fromisoformat(last_scan_at.replace("Z", "+00:00"))
            days_old = (datetime.now(timezone.utc) - scanned).days
            if days_old <= 7:
                score += 20
            elif days_old <= 30:
                score += 10
            elif days_old > 90:
                score -= 20
        except Exception:
            pass

    # 2. 네이버 플레이스 최근 리뷰 여부
    naver_result = scan_result.get("naver_result", {})
    recent_review_days = naver_result.get("recent_review_days")  # naver_place_stats에서 수집
    if recent_review_days is not None:
        if recent_review_days <= 7:
            score += 20
        elif recent_review_days <= 30:
            score += 10
        elif recent_review_days > 180:
            score -= 15

    # 3. Google AI Overview에서 최근 활동 언급 여부
    google_result = scan_result.get("google_result", {})
    if google_result.get("mentioned") and google_result.get("recency_signal"):
        score += 10

    return max(0.0, min(100.0, score))
```

---

### 2-3. 스캔 중복 실행 방지 🟠

**파일:** `backend/routers/scan.py`

**문제:** `/scan/full` (백그라운드)과 `/scan/stream` (SSE 직접 실행)이 공존하여 중복 스캔 가능.

**수정:**
```python
# 진행 중 스캔 추적 (인메모리, 실운영은 Redis)
_active_scans: set[str] = set()

@router.post("/full")
async def full_scan(req: ScanRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    scan_key = f"{user['id']}:{req.biz_id}"
    if scan_key in _active_scans:
        raise HTTPException(status_code=409, detail="이미 스캔이 진행 중입니다")

    _active_scans.add(scan_key)

    async def _scan_and_cleanup():
        try:
            await run_full_scan(req, user)
        finally:
            _active_scans.discard(scan_key)

    background_tasks.add_task(_scan_and_cleanup)
    return {"status": "started", "message": "스캔이 시작되었습니다"}
```

---

### 2-4. 신규 사용자 빈 대시보드 처리 🟠

**파일:** `frontend/app/(dashboard)/dashboard/page.tsx`

**문제:** 스캔 기록 없는 신규 사용자가 대시보드 접속 시 API가 빈 응답 반환, 에러 처리 미흡.

**수정:**
```tsx
export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const businesses = await getMyBusinesses(user!.id).catch(() => [])

  // 사업장 미등록 → 등록 유도 화면
  if (!businesses || businesses.length === 0) {
    return <RegisterBusinessForm userId={user!.id} />
  }

  const biz = businesses[0]

  // 스캔 기록 없는 신규 → 첫 스캔 유도 화면
  const score = await getScore(biz.id).catch(() => null)
  if (!score) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <h2 className="text-2xl font-bold">첫 번째 AI 스캔을 실행하세요</h2>
        <p className="text-muted-foreground text-center max-w-md">
          8개 AI 플랫폼에서 내 사업장이 얼마나 검색되는지 확인합니다.<br />
          첫 스캔은 약 2~3분 소요됩니다.
        </p>
        <ScanTrigger bizId={biz.id} isFirstScan={true} />
      </div>
    )
  }

  // 정상 대시보드 렌더링
  return <DashboardContent biz={biz} score={score} />
}
```

---

### 2-5. 업종 벤치마크 데이터 부족 Fallback 🟠

**파일:** `backend/routers/report.py`

**문제:** 특정 업종·지역 데이터가 없으면 벤치마크 API가 의미없는 결과 반환.

**수정:**
```python
@router.get("/benchmark/{category}/{region}")
async def get_benchmark(category: str, region: str):
    # 1순위: 해당 업종 + 해당 지역
    data = await query_benchmark(category=category, region=region)

    if not data or data["sample_count"] < 5:
        # 2순위: 해당 업종 + 전국
        data = await query_benchmark(category=category, region=None)
        data["fallback"] = "region"
        data["fallback_message"] = f"{region} 지역 데이터가 부족하여 전국 {category} 평균을 표시합니다"

    if not data or data["sample_count"] < 3:
        # 3순위: 전체 서비스 평균
        data = await query_benchmark(category=None, region=None)
        data["fallback"] = "global"
        data["fallback_message"] = "데이터 수집 중입니다. 전체 평균을 표시합니다"

    return data
```

---

## 3. 품질 보완 사항

### 3-1. Trial 페이지 전환율 개선 🟡

**파일:** `frontend/app/(public)/trial/page.tsx`

**현재 문제:** "1회 샘플 결과 (100회 결과와 다를 수 있음)" → 사용자가 결과를 신뢰하지 않음.

**수정 방향:**
```tsx
// 결과 표시 시 업그레이드 메시지 변경
const UpgradeMessage = ({ score }: { score: number }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
    <p className="font-semibold text-amber-800">
      지금 보이는 점수는 AI 1개가 1번 검색한 결과입니다
    </p>
    <p className="text-sm text-amber-700 mt-1">
      구독하면 <strong>8개 AI × 100회 = 800회 측정</strong>으로<br />
      오차 ±3% 이내의 정확한 AI 노출 점수를 받습니다
    </p>
    <ul className="text-sm text-amber-700 mt-2 space-y-1">
      <li>• ChatGPT·Perplexity·Grok·네이버 AI 등 8개 플랫폼 동시 분석</li>
      <li>• 경쟁사 {score > 60 ? "앞서는" : "추월하는"} 맞춤 개선 전략 제공</li>
      <li>• 매일 자동 스캔 + 카카오톡 알림</li>
    </ul>
    <button className="mt-3 w-full bg-amber-600 text-white rounded-lg py-2 font-semibold">
      월 9,900원으로 정확한 분석 시작하기 →
    </button>
  </div>
)
```

---

### 3-2. 가이드 생성 소요 시간 안내 🟡

**파일:** `frontend/app/(dashboard)/guide/GuideClient.tsx`

**수정:**
```tsx
const [isGenerating, setIsGenerating] = useState(false)
const [elapsedSeconds, setElapsedSeconds] = useState(0)

// 가이드 생성 버튼 클릭 시
const handleGenerate = async () => {
  setIsGenerating(true)
  setElapsedSeconds(0)

  const timer = setInterval(() => {
    setElapsedSeconds(prev => prev + 1)
  }, 1000)

  try {
    await generateGuide({ biz_id: bizId })
    await fetchLatestGuide()
  } finally {
    clearInterval(timer)
    setIsGenerating(false)
  }
}

// 버튼 렌더링
{isGenerating && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="animate-spin h-4 w-4" />
    <span>AI가 맞춤 전략을 작성 중입니다... ({elapsedSeconds}초)</span>
    <span className="text-xs">(보통 10~15초 소요)</span>
  </div>
)}
```

---

### 3-3. 점수 등급 기준 툴팁 🟡

**파일:** `frontend/components/dashboard/ScoreCard.tsx`

**수정:**
```tsx
const GRADE_INFO = {
  A: { range: "80점 이상", description: "AI 검색 최상위 노출", percentile: "상위 20%" },
  B: { range: "60~79점", description: "AI 검색 양호", percentile: "상위 40%" },
  C: { range: "40~59점", description: "AI 검색 개선 필요", percentile: "중간 40%" },
  D: { range: "40점 미만", description: "AI 검색 미흡", percentile: "하위 20%" },
}

// 등급 배지에 툴팁 추가
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      <span className={`grade-badge grade-${grade}`}>{grade}</span>
    </TooltipTrigger>
    <TooltipContent>
      <p className="font-semibold">{GRADE_INFO[grade].range}</p>
      <p>{GRADE_INFO[grade].description}</p>
      <p className="text-muted-foreground">{GRADE_INFO[grade].percentile} 수준</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

### 3-4. 경쟁사 추가 후 즉시 스캔 제안 🟡

**파일:** `frontend/app/(dashboard)/competitors/CompetitorsClient.tsx`

**수정:**
```tsx
const [showScanPrompt, setShowScanPrompt] = useState(false)

const handleAddCompetitor = async (competitor: CompetitorInput) => {
  await addCompetitor(competitor, userId)
  setShowScanPrompt(true)  // 추가 성공 후 스캔 제안 모달
}

{showScanPrompt && (
  <Dialog open={showScanPrompt} onOpenChange={setShowScanPrompt}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>경쟁사가 추가되었습니다</DialogTitle>
        <DialogDescription>
          지금 바로 스캔하면 {competitorName}와의 AI 노출 점수를 비교할 수 있습니다.
        </DialogDescription>
      </DialogHeader>
      <div className="flex gap-3 mt-4">
        <Button onClick={() => { setShowScanPrompt(false); router.push('/dashboard') }}>
          나중에
        </Button>
        <Button variant="default" onClick={handleScanNow}>
          지금 비교 스캔 실행 →
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)}
```

---

### 3-5. 사업자번호 원클릭 자동완성 🟡

**파일:** `frontend/components/dashboard/RegisterBusinessForm.tsx`

**수정:**
```tsx
const [bizNumLookupState, setBizNumLookupState] = useState<'idle'|'loading'|'success'|'error'>('idle')

const handleBizNumLookup = async (bizNum: string) => {
  if (bizNum.replace(/-/g, '').length !== 10) return

  setBizNumLookupState('loading')
  try {
    const result = await fetch(`${apiBase}/api/businesses/lookup?biz_num=${bizNum.replace(/-/g, '')}`)
    const data = await result.json()

    if (data.status === '계속사업자') {
      // 폼 필드 자동 채움
      setValue('business_name', data.company_name)
      setValue('owner_name', data.representative)
      setBizNumLookupState('success')
    } else {
      setBizNumLookupState('error')
      setError('biz_num', { message: `${data.status} 상태의 사업자입니다` })
    }
  } catch {
    setBizNumLookupState('error')
  }
}

// 사업자번호 입력 필드에 조회 버튼 추가
<div className="relative">
  <Input
    {...register('biz_num')}
    placeholder="000-00-00000"
    onChange={(e) => {
      // 하이픈 자동 포맷팅
      const formatted = e.target.value.replace(/[^0-9]/g, '')
        .replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
      setValue('biz_num', formatted)
      if (formatted.replace(/-/g, '').length === 10) {
        handleBizNumLookup(formatted)
      }
    }}
  />
  {bizNumLookupState === 'loading' && (
    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin" />
  )}
  {bizNumLookupState === 'success' && (
    <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
  )}
</div>
```

---

## 4. 추가 기능 명세

### 4-1. 랜딩 페이지 샘플 결과 미리보기 🟢

**우선순위:** 최고 (전환율 직결)
**예상 구현 기간:** 1~2일
**예상 전환율 개선:** +30~50%

**파일:** `frontend/app/(public)/page.tsx`

**설명:** 가입 전 실제 분석 결과 화면을 더미 데이터로 보여주어 서비스 가치를 즉시 전달.

**구현:**
```tsx
// 더미 샘플 데이터
const SAMPLE_RESULT = {
  business_name: "강남 맛집 김씨네 떡볶이",
  category: "분식",
  region: "서울 강남구",
  score: 67,
  grade: "B" as const,
  weekly_change: +5,
  breakdown: {
    exposure_freq: { score: 68, label: "AI 검색 노출 빈도", weight: 30 },
    review_quality: { score: 72, label: "리뷰 품질", weight: 20 },
    schema_score: { score: 45, label: "웹 콘텐츠 구조화", weight: 15 },
    online_mentions: { score: 80, label: "온라인 언급 빈도", weight: 15 },
    info_completeness: { score: 90, label: "정보 완성도", weight: 10 },
    content_freshness: { score: 55, label: "콘텐츠 최신성", weight: 10 },
  },
  platforms: [
    { name: "Gemini", icon: "✨", mentioned: true, frequency: "100회 중 68회" },
    { name: "ChatGPT", icon: "🤖", mentioned: true, frequency: "언급됨" },
    { name: "Perplexity", icon: "🔍", mentioned: false, frequency: "미언급" },
    { name: "Naver AI", icon: "N", mentioned: true, frequency: "AI 브리핑 포함" },
    { name: "Claude", icon: "◆", mentioned: false, frequency: "미언급" },
    { name: "Grok", icon: "X", mentioned: false, frequency: "미언급" },
  ],
}

// 랜딩 페이지 내 섹션
const SampleResultSection = () => (
  <section className="py-20 bg-gray-50">
    <div className="max-w-4xl mx-auto px-4">
      <div className="text-center mb-12">
        <span className="bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full">
          실제 분석 화면 미리보기
        </span>
        <h2 className="text-3xl font-bold mt-4">이런 분석 결과를 받게 됩니다</h2>
        <p className="text-muted-foreground mt-2">
          8개 AI 플랫폼에서의 노출 현황을 한눈에 파악하세요
        </p>
      </div>
      {/* 기존 ScoreCard, RankingBar 컴포넌트를 더미 데이터로 렌더링 */}
      <div className="relative">
        <ScoreCard data={SAMPLE_RESULT} />
        {/* 흐림 효과 + "무료 체험하기" 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 text-center pb-8">
          <Button size="lg" asChild>
            <Link href="/trial">내 사업장 무료 분석하기 →</Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
)
```

---

### 4-2. AI 언급 맥락 분석 (Mention Context Analysis) 🟢

**우선순위:** 높음 (핵심 차별화)
**예상 구현 기간:** 3~5일
**플랜 제한:** Pro+

**설명:**
AI가 내 사업장을 언급했을 때 단순 "언급됨/미언급" 외에 어떤 맥락으로 언급했는지 분석.
현재 글로벌 경쟁사(Profound, Otterly.ai)도 미제공 중 — 차별화 기능.

**백엔드 구현:**

`backend/services/ai_scanner/gemini_scanner.py` 수정:
```python
async def analyze_mention_context(
    self,
    business_name: str,
    ai_response: str
) -> dict:
    """AI 응답 내 사업장 언급 맥락 분석"""
    if business_name not in ai_response:
        return {"mentioned": False}

    prompt = f"""
다음 AI 응답에서 '{business_name}'에 대한 언급을 분석하세요.
JSON으로만 응답하세요.

AI 응답:
{ai_response[:2000]}

분석 결과 형식:
{{
    "sentiment": "positive|neutral|negative",
    "mention_type": "recommendation|information|comparison|warning",
    "mentioned_attributes": ["맛", "가격", "위치", "서비스", "분위기"],
    "excerpt": "언급된 원문 발췌 (최대 100자)",
    "position": "top3|middle|bottom"  // 응답 내 언급 위치
}}
"""
    response = await self.model.generate_content_async(prompt)
    try:
        return json.loads(response.text)
    except json.JSONDecodeError:
        return {"mentioned": True, "sentiment": "neutral", "excerpt": ""}
```

`backend/routers/report.py`에 엔드포인트 추가:
```python
@router.get("/mention-context/{biz_id}")
async def get_mention_context(biz_id: str, user=Depends(require_plan("pro"))):
    """최근 스캔의 AI 언급 맥락 분석 결과 조회"""
    scan = await db.scan_results.get_latest(biz_id=biz_id)
    if not scan:
        raise HTTPException(404, "스캔 결과가 없습니다")

    # ai_citations 테이블에서 맥락 데이터 조회
    citations = await db.ai_citations.get_with_context(biz_id=biz_id)
    return {
        "biz_id": biz_id,
        "analyzed_at": scan["created_at"],
        "platforms": citations,
        "summary": {
            "positive_count": sum(1 for c in citations if c.get("sentiment") == "positive"),
            "negative_count": sum(1 for c in citations if c.get("sentiment") == "negative"),
            "most_mentioned_attribute": _get_most_common_attribute(citations),
        }
    }
```

**프론트엔드 UI:**

`frontend/app/(dashboard)/guide/MentionContextCard.tsx` (신규):
```tsx
export function MentionContextCard({ citation }: { citation: AiCitation }) {
  const sentimentColor = {
    positive: "bg-green-50 border-green-200 text-green-800",
    neutral: "bg-gray-50 border-gray-200 text-gray-800",
    negative: "bg-red-50 border-red-200 text-red-800",
  }[citation.sentiment]

  const mentionTypeLabel = {
    recommendation: "추천으로 언급됨",
    information: "정보로 언급됨",
    comparison: "비교 대상으로 언급됨",
    warning: "부정적 맥락으로 언급됨",
  }[citation.mention_type]

  return (
    <div className={`rounded-xl border p-4 ${sentimentColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">{citation.platform}</span>
        <span className="text-sm">{mentionTypeLabel}</span>
      </div>
      <blockquote className="text-sm italic border-l-2 pl-3 mt-2">
        "{citation.excerpt}"
      </blockquote>
      <div className="flex gap-2 mt-3 flex-wrap">
        {citation.mentioned_attributes?.map(attr => (
          <span key={attr} className="text-xs bg-white/70 rounded-full px-2 py-0.5">
            #{attr}
          </span>
        ))}
      </div>
    </div>
  )
}
```

---

### 4-3. 공유 가능한 AI 성적표 (Share Card) 🟢

**우선순위:** 높음 (바이럴 성장)
**예상 구현 기간:** 2~3일
**플랜 제한:** 전체 (무료 포함 — 바이럴 목적)

**설명:**
내 AI 점수를 카카오톡·인스타그램에 공유할 수 있는 이미지 + 공개 링크 생성.

**백엔드 구현:**

`backend/routers/report.py`에 추가:
```python
from PIL import Image, ImageDraw, ImageFont
import io, base64

@router.get("/share-card/{biz_id}")
async def generate_share_card(biz_id: str):
    """SNS 공유용 AI 성적표 이미지 생성 (PNG)"""
    # 최신 점수 조회
    score_data = await db.score_history.get_latest(biz_id=biz_id)
    biz = await db.businesses.get(biz_id=biz_id)

    # Pillow로 카드 이미지 생성 (1080×1080, 인스타그램 최적)
    img = Image.new('RGB', (1080, 1080), color='#0f172a')
    draw = ImageDraw.Draw(img)

    # ... 디자인 렌더링 (기존 before_after_card.py 참고)

    # PNG 바이트로 반환
    buffer = io.BytesIO()
    img.save(buffer, format='PNG', optimize=True)

    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="aeolab_score_{biz_id}.png"',
            "Cache-Control": "public, max-age=3600"
        }
    )

@router.get("/share/{biz_id}")
async def get_share_page_data(biz_id: str):
    """공개 공유 페이지용 데이터 (민감 정보 제외)"""
    score_data = await db.score_history.get_latest(biz_id=biz_id)
    biz = await db.businesses.get(biz_id=biz_id)

    # 공개해도 되는 데이터만 반환
    return {
        "business_name": biz["name"],
        "category": biz["category"],
        "region": biz["region"],
        "score": score_data["total_score"],
        "grade": score_data["grade"],
        "gemini_frequency": score_data["exposure_freq"],
        "scanned_at": score_data["created_at"],
    }
```

`frontend/app/(public)/share/[bizId]/page.tsx` (신규):
```tsx
// 공개 공유 페이지 — 비로그인 접근 가능
export async function generateMetadata({ params }: { params: { bizId: string } }) {
  const data = await getSharePageData(params.bizId)
  return {
    title: `${data.business_name} AI 검색 점수 ${data.score}점 (${data.grade}등급)`,
    description: `${data.category} | ${data.region} | AEOlab AI 노출 분석`,
    openGraph: {
      images: [`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/report/share-card/${params.bizId}`],
    },
  }
}

export default async function SharePage({ params }: { params: { bizId: string } }) {
  const data = await getSharePageData(params.bizId)
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* 공유 카드 UI */}
        <div className="bg-slate-800 rounded-2xl p-8 text-white text-center">
          <p className="text-slate-400 text-sm">{data.category} · {data.region}</p>
          <h1 className="text-2xl font-bold mt-2">{data.business_name}</h1>
          <div className="mt-6">
            <span className="text-7xl font-black">{data.score}</span>
            <span className="text-2xl text-slate-400">/100</span>
          </div>
          <div className="mt-2 text-4xl font-bold text-amber-400">{data.grade}등급</div>
          <p className="text-slate-400 text-sm mt-4">
            AI 100회 검색 중 {data.gemini_frequency}회 언급
          </p>
        </div>
        {/* 내 사업장 분석하기 CTA */}
        <div className="mt-6 text-center">
          <Link href="/trial" className="bg-blue-600 text-white rounded-xl px-8 py-3 font-semibold">
            내 사업장도 무료 분석하기 →
          </Link>
        </div>
      </div>
    </div>
  )
}
```

`frontend/components/share/ShareButton.tsx` 업데이트:
```tsx
export function ShareButton({ bizId, score, businessName }: ShareButtonProps) {
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${bizId}`

  const handleKakaoShare = () => {
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${businessName}의 AI 검색 점수`,
        description: `현재 점수: ${score}점 | AEOlab으로 AI 노출 분석`,
        imageUrl: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/report/share-card/${bizId}`,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
    })
  }

  const handleDownloadImage = async () => {
    const res = await fetch(`${apiBase}/api/report/share-card/${bizId}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aeolab_점수카드.png`
    a.click()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Share2 className="h-4 w-4 mr-2" />공유</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleKakaoShare}>카카오톡으로 공유</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(shareUrl)}>링크 복사</DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadImage}>이미지 저장</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

### 4-4. 경쟁사 점수 추월 알림 🟢

**우선순위:** 높음 (이탈 방지)
**예상 구현 기간:** 1~2일
**플랜 제한:** Basic+

**설명:** 경쟁사가 내 점수를 추월했을 때 카카오톡으로 즉시 알림. 소상공인 경쟁 심리 활용.

**백엔드 구현:**

`backend/scheduler/jobs.py`에 추가:
```python
async def check_competitor_overtake():
    """경쟁사 점수 역전 감지 후 알림 발송"""
    # 모든 구독 사업장 조회
    businesses = await db.businesses.get_all_subscribed()

    for biz in businesses:
        my_score = await db.score_history.get_latest_score(biz["id"])
        if not my_score:
            continue

        competitors = await db.competitors.get_active(biz["id"])
        for comp in competitors:
            comp_score = await db.score_history.get_latest_score(comp["id"])
            if not comp_score:
                continue

            # 역전 감지: 이전 스캔에서 내가 앞섰는데 지금은 뒤처짐
            prev_my = await db.score_history.get_previous_score(biz["id"])
            if prev_my and prev_my > comp_score and my_score <= comp_score:
                # 역전 발생 → 카카오톡 알림
                await kakao_notify.send_competitor_overtake(
                    phone=biz["owner_phone"],
                    biz_name=biz["name"],
                    comp_name=comp["name"],
                    my_score=my_score,
                    comp_score=comp_score,
                    gap=comp_score - my_score,
                )
                logger.info(f"역전 알림 발송: {biz['name']} → {comp['name']} ({my_score} vs {comp_score})")

# APScheduler에 등록 (매일 스캔 완료 후 실행)
scheduler.add_job(check_competitor_overtake, 'cron', hour=3, minute=0)
```

`backend/services/kakao_notify.py`에 알림 유형 추가:
```python
async def send_competitor_overtake(
    self, phone: str, biz_name: str, comp_name: str,
    my_score: int, comp_score: int, gap: int
):
    """경쟁사 역전 알림 (템플릿 코드: AEOLAB_COMP_02)"""
    message = (
        f"[AEOlab] {biz_name}\n\n"
        f"경쟁사 '{comp_name}'이(가) AI 검색 점수에서 앞섰습니다!\n\n"
        f"내 점수: {my_score}점\n"
        f"{comp_name}: {comp_score}점 (차이: +{gap}점)\n\n"
        f"지금 바로 개선 가이드를 확인하고 점수를 역전하세요."
    )
    await self._send_alimtalk(phone=phone, template_code="AEOLAB_COMP_02", message=message)
```

---

### 4-5. 스캔 결과 즉시 카카오톡 전송 🟢

**우선순위:** 높음 (습관 형성)
**예상 구현 기간:** 1일
**플랜 제한:** Basic+

**설명:** 스캔 완료 즉시 핵심 인사이트 3줄을 카카오톡으로 전송. 앱 밖에서도 결과 확인 가능.

**백엔드 구현:**

`backend/routers/scan.py`의 `_save_scan_results()` 함수에 추가:
```python
async def _save_scan_results(scan_id: str, results: dict, biz_id: str, user_id: str):
    # ... 기존 저장 로직 ...

    # 스캔 완료 후 카카오톡 즉시 전송 (옵션 ON인 경우만)
    profile = await db.profiles.get(user_id=user_id)
    if profile and profile.get("kakao_scan_notify", True) and profile.get("phone"):
        score = calculate_score(results)
        top_platform = get_top_mentioned_platform(results)
        improvement = get_top_improvement(results)

        await kakao_notify.send_scan_complete(
            phone=profile["phone"],
            biz_name=biz["name"],
            score=score["total_score"],
            grade=score["grade"],
            weekly_change=score["weekly_change"],
            top_platform=top_platform,
            top_improvement=improvement,
        )
```

`backend/services/kakao_notify.py`에 추가:
```python
async def send_scan_complete(
    self, phone: str, biz_name: str, score: int, grade: str,
    weekly_change: int, top_platform: str, top_improvement: str
):
    """스캔 완료 즉시 알림 (템플릿 코드: AEOLAB_SCAN_01)"""
    change_emoji = "📈" if weekly_change > 0 else "📉" if weekly_change < 0 else "➡️"
    message = (
        f"[AEOlab] {biz_name} AI 스캔 완료\n\n"
        f"📊 현재 점수: {score}점 ({grade}등급)\n"
        f"{change_emoji} 지난주 대비: {'+' if weekly_change > 0 else ''}{weekly_change}점\n"
        f"✅ {top_platform}에서 가장 많이 언급됨\n"
        f"💡 {top_improvement}\n\n"
        f"자세한 분석 결과 보기 →"
    )
    await self._send_alimtalk(phone=phone, template_code="AEOLAB_SCAN_01", message=message)
```

---

### 4-6. AEO 인증 배지 발급 🟢

**우선순위:** 중간 (브랜드 자산)
**예상 구현 기간:** 2~3일
**조건:** AI 노출 점수 70점 이상

**설명:**
점수 70점 이상 사업장에 "AEOlab AI 최적화 인증" 배지를 발급.
배지를 웹사이트, 카카오채널, SNS 프로필에 삽입할 수 있는 코드 제공.

**백엔드 구현:**

`backend/routers/report.py`에 추가:
```python
@router.get("/badge/{biz_id}")
async def get_badge(biz_id: str):
    """인증 배지 SVG + 삽입 코드 반환"""
    score_data = await db.score_history.get_latest(biz_id=biz_id)
    biz = await db.businesses.get(biz_id=biz_id)

    if not score_data or score_data["total_score"] < 70:
        raise HTTPException(403, "점수 70점 이상인 사업장만 배지를 받을 수 있습니다")

    grade = score_data["grade"]
    issued_at = datetime.now().strftime("%Y.%m")

    # SVG 배지 생성
    svg_content = f"""
<svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="60" rx="8" fill="#0f172a"/>
  <text x="10" y="22" fill="#60a5fa" font-size="11" font-family="sans-serif" font-weight="bold">
    AEOlab 인증
  </text>
  <text x="10" y="40" fill="white" font-size="14" font-family="sans-serif" font-weight="bold">
    AI 검색 최적화 {grade}등급
  </text>
  <text x="10" y="55" fill="#94a3b8" font-size="9" font-family="sans-serif">
    {issued_at} · aeolab.co.kr
  </text>
</svg>
"""

    embed_code = f'<a href="https://aeolab.co.kr/share/{biz_id}"><img src="https://aeolab.co.kr/api/report/badge/{biz_id}.svg" alt="AEOlab AI 검색 인증 배지" width="200" height="60"></a>'

    return {
        "eligible": True,
        "grade": grade,
        "score": score_data["total_score"],
        "issued_at": issued_at,
        "svg_url": f"/api/report/badge/{biz_id}.svg",
        "embed_code": embed_code,
    }

@router.get("/badge/{biz_id}.svg", response_class=Response)
async def get_badge_svg(biz_id: str):
    """배지 SVG 파일 직접 반환"""
    # ... SVG 생성 후 반환
    return Response(content=svg_content, media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=86400"})
```

---

### 4-7. 키워드별 AI 노출 개별 추적 🟢

**우선순위:** 중간 (Pro 플랜 킬러 기능)
**예상 구현 기간:** 5~7일
**플랜 제한:** Pro+

**설명:** 현재 대표 쿼리 1개 → 사업장 등록 키워드(최대 5개)별로 개별 Gemini 100회 스캔.

**데이터베이스 변경:**

`scripts/supabase_schema.sql`에 추가:
```sql
-- 키워드별 노출 결과 테이블
CREATE TABLE keyword_scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biz_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scan_results(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    query_used TEXT NOT NULL,
    gemini_frequency INTEGER DEFAULT 0,  -- 100회 중 언급 횟수
    chatgpt_mentioned BOOLEAN DEFAULT FALSE,
    perplexity_mentioned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_keyword_scan_biz_id ON keyword_scan_results(biz_id, created_at DESC);
```

**백엔드 구현:**

`backend/services/ai_scanner/gemini_scanner.py` 확장:
```python
async def scan_by_keywords(
    self,
    business_info: dict,
    keywords: list[str],
    max_concurrent: int = 2
) -> list[dict]:
    """키워드별 100회 Gemini 스캔 (Pro 전용)"""
    sem = asyncio.Semaphore(max_concurrent)

    async def scan_keyword(keyword: str) -> dict:
        async with sem:
            query = f"{business_info['region']} {keyword} {business_info['name']}"
            result = await self.sample_100(query)
            return {
                "keyword": keyword,
                "query_used": query,
                "gemini_frequency": result["frequency"],
            }

    tasks = [scan_keyword(kw) for kw in keywords[:5]]  # 최대 5개 키워드
    return await asyncio.gather(*tasks)
```

---

### 4-8. 업종·지역 AI 트렌드 월간 리포트 🟢

**우선순위:** 낮음 (마케팅 자산)
**예상 구현 기간:** 3~5일

**설명:** 매월 1일, 업종별·지역별 AI 검색 트렌드를 집계하여 이메일/카카오톡으로 발송.

**백엔드 구현:**

`backend/scheduler/jobs.py`의 `monthly_market_news_job` 확장:
```python
async def monthly_market_news_job():
    """월간 AI 트렌드 리포트 생성 및 발송"""
    # 지난달 데이터 집계
    last_month_stats = await db.execute("""
        SELECT
            b.category,
            b.region,
            AVG(sh.total_score) as avg_score,
            COUNT(DISTINCT b.id) as business_count,
            AVG(sh.exposure_freq) as avg_exposure
        FROM score_history sh
        JOIN businesses b ON sh.biz_id = b.id
        WHERE sh.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY b.category, b.region
        ORDER BY avg_score DESC
    """)

    # Claude Haiku로 트렌드 인사이트 생성
    insight = await generate_trend_insight(last_month_stats)

    # 각 사업장에 맞춤 발송
    subscribers = await db.subscriptions.get_active()
    for sub in subscribers:
        biz = await db.businesses.get(user_id=sub["user_id"])
        relevant_stats = [s for s in last_month_stats
                         if s["category"] == biz["category"]]

        await kakao_notify.send_monthly_market_news(
            phone=sub["owner_phone"],
            biz_name=biz["name"],
            category=biz["category"],
            category_avg_score=relevant_stats[0]["avg_score"] if relevant_stats else None,
            trend_insight=insight,
        )
```

---

## 5. 구현 우선순위 로드맵

### Week 1 (즉시)
```
🔴 1. SSE 인증 구조 개선 (stream_token 방식)
       → backend/routers/scan.py + frontend/components/scan/ScanProgress.tsx

🔴 2. Playwright 동시 실행 Semaphore 제한
       → backend/services/ai_scanner/multi_scanner.py
       → backend/scheduler/jobs.py

🟠 3. content_freshness 실제 로직 구현
       → backend/services/score_engine.py

🟠 4. api.ts 누락 함수 12개 추가
       → frontend/lib/api.ts

🟠 5. 신규 사용자 빈 대시보드 처리
       → frontend/app/(dashboard)/dashboard/page.tsx
```

### Week 2~3 (단기)
```
🟡 6. Trial 페이지 전환율 개선 (카피 변경)
       → frontend/app/(public)/trial/page.tsx

🟡 7. 사업자번호 원클릭 자동완성
       → frontend/components/dashboard/RegisterBusinessForm.tsx

🟡 8. 경쟁사 추가 후 즉시 스캔 제안
       → frontend/app/(dashboard)/competitors/CompetitorsClient.tsx

🟡 9. 점수 등급 기준 툴팁
       → frontend/components/dashboard/ScoreCard.tsx

🟡 10. 가이드 생성 소요 시간 안내
        → frontend/app/(dashboard)/guide/GuideClient.tsx

🟢 11. 랜딩 페이지 샘플 결과 미리보기
        → frontend/app/(public)/page.tsx

🟢 12. 스캔 결과 즉시 카카오톡 전송
        → backend/routers/scan.py + backend/services/kakao_notify.py
```

### Month 1~2 (중기)
```
🟢 13. 업종 벤치마크 Fallback 로직
        → backend/routers/report.py

🟢 14. 공유 가능한 AI 성적표 (Share Card)
        → backend/routers/report.py + frontend/components/share/ShareButton.tsx
        → frontend/app/(public)/share/[bizId]/page.tsx (신규)

🟢 15. 경쟁사 점수 추월 알림
        → backend/scheduler/jobs.py + backend/services/kakao_notify.py

🟢 16. AI 언급 맥락 분석
        → backend/services/ai_scanner/gemini_scanner.py
        → backend/routers/report.py
        → frontend/app/(dashboard)/guide/MentionContextCard.tsx (신규)
```

### Month 3~6 (장기)
```
🟢 17. AEO 인증 배지 발급 시스템
        → backend/routers/report.py

🟢 18. 키워드별 AI 노출 개별 추적 (Pro)
        → backend/services/ai_scanner/gemini_scanner.py
        → scripts/supabase_schema.sql (테이블 추가)

🟢 19. 업종·지역 AI 트렌드 월간 리포트
        → backend/scheduler/jobs.py 확장

🟢 20. 스캔 중복 실행 방지
        → backend/routers/scan.py
```

---

## 부록: 영향도 요약

| # | 항목 | 분류 | 난이도 | 영향도 |
|---|------|------|--------|--------|
| 1 | SSE 인증 취약점 패치 | 🔴 보안 | 중 | 서비스 신뢰도 |
| 2 | Playwright 동시 실행 제한 | 🔴 안정성 | 하 | 서버 생존 |
| 3 | content_freshness 구현 | 🟠 정확성 | 중 | 점수 신뢰도 |
| 4 | api.ts 누락 함수 | 🟠 기능 | 하 | 기능 완성 |
| 5 | 신규 사용자 대시보드 처리 | 🟠 UX | 하 | 이탈 방지 |
| 6 | Trial 페이지 카피 개선 | 🟡 전환율 | 하 | 가입 전환 +30% |
| 7 | 사업자번호 자동완성 | 🟡 UX | 하 | 온보딩 마찰 감소 |
| 8 | 샘플 결과 미리보기 | 🟢 성장 | 하 | 전환율 +50% |
| 9 | 즉시 카카오톡 전송 | 🟢 리텐션 | 하 | 이탈률 감소 |
| 10 | 공유 카드 | 🟢 성장 | 중 | 바이럴 성장 |
| 11 | 경쟁사 역전 알림 | 🟢 리텐션 | 하 | 구독 유지 |
| 12 | AI 맥락 분석 | 🟢 차별화 | 중 | Pro 전환 |
| 13 | AEO 인증 배지 | 🟢 브랜드 | 중 | 브랜드 자산 |
| 14 | 키워드별 추적 | 🟢 차별화 | 상 | Pro 킬러 기능 |

---

*최종 업데이트: 2026-03-27 | AEOlab 개선과제 v1.0*
