# AEOlab 서비스 상품 카탈로그 v1.1

> **작성일**: 2026-05-19 (v1.1 — 2026-04-14 작성 v1.0 대비 코드 직접 검증 후 전면 개정)
> **목적**: 사용자(잠재 구독자·기존 사용자·홍보 담당자)에게 AEOlab이 제공하는 **모든 주요 상품·부수 기능·무료 도구**를 빠짐없이 설명하기 위한 종합 문서
> **검증 방식**: 백엔드 API(`backend/routers/*` 29개) + 프론트 페이지(`frontend/app/**`) + 플랜 게이트(`backend/middleware/plan_gate.py`) + 가격 단일 소스(`backend/config/prices.py`·`frontend/lib/plans.ts`) 코드 직접 확인. CLAUDE.md만 보고 작성하지 않음.
> **단일 사실 소스**: 본 문서와 코드 충돌 시 **코드가 정답**. 충돌 발견 시 즉시 본 문서 갱신.
> **사용자 노출 면책**: 측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있음. AI 노출은 보장이 아니라 진단 + 개선 가이드.

---

## 0. 한눈에 보기

**AEOlab(AI Engine Optimization Lab)** 은 한국 소상공인을 위한 **AI 검색 노출 진단·개선·대행 통합 플랫폼**이다.

- **핵심 가치**: "내 가게가 네이버 AI 브리핑·AI탭에 잘 나오는지 + ChatGPT/Gemini가 어떻게 인식하는지 + 인근 경쟁사 대비 부족한 점을 측정·개선" 한 곳에서 처리
- **3대 사용자**: 소상공인(사업장 성장) / 예비 창업자(시장 조사) / 시장 조사자(업종 분석)
- **점수 모델**: 듀얼트랙(Track1 네이버 + Track2 글로벌) — 업종별 가중치 분기(restaurant 70/30, legal 20/80 등)
- **AI 스캐너 4종**: Gemini 2.0 Flash · OpenAI gpt-4o-mini · 네이버 AI 브리핑(Playwright) · Google AI Overview(Playwright)
- **상품 구조**: 구독 SaaS 6 플랜 + 대행 서비스 3 패키지 + 무료 도구 + 무료 진단

```
[상품 1] 구독 SaaS     ─ Free / Basic / 창업 / Pro / Biz / Enterprise
[상품 2] 대행 서비스   ─ 스마트플레이스 등록 / AI 최적화 / 종합 풀패키지 + 1:1 코칭
[상품 3] 무료 도구     ─ 무료 진단 / 키워드 추천 / 광고비 계산기 / 메뉴 엑셀 양식 (Basic+)
```

---

## 1. 주요 상품 ①: 구독 SaaS

### 1.1 플랜 한눈에

| 플랜 | 월 가격 | 첫 달 할인 | 한국어 표시명 | 주요 타겟 | 결제 |
|---|---|---|---|---|---|
| **Free** | 0원 | — | 무료 체험 | 신규 가입자 | 결제 불필요 |
| **Basic** | 9,900원 | 4,950원 (신규 1회) | Basic | 소상공인 첫 시작 | 토스 자동결제 |
| **창업패키지** | 12,900원 | — | 창업패키지 | 예비 창업자 | 토스 자동결제 |
| **Pro** | 18,900원 | — | Pro | 성장 중인 가게 | 토스 자동결제 |
| **Biz** | 49,900원 | — | Biz | 다점포·대행사 | 이메일 영업 |
| **Enterprise** | 200,000원 | — | Enterprise | 대규모 조직 | 이메일 영업 |

> **연간 결제** (10개월치, 약 17% 할인) — Basic 99,000원 / 창업 129,000원 / Pro 189,000원 / Biz 499,000원

### 1.2 첫 달 50% 할인 정책 (신규 가입자 전용)

- **대상**: Basic 플랜 한정. 이전에 구독 이력이 전혀 없는 사용자만
- **금액**: 정상 9,900원 → **첫 결제 4,950원**
- **기간**: 30일 (`subscriptions.first_month_discount_until` 기록)
- **자동 정상가 전환**: 만료 후 매월 9,900원 자동 청구
- **서버 재검증**: 클라이언트가 `amount=4950` 조작해도 `_is_first_time_subscriber()` 검증 후 400 거부

### 1.3 플랜별 기능 매트릭스 (PLAN_LIMITS 단일 소스)

