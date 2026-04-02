# AEOlab 다음 작업 문서 — 추천 기능 구현 가이드

> 작성일: 2026-03-31 | v1.1 업데이트: 2026-03-31 (현황 오류 수정 + 8개 기능 전체 구현 완료)
> 새 대화창에서 이 파일을 읽고 바로 확인 가능

---

## 전제 조건 (새 대화창에서 반드시 확인)

- **서버**: `root@115.68.231.57`, SSH 키 `~/.ssh/id_ed25519`
- **서버 경로**: `/var/www/aeolab/`
- **로컬 경로**: `C:/app_build/aeolab/`
- **작업 순서**: 서버에서 직접 수정 → `npm run build` → `pm2 restart aeolab-frontend` → 로컬 scp 동기화
- **테스트 URL**: https://aeolab.co.kr

---

## 직전 대화 완료 사항 (갭 8개 수정)

| 파일 | 수정 내용 |
|------|-----------|
| `frontend/app/(public)/trial/page.tsx` | 추정치 안내 배너 + 예비 창업자 모드 토글 |
| `frontend/components/dashboard/RegisterBusinessForm.tsx` | Place ID collapsible (접기/펼치기) |
| `frontend/app/(dashboard)/dashboard/page.tsx` | 가이드 CTA 버튼 + 2~4주 효과 안내 + TOP5 랭킹 카드 |
| `frontend/app/(dashboard)/competitors/page.tsx` | 경쟁사 키워드 3-패널 (빨강/초록/파랑) |
| `frontend/types/gap.ts` | ReviewKeywordGap, GrowthStageInfo 타입 추가 |

---

## 추가 구현 목록 (우선순위순)

---

### [즉시-1] 무료 체험 팔로업 이메일 시퀀스 ✅ 구현 완료

**목적**: 무료 체험 후 수집된 이메일을 활용해 유료 전환율 향상
**구현 파일**:
- `backend/services/email_sender.py` — Resend API 기반 3단계 HTML 이메일
- `backend/scheduler/jobs.py` — `trial_followup_job()` (매일 오전 10시)
  - 원자적 UPDATE(WHERE followup_sent_N = FALSE)로 중복 발송 방지
- `backend/requirements.txt` — `resend==2.4.0` 추가

**운영 환경 필수 설정**:
```env
# backend/.env에 추가
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@aeolab.co.kr
```

**Supabase SQL (미실행 시 실행 필요)**:
```sql
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS followup_sent_1 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_3 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_7 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;
```

---

### [즉시-2] 공유 버튼 대시보드 노출 ✅ 구현 완료

**목적**: 바이럴 유입 — 소상공인이 카카오톡으로 분석 결과 공유
**현황 정정**: 백엔드 `/api/report/share/{biz_id}` + `/api/report/share-card/{biz_id}` API는 기존 구현됨.
프론트 `/share/{bizId}` 페이지는 이번에 신규 구현함 (기존에는 없었음).

**구현 파일**:
- `frontend/app/(public)/share/[bizId]/page.tsx` — 신규 공유 페이지 (OG 메타 포함)
- `frontend/app/(dashboard)/dashboard/page.tsx` — 헤더에 "결과 공유" 버튼 추가

---

### [즉시-3] 리뷰 답변 인박스 ✅ 구현 완료

**목적**: 소상공인이 매주 반복 사용하는 실용 기능 → 이탈 방지
**플랜 한도**: Basic/Startup 10회, Pro 30회, Biz/Enterprise 무제한 (가이드와 별도 카운터)

**구현 파일**:
- `backend/middleware/plan_gate.py` — `review_reply_monthly` 한도 추가 + `check_review_reply_limit()` 함수
- `backend/routers/guide.py` — `POST /api/guide/review-reply`, `GET /api/guide/{biz_id}/review-replies`
- `frontend/app/(dashboard)/review-inbox/page.tsx` — 신규 페이지
- `frontend/app/(dashboard)/layout.tsx` — NAV_ITEMS에 "리뷰 답변 생성" 추가

