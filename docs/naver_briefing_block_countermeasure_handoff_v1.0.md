# 네이버 AI 브리핑 + 정보형 + AI탭 차단 대응 — 새 대화창 핸드오프 v1.0

> 작성일: 2026-06-30 | 실측 조사 기반 (2026-06-29~30 세션)
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

### §4-A. ✅ 완료 (2026-06-30) — Chrome 레시피 이식 성공

**결과**: `captcha_detected=False` 확인. 봇 차단 우회 성공. git `3314fdf`.

- ✅ 제거: `apply_stealth(page)` (봇 감지 유발 확인)
- ✅ 추가: `channel="chrome"` + `--disable-blink-features=AutomationControlled`
- ✅ 추가: `build_chrome_ua()` — HeadlessChrome → Chrome 교체 (`__init__.py` 공유)
- ✅ 추가: `ctx.add_cookies(get_naver_cookies())` — NID_AUT 주입 (`__init__.py` 공유)
- ✅ 접근: 직접 search.naver.com URL + 브리핑 인라인 파싱 (클릭 불필요 확인)

**⚠️ 남은 한계**: 서버에 `NID_SES` 쿠키 없음 (로그인 미성립). 비로그인 상태에서도 차단 우회는 성공했으나, 플레이스형 AI 브리핑이 로그인 사용자에게만 렌더되는 경우 실제 노출 측정이 안될 수 있음. **NID_SES 추출 방법**: Chrome → F12 → Application → Cookies → `.naver.com` → `NID_SES` 값 → `backend/.env`에 `NAVER_COOKIE_NID_SES=<값>` 추가 후 `pm2 restart aeolab-backend --update-env`.

### §4-B. (2순위, 구독자 50명) BrowserBase

A단계로도 브리핑 미노출 시 AI탭 문서 §2-B와 동일 — `connect_over_cdp()` 한 줄 교체, ~$49/월. 두 스캐너 공통 적용.

### §4-C. (선택) 측정 불가 시 정직 폴백

브리핑이 끝내 안 뚫리면 → UI에서 플레이스형 AI 브리핑 항목을 **"측정 불가(일시적으로 확인 어려움)"** 로 정직 표기(이미 `scoreLabels.ts briefingTile` `captchaBlocked` 분기·`naver_scanner.py` `captcha_detected` 존재). **거짓 "미노출" 표기 금지.**

### §4-B. (2순위, 구독자 50명) BrowserBase

A단계로도 안 뚫리면 AI탭 문서 §2-B와 동일 — `connect_over_cdp()` 한 줄 교체, ~$49/월. 두 스캐너 공통 적용.

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
| `scheduler/jobs.py` | `:5360 check_naver_cookie_health_job`(쿠키 만료 자동 감지·재로그인) |

> **단일 소스 동기화**: `score_engine.py:30` ↔ `userGroup.ts:43` `BRIEFING_ACTIVE_CATEGORIES` — 한쪽 변경 시 양쪽 동시.

---

## §7. 미해결 알림 (작업 중 같이 점검 권장)

- **daily_scan_all PGRST200** — 6월 로그에 `businesses↔subscriptions` FK 관계 에러로 야간 스캔 실패 흔적. 브리핑 작업과 별개지만 스캔 파이프 점검 시 같이 확인.

---

## §8. 상업 출시 판단 (현 시점)

- **AI탭**: 우회 운영 중(쿠키 유효성만 주기 확인). 출시 가능.
- **정보형**: 측정이 아니라 준비도 안내라 차단 무관. 출시 가능(완료).
- **플레이스형 AI 브리핑**: 미해결. **출시는 §4-C 정직 폴백("측정 불가")으로 막으면 가능** — 거짓 수치만 안 내보내면 됨. §4-A 우회는 출시 후 개선으로 붙여도 됨.
- **권장**: 폴백으로 안전 출시 + §3 선결 검증 후 §4-A 우회를 점진 적용(쿠키 풀세트 확보가 전제).

---

*최종 업데이트: 2026-06-30 | 담당: 메인 세션 직접 관리 | 실측 우선·단정 금지·실측 없는 배포 금지*
