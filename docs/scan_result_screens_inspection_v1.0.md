# 스캔 결과 화면 종합 점검 보고서 v1.0

> 작성일: 2026-05-22
> 점검 범위: 무료 체험(Trial) 결과 화면 + 구독 후 대시보드 스캔 결과 화면 전 영역
> 점검 방법: 메인 세션 직접 코드 정독 (5개 핵심 파일 + 백엔드 점수 엔진) + code-review 에이전트 병렬 점검 + 외부 사양 WebSearch 7건 + 메타 점검 3차
> 작성 원칙: CLAUDE.md "문제 분류 검증 의무" 준수 — 모든 진단에 단정 근거 file:line + 반증 시도 file:line 명시
> 트리거 명령: `"docs/scan_result_screens_inspection_v1.0.md 기준으로 점검·수정 진행"`

---

## 0. 점검 대상 파일

### 프론트엔드 (5개 핵심)
| 파일 | 줄 수 | 역할 |
|------|------|------|
| `frontend/app/(public)/trial/components/TrialResultStep.tsx` | 2,015 | 무료 체험 결과 화면 전체 |
| `frontend/app/(dashboard)/dashboard/page.tsx` | 453 | 대시보드 SSR 데이터 페칭·조립 |
| `frontend/components/dashboard/DualTrackCard.tsx` | 647 | 듀얼트랙 점수 카드 |
| `frontend/components/dashboard/DashboardHeroCard.tsx` | 250 | 대시보드 점수 헤더 카드 |
| `frontend/components/dashboard/ScoreEvidenceCard.tsx` | 960 | 점수 근거 6항목 카드 (v3.0 4항목/v3.1 6항목 분기) |

### 보조 (추가 검증)
- `frontend/components/dashboard/AiTabPreviewCard.tsx` 400+ 줄
- `frontend/components/dashboard/NaverAiPathwayCard.tsx` 196 줄
- `frontend/components/trial/NaverTrackCard.tsx` 287 줄
- `frontend/app/(dashboard)/dashboard/sections/DashboardScoreZone.tsx` 163 줄

### 백엔드 (3개)
- `backend/services/score_engine.py` (점수 산정·LIKELY 분류·DUAL_TRACK_RATIO)
- `backend/services/briefing_engine.py` (`simulate_ai_tab_answer`)
- `backend/routers/report.py` (`/api/report/ai-tab-preview` 엔드포인트)
- `backend/routers/scan.py` (AI탭 스캐너 게이트 + scan_results INSERT)

---

## 1. 외부 사양 확정 (2026-05 시점)

### 1.1 네이버 AI 브리핑
| 항목 | 외부 보도 사실 | 출처 |
|------|----------|------|
| 적용률 | 전체 검색의 약 20% 적용 | KoreaPlus 2026 |
| 확대 목표 | 약 2배 확대 → 전체 검색의 40% 수준 | 네이트 2026-05-04 |
| 확대 영역 | 쇼핑·플레이스·헬스케어·금융 등 버티컬 AI 확대 | 네이버 2026 컨퍼런스콜 |
| 광고 도입 | 2026 Q2 테스트 → 3분기 본격 수익화 | 다음 2026-04-30 |
| 노출 대상 업종 | restaurant·cafe·bakery·bar·accommodation (ACTIVE 5종) | 네이버 공식 (help.naver.com/service/30026/contents/24632) |
| 프랜차이즈 | 제외 (네이버 공식 정책) | 네이버 공식 |

### 1.2 네이버 AI탭
| 항목 | 외부 보도 사실 | 출처 |
|------|----------|------|
| 출시 시점 | 2026-04-28 베타 (네이버플러스 우선) | 한경 2026-04-28 |
| 확대 일정 | 상반기 내 전체 사용자 + 모바일 메인 검색창 | 인포스탁 2026-04-28 |
| 전면 도입 | 4분기 전면 도입 예정 | FETV 컨퍼런스콜 |
| 업종 제한 | 명시적 업종 제한 미확인 (모든 업종 가능 기조) | 다수 매체 |
| 핵심 노출 조건 | 소개글 200자+·사진 10장+·예약 연동·블로그 UGC·키워드 매칭 | 네이버 공식 발표 |