| 항목 | Free | Basic | 창업 | Pro | Biz | Enterprise |
|---|---|---|---|---|---|---|
| 사업장 등록 한도 | 1개 | 1개 | 1개 | **2개** | **5개** | 무제한 |
| 경쟁사 등록 한도 | 0개 | 3곳 | 5곳 | 5곳 | **무제한** | 무제한 |
| 수동 스캔 (일) | 1회 (첫 1회만) | 2회 | 3회 | 5회 | 15회 | 무제한 |
| 자동 스캔 주기 | — | 주 1회 (월) | 주 1회 (월) | **주 3회 (월·수·금)** | **매일** | 매일 |
| 자동 스캔 엔진 | — | Gemini 50 + ChatGPT 50 + 네이버 | 동일 | 4종 풀스캔 | 4종 풀스캔 | 4종 풀스캔 |
| AI 개선 가이드 (월) | 0 | 3회 | 5회 | 10회 | 20회 | 무제한 |
| 리뷰 답변 초안 (월) | 0 | 20회 | 무제한 | 무제한 | 무제한 | 무제한 |
| 소개글·FAQ·소식 (월) | 0 | 5건 | 20건 | 30건 | 60건 | 무제한 |
| 블로그 분석 (월) | 0 | 3회 | 5회 | 10회 | 무제한 | 무제한 |
| 히스토리 보관 | 0일 | 60일 | 90일 | 90일 | 무제한 | 무제한 |
| CSV 내보내기 | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PDF 리포트 | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| 스키마 생성 (JSON-LD) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ChatGPT 광고 대응 가이드 | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| 창업 시장 분석 리포트 | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ |
| Public API 키 (외부 연동) | ✗ | ✗ | ✗ | ✗ | ✓ (5개) | 무제한 |
| 팀 계정 멤버 | — | — | — | — | 5명 | 20명 |

### 1.4 플랜별 핵심 가치 한 줄 (frontend/lib/plans.ts killerFeature 기준)

- **Free** — 가입 없이 1분 만에 내 가게 AI 노출 진단
- **Basic** — ChatGPT 절반 가격으로 ChatGPT가 못 하는 것(내 가게 네이버 AI 노출 매주 자동 감시)
- **창업패키지** — 창업 전 이 지역·업종 AI 경쟁 현황 + 아무도 안 쓰는 틈새 키워드
- **Pro** — 매일 자동 감시 + 내 행동이 AI에 반영됐는지 7일 후 자동 증명
- **Biz** — 5개 매장 매일 풀스캔 + 팀 5명 협업 (5개 Basic 개별보다 저렴)
- **Enterprise** — 사업장 무제한 + 팀 20명 + API 키 무제한 (영업 전용)

### 1.5 구독 상태 관리

| 상태 | 설명 | 사용자 영향 |
|---|---|---|
| **active** | 정상 구독 중 | 모든 플랜 기능 사용 |
| **grace_period** | 자동결제 실패 후 3일 유예 | 유료 기능 계속 사용 (재결제 유도) |
| **expired** | 유예 종료 | Free로 강등 |
| **cancelled** | 사용자 직접 해지 | 다음 갱신일까지 사용 후 종료 |

---

## 2. 주요 상품 ②: 대행 서비스 (별도 상품, 1회성 결제)

> 운영자 1인 직접 작업 (BEP 50명 도달 후 외주 검토). 주 5건 / 월 20건 한계.

### 2.1 패키지 3종

#### ① 스마트플레이스 등록 대행 — **49,000원**
- **타겟**: 스마트플레이스를 처음부터 시작하는 사장님
- **작업 시간**: 약 5.2시간 (시급 환산 ~9,420원)
- **포함**:
  - 소개글 1,000자 작성
  - 기본정보 등록 (영업시간·휴무·전화·주차·결제수단)
  - 메뉴/상품 30개 등록
  - 키워드 5개 발굴·등록
  - 카테고리 최적화
  - 사용자 제공 사진 업로드·분류 (외관/내부/메뉴)
  - 작업 전/후 스크린샷 + 체크리스트 PDF + 완료 보고서
- **사용자 제공**: 메뉴 사진·가격표, 영업정보 폼, 매장 콘셉트 3문장, 스마트플레이스 부운영자 권한
- **보장**: 등록 완료 보장. 7일 내 자료 미제출 시 자동 취소 + 환불

#### ② AI 검색 최적화 — **79,000원**
- **타겟**: 스마트플레이스 운영 중, 시간이 없어 직접 작업 불가한 사장님
- **작업 시간**: 약 6.0시간 (시급 환산 ~13,166원)
- **포함**:
  - 진단 결과 확인·부족 항목 정리
  - 소개글 AI 브리핑 친화 재작성 (C-rank 4요소 반영)
  - 톡톡 채팅방 메뉴 5종 작성 (예약·메뉴추천·주차·이벤트·문의)
  - 첫 소식 1회 작성·발행
  - 후기 답글 템플릿 10개 (긍정·중립·부정 패턴별)
  - 메뉴 설명 AI 친화적 재작성 (30개)
  - 키워드 갭 분석 + 부족 키워드 보강
  - 작업 완료 보고서 + 콘텐츠 백업 PDF + AI 브리핑 5단계 체크리스트
- **시장 가격 대비**: 시장 30만원/월 → AEOlab **26%** (1회성)

