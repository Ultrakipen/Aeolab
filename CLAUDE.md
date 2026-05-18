# AEOlab — 개발 참고 문서

> AI Engine Optimization Lab: 한국 소상공인을 위한 AI 검색 사업장 성장 플랫폼
> 기획서 v7.2 / 개발문서 v1.3 / 모델엔진 v3.0 구현 완료 | 1인 개발 | iwinv 서버 운영 중

> 과거 완료 내역은 `docs/changelog_archive.md` 참조. 이 문서는 현재 상태·코드 패턴·최근 업데이트만 포함.

---

## 에이전트 자동 라우팅 규칙

> **IMPORTANT:** 사용자의 요청을 분류하여 **자동으로 해당 에이전트를 사용**한다. 에이전트 선택을 사용자에게 묻지 말 것.

### 에이전트 목록 (`.claude/agents/`)

| 에이전트 | 파일 | 자동 발동 키워드 / 조건 |
|---------|------|----------------------|
| **deploy** | `deploy.md` | 배포, 서버 반영, scp, pm2, 업로드, 서버에 올려, 재시작, 빌드 |
| **backend-dev** | `backend-dev.md` | FastAPI, 라우터, 서비스, 백엔드, API 엔드포인트, Pydantic, 스케줄러, .py 파일 수정 |
| **frontend-dev** | `frontend-dev.md` | Next.js, 컴포넌트, 페이지, 프론트엔드, UI, tsx, CSS, 반응형, 모바일 화면 |
| **db-migrate** | `db-migrate.md` | 테이블, 컬럼 추가, 마이그레이션, Supabase SQL, 인덱스, schema.sql |
| **scan-engine** | `scan-engine.md` | 스캔 엔진, 점수, 스코어, 듀얼트랙, keyword_gap, GrowthStage, AI 스캐너, briefing_engine |
| **code-review** | `code-review.md` | 코드 검토, 리뷰, 점검, 버그 확인, 보안 검토, 배포 전 확인 |
| **next-feature** | `next-feature.md` | 새 기능, 다음 구현, 기획, 설계, 구현 범위, 어떻게 만들지 |

### 자동 라우팅 원칙

1. **단일 영역 요청** → 해당 에이전트 1개 즉시 사용
2. **복합 영역 요청** → 에이전트 병렬 실행 (독립 작업이면 동시에)
3. **새 기능 시작** → 반드시 `next-feature` 에이전트 먼저 (범위·DB 변경·비용 분석)
4. **구현 완료 후** → `code-review` 자동 점검 후 `deploy`
5. **모호한 요청** → 가장 관련성 높은 에이전트 1개 선택하여 즉시 시작. 묻지 말 것.

### 에이전트 보고 검증 의무 (2026-05-01 신설)

> 2026-05-01 두 사이클 연속으로 **에이전트의 "수정·배포 완료" 보고가 사실과 달랐던** 사고 발생. 신뢰 기반이 아닌 검증 기반으로 전환.

- **모든 에이전트 위임 작업 완료 후, 메인 세션이 직접 검증한다.** 검증 없이 다음 단계 진행 금지.
- **백엔드 수정 검증** — `Bash`로 `grep -n "<핵심 패턴>" <파일경로>` 또는 `Read`로 변경 라인 직접 확인. 최소 1개 핵심 변경 라인을 메인 세션이 본 적이 있어야 다음 단계로 진행.
- **배포 검증** — `ssh root@115.68.231.57 "grep -n <패턴> /var/www/aeolab/<경로>"`로 **서버측 파일에 변경이 실제 반영됐는지 1줄 이상 확인**. PM2 재시작 후 `error.log` `--lines 60 --nostream` 0건 확인.
- **잠재 root flat 잔재 점검** — 서버에 같은 이름의 파일이 여러 위치에 존재할 수 있음(`backend/<file>.py` vs `backend/routers/<file>.py` 등). `main.py`의 `from routers import ...` `from scheduler import ...` import 경로가 정답이며, 그 경로의 파일이 실제로 수정됐는지 우선 확인.
- **거짓 보고 발견 시** — 즉시 메인 세션에서 직접 수정. 에이전트 재위임 금지. 향후 동일 패턴 작업도 직접 처리 우선.

---

## 토큰 효율 작업 지침 (Claude Max 5x — $100/월)

> **IMPORTANT:** Max 5x 요금제(Pro 5배 사용량) 한도 내에서 최대 작업량을 확보하기 위한 필수 지침. 어겨도 작동은 하지만 같은 한도로 1/3 작업밖에 못 함.

### 1. 모델 선택 — 가장 큰 절감 요인

| 작업 유형 | 사용 모델 | 비용 비교 |
|---------|---------|---------|
| 아키텍처 설계, 어려운 디버깅, 복잡한 리팩터링 | **Opus 4.7** | 1x (가장 비쌈) |
| 일반 코드 수정, 라우터·서비스·컴포넌트 구현 | **Sonnet 4.6** (디폴트) | 약 1/5 |
| 파일 검색, 단순 문서 작성, 명칭 변경 | **Haiku 4.5** | 약 1/15 |

- **디폴트는 Sonnet 4.6** — 사용자가 별도 지시 없으면 Sonnet으로 작업
- Opus는 **계획·설계 단계만** — 구현은 `/model sonnet`으로 전환
- 계획(Opus) + 구현(Sonnet) 분리 시 **약 80% 토큰 절감**

### 2. 컨텍스트 관리

- **작업 단위마다 `/clear`** — 누적 컨텍스트가 가장 큰 낭비 요인
- 새 기능 시작 = 새 세션 (이전 세션 끌고 다니지 말 것)
- 긴 대화는 `/compact`로 요약 후 계속

### 3. 프롬프트 캐시 활용 (5분 TTL)

- 연속 작업이 유리 — 5분 내 같은 파일 작업 = 캐시 히트
- 휴식 후 재개 시 캐시 미스로 비용 증가
- **한 번에 몰아서 작업** → 자리 비울 때 마무리 짓고 종료

### 4. 서브에이전트 적극 활용 (이미 자동 라우팅됨)

- 서브에이전트는 **자체 컨텍스트 사용** → 메인 세션 토큰 보존
- 광범위한 검색·탐색은 `Explore` 에이전트에 위임
- 영역별로 `frontend-dev`/`backend-dev`/`db-migrate` 분리 → 컨텍스트 격리

### 5. 도구 병렬 호출

- 독립 작업은 **단일 메시지에 여러 도구 동시 호출**
- 예: 파일 3개 동시 Read, Grep+Glob 동시 실행, 빌드+테스트 병렬

### 6. CLAUDE.md 다이어트 (매 요청마다 전체 로드됨)

