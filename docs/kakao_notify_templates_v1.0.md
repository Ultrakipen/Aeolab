# 카카오 알림톡 템플릿 명세 v1.0

> 작성일: 2026-05-29 | 대상: AEOlab 핵심 알림톡 전체 (승인 5종 + 추가 6종)
> 2026-05-29 개선: 점수 수치 → 등급 텍스트 전환 (`_grade()` 헬퍼 적용)
> 관련 파일: `backend/services/kakao_notify.py`

---

## 0. 등급 텍스트 변환 기준 (2026-05-29 전환)

> 이전: `#{이전점수}` = `54.0`, `#{현재점수}` = `76.0` (숫자)
> 이후: `#{이전점수}` = `보통 · 업종 12위`, `#{현재점수}` = `양호 · 업종 5위` (텍스트)

| 점수 범위 | 등급 레이블 | 의미 |
|-----------|-------------|------|
| 80~100점 | **우수** | 업종 상위권, AI 노출 활발 |
| 60~79점 | **양호** | 평균 이상, 개선 여지 있음 |
| 40~59점 | **보통** | 업종 평균 수준 |
| 0~39점 | **개선 필요** | 즉각 조치 권장 |

**헬퍼 함수 (`kakao_notify.py` 상단):**
```python
def _grade(score: float) -> str          # 점수 → 등급
def _grade_label(score, rank=0) -> str   # "양호 · 업종 5위"
def _grade_change(prev, curr) -> str     # "↑ 보통 → 양호 한 단계 성장!"
```

---

## 1. 승인 완료 템플릿 5종

> 카카오 비즈센터 승인 완료 (2026-04-24). 템플릿 문안 변경 시 재심사 필요.
> 변수값 내용은 코드에서 자유롭게 변경 가능 (재심사 불필요).

---

### AEOLAB_SCORE_01 — AI 노출 등급 변화 알림

**발송 시점:** 주간 스캐너 실행 후 등급 또는 순위 변화 감지 시  
**담당 메서드:** `send_score_change(phone, biz_name, prev, curr, prev_r, curr_r)`  
**발송 트리거:** `scheduler/jobs.py` → `weekly_score_check_job`

**템플릿 변수:**

| 변수 | 전달값 (개선 후) | 예시 |
|------|-----------------|------|
| `#{사업장명}` | 사업장명 | 홍길동식당 |
| `#{이전점수}` | `_grade_label(prev, prev_r)` | 보통 · 업종 12위 |
| `#{현재점수}` | `_grade_label(curr, curr_r)` | 양호 · 업종 5위 |
| `#{변화}` | `_grade_change(prev, curr)` | ↑ 보통 → 양호 한 단계 성장! |
| `#{이전순위}` | prev_r (int) | 12 |
| `#{현재순위}` | curr_r (int) | 5 |

**메시지 예시 (Before → After):**
```
[개선 전]
[AEOlab] 홍길동식당
AI 노출 점수가 변동했습니다.
이전: 54.0점 / 현재: 76.0점
변화: ↑22.0

[개선 후]
[AEOlab] 홍길동식당
AI 노출 등급이 올랐습니다!
이전: 보통 · 업종 12위
현재: 양호 · 업종 5위
변화: ↑ 보통 → 양호 한 단계 성장!
```

**이메일 fallback:** 카카오 발송 실패 시 `EMAIL_TEMPLATES["AEOLAB_SCORE_01"]`로 자동 대체

---

### AEOLAB_CITE_01 — AI 인용 실증 알림

**발송 시점:** 네이버 AI 브리핑 / ChatGPT / Gemini에서 처음으로 인용 감지 시  
**담당 메서드:** `send_ai_citation(phone, biz_name, platform, query, excerpt)`  
**발송 트리거:** `scheduler/jobs.py` → `ai_citation_check_job`

**템플릿 변수:**

| 변수 | 전달값 | 예시 |
|------|--------|------|
| `#{사업장명}` | 사업장명 | 홍길동식당 |
| `#{AI플랫폼}` | 플랫폼명 | 네이버 AI 브리핑 |
| `#{검색어}` | 검색 쿼리 | 강남 맛집 추천 |
| `#{인용내용}` | 인용 발췌 (최대 50자) | 분위기 좋고 가성비... |

**메시지 예시:**
```
[AEOlab] 홍길동식당

네이버 AI 브리핑에서 내 가게가 인용됐습니다!

검색어: "강남 맛집 추천"
인용 내용: 분위기 좋고 가성비 최고인 맛집으로...

대시보드에서 전체 인용 내역 확인하기 →
```

**재활용:** `send_first_exposure()` — 처음 AI 노출 시 이 템플릿 재사용

---

### AEOLAB_COMP_01 — 경쟁사 순위 변화 알림