#### ③ 종합 풀패키지 — **119,000원**
- **타겟**: 신규 시작 + AI 노출까지 한 번에 끝내고 싶은 사장님
- **할인**: 개별 합산 158,000원 대비 **39,000원 (24.7%) 할인**
- **포함**:
  - 패키지 ① 전체 + 패키지 ② 전체
  - **1:1 화상 코칭 60분** (작업 결과 설명 + 운영 가이드)
  - **30일 후 자동 재진단** + 결과 보고서 PDF
- **결과 약속**: 30일 후 자동 재진단으로 작업 효과 증명. 점수 변동 미미 시 무료 재작업 1회

### 2.2 옵션: 1:1 화상 코칭 60분 추가 — **30,000원/회**
- 화면 공유로 함께 작업 + 사장님 직접 학습
- 질문 답변 (AI 브리핑·키워드·운영 노하우)
- 다음 액션 체크리스트 제공

### 2.3 주문 플로우 (상태 4단계)

```
[접수 received]    → 사용자 의뢰 작성
[결제 paid]        → 토스페이먼츠 결제 + 카카오 알림톡 발송
[진행 in_progress] → 운영자 작업 시작 + 카카오 알림톡
[완료 completed]   → 보고서 등록 + 카카오 알림톡 + 후기 요청
```

### 2.4 카카오 알림톡 3종 (대행 전용)

1. 접수 완료 — 주문 확인 + 예상 처리 기간
2. 진행중 — 작업 시작 알림 + 예상 완료일 (3일)
3. 완료 — 작업 완료 + 보고서 조회 링크

### 2.5 비밀 의뢰 게시판 + Q&A 게시판 (Sprint 1+ 진행 중)

- **비밀 의뢰** — 동종 업계 노출 우려 시 비공개 의뢰 가능
- **Q&A 게시판** — 사용자 문의(요금제별 월 한도): Free 1회 / Basic 3회 / Pro+ 무제한. 관리자 답변 공개/비공개 전환 가능

---

## 3. 주요 상품 ③: 무료 도구 (회원가입 불필요)

| 도구 | 경로 | 설명 | 비용 |
|---|---|---|---|
| **무료 진단** | `/trial` | 가게명 + 업종 입력 → 1분 만에 AI 노출 점수·채널별 분석·개선 과제 제시 (IP당 일 3회) | 무료 |
| **무료 키워드 도구** | `/tools/keyword` | 가게명 + 업종 → AI 추천 키워드 5~10개 즉시 생성 (쿨다운 3초) | 무료 |
| **광고비 계산기** | `/tools/ad-cost-calculator` | 네이버·구글 광고비 대비 AI 브리핑 비용 효율 비교 | 무료 |
| **빠른 체험** | `/quick` | 업종·지역 선택 → 벤치마크 결과 (목업 아닌 실 인덱스) | 무료 |
| **데모 미리보기** | `/demo` | 업종별 대시보드 프리뷰 (예시 데이터 명시) | 무료 |
| **결과 공유 카드** | `/api/share/image/{trial_id}` | 진단 결과 카카오톡 공유용 PNG 카드 (24h 캐시) | 무료 |
| **메뉴 일괄 등록 양식** | `/api/tools/menu-template.xlsx` | 50행 × 8열 Excel 양식 (틀 고정·서식 포함) | Basic+ |
| **톡톡 메뉴 템플릿** | `/api/tools/talktalk-templates/{category}` | 업종별 5종 템플릿 | Basic+ |
| **후기 답글 템플릿** | `/api/tools/reply-templates/{category}/{sentiment}` | 업종·감정별 템플릿 | Basic+ |

---

## 4. 핵심 기능 카탈로그

### 4.1 진단·스캔

- **AI Visibility Score (듀얼트랙 v3.0)** — Track1 네이버 + Track2 글로벌, 업종별 가중치 자동 분기
- **AI 스캐너 4종** — Gemini 2.0 Flash · ChatGPT gpt-4o-mini · 네이버 AI 브리핑(Playwright) · Google AI Overview(Playwright)
- **스캔 모드 4종**:
  - **Trial** (비로그인 1분 진단, ChatGPT 5회 + 네이버)
  - **Quick** (ChatGPT 5회 + 네이버)
  - **Basic 자동** (Gemini 50회 + ChatGPT 50회 + 네이버)
  - **Full 유료** (Gemini 100회 + ChatGPT 100회 + 네이버 + Google)
- **실시간 SSE 진행률** — `POST /api/scan/stream/prepare` → `GET /api/scan/stream` (60초 OTP)
- **AI 인용 실증** — 어느 AI에서 어떤 쿼리로 노출됐는지 발췌문·감정·언급 유형 저장 (`ai_citations`)
- **점수 시계열 30일** — Before/After 비교 + 30일 추세선
- **스마트플레이스 완성도 자동 점검** — 소개글·FAQ·소식·사진·메뉴 등 14개 체크포인트