- **700줄 이내 유지** — 넘으면 즉시 압축
- 최근 업데이트는 1개월 지나면 `docs/changelog_archive.md`로 이관
- 완료 항목·임시 메모는 즉시 아카이브하거나 삭제

### 권장 작업 흐름

```
[기획] Opus + next-feature 에이전트 → 설계 산출
[구현] /model sonnet → backend-dev/frontend-dev 병렬 실행
[검토] Sonnet + code-review 에이전트
[배포] deploy 에이전트 (자동화됨)
[새 작업] /clear → 처음부터
```

### Max 5x 사용량 윈도우

- **5시간 윈도우 + 주간 한도** 구조
- 5시간 안에 집중 작업 → 캐시 효율 극대화
- 야간 자동화(`scheduler/jobs.py`) 대부분은 Claude 토큰 0 소비 (단, `monthly_market_news_job`·`weekly_post_draft_job` 두 잡은 Claude 호출 — 구독자 수 늘면 비용 주의)

---

## 작업 참고 문서 (`C:/app_build/aeolab/docs/`)

| 파일 | 내용 |
|------|------|
| **`docs/inspection_request_full.md`** ⭐ | **새 대화창 1줄 트리거용 종합 점검 문서 (§3.1~§3.10 영역)** |
| **`docs/agency_service_and_iboss_improvements_v1.0.md`** ⭐ | **대행 서비스(3종) + Q&A 게시판 + 아이보스 착안 개선안 — 5 Sprint 구현 기획. 새 대화창에서 §0 트리거 명령으로 즉시 작업 시작 가능** |
| **`docs/naver_gpt_work_standard_v1.0.md`** ⭐ | **네이버·GPT 관련 기능 작업 전 필수 — 업종 분류·점수 가중치·스캐너·콘텐츠 구조·UI 분기 전 영역** |
| `docs/model_engine_v3.0.md` | 듀얼트랙 모델 엔진 설계 (단일 참조 문서) |
| `docs/next_features_v1.0.md` | 다음 구현할 추천 기능 목록 |
| `docs/service_unification_v1.0.md` | 서비스 통합 재편 기획서 — 점수 모델 v3.1, 그룹 분기, KPI |
| `docs/phase_a_completion_report.md` | Phase A 완료 보고서 — 17건 작업 + 검증 결과 |
| `docs/changelog_archive.md` | v1.2~v3.5 완료 내역 아카이브 |
| **`docs/remaining_tasks_v1.0.md`** ⭐ | **잔여 작업 런북 — DB 테이블 생성 SQL·대행 서비스 체크리스트·git 커밋·P2/P3 트리거 명령 전체 정리 (2026-05-18)** |

> **새 대화창 시작 시 우선 트리거**: `docs/inspection_request_full.md` 1줄 명령으로 전체 시스템 점검·수정·배포 자동 진행. 부분 점검은 `§3.X`만 지정.

## 작업 중요 지침
1. PC화면과 모바일 화면이 별개의 페이지로 구현되어야 함 (PC/모바일에 알맞은 화면 구성)
2. 각 화면 항목·텍스트 크기·가독성 최적화. 작게 나타나지 않도록 유의
3. 같은 실수(코드 오류, CSS 깨짐 등) 반복하지 않도록 작업 사항 기록
4. 구현마다 프론트엔드와 백엔드 상호작용 오류 검증·테스트
5. **실제 서버 우선**: 서버에서 작업 → 로컬에 복사. 테스트 URL은 `https://aeolab.co.kr` (로컬호스트 아님)
6. 문서를 생성하면 로컬 폴더(`C:/app_build/aeolab/docs/`)에 저장
7. **사용자에게 실측·사실적 정보만 제공** (홈페이지 개발 완성 후 서버 사양 1단계 업그레이드 예정 — 데이터 수집 한계로 인한 임시 추정값 허용 범위 더욱 줄어듦):
   - **금지**: 임의 더미 수치, 계산 근거 없는 추정 점수, "예시 데이터" 표시
   - **허용**: 실측 데이터(스캔 결과·키워드 순위·AI 인용·블로그 발견 수 등) + 데이터 부족 시 명시적 추정 배지(`(추정)` 회색 라벨 + 근거 1줄)
   - **모든 변동 데이터**(키워드 순위·AI 인용·점수)에 면책 문구 일관 적용: "측정 시점·기기·로그인 상태에 따라 달라질 수 있음"
   - **신규 기능 출시 전**: 실제 사용자 1명 이상의 데이터로 검증한 화면만 노출. 빈 상태에서는 "아직 데이터 없음 — 첫 스캔 후 표시" 안내
   - **사용자 입력 데이터**(키워드·스마트플레이스·소개글 등)는 즉시 사업장 정보·점수·매뉴얼·트라이얼·보고서 모든 곳에 반영
   - **에러 폴백 시 허위 수치 금지**: API 실패 시 0/N/A로 표시, 무작위 숫자 절대 금지 (과거 히어로 섹션 사고 재발 방지)

---

## 네이버 AI 브리핑 + 사양 변경 대응 지침 (2026-05-01 신설)

> 네이버는 AI 브리핑 노출 조건·스마트플레이스·톡톡 사양을 자주 변경한다. 다음 원칙으로 일관 대응한다. AI/LLM 일반 지식 신뢰 금지 — 사용자 실측·공식 공지 우선.

### 참고 문서 (작업 시작 전 반드시 확인)

| 문서 | 내용 |
|------|------|
| `docs/naver_ai_briefing_compliance_v1.0.md` | 네이버 공식 PDF 기반 AI 브리핑 노출 조건·프랜차이즈 제외·5가지 유형 컴플라이언스 |
| `docs/ai_briefing_redesign_v2.0.md` | AI 브리핑 노출 기준 v2.0 최신 설계 (이전 버전 v1.0/v1.1는 히스토리) |
| `docs/ai_briefing_implementation_plan_v2.0.md` | v4.1 구현 계획 — 게이팅·프랜차이즈·5단계 가이드·DB 컬럼 |
| `docs/ai_briefing_audit_plan_v1.0.md` | AI 브리핑 노출 점검·검증 절차 |
| `docs/naver_talktalk_redesign_v1.0.md` | 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 탭 폐기 영향 범위·진행 로그 |
| `docs/session_summary_20260430_naver_briefing_v4.1.md` | 2026-04-30 v4.1 세션 작업 요약 |

> **작업 규칙**: 본 지침과 참고 문서 간 충돌 시 **참고 문서가 우선**(항상 최신 실측 반영). 충돌 발견 시 본 지침을 즉시 갱신할 것.

### 1. AI 브리핑 노출 게이팅 (단일 진실)

