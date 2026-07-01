# 네이버 AI 브리핑 + 정보형 + AI탭 차단 대응 — 새 대화창 핸드오프 v1.0

> 작성일: 2026-06-30 | 실측 조사 기반 (2026-06-29~30 세션) | 2026-07-01 §9 추가
> 목적: 네이버 3종(AI 브리핑 / 정보형 AI 브리핑 / AI탭) 차단 대응 작업을 **새 대화창에서 즉시 이어가기** 위한 단일 핸드오프
> 자매 문서: `docs/naver_ai_tab_block_countermeasure_v1.0.md`(AI탭 전용) / `docs/naver_ai_tab_block_countermeasure_v1.0.md` §2~§6

---

## §0. 새 대화창 1줄 트리거

```
docs/naver_briefing_block_countermeasure_handoff_v1.0.md 기준으로 작업 시작.
먼저 §3 "선결 검증"부터 실측한 뒤 §4 단계 진행할 것.
```

부분 작업은 `§4-A`(AI 브리핑에 AI탭 레시피 이식) 또는 `§5`(정보형 점수/폴백)만 지정.

---

## §1. 세 가지를 혼동하지 말 것 (가장 중요)

| 대상 | 무엇 | 업종 제한 | 측정 스캐너 | 차단 상태 |
|------|------|----------|-------------|-----------|
| **플레이스형 AI 브리핑** | 가게 플레이스 카드 요약형 | ✅ 있음 (음식점·카페·베이커리·바·숙박만) | `naver_scanner.py` | ❌ **차단됨 (미해결)** |
| **정보형 AI 브리핑** | 공식형 멀티출처(추천형). 블로그·콘텐츠 출처 채택 | ❌ **없음 (전 업종)** | (직접 측정 안 함 — 준비도로 대체) | — (측정 대상 아님) |
| **AI탭** | 통합검색 내 대화형 AI 답변 섹션 | ❌ 없음 (전 업종) | `naver_ai_tab_scanner.py` | ✅ **우회 성공 (운영 중)** |

> **핵심**: "AI 브리핑"과 "AI탭"은 **별개의 네이버 기능·별개의 스캐너·별개의 차단 상태**다. AI탭은 뚫렸고, AI 브리핑(플레이스형)은 아직 못 뚫었다. 정보형은 애초에 가게 단위로 측정하는 대상이 아니라 **블로그·콘텐츠 준비도**로 다룬다.

---

## §2. 현재까지 완료된 것 (정보형 — ✅ 종료, 재작업 불필요)

> git: `aeb5c2b` → `4aa43e4` → `f5644f2` → `4139603`. 라이브 검증 완료. 메모리 `project_naver_briefing_placetype_vs_infotype` 참조.

1. **GROUP_MESSAGES 정정**(`frontend/lib/userGroup.ts`): INACTIVE/LIKELY/프랜차이즈를 "AI 브리핑 비대상" → **"플레이스형 미대상이나 정보형은 콘텐츠로 전 업종 노출 가능"**으로 통일.
2. **전수 정정**: 프론트 26+곳 + 백엔드 6파일(`score_engine.py` 주석·`public_briefing.py` note 등) 동일 어휘로 정정.
3. **3층 준비도 구현**(`blog-analysis/BlogClient.tsx`):
   - Layer1 `InfoBriefingReadinessCard` — "정보형 네이버 AI 브리핑 준비도: 양호/보통/주의 필요"(텍스트 레이블 `readinessLabel`, 임계 70/40) + 실측 근거 1줄(post_count·freshness·키워드·발행주기)
   - Layer2 `WeeklyActionsCard` 인과 문구(완료→정보형 브리핑 인용 + ChatGPT·Gemini 노출)
   - Layer3 `localStorage aeolab_info_briefing_readiness_${bizId}` 준비도 변화 텍스트
4. **scoreLabels.ts `briefingTile`**: INACTIVE/프랜차이즈 → "플레이스형 해당 없음 / 블로그·콘텐츠로 정보형 AI 브리핑·검색·AI탭 노출 가능"
5. **점수 숫자 신규 노출 0** — 텍스트 레이블 원칙 준수.

