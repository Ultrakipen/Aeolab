# 네이버 AI 브리핑 준수 기준 점검표 v1.1

> 새 대화창에서 이 문서를 참조해 점검을 실행한다. 기준은 네이버 실측·공식 공지 우선.
> 최종 업데이트: 2026-05-03 (v1.1 — Round 2 점검 결과 반영, "FAQ 등록" 표현 잔존 패턴 추가)

---

## 1. 업종 게이팅 (ACTIVE / LIKELY / INACTIVE / FRANCHISE)

### 1-1. 백엔드 단일 소스
| 파일 | 확인 항목 | 기준 |
|------|-----------|------|
| `backend/services/score_engine.py` | `BRIEFING_ACTIVE_CATEGORIES` (단일 정의) | `restaurant, cafe, bakery, bar, accommodation` (5개) |
| `backend/services/score_engine.py` | `BRIEFING_LIKELY_CATEGORIES` | `beauty, nail, pet, fitness, yoga, pharmacy` (6개) |
| `backend/services/score_engine.py` | `get_briefing_eligibility(category, is_franchise)` | 프랜차이즈이면 ACTIVE 업종도 `"inactive"` 반환 |
| `backend/services/briefing_engine.py` | (정의 없음 — score_engine에서 import 또는 동일 분류 사용) | — |

### 1-2. 프론트엔드 단일 소스
| 파일 | 확인 항목 | 기준 |
|------|-----------|------|
| `frontend/lib/userGroup.ts` | `BRIEFING_ACTIVE_CATEGORIES`, `getBriefingEligibility()`, `BriefingEligibility` 타입 | **단일 정의** (다른 파일은 import만) |
| `frontend/app/(dashboard)/dashboard/page.tsx` | `import { getBriefingEligibility } from "@/lib/userGroup"` | 로컬 정의 0건 |
| `frontend/app/(dashboard)/blog-analysis/BlogClient.tsx` 등 4파일 | 동일 import 사용 | 로컬 `const BRIEFING_ACTIVE` 0건 |
| `frontend/components/dashboard/IneligibleBusinessNotice.tsx` | 전체 메시지 | 부정 표현 0건, "ChatGPT·Gemini·Google AI" 대안 제시 |
| `frontend/components/dashboard/GlobalAIBanner.tsx` | `eligibility` prop 조건 | `"inactive"` 이면 globalScore 무관 항상 표시 |

### 1-3. 점검 명령 (grep)
```bash
grep -n "BRIEFING_ACTIVE_CATEGORIES" backend/services/briefing_engine.py backend/services/score_engine.py
grep -n "get_briefing_eligibility" backend/services/briefing_engine.py
grep -n "is_franchise" backend/services/briefing_engine.py
```

---

## 2. 스마트플레이스 Q&A 탭 폐기 컴플라이언스 (2026-05-01)

### 2-1. 금지 표현
| 금지 패턴 | 이유 |
|----------|------|
| `소식·Q&A → Q&A 등록` | 폐기된 메뉴 경로 |
| `스마트플레이스 Q&A에 FAQ 등록` | 폐기된 탭 참조 |
| `FAQ탭 → 질문 추가` | 폐기된 탭 경로 |
| `/qna` Playwright crawl 또는 deeplink | 폐기된 URL |
| `스마트플레이스 FAQ 등록` (사용자 노출) | 폐기된 메뉴 연상 — "소개글 Q&A 추가"로 통일 |
| `FAQ 등록`, `FAQ를 등록`, `FAQ 등록하러 가기` (사용자 노출) | 폐기된 메뉴 연상 — "소개글 Q&A 추가"로 통일 |
| `직접 인용합니다`, `직접 인용` (사용자 노출/단정) | 정직성 원칙 위반 — "인용 후보가 됩니다"로 톤다운 |

