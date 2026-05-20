# 상업 서비스 출시 전 점검 수정 런북 v1.0

> 작성일: 2026-05-19
> 근거: `docs/commercial_launch_inspection_v2.0.md` §1~§15 전 영역 점검 결과
> 이 문서는 **새 대화창에서 즉시 작업 재개** 가능하도록 설계됨

---

## 0. 새 대화창 트리거 명령

```
docs/inspection_fixes_runbook_v1.0.md 기준으로 §A부터 순서대로 수정 진행.
P0 먼저, 이후 P1. 각 수정 후 SSH 검증 포함.
```

영역별 부분 트리거:
```
docs/inspection_fixes_runbook_v1.0.md §A (except Exception 42건) 수정 진행.
```

---

## 점검 결과 요약 (2026-05-19)

| 등급 | 건수 | 내용 |
|------|------|------|
| P0 ❌ | 2건 | except 패턴 42건, TOSS 키 확인 |
| P1 ⚠️ | 6건 | content_validator 게이트, Claude 호출 상한, _detect_faq 잔재, DUAL_TRACK 주석, text-xs, 세마포어 |
| SSH 필요 | 2건 | TOSS 키, PM2 상태 |

---

## §A — P0 ❌ bare `except Exception:` 42건 수정

### 배경
`except Exception: pass` 또는 로그 없는 `except Exception:` 패턴 42건 발견.
오류를 삼켜 스캔 실패·결제 오류가 무음으로 지나칠 위험.

### 우선순위 대상 (AI 스캐너 — 가장 위험)

| 파일 | 라인 | 위치 |
|------|------|------|
| `backend/services/ai_scanner/naver_scanner.py` | 61, 118, 148, 162, 186, 194 | 6건 |
| `backend/services/ai_scanner/google_scanner.py` | 55, 67 | 2건 |
| `backend/services/blog_analyzer.py` | 61 | 1건 |
| `backend/routers/scan.py` | 519, 878 | 2건 |
| `backend/scheduler/jobs.py` | 1130, 4681 | 2건 |
| `backend/services/guide_generator.py` | 694 | 1건 |

### 수정 기준

```python
# Before (❌)
except Exception:
    pass

# After (✅)
except Exception as _e:
    logger.warning(f"[함수명] 오류 — {_e}")
```

- `logger = logging.getLogger(__name__)` 이미 선언된 파일은 그대로 사용
- 미선언 파일은 파일 상단에 `import logging` + `logger = logging.getLogger(__name__)` 추가
- 단, **날짜 파싱 폴백** 같이 의도적 silent pass가 명확한 곳은 `# noqa: intentional-fallback` 주석 추가 허용

### 검증
```bash
# 수정 후 잔여 건수 확인
grep -rn "except Exception:\s*$\|except Exception: pass" backend/services/ai_scanner/ backend/routers/scan.py backend/scheduler/jobs.py backend/services/blog_analyzer.py backend/services/guide_generator.py
# 결과 0건이면 통과
```

---

## §B — P0 ❌ TOSS 키 test_/live_ 확인 (SSH 필요)

### 배경
`backend/services/toss_billing.py:17` — `os.getenv("TOSS_SECRET_KEY", "")` 로드.
로컬 `.env` 접근 불가 → 서버 직접 확인 필수.

### 확인 명령 (사용자 직접 실행)
```bash
ssh root@115.68.231.57 "grep TOSS_SECRET_KEY /var/www/aeolab/backend/.env"
```

### 결과별 조치

| 결과 | 조치 |
|------|------|
| `test_sk_...` | 실결제 전환 시 `live_sk_...`으로 교체 + `pm2 restart aeolab-backend` |
| `live_sk_...` | ✅ 이미 준비됨 |
| 공백/미설정 | 즉시 설정 필요 |

> **현재는 실결제 전이므로 test_ 상태가 정상.** 실결제 전환 시점에 교체.

---

## §C — P1 ⚠️ content_validator 90점 통과 게이트 없음

### 배경
`content_validator.py:149~157` — `validate_intro_dia()`는 점수 dict만 반환하고 통과/실패 결정 없음.
`guide_generator.py:694` — 호출처에서 점수를 무시하고 진행할 가능성.

### 수정 내용
**`backend/services/guide_generator.py`** — `validate_intro_dia()` 호출 후 점수 확인 로직 추가

```python
# guide_generator.py 내 validate_intro_dia 호출부 찾아 아래 패턴으로 수정

validation = validate_intro_dia(generated_text)
score = validation.get("score", 0)
if score < 70:  # 90점 이상이 이상적이나, 70점을 최소 게이트로 설정
    logger.warning(f"[guide_generator] D.I.A. 검증 점수 낮음: {score}/100 — {validation}")
    # 재생성 또는 경고만 남기고 진행 (첫 구현은 경고만)
```

