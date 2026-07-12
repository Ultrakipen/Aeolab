# 사업성(Business Viability) 점검 v1.0

> 작성일 2026-07-12. `docs/commercial_launch_readiness_audit_v1.0.md` C축 실행. A(보안)·B(법적)·D(인프라)에 이어 마지막 축.
> 원칙: 단정 전 반증 — 아래 각 발견은 실제 코드/DB/외부 공식자료 직접 확인 후 기재. 실사용자 0명 전제([[project_next_steps_handoff_execution_2026_07_11]]) 유지.

---

## 0. 요약

| 항목 | 결론 |
|---|---|
| Gemini thinking 토큰 미실측 | **원인 확인** — SDK(`google-generativeai==0.8.3`)가 thinking_config 자체 미지원, 코드로 끌 방법 없음. 비용 텔레메트리 신설(§1) — 단, thinking만 분리 표시는 Developer API 특성상 불가능함을 구현 중 자체 발견·정정(비용 합계 자체는 정확) |
| 마진율 수치 충돌(CLAUDE.md 85/78/70% vs plan_limits_v1.0.md 81/84/83/92%) | **PG 수수료 누락이 원인** — 두 문서 다 결제대행 수수료(4.3%+VAT) 미반영. 재계산 후 반영(§2) |
| 경쟁사 가격 포지셔닝 "없음" 주장 | **오판** — `competitor_talkb_analysis_v1.0.md`에 TalkB 정식 비교표 이미 존재. 재작업 불필요(§3) |
| 선행지표(trial 전환율) 부재 | **실제 공백 확인**(반증 실패 — cohort-analysis는 유료구독자 유지율만 다룸) → `/admin/growth-funnel` 신설(§4) |
| BEP 고정비 27,800원 외 항목 | PG 수수료는 변동비로 재분류, 도메인 갱신비 소액 미반영(정확한 금액은 사용자만 확인 가능)(§5) |

---

## 1. Gemini 2.5 Flash thinking 토큰 — 근본 원인 확인 + 텔레메트리 신설

### 발견

- `backend/services/ai_scanner/gemini_scanner.py`는 어디서도 `GenerationConfig`에 thinking 관련 설정을 하지 않음(`gemini_scanner.py:38` `genai.GenerativeModel("gemini-2.5-flash")` 인자 없이 생성)
- 설치된 SDK `google-generativeai==0.8.3`의 `GenerationConfig.__init__` 시그니처에 thinking 관련 파라미터 없음(직접 실행 확인: `inspect.signature`)
- 더 근본적으로, 이 SDK의 protobuf `GenerationConfig` 자체에 `thinking_config` 필드가 없음(`protos.GenerationConfig.pb().DESCRIPTOR.fields_by_name.keys()` 실행 결과: `candidate_count, stop_sequences, max_output_tokens, temperature, top_p, top_k, response_mime_type, response_schema, presence_penalty, frequency_penalty, response_logprobs, logprobs` — thinking 계열 없음)
- 이 SDK는 Gemini 2.5 출시 이전 세대 proto 스키마를 쓰고 있어 **코드로 thinking을 끌 방법이 구조적으로 없음**
- Google 공식 문서 확인(WebSearch): Gemini 2.5 Flash는 `thinking_budget`을 명시하지 않으면 **동적 사고(-1, Auto)가 기본값** — 모델이 프롬프트 복잡도에 따라 자체 판단해 사고 토큰을 소비하며, 이 토큰은 출력 단가($2.50/1M)로 과금됨
- `google-generativeai` 패키지의 최신 버전은 0.8.6(설치본 0.8.3)이나, Google이 권장하는 정식 경로는 후속 통합 SDK `google-genai`(현재 2.11.0) 마이그레이션 — 레거시 패키지의 thinking 지원 여부는 버전별로 불명확함

### 추가 발견 — 텔레메트리 전무

- Gemini·ChatGPT·Claude(Sonnet/Haiku) 어떤 호출 경로에도 `usage_metadata`/`usage` 토큰 카운트를 로깅하는 코드가 전혀 없었음(`grep -rn "usage_metadata|prompt_token_count|completion_tokens"` backend 전체 0건)
- 결론: **CLAUDE.md·`plan_limits_v1.0.md`의 모든 마진율 수치는 코드 출시 이후 단 한 번도 실측 검증된 적이 없다.** 실사용자 0명이라는 사실과 별개로, 지금 서비스 중인 무료 체험(trial) 트래픽조차 비용이 전혀 계측되지 않고 있었음.

### 조치 (구현 완료, 배포 대기)