### 2-2. 허용 표현
| 허용 패턴 | 비고 |
|----------|------|
| `소개글 하단에 Q&A 추가` | 현재 유일한 사용자 직접 Q&A 경로 |
| `톡톡 채팅방 메뉴` | `partner.talk.naver.com` — 봇 응답 Q&A |
| `소개글 안의 Q&A 섹션` | AI 브리핑 인용 후보로 효과적 |

### 2-3. 점검 명령
```bash
# 폐기된 표현 검색 (FAIL 이면 수정 필요)
grep -rn "FAQ탭\|Q&A 탭\|소식·Q&A\|Q&A에 FAQ\|/qna" frontend/components frontend/app --include="*.tsx" --include="*.ts"

# v1.1 신규 — "FAQ 등록" 사용자 노출 잔존 검사 (0건이어야 함)
grep -rn "FAQ 등록\|FAQ를 등록\|FAQ에 등록\|스마트플레이스 FAQ" \
  frontend/app frontend/components frontend/lib backend/routers backend/services backend/scheduler \
  --include="*.tsx" --include="*.ts" --include="*.py"

# v1.1 신규 — "직접 인용" 단정 표현 잔존 검사 (briefing_engine.py 의도적 부정 외 0건)
grep -rn "직접 인용" backend/routers backend/services backend/scheduler frontend/lib --include="*.py" --include="*.ts"

# 백엔드 폐기 경로 확인
grep -n "qna\|_detect_faq\|faq_crawl" backend/services/naver_place_stats.py backend/services/briefing_engine.py
```

### 2-4. 점수 재배분 확인
| 항목 | 이전 | 현재 기준 |
|------|------|----------|
| `has_faq` 가중치 | 25점 | **0점** (컬럼 보존, 가중치만 0) |
| `has_recent_post` | 15점 | **25점** |
| `has_intro` | 10점 | **20점** |
| 합계 | 100점 | **100점** |

```bash
# score_engine.py에서 점수 합계 검증
grep -n "has_faq\|has_recent_post\|has_intro" backend/services/score_engine.py
```

---

## 3. 톡톡 채팅방 메뉴 명칭 (구 FAQ, 2024-02-14 개편)

### 3-1. 명칭 규칙
| 금지 | 대체 |
|------|------|
| `톡톡 FAQ` | `톡톡 채팅방 메뉴` |
| `talktalk_faq` (사용자 노출 텍스트) | 내부 DB 컬럼은 하위 호환으로 유지 가능 |

### 3-2. schemata 확인
```bash
grep -rn "톡톡 FAQ\b" frontend/components frontend/app --include="*.tsx"
grep -n "talktalk_faq_draft\|_compat_chat_menus\|normalizeChatMenus" backend/services/briefing_engine.py frontend/app
```

---

## 4. 네이버 AI 탭 (2026-04-27 베타 공개)

### 4-1. 표현 기준
| 이전 (잘못된) | 현재 기준 |
|--------------|----------|
| `2026년 AI 탭 신설 예정` | `네이버 AI 탭 — 2026-04-27 베타 공개됨` |
| `예정 업종 확대` | `베타 단계, 전 업종 대상 확대 진행 중` |

### 4-2. 점검 명령
```bash
grep -rn "AI 탭.*예정\|신설 예정" frontend/app --include="*.tsx"
grep -rn "2026-04-27\|AI 탭.*베타" frontend/app --include="*.tsx"
```

---

## 5. 별점 시스템 (2026-04-06 도입)

### 5-1. 기준
- 초기 3개월: 작성자 + 사업주만 열람 가능
- 3개월 후: 전체 이용자 공개 (어뷰징 방지 목적)
- 네이버 AI 브리핑은 단순 별점보다 **키워드 포함 구체 리뷰**를 선호

### 5-2. 점검
```bash
grep -n "star_rating\|별점\|초기 3개월\|어뷰징" frontend/app/\(public\)/how-it-works/page.tsx
```

---

## 6. INACTIVE 업종 가치 제안

### 6-1. 대시보드 체크리스트
- `frontend/components/dashboard/GlobalAIChecklist.tsx` — 5개 항목
- 대시보드 `page.tsx`에서 `eligibility === "inactive" && latestScan exists` 시 렌더