### 4.2 네이버 AI 브리핑 + AI탭 분리 대응 (v1.0, 2026-05-18)

- **AI 브리핑** — 5개 ACTIVE 업종(restaurant·cafe·bakery·bar·accommodation) + LIKELY 6업종 + INACTIVE 14업종 분기
- **AI탭** — 모든 업종 가능 (2026-04-27 베타 시작)
- **NaverAiPathwayCard** — AI 브리핑 vs AI탭 비교 + 자기 업종 자동 배지
- **AI탭 답변 시뮬레이션** — 실측 vs 추정 배지 분리, 면책 문구 자동 표시
- **AI 브리핑 게이팅** — ACTIVE 업종 + 비프랜차이즈만 (네이버 공식 정책)

### 4.3 AI 가이드·콘텐츠 생성 (Claude Sonnet/Haiku)

- **AI 개선 가이드** — Claude Sonnet 기반 맞춤형 ActionPlan (7일/30일 목표 + 우선순위 + 도구)
- **스마트플레이스 소개글 생성** — 업종별 D.I.A. 5요소 강제 + 사후 검증
- **글로벌 AI 오버뷰용 소개글** — Pro+ (ChatGPT·Gemini 친화)
- **톡톡 채팅방 메뉴 FAQ 자동 생성** — Q&A 형식 (구 Q&A탭 폐기 대응)
- **블로그 주제 아이디어 제안** — 업종·키워드 기반
- **리뷰 답변 초안** — Claude Haiku (긍정·부정·중립 톤 분기)
- **악성 리뷰 위기 대응 초안** — `crisis-reply` 엔드포인트
- **광고 방어 가이드** — Pro+ (경쟁사 광고 대응 전략)
- **JSON-LD 스키마 생성** — Basic+ (구조화 데이터)
- **QR 코드 생성** — 방문 유도용

### 4.4 키워드 관리

- **키워드 자동 제안** — Claude Haiku 4.5, 미리보기(`/keyword-suggest-preview`) 비용 0
- **커스텀 키워드 등록/제외** — 사용자 수동 관리
- **키워드 검색량 추이** — Pro+, 네이버 SearchAd API
- **키워드 순위 측정** — Basic 주 1회 / Pro 매일 자동
- **30일 키워드 트렌드** — `/keyword-trend/{biz_id}`
- **키워드 CSV 다운로드** — Pro+
- **선점 키워드 상세** — Basic+ (틈새 키워드 발굴)
- **키워드 갭 분석** — 경쟁사 대비 누락 키워드 표시

### 4.5 경쟁사·시장 분석

- **경쟁사 자동 제안** — Naver + Kakao Local API 검색
- **경쟁사 상세 분석** — 블로그·웹사이트·리뷰 심층
- **경쟁사 약점 분석** — 대응 전략 자동 생성
- **경쟁사 FAQ 갭** — 우리가 미처 작성 안 한 항목
- **경쟁사 변화 감지** — 순위 변동·신규 콘텐츠 알림
- **새 경쟁사 자동 감지** — 주 1회 신규 진입 업체 발견
- **경쟁사 추월 알림** — 매일 모니터링
- **업종·지역 TOP10 랭킹** — `/api/report/ranking/{category}/{region}` (30분 캐시)
- **업종 벤치마크** — 1시간 캐시
- **시장 환경 분석** — `/api/report/market/{biz_id}`
- **업종 산업 동향** — `/api/report/industry-trend/{category}`
- **창업 타이밍 지수** — 공개 API
- **창업 시장 리포트** — 창업패키지·Biz 전용

### 4.6 블로그 분석

- **블로그 AI 진단** — 네이버·티스토리·워드프레스 (포스트 수, 키워드 커버리지, AI 브리핑 준비도)
- **블로그 스크린샷 캡처** — 수동·자동
- **블로그 언급 수 추적** — `blog_mentions` 카운트 → Track1 점수 반영
- **블로그 UGC 가이드** — AI탭 노출용
- **주간 소식 초안 자동 생성** — 월 1회 (Claude 호출)

### 4.7 행동-결과 추적 (Pro+ 강점)

- **행동 로그 기록** — FAQ 게시·블로그 작성·리뷰 답변 등 사용자 행동 시간 기록
- **7일 후 자동 재스캔** — 행동의 AI 반영 여부 자동 증명
- **Before/After 점수 채우기** — 매일 03:30 자동
- **점수 기여도 분석** — 6개 항목별 가중치 (`/score-attribution/{biz_id}`)
- **점수 시뮬레이션** — 행동 후 예상 점수 미리보기
- **점수 근거 상세 설명** — `/score-explanation/{biz_id}`

### 4.8 사진·콘텐츠 진단 (v3.0+)