1. `backend/services/ai_usage_logger.py` 신설 — provider/model/purpose/tokens_in/tokens_out/thinking_tokens/estimated_cost_krw를 fire-and-forget으로 `ai_usage_log` 테이블에 기록. 실패해도 스캔 흐름에 영향 없음(try/except 전체 흡수)
2. **1차 구현 오류 자체 발견·수정**: 처음엔 thinking 토큰을 `total_token_count - prompt_token_count - candidates_token_count`로 역산하려 했으나, WebSearch로 Google 공식 문서 재확인 결과 **Gemini Developer API(이 코드가 쓰는 `genai.configure()` 방식)는 `candidates_token_count`에 thinking 토큰이 이미 포함**되어 있음(Vertex AI만 별도 분리) — 즉 `total == prompt + candidates`가 항상 성립해 역산값은 늘 0에 가까웠고 "사고를 안 했다"로 오독될 위험이 있었음. **비용 계산 자체는 정확**(candidates_token_count에 이미 thinking 비용이 녹아있어 `tokens_out`만으로 정확한 청구액 산출)하지만 `thinking_tokens` 필드는 분리 표시가 SDK 레벨에서 불가능해 항상 `NULL`로 수정 — 컬럼은 향후 Vertex AI 전환 대비 보존
3. 계측 위치 — `generate_content`/`chat.completions.create` 직접 호출부 **전수 커버**(재점검 후 확장, 최초 구현은 상위 2곳만이었으나 code-review에서 `single_check_with_competitors` 등 3곳 누락 지적받아 즉시 보완):
   - `gemini_scanner.py`: `_check()`, `_check_with_context()`, `_natural_check()`, `single_check_with_competitors()`, `analyze_mention_context()` — 5개 직접 호출부 전체(`single_check()`은 `_check()`를 내부 호출하므로 간접 커버). `grep -n "generate_content|_log_usage" gemini_scanner.py`로 1:1 대응 확인 완료
   - `chatgpt_scanner.py`: `_check()`, `check_citation()` — 2개 직접 호출부 전체(`sample_5/10/50/100`은 전부 `_check()` 내부 호출이라 간접 커버, trial의 실제 진입점인 `sample_5`도 포함)
   - Haiku 호출부(`guide_generator.py` 등)는 여전히 미포함 — 응답에서 `.content[0].text`만 추출하고 전체 응답 객체를 버리는 구조라 계측하려면 각 호출부 리팩터링이 필요함(더 큰 변경, §6 후속 과제로 명시적 이관. "누락"이 아니라 "범위 밖으로 의도적으로 뺀 것"임을 구분)
4. 신규 테이블 `ai_usage_log` — `scripts/supabase_schema.sql` 하단에 추가. **Supabase SQL Editor에서 수동 실행 필요**(Management API 미지원, CLAUDE.md 표준 절차)
5. `/admin/growth-funnel`과 별개로, 이 데이터가 1~2주 누적되면 `ai_usage_log` 집계로 진짜 마진율을 계산할 수 있는 관리자 엔드포인트를 후속 세션에서 추가 권장(이번 세션은 계측 인프라까지만)
6. **code-review 검증 완료** — P0 없음. P1 1건(`_insert`에 `asyncio.wait_for` timeout 5초 미지정 시 스레드풀 고갈 위험) + P2 2건(`RuntimeError`·insert 실패 로그가 `debug`라 운영 로그에 안 보임, `/growth-funnel`의 `auth.users.created_at` 문자열 비교가 포맷 불일치로 경계일 데이터 누락 가능) 전부 즉시 수정·재검증 완료

### 미조치 — SDK 마이그레이션(권장, 실행은 보류)

- thinking을 실제로 0으로 강제하려면 `google-genai`(신규 통합 SDK)로 스캐너를 마이그레이션해야 함
- **이번 세션에서 실행하지 않음** — 스캔 엔진 핵심 경로(라이브 트래픽 있는 trial 포함) 변경은 CLAUDE.md `scan-engine` 영역 리스크가 크고, 실측 데이터(§1 텔레메트리) 없이 "지금 비싸다"를 단정할 근거가 부족했기 때문. **권장 순서**: ① 텔레메트리로 2주 실측 → ② thinking 토큰이 실제로 유의미한 비중이면(예: 전체 비용의 20%+) 그때 SDK 마이그레이션 착수. 이유 없이 먼저 리스크를 감수하지 않음.

---

## 2. 마진율 재계산 — PG 수수료 누락 발견 + 반영

### 근본 원인

두 문서(CLAUDE.md, `plan_limits_v1.0.md`)의 마진율은 전부 **"매출 − API 비용"**만 계산했고, **결제대행(PG) 수수료를 어디에도 반영하지 않음**. 코드에서도 `docs/`에서도 "수수료"·"PG"·"fee_rate" 관련 언급 0건(grep 확인).