### 1.3 AEOlab 코드 활성화 상태
| 항목 | 상태 |
|------|------|
| AI탭 스캐너 (`naver_ai_tab_scanner.py`) | ✅ 존재 (2026-05-20 e77ab96 커밋) |
| 스캐너 게이트 (`scan.py:2660~2675`) | ✅ 호출 코드 추가됨 |
| DB 컬럼 v5.7 (`naver_ai_tab_visible`/`naver_reservation_linked`) | ✅ schema.sql:2060~2067 ALTER 정의 (실DB 실행 여부 별도 확인) |
| `system_status.ai_tab_enabled` 토글 | DB 조회 + env fallback (`naver_ai_tab_scanner.py:30~51`) |

---

## 2. 5채널 vs 4채널 노출 규칙 인식 점검

### 2.1 사용자 정의 규칙
| 그룹 | 노출 가능 채널 | 채널 수 |
|------|----------|------|
| ACTIVE (네이버 AI 브리핑 대상) | AI 브리핑 + AI탭 + ChatGPT + Gemini + Google AI | **5개** |
| LIKELY/INACTIVE/franchise | AI탭 + ChatGPT + Gemini + Google AI | **4개** |

### 2.2 코드·UI 인식 결과
| 영역 | 인식 수준 |
|------|----------|
| 백엔드 룰 (`score_engine.py:55,85`) | ✅ `get_briefing_eligibility` + `get_ai_tab_eligibility` 함수 분리 인식 |
| 대시보드 InsightZone `NaverAiPathwayCard` | ✅ AI 브리핑 vs AI탭 비교 카드 (2026-05-18 신설) |
| 대시보드 ScoreZone·HeroCard·DualTrackCard | ❌ AI탭 누락 (active/likely 분기에서 4채널 또는 5채널 묶음 부재) |
| Trial 결과 배지·헤더 (`BriefingCategoryBadge`/`BriefingBadgeChip`) | ❌ AI탭 명시 없음 |
| Trial 결과 카드 (AI탭 결과 카드) | ❌ AiTabPreviewCard 미사용 |
| Trial 그룹 배너 (INACTIVE/franchise 채널 칩) | ✳️ 4채널 칩 정확, ACTIVE 5채널 칩 없음 |

---

## 3. 최종 진단 목록 (P0~P3, 14건)

### P0 — 신뢰 직격, 즉시 손볼 것 (4건)

#### P0-1. AI탭 measured 데이터 파이프 3중 단절
- **근거 1 (저장)**: `scan.py:2900~2901` — `naver_ai_tab_visible`는 scan_results **top-level 컬럼**으로 저장
- **근거 2 (조회)**: `report.py:1355` `.select("id, keyword_coverage, score_breakdown")` — `naver_result` JSONB, `naver_ai_tab_visible` 모두 **SELECT 안 함**
- **근거 3 (판정)**: `briefing_engine.py:1552~1563` — `data_source = "measured"` 판정 근거 = `scan_result.naver_result.in_ai_tab`(JSONB 내부) 또는 keyword_results[].in_ai_tab. **top-level `naver_ai_tab_visible`은 안 봄**
- **반증 시도**: `AiTabPreviewCard.tsx:245~257`은 `data.data_source === "measured"` 분기 코드 완비. **카드는 표시 준비됨**. 하지만 SELECT 단계에서 데이터 자체가 누락되어 simulate는 항상 estimated 반환.
- **사용자 영향**: AI탭 측정값(`naver_ai_tab_visible`)이 DB에 쌓이지만 사용자 화면에는 **"AI탭 노출 실측 확인" 배지가 절대 트리거되지 않음**. 측정만 하고 표시하지 않는 상태.
- **수정안 (P0)**:
  1. `scan.py:2660~2671` — `_naver_result["in_ai_tab"] = _ai_tab_visible` 추가하여 JSONB 내부에도 함께 주입
  2. `report.py:1355` SELECT에 `naver_result` 추가
  3. (선택) `briefing_engine.py:1556` — `naver_ai_tab_visible` top-level fallback 추가