### 검증
```bash
grep -n "validate_intro_dia\|dia.*score\|score.*dia" backend/services/guide_generator.py
```

---

## §D — P1 ⚠️ Claude 호출 잡 MAX_CALL 상한 없음

### 배경
- `scheduler/jobs.py:1218` `monthly_market_news_job` — 카테고리 캐싱은 있으나 전체 호출 횟수 상한 없음
- `scheduler/jobs.py:1938` `weekly_post_draft_job` — 구독자별 개별 Claude 호출, 상한 없음
- 구독자 급증 시 비용 폭발 위험 (구독자 50명 이후 주의)

### 수정 내용
**`backend/scheduler/jobs.py`** — 두 잡에 MAX_CALL 제한 추가

```python
# 각 잡 함수 상단에 추가
MAX_CLAUDE_CALLS = int(os.getenv("MAX_CLAUDE_CALLS_PER_JOB", "50"))
call_count = 0

# Claude 호출 직전마다
if call_count >= MAX_CLAUDE_CALLS:
    logger.warning(f"[job명] MAX_CLAUDE_CALLS({MAX_CLAUDE_CALLS}) 도달 — 잡 조기 종료")
    break
call_count += 1
```

**`.env.example`** 에 추가:
```
MAX_CLAUDE_CALLS_PER_JOB=50  # Claude 호출 잡 1회 실행당 최대 호출 수 (구독자 50명 이후 조정)
```

### 검증
```bash
grep -n "MAX_CLAUDE_CALLS\|call_count" backend/scheduler/jobs.py
```

---

## §E — P1 ⚠️ `_detect_faq()` 함수 잔재

### 배경
`backend/services/smart_place_auto_check.py:287` — `_detect_faq()` 함수 정의가 남아있으나 호출처 0건.
2026-05-01 `/qna` 폐기와 함께 폐기됐어야 하나 함수 정의가 잔존.

### 수정 내용
두 가지 방법 중 선택:

**방법 A (권장)**: 함수 상단에 deprecated 주석 추가
```python
# DEPRECATED 2026-05-01: 스마트플레이스 Q&A 탭 폐기로 미사용
# 호출처 0건 확인. 재도입 시 /profile 경로 사용할 것.
def _detect_faq(...):
```

**방법 B**: 함수 완전 삭제 (더 깔끔, 단 git blame으로 폐기 히스토리 확인 필요)

### 검증
```bash
grep -n "_detect_faq" backend/services/smart_place_auto_check.py
# 정의 라인 1건(또는 0건) + 호출 0건이면 통과
```

---

## §F — P1 ⚠️ cleaning/fashion DUAL_TRACK_RATIO 미등록 — 의도 주석

### 배경
`backend/services/score_engine.py:105~169` — `cleaning`, `fashion`이 DUAL_TRACK_RATIO dict에 없어 `DEFAULT_DUAL_TRACK_RATIO(0.60/0.40)` 폴백 적용.
두 업종 모두 `BRIEFING_INACTIVE_CATEGORIES`에 있어 전략적 영향은 낮음.

### 수정 내용
`score_engine.py` DUAL_TRACK_RATIO dict 주석에 명시 추가

```python
# NOTE: cleaning·fashion은 INACTIVE 업종으로 전략적 중요도 낮음
# → DEFAULT_DUAL_TRACK_RATIO(0.60/0.40) 의도적 폴백 사용 (별도 키 불필요)
```

또는 명시 등록 (더 명확):
```python
"cleaning":  {"naver": 0.65, "global": 0.35},  # 세탁·청소 = 지역 즉시방문형, INACTIVE
"fashion":   {"naver": 0.45, "global": 0.55},  # 패션 = 온라인 쇼핑 비중, INACTIVE
```

### 검증
```bash
grep -n "cleaning\|fashion" backend/services/score_engine.py
```

---

## §G — P1 ⚠️ CLAUDE.md Semaphore(2) vs 실제 Semaphore(1) 불일치

### 배경
- CLAUDE.md: "Playwright RAM: 동시 2개 이상 금지 ... `Semaphore(2)`"
- 실제 코드: `multi_scanner.py:33` — `Semaphore(1)` (네이버 브리핑)
- `naver_ai_tab_scanner.py:25` — `Semaphore(1)` (AI탭) — 독립 세마포어
- 두 세마포어가 독립이므로 이론상 동시 Playwright 2개 가능 → RAM 600~1000MB 소비 위험

### 수정 내용
**단기**: CLAUDE.md 수정 — 실제 `Semaphore(1)` 반영, 세마포어 독립 운영 주의사항 명시
**중기**: 6월 P2(AI탭 스캐너 활성화) 전에 공유 세마포어 또는 합산 동시성 제어 구현

