# 네이버 AI탭 차단 대응 계획 v1.0

> 작성일: 2026-06-28 | 실측 조사 기반 (2026-06-27 세션)
> 대상: `backend/services/ai_scanner/naver_ai_tab_scanner.py`

---

## §0. 현재 상태 (2026-06-28 기준) — ✅ 측정 정상 작동

| 항목 | 상태 |
|------|------|
| `NAVER_AI_TAB_ENABLED` | `true` |
| `NAVER_PROXY_LIST` | Webshare.io KR 주거용 6개 (galtcbkj-kr-1~6) |
| 실제 측정 가능 여부 | ✅ **정상 측정 중** |
| 사용자 표시 | 실제 AI탭 언급 여부 표시 |
| DB 저장 | 정상 저장 (scan() 결과 반환) |

### 차단 우회 성공 경위 (2026-06-28 실측)

```
시도 1: Chromium headless → "잘못된 접근" (전체 페이지 차단)
시도 2: channel="chrome" → shell 로드, AI 답변 차단
시도 3: apply_stealth 제거 + channel="chrome" + 직접 URL → 로그인 리다이렉트
시도 4: 일반 검색 → AI탭 링크 클릭 → ✅ AI 답변 정상 수신
```

**핵심 발견:**
- `apply_stealth(playwright-stealth)` 가 오히려 봇 감지를 유발 — 제거 후 해결
- `channel="chrome"` + `--disable-blink-features=AutomationControlled` 필수
- HTTP 헤더 `User-Agent`에 "HeadlessChrome" 노출 → `_build_chrome_ua()`로 "Chrome"으로 교체
- **접근 방식**: 직접 URL(`ssc=tab.ait.all`) 차단됨 → 일반 검색 페이지에서 AI탭 링크 클릭으로 우회
- NID_AUT + NID_SES 쿠키 주입으로 로그인 세션 인식

---

## §1. 장기 차단 가능성 전망

네이버 AI탭은 광고 수익 핵심 자산. 자동화 접근 허용 인센티브 없음.

```
[역사적 패턴]
스마트플레이스 크롤링  → 차단 강화
블로그 자동화 수집     → 차단 강화
플레이스 API          → 비공개 유지
AI탭                  → 출시 첫날부터 차단 (현재)
```

**결론: 차단은 유지·강화될 가능성이 높음. 우회 방법은 단계적으로 적용.**

---

## §2. 대응 로드맵 (구독자 단계별)

### A단계 — 지금 즉시: 네이버 계정 쿠키 주입 (비용 $0)

**가설**: 차단이 로그인 세션 미보유 때문일 수 있음. 로그인 쿠키 주입으로 우회 가능한지 검증.

**방법:**
1. 네이버 계정(테스트용) 생성
2. 로그인 후 쿠키 추출: `NID_AUT`, `NID_SES`, `NID_JKL`
3. Playwright context에 쿠키 주입 후 AI탭 접근 테스트

**구현 위치:** `naver_ai_tab_scanner.py` → `_run_scan()` → `ctx.add_cookies([...])`

```python
# backend/.env에 추가
NAVER_COOKIE_NID_AUT=<추출한 값>
NAVER_COOKIE_NID_SES=<추출한 값>

# naver_ai_tab_scanner.py
naver_cookies = []
if os.getenv("NAVER_COOKIE_NID_AUT"):
    naver_cookies = [
        {"name": "NID_AUT", "value": os.getenv("NAVER_COOKIE_NID_AUT"), "domain": ".naver.com", "path": "/"},
        {"name": "NID_SES", "value": os.getenv("NAVER_COOKIE_NID_SES"), "domain": ".naver.com", "path": "/"},
    ]
if naver_cookies:
    await ctx.add_cookies(naver_cookies)
```

**쿠키 추출 방법 (Chrome DevTools):**
```
네이버 로그인 → F12 → Application → Cookies → .naver.com
→ NID_AUT, NID_SES, NID_JKL 값 복사
```

**주의사항:**
- 쿠키 만료 주기: `NID_SES` 불필요 (NID_AUT만으로 충분), `NID_AUT` 약 1년
- 만료 감지 + 자동 갱신: `check_naver_cookie_health_job` (매주 월요일 09:30) — ✅ 구현 완료
- 완전 자동화: `.env`에 `NAVER_LOGIN_ID` + `NAVER_LOGIN_PW` 추가 시 만료 후 무인 갱신
- 상용 서비스 계정이 아닌 **전용 테스트 계정** 사용 권장

**트리거:** 즉시 가능. 테스트 계정 준비 후 30분 이내 구현.

---

### B단계 — 구독자 50명 이후: 실제 브라우저 클라우드 서비스

쿠키 주입이 실패하거나 네이버가 로그인 세션도 차단할 경우.

| 서비스 | 방식 | 월 비용 | 차단 우회력 | 비고 |
|--------|------|---------|-----------|------|
| **BrowserBase** | 실제 Chrome 인스턴스 | ~$49 | ✅ 강함 | Playwright SDK 호환 |
| **Bright Data Browser API** | 주거용 IP + 실제 Chrome | ~$100 | ✅ 매우 강함 | 기존 Webshare 대체 |
| **Browserless.io** | Chrome CDP | ~$30 | △ 보통 | 헤드리스 탐지 취약 |
| **Steel.dev** | 실제 브라우저 팜 | ~$50 | ✅ 강함 | 2025년 출시 신규 |