#### P0-2. LockedScoreCard 더미 막대가 "더미 수치 금지 원칙" 주석을 배신
- **근거**: `TrialResultStep.tsx:194~213` 주석 *"블러 처리된 항목 분석 바 — 수치 표시 없음(더미 수치 금지 원칙)"* 바로 아래 `barW: 60/45/50/55/40` 고정값
- **반증 시도**: blur-sm + opacity-60 + aria-hidden + 잠금 오버레이 다중 처리. 그러나 사용자는 흐릿한 막대 길이를 본능적으로 비교 가능.
- **사용자 영향**: CLAUDE.md "에러 폴백 시 허위 수치 금지(과거 히어로 섹션 사고)" 원칙 + 주석 자체 자기모순.
- **수정안 (P0)**: 모든 `barW`를 동일값(50)으로 통일하거나 회색 빈 바로 교체.

#### P0-3. ScoreBreakdownBox 가중치가 "통합 점수"처럼 보임
- **근거**: `TrialResultStep.tsx:594~628` `breakdownItems` weight 합 35+25+15+15+10=100, 레이블 "채널별 측정 결과"
- **반증 시도**: 가중치 합 100이라는 점은 사용자가 "통합 분해"로 해석하기 충분. `ScoreEvidenceCard.tsx:791~796`은 "네이버 70% / 글로벌 30%" 정확히 표시 — 두 화면이 같은 점수에 대해 다른 분해.
- **사용자 영향**: restaurant(naver 70%)에서 "키워드 35%"는 실제로는 `0.35 × 0.70 = 24.5%` 기여. 두 화면 충돌이 신뢰 훼손.
- **수정안 (P0)**: 레이블을 **"네이버 트랙 내 항목 비중"**으로 변경, 또는 unified 기여도(가중치×naverWeight)로 재계산.

#### P0-4. 5채널 매트릭스 카드 부재 (Trial+대시보드)
- **근거 1**: `NaverAiPathwayCard.tsx:57~149` — 좌측 AI 브리핑 + 우측 AI탭 = **네이버 2채널만** 비교
- **근거 2**: `NaverAiPathwayCard.tsx:167~187` ChatGPT·Gemini 박스 추가는 `globalWeight < 0.65` 조건부 + **Google AI 누락**
- **근거 3**: Trial 결과 화면에 AiTabPreviewCard 사용 0건, 5채널 비교 카드 없음
- **반증 시도**: `BriefingCategoryBadge`·`BriefingBadgeChip` 등 곳곳에 부분 안내 있음. 그러나 **한 곳에 묶인 5채널 매트릭스는 어디에도 없음**.
- **사용자 영향**: ACTIVE 업종 사용자가 "내가 노출 가능한 5채널"을 한 화면에서 못 봄. 사용자 질문(2026-05-22) 직격.
- **수정안 (P0)**:
  - `NaverAiPathwayCard`에 ChatGPT/Gemini/Google AI 박스 통합 + Google AI 추가 (5채널 매트릭스로 확장)
  - Trial 결과 화면 ScoreSummaryCard 직후 동일 카드 노출

---

### P1 — 친절·정확성 보강 (6건)

#### P1-1. BriefingBadgeChip / BriefingCategoryBadge / DualTrackCard track1Label AI탭 표기 누락
- **근거 1**: `TrialResultStep.tsx:1233~1276 BriefingCategoryBadge` likely/inactive 배지 — *"ChatGPT·Gemini + 네이버 플레이스 검색 노출"* — **AI탭 0건**
- **근거 2**: `TrialResultStep.tsx:1737~1764 BriefingBadgeChip` — *"ChatGPT·Gemini + AI 브리핑 확대 예정"* — **AI탭 0건**
- **근거 3**: `DualTrackCard.tsx:387~391 track1Label` — *"네이버 AI 브리핑 점수"* 등 — **`grep "AI탭"` 결과 0건**
- **반증 시도**: 백엔드 `score_engine.py:7~8` 주석 *"Track 1 (네이버 AI 검색 준비도 — AI브리핑+AI탭 통합)"* — **백엔드는 통합 인식인데 프론트 라벨이 누락**
- **사용자 영향**: 5채널 누락 진단의 핵심 증거.
- **수정안 (P1)**: 3개 컴포넌트에 AI탭 명시 일괄 추가.