> ⚠️ **photo 등 INACTIVE 업종을 `BRIEFING_ACTIVE_CATEGORIES`(플레이스형)로 옮기지 말 것** — 잘못된 스마트플레이스 처방 발생. 플레이스형 분류는 그대로 유지가 정답.

---

## §3. 선결 검증 (작업 시작 전 반드시 실측 — 단정 금지)

> 2026-06-30 실측: **AI 브리핑은 헤드리스에 렌더되지 않음(soft block).** CAPTCHA 없이 degraded 페이지(5.7~7.7KB, briefing 셀렉터 0개)만 반환. 쿠키 1개(NID_AUT)만 주입 → 로그인 미성립 → 브리핑 여전히 0.

**그러나 이 테스트는 `naver_scanner.py`의 옛 방식(headless Chromium + `apply_stealth` + 직접 URL)으로 한 것** — 바로 AI탭 문서 §0에서 "차단됨"으로 판명난 그 레시피다. **AI탭이 뚫은 승리 레시피를 아직 브리핑에 적용 안 했다.**

### 작업 전 직접 확인할 3가지 (SSH 실측)

1. **서버 쿠키 풀세트 여부** — `.env`에 `NID_AUT` + **`NID_SES`** 둘 다 있는지. (직전 점검 시 NID_AUT 1개만, NID_SES 없음 → 로그인 미성립)
   ```bash
   ssh root@115.68.231.57 "grep -c NAVER_COOKIE /var/www/aeolab/backend/.env"
   ```
2. **AI탭 스캐너가 지금 실제로 작동 중인지** — 차단 우회가 현재도 유효한지 (쿠키 만료 가능). `scan_results`에 최근 `in_ai_tab` 측정값이 들어오는지 / pm2 로그 `[naver_ai_tab]` 확인.
3. **AI탭 승리 레시피 정확한 구성** — `naver_ai_tab_scanner.py`에서 `channel="chrome"` / `apply_stealth` 미사용 / `--disable-blink-features=AutomationControlled` / `_build_chrome_ua()` / AI탭 링크 클릭 접근 / `ctx.add_cookies()` 위치 재확인.

> **단정 금지 규칙(CLAUDE.md §문제 분류 검증)**: "브리핑 차단됨"을 결론내기 전, **반증 시도 1개**(= AI탭 레시피로 브리핑 페이지를 다시 열어보기)를 반드시 먼저 실행. 옛 레시피 결과만으로 "불가능" 단정 금지.

---

## §4. AI 브리핑 차단 대응 단계

### §4-A. ✅ 완료 (2026-06-30) — Chrome 레시피 이식 성공 + DOM 셀렉터 완전 수정

**결과**: `captcha_detected=None` (차단 없음), 브리핑 실측 탐지 정상. git `3314fdf` → `c0d2212`.

- ✅ 제거: `apply_stealth(page)` (봇 감지 유발 확인)
- ✅ 추가: `channel="chrome"` + `--disable-blink-features=AutomationControlled`
- ✅ 추가: `build_chrome_ua()` — HeadlessChrome → Chrome 교체 (`__init__.py` 공유)
- ✅ 추가: `ctx.add_cookies(get_naver_cookies())` — NID_AUT + NID_SES 주입
- ✅ **BRIEFING_SELECTORS 갱신**: 2026 실측 기준 `fds-aib-expandable-container` 최우선 추가 (구버전 `.ai_answer_area` 등 전부 MISS → 신규 클래스 접두사 `fds-aib` 일치)
- ✅ **"펼쳐서 더보기" JS evaluate 클릭**: `ElementHandle.click()` overlay 타임아웃 → `page.evaluate("el => el.click()")` 교체
- ✅ **최종 검증**: 신신예식장 `in_briefing=True` / 숨고 `in_briefing=True` — 브리핑 내 실존 업체 정확 탐지 확인

**브리핑 동적 특성 주의**: 정보형 AI 브리핑은 블로그·콘텐츠 인용 순위로 매일 변동. 홍스튜디오 `in_briefing=False`는 스캐너 문제가 아니라 해당 쿼리 당일 브리핑에 미포함인 것(2026-06-30 실측 확인). NID_SES 쿠키도 서버에 주입 완료.

