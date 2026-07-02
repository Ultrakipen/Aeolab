# 2026-07-01 세션 정리 — 네이버 AI 브리핑 재검증 + userGroup 동적 override 전수 수정

> 작성일: 2026-07-01 | 새 대화창에서 이어서 작업하기 위한 종합 핸드오프
> 이 문서는 **이번 대화창에서 수정/개선한 모든 사항**을 정리한 것. 세부 배경은 각 §의 관련 메모리·문서를 참조.

---

## §0. 요약 — 무엇을 왜 했는가

사용자가 "창원 웨딩 스냅 촬영 추천" 스크린샷(사진업종이 AI 브리핑에 노출)을 근거로 "대부분 업종이 노출 대상 아니냐"고 재질문 → 공식 자료 재검증 + 코드 전수 점검을 진행했고, 그 과정에서 **원래 질문과 무관한 실제 프로덕션 버그 3건**을 추가로 발견해 수정했다.

| # | 항목 | 심각도 | 상태 | 커밋 |
|---|------|--------|------|------|
| 1 | 네이버 AI 브리핑 업종분류 재검증 | — | 오판 아님 확인 (수정 불필요) | — |
| 2 | `briefing_category_expansion_monitor_job` 오탐 버그 | P0 | ✅ 수정·배포·검증 | `f9ad295` |
| 3 | Slack 알림 전체 무동작 + NID_SES 추적 사각지대 | P1 | ✅ 이메일 알림으로 대체·신설 | `cbb41df` |
| 4 | `monthly_market_news_job` PGRST200 | P0 (매달 1일 실패 중) | ✅ 수정·배포·검증 | `082f264` |
| 5 | `getUserGroup`/`getBriefingEligibility` 정적 호출 15곳 | P2 (휴면 위험) | ✅ 전수 동적 연결 완료 | `2bcda82`(대시보드 부분) → `f7326bf`(전수) |

**남은 것(사용자 결정 필요)**: NID_AUT/NID_SES 완전 자동 재로그인 — 네이버 계정 비밀번호를 서버 `.env`에 저장할지 여부 (보안 트레이드오프, §5 참조).

---

## §1. 네이버 AI 브리핑 업종분류 재검증 (오판 아님)

**질문**: "사진업종이 AI 브리핑에 노출되는데 왜 코드는 photo를 INACTIVE로 분류하는가?"

**결론**: 오판 아님. 네이버 AI 브리핑은 5유형이 있고, 그중:
- **플레이스형(가게 플레이스 카드 요약형)** — 업종 제한 있음. `BRIEFING_ACTIVE_CATEGORIES`(음식점·카페·베이커리·바·숙박)만 대상. 이게 코드가 관리하는 분류.
- **정보형/공식형 멀티출처(추천형)** — 업종 제한 **없음**. 블로그·콘텐츠가 출처로 채택되면 전 업종 노출 가능. 스크린샷은 바로 이 유형.

**공식 자료 재확인(2026 기사 2건)**: 플레이스형 확장 순서 "여행명소 → 식당·카페 → 숙박"이 현재 `BRIEFING_ACTIVE_CATEGORIES`와 정확히 일치. 의료·법무·미용 등 확정 발표 없음 → **분류 수정 불필요**.

- 관련 코드: `backend/services/score_engine.py:30 BRIEFING_ACTIVE_CATEGORIES`, `frontend/lib/userGroup.ts:20 ACTIVE_CATEGORIES`
- 관련 메모리: `project_naver_briefing_placetype_vs_infotype.md`

---

## §2. `briefing_category_expansion_monitor_job` 오탐 버그 (P0, 수정 완료)

**파일**: `backend/scheduler/jobs.py` (월 1회 실행, INACTIVE 업종의 플레이스형 확대 여부 자동 감지)