- **사진 카테고리 자동 분류** — 9업종 × 3~4 카테고리 (외관·내부·메뉴·분위기 등)
- **사진 카테고리 완성도 카드** — 누락 카테고리 안내
- **업종별 사진 촬영 가이드** — 모달 UI
- **콘텐츠 품질 검증** — D.I.A. 5요소 + LSI (사후 0~100점)

### 4.9 알림 (카카오 알림톡 5종 + 이메일)

| 템플릿 | 발송 시점 |
|---|---|
| `AEOLAB_SCORE_01` | 점수 변화 (주 1회 + 변동 큰 경우) |
| `AEOLAB_CITE_01` | AI 인용 실증 발견 |
| `AEOLAB_COMP_01` | 경쟁사 변화 (순위 변동·신규 진입) |
| `AEOLAB_NEWS_01` | 시장 뉴스 (월 1회) |
| `AEOLAB_ACTION_01` | 이달 할 일 |

추가 자동 알림:
- 14일 소식 미작성 알림
- 리뷰 키워드 알림 (새로 언급된 키워드)
- 별점 2점 이하 긴급 알림 (6시간 간격)
- AI 브리핑 노출 변화 감지 (매일 08:30)
- 키워드 순위 변동 알림 (Pro+)

### 4.10 자동화 스케줄러 잡 (월정액 가치의 핵심)

| 잡 | 주기 | 역할 |
|---|---|---|
| daily_scan | 매일 02:00 | 플랜별 자동 스캔 |
| weekly_notify | 매주 월요일 09:00 | 주간 점수 변화 알림 |
| daily_notify | 매일 09:10 | 경쟁사 순위 변동 알림 |
| subscription_lifecycle | 매일 01:00 | 구독 상태 관리 (active→grace→expired) |
| after_screenshot | 매일 08:00 | AI 검색 스크린샷 |
| monthly_market_news | 매월 1일 10:00 | 시장 뉴스레터 (Claude 호출) |
| weekly_post_draft | 매주 월 09:00 | 주간 소식 초안 (Claude 호출) |
| competitor_overtake | 매일 03:00 | 경쟁사 추월 감지 |
| competitor_place_sync | 매주 월 03:30 | 경쟁사 플레이스 동기화 |
| enrich_competitor_details | 매주 목 03:00 | 경쟁사 블로그·웹사이트 보강 |
| detect_new_competitors | 매주 월 04:30 | 신규 경쟁사 자동 감지 |
| quarterly_index | 분기 종료 후 8일 03:00 | 공개 익명 인덱스 집계 |
| keyword_alert | 매일 08:00 | 리뷰 키워드 알림 |
| trial_followup | 매일 10:00 | 무료 체험 이메일 |
| low_rating_check | 6시간 간격 | 별점 2점 이하 긴급 |
| send_monthly_growth_report | 매월 1일 09:00 | 월간 성장 리포트 |
| monthly_growth_card | 매월 말일 06:00 | 성장 카드 생성 |
| send_trial_day5_reminder | 매일 10:15 | 가입 5일차 결제 리마인더 |
| weekly_industry_trend | 매주 월 03:00 | 업종 트렌드 갱신 |
| weekly_my_place_stats | 매주 일 03:00 | 네이버 플레이스 리뷰·평점 |
| action_rescans | 매일 03:00 | 7일 후 행동 재스캔 |
| fill_action_score_after | 매일 03:30 | After 점수 채우기 |
| weekly_score_report | 매주 월 09:05 | 주간 성적표 |
| check_briefing_alert | 매일 08:30 | AI 브리핑 노출 변화 |
| send_monthly_performance_reports | 매일 09:05 | 30/60/90일 성과 이메일 |
| monthly_report_notify | 매월 1일 09:10 | 월간 AI 노출 리포트 |
| new_user_day7_rescan | 매일 09:00 | 가입 7일차 자동 재스캔 |
| conversion_followup | 매일 01:00 | 미결제 사용자 전환 시퀀스 (D+7/14/30) |
| weekly_digest | 매주 월 08:30 | 주간 다이제스트 이메일 |
| keyword_rank_basic_weekly | 매주 월 04:00 | Basic 키워드 순위 |
| keyword_rank_pro_daily | 매일 04:30 | Pro 키워드 순위 |
| inactive_post_alert | 매일 09:10 | 소식 14일 미작성 |
| delivery_auto_cancel | 매일 01:30 | 대행 자료 미제출 7일 자동 취소 |
| delivery_30day_rescan | 매일 02:00 | 대행 풀패키지 30일 후 재진단 |
| ai_tab_trigger_check | 주 2회 (월·목 09:00) | AI탭 P2 트리거 감지 |
| briefing_category_expansion_monitor | 매월 1일 09:00 | 업종 확대 모니터링 |

### 4.11 데이터 내보내기·공유

