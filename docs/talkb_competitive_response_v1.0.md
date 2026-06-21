# TalkB 경쟁 대응 — 기술 구현 & 안내문 개선 런북 v1.1

> 작성일: 2026-06-21 | 업데이트: 2026-06-21 v1.1 (오판 수정 + §1~§2 구현 완료 반영)
> 경쟁사: https://talkb.co.kr/
> 새 대화창 트리거: `"docs/talkb_competitive_response_v1.0.md 기준으로 경쟁 대응 작업 진행"`

---

## §0. 배경 & 결정 사항

- **Perplexity 재도입 안 함** (명시적 결정, 번복 금지)
- TalkB = 요식업 전담 글로벌 AI 대행 (ChatGPT·Gemini·Perplexity·Claude), 네이버 없음
- AEOlab 해자 = 네이버 AI 브리핑·AI탭 통합 측정 + ₩9,900 대중 시장
- "80% 유입" 수치 사용 금지 — 근거 없는 자체 추정. "주요 유입 채널"로 표현
- "유일한 서비스" 표현 금지 — 사실 검증 불가, 법적 위험. 대신 "함께 측정하는 서비스는 드뭅니다" 사용

---

## §1. ✅ 완료 — 즉시 (코드 수정 없음)

### §1-A. 채널별 성과 소요 기간 안내문 — ✅ 이미 구현됨 (런북 오판)

> **오판 수정 (2026-06-21):** 런북에 "추가 필요"라고 기재됐으나 이미 구현됨.
- `how-it-works/page.tsx:455~525` — `#channel-speed` 섹션 상세 구현
- `TrialResultStep.tsx:1062~1071` — "📅 채널별 반영 예상 기간" 섹션
- `GuideClient.tsx:329` — 채널별 소요 기간 명시

→ **추가 작업 불필요.**

### §1-B. FAQ 차별화 Q&A — ✅ 구현·배포 완료 (2026-06-21)

**파일:** `frontend/components/landing/FAQSection.tsx`

추가된 항목:
```
Q: 다른 AI 노출 관리 서비스와 어떻게 다른가요?
A: 국내 다른 AI 노출 서비스들은 ChatGPT·Gemini 등 글로벌 AI만 측정합니다.
   AEOlab은 한국 소상공인의 핵심 채널인 네이버 AI 브리핑·AI탭을 함께 측정하는 서비스입니다.
   ① 네이버 AI 브리핑·AI탭 포함 ② 월 9,900원 셀프서비스
```

---

## §2. ✅ 완료 — 이번 주 (경량 코드 수정)

### §2-A. 홈페이지 차별화 카피 — ✅ 구현·배포 완료 (2026-06-21)

**파일 1:** `frontend/components/landing/ChatGPTCompareSection.tsx`
- 비교 테이블 최상단에 "측정 채널" 행 추가: "ChatGPT·Gemini만" vs "네이버 AI + 글로벌 통합"
- 부제목에 "ChatGPT·Gemini만 측정하는 다른 서비스와 달리, 네이버 AI까지 함께 다룹니다" 추가

**파일 2:** `frontend/components/landing/AEOCompareSection.tsx`
- 기존 녹색 배너 아래 파란색 배너 추가:
  "🎯 ChatGPT·Gemini만 측정하는 서비스와 다릅니다 — AEOlab은 네이버 AI와 글로벌 AI를 함께 측정합니다"

### §2-B. 스캔 결과 화면에 쿼리 라이브러리 노출 — 🔄 백엔드 완료, 프론트 보류

**백엔드 완료 (2026-06-21):**
- `backend/routers/scan.py:1045` — `_trial_scan_queries = _build_ai_scan_queries(req.region or "", keyword_ko)` 추가
- `backend/routers/scan.py:1085` — `"scan_queries": _trial_scan_queries` 응답 필드 추가
- `frontend/types/index.ts` — `scan_queries?: string[]` 타입 추가