**버그**: `scanner._check_single_page(page, q, "")`로 target을 빈 문자열 전달 → `naver_scanner.py`의 `_name_in_text("", text)`가 `"" in c` 형태라 Python에서 **항상 True** → 실제 콘텐츠 유무·업종 관련성과 무관하게 "노출 감지"로 오판.

**실제 발생 확인**: 2026-07-01 09:00 KST에 `accounting`(회계사) 업종이 오탐으로 "노출 감지!" 판정 → 만약 이 알림을 신뢰해 INACTIVE→ACTIVE로 승격했다면 과거 photo 오처방과 동일한 사고가 재발했을 것.

**수정 내용**:
1. §4-A 차단우회 레시피 적용(`channel="chrome"` + 쿠키 주입 + `build_chrome_ua()`) — 이 잡이 구버전 브라우저 설정을 쓰고 있었던 것도 함께 발견·수정
2. 빈 target 트릭 제거 → 실제 렌더 텍스트 길이(`>20자`) 검증으로 교체
3. **정보형/플레이스형 분리** — "관련 질문"/"구분+근거" 신호가 있으면 정보형으로 분류해 액션 알림 대상에서 제외
4. Slack 알림은 플레이스형 후보가 임계치 이상일 때만 발송

**한계**: 정보형/플레이스형 구분은 텍스트 키워드 휴리스틱이라 100% 정확하지 않음 — 다음 정기 실행(2026-08-01) 결과를 스크린샷으로 육안 재확인 후 카테고리 변경 여부 최종 결정할 것.

상세: `docs/naver_briefing_block_countermeasure_handoff_v1.0.md` §9

---

## §3. 알림 채널 무동작 발견 + 이메일 알림 신설 + NID_SES 추적 신설 (P1, 수정 완료)

조사 중 §2 버그와 별개로 발견:

1. **Slack 알림이 전부 무동작 상태였음** — 서버 `.env`에 `SLACK_WEBHOOK_URL` 미설정. `utils/alert.py send_slack_alert`는 webhook 없으면 `logger.debug`만 남기고 조용히 종료 → 이 서비스의 모든 Slack 알림이 지금까지 아무에게도 전달된 적 없었음.
2. **수정**: `backend/services/email_sender.py`에 범용 `send_operator_alert(subject, message)` 신설(기존 동작 중인 Resend 이메일 채널 재사용, 수신처 `contact@aeolab.co.kr`) → `check_naver_cookie_health_job`의 NID_AUT 만료 임박/초과·자동 재로그인 실패 경로에 연결.
3. **NID_SES 만료 추적 사각지대 발견**: AI 브리핑 스캔에 실제로 쓰이는 `NID_SES`(~30일 주기)는 만료 추적이 전혀 없었음(기존엔 `NID_AUT` 365일 주기만 추적). `NAVER_COOKIE_NID_SES_ISSUED` 신규 env var(서버 `2026-06-30`로 설정) + 30일 주기 추적·만료 7일 전 이메일 경고 신설.
4. **보안 참고사항**: 조사 중 `.env`의 `NAVER_COOKIE_NID_SES` 값이 한 차례 grep 출력에 그대로 노출된 적 있음(본 세션 로컬 범위 내, 외부 유출 아님) — 필요시 로테이션 고려.

**한계(사용자 결정 대기)**: `NAVER_LOGIN_ID`/`NAVER_LOGIN_PW`가 `.env`에 미설정이라 NID_AUT 자동 재로그인은 골격만 있고 실제로는 항상 "이메일 알림 → 수동 교체" 경로. 완전 자동화하려면 네이버 계정 비밀번호를 서버에 저장해야 함 — 보안 트레이드오프라 사용자 승인 필요.

**후속 권장**: 매달 NID_SES 수동 교체 시 `.env`의 `NAVER_COOKIE_NID_SES_ISSUED`도 그날 날짜로 갱신할 것.

상세: `docs/naver_briefing_block_countermeasure_handoff_v1.0.md` §9 "부가 발견"

---

## §4. `monthly_market_news_job` PGRST200 버그 (P0, 매달 실패 중이던 것 — 수정 완료)