### 6-2. 확인
```bash
grep -n "GlobalAIChecklist\|eligibility.*inactive\|INACTIVE" frontend/app/\(dashboard\)/dashboard/page.tsx
```

---

## 7. 백엔드 gap_analyzer.py NON_LOCATION 컨텍스트

### 7-1. 기준
INACTIVE 업종의 `ScanContext.NON_LOCATION`에서 gap_reason 8개 차원 모두 글로벌 AI 중심 메시지를 보여야 함.

### 7-2. 확인
```bash
grep -n "NON_LOCATION\|non_location\|INACTIVE\|global_ai" backend/services/gap_analyzer.py | head -30
```

---

## 8. 프랜차이즈 게이팅

### 8-1. 기준
- 네이버 공식 정책: 프랜차이즈는 ACTIVE 업종이라도 AI 브리핑 제외
- `get_briefing_eligibility(category, is_franchise=True)` → `"inactive"`

### 8-2. 확인
```bash
grep -n "is_franchise" backend/services/briefing_engine.py frontend/app/\(dashboard\)/dashboard/page.tsx
```

---

## 9. 점수 모델 버전 동기화

### 9-1. DUAL_TRACK_RATIO (9개 업종별 네이버/글로벌 비율)
| 업종 | naver | global |
|------|-------|--------|
| restaurant | 0.70 | 0.30 |
| legal | 0.20 | 0.80 |
| shopping | 0.10 | 0.90 |

```bash
grep -n "DUAL_TRACK_RATIO\|naver_weight\|global_weight" backend/services/score_engine.py | head -15
```

### 9-2. GrowthStage 기준
- `track1_score` 기준 (unified 아님) — 업종별 비율 차이로 오판 방지

```bash
grep -n "GrowthStage\|growth_stage\|track1_score" backend/services/score_engine.py | head -10
```

---

## 10. 자주 발생하는 오류 패턴 (과거 사례)

| 오류 유형 | 발생 파일 | 확인 방법 |
|----------|----------|----------|
| beauty/nail을 ACTIVE로 잘못 분류 | CLAUDE.md, score_engine.py | grep BRIEFING_ACTIVE |
| "AI 탭 신설 예정" 구버전 텍스트 잔존 | how-it-works, CLAUDE.md | grep "신설 예정" |
| "FAQ탭 → 질문 추가" 폐기된 경로 | DualTrackCard, DailyMissionCard | grep "FAQ탭" |
| "스마트플레이스 Q&A에 등록" 폐기된 표현 | dashboard/page, AIDiagnosisCard | grep "Q&A에.*등록" |
| `if not biz:` Supabase 응답 오판 | 모든 백엔드 라우터 | grep "if not biz" |
| `has_faq * 25` 폐기된 점수 | naver_place_stats, score_engine | grep "has_faq \*" |
| `/qna` deeplink 사용자 노출 | naver_place_stats, report.py | grep '"/qna"' |
| "직접 인용함" 단정 표현 | guide_generator.py `_faq_missing_msg()` | grep "직접 인용" |
| 타입 주석에 Q&A 탭 참조 잔존 | types/diagnosis.ts, types/market.ts | grep "Q&A 등록 수" |

> **2026-05-03 코드리뷰 결과:** 위 패턴 전수 수정 완료. `guide_generator.py` line 54, `types/diagnosis.ts` line 58, `types/market.ts` line 30 포함.
> `calc_review_quality()` keyword_diversity 미반영 — INFO 수준. 사용자 노출 화면(`TrialResultStep.tsx` BREAKDOWN_INFO.review_quality.what)에 이미 키워드 리뷰 중요성 안내 포함됨.

---

## 11. Root flat 잔재 파일 점검 (v1.1 신규, 2026-05-03 사고 반영)