- **ACTIVE 업종**: restaurant, cafe, bakery, bar, accommodation — 네이버 AI 브리핑 플레이스형 노출 대상 (beauty·nail은 LIKELY, 코드 score_engine.py:28 기준)
- **LIKELY 업종**: beauty, nail, pet, fitness, yoga, pharmacy — 2026년 AI 탭 베타 공개(2026-04-27, 네이버플러스 우선) + 업종 확대 진행 중, 안내 톤 분기
- **INACTIVE 업종**: 그 외 모든 업종 → 글로벌 AI(ChatGPT·Gemini·Google AI) 중심 안내
- **프랜차이즈는 ACTIVE 업종이라도 제외** (네이버 공식 정책) — `get_briefing_eligibility(category, is_franchise)` 사용
- **단일 소스 동기화**: backend `briefing_engine.BRIEFING_ACTIVE_CATEGORIES` ↔ frontend `BRIEFING_ACTIVE` — 한쪽 변경 시 양쪽 동시 수정 필수 (RegisterBusinessForm.tsx, dashboard/page.tsx)
- **점수 모델 v3.1**: ACTIVE/LIKELY/INACTIVE 그룹별 Track1 가중치 (`NAVER_TRACK_WEIGHTS_V3_1`) 사용. INACTIVE는 `has_faq=0`점

### 2. 톡톡 채팅방 메뉴 (구 FAQ 개편, 2024.02.14)

- **명칭 일관**: "톡톡 FAQ" → **"톡톡 채팅방 메뉴"** (사용자 노출 화면 전체 적용)
- **URL**: `partner.talk.naver.com` (사장님 직접 설정)
- **사양**: `chat_menus[].link_type: "message" | "url"` — 단순 문자열 배열 사용 금지
- **하위 호환**: 기존 `talktalk_faq_draft` 문자열 배열 → backend `_compat_chat_menus()` + frontend `normalizeChatMenus()` 자동 변환. DB 마이그레이션 불필요
- **DB 컬럼 보존**: `has_faq` 가중치 0이지만 컬럼은 유지 (과거 데이터 호환)

### 3. 스마트플레이스 Q&A 탭 폐기 (2026-05-01 실측 확인)

- **폐기됨**: `/qna` 경로 — 좌측 메뉴·직접 URL 모두 사망
- **금지**: `_SMARTPLACE_PATHS["faq"]` 경로 사용, `/qna` Playwright crawl, `_detect_faq()` 호출
- **사용자 노출 deeplink**: `/qna` 사용 금지 → `/profile`로 교체
- **점수 재배분**: `has_faq` 25점 → 소식(15→25) + 소개글(10→20)로 분배 (합계 100점 보존)
- **단정 표현 금지**: "직접 인용" 등 사용자 노출 화면에 사용 금지 (체크박스 UI도 제거)

### 4. 향후 네이버 사양 변경 발견 시 (재발 방지)

- 영향 범위 문서 신규 작성: `docs/<change>_v<version>.md`
- **작업 순서**: 백엔드 P0 → 프론트엔드 → 사용자 노출 화면 → DB 호환
- SSH 직접 검증 필수 (에이전트 보고만 신뢰 금지 — 2026-05-01 사고 사례 참조: 1차 에이전트 "수정 완료" 보고했으나 실제 미반영)

### 5. AI 노출 기준 작업 시 필수 참조 (2026-05-04 신설)

> **네이버·GPT 관련 기능(스캔·점수·콘텐츠 생성·UI·갭 분석·가이드·키워드) 작업 전 반드시 읽을 것:**
> `docs/naver_gpt_work_standard_v1.0.md` — 업종 분류·스캐너 4종·쿼리 3변형·점수 가중치·콘텐츠 구조·UI 분기·면책 문구 전 영역 포함

**핵심 원칙 3가지**
- ACTIVE/LIKELY/INACTIVE 업종 분류 + 프랜차이즈 제외는 `score_engine.py:28` 단일 소스
- ChatGPT UI 면책 문구 필수: "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"
- `/qna` 경로 사용 금지 (2026-05-01 폐기) → `/profile` 대체

---

## 프로젝트 개요

**서비스 핵심:** 경쟁 사업체를 분석해 평가 기준을 만들고, 그 기준으로 내 사업장을 진단하여 AI 검색 노출 개선 방안을 제공

**3대 사용자:** 소상공인(사업장 성장) / 시장 조사자(업종 분석) / 예비 창업자(시장 조사)

**소상공인 관점:** 네이버에서 내 가게가 얼마나 노출되는지 + 네이버 AI 브리핑에 잘 나오는지 + 인근 경쟁업체와의 차이 + 개선 방안과 실행 방법을 알 수 있어야 한다.

**BEP:** 구독자 20명 (월 비용 약 8만원)

### 모델 엔진 v3.0 (듀얼트랙)

`Unified Score = Track1 × naver_weight + Track2 × global_weight`

- `DUAL_TRACK_RATIO`: 9개 업종 × naver/global 비율 (restaurant 70/30, legal 20/80, shopping 10/90 등)
- fallback: restaurant `{naver: 0.60, global: 0.40}` 중립
- GrowthStage 기준: **`track1_score`** (unified 아님 — 업종 비율 차이로 오판 방지)
- keyword_gap cold start: 리뷰 → 블로그 자동 추출 → fallback 30.0
- trial Gemini: 10회 샘플링 (full 100회와 분리)

모델 엔진 관련 작업 시 `docs/model_engine_v3.0.md`를 먼저 읽고 개선 사항을 알릴 것.

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프론트엔드 | Next.js 16.2.1 App Router + Tailwind + shadcn/ui + Recharts | 포트 3000 |
| 백엔드 | Python FastAPI + Pydantic v2 + APScheduler + aiohttp | 포트 8000 |
| DB | Supabase Cloud Free Tier (PostgreSQL + Auth + Storage) | |
| AI 스캔 | Gemini 2.0 Flash + OpenAI gpt-4o-mini (Basic 자동 50/50 분할, Full 각 100회) + 네이버 AI 브리핑(Playwright) + Google AI Overview(Playwright) | 4종 운영 |
| AI 가이드 | Claude sonnet-4-6 (가이드 전용) + Claude Haiku (FAQ/감정분석) | |
| 스크린샷 | Playwright 1.44+ | Semaphore(2) RAM 보호 |
| 결제 | 토스페이먼츠 v2 (현재 test_ 키) | 실결제 전 live_ 교체 필요 |
| 알림 | 카카오 비즈API v2 알림톡 5유형 | |
| 서버 | iwinv vCPU2/RAM4GB, Ubuntu 24.04 LTS, Nginx + PM2 | aeolab.co.kr |
| CI/CD | GitHub Actions — main 브랜치 push 시 자동 배포 | |