**발송 시점:** 경쟁사가 내 가게 순위를 추월하거나 격차가 크게 변화할 때  
**담당 메서드:** `send_competitor_change(phone, biz_name, comp_name, rank_change)`  
**발송 트리거:** `scheduler/jobs.py` → `competitor_monitor_job`

**템플릿 변수:**

| 변수 | 전달값 | 예시 |
|------|--------|------|
| `#{사업장명}` | 사업장명 | 홍길동식당 |
| `#{경쟁사명}` | 경쟁사명 | 김길동식당 |
| `#{순위변화}` | 순위 변화폭 (int) | 3 |

---

### AEOLAB_NEWS_01 — 시장 동향 뉴스 알림

**발송 시점:** 월간 시장 뉴스 생성 후 (월 1회)  
**담당 메서드:** `send_market_news(phone, biz_name, category, news)`  
**발송 트리거:** `scheduler/jobs.py` → `monthly_market_news_job`

**템플릿 변수:**

| 변수 | 전달값 | 예시 |
|------|--------|------|
| `#{사업장명}` | 사업장명 | 홍길동식당 |
| `#{업종}` | 업종 한글명 | 음식점 |
| `#{시장동향}` | 시장 동향 요약 (최대 100자) | 이번 달 강남구 음식점... |

---

### AEOLAB_ACTION_01 — 이달 할 일 알림

**발송 시점:** 주간 할 일 목록 생성 후 / 소식 14일 미작성 감지 시  
**담당 메서드:** `send_action_items(phone, biz_name, items)`  
**재활용:** `send_post_remind()` — 소식 미작성 경고로 재사용  
**발송 트리거:** `scheduler/jobs.py` → `weekly_action_remind_job`, `inactive_post_alert_job`

**템플릿 변수:**

| 변수 | 전달값 | 예시 |
|------|--------|------|
| `#{사업장명}` | 사업장명 | 홍길동식당 |
| `#{할일목록}` | 최대 3개 항목 (bullet) | • 소식 1건 등록 권장\n• 사진 3장 추가 |

---

## 2. 추가 운영 템플릿 6종

> 카카오 비즈센터 신청 완료 또는 AEOLAB_NOTICE_01 재활용. 별도 환경변수 필요.

---

### AEOLAB_COMP_02 — 경쟁사 역전 긴급 알림

**담당 메서드:** `send_competitor_overtake(phone, biz_name, comp_name, my_score, comp_score, gap)`

**메시지 예시 (개선 후):**
```
[AEOlab] 홍길동식당

경쟁사 '김길동식당'이(가) AI 검색에서 앞섰습니다!

내 등급: 양호
김길동식당: 우수 (차이: 12점)

지금 바로 개선 가이드를 확인하고 역전하세요.
```

---

### AEOLAB_SCAN_01 — 스캔 완료 즉시 알림

**담당 메서드:** `send_scan_complete(phone, biz_name, score, grade, weekly_change, top_platform, top_improvement)`

**메시지 예시 (개선 후):**
```
[AEOlab] 홍길동식당 AI 스캔 완료

📊 AI 노출 등급: 양호 (보통 → 양호)
📈 지난주 대비: ↑ 보통 → 양호 한 단계 성장!
✅ 네이버 AI 브리핑에서 가장 많이 언급됨
💡 소개글 Q&A에 '주차 가능' 키워드 추가 권장

aeolab.co.kr 에서 자세한 결과 확인
```

---

### AEOLAB_ALERT_01 — 별점 2점 이하 리뷰 긴급 알림

**담당 메서드:** `send_low_rating_alert(phone, biz_name, rating, review_excerpt)`  
**환경변수:** `KAKAO_APP_KEY` 필요 (미설정 시 skip)

**메시지 예시:**
```
[AEOlab] 홍길동식당

별점 2점 리뷰가 등록됐습니다.

내용: 음식이 너무 짜고 서비스가...

빠른 답변으로 신뢰를 지키세요.
스마트플레이스에서 답변하기 →
```

---

### AEOLAB_MONTHLY_01 — 월간 성장 리포트

**담당 메서드:** `send_monthly_report(phone, biz_name, score_change, scan_count, citation_count, month_str)`

**메시지 예시:**
```
[AEOlab] 5월 성장 리포트
사업장: 홍길동식당

📊 AI 가시성 점수: +8.5점
🔍 스캔 횟수: 4회
💬 AI 인용: 12건

전체 리포트 보기 →
https://aeolab.co.kr/dashboard
```

> **TODO (개선 예정):** 점수 변화폭도 등급 전환 여부로 표기. `score_change: +8.5` → `보통 → 양호 (8.5점 상승)` 형식.

---

### AEOLAB_GROWTH_01 — 성장 단계 업그레이드 알림

**담당 메서드:** `send_growth_stage_upgrade(phone, biz_name, prev_stage, curr_stage, track1_score)`  
**특이사항:** AEOLAB_SCORE_01 재활용 — `#{이전점수}`에 "생존기", `#{현재점수}`에 "성장기" 전달