#### P1-2. Trial 내 gsLabel vs ScoreSummaryCard 자체 stage 충돌
- **근거 1**: `TrialResultStep.tsx:257~283 ScoreSummaryCard` 자체 컷오프 30/50/70 → "안정 궤도/성장 진행 중/성장 준비 중/시작 단계"
- **근거 2**: `TrialResultStep.tsx:455` `gsLabel = result.growth_stage_label ?? "성장 중"` 백엔드 30/55/75 기준
- **근거 3**: `TrialResultStep.tsx:1011~1014` *"이번 주 집중할 것 ({gsLabel})"* — gsLabel 직접 노출
- **반증 시도**: 초기 진단은 "DualTrackCard vs ScoreSummaryCard 충돌"이라 잘못 짚었음. Trial에는 DualTrackCard 없음(`TrialDetailAccordion` → `NaverTrackCard`). **그러나 같은 Trial 화면에서 ScoreSummaryCard stage와 gsLabel 동시 노출은 사실**.
- **사용자 영향**: 같은 화면에서 "성장 진행 중"과 "성장 중" 두 라벨이 다른 척도로 동시 노출 → 혼란.
- **수정안 (P1)**: ScoreSummaryCard 자체 stage 계산 23줄 제거, 백엔드 `gsLabel` 그대로 사용.

#### P1-3. AI탭 vs AI 브리핑 LIKELY "확대 예정" 표현 분리
- **근거**: Trial에 "확대 예정" 표현 **11곳** (`TrialResultStep.tsx:566, 616, 724, 912, 1257, 1415, 1454, 1456, 1458, 1737, 1754`)
- **반증 시도**:
  - AI탭 확대 예정 (3곳): 네이버 공식 발표 그대로, **단정 정당**
  - AI 브리핑 LIKELY 업종 확대 예정 (5곳): `score_engine.py:28` 주석 *"예정이지 확정 아님"* → **신중 표현 필요**
  - 혼합 (3곳): 맥락 분리 필요
- **사용자 영향**: 미용·동물병원 LIKELY 업종 사용자가 "곧 AI 브리핑된다"고 단정 인식 시 신뢰 훼손 위험.
- **수정안 (P1)**:
  - AI탭 맥락: "상반기 확대 예정" 유지
  - AI 브리핑 LIKELY 맥락: "확대 검토 중" 또는 "확대 예상(확정 아님)"으로 신중 표현

#### P1-4. DashboardHeroCard active/likely 분기 4채널 표기 누락
- **근거**: `DashboardHeroCard.tsx:120~159` grep 결과 "AI탭" 등장 **inactive 분기 2건만 (line 148, 157)**, active/likely는 *"AI 브리핑"* 한 줄만
- **반증 시도**: `DashboardScoreZone.tsx:68~115`에 inactive 전용 AI탭 안내 배너 2개 있음. 그러나 active/likely 사용자는 4채널 묶음 인지 불가.
- **사용자 영향**: ACTIVE 업종 사용자가 "내가 노출 가능한 4채널(AI탭+ChatGPT+Gemini+Google AI)"을 헤더 영역에서 못 봄.
- **수정안 (P1)**: 지표1 라벨에 active/likely 4채널 또는 5채널 요약 추가.

#### P1-5. NaverTrackCard vs DualTrackCard 색상 컷오프 불일치
- **근거 1**: `NaverTrackCard.tsx:112~117` — 70/40 → 녹/파/빨 3단계
- **근거 2**: `DualTrackCard.tsx:122~128 getScoreStatusLabel` — 25/45/65/80 → **5단계** (주의/미흡/보통/양호/우수)
- **반증 시도**: 두 컴포넌트가 동일 사용자에게 다른 시점에 노출됨. Trial→구독 시 같은 점수가 다른 색·다른 라벨로 표시.
- **사용자 영향**: 시각적 일관성 훼손, 구독 후 "점수가 떨어진 줄 알았어"식 오해.
- **수정안 (P1)**: 두 컴포넌트 색상 척도 통일 (5단계 권장).

#### P1-6. NaverTrackCard LIKELY 확대 예정 단정
- **근거**: `NaverTrackCard.tsx:128~131` *"현재 네이버 AI 브리핑 공식 대상 업종이 아닙니다 (2026 확대 예정)"*
- **반증 시도**: P1-3 동일 패턴.
- **수정안 (P1)**: P1-3과 일괄 정정.

---

### P2 — 신뢰·일관성 (4건)