### 11-1. 사고 사례
2026-05-03 컴플라이언스 일괄 수정 후 deploy 에이전트가 잔존 패턴 6건을 보고했으나, 실제 파일들은 정답 경로(예: `backend/routers/report.py`, `backend/scheduler/jobs.py`)가 아닌 **미사용 잔재 파일**(예: `backend/services/report.py` 4월 17일 구버전, `backend/routers/jobs.py` 등)이었음. main.py의 `from routers import report`, `from scheduler.jobs import start_scheduler`가 정답 경로.

### 11-2. 점검 명령
```bash
# 서버에 정답 경로와 동일 이름 파일이 root flat 위치에 있는지 확인
ssh root@115.68.231.57 "find /var/www/aeolab/backend -name 'report.py' -o -name 'jobs.py' -o -name 'gap_analyzer.py' -o -name 'email_sender.py' -o -name 'scan.py' 2>/dev/null"

# 잔재 파일이 실제 import되는지 확인 (0건이어야 함)
ssh root@115.68.231.57 "cd /var/www/aeolab/backend && grep -rn 'from routers.gap_analyzer\|from routers.jobs\|from services.report\|from services.scan\|from services.ai_scanner.report\|from scheduler.email_sender' --include='*.py'"
```

### 11-3. 격리 절차 (사용 안 됨 확인 후)
```bash
ssh root@115.68.231.57 "cd /var/www/aeolab/backend && for f in <잔재파일>; do mv \$f \$f.deprecated_root_flat_$(date +%Y%m%d); done"
```

### 11-4. 격리된 파일 목록 (2026-05-03)
| 격리 전 | 정답 경로 | 격리 후 |
|---------|----------|--------|
| `backend/routers/gap_analyzer.py` | `backend/services/gap_analyzer.py` | `.deprecated_root_flat_20260503` |
| `backend/routers/jobs.py` | `backend/scheduler/jobs.py` | `.deprecated_root_flat_20260503` |
| `backend/services/report.py` | `backend/routers/report.py` | `.deprecated_root_flat_20260503` |
| `backend/services/scan.py` | `backend/routers/scan.py` | `.deprecated_root_flat_20260503` |
| `backend/services/ai_scanner/report.py` | `backend/routers/report.py` | `.deprecated_root_flat_20260503` |
| `backend/scheduler/email_sender.py` | `backend/services/email_sender.py` | `.deprecated_root_flat_20260503` |
| `frontend/components/landing/plans.ts` | `frontend/lib/plans.ts` | `.deprecated_root_flat_20260503` |

---

## 신규 대화창 시작 시 빠른 점검 스크립트

```bash
# 1. Q&A 탭 폐기 관련 위반 검색
grep -rn "FAQ탭\|Q&A 탭\|소식·Q&A\|Q&A에 FAQ\|has_faq \*" \
  frontend/components frontend/app backend/services --include="*.tsx" --include="*.ts" --include="*.py"

# 2. 구버전 AI 탭 표현
grep -rn "AI 탭.*예정\|신설 예정" \
  frontend/app --include="*.tsx"

# 3. beauty/nail ACTIVE 오분류
grep -n "BRIEFING_ACTIVE" backend/services/briefing_engine.py backend/services/score_engine.py

# 4. 프랜차이즈 게이팅 존재 확인
grep -n "is_franchise" backend/services/briefing_engine.py

# 5. 점수 합계 100점 확인
grep -n "NAVER_TRACK_WEIGHTS\|GLOBAL_TRACK_WEIGHTS" backend/services/score_engine.py
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-05-03 | v1.0 초안 작성 — Q&A 탭 폐기, AI 탭 베타, 별점 시스템, INACTIVE UX, 프랜차이즈 게이팅 기준 수록 |
| 2026-05-03 | v1.1 — Round 2 점검 결과 반영. §1-1/§1-2 단일 소스 위치 정정 (`score_engine.py` / `frontend/lib/userGroup.ts`). "FAQ 등록"·"직접 인용" 단정 표현 잔존 패턴 추가. backend·frontend 양쪽 35곳+ 사용자 노출 메시지를 "소개글 Q&A 추가"·"인용 후보"로 톤다운 완료 |