**메시지 예시:**
```
[AEOlab] 홍길동식당

AI 노출 단계가 올랐습니다!
이전: 생존기 → 현재: 안정기
변화: ↑ 생존기 → 안정기 단계 상승!
```

---

### AEOLAB_NOTICE_01 — 공지 / 결제 / 시스템 알림 (다목적)

**재활용 메서드:**
- `send_expire_warning()` — 구독 만료 D-7
- `send_payment_failed()` — 자동결제 실패
- `send_suspended()` — 서비스 정지
- `send_notice()` — 관리자 공지
- `send_gap_card_url()` — 주간 갭 카드 PNG 공유
- `send_weekly_score_report()` — 주간 성적표 (AEOLAB_SCORE_01 대신 재활용)
- `send_v31_migration()` — 점수 모델 v3.1 전환 안내

---

## 3. 대기 중 템플릿 (비즈센터 신청 전)

| 템플릿 키 | 환경변수 | 상태 | 담당 메서드 |
|-----------|----------|------|-------------|
| `AEOLAB_KW_01` | `KAKAO_TEMPLATE_KEYWORD_CHANGE` | 미설정 → graceful skip | `send_keyword_change()` |
| `AEOLAB_DELIVERY_01~04` | `KAKAO_TEMPLATE_DELIVERY_01~04` | 별도 문서 참조 | `send_delivery_*()` |

> 관련 문서: `docs/kakao_delivery_templates_v1.0.md`

---

## 4. 향후 재신청 권장 템플릿 개선안

> 현재는 변수값에 텍스트를 전달해 우회하고 있음. 근본적으로 템플릿 문안 자체를 개선하면 더 자연스러운 메시지 전달 가능.

### AEOLAB_SCORE_01 개선 문안 (재신청 시)

**현재 문안 (추정):**
```
[AEOlab] #{사업장명}
AI 노출 점수가 변동했습니다.
이전: #{이전점수} / 현재: #{현재점수}
변화: #{변화}
```

**개선 문안 (재신청 권장):**
```
[AEOlab] #{사업장명}

이번 주 AI 노출 등급이 변동됐습니다.

이전 등급: #{이전등급}
현재 등급: #{현재등급}
변화 요약: #{변화요약}

대시보드에서 자세한 분석과 개선 가이드를 확인하세요.
https://aeolab.co.kr/dashboard
```

**변수 변경:**
- `#{이전점수}` → `#{이전등급}` (예: "보통 · 업종 12위")
- `#{현재점수}` → `#{현재등급}` (예: "양호 · 업종 5위")
- `#{변화}` → `#{변화요약}` (예: "한 단계 성장 ↑")
- `#{이전순위}`, `#{현재순위}` 제거

### AEOLAB_SCAN_01 개선 문안 (재신청 시)

**개선 문안:**
```
[AEOlab] #{사업장명} AI 스캔 완료

AI 노출 등급: #{현재등급}
지난주 대비: #{등급변화}
주목할 채널: #{주목채널}
이번 주 할 일: #{개선액션}

자세한 결과 보기 → https://aeolab.co.kr/dashboard
```

---

## 5. 발송 이력 조회

모든 발송 이력은 `notifications` 테이블에 기록됨.

```sql
-- 최근 알림톡 발송 이력 조회
SELECT type, content, channel, status, created_at
FROM notifications
WHERE channel IN ('kakao', 'email_fallback')
ORDER BY created_at DESC
LIMIT 50;

-- 실패 건수 확인
SELECT type, COUNT(*) as fail_count
FROM notifications
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY type;
```

---

## 6. 운영 체크리스트

### 알림톡 발송 환경변수

| 변수명 | 필수 | 용도 |
|--------|------|------|
| `KAKAO_APP_KEY` | ✅ | NHN Cloud 앱키 |
| `KAKAO_SENDER_KEY` | ✅ | 채널 발신 프로필 키 |
| `KAKAO_SECRET_KEY` | ✅ | API 시크릿 키 |
| `KAKAO_REST_API_KEY` | ✅ | REST API 키 |
| `KAKAO_TEMPLATE_KEYWORD_CHANGE` | ⬜ | 키워드 변동 알림 (비즈센터 승인 후) |
| `KAKAO_TEMPLATE_DELIVERY_01~04` | ⬜ | 대행 서비스 알림 (비즈센터 승인 후) |

### 실결제 전환 시 주의사항

- 현재 테스트 모드 (`test_` 키)에서도 카카오 알림톡은 실제 발송됨
- 발송 과금 여부는 NHN Cloud 대시보드에서 확인
- 실결제 전환(`TOSS_SECRET_KEY` live_ 교체) 전 알림톡 발송량 확인 권장

---

*최종 업데이트: 2026-05-29 | 점수 수치 → 등급 텍스트 전환 적용 + 전체 템플릿 명세 문서화*