WebSearch로 토스페이먼츠 공식 수수료 확인: **정기결제(빌링) 신용/체크카드 수수료 4.3% + 그 수수료에 대한 부가세(VAT) 10% 별도** → 실효 약 4.73%. (영세·중소 사업자는 국세청 명단 기반 우대 등급이 매년 상반기/하반기 자동 반영되나, 신규 가입 시 기본은 '일반' 등급 — 우대 적용 여부는 사용자 사업자 등급 확인 필요, 이 문서는 보수적으로 일반 등급 4.3%로 계산)

### 재계산 결과

| 구분 | 매출 | API 비용(기존 추정, 미검증) | PG 수수료(4.73%, 신규 반영) | 총 비용 | **마진율(수정)** | 기존 문서 마진율 |
|---|---:|---:|---:|---:|---:|---:|
| Basic | 9,900원 | 1,876원 | 468원 | 2,344원 | **76.3%** | 81%(plan_limits) / 85%(CLAUDE.md) |
| 창업패키지 | 12,900원 | 2,021원 | 610원 | 2,631원 | **79.6%** | 84% |
| Pro | 18,900원 | 3,159원 | 894원 | 4,053원 | **78.6%** | 83% / 78%(CLAUDE.md) |
| Biz(1사업장) | 49,900원 | 4,093원 | 2,360원 | 6,453원 | **87.1%** | 92% / 70%(CLAUDE.md) |

> **주의**: "API 비용" 열 자체가 §1에서 확인했듯 실측이 아닌 가정치(Gemini thinking 토큰 미반영 가능성 있음) — 위 마진율은 "PG 수수료 반영"이라는 한 축만 교정한 것이며, API 비용 축의 불확실성은 §1 텔레메트리 실측 후 별도 재교정 필요. **두 불확실성이 겹쳐 있다는 점을 명시**(CLAUDE.md 표준: 검증된 사실과 추정을 한 문장에 섞지 않음).
> CLAUDE.md의 기존 "85%/78%/70%"는 2026-06-25 API 단가 정정 이전 값으로 보이며 산출 근거를 코드에서 찾을 수 없어(grep 0건) 폐기 — `plan_limits_v1.0.md` 계열 수치를 기준으로 PG 수수료만 교정.

### 조치
- CLAUDE.md "마진율" 줄 교정(§7 참조)
- `plan_limits_v1.0.md`는 다음 세션에서 전면 갱신 권장(§6 후속 과제) — 이번 세션은 CLAUDE.md 스냅샷 정정까지만

---

## 3. 경쟁사 가격 포지셔닝 — 반증으로 오판 확인

원 감사 문서(`commercial_launch_readiness_audit_v1.0.md`)는 "대행업체 가격 조사는 있으나 정식 경쟁 가격표 비교는 없음"이라 기재했으나, 확인 결과 **이미 존재함**:

- `docs/competitor_talkb_analysis_v1.0.md` §2 "가격 비교(핵심)" — TalkB Insights(₩49,000/월) vs AEOlab Basic(₩9,900) 등 4단계 정식 대조표 존재
- 메모리([[project_competitor_talkb]])에도 "네이버 없음이 해자" 결론 + 대응 런북 기존재 확인
- **판정: 오판. 재작업 불필요.**

### 참고 — 신규 발견(검증 필요, 결론 아님)

WebSearch 중 "RanketAI"라는 국내 AI 가시성(GEO/AEO) 진단 도구가 발견됨(Starter 12,900원/월 — AEOlab 창업패키지와 동일가). **주의**: 이 가격 정보의 출처가 RanketAI 자사 블로그(`ranketai.com`)로, 제3자 독립 검증이 아닌 자사 마케팅 콘텐츠임. 사실로 단정하지 않고 "확인 필요한 신규 경쟁사 후보"로만 기록. TalkB처럼 정식 분석이 필요하면 별도 세션 권장(이번 세션 범위 아님).

---

## 4. 선행지표(Leading Indicator) — 실제 공백 확인 후 구현

### 반증 시도 (CLAUDE.md 표준)

- `backend/routers/admin.py`의 `/cohort-analysis`(2026-07-10/11 신설)를 직접 확인 → `subscriptions` 테이블만 조회, **유료 구독을 시작한 사람의 이후 유지율**만 다룸. trial→가입→유료전환의 "맨 위 깔때기"는 다루지 않음(코드 확인, admin.py:485-550)
- `/admin/stats`의 `basic_trial_used_count`는 로그인 후 1회 무료 스캔을 사용한 **누적 인원 수**만 카운트, 시계열도 아니고 전환율도 아님(admin.py:48-50)
- **결론: 오판 아님, 실제 공백.** (CLAUDE.md 표준 "반증 시도 1개 이상" 충족 — 코드 직접 확인으로 반증 시도했으나 공백이 실제로 존재함을 확인)

### 구현