#### P2-1. v3.2 점수 모델에 `ai_tab_score` 항목 추가
- **근거 1**: `score_engine.py:194~195` 주석 *"AI 브리핑 전용. AI탭 측정은 P2 이후 구현 예정 (naver_ai_tab_visible 별도 항목으로 분리)"*
- **근거 2**: `ScoreEvidenceCard.tsx:13~17 V3_1_WEIGHTS` 모든 그룹에 `ai_briefing_score`만 존재, `ai_tab_score` **0건**
- **근거 3**: e77ab96 (2026-05-20) 커밋으로 측정 컬럼은 활성화됐으나 점수 모델 미반영
- **반증 시도**: 측정값이 0~1 boolean이라 기존 0~100 점수와 통합 시 가중치 분배 작업 필요. **P0이 아닌 점수 모델 v3.2 작업과 함께 처리**.
- **수정안 (P2)**: v3.2에서 active 5%·likely 10%·inactive 15% 가중치로 ai_tab_score 추가, 기존 항목 비율 재조정 (합계 100점 보존).

#### P2-2. NAVER_AD_IN_BRIEFING_ACTIVE 활성화 + 광고 안내 UI
- **근거 1**: `NaverAiPathwayCard.tsx:8` 상수 `NAVER_AD_IN_BRIEFING_ACTIVE = false`
- **근거 2**: 외부 보도 — 2026 Q2 광고 도입 예정 (다음 2026-04-30)
- **근거 3**: 백엔드 `score_engine.py:367~373 calc_naver_exposure()` ad_only 0점 처리 완비
- **반증 시도**: 백엔드는 준비됨. UI 안내 부족 — 사용자가 "광고로 노출됐는데 왜 점수 미반영?" 혼란 위험.
- **수정안 (P2)**: Q2 도래 시 토글 활성화 + UI 면책 문구 ("광고 영역 노출은 유기 점수에 미반영") 일관 적용.

#### P2-3. 대시보드 측정 시점 점수 카드 인근 부재
- **근거**: `dashboard/page.tsx:225` `lastScannedLabel` 계산되지만 `DashboardScoreZone` Props (`sections/DashboardScoreZone.tsx:26~41`)에 **lastScannedLabel 미포함**. `DashboardHeader`(line 311)에만 전달.
- **반증 시도**: 헤더에는 표시되지만 점수 카드와 같은 시야에 측정 시점이 없으면, 사용자는 "이 52점이 오늘 측정?" 알기 어려움.
- **사용자 영향**: 점수 신뢰의 핵심 조건 부재.
- **수정안 (P2)**: DashboardScoreZone Props에 `lastScannedLabel` 추가 + HeroCard 또는 Zone 하단에 "마지막 측정: X일 전" 노출.

#### P2-4. LIKELY 업종 "AI 브리핑 확대 예정" 정확성
- P1-3 일부와 중복되나, 외부 사양(네이버 공식 LIKELY → ACTIVE 승급 발표 없음) 모니터링 체크리스트 필요.
- **수정안 (P2)**: `briefing_category_expansion_monitor_job` (CLAUDE.md 기재, 매월 1일 09:00 KST) 정기 점검 + 알림.

---

### P3 — 누수 한정 (1건)

#### P3-1. DualTrackCard 벤치마크 배지 isEstimatedBenchmark prop 누락
- **근거**: `DualTrackCard.tsx:467~476` — `benchmarkAvg > 0` 조건만 체크, 추정 여부 무시
- **반증 시도**: `dashboard/page.tsx:420` `benchmarkAvg={benchmark?.fallback ? undefined : benchmark?.avg_score}` — **fallback 케이스는 page.tsx가 이미 보호**. 남은 누수는 표본 적은 응답(예: 3건).
- **수정안 (P3)**: DualTrackCard에 `isEstimatedBenchmark` prop 추가, 추정이면 배지 숨김.

---

## 4. 메타 점검 정정 이력 (3차)

