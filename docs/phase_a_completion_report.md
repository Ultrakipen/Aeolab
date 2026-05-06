# Phase A 완료 보고서 — 서비스 통합 재편 v1.2

> 작성일: 2026-04-30
> 기준 문서: `service_unification_v1.0.md` v1.2
> 결과: 17건 작업 완료 + 라이브 배포 + 검증 통과
> 상태: v3.1 점수 모델 토글 OFF (안전, 베타 5명+ 측정 데이터 확보 후 활성화 권장)

---

## 0. 한 줄 요약

**소상공인이 가입한 업종이 AI 브리핑 비대상이어도 "키워드 검색·스마트플레이스·블로그·지도" 통합 노출 관리에서 동일한 가치를 받도록 재편.** Track1 5항목 → 6항목 그룹별 가중치 자동 재분배 + Playwright 키워드 측정 인프라 + Claude Haiku 키워드 추천 + 카카오 변동 알림.

---

## 1. 완료 작업 목록 (17건)

### 1차: 점수 모델 + 측정 인프라 (10건)

| ID | 항목 | 결과 |
|---|---|---|
| A-0 | 베이스라인 측정 (베타 1명, INACTIVE) | ✅ Track1 ~31.6 / Track2 16.0 기록 |
| A-1 | DB v3.1 마이그레이션 (5 ALTER / 10 ADD COLUMN / 2 INDEX) | ✅ Supabase 적용 확인 |
| A-2 | `naver_keyword_rank.py` 신규 (Playwright PC/모바일/플레이스 측정) | ✅ Semaphore(2) + 환경변수 분리 |
| A-3 | `score_engine.py` v3.1 6항목 + 그룹별 가중치 + 환경변수 토글 | ✅ 가중치 합 100% 자동 검증 |
| A-4 | 키워드 자동 추천 API (Claude Haiku + 검색광고 폴백) | ✅ `/keyword-suggest` + `/keyword-suggest-preview` |
| A-7 | RegisterBusinessForm 키워드 3개 필수 + AI 추천 버튼 | ✅ TypeScript EXIT 0 |
| A-8 | KeywordRankCard.tsx 신규 (PC 표 / 모바일 카드) | ✅ 빈 상태·에러 폴백·면책 문구 |
| A-9 | how-it-works v3.1 6항목 그룹별 가중치 표 | ✅ 라이브 200 OK |
| 통합 | `scan.py` `/api/scan/keyword-rank` 엔드포인트 | ✅ scan_results.keyword_ranks 저장 |
| 통합 | 스케줄러 잡 2개 등록 (Basic 월 04:00 / Pro 매일 04:30) | ✅ PM2 로그 확인 |

### 2차: 한도·알림·매핑·UX (4건)

| ID | 항목 | 결과 |
|---|---|---|
| 한도 | 키워드 추천 플랜별 월 한도 (Free 1 / Basic 1 / Pro 4 / Biz 10 / Ent 999) | ✅ profiles.keyword_suggest_count_month |
| 알림 | `KakaoNotifier.send_keyword_change()` + 변동 감지 (`_maybe_notify_keyword_change`) | ✅ ±3 이상·TOP10 진입·이탈 시 발송 |
| 매핑 | v3.1 토글 시 `score_breakdown`에 신규 4항목 평탄화 | ✅ briefing_engine·gap_analyzer 호환 |
| Trial | 트라이얼 결과에 "키워드 검색은 모든 업종 동일 제공" 문구 | ✅ INACTIVE/LIKELY 그룹 |

### 3차: 보강·문서화·검증 (5건)

| ID | 항목 | 결과 |
|---|---|---|
| 검증 | BusinessQuickEditPanel 저장 시 키워드 3개 미만 차단 | ✅ |
| 문서 | CLAUDE.md "최근 업데이트" Phase A 항목 + 환경변수 5개 | ✅ |
| 매뉴얼 | `/score-guide`에 v3.1 안내 박스 + how-it-works 링크 | ✅ |
| GA4 | `keyword_input`/`recommend_click`/`measure_start`/`measure_complete` 4개 이벤트 | ✅ |
| 라벨 | gap_analyzer `_DIMENSION_LABELS`에 v3.1 4개 키 추가 | ✅ |

### 4차: 버그 수정 + 편집 패널 보강 (3건, 본 문서 작성 직전)