### AI 스캐너 4종 체계 (multi_scanner.py 기준)

| 스캐너 | 파일 | 방식 | 용도 |
|--------|------|------|------|
| Gemini 2.0 Flash | `gemini_scanner.py` | API | sample_n(n=50/100) — Basic 자동 50회, Full 100회, Trial 10회 |
| ChatGPT GPT-4o-mini | `chatgpt_scanner.py` | API | sample_n(n=50/100) — Basic 자동 50회, Full 100회, Quick/Trial 1회 |
| 네이버 AI 브리핑 | `naver_scanner.py` | Playwright | 네이버 AI 브리핑 DOM 파싱 |
| Google AI Overview | `google_scanner.py` | Playwright | 구글 SGE 노출 확인 |

**제거됨:** Perplexity(미사용), Grok, Claude 스캐너, 뤼튼/Zeta (비용·ROI 이유)

**스캔 모드 (2026-05-04 A안 50/50 적용):**
- Trial(ChatGPT 5회 — sample_5 구현)
- Quick(ChatGPT 5회 + Naver)
- **Basic 자동(Gemini 50회 + ChatGPT 50회 + Naver)** — 한국 사용자 인지도 높은 ChatGPT 동등 측정
- Full 유료(Gemini 100회 + ChatGPT 100회 + Naver + Google)

**점수 산식 (calc_multi_ai_exposure):** Gemini 45점 + ChatGPT 45점 = 90점 → 100점 재배분. sample_size 자동 처리로 50회·100회·boolean 모두 호환.

---

## 프로젝트 경로 및 환경

- **서버:** `root@115.68.231.57`, SSH 키 `~/.ssh/id_ed25519`, `/var/www/aeolab/`
- **로컬:** `C:/app_build/aeolab/`
- **Python venv:** 서버 `/var/www/aeolab/venv/`, 로컬 `backend_venv/` (루트)
- **PM2:** `aeolab-backend` (8000), `aeolab-frontend` (3000)
- **Node:** 20 LTS | **Python:** 3.11+