**Supabase SQL**:
```sql
CREATE TABLE IF NOT EXISTS review_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  review_text TEXT NOT NULL,
  reply_draft TEXT NOT NULL,
  sentiment VARCHAR(20),
  keywords_used TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_replies_biz ON review_replies(business_id, created_at DESC);
```

---

### [중기-4] 리뷰 유도 QR 코드 이미지 생성 ✅ 구현 완료

**목적**: 오프라인 매장 카운터에 붙이는 실물 QR 카드
**순서 주의**: [중기-6] 이후 구현 권장 (naver_place_url 의존), naver_place_url 없을 시 네이버 검색 URL 자동 fallback

**구현 파일**:
- `backend/services/qr_generator.py` — Pillow + qrcode A6 카드 생성
- `backend/routers/guide.py` — `GET /api/guide/{biz_id}/qr-card`
- `backend/requirements.txt` — `qrcode[pil]==7.4.2` 추가
- `frontend/app/(dashboard)/guide/GuideClient.tsx` — QuickToolsSection에 다운로드 버튼

**서버 패키지 설치**:
```bash
pip install resend==2.4.0 qrcode[pil]==7.4.2
```

---

### [중기-5] 소식(포스팅) 주간 자동 초안 ✅ 구현 완료

**목적**: AI 브리핑 최신성 점수 유지 자동화
**구현 파일**:
- `backend/scheduler/jobs.py` — `weekly_post_draft_job()` (매주 월요일 오전 9시)
  - Claude Haiku로 업종별 소식 초안 생성 → `guides(context='post_draft')` 저장
  - 카카오 알림: "이번 주 소식 초안이 준비됐습니다"
- `frontend/app/(dashboard)/guide/GuideClient.tsx` — `WeeklyPostDraftSection` 컴포넌트 추가

---

### [중기-6] 스마트플레이스 실제 완성도 자동 체크 ✅ 구현 완료

**목적**: 사용자 수동 체크박스를 자동화 → Track1 점수 정확도 향상
**구현 파일**:
- `backend/services/naver_place_stats.py` — `check_smart_place_completeness()` 추가
- `backend/routers/scan.py` — `_run_full_scan`에서 `naver_place_url` 있으면 자동 체크 병렬 실행
- `frontend/components/dashboard/RegisterBusinessForm.tsx` — 고급 설정에 `naver_place_url` 입력 필드 추가

**Supabase SQL**:
```sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS naver_place_url TEXT,
  ADD COLUMN IF NOT EXISTS smart_place_auto_checked_at TIMESTAMPTZ;

ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS smart_place_completeness_result JSONB;
```

---

### [장기-7] 경쟁사 신규 등장 알림 UI ✅ 구현 완료

**현황 정정**: `detect_new_competitors()`는 이미 완전 구현됨 + 카카오 알림(`send_text`)도 이미 연결됨.
이번에 미구현이었던 **프론트 인앱 알림 배너**만 추가함.

**구현 파일**:
- `frontend/components/dashboard/NewCompetitorAlert.tsx` — 신규 dismissible 배너 (로딩 상태 포함)
- `frontend/app/(dashboard)/dashboard/page.tsx` — 대시보드에 통합

---

### [장기-8] 월간 성장 스토리 카드 ✅ 구현 완료

**목적**: "이달에 N점 올랐어요" SNS 공유 카드 → 바이럴
**구현 파일**:
- `backend/scheduler/jobs.py` — `monthly_growth_card_job()` (매월 말일 오후 6시)
  - score_history에서 이달 첫날 vs 마지막 날 점수 비교
  - 상승폭 있을 때만 Pillow로 1080×1080 카드 생성
  - Supabase Storage `before-after/growth/{biz_id}/{date}.png` 저장
  - 카카오 알림: "이달 AI 점수 +N점 상승! 성장 카드를 확인하세요"

---

## 기존 구현 완료 (문서에 누락됐던 항목)