### 4.1 1차 정정 (스캔 결과 종합 점검 → 재점검 1회차)
| 진단 | 정정 내용 |
|------|----------|
| P1#2 "DualTrackCard vs ScoreSummaryCard 단계 불일치" | **비교 대상 오판**. Trial에는 DualTrackCard 없음 → "Trial 내 gsLabel vs ScoreSummaryCard 자체 stage" 충돌로 정정 (현 P1-2) |
| P2#5 "DualTrackCard 벤치마크 배지 추정 여부 무시" | **강도 약화 P2 → P3**. page.tsx:420이 fallback 보호 중, 누수 한정 |

### 4.2 2차 정정 (재점검 1회차 → 최신 자료 조사)
| 진단 | 정정 내용 |
|------|----------|
| P2#4 "LIKELY 확대 예정 단정" | **부분 오판**. AI탭 확대 예정은 네이버 공식 발표 그대로 단정 정당. AI 브리핑 LIKELY 업종 확대만 신중 표현 필요. 두 맥락 분리 권고 (현 P1-3) |
| 새-3 "ScoreEvidenceCard 6항목에 ai_tab_score 부재" | **강도 상향 P3 → P2**. e77ab96 커밋으로 측정 활성화됐는데 점수 모델 미통합 (현 P2-1) |

### 4.3 3차 정정 (메타 점검 → AI탭 데이터 파이프 추적)
| 진단 | 정정 내용 |
|------|----------|
| 새-7 "AI탭 측정값 어디에도 표시 안 됨" | **2차에서 폐기 → 3차에서 부분 복원**. AiTabPreviewCard 분기 코드는 있으나 데이터 경로 단절로 measured 트리거 불가. 현 **P0-1로 복원·상향** |
| 새-8 "naver_reservation_linked 대시보드 미연동" | **2차에서 폐기 유지**. AiTabPreviewCard:280~290에서 has_reservation 정상 표시. `sp_completeness_json` 경로 작동 확인. |
| 오판 A·B·C 정정 (2차) | **3차에서 부분 재정정**. 카드 표시 코드는 있으나 데이터 경로 단절. P0-1로 정확한 단절 지점 3곳 기재 |

### 4.4 정정 사이클에서 얻은 교훈
1. **UI 분기 코드 존재 ≠ 데이터 실제 도달**. 분기 코드만 보고 "표시된다"고 단정하지 말 것.
2. **DB 컬럼명 ≠ 응답 키명**. top-level 컬럼과 JSONB 내부 필드 구분 필수.
3. **단정 근거 + 반증 시도** 양쪽 라인을 메인 세션이 직접 확인하지 않으면 메타 점검도 부정확.
4. 외부 사양은 WebSearch로 최신화 (2026-05 시점 보도 재확인).

---

## 5. 정확했던 진단 재확정 (8건)

3차 메타 점검 후에도 유지되는 진단:

| 진단 | 검증 라인 |
|------|----------|
| BriefingBadgeChip / BriefingCategoryBadge AI탭 누락 | `TrialResultStep.tsx:1233, 1737` grep 0건 |
| DualTrackCard track1Label에 "AI탭" 단어 0건 | grep 직접 확인 |
| DashboardHeroCard active/likely AI탭 누락 | grep 결과 inactive 2건만 |
| NaverAiPathwayCard 5채널 일체형 아님 | `NaverAiPathwayCard.tsx:57~149` 직접 정독 — Google AI 누락 |
| ScoreEvidenceCard V3_1_WEIGHTS에 `ai_tab_score` 0건 | `ScoreEvidenceCard.tsx:13~17` 정독 |
| Trial "확대 예정" 표현 11곳 | grep 결과 정확 |
| LockedScoreCard 더미 막대 자기모순 | `TrialResultStep.tsx:194~213` 직접 확인 |
| ScoreBreakdownBox Track1 비중 vs unified 혼동 | `TrialResultStep.tsx:594~628` 정독 |

---

## 6. 권장 수정 순서

### Day 1 (P0 — 신뢰 직격, 약 4~6시간)
1. **P0-1 AI탭 measured 파이프 단절 복구** (백엔드 3파일 수정)
   - `scan.py:2660~2671` JSONB 주입 추가
   - `report.py:1355` SELECT 보강
   - `briefing_engine.py:1556` fallback (선택)
2. **P0-2 LockedScoreCard 더미 막대 제거** (`TrialResultStep.tsx:194~213`)
3. **P0-3 ScoreBreakdownBox 레이블 정정** (`TrialResultStep.tsx:594~628`)
4. **P0-4 5채널 매트릭스 카드** (`NaverAiPathwayCard.tsx` 확장 + Trial 결과 동일 카드 노출)