| ID | 항목 | 결과 |
|---|---|---|
| 🔴 버그1 | `kakao_notify.TEMPLATES`에 `keyword_change` 매핑 누락 → KeyError 위험 | ✅ `AEOLAB_KW_01` 추가 (env override) |
| 🔴 버그2 | `jobs.py`에서 `KakaoNotifyService` 클래스 참조 (실제는 `KakaoNotifier`) → ImportError | ✅ `KakaoNotifier`로 수정 |
| 보강 | BusinessQuickEditPanel AI 자동 추천 버튼 (등록 후 키워드 보강) | ✅ 한도 429 처리 + 폴백 |

---

## 2. 변경 파일 전체 목록 (총 16개)

### 백엔드 (8개)
1. `backend/services/score_engine.py` — v3.1 6항목 가중치·get_user_group·calc_track1_score_v3_1·SCORE_MODEL_VERSION 토글·breakdown 평탄화
2. `backend/services/naver_keyword_rank.py` — **신규** Playwright 측정 모듈
3. `backend/services/keyword_suggester.py` — **신규** Claude Haiku 추천
4. `backend/services/kakao_notify.py` — `send_keyword_change()` + TEMPLATES `keyword_change` 매핑
5. `backend/services/gap_analyzer.py` — `_DIMENSION_LABELS` v3.1 4개 키 추가
6. `backend/routers/business.py` — `/keyword-suggest`·`/keyword-suggest-preview` + 한도 강제
7. `backend/routers/scan.py` — `/keyword-rank` 엔드포인트
8. `backend/scheduler/jobs.py` — 2개 잡 + 변동 감지 함수 + KakaoNotifier 수정

### 프론트엔드 (6개)
9. `frontend/components/dashboard/KeywordRankCard.tsx` — **신규** PC/모바일 분리
10. `frontend/components/dashboard/RegisterBusinessForm.tsx` — 키워드 3개 필수 + AI 추천 + GA4
11. `frontend/components/dashboard/BusinessQuickEditPanel.tsx` — 3개 검증 + AI 추천
12. `frontend/app/(dashboard)/dashboard/page.tsx` — KeywordRankCard 통합 + scan_results SELECT 확장
13. `frontend/app/(public)/how-it-works/page.tsx` — v3.1 6항목 표
14. `frontend/app/(public)/score-guide/page.tsx` — v3.1 안내 박스
15. `frontend/app/(public)/trial/components/TrialResultStep.tsx` — 키워드 검색 강조 문구
16. `frontend/lib/analytics.ts` — GA4 이벤트 4개

### DB (사용자 직접 실행 완료)
- `scripts/phase_a1_migration_v3_1.sql` (5 ALTER · 10 ADD COLUMN · 2 INDEX)
- `profiles.keyword_suggest_count_month` + `keyword_suggest_reset_at` (별도 ALTER)

### 문서 (5개)
- `docs/service_unification_v1.0.md` v1.2 (기획서, 추정 8개소 보강 + 검증 게이트)
- `docs/phase_a_completion_report.md` (본 문서)
- `scripts/phase_a0_baseline.sql` (베이스라인 측정 SQL)
- `scripts/phase_a1_migration_v3_1.sql` (DB 마이그레이션)
- `CLAUDE.md` (최근 업데이트 + 환경변수 명시)

---

## 3. 환경변수 추가 명세

```bash
# 점수 모델 토글 (기본 v3.0, Phase A-2 측정 데이터 확보 후 v3.1 활성화)
SCORE_MODEL_VERSION=v3_0

# Playwright 동시성 (현재 RAM4GB → 2, 서버 업그레이드 후 3~4)
BACKEND_MAX_CONCURRENCY=2

# 키워드 측정 옵션
KEYWORD_RANK_TIMEOUT_MS=15000
KEYWORD_RANK_LIMIT=20
KEYWORD_RANK_LOCATION=Seoul

# Claude Haiku 추천
KEYWORD_SUGGEST_MODEL=claude-haiku-4-5-20251001
KEYWORD_SUGGEST_TIMEOUT=30.0

# 카카오 알림톡 (AEOLAB_KW_01 비즈센터 승인 후 override 가능)
KAKAO_TEMPLATE_KEYWORD_CHANGE=AEOLAB_KW_01
```

---

## 4. 점수 모델 v3.1 그룹별 가중치 (확정)

**Track1 = 100% / unified_score 계산 시 ×0.55**