**BrowserBase 권장 이유:**
- Playwright SDK 그대로 사용 (`connect_over_cdp()` 한 줄 교체)
- 실제 Chrome 인스턴스 → `navigator.webdriver=false`
- 주거용 IP 풀 내장
- 기존 `NAVER_PROXY_LIST` 인프라와 병행 가능

**구현 변경량 (최소):**
```python
# 기존
browser = await p.chromium.launch(headless=True, proxy=proxy)

# BrowserBase 전환 시
browser = await p.chromium.connect_over_cdp(
    f"wss://connect.browserbase.com?apiKey={BROWSERBASE_API_KEY}"
)
# 나머지 코드 동일
```

**BEP 계산 (구독자 50명 기준):**
- Basic 9,900원 × 50명 = 495,000원/월
- BrowserBase $49 ≈ 70,000원/월
- 마진율 영향: Basic 85% → 71% (허용 범위)

---

### C단계 — 구독자 100명 이후: 네이버 공식 파트너십 타진

| 경로 | 현실성 | 소요 기간 |
|------|--------|---------|
| 네이버 검색 파트너 프로그램 신청 | △ | 6~12개월 |
| 네이버 클로바 API 활용 (AI 답변 유사 기능) | △ | 검토 필요 |
| 네이버 비즈니스 애드바이저 연계 | △ | 협의 필요 |

---

## §3. 쿠키 자동 관리 (✅ 구현 완료, 2026-06-28)

### 핵심 발견: NID_AUT만으로 충분

테스트 결과 **NID_SES 없이 NID_AUT만으로** naver.com 로그인 + AI탭 답변 수신 성공.
NID_AUT(만료 ~1년)를 naver.com에 주입하면 서버가 자동으로 세션을 인증함.

→ **사실상 1년에 한 번만 쿠키 교체** (기존 월 1회 → 연 1회).

### check_naver_cookie_health_job (scheduler/jobs.py:5360)

매주 월요일 09:30 KST 자동 실행:

```
1. NID_AUT로 naver.com 방문 → 로그인 상태 확인
2. 유효 → "NID_AUT 유효 ✅" 로그 기록 후 종료
3. 만료 감지 → NAVER_LOGIN_ID/PW로 자동 재로그인 시도
   - 성공: 새 NID_AUT → .env 파일 + os.environ 즉시 갱신 (pm2 restart 불필요)
   - 실패(2FA·캡챠): pm2 logs에 WARNING 출력
```

### 완전 자동화를 위해 .env에 추가 (선택)

```bash
NAVER_LOGIN_ID=<네이버 아이디>
NAVER_LOGIN_PW=<네이버 비밀번호>
```

설정 시: NID_AUT 만료 → 자동 재로그인 → 쿠키 갱신 → 인메모리 업데이트 (무중단).
미설정 시: 만료 감지 후 pm2 logs에 수동 교체 안내 출력.

---

## §4. 현재 코드 구조 (변경 이력)

### 수정된 파일
- `backend/services/ai_scanner/naver_ai_tab_scanner.py` (git `de917eb`)

### 핵심 변경 내용
| 변경 | 이전 | 이후 |
|------|------|------|
| AI탭 URL | `query=...` (일반 검색) | `ssc=tab.ait.all&query=...` |
| `isAITab` JS 체크 | 있음 (잘못된 해석) | 제거 |
| 차단 감지 | 없음 | "잘못된 접근" or body<100자 → `None` |
| 차단 시 반환 | `{tab_available:False, ...}` 저장 | `None` → DB 미저장 |
| UI 표시 | "측정됨 - 미언급" (거짓) | "측정 대기 중" (정직) |

### 환경변수 현황
```bash
NAVER_AI_TAB_ENABLED=true          # 스캐너 활성 (차단 시 None 반환)
NAVER_PROXY_LIST=p.webshare.io:80:galtcbkj-kr-1~6:rmqw7wtgswmy  # KR 주거용 6개
# 추가 예정 (A단계):
# NAVER_COOKIE_NID_AUT=<value>
# NAVER_COOKIE_NID_SES=<value>
```

---

## §5. 즉시 실행 트리거

### A단계 쿠키 테스트 (지금 바로 가능)

새 대화창에서:
```
"docs/naver_ai_tab_block_countermeasure_v1.0.md §2 A단계 쿠키 주입 구현할 것.
테스트 네이버 계정 쿠키를 .env에 추가하고 스캐너가 AI탭을 실제로 읽는지 확인."
```

### B단계 BrowserBase 전환 (구독자 50명 달성 시)

새 대화창에서:
```
"docs/naver_ai_tab_block_countermeasure_v1.0.md §2 B단계 BrowserBase 전환 구현할 것.
BROWSERBASE_API_KEY를 .env에 추가하고 naver_ai_tab_scanner.py를 connect_over_cdp 방식으로 전환."
```

---

## §6. 판단 기준 — 각 단계 전환 조건

| 조건 | 행동 |
|------|------|
| A단계 쿠키 → 차단 해제 | A단계 유지, 월 1회 쿠키 교체 |
| A단계 쿠키 → 여전히 차단 | 헤드리스 탐지 원인 → B단계 검토 |
| 구독자 50명 달성 | B단계 BrowserBase 도입 검토 |
| 네이버가 API 개방 | C단계로 즉시 전환 |
| 차단이 완전 불가능 확인 | AI탭 항목 UI에서 제거 or 시뮬레이션 전용으로 전환 |

---

*최종 업데이트: 2026-06-28 | 담당: 메인 세션 직접 관리*