- **CSV 내보내기** — Basic+ (점수·경쟁사·랭킹)
- **PDF 리포트** — Pro+ (reportlab + NotoSansCJK)
- **공유 링크 생성** — 암호화 토큰
- **공유 카드 PNG** — 카카오톡용 (24h 캐시, 인증 불필요)
- **뱃지 PNG/SVG** — 외부 사이트 임베드용 (등급 표시)
- **성장 카드** — 월간 자동 생성

### 4.12 팀 협업 + Public API (Biz+)

- **팀 멤버 초대** — 이메일 발송, 권한 member/viewer
- **Public API 키 발급** — 최대 5개, `aeo_*` 형식, SHA256 해싱 저장
- **외부 시스템 연동** — 스캔·점수·경쟁사 데이터 조회

### 4.13 검색·등록 보조

- **네이버 지역 검색** — 사업장 주소·전화 자동완성 (비로그인 분당 10회)
- **카카오 로컬 검색** — 경쟁사 검색
- **국세청 사업자등록번호 검증** — `lookup` 엔드포인트
- **브랜드 이름 보호 체크** — 상호권 침해 감지

### 4.14 AI 어시스턴트

- **AI 챗봇** — Claude Haiku 기반 (Basic 월 20회 / Pro+ 무제한)
- **추천 질문** — 사용자 컨텍스트 기반

### 4.15 공개 데이터 (비로그인 접근 가능)

- **분기 공개 인덱스** — `/api/public/index/{summary,category}` (2h 캐시)
- **업종별 AI 브리핑 분류** — `/api/public/briefing-categories` (ACTIVE/LIKELY/INACTIVE)
- **공지사항** — `/api/notices`
- **FAQ** — `/api/faq`
- **성공 사례 갤러리** — `/api/stories`

---

## 5. 사용자 노출 페이지 맵

### 5.1 공개 페이지 (비로그인)

**랜딩·정보**
- `/` 메인 (대행 서비스 섹션 + 무료 도구 섹션 + 인라인 키워드 위젯 포함)
- `/how-it-works` 서비스 동작 원리 (5단계)
- `/pricing` 요금제 비교 (PlanRecommender + ChatGPT 비교 + FAQ)
- `/plans-preview` 업종 선택 후 맞춤 플랜 추천 (mock 데이터 시연)
- `/faq` 자주 묻는 질문
- `/help` 도움말

**학습·가이드**
- `/guide/channels/[category]` 업종별 AI 채널 가이드 (SSG)
- `/guide/chatgpt-search` ChatGPT 검색 최적화
- `/score-guide` 점수 계산 방식
- `/index` **업종별 AI 노출 현황** (분기 공개 인덱스 활용, 음식점·카페·미용 등 평균 점수·top25·bottom25)
- `/resources`, `/resources/[category]` 자료실
- `/blog`, `/blog/[slug]` AI 검색 노출 블로그
- `/stories`, `/stories/[id]` 성공 사례

**체험·도구**
- `/trial`, `/trial/claimed` 무료 진단
- `/demo` 데모 미리보기
- `/quick` 빠른 체험
- `/tools/keyword`, `/tools/ad-cost-calculator` 무료 도구
- `/share/[bizId]` 결과 공유

**SEO 랜딩**
- `/keywords/[slug]` 키워드별 검색 유입 페이지

**정책**
- `/terms`, `/privacy` 이용약관·개인정보처리방침

### 5.2 인증·결제

- `/login`, `/signup`, `/reset-password`, `/auth/update-password`
- `/payment/success`, `/payment/fail`, `/payment/card-update`

### 5.3 로그인 후 (대시보드)

**메인**
- `/dashboard` 메인 대시보드 (page.tsx 412줄, 8개 section 분리)
  - DashboardHeader / ScoreZone / ActionZone / InsightZone / GeneratorZone / DetailZone / FooterZone
  - DualTrackCard, NaverAiPathwayCard, AiTabPreviewCard, AiInfoTabStatusCard, ChannelScoreCards
  - PhotoCategoryCard, KeywordRankCard, GapAnalysisCard, MissingKeywordBadges
  - ActionHeroCard, TopPriorityActionCard, DailyMissionCard, Day7ActionCard, MonthlyChecklistCard
  - IntroGeneratorCard, TalktalkFAQGeneratorCard, AIDiagnosisCard, AICitationCard
  - SchemaCheckCard, WebsiteCheckCard, SmartplaceAutoCheck, KakaoChecklistCard

**분석·가이드**
- `/history` 변화 기록 (30일 추세, Before/After, CSV·PDF 내보내기)
- `/guide` AI 개선 가이드 허브
- `/guide/ai-tab` AI탭 5단계 가이드 (모든 업종)
- `/guide/ai-info-tab` AI 브리핑 5단계 가이드 (ACTIVE 업종)
- `/guide/blog-strategy` 블로그 전략
- `/competitors` 경쟁사 관리
- `/blog-analysis` 블로그 AI 진단
- `/ad-defense` 광고 방어 (Pro+)
- `/growth` 성장 추적
- `/preview` 라이브 프리뷰 (실시간 검색 캡처)
- `/schema` JSON-LD 검사
- `/review-inbox` 리뷰 수신함