**프론트 보류:**
- `TrialResultStep.tsx` — `QueryLibraryAccordion` 컴포넌트 추가 필요 (다른 창 작업 완료 후 병합)
- 구현 코드 (이미 작성됨, 병합 대기):
  ```tsx
  function QueryLibraryAccordion({ queries }: { queries: string[] }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-4">
        <button type="button" onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors">
          <span className="text-sm font-semibold text-slate-700">측정에 사용된 질문 보기 ({queries.length}가지)</span>
          <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-slate-100 bg-slate-50">
            {queries.map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="shrink-0 text-slate-400">•</span>
                <span className="break-keep">"{q}"</span>
              </div>
            ))}
            <p className="text-xs text-slate-400 mt-2 leading-relaxed break-keep">
              무료 체험에서는 위 첫 번째 질문 1개로 5회 측정합니다.
              구독 시 모든 변형으로 50~100회 측정합니다.
            </p>
          </div>
        )}
      </div>
    );
  }
  ```
- 삽입 위치 (TrialResultStep.tsx): 채널별 반영 기간 블록 다음, LockedScoreCard 직전
  ```tsx
  {result.scan_queries && result.scan_queries.length > 0 && (
    <QueryLibraryAccordion queries={result.scan_queries} />
  )}
  ```

---

## §3. 다음 단계 (BEP 전 완료 목표)

### §3-A. llms.txt 자동 생성 엔드포인트

**목적:** TalkB가 수동으로 설정하는 것을 자동화 → 차별점

**백엔드 구현:**
```python
# backend/routers/guide.py 에 추가
@router.get("/{biz_id}/llms-txt", response_class=PlainTextResponse)
async def generate_llms_txt(biz_id: str, ...):
    # 사업장명 + 업종 + 키워드 + 소개글 → llms.txt 형식
    # Content-Type: text/plain; charset=utf-8
```

**프론트엔드:**
- 가이드 페이지에 "llms.txt 다운로드" 버튼 (Basic+ 게이트)
- 설명: "AI가 내 사업장 정보를 더 잘 읽을 수 있도록 합니다"

**플랜 게이트:** Basic+

---

## §4. 보류 항목 (BEP 달성 후)

| 항목 | 이유 |
|------|------|
| Perplexity 측정 재도입 | **명시적 결정: 추가 안 함** |
| 월간 리포트 Basic 제공 | BEP 후 수익 구조 안정화 후 검토 |
| 프랜차이즈 본사 B2B 대시보드 | 구독자 100명 이후 과제 |

---

## §5. 잔여 작업 순서

```
1단계 [완료]: §1-B FAQ + §2-A 홈페이지 카피 + §2-B 백엔드 — scp 배포 완료
2단계 [보류]: §2-B 프론트 UI — TrialResultStep.tsx 다른 창 작업 완료 후 병합
3단계 [미착수]: §3-A llms.txt — 백엔드+프론트 병렬
```

**§2-B 재개 명령 (다른 창 작업 완료 후):**
```
docs/talkb_competitive_response_v1.0.md §2-B QueryLibraryAccordion을 TrialResultStep.tsx 최신 서버 버전에 병합해줘
```

---

## §6. 전문가 추가 개선 제안 (런북 v1.1 신규)

> TalkB 분석에서 우리가 아직 활용 못 한 대응 포인트 3가지

### §6-A. TalkB "25문항 고정 실측 투명성" 대응
- TalkB는 "동일 25문항으로 월간 실측"을 신뢰 자산으로 사용
- 우리 대응: `scan_queries`를 결과에 노출(§2-B)하면 "이 {N}가지 질문으로 측정했습니다" 투명성 제공
- 추가 가능: 매주 동일 쿼리 반복 측정 → "지난주 대비 변화" 강조 (이미 구현됨, 마케팅 미활용)

### §6-B. TalkB "채널 진화 내러티브" 벤치마킹
- TalkB: "블로그 2010→SNS 2014→유튜브 2017→AI 검색 2026 지금 자리 비어있음"
- 우리도 유사 긴급성 카피 강화 가능 — how-it-works 또는 히어로 섹션에 추가

### §6-C. 가격 비교 업데이트 주기
- TalkB 얼리버드(₩24,500) 종료 시 격차가 ₩14,600→₩39,100으로 커짐
- 가격 비교 시 항상 현재 TalkB 정상가(₩49,000) 기준 사용

---

*작성: 2026-06-21 v1.0 | v1.1 업데이트: 2026-06-21 — 오판 §1-A 수정, §1-B/§2-A/§2-B 백엔드 완료 반영, §6 전문가 추가 제안 신설*
*TalkB 분석 원본: docs/competitor_talkb_analysis_v1.0.md*