**증상**: `subscriptions↔profiles`, `subscriptions↔businesses` 사이에 FK 관계가 등록돼 있지 않은데 `.select("user_id, profiles(phone), businesses(...)")` 같은 embedded-join 문법을 써서 매달 1일 10시 실행 시 PGRST200 에러로 실패.

**수정**: 기존 파일 내 동일 패턴(`check_competitor_overtake` 등)과 같이 **3회 개별 조회 → `user_id` 기준 Python 병합**으로 교체.

```python
_subs_res = await _db(supabase.table("subscriptions").select("user_id").eq("status", "active"))
_active_user_ids = list({s["user_id"] for s in (_subs_res.data or [])}) or ["__none__"]
_profiles_res = await _db(supabase.table("profiles").select("user_id, phone").in_("user_id", _active_user_ids))
_biz_res0 = await _db(supabase.table("businesses").select("id, name, category, region, user_id").in_("user_id", _active_user_ids))
# ... user_id 기준 병합
```

**검증**: 격리 쿼리 테스트(전체 함수 실행 없이 쿼리 부분만 — 실제 Kakao/Claude API 부작용 회피)로 `subs=5, profiles=5, businesses=7` 정상 확인.

---

## §5. `getUserGroup`/`getBriefingEligibility` 정적 호출 15곳 — 동적 override 전수 연결 (완료)

### 배경

백엔드가 `BRIEFING_ACTIVE_CATEGORIES`/`BRIEFING_LIKELY_CATEGORIES`를 확장해도, 프론트엔드 호출부가 하드코딩 세트만 참조하면(override 파라미터 미전달) 재배포 전까지 옛 분류로 남는 divergence 위험이 있었다. `getUserGroup()`/`getBriefingEligibility()` 자체는 이미 `activeOverride`/`likelyOverride` 파라미터를 지원했지만, 실제 호출부 다수가 이를 넘기지 않고 있었다.

### 1차 점검의 누락

이전 턴에서 "6곳 남음"이라고 보고했으나, 이는 `getUserGroup` 호출만 집계하고 **`getBriefingEligibility`(같은 계열 함수) 호출을 세지 않은 누락 집계**였다. 재조사 결과 실제로는 **15곳**이 정적 상태였고, 그중 `GuideClient.tsx`(유료 구독자의 핵심 "AI 개선 가이드" 화면)가 최초 점검에서 완전히 빠져 있었다 — 마케팅 페이지보다 실사용자 영향이 훨씬 큰 항목이었다.

### 조치

1. **신설** `frontend/lib/useBriefingCategories.ts` — 클라이언트 컴포넌트 공용 fetch 훅. 모듈 레벨 캐시로 여러 컴포넌트가 동시에 써도 네트워크 요청 1회만 발생. 서버 컴포넌트는 기존 `frontend/lib/briefingCategoriesServer.ts`(`fetchBriefingCategories()`) 재사용.
2. **15개 호출 지점 전부 override 연결**:
   - Trial 플로우 3파일: `app/(public)/trial/page.tsx`, `TrialInputStep.tsx`(2곳), `TrialResultStep.tsx`(2곳)
   - Guide 플로우 4파일: `guide/page.tsx`, `guide/GuideClient.tsx`(2곳 — `NaverSearchBaseSection`은 실제로 `GuideTabView` 내부에 있어 props 체인 3단계로 재수정 필요했음), `guide/ai-info-tab/page.tsx`, `guide/ai-tab/page.tsx`
   - `blog-analysis/BlogClient.tsx`
   - `components/dashboard/RegisterBusinessForm.tsx`
   - `components/common/ChannelDifferentiationCard.tsx`(override props 추가)
   - 랜딩/요금제/미리보기/데모: `HeroIndustryTiles.tsx`, `pricing/GroupHeadlineBanner.tsx`, `guide/score-model-v3-1/page.tsx`, `preview/page.tsx`+`PreviewClient.tsx`, `demo/page.tsx`