### §4-B. (2순위, 구독자 50명) BrowserBase

A단계로도 브리핑 미노출 시 AI탭 문서 §2-B와 동일 — `connect_over_cdp()` 한 줄 교체, ~$49/월. 두 스캐너 공통 적용.

### §4-C. (선택) 측정 불가 시 정직 폴백

브리핑이 끝내 안 뚫리면 → UI에서 플레이스형 AI 브리핑 항목을 **"측정 불가(일시적으로 확인 어려움)"** 로 정직 표기(이미 `scoreLabels.ts briefingTile` `captchaBlocked` 분기·`naver_scanner.py` `captcha_detected` 존재). **거짓 "미노출" 표기 금지.**

---

## §5. 정보형 후속 (선택 — 사용자 미선택 보류 중)

1. **Track1 점수 기여** — 정보형 브리핑 노출 가능성을 점수에 반영. 현재 블로그·콘텐츠는 Track2 `online_mentions` 0.20에만 반영. INACTIVE 업종은 `naver_exposure_confirmed`(15%)가 0점 처리(`score_engine.py:584`)되는데, 정보형 준비도를 어떻게 점수화할지 미정. **점수 모델 변경이라 사용자 승인 후 진행.**
2. **scanner `briefing_type` 라벨** — `naver_scanner.py` 반환에 `briefing_type: "place"|"info"` 추가해 두 유형을 데이터로 구분(현재 in_briefing만). 측정 정확도용.

---

## §6. 관련 파일·라인 (작업 시 직접 확인)

| 파일 | 핵심 |
|------|------|
| `backend/services/ai_scanner/naver_scanner.py` | AI 브리핑 스캐너. `:103 _check_single_page`(브리핑 파싱), `:128 캡챠 감지`, `:226 check_mention`, `:246 check_mention_multi`. **옛 레시피 — 교체 대상** |
| `backend/services/ai_scanner/naver_ai_tab_scanner.py` | AI탭 스캐너(승리 레시피 원본). `:28 _get_naver_cookies`, `_build_chrome_ua`, `ctx.add_cookies` |
| `backend/services/ai_scanner/__init__.py` | `apply_stealth`·`get_proxy_config`·`get_random_ua` 공유. `_get_naver_cookies` 이식 목적지 |
| `backend/services/ai_scanner/multi_scanner.py` | `:40 PLAYWRIGHT_SEMAPHORE`, 추천 쿼리 빌드(`:223`,`:270`), `naver.check_mention_multi` 호출 |
| `backend/services/score_engine.py` | `:30 BRIEFING_ACTIVE_CATEGORIES`(플레이스형 단일 소스), `:584 inactive 가중치 제외`, `:529 inactive 설명` |
| `frontend/lib/userGroup.ts` | `:43 BRIEFING_ACTIVE_CATEGORIES`(프론트 단일 소스), `GROUP_MESSAGES` |
| `frontend/lib/scoreLabels.ts` | `:112 briefingTile`(플레이스형/정보형 분기·captchaBlocked 폴백) |
| `frontend/app/(dashboard)/blog-analysis/BlogClient.tsx` | `InfoBriefingReadinessCard`(3층 준비도) |
| `backend/scheduler/jobs.py` | `:5394 check_naver_cookie_health_job`(쿠키 만료 자동 감지·재로그인) / `:5313 briefing_category_expansion_monitor_job`(월 1회 INACTIVE 업종 플레이스형 확대 감지 — **2026-07-01 오탐 버그 수정, §9 참조**) |

> **단일 소스 동기화**: `score_engine.py:30` ↔ `userGroup.ts:43` `BRIEFING_ACTIVE_CATEGORIES` — 한쪽 변경 시 양쪽 동시.

---

## §7. 미해결 알림 (작업 중 같이 점검 권장)

- **daily_scan_all / monthly_market_news_job PGRST200** — `subscriptions↔businesses`, `subscriptions↔profiles` FK 관계 미등록으로 `!inner` 조인 실패 흔적이 반복 발생 중(2026-07-01 01:00 KST에도 `monthly_market_news_job` 동일 에러로 실패 확인). 브리핑 작업과 별개지만 스캔·잡 파이프 점검 시 같이 확인 권장.