CLAUDE.md 수정:
```
# Before
Playwright RAM: 인스턴스 1개 = 300~500MB. 동시 2개 이상 금지, 큐 방식 순차 처리 (Semaphore(2))

# After
Playwright RAM: 인스턴스 1개 = 300~500MB. 동시 2개 이상 금지.
- multi_scanner.py: PLAYWRIGHT_SEMAPHORE = Semaphore(1) (네이버 브리핑)
- naver_ai_tab_scanner.py: _AI_TAB_SEMAPHORE = Semaphore(1) (AI탭) — 독립 세마포어
- ⚠️ 두 세마포어 독립이므로 동시 최대 2 Playwright 가능. P2 활성화 전 공유 세마포어 통합 필요
```

---

## §H — P1 ⚠️ text-xs 260건 잔존 (대량 작업 — 별도 세션 권장)

### 배경
`frontend/app/` 112건 + `frontend/components/` 148건 = 260건.
2026-05-17 일괄 교체 후에도 잔존. 대부분 뱃지·타임스탬프·보조 레이블 등 의도적 소형 텍스트이나 주요 정보 전달 요소에도 일부 사용.

### 수정 전략
1. 주요 정보 전달 요소(점수·키워드·안내문) 위주 우선 교체 — `text-xs` → `text-sm`
2. 뱃지·타임스탬프·보조 레이블은 `text-xs` 허용 (의도적 소형)
3. 작업 완료 기준: 주요 정보 전달 요소 text-xs 0건

### 새 대화창 트리거
```
frontend/ text-xs 사용 현황을 점검하고 주요 정보 전달 요소(점수·키워드·안내 텍스트)에서 text-xs 사용 중인 곳을 text-sm으로 교체할 것. 뱃지·타임스탬프는 유지 허용.
```

---

## §I — SSH 확인 필요 (사용자 직접)

### 확인 명령
```bash
# 1. TOSS 키
ssh root@115.68.231.57 "grep TOSS_SECRET_KEY /var/www/aeolab/backend/.env"

# 2. PM2 상태 + 에러 로그
ssh root@115.68.231.57 "pm2 list"
ssh root@115.68.231.57 "pm2 logs aeolab-backend --lines 60 --nostream | grep -i error"
ssh root@115.68.231.57 "pm2 logs aeolab-frontend --lines 60 --nostream | grep -i error"

# 3. SSL 인증서 만료일
echo | openssl s_client -connect aeolab.co.kr:443 2>/dev/null | openssl x509 -noout -dates
```

---

## §J — 기타 Minor 발견 사항

| 항목 | 위치 | 조치 |
|------|------|------|
| `jobs.py:4681` bare except | `scheduler/jobs.py:4681` | §A 수정 시 함께 처리 |
| `google_scanner.py:67` bare except | DOM 쿼리 실패 루프 내 | 바깥 except에 logger.warning 있어 허용 가능. 주석만 |
| `.env.example` 미포함 (Git) | 루트 또는 backend/ | 필수 키 목록만이라도 README 또는 CLAUDE.md에 확인 가능한 위치 명시 |

---

## 작업 완료 체크리스트

- [x] §A: `except Exception:` → `logger.warning()` 교체 (P0) + 배포 ✅ 2026-05-20 서버 검증 완료
- [ ] §B: TOSS 키 SSH 확인 (사용자 직접)
- [x] §C: content_validator D.I.A. 70점 로깅 게이트 추가 + 배포 ✅ 2026-05-20
- [x] §D: MAX_CLAUDE_CALLS_PER_JOB 환경변수 + 잡 상한 로직 + 배포 ✅ 2026-05-20 서버 검증 완료
- [x] §E: `_detect_faq()` deprecated 주석 추가 + 배포 ✅ 2026-05-20
- [x] §F: cleaning/fashion 주석 추가 + 배포 ✅ 2026-05-20
- [x] §G: CLAUDE.md Semaphore 표기 수정 ✅ 2026-05-20
- [ ] §H: text-xs 주요 정보 전달 요소 교체 (별도 세션)
- [ ] §I: SSH PM2 + SSL 만료일 확인 (사용자 직접)

---

## 완료 기준 (상업 서비스 출시 준비 완료)

1. P0 ❌ 0건
2. P1 ⚠️ 중 §C·§D·§E·§F 완료
3. SSH §B·§I 확인 완료
4. `commercial_launch_inspection_v2.0.md` §18 결과 기록란 업데이트

---

*작성: 2026-05-19 | commercial_launch_inspection_v2.0.md §1~§15 전 영역 점검 결과 기반*
*배포: `docs/remaining_tasks_v1.0.md`와 연계 — 대행 서비스 런북과 병행 진행 가능*