**설정**
- `/settings` 구독·사업장·계정
- `/settings/team` 팀 (Biz+)
- `/settings/api-keys` API 키 (Biz+)
- `/onboarding` 첫 사업장 등록 3단계
- `/notices`, `/notices/[id]` 공지사항

**지원·대행**
- `/support`, `/support/tickets`, `/support/tickets/new`, `/support/tickets/[id]` Q&A 게시판
- `/delivery` 대행 서비스 안내
- `/delivery/new` 의뢰 신청
- `/delivery/orders`, `/delivery/orders/[id]` 의뢰 진행 추적
- `/delivery/payment-confirm` 대행 결제 확인
- `/startup` 창업패키지 상세

### 5.4 Admin (hoozdev@gmail.com)

- `/admin` 관리자 대시보드
- `/admin/delivery`, `/admin/delivery/[id]` 대행 주문 관리
- `/admin/support`, `/admin/support/[id]` Q&A 관리
- `/admin/stories` 성공 사례 관리

---

## 6. 사용자 유형별 추천 매트릭스

| 사용자 유형 | 추천 플랜 | 추천 대행 | 핵심 가치 |
|---|---|---|---|
| **첫 가입 (불확실)** | Free → Basic | — | 무료 진단으로 가능성 확인 후 Basic 첫 달 4,950원 |
| **소상공인 (음식·미용·헬스)** | Basic | 패키지 ② AI 최적화 | 매주 자동 감시 + 콘텐츠 무제한 + 1회성 대행 |
| **신규 매장 오픈 예정** | 창업패키지 | 패키지 ③ 종합 풀패키지 | 시장 분석 + 등록·최적화 한 번에 |
| **성장 중인 가게 (월 매출 ↑)** | Pro | 패키지 ② AI 최적화 | 매일 감시 + 행동 결과 자동 증명 + 광고 대응 |
| **다점포 사장 (2개 이상)** | Biz | — | 5개 매장 매일 풀스캔 + 팀 협업 |
| **대행사·에이전시** | Biz | — | API 키 + 팀 5명 + 다수 매장 모니터링 |
| **대규모 조직 (프랜차이즈 본사·지자체)** | Enterprise | 별도 협의 | 사업장 무제한 + 팀 20명 + 영업 전용 |
| **시간 없음, 작업 위임 희망** | Basic + 대행 ② | 패키지 ② 또는 ③ | 사용자는 자료만 제공 |

---

## 7. 결제 인프라 요약

- **PG**: 토스페이먼츠 v2 (현재 `test_` 키 — 실결제 전 `live_` 교체 + pm2 restart 필요)
- **빌링키**: 자동 재결제 (월/연 구독)
- **멱등성**: `billing_key` 기준 중복 결제 방지
- **첫 달 할인 서버 재검증**: 클라이언트 amount 조작 차단
- **연간 결제**: 10개월치, ~17% 할인
- **GDPR 대응**: 계정 완전 삭제 엔드포인트

---

## 8. AI·외부 API 사용 비용 (BEP 20명 기준, A안 50/50 반영)

| API | 단가 | 월 비용 | 용도 |
|---|---|---|---|
| Gemini 2.0 Flash | $0.075/1M in, $0.30/1M out | ~$1.5 | Basic 50회 / Full 100회 |
| OpenAI gpt-4o-mini | $0.15/1M in, $0.60/1M out | ~$2 | Basic 50회 / Full 100회 |
| Claude Sonnet | $3/1M | ~$3 | 가이드 생성 시만 |
| 카카오 알림톡 | 8~15원/건 | ~800원 | 변화 있을 때만 |
| iwinv 서버 | 고정 | 27,800원 | vCPU2/RAM4GB (Phase 2+ 업그레이드 예정) |
| **합계** | | **~75,000원** | |

**마진율**: Basic 85% / Pro 78% / Biz 70%

---

## 9. 신뢰성 정책 (사용자 노출 데이터)

- **금지**: 임의 더미 수치, 계산 근거 없는 추정 점수, "예시 데이터" 표시
- **허용**: 실측 데이터 + 데이터 부족 시 명시적 `(추정)` 회색 배지 + 근거 1줄
- **면책 문구 일관 적용**: "측정 시점·기기·로그인 상태에 따라 달라질 수 있음"
- **ChatGPT UI 면책 필수**: "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"
- **빈 상태**: "아직 데이터 없음 — 첫 스캔 후 표시"
- **에러 폴백**: 0/N/A 표시, 무작위 숫자 절대 금지

---

## 10. 검증 노트 (이 문서 작성 중 발견·정정한 사항)

