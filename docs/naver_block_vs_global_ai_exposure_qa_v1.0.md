# 네이버의 AI 크롤러 차단 vs 글로벌 AI 노출 — 개념 정리 (Q&A)

> 작성일: 2026-10-07 | 성격: 개념 설명·논의 기록 (코드 변경 없음)
> ✅ **검증 상태 (2026-10-07 갱신)**: 네이버 robots.txt를 로컬 PC `curl`로 직접 조회해 확인했다(§5 결과). 단 **robots.txt 공개 내용**의 확인이지, 네이버 서버가 실제로 어떤 봇을 막는지(IP/UA 차단 등)까지는 확인하지 않았다. 사용자 노출 문구에는 "robots.txt에서 ~ 봇을 차단"처럼 **조회 일시와 함께** 쓰고, "전면 차단" 같은 과장 표현은 쓰지 말 것(robots.txt는 수시로 바뀜).

---

## 1. 질문

> 이 서비스는 사용자의 가게가 AI 도구에 잘 노출되도록 개선해 준다. 그런데 네이버는 AI 도구들을 모두 차단한 것으로 안다. 네이버에서 차단됐는데 AI 도구에 노출된다는 것은 모순 아닌가? 그렇다면 GPT·구글·제미나이에는 내 가게가 어떻게 노출되나?

## 2. 결론: 모순이 아니다 — 노출 경로가 서로 다르다

| 구분 | 설명 |
|------|------|
| 네이버가 막은 것(추정) | **외부 AI 크롤러**의 네이버 콘텐츠(블로그·카페·지도) 수집 |
| 막히지 않은 것 | **네이버 자체 AI**(AI 브리핑·AI탭)는 네이버 데이터를 직접 읽음 |
| 시사점 | 네이버에만 정보가 있는 가게는 ChatGPT·Gemini에 거의 잡히지 않음 (질문자 지적이 맞는 부분) |

AEOlab은 이 때문에 **듀얼트랙**으로 설계됐다.
- **Track 1 (네이버 AI)**: 스마트플레이스·리뷰·블로그 → AI 브리핑·AI탭 노출
- **Track 2 (글로벌 AI)**: 네이버 **밖** 데이터 → ChatGPT·Gemini·Google 노출

"네이버에서 차단된 정보로 글로벌 AI에 노출된다"는 주장이 아니다.

## 3. 글로벌 AI별 정보 출처와 사장님이 할 일

| AI | 실제 정보 출처 | 할 일 | 반영 기간 |
|----|---------------|-------|----------|
| Gemini | Google 검색 실시간 연동, 특히 **Google 비즈니스 프로필(GBP)** | GBP 등록·정보·리뷰 관리 | 2~4주 내 반영 시작, 안정 인용은 수개월 |
| Google AI Overview | Google 검색 색인 | 자체 웹사이트, JSON-LD, 검색 노출 | — |
| ChatGPT | 학습 데이터 + 일부 웹 검색 | 네이버 밖 언급(뉴스·외부 리뷰·자체 사이트) | 수개월~1년 |

점수 모델 Track 2(`GLOBAL_TRACK_WEIGHTS`, `score_engine.py:296`)의 `schema_seo` 30% · `online_mentions` 20% · `google_presence` 20% · `multi_ai_exposure` 30%는 모두 **네이버 밖 신호**를 본다. ChatGPT와 Gemini는 원리가 달라 묶어서 표시하지 않는다(CLAUDE.md 원칙).

## 4. 솔직한 한계 (사용자 안내 시 과장 금지)

- 네이버 의존도가 큰 동네 가게는 글로벌 AI 노출이 실제로 매우 낮다. 2026-09-28 체험 개선 시 ChatGPT 비유도 프롬프트 실측에서도 실제 가게가 자발적으로 추천되는 경우는 드물었다(`docs/trial_improvement_2026_09_28_v1.0.md`).
- 그래서 `DUAL_TRACK_RATIO`가 업종별로 다르다(restaurant 네이버 80/글로벌 20, 변호사 등 `legal` 20/80).
- 안내 원칙: "네이버 AI는 개선 효과가 비교적 빠르고, 글로벌 AI는 장기 과제". "곧 ChatGPT에 나옵니다" 식 약속 금지.