---

## §8. 상업 출시 판단 (현 시점)

- **AI탭**: 우회 운영 중(쿠키 유효성만 주기 확인). 출시 가능.
- **정보형**: 측정이 아니라 준비도 안내라 차단 무관. 출시 가능(완료).
- **플레이스형 AI 브리핑**: 미해결. **출시는 §4-C 정직 폴백("측정 불가")으로 막으면 가능** — 거짓 수치만 안 내보내면 됨. §4-A 우회는 출시 후 개선으로 붙여도 됨.
- **권장**: 폴백으로 안전 출시 + §3 선결 검증 후 §4-A 우회를 점진 적용(쿠키 풀세트 확보가 전제).

---

## §9. 2026-07-01 추가 조사 — "다수 업종이 노출 대상 아닌가?" 재검증 + 모니터링 잡 버그 수정

> 사용자가 "창원 웨딩 스냅 촬영 추천"(2026-06-29와 동일 스크린샷) 재제기 → 공식 자료·서버 실측으로 재검증.

### 재검증 결론 — 오판 아님, 기존 §1~§2 결론 유효

- **공식 자료 확인(2026 기사 2건)**: 플레이스형 AI 브리핑 확장 순서는 "여행명소 → 식당·카페 → 숙박"(2026년 공식) — 현재 `BRIEFING_ACTIVE_CATEGORIES`(restaurant/cafe/bakery/bar/accommodation)와 정확히 일치. 네이버는 "올해 말까지 적용 범위 2배 확대, 쇼핑·로컬 연결"이라 밝혔으나 의료·법무·미용 등 확정 발표는 아직 없음.
- **정보형(공식형·멀티출처형)은 "정보형 검색 질의"면 업종 무관 노출**이 공식 기사로도 재확인됨 — 기존 결론([[project_naver_briefing_placetype_vs_infotype]])과 일치. **코드의 ACTIVE/LIKELY/INACTIVE 분류(플레이스형 게이팅)는 수정 불필요.**

### 신규 발견 — `briefing_category_expansion_monitor_job` 오탐 버그 (P0, 수정 완료)

- **근거**: `jobs.py:5357`(수정 전) `scanner._check_single_page(page, q, "")` — target을 빈 문자열로 전달. `naver_scanner.py:99 _name_in_text`는 `t in c`로 매칭하는데 `t=""`이면 Python에서 항상 `True`. 즉 실제 브리핑 콘텐츠 존재·업종 관련성과 무관하게 `fds-aib` 클래스 접두사를 가진 DOM 요소가 하나라도 있으면 무조건 "노출 감지"로 판정.
- **반증 시도**: 서버에서 §4-A 레시피(channel=chrome+쿠키)로 동일 쿼리("강남 회계사 추천" 등)를 직접 재현 — 매칭된 `fds-aib` 요소의 실제 텍스트 길이가 0인 경우도 "노출 감지"로 이어지는 경로임을 코드 추적으로 확인. 실제 프로덕션 로그에서도 2026-07-01 09:00 KST `briefing_category_expansion_monitor_job` 실행 시 `accounting` 업종이 "노출 감지!"로 판정되어 Slack 액션 알림(`score_engine.py BRIEFING_LIKELY_CATEGORIES 업데이트 필요`)이 발송되는 것을 로그로 직접 확인.
- **위험도**: 이 알림을 그대로 따라 INACTIVE 업종을 ACTIVE/LIKELY로 승격했다면 photo 업종 때와 동일한 오처방(잘못된 스마트플레이스 완성도 가이드) 사고가 재발했을 것.
- **추가 문제**: 이 잡은 §4-A 차단 우회 레시피(channel=chrome, 쿠키 주입, apply_stealth 미사용)를 적용받지 못한 **구버전 브라우저 launch 설정**을 그대로 쓰고 있었음 — §2/§6에 이 파일이 누락되어 있었던 것이 원인.
- **수정 내용(git `f9ad295`, 배포 완료·검증됨)**:
  1. §4-A 레시피 적용(channel=chrome + `get_naver_cookies()` + `build_chrome_ua()`)
  2. 빈 target 트릭 제거 — 실제 렌더 텍스트 길이(`>20자`) 검증으로 교체
  3. **정보형/플레이스형 분리** — "관련 질문" 또는 "구분+근거" 비교표 신호가 있으면 정보형으로 분류해 액션 알림 대상에서 제외, 그 외 실질 콘텐츠만 플레이스형 후보로 카운트
  4. Slack 알림은 플레이스형 후보가 실제로 임계치 이상일 때만 발송 (정보형만 감지되면 INFO 로그만 남기고 액션 알림 없음)