`/admin/growth-funnel` 엔드포인트 신설(`admin.py`, `/cohort-analysis` 다음 위치):
- 주차별 4단계 발생 건수: `trial_scans`(무료체험) → `signups`(auth.users 신규가입) → `businesses_registered`(사업장 등록) → `paid_conversions`(`payment_events` 테이블의 `billing_issue`+`success` — 2026-07-10/11 신설된 실제 결제 성공 이력)
- `signup_to_paid_rate_pct` — auth.users와 payment_events는 둘 다 user_id 기반이라 **실제 신뢰 가능한 매칭**
- **data_caveat 명시**: `trial_scans`는 비로그인 익명 스캔이라 `user_id`가 없음 — 개인 단위 "이 트라이얼 사용자가 결국 가입했는지" 추적은 불가능(이메일은 선택 입력이라 매칭 신뢰 불가). 주차별 단계 발생 건수 스냅샷이며 코호트 추적이 아님을 응답에 명시적으로 포함(허위 정밀도 방지 — CLAUDE.md 실측 원칙)
- 개인 단위 추적이 필요하면 `trial_scans`에 `user_id` 컬럼 추가 + 로그인 유도 시점 재설계가 필요 — 별도 기능 기획(§6 후속 과제)

---

## 5. BEP 20명 고정비 재검증

| 항목 | 상태 |
|---|---|
| 서버비 27,800원(iwinv) | CLAUDE.md 기재값 — 코드/DB에 근거 없음(청구서 기반 추정으로 보임), 사용자만 실제 청구액 확인 가능 |
| PG 수수료 4.3%+VAT | **변동비로 재분류**(거래액 비례) — §2에서 마진율에 반영 완료, "고정비"로 분류하면 안 됨 |
| 도메인(.co.kr) 갱신비 | 연 단위 결제를 월 환산 시 소액(통상 2~3만원/년 → 월 1,700~2,500원) 발생 예상 — **정확한 금액은 코드에 없어 사용자 확인 필요**, 임의 추정치를 확정값으로 기재하지 않음 |
| Supabase Free Tier | D축(`legal_compliance_and_infra_resilience_audit_v1.0.md:56`)에서 이미 "실사용자 0명이라 리스크 낮음, 구독자 확보 후 재점검"으로 의도적 보류 확인됨 — 중복 재작업 안 함 |
| 이메일 호스팅(contact@aeolab.co.kr) | 메모리([[project_email_setup]]) 확인 결과 iwinv 메일 서버 사용 — 서버비 27,800원에 이미 포함된 것으로 추정되나 별도 청구 여부는 사용자만 확인 가능 |

**결론**: BEP 20명 = "월 비용 약 8만원" 전제(CLAUDE.md)는 고정비만 놓고 보면 여전히 유효한 근사치(서버비가 압도적 비중). 다만 **PG 수수료가 고정비 계산에서 완전히 빠져 있었다는 점**이 이번 점검의 핵심 발견 — BEP 20명 시점 월매출 약 20만원 기준 PG 수수료만 약 9,500원(4.73%) 추가 발생, "8만원"에는 미반영.

---

## 6. 후속 과제 (이번 세션 범위 밖, 우선순위 순)

1. **Gemini SDK 마이그레이션 검토** — §1 텔레메트리 2주 실측 후, thinking 토큰이 유의미한 비중이면 `google-genai` 마이그레이션 착수 (scan-engine 영역, 리스크 있어 신중 진행)
2. **Claude Sonnet/Haiku 호출부 텔레메트리 확장** — `guide_generator.py` 등 7곳+ 호출부가 `.content[0].text`만 추출하고 응답 객체 전체를 버려서, 현재 구조에서 로깅하려면 각 호출부 리팩터링 필요(더 큰 변경, 이번 세션 범위 제외). ROI 우선순위는 낮음(Sonnet 호출은 월 3~20회로 플랜 한도가 이미 낮음, Gemini/ChatGPT 스캔 대비 총비용 비중 작음)
3. **`ai_usage_log` 집계 관리자 엔드포인트** — 데이터 누적 후 실제 마진율 계산용 대시보드
4. **RanketAI 등 신규 경쟁사 정식 분석** — TalkB 수준의 검증된 비교 필요 시
5. **trial_scans 개인 단위 코호트 추적** — `user_id` 컬럼 추가 + 로그인 시점 재설계, 별도 기능 기획 필요
6. **PG 수수료 우대 등급 확인** — 국세청 영세/중소 우대 적용 여부 사용자 확인(적용되면 4.3%보다 낮아져 마진율 추가 개선 가능)

---

## 7. CLAUDE.md 반영 사항

- "마진율: Basic 85%, Pro 78%, Biz 70%" → PG 수수료 반영한 §2 수치로 교정
- "AI Visibility Score" 섹션 근처 "API 비용 관리" 표에 PG 수수료 누락 사실 및 텔레메트리 신설 각주 추가
- 데이터베이스 테이블 목록에 `ai_usage_log` 추가