## 5. 미결: 네이버 AI 크롤러 차단 범위 조사

**목적**: §2의 전제(네이버가 외부 AI 수집을 막았다)를 외부 사실로 확정하고, 랜딩·FAQ·가이드 문구의 근거로 삼기.

**차단 위험 질의에 대한 판단 (같은 대화에서 논의)**
- robots.txt는 공개 정적 문서로 모든 크롤러가 먼저 읽는 파일. 1~3건 조회는 어떤 차단 기준에도 해당하지 않음.
- 글 본문·검색결과는 요청하지 않음 → 스크래핑 아님.
- 위험이 있는 것은 **AEOlab 서버가 NID 쿠키를 주입해 수행하는 기존 Playwright AI 브리핑 스캔**(`docs/naver_scraping_legal_risk_assessment_v1.0.md`)이며, 이번 조사와는 별개.
- 더 안전하게: AEOlab 서버(115.68.231.57)를 쓰지 말고 `WebFetch` 또는 로컬 PC `curl`로 조회 (쿠키가 걸린 서버 IP와 분리).

**제안 조사 범위** (사용자 승인 대기)
1. 대상: `naver.com`, `blog.naver.com`, `place.map.naver.com`(필요 시 `cafe.naver.com`)의 robots.txt
2. 확인할 User-agent: GPTBot, OAI-SearchBot, ChatGPT-User, Google-Extended, Googlebot, ClovaX/Yeti 등
3. 산출: 크롤러별 허용·차단 표 + 조회 일시(robots.txt는 수시 변경됨)
4. 후속: 결과에 따라 랜딩·FAQ·`docs/naver_gpt_work_standard_v1.0.md` 문구 점검

### 5-1. 조사 결과 (2026-10-07 22:22 로컬 PC 시각, 로컬 PC `curl`, 서버 IP 미사용)

| 대상 | 결과 |
|------|------|
| `blog.naver.com/robots.txt` (HTTP 200) | **`Disallow: /`** — Yeti, GPTBot, OAI-SearchBot, PerplexityBot, Google-Extended, ClaudeBot, Claude-SearchBot, meta-externalagent, Applebot-Extended, CCBot. 파일 안에 "AI 학습 및 RAG 목적의 봇 접근을 엄격히 금지한다"는 주석이 있음. 위에 나열되지 않은 봇(**ChatGPT-User, Googlebot, Bingbot 등**)은 `User-agent: *`에 걸려 일부 경로(PostList·PostPrint·BlogInfo 등)만 제한 |
| `www.naver.com/robots.txt` (HTTP 200) | `User-agent: *` → `Disallow: /`, `Allow: /$`(메인 페이지)만 허용 — 모든 봇에 사실상 전면 제한 |
| `place.map.naver.com/robots.txt` | **조회 불가** — 도메인이 DNS에서 확인되지 않음(호스트 자체가 없는 것으로 보임). 다른 호스트 결과는 아래 `map`·`cafe`·`place` 행 참조 |
| `map.naver.com/robots.txt` (HTTP 200, 2026-10-07 22:42) | 블로그와 동일하게 GPTBot·OAI-SearchBot·PerplexityBot·Google-Extended·ClaudeBot·Claude-SearchBot·meta-externalagent·Applebot-Extended·CCBot `Disallow: /` + `User-agent: *`도 `Disallow: /`(`Allow: /$`, `/p/$`만 허용). 스마트플레이스 상세(`map.naver.com/p/...`)가 이 호스트 아래 → **모든 봇에 사실상 전면 제한** |
| `cafe.naver.com/robots.txt` (HTTP 200) | `*`, **Googlebot, Bingbot**, Baiduspider, Yandex, GPTBot, Google-Extended, ClaudeBot, Claude-SearchBot, PerplexityBot, CCBot, Amazonbot 등 전부 `Disallow: /` — 카페는 검색엔진 포함 전면 차단 |
| `pcmap.place.naver.com` · `m.place.naver.com` | robots.txt 대신 **HTTP 429**(네이버 플레이스 HTML 에러 페이지) 응답 — 조회 못 함. 재요청하지 않음(차단 회피 시도로 보일 수 있음) |
| `WebFetch` 도구 | naver 도메인 조회 자체가 막혀 사용 불가 → 로컬 `curl`로 대체 |