- **한계**: 정보형/플레이스형 구분은 현재 텍스트 키워드 휴리스틱(관련질문/비교표)이며 100% 정확하지 않음. 다음 달(2026-08-01 09:00 KST) 정기 실행 결과로 추가 보정 필요 — Slack 알림이 오면 **바로 신뢰하지 말고 실제 화면(스크린샷)으로 플레이스 카드 vs 멀티출처 카드인지 육안 재확인 후 카테고리 변경 여부 결정**.
- **일반화 교훈**: "~추천" 형태의 질의로 업종 확대를 감지하려는 모든 자동화는 정보형 오탐 위험을 구조적으로 안고 있다. 향후 유사 모니터링 코드 작성 시 반드시 정보형 신호 필터링을 함께 구현할 것.

### 부가 발견 — 알림 채널 자체가 무동작 상태였음 (수정 완료)

- **근거**: 서버 `.env`에 `SLACK_WEBHOOK_URL`이 비어있음(`grep -c 'SLACK_WEBHOOK_URL=.'` → 0). `utils/alert.py:12-14 send_slack_alert`는 webhook 미설정 시 `logger.debug`만 남기고 조용히 종료 — 즉 위 accounting 오탐을 포함해 **이 서비스의 모든 Slack 알림이 지금까지 실제로는 아무에게도 전달된 적 없음**.
- **반증 시도**: `RESEND_API_KEY`(이메일 발송)는 서버에 설정돼 있고 `email_sender.send_operator_delivery_notification`(대행 서비스 주문 알림)이 실제로 이 채널로 정상 동작 중임을 코드로 확인 — 완전히 알림이 죽은 게 아니라 Slack 채널만 죽어있었음.
- **수정(git `cbb41df`, 배포·수동 실행 검증 완료)**: `email_sender.py`에 범용 `send_operator_alert(subject, message)` 신설(Resend 재사용, `contact@aeolab.co.kr`) → `check_naver_cookie_health_job`의 NID_AUT 만료 임박/초과·자동 재로그인 실패·자격증명 미설정 경로에 연결.
- **NID_SES 만료 추적 사각지대 신규 해소**: 기존엔 `NID_AUT`(365일 주기)만 추적하고 **AI 브리핑 스캔에 실제로 쓰이는 `NID_SES`(~30일 주기, 훨씬 짧음)는 만료 추적이 전혀 없었음**. `NAVER_COOKIE_NID_SES_ISSUED` 신규 env var(서버에 `2026-06-30`으로 설정 완료 — §4-A 주입일 기준) + 30일 주기 추적·만료 7일 전 이메일 경고 블록 추가.
- **한계**: NID_AUT 자동 재로그인은 `NAVER_LOGIN_ID`/`NAVER_LOGIN_PW`가 .env에 없어(현재 미설정) 실제로는 항상 "수동 교체 필요" 경로로 빠짐 — 자동화는 골격만 있고 크리덴셜 등록 전까지는 이메일 알림 → 수동 대응 흐름. NID_SES는 애초에 자동 재로그인 대상이 아니라(로그인 세션 쿠키) 매번 수동 교체 필요, 이메일 알림만 자동화됨.
- **후속 권장**: 매달 1회 NID_SES 수동 교체 시 `.env`의 `NAVER_COOKIE_NID_SES_ISSUED`도 그날 날짜로 함께 갱신할 것(안 하면 추적이 stale해짐). 자동화하려면 §4-A 재로그인 스크립트에 NID_SES 추출도 추가하는 것을 다음 단계로 고려.

---

*최종 업데이트: 2026-07-01 | 담당: 메인 세션 직접 관리 | 실측 우선·단정 금지·실측 없는 배포 금지*