| 항목 | ACTIVE | LIKELY | INACTIVE | 측정 |
|---|---|---|---|---|
| 네이버 키워드 검색 노출 (신규) | 25% | 30% | 35% | Playwright PC/모바일/플레이스 |
| 리뷰 품질 | 15% | 17% | 20% | calc_review_quality 보존 |
| 스마트플레이스 완성도 (콘텐츠 매칭 흡수) | 15% | 18% | 20% | 기존 + keyword_gap 30% 흡수 |
| 블로그 생태계 (C-rank 추정) | 10% | 10% | 10% | 발행 빈도·인용·매칭 |
| 지도/플레이스 + 카카오맵 | 10% | 10% | 15% | 네이버 지도 50% + 카카오맵 50% |
| AI 브리핑 인용 | 25% | 15% | 0% | calc_naver_exposure 확장 |
| **합계** | **100%** | **100%** | **100%** | |

**그룹 판정 (`get_user_group`):**
- 프랜차이즈 → INACTIVE
- restaurant·cafe·bakery·bar·accommodation → ACTIVE
- beauty·nail·pet·fitness·yoga·pharmacy → LIKELY
- 그 외 → INACTIVE

---

## 5. 가치 사이클 (라이브)

```
[등록] 사용자가 키워드 3개 입력 (자유 + AI 추천)
   ↓ businesses.keywords + GA4 keyword_input
[측정] 수동 또는 스케줄러 자동 (Basic 월/Pro 매일)
   ↓ Playwright PC+모바일+플레이스 → scan_results.keyword_ranks
[저장] score_history.keyword_rank_avg 시계열
[표시] KeywordRankCard 대시보드 (PC 표 / 모바일 카드)
[변동] ±3 이상 또는 TOP10 진입·이탈 → KakaoNotifier.send_keyword_change()
[점수] SCORE_MODEL_VERSION=v3_1 토글 시 Track1 가중치 자동 반영
```

---

## 6. 검증 결과

| 검증 항목 | 결과 |
|---|---|
| Python AST 파싱 (8 파일) | ✅ 모두 통과 |
| TypeScript 컴파일 (`npx tsc --noEmit`) | ✅ EXIT 0 (3회 재검증) |
| v3.1 가중치 합 100% (3 그룹) | ✅ 1.000 / 1.000 / 1.000 |
| `get_user_group()` 매핑 (6 케이스) | ✅ 모두 정확 (프랜차이즈 게이팅 포함) |
| 베타 사용자 시뮬레이션 (education, INACTIVE) | ✅ v3.0 31.6 / v3.1 키워드 측정 시 +12점 / 측정 없을 시 -15점 (가짜 수치 금지 정상 동작) |
| 서버 빌드 + PM2 재시작 | ✅ 3회 배포 모두 성공 |
| 라이브 검증 (`/how-it-works`·`/score-guide`·`/trial`) | ✅ 200 OK + v3.1 콘텐츠 노출 |
| 스케줄러 잡 등록 | ✅ keyword_rank_basic_weekly + keyword_rank_pro_daily |

---

## 7. 작업 지침 #7 (실측·사실 기반) 준수 검증

| 원칙 | 적용 |
|---|---|
| 가짜 수치 금지 | ✅ 측정 미완료 시 0점·N/A 표시, 임의 수치 X |
| 빈 상태 처리 | ✅ KeywordRankCard "아직 측정 데이터 없음" + 키워드 미등록 안내 |
| 면책 문구 일관 | ✅ 6개 컴포넌트에 "측정 시점·기기·검색 환경" 명시 |
| 환경변수 분리 | ✅ 동시성·주기·모델·타임아웃 모두 .env 분리 |
| 에러 폴백 | ✅ Playwright 실패 시 None, Claude Haiku 실패 시 keyword_taxonomy 폴백 |
| 추정 명시 | ✅ C-rank "(추정)" 배지, 베이스라인 추정값 보강 |
| 검증 게이트 | ✅ Phase A-0 베이스라인·A-4.5 비용 실측·A-10 통합 검증 |

---

## 8. 알려진 한계 및 다음 단계

### 8.1 즉시 사용 가능

- 사용자 키워드 등록 폼 (필수 3개 + AI 추천)
- BusinessQuickEditPanel 키워드 편집 (3개 검증 + AI 추천)
- 키워드 측정 수동 트리거 (`POST /api/scan/keyword-rank`)
- 키워드 순위 카드 표시 (대시보드 상단)
- 매뉴얼 v3.1 안내 (3개 페이지)

### 8.2 사용자 직접 액션 필요