3. **`RegisterBusinessForm.tsx` 죽은 코드 제거(진짜 버그 발견)** — 464~478행의 LIKELY 안내 분기가 구조적으로 **100% 도달 불가능**했음. 단정 근거: `step==='tags'` 진입 전 `setSelectedCategory()`가 항상 먼저 호출됨(파일 내 `setStep('tags')` 호출 2곳 모두 확인). 그 결과 이 블록은 항상 `!selectedCategory` 조건이 거짓이 되어야 하는데, 실제로는 조건이 뒤집혀 있어 카테고리 미선택 상태를 항상 "AI 브리핑 비대상"으로 오안내하고 있었음 → 블록 전체 제거.

### 의도적으로 제외한 것 1건

`PreviewClient.tsx`의 데모 전용 업종 스위처(`getTrack1Label` 헬퍼) — 고정 4개 demo key(cafe/restaurant/beauty/clinic) 중 "clinic"은 애초에 실제 카테고리 taxonomy에 없는 값이라 static이든 dynamic이든 결과가 항상 동일(INACTIVE). 실사용자 데이터가 아니라 동적 연결 비용 대비 효과가 없어 제외.

### 검증

- 로컬 `npx tsc --noEmit` 클린
- 로컬 `npm run build` 성공
- 서버 scp 배포 → 서버 `npm run build` 성공 → `pm2 restart aeolab-frontend` → `pm2 logs --lines 40 --nostream` 에러 0건
- 라이브 `curl https://aeolab.co.kr/api/public/briefing-categories` 정상 응답 확인 (현재 값은 하드코딩 fallback과 동일 — 오늘 당장 화면 변화는 없고, 향후 백엔드 분류 변경 시에만 효과가 드러나는 방어적 수정)

**커밋**: `2bcda82`(대시보드 부분 수정, 이전 세션) → `f7326bf`(15곳 전수 완료)

---

## §6. 관련 문서·메모리 (다음 세션에서 참조)

| 파일 | 내용 |
|------|------|
| `docs/naver_briefing_block_countermeasure_handoff_v1.0.md` | 네이버 차단 대응 종합 핸드오프 (§9에 이번 세션 §2·§3 상세) |
| memory `project_naver_briefing_placetype_vs_infotype.md` | 플레이스형 vs 정보형 구분 + 재검증 이력 |
| memory `project_usergroup_dynamic_divergence.md` | userGroup 동적 override 전수 완료 이력 (§5 상세) |

---

## §7. NID_AUT/NID_SES 자동 재로그인 여부 — 결정 완료 (2026-07-01)

**결정: 자동화하지 않음. 현재 이메일 알림 → 수동 교체 방식 유지.**

- 사유: 네이버 계정 비밀번호를 서버 `.env`에 저장할 경우 서버 침해 시 개인 네이버 계정 전체가 노출되는 보안 리스크 > 월 1회 수동 교체 작업 부담. 1인 개발·소규모 구독자 단계에서는 리스크 대비 이득이 낮다고 판단.
- 향후 재검토 조건: 구독자 규모가 커져 수동 교체 누락이 서비스 장애로 직결되는 빈도가 잦아지면, 그때는 평문 env가 아닌 별도 시크릿 관리(예: AWS Secrets Manager) 도입을 전제로 재논의.
- 현재 유지 흐름: `check_naver_cookie_health_job` → 만료 임박/초과 시 `send_operator_alert()`로 `contact@aeolab.co.kr` 이메일 발송 → 사용자가 직접 네이버 로그인 후 `NID_AUT`/`NID_SES` 쿠키 값 서버 `.env` 교체 + `NAVER_COOKIE_NID_SES_ISSUED` 날짜 갱신.

**본 세션 잔여 작업 없음.**

---

*작성: 메인 세션 직접 관리 | 실측 우선·단정 금지 원칙 적용*