### 실행 방법 (로컬)
```bash
# 터미널 1: 프론트엔드
cd frontend && npm run dev      # http://localhost:3000
# 터미널 2: 백엔드
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### 환경변수 요약 (`.env.example`)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- AI: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- 결제: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` (현재 test_)
- 알림: `KAKAO_APP_KEY`, `KAKAO_SENDER_KEY`, `KAKAO_REST_API_KEY`
- 검색: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_SEARCHAD` (일 25,000건 무료)
- 기타: `BACKEND_URL`, `SECRET_KEY`

---

## 요금제 최종 가격 (4곳 모두 일치)

- **Basic 9,900원** (신규 첫 달 50% 할인 4,950원, 이후 정상가)
- **창업패키지 12,900원**
- **Pro 18,900원**
- **Biz 49,900원**
- **Enterprise 200,000원**

**단일 소스 파일:**
- 백엔드: `backend/config/prices.py` (PLAN_PRICES + FIRST_MONTH_DISCOUNT_PRICES)
- 프론트: `frontend/lib/plans.ts`
- 관리자 MRR: `frontend/app/admin/AdminDashboard.tsx`
- 결제: `backend/services/toss_billing.py`, `backend/routers/webhook.py`
- UI: `frontend/components/common/PlanGate.tsx`, `frontend/app/(auth)/signup/page.tsx`

### 첫 달 50% 할인 인프라 (v3.3, 2026-04-22)

- `pricing/PayButton`: `subscriptions` 이력 조회 → 없으면 `chargeAmount=4950`, 있으면 정상가
- `/api/webhook/toss/billing/issue` 서버 재검증 (`_is_first_time_subscriber()`)
- 통과 시 `first_month_discount_until=today+30` + `first_payment_amount=4950` 기록
- 30일 후 자동 재결제 → `PLAN_PRICE["basic"]=9900` 정상가 청구
- **악용 차단:** 클라이언트가 `amount=4950` 조작해도 서버 400 거부

---

## 데이터베이스 테이블 (Supabase PostgreSQL)

| 테이블 | 역할 |
|--------|------|
| users | Supabase Auth |
| businesses | 사업장 (category, region, keywords[], naver/google/kakao_place_id, excluded/custom_keywords, blog_analysis_json, receipt_review_count) |
| competitors | 경쟁사 |
| scan_results | 스캔 결과 (gemini/chatgpt/naver/google_result, kakao_result, website_check_result, competitor_scores, track1/track2/unified_score, keyword_coverage) |
| ai_citations | AI 인용 실증 (platform, query, mentioned, excerpt, sentiment, mention_type) |
| score_history | 점수 시계열 30일 (context, track1/track2/unified_score) |
| before_after | 스크린샷 |
| guides | 개선 가이드 (scan_id, context, next_month_goal, tools_json) |
| subscriptions | 구독 (billing_key, customer_key, grace_until, first_month_discount_until, first_payment_amount) |
| profiles | 사용자 프로필 (phone, kakao_scan_notify, kakao_competitor_notify, onboarding_done, basic_trial_used) |
| notifications | 알림 발송 이력 |
| team_members | 팀 계정 (Biz 5, Enterprise 20) |
| api_keys | Public API 키 (Biz+, SHA256 해시 저장) |
| waitlist | 대기자 명단 |
| trial_scans | 무료 체험 (IP 해시, place_data, smart_place_check) |
| business_action_log | 행동-결과 타임라인 (action_type, action_date, score_before/after) |
| gap_cards | 갭 분석 카드 |
| weekly_scores | 주간 점수 뷰 |

### 업종 화이트리스트 25개 (v3.5)
`restaurant·cafe·bakery·bar·beauty·nail·medical·pharmacy·fitness·yoga·pet·education·tutoring·legal·realestate·interior·auto·cleaning·shopping·fashion·photo·video·design·accommodation·other`

> 과거 코드 `hospital→medical`, `law→legal`, `shop→shopping` 마이그레이션 완료.

---

## 백엔드 API 엔드포인트 (핵심)

| Method | Endpoint | 역할 |
|--------|----------|------|
| POST | /api/scan/trial | 무료 원샷 (비로그인, Gemini 10회) |
| GET | /api/scan/trial-search | 네이버 지역검색 후보 (IP당 분당 10회) |
| GET | /api/scan/trial-count | 공개 누적 체험 카운터 |
| POST | /api/scan/full | 전체 4개 AI 병렬 (구독자) |
| POST | /api/scan/stream | 실시간 SSE 진행률 |
| GET | /api/report/score/{biz_id} | DiagnosisReport (channel_scores + website_health) |
| GET | /api/report/market/{biz_id} | MarketLandscape (30분 캐시) |
| GET | /api/report/gap/{biz_id} | GapAnalysis |
| GET | /api/report/history/{biz_id} | 30일 추세 |
| GET | /api/report/competitors/{biz_id} | 경쟁사 비교 |
| GET | /api/report/ranking/{category}/{region} | TOP10 (30분 캐시) |
| GET | /api/report/benchmark/{category}/{region} | 업종 벤치마크 (1h 캐시) |
| GET | /api/report/ai-citations/{biz_id} | AI 인용 미리보기 (Basic+) |
| GET | /api/report/sentiment/{biz_id} | 리뷰 감정 분석 (Basic+, 1h 캐시) |
| GET | /api/report/condition-search/{biz_id} | 조건 검색 (Pro+, 1h 캐시) |
| GET | /api/report/conversion-tips/{biz_id} | 대시보드 맞춤 전환 팁 (AI 호출 0) |
| GET | /api/report/keyword-trend/{biz_id} | 키워드 30일 트렌드 |
| POST | /api/report/smartplace-check | 스마트플레이스 자동 점검 |
| POST/GET | /api/report/action-log/{biz_id} | 행동-결과 타임라인 |
| GET | /api/report/multi-biz-summary | Biz+ 멀티 사업장 |
| GET | /api/report/growth-card/{biz_id} | Growth Card 이미지 |
| GET | /api/share/image/{trial_id} | 카카오 공유 카드 PNG (인증 불필요, 24h 캐시) |
| GET | /api/report/export/{biz_id} | CSV (Pro+) |
| GET | /api/report/pdf/{biz_id} | PDF (Pro+) |
| POST | /api/guide/generate | Claude Sonnet 가이드 |
| POST | /api/guide/{biz_id}/smartplace-faq | FAQ 초안 (Basic+, 월 한도) |
| GET | /api/guide/{biz_id}/pioneer-detail | 선점 키워드 상세 (Basic+, 2h 캐시) |
| POST | /api/schema/generate | JSON-LD |
| POST | /api/webhook/toss/confirm | 결제 확정 |
| POST | /api/webhook/toss/billing/issue | 빌링키 + 첫 달 할인 재검증 |
| CRUD | /api/businesses{/me,/{id}} | 사업장 |
| CRUD | /api/competitors | 경쟁사 (search, suggest/list 포함) |
| POST | /api/startup/report | 창업 리포트 (startup/biz+) |
| GET | /api/startup/timing/{cat}/{region} | 창업 타이밍 지수 |
| CRUD | /api/teams/*, /api/v1/keys | Biz+ |
| GET | /admin/{stats,subscriptions,revenue} | 관리자 |
| GET | /health | 서버·DB 상태 |

---

## AI Visibility Score 가중치 (v3.0 듀얼트랙)

- Track1 (네이버): smart_place_completeness, naver_ecosystem, review_count, keyword_gap
- Track2 (글로벌): ai_exposure (Gemini+ChatGPT+Google), website_seo, content_structure

> 과거 6항목 단일 WEIGHTS는 `DUAL_TRACK_RATIO` + `NAVER_TRACK_WEIGHTS` + `GLOBAL_TRACK_WEIGHTS`로 완전 교체됨.

---

## API 비용 관리 (BEP 20명 기준, A안 50/50 반영)

| API | 단가 | 월 비용 | 용도 |
|-----|------|--------|------|
| Gemini 2.0 Flash | $0.075/1M in, $0.30/1M out | ~$1.5 | Basic 자동 50회 / Full 100회 |
| OpenAI gpt-4o-mini | $0.15/1M in, $0.60/1M out | ~$2 | Basic 자동 50회 / Full 100회 (A안 신규) |
| Claude Sonnet | $3/1M | ~$3 | 가이드 생성 시만 |
| 카카오 알림톡 | 8~15원/건 | ~800원 | 변화 있을 때 |
| iwinv 서버 | 고정 | 27,800원 | |
| **합계** | | **~7.5만원** | A안 도입 추가 ~3,000~4,500원 |

**마진율:** Basic 85%, Pro 78%, Biz 70% (A안으로 0.5~1%p 하락, 사용자 인지도 ↑로 상쇄)

---

## 개발 Phase 현황

- **Phase 0 (검증) ✅** / **Phase 1 MVP ✅** (BEP 20명 미달)
- **Phase 2 v1.0 ✅** (MRR 100만원 미달)
- **Phase 3 v1.5**: 창업패키지·뤼튼 제거·팀 계정 ✅ / 디지털 바우처 ❌
- **Phase 4 v2.0**: API 키 ✅ / 광고대응 ✅ / B2G ❌

### 운영 환경 현황
- ✅ 서버/Nginx/PM2/SSL, Supabase v3.3 스키마, .env, Storage, Rate Limit, reportlab+NotoSansCJK
- ✅ 카카오 알림톡 5종 전체 승인 완료 (2026-04-24)
- ⏳ **실결제 전**: `TOSS_SECRET_KEY` test_ → live_ 교체 + pm2 restart
- ✅ v3.2/v3.3/v3.5/next_features SQL 전체 실행 완료 (2026-04-24)

---

## 운영 서버 주의사항

- **현재 사양:** iwinv vCPU2 / RAM4GB (`/var/www/aeolab/`)
- **🆙 업그레이드 예정:** 홈페이지 개발 완성 후 1단계 상위 사양으로 전환. RAM 8GB 기대 → Playwright 동시 실행 한도 `Semaphore(2)` → `Semaphore(3~4)` 검토 가능. 단, 업그레이드 직전까지는 기존 `Semaphore(2)` 유지하여 안정성 우선
- **개발 시 가정**: "현재 vCPU2/RAM4GB에서도 안정 동작" + "업그레이드 후 측정 주기 단축·동시성 증가" 양쪽 모두 가능하도록 설계 (예: 측정 주기·동시성 한도를 환경변수로 분리)
- **Playwright RAM:** 인스턴스 1개 = 300~500MB. 동시 2개 이상 금지, 큐 방식 순차 처리 (`Semaphore(2)`)
- **CORS:** `allow_origins=['https://aeolab.co.kr','http://localhost:3000']`, `allow_methods` 명시적 5개
- **Nginx:** `/api/` 경로 SSE 스트리밍 위해 `proxy_buffering off` 필수
- **Phase 2+ 전환:** Vercel(Next.js) + Railway(FastAPI) 분리는 구독자 100명 이후

---

## 카카오 알림톡 템플릿 5종

- `AEOLAB_SCORE_01` 점수 변화 / `AEOLAB_CITE_01` AI 인용 실증 / `AEOLAB_COMP_01` 경쟁사 변화 / `AEOLAB_NEWS_01` 시장 뉴스 / `AEOLAB_ACTION_01` 이달 할 일

---

## 개발 원칙

- Phase 0~1은 **완벽한 코드보다 작동하는 제품** 우선
- BEP 20명 이후 코드 품질·테스트·모니터링 체계화
- 비용 최적화: 100회 샘플링은 Gemini Flash 주력, Claude는 가이드 생성 시만

### 작업 기준 — 실제 서버 우선

**모든 코드 수정은 실제 서버에 직접 반영하는 것이 기준. 로컬은 서버 복사본.**

**작업 순서:**
1. SSH로 서버 파일 직접 수정 또는 `scp` 업로드
2. 프론트엔드 변경 시 서버에서 `npm run build`
3. `pm2 restart aeolab-frontend` / `pm2 restart aeolab-backend`
4. `scp 서버 → 로컬`로 동기화

---

## 필수 코드 패턴 (과거 버그 재발 방지)

### Next.js 16 + Supabase Auth
```typescript
// middleware.ts — 항상 getUser() 사용 (getSession() 금지, Invalid Refresh Token 안전)
const { data, error } = await supabase.auth.getUser();
if (!error) user = data.user;