| 시점 | 액션 | 효과 |
|---|---|---|
| 즉시 | 사업장 등록 폼 테스트 (베타 1명 → 키워드 3개 + 측정) | 실데이터 1건 검증 |
| 이번 주 | 카카오 비즈센터 `AEOLAB_KW_01` 템플릿 신청 (승인 2~4주) | 변동 알림 활성화 |
| 다음 월요일 04:00 | 스케줄러 첫 실행 PM2 로그 확인 | RAM peak·실패 키워드 검증 |
| 베타 5명 확보 | §11 KPI 베이스라인 재측정 + `service_unification_v1.0.md` §1.1·§11 갱신 | KPI 추이 측정 시작 |
| 측정 검증 후 | `SCORE_MODEL_VERSION=v3_1` + `pm2 restart` | v3.1 점수 모델 활성화 |
| Anthropic 콘솔 첫 5건 호출 후 | Claude Haiku 비용 실측 → §4.2 갱신 | 운영비 정확도 |

### 8.3 BEP 이후 권장 (보류)

- gap_analyzer v3.1 정밀 가이드 텍스트 (4개 신규 항목)
- guide_generator v3.1 6항목 가이드 (Claude Sonnet 프롬프트 변경)
- TrialResult 키워드 미리보기 1건 (가치 미달 vs 비용)
- KeywordRankCard CSV 다운로드 (Pro+)
- ScoreEvidenceCard v3.1 6항목 표시
- 자동 회귀 테스트 (Playwright + pytest)
- Drift Detection (셀렉터 변경 알람)
- Evidence Trail (각 점수에 근거 부착)
- 단일 소스 API (`/api/public/briefing-categories`)
- Phase B 헤드라인 자체 분기 (랜딩 그룹별)

---

## 9. 핵심 의사결정 기록

| # | 결정 | 사유 |
|---|---|---|
| 1 | DUAL_TRACK_RATIO: legal·shopping 예외 유지, 23개 업종 55:45 통일 | 위치 무관 업종 특성 |
| 2 | INACTIVE AI 브리핑 25%p → 키워드 +15%p / 스마트플레이스 +10%p | 가장 체감되는 2개 채널, 변동성 분산 |
| 3 | 키워드 신규 가입자 3개 필수 입력 + 자동 추천 1회 무료 | 진입 장벽 최소화 + 사업장 정보 반영 보장 |
| 4 | v3.1 토글 OFF 기본값 유지 | Phase A-2 측정 데이터 부족 시 점수 급락 방지 |
| 5 | 점진적 코드 추가(신규 함수) + 환경변수 토글 | 롤백 즉시 가능, 기존 사용자 영향 0 |
| 6 | 트랙별 가격 분리 폐기 → 단일 상품 + 메시지 분기 | 운영 단순화, BEP 미달 단계 적합 |

---

## 10. 발견된 버그 및 수정

| # | 버그 | 영향 | 수정 |
|---|---|---|---|
| 1 | `kakao_notify.TEMPLATES`에 `keyword_change` 누락 | 알림 발송 시 KeyError 또는 None 템플릿 ID | TEMPLATES dict에 `AEOLAB_KW_01` 추가 (env override 가능) |
| 2 | `jobs.py`에서 `KakaoNotifyService` 잘못된 클래스명 (실제 `KakaoNotifier`) | 첫 변동 알림 발송 시 ImportError | `KakaoNotifier`로 수정 |

---

## 11. 베이스라인 측정 결과 (실측)

**2026-04-30 측정**:
- 베타 사용자 1명만 존재 (`fccf289b...`, education, INACTIVE)
- v3.0 Track1 분포: 28.00 ~ 40.70 (10회 스캔, 평균 ~31.6)
- v3.0 Track2: 16.00 (고정)
- Unified: 20.80 ~ 25.90 (생존 단계 `survival`)

**시사점:**
- INACTIVE 사용자가 실제로 가입한다는 가설 1건 검증
- Track1·Track2 모두 30점대 이하 → 가입 후 즉시 가치 체감 어려움
- §11 KPI 베이스라인 확정은 베타 5명+ 확보 후 재측정 권장

---

## 12. 새 대화창 작업 재개

```
"docs/phase_a_completion_report.md 읽고 [후속 단계 N]부터 진행해주세요."
```

또는 추정 갱신 작업:
```
"베타 사용자 N명 확보됐으니 §11 KPI 재측정 + service_unification_v1.0.md §1.1 갱신해주세요."
```

토글 활성화:
```
"v3.1 점수 모델 활성화 시점 됐습니다. SCORE_MODEL_VERSION=v3_1 + 7번(gap_analyzer 가이드)·11번(guide_generator) 보강 진행해주세요."
```

---

*최종 업데이트: 2026-04-30*
*검증: TypeScript ✅ Python ✅ 빌드 ✅ 라이브 ✅ 가중치 100% ✅*
*상태: Phase A 완료 / v3.1 토글 OFF / 베타 사용자 확보 대기*