### Day 2~3 (P1 — 친절·정확성, 약 6~8시간)
5. **P1-1 AI탭 표기 일괄 추가** (3개 컴포넌트)
6. **P1-2 Trial stage 라벨 통일** (ScoreSummaryCard 자체 계산 제거)
7. **P1-3 + P1-6 "확대 예정" 표현 분리** (11곳 + NaverTrackCard 1곳)
8. **P1-4 DashboardHeroCard 4채널 표기**
9. **P1-5 색상 컷오프 통일**

### Week 2 (P2)
10. **P2-1 v3.2 점수 모델 ai_tab_score 가중치 설계**
11. **P2-2 광고 안내 UI 사전 작업** (Q2 도래 대비)
12. **P2-3 lastScannedLabel 점수 카드 인근 노출**
13. **P2-4 LIKELY 모니터링 잡 확인**

### Later (P3)
14. **P3-1 DualTrackCard isEstimatedBenchmark prop**

---

## 7. 검증 의무 (CLAUDE.md 준수)

본 문서 기반 수정 작업 시:

1. **에이전트 위임 후 메인 세션 직접 검증** — `grep -n "<핵심 패턴>" <파일경로>` 또는 Read로 변경 라인 직접 확인
2. **서버 배포 후 SSH 검증** — `ssh root@115.68.231.57 "grep -n <패턴> /var/www/aeolab/<경로>"` 1줄 이상 확인. PM2 재시작 후 `error.log` 60줄 0건 확인
3. **단정 근거 라인 + 반증 시도 라인** 양쪽 직접 본 적이 있어야 다음 단계 진행
4. **데이터 파이프 추적** — UI 분기 코드만 보지 말고 저장→SELECT→매핑→응답→카드 전 단계 라인 확인 (3차 정정 교훈)

---

## 8. 부록 — 외부 사양 출처

- [네이버, AI탭 베타 출시 — 상반기 전체 확대 (한경)](https://www.hankyung.com/article/202604280890g)
- [네이버, AI탭 베타 출시 — 네이버플러스 우선 (인포스탁)](https://www.infostockdaily.co.kr/news/articleView.html?idxno=215567)
- [네이버 AI 수익화 시동 — 2분기 AI 브리핑 광고 테스트 (다음)](https://v.daum.net/v/20260430143241466)
- [네이버 AI 혁신 가속 — 쇼핑·광고·전방위 (네이트)](https://news.nate.com/view/20260504n22796)
- [최수연 대표 "AI탭, 4분기 전면 도입" (FETV)](https://www.fetv.co.kr/news/articleView.html?idxno=301557)
- [Naver Leads Multimodal AI Search Innovation (KoreaPlus)](https://koreaplus-lifes.com/naver-multimodal-ai-search-innovation/)
- [25년 만에 검색창 뒤집은 구글, AI탭 띄우는 네이버 (바이라인)](https://byline.network/2026/05/21_2018374/)

---

## 9. 내부 참조 문서

| 문서 | 위치 |
|------|------|
| AI 브리핑 vs AI탭 명확화 v1.0 | `docs/ai_briefing_vs_ai_tab_clarification_v1.0.md` (2026-05-18) |
| 네이버 AI탭 개발 로드맵 v1.1 | `docs/naver_ai_tab_개발로드맵_v1.1.md` (2026-05-17) |
| 네이버 AI 브리핑 2026-05 개선 | `docs/naver_ai_briefing_2026_05_improvements_v1.0.md` (2026-05-04) |
| 네이버 AI 브리핑 컴플라이언스 | `docs/naver_ai_briefing_compliance_v1.0.md` |
| 점수 체계 신뢰도 개선 | `docs/score_system_improvement_v1.0.md` (2026-05-22) |
| 네이버·GPT 작업 표준 | `docs/naver_gpt_work_standard_v1.0.md` |

---

*최종 작성: 2026-05-22 | 점검 차수: 1차 → 재점검 → 메타 점검 → 최신 자료 재조사 → 데이터 파이프 추적 (총 5단계) | 총 발견: P0 4건, P1 6건, P2 4건, P3 1건 = 15건*