// (dashboard)/layout.tsx — try-catch 필수
try {
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) user = data.user;
} catch { /* AuthApiError → 비로그인 처리 → /login redirect */ }
```
- Next.js 16: `middleware.ts` → **`proxy.ts`**, `middleware` → **`proxy`**, `cookies()` **async**, `createClient()` **async**
- `@supabase/auth-helpers-nextjs` **Deprecated** → `@supabase/ssr` 사용

### supabase-py 2.7.4 응답 객체 (필수)
```python
# .execute() 반환값은 항상 truthy → 반드시 .data 확인
res = supabase.table("x").select("*").execute()
if not (res and res.data):      # NOT `if not res:` (항상 False)
    return None
row = res.data[0]               # NOT `res[0]` or `res.get()`
```
- 2026-04-14 Critical 버그: `if not biz:` 소유권 검증 우회 전면 수정함
- `latest_score.data.get()`, `logs.data or []` 패턴 유지

### Supabase HTTP/2 연결 끊김 방어 (`backend/db/supabase_client.py`)
- `execute()`에 `RemoteProtocolError` / `Server disconnected` 감지 시 `_reset_client()` 후 1회 자동 재시도
- silent pass 금지 — 재시도 실패 시 `_logger.warning()` 후 raise

### SSE 스캔 진행률
- `POST /stream/prepare` → `stream_token` (60초 OTP)
- `GET /stream?stream_token=` (토큰으로 연결)

### DB 마이그레이션
- Supabase Management API 미지원 → SQL Editor 수동 실행
- `scripts/supabase_schema.sql`에 ALTER TABLE 섹션 유지

### 로컬 Python venv 경로
- Windows: `backend_venv\Scripts\activate`
- pip: `backend_venv/Scripts/pip install -r backend/requirements.txt`

### 작업 시 피해야 할 패턴
- `except Exception: pass` — 반드시 `warning` 로그 남길 것
- `SELECT *` — 필요 필드만 명시 (성능)
- `ilike("%region%")` — 가능하면 `ilike("region%")` 접두어 매칭 (인덱스 활용)
- 텍스트 `text-xs` — `text-sm` 이상 권장 (가독성)
- 페이지 `p-8` 고정 — `p-4 md:p-8` 반응형 패딩

---

## 최근 업데이트 (완료 내역은 `docs/changelog_archive.md`)

### 2026-05-18 — P2 버그 수정 + 랜딩 대행 서비스 섹션 신규
- **P2 버그**: `competitor_place_crawler.py` 12개 + `naver_place_stats.py` 4개 `except Exception: pass` → `logger.warning()` 교체. SSH 직접 검증: 두 파일 `except Exception:$` 0건
- **랜딩 대행 서비스 섹션**: `AgencyServiceSection.tsx` 신규 생성 + `page.tsx` §8-B FREE TOOLS 직후 삽입. 패키지 3종(49,000/79,000/119,000원) 정적 카드, API 호출 0, Server Component. 빌드 성공 + PM2 반영

### 2026-05-18 — 랜딩 리드젠 강화 + 메뉴 엑셀 양식 (A·B·C 전체 완료)
- **기능 A: `FreeToolsSection.tsx` 신규** — 랜딩 §8(가격) 직후 초록 배경 섹션. 이미 구현된 `/tools/keyword`·`/tools/ad-cost-calculator` 두 도구를 카드 2개로 노출. "가입 없이 지금 바로" 배지. BEP 전환율 직결 — 비로그인 방문자 첫 체험 유도
- **기능 B: 메뉴 일괄 등록 Excel 양식** — `backend/services/menu_template.py` 신규(openpyxl, 8열 50행, 틀 고정, 헤더 서식). `GET /api/tools/menu-template.xlsx` Basic+ 엔드포인트. `GuideClient.tsx` QuickToolsSection에 에메랄드 버튼 추가. `requirements.txt` openpyxl>=3.1.0 추가. AI 호출 0회
- **기능 C: `InlineKeywordWidget.tsx` 신규** — 랜딩 Hero 직후 삽입. 업종 선택 + 사업장명 입력 → `/api/businesses/keyword-suggest-preview` 호출 → 키워드 최대 10개 표시. 10초 쿨다운. 클릭 복사. 면책 문구 포함. 가입 불필요
- **검증 완료**: SSH grep 7개 핵심 라인 메인 세션 직접 확인, openpyxl 3.1.5 설치, 신규 4개 파일 서버 존재 확인, PM2 both online, error.log 0건

### 2026-05-18 — 네이버 AI 검색 최적화 M1~M3 완료 (`docs/naver_ai_search_optimization_plan_v1.0.md`)
- **M1: 키워드 화이트리스트 + 전역 플래그 + alias 검증**
  - WHITELIST 59개 업종 키워드 정비 (25개 업종 × 평균 2.4개)
  - `in_ai_tab` / `ad_only` 전역 플래그 신설 — AI탭 광고 영역 오인 방지 (Critical S3 대응)
  - `blogMentionCount` 필드 추가 — `blog_analyzer.py` 결과를 Track1 점수에 반영
  - taxonomy ↔ 업종 alias 자동 테스트 구현 (N5 무음 버그 방지)
- **M2: Group D 콘텐츠 매핑 완성 + 채널별 가이드 SSG**
  - Group D ~10개 업종 `ai_tab_context` 그룹 추가 (미완성 → 완성)
  - `backend/services/ai_tab_checklists.py` 신규 — 업종별 AI탭 체크리스트 25종 단일 소스
  - 블로그 UGC 가이드 신규 — `blog_analyzer.py` 결과 → `AiTabPreviewCard`·`AiInfoTabGuide` 노출 (N4 대응)
  - `/guide/channels/` SSG 신규 — 업종 × 채널 매트릭스 정적 페이지 (AI 호출 0)
  - 광고 공지 배너 — AI탭 광고 영역 경고 UI + `ad_only=true` 시 점수 제외 안내
- **M3: 스케줄러 + 점수 모델 v3.2 + 시뮬레이션 v2**
  - `ai_tab_trigger_check_job` (월·목 09:00 KST) — AI탭 노출 트리거 조건 자동 점검 + 카카오 알림
  - `NAVER_TRACK_WEIGHTS_V3_2` — v3_2 환경변수 토글 (`SCORE_MODEL_VERSION=v3_2`). Group A/B/C/D별 가중치 차별화
  - `simulate_ai_tab_answer` v2 — `measured` / `estimated` 배지 분리. 실측 데이터 있으면 measured, 없으면 estimated + 면책 문구 자동 표시
  - `briefing_category_expansion_monitor_job` (매월 1일 09:00 KST) — LIKELY 업종 AI 브리핑 공식 확대 여부 자동 감지 → ACTIVE 승급 후보 로그 + 카카오 알림

### 2026-05-17 — UI 최적화 1~3차 일괄 배포 (가독성·접근성·구조 개선)
- 1차: `content_validator.py:33` 정규식 수정(적시성 인식 복구), `text-xs`→`text-sm` 일괄(~120파일), `rounded-xl` 통일(42 예외 유지), `DiaScoreBadge.tsx` 신규(D.I.A. 5요소 진행바), photo-guide 미지원 404
- 2차: `dashboard/page.tsx` 1,453→412줄(-72%). `sections/` 8개 파일 분리(DashboardHeader/Score/Action/Insight/Generator/Detail/Footer + pageHelpers.ts). SSR 페칭은 page.tsx 단일
- 3차: `EmptyState.tsx` + `ThemeToggle.tsx` + `COLOR_GUIDE.md` + `DARK_MODE_GUIDE.md` 신규. 다크모드 인프라 이미 완비(globals.css)

### 2026-05-17 — 메인 엔진 최적화 v1.1 Phase 1 (5건 일괄 배포)
> 상세 → `docs/main_engine_optimization_v1.1.md`
- 사진 카테고리 단일 소스: `photo_categories.py` 신규 + `photoCategories.ts` 미러 (백 9업종 = 프 9업종)
- D.I.A./LSI: `guide_generator.py` 5요소 강제 + `content_validator.py` 사후 검증(0~100점, AI 0회). 실측 90.0/100
- `inactive_post_alert_job` (14일 미작성 시 카카오 알림). `photo_guide.py` 9업종 × 3~4카테고리 모달 UI
- v5.6 DB: `businesses.last_post_at TIMESTAMPTZ` (graceful fallback 가능, Supabase SQL 실행 권장)

### 2026-05-04 — Basic 자동 스캔 A안 50/50 분할 (Gemini + ChatGPT 동등 측정)
- Basic: Gemini 50회 + ChatGPT 50회 + Naver 병렬. 점수: Gemini 45점 + ChatGPT 45점 = 90점 → 100점 재배분
- `sample_n(n=50)` 일반화. `calc_multi_ai_exposure` sample_size 기반 비율 계산. boolean 폴백 유지(Quick)
- Quick 수동 ChatGPT 5회 격상. `daily_scan_all` → ai_citations INSERT 추가. 수학적 기법 도입 보류(`memory/project_quant_methods.md`)

### 2026-05-16 — 네이버 AI탭 대응 P0 (AI 브리핑 ≠ AI탭 분리)
- **근거 문서**: `docs/naver_ai_tab_대응_개발계획_v1.0.md` — 실제 네이버 서비스 기준, 기획서 기준 아님
- **핵심 수정**: AI탭(2026-04-27 베타)은 모든 업종 노출 가능 — 기존 코드가 AI 브리핑 업종 제한을 AI탭에도 잘못 적용한 버그 수정
- **백엔드**: `score_engine.py:82` — `get_ai_tab_eligibility()` 함수 추가 (항상 "beta" 반환, 업종 무관)
- **프론트엔드**:
  - `dashboard/page.tsx` — `eligibility` → `briefingEligibility` + `aiTabEligibility="beta"` 분리
  - `dashboard/page.tsx:714` — INACTIVE 배너: "AI 브리핑 대상 아님"만 → "AI탭은 모든 업종 가능" 추가 안내
  - `DualTrackCard.tsx` — Track 1 레이블: "AI 브리핑 준비도" → "AI 검색 준비도 (AI브리핑·AI탭 통합)"
  - `PreviewClient.tsx:445,509` — 동일 레이블 수정
- **검증**: SSH grep 5개 핵심 라인 확인, 프론트 빌드 TypeScript 에러 0건, PM2 both online
- **P1 예정 (1-2주)**: `smart_place_auto_check.py` 예약 연동 체크 + `AiInfoTabGuide.tsx` INACTIVE AI탭 가이드 추가
- **P2 예정 (6월 AI탭 전체 확대 후)**: `naver_ai_tab_scanner.py` 신규 + DB 컬럼 추가

### 2026-05-04 — 네이버 AI 브리핑 2026-05 개선 v1.0 (8개 항목)
> 상세 → `docs/naver_ai_briefing_2026_05_improvements_v1.0.md`
- AI탭 답변 시뮬레이션: `briefing_engine.simulate_ai_tab_answer()` + `GET /api/report/ai-tab-preview/{biz_id}` (Basic+)
- 사진 카테고리 진단: `_parse_photo_categories()` + `scan_results.photo_categories JSONB` + `PhotoCategoryCard.tsx`
- 숙박 키워드 4그룹 재편 (`keyword_taxonomy.py`). C-rank 체크리스트·리뷰 갭 카드·검색 의도 안내·ai_tab_context 추가

### 2026-05-01 — 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 탭 폐기 대응 v1.0
> 상세 → `docs/naver_talktalk_redesign_v1.0.md`
- `/qna` 완전 폐기: `_SMARTPLACE_PATHS["faq"]` 제거, `_detect_faq()` 폐기, `/qna` goto 0건, deeplink → `/profile`
- `has_faq` 0점, 소식 25점·소개글 20점 재배분. "톡톡 채팅방 메뉴" 명칭 17개 화면 일관. 하위 호환 `_compat_chat_menus()` + `normalizeChatMenus()`

### 2026-04-30 — Phase A 서비스 통합 재편 v1.2 (점수 모델 v3.1 + 키워드 측정 인프라)
> 상세 → `docs/service_unification_v1.0.md` v1.2
- DB v3.1: 12컬럼 추가(user_group/keyword_ranks/keyword_suggest_count_month 등). 미실행 시 graceful fallback
- v3.1 가중치: ACTIVE 25+15+15+10+10+25 / LIKELY 30+17+18+10+10+15 / INACTIVE 35+20+20+10+15+0. 환경변수 `SCORE_MODEL_VERSION=v3_1` (베타 5명+ 후 활성화)
- 신규: `naver_keyword_rank.py` + `keyword_suggester.py` + `KeywordRankCard.tsx`. 스케줄: 주1/일1(Pro)
- 환경변수: `BACKEND_MAX_CONCURRENCY=2`, `KEYWORD_SUGGEST_MODEL=claude-haiku-4-5-20251001`, `KAKAO_TEMPLATE_KEYWORD_CHANGE` (비즈센터 승인 후)

### 2026-04-23~30 — v3.x/v4.1/v5.1~5.4 완료 (아카이브)
> 상세 내역 → `docs/changelog_archive.md`. 핵심: 프랜차이즈 게이팅, how-it-works 페이지, 모바일 CTA, trial claim 깔때기, 온보딩 투어, 전환 알림 시퀀스, 주간 다이제스트, DB v3.5/v3.6/v4.1 컬럼, GA4 G-KCZTWYK7QV 라이브

---

## 남은 작업

### 사용자가 직접 해야 할 것
- ⏳ **v4.1 ALTER 실행 (선택)** — Supabase SQL Editor에서 5건 실행 시 프랜차이즈 게이팅·초안 자동 로드 활성화. 미실행 시 graceful fallback으로 모든 기능 정상 동작:
```sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_franchise BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS naver_intro_draft TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS naver_intro_generated_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS talktalk_faq_draft JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS talktalk_faq_generated_at TIMESTAMPTZ;
```
- ✅ **2026-04 DB 컬럼 모두 완료** — v3.2/v3.3/v3.5/v3.6/v4.1/profiles.email 전체 적용. 상세 → `docs/changelog_archive.md`
- ✅ **카카오 알림톡 5종 전체 승인 완료** — .env 키 4개 정상 설정
- ⏳ **베타 후기 1~3개 확보** → `frontend/lib/testimonials.ts` `isPlaceholder: false`로 교체 (Phase 0 인터뷰 후)
- **실결제 전환 시**: `TOSS_SECRET_KEY` test_ → live_ 교체 + pm2 restart
- `NEXT_PUBLIC_ADMIN_SECRET_KEY` 향후 서버 컴포넌트로 분리 권장

### 시기 의존 작업 — 런북 참조

> **전체 실행 가이드**: `docs/p2_p3_execution_runbook.md`
> 새 대화창에서: `"docs/p2_p3_execution_runbook.md 기준으로 P2/P3 실행할 것"`

| 작업 | 트리거 | 자동 알림 |
|------|--------|---------|
| **P2 AI탭 스캐너 활성화** | 6월 네이버 AI탭 전체 확대 후 비로그인 탭 표시 확인 | 없음 — 주 1회 수동 확인 필요 |
| **P2 DB v5.7 컬럼** | P2와 동시 실행 (Supabase SQL Editor) | — |
| **P3 점수 모델 v3.1** | 백엔드 로그 `[P3-READY]` WARNING 발생 시 | ✅ 매일 09:15 KST 자동 체크 중 |

**P2 트리거 확인 명령** (주 1회 실행):
```bash
ssh root@115.68.231.57 'cd /var/www/aeolab && source venv/bin/activate && python3 -c "
import asyncio
from playwright.async_api import async_playwright
async def t():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True, args=[\"--no-sandbox\",\"--disable-dev-shm-usage\"])
        pg = await br.new_page()
        await pg.goto(\"https://search.naver.com/search.naver?query=강남역+맛집\", timeout=20000)
        await pg.wait_for_timeout(3000)
        tabs = await pg.query_selector_all(\"a[role=tab]\")
        for t in tabs: print(\"tab:\", await t.inner_text())
        await br.close()
asyncio.run(t())
"'
# 출력에 "AI" 탭 보이면 P2 실행 시작
```

**P3 트리거 확인 명령** (구독자 늘 때마다):
```bash
ssh root@115.68.231.57 'pm2 logs aeolab-backend --lines 500 --nostream | grep "P3-READY"'
```

### 비즈니스 목표
- [ ] 유료 구독자 20명 달성 (BEP)
- [ ] 구독 100명, MRR 100만원 → 시드 IR
- [ ] 소상공인 디지털 바우처 사업 등록 (Phase 3)
- [ ] B2G 공식화 지자체 MOU (Phase 4)

### 미래 과제 (구독자 확보 후)
- 네이버 DataLab API 연동 (`naver_datalab.py`) — 100명 이후
- `smart_place_completeness` Playwright 완전 자동화 — 50명 이후
- 경쟁사 keyword_gap 실시간 자동화 (`_enrich_competitor_excerpts` 잡 이미 구현됨)

### Google 스크린샷 재도입 계획 (구독자 50명 이후)

> **현재 상태 (2026-05-14 제거)**: iwinv 데이터센터 IP → Google 봇 감지 CAPTCHA 100% 발생.
> `capture_batch()` 및 `after_screenshot_job`에서 Google 캡처 블록 제거 완료.
> `screenshot.py:_is_google_captcha()` 감지 함수는 유지 (재도입 시 재활용).

**재도입 방법 — DataForSEO Screenshot API:**
```python
# capture_ai_result("google", ...) 대신 DataForSEO API 호출
import httpx

async def capture_google_via_dataforseo(query: str) -> Optional[bytes]:
    url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"
    payload = [{"keyword": query, "language_code": "ko", "location_code": 2410,
                "calculate_rectangles": True, "screenshot": True}]
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json=payload,
                              auth=(DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD))
        data = r.json()
        screenshot_b64 = data["tasks"][0]["result"][0].get("screenshot")
        if screenshot_b64:
            import base64
            return base64.b64decode(screenshot_b64)
    return None
```

**비용 예측**: 약 $0.002/건 → 50명 × 월 1회 = **월 $0.10 수준**
**환경변수 추가**: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`
**작업 위치**: `services/screenshot.py:capture_ai_result()` Google 분기에 복원

---

*최종 업데이트: 2026-05-18 | 네이버 AI 검색 최적화 M1~M3 + 랜딩 리드젠 A·B·C 배포*