**해석 시 주의**
- "ChatGPT·Gemini 전면 차단"은 **부정확**하다. 블로그는 GPTBot·OAI-SearchBot(OpenAI)·Google-Extended(Gemini 학습용)·Claude 계열 등을 명시 차단하지만, `ChatGPT-User`·`Googlebot`은 명시 차단 대상이 아니다.
- 차단 사실은 **블로그** 기준이다. 스마트플레이스·지도 쪽은 확인하지 못했으므로 "ChatGPT는 스마트플레이스에 접근 불가" 식 단정 금지.
- 이 결과가 §2의 "네이버에만 정보가 있는 가게는 ChatGPT·Gemini에 잘 안 잡힌다"는 논거를 **뒷받침**하지만, 실제 ChatGPT 노출은 §4의 비유도 실측이 근거다.

### 5-2. 이 결과로 수정한 사용자 노출 문구 (2026-10-07)

- `/pricing` ChatGPT 비교 아코디언: "robots.txt로 전면 차단" → "네이버 블로그는 robots.txt에서 ChatGPT(GPTBot·OAI-SearchBot) 등 주요 AI 수집 봇을 차단(2026-10-07 확인)". "스마트플레이스 접근 불가" → "직접 확인하기 어렵습니다".
- 랜딩 "스마트플레이스 설정부터 시작하면 AI 채널이 자동으로 커버" → 네이버 AI는 스마트플레이스, ChatGPT·Gemini는 네이버 밖 정보 필요로 분리. "AI 추천 4가지 기준"에 "네이버 AI" 명시.
- 랜딩 FAQ·체험 결과·AI탭 가이드: ChatGPT·Gemini 반영 기간을 **묶지 않고 분리**(Gemini 수주~수개월 / ChatGPT 수개월~1년 이상), "네이버 개선이 ChatGPT·Gemini에도 반영된다"는 문구 제거, "작은 가게에 더 유리" 단정 제거.

- (추가 전수 점검) 체험 결과 타임라인 "ChatGPT·Gemini에도 자동 반영 — 네이버 콘텐츠를 학습 데이터로 사용" → "네이버 밖 정보가 필요, 따로 준비"로 정정(`TrialResultStep.tsx`). `TodayOneAction.tsx`·`AiInfoTabGuide.tsx`·`ScoreEvidenceCard.tsx`·`demo/page.tsx`의 같은 계열 단정도 정정. 랜딩 "7일 추적"은 "7일 뒤 재측정"으로(출처: `routers/actions.py` 행동 완료 +7일 `rescan_at` → `jobs.py:3515` 재스캔, Gemini 단일 재측정).
- 경쟁 서비스 배타 주장("다른 서비스는 글로벌 AI만 측정") 정정 → `docs/competitor_naver_ai_support_recheck_2026_10_07.md`.

## 6. 관련 문서

- `docs/naver_gpt_work_standard_v1.0.md` — 네이버·GPT 작업 표준
- `docs/ai_exposure_standard_and_naver_seo_v1.0.md` — 5채널 AI 노출 판정 기준
- `docs/naver_scraping_legal_risk_assessment_v1.0.md` — 네이버 스캔 법적 리스크
- `docs/trial_improvement_2026_09_28_v1.0.md` — ChatGPT 비유도 실측