| 잡 함수 | 실행 주기 | 내용 |
|---------|---------|------|
| `keyword_alert_job` | 매일 오전 8시 | ai_citations 신규 키워드 출현 감지 → 카카오 알림 |
| `detect_new_competitors` + 카카오 알림 | 매주 월요일 오전 4시 30분 | 이미 완전 구현됨 |

---

## 데이터베이스 추가 사항 (Supabase SQL Editor에서 실행)

```sql
-- [즉시-1] 팔로업 이메일 추적
ALTER TABLE trial_scans
  ADD COLUMN IF NOT EXISTS followup_sent_1 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_3 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_7 BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

-- [즉시-3] 리뷰 답변 기록
CREATE TABLE IF NOT EXISTS review_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  review_text TEXT NOT NULL,
  reply_draft TEXT NOT NULL,
  sentiment VARCHAR(20),
  keywords_used TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_replies_biz ON review_replies(business_id, created_at DESC);

-- [중기-6] 스마트플레이스 URL + 자동 체크 결과
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS naver_place_url TEXT,
  ADD COLUMN IF NOT EXISTS smart_place_auto_checked_at TIMESTAMPTZ;

ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS smart_place_completeness_result JSONB;
```

---

## 환경변수 추가 (서버 /var/www/aeolab/backend/.env)

```env
# [즉시-1] 팔로업 이메일
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@aeolab.co.kr
```

---

## 서버 패키지 설치

```bash
# SSH 접속 후:
cd /var/www/aeolab/backend
source venv/bin/activate
pip install resend==2.4.0 qrcode[pil]==7.4.2
pm2 restart aeolab-backend
```

---

## 구현 체크리스트

### 코드 구현 (완료)
- [x] [즉시-1] 팔로업 이메일 시퀀스 (`email_sender.py` + `trial_followup_job`)
- [x] [즉시-2] 공유 버튼 노출 + 공유 페이지 신규 생성
- [x] [즉시-3] 리뷰 답변 인박스 (엔드포인트 + 프론트 페이지 + plan_gate)
- [x] [중기-4] QR 코드 이미지 생성 + 다운로드 버튼
- [x] [중기-5] 소식 자동 초안 (`weekly_post_draft_job` + GuideClient)
- [x] [중기-6] 스마트플레이스 자동 체크 (`check_smart_place_completeness` + scan.py + RegisterBusinessForm)
- [x] [장기-7] 경쟁사 알림 UI (`NewCompetitorAlert.tsx`)
- [x] [장기-8] 월간 성장 카드 (`monthly_growth_card_job`)

### 서버 배포 필수 작업
- [ ] Supabase SQL Editor에서 위 SQL 4개 실행
- [ ] 서버 `pip install resend qrcode[pil]`
- [ ] 서버 `backend/.env`에 `RESEND_API_KEY`, `FROM_EMAIL` 추가
- [ ] `pm2 restart aeolab-backend`
- [ ] `npm run build && pm2 restart aeolab-frontend`
- [ ] https://aeolab.co.kr/guide → QR 다운로드 동작 확인
- [ ] https://aeolab.co.kr/review-inbox → 리뷰 답변 생성 동작 확인
- [ ] https://aeolab.co.kr/share/{bizId} → 공유 페이지 확인

---

## 참고: 현재 플랜별 기능 한도

| 항목 | free | basic | startup | pro | biz | enterprise |
|------|------|-------|---------|-----|-----|------------|
| 사업장 | 1 | 1 | 1 | 1 | 5 | 20 |
| 경쟁사 | 0 | 3 | 10 | 10 | 999 | 999 |
| 가이드/월 | 0 | 1 | 5 | 5 | 20 | 999 |
| 수동스캔/일 | 0 | 1 | 3 | 5 | 999 | 999 |
| 리뷰 답변/월 | 0 | 10 | 10 | 30 | 999 | 999 |

---

*최종 업데이트: 2026-03-31 v1.1 — 8개 기능 전체 구현 완료*
*참조 문서: CLAUDE.md, docs/model_engine_v3.0.md*