| 항목 | 1차 보고 | 코드 검증 결과 (정답) |
|---|---|---|
| AI 스캐너 개수 | 일부 보고 "8개 AI" | **4종**: Gemini · ChatGPT · 네이버 AI 브리핑 · Google AI Overview (`docs/changelog_archive.md` + CLAUDE.md) |
| 결제 PG | 일부 보고 "Stripe" | **토스페이먼츠 v2** (`backend/services/toss_billing.py`, `backend/config/prices.py`) |
| 플랜 가격 | 일부 보고 "Basic 9,900 · Startup 19,900 · Pro 29,900 · Biz 99,900" | **Basic 9,900 / 창업 12,900 / Pro 18,900 / Biz 49,900 / Enterprise 200,000** (`backend/config/prices.py` + `frontend/lib/plans.ts` 일치) |
| Bing/DuckDuckGo 스캐너 | 백엔드 보고에 포함 | **존재하지 않음** — `backend/services/`에 `bing_scanner.py`·`duckduckgo_scanner.py` 없음 (CLAUDE.md "제거됨" 명시) |
| 대시보드 `/keyword` 페이지 | 초안에 포함 | **존재하지 않음** — Glob 검증 결과 `frontend/app/(dashboard)/keyword/page.tsx` 없음. 키워드 관리는 대시보드 내장 UI로 처리 |
| 공개 페이지 누락 | 초안에 미포함 | **추가**: `/(public)/index` (분기 공개 인덱스 노출), `/(public)/plans-preview` (업종 맞춤 플랜 추천) |

---

## 11. 미정의·확장 예정 항목

| 항목 | 상태 | 트리거 |
|---|---|---|
| **Enterprise 결제 흐름** | 영업 전용 미정의 | 영업 완료 후 별도 결제 링크 |
| **Basic 무료 체험 (basic_trial_used)** | 컬럼 존재, 사용 조건 부분 정의 | 신규 가입자 1회 한정 |
| **외주 도입** | 운영자 1인 직접 | BEP 50명+ + 정기 서비스 도입 후 |
| **Google AI 스크린샷 재도입** | 2026-05-14 제거 (iwinv IP CAPTCHA) | 구독자 50명 이후 DataForSEO Screenshot API |
| **AI탭 스캐너 P2 활성화** | 트리거 대기 | 6월 네이버 AI탭 전체 확대 후 (주 1회 수동 확인) |
| **점수 모델 v3.1 전면 활성화** | 환경변수 `SCORE_MODEL_VERSION=v3_1` | 베타 5명+ 후 |
| **점수 모델 v3.2 (그룹 A/B/C/D)** | 환경변수 토글 | 사용자 데이터 축적 후 |
| **실결제 전환** | test_ 키 운영 중 | live_ 키 교체 + pm2 restart |
| **수학적 기법 도입 (Wilson CI·베이지안·Thompson·회귀)** | 보류 | 베타 10/30/50명 단계적 |

---

## 12. 핵심 설정 파일 위치 (관리자 참고)

| 파일 | 역할 |
|---|---|
| `backend/config/prices.py` | 가격 단일 소스 (PLAN_PRICES, DELIVERY_PRICES, FIRST_MONTH_DISCOUNT_PRICES) |
| `frontend/lib/plans.ts` | UI 노출 플랜 정보 (명칭·features·killerFeature) |
| `backend/middleware/plan_gate.py` | PLAN_LIMITS — 모든 기능 한도 단일 소스 |
| `backend/routers/webhook.py` | 토스 결제 확정 + 첫 달 할인 재검증 |
| `backend/routers/delivery.py` | 대행 서비스 패키지 + 주문 플로우 |
| `backend/services/score_engine.py` | 듀얼트랙 점수 계산 + 업종 분류 (`get_briefing_eligibility`, `get_ai_tab_eligibility`) |
| `backend/services/briefing_engine.py` | 네이버 AI 브리핑 분석 + AI탭 시뮬레이션 |
| `backend/services/multi_scanner.py` | 4종 스캐너 오케스트레이션 |
| `backend/scheduler/jobs.py` | 자동화 잡 전체 |
| `frontend/app/(public)/pricing/page.tsx` | 요금제 랜딩 (사용자 노출) |
| `frontend/app/(dashboard)/dashboard/page.tsx` | 메인 대시보드 (412줄, sections 8개 분리) |
| `docs/agency_service_and_iboss_improvements_v1.0.md` | 대행 서비스 기획서 |
| `docs/naver_gpt_work_standard_v1.0.md` | 네이버·GPT 작업 표준 |
| `docs/model_engine_v3.0.md` | 듀얼트랙 점수 모델 설계 |

---

*최종 업데이트: 2026-05-19 | v1.1 — 코드 직접 검증 후 v1.0(2026-04-14) 전면 개정 | 충돌 발견 시 본 문서 즉시 갱신*
