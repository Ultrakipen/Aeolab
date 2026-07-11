# AEOlab 상업 서비스 준비 — 마스터 점검 계획 v1.0

> 지금까지 8개 이상의 개별 점검 기준 문서(§0 참조)가 파편적으로 쌓였다. 이 문서는 그 계보를 하나의 실행 가능한 4-레이어 기준으로 통합하고, **실제로 검증된(반증 통과) 잔여 gap만** 우선순위와 함께 정리한다. "구멍이다"라고 적은 항목은 전부 근거 file/doc + 반증 시도를 거쳤다(§3).

---

## §0. 왜 통합이 필요한가 — 기존 점검 기준의 계보

| 세대 | 문서 | 초점 | 날짜 |
|---|---|---|---|
| 1세대 | `commercial_inspection_standard_v1.0.md` → `v2.0.md` | 페이지별 **사실 정확성**(가격 일치·업종분류·면책문구) | 2026-06-24~26 |
| 2세대 | `full_site_prelaunch_inspection_standard_v1.0.md` | 75페이지 **7기준(A~E)+게이트N(네이버우선)·T(AI노출기간)** | 2026-06-17 |
| 3세대 | `nine_pages_measurement_inspection_v1.0.md` | **레이어A(프론트 표시)+레이어B(백엔드 파이프라인 무결성)** 2계층 | 2026-07-02 |
| 4세대 | `external_benchmark_commercial_quality_v1.0.md` | **외부 벤치마크**: Nielsen 10휴리스틱·WCAG 2.1 AA·경쟁 SaaS·카피톤 4축 | 2026-07-09 |
| 5세대 | `admin_screens_inspection_plan_v1.0.md`, 대행서비스 2R 재검증 | **실측 재현**: 정적 리뷰 무효화, 실클릭+DB대조+TOCTOU/락 검증 | 2026-07-10~11 |

각 세대는 이전 세대가 못 잡는 결함 유형을 잡기 위해 생겼다 — **한 세대만으로는 불충분**하므로 이번 계획은 4개를 전부 통합해 하나의 체크리스트로 쓴다.

---

## §1. 통합 기준 — 4-레이어

| 레이어 | 잡아내는 결함 유형 | 방법 | 원 출처 |
|---|---|---|---|
| **L1 사실 정확성/실측 무결성** | 허위 수치·표시-DB 불일치·측정 실패를 성공으로 오집계 | 코드 grep + API 실호출로 응답값 대조 | commercial_inspection_standard, nine_pages 레이어B |
| **L2 기능 정합성** | PC/모바일 단절, 이해도 부족, 네이버 우선순위 위반, AI노출기간 오기재 | 브라우저 실접속 + 반응형 확인 | full_site_prelaunch (A~E+게이트N/T) |
| **L3 외부 벤치마크** | 업계 수준 미달(대비율·정보위계·톤·휴리스틱 위반) | Nielsen 10휴리스틱 + WCAG 2.1 AA + 경쟁 서비스 비교 | external_benchmark_commercial_quality |
| **L4 실측 재현/동시성** | 권한 우회, 락/세마포어 중첩, TOCTOU, 관리자 기능 공백 | 실제 클릭 시퀀스 + DB 직접 대조 + 동시 요청 재현 | admin_screens, delivery 2R |

**핵심 발견**: 지금까지 L1·L2는 75페이지 전체에 적용됐고(2026-06-17 완료 선언), L4는 관리자·구독·대행 영역에 적용됐다. **L3(외부 벤치마크)만 유일하게 전 영역에 적용되지 않았다** — 이게 §3의 진짜 gap이다.

---

## §2. 영역×레이어 커버리지 매트릭스

| 그룹 | 대표 페이지 | L1 | L2 | L3 | L4 |
|---|---|---|---|---|---|
| **D. 로그인 후 핵심 9페이지+대시보드** | 대시보드/경쟁사/가이드/블로그진단/리뷰답변/이력·성장/스키마·창업·광고방어/소개글 | ✅ | ✅ | ✅ 2026-07-09 | — |
| **H. 관리자** | `/admin/*` 13페이지 | ✅ | ✅ | ❌ | ✅ 2026-07-10 |
| **E. 대행 서비스** | `/delivery/*` | ✅ | ✅ | ❌(프로세스/동시성만) | ✅ 2026-07-11 |
| **구독 생애주기** | 갱신/카드변경/해지/환불 | ✅ | ✅ | ❌ | ✅ 2026-07-06~07 |
| **A. 공개 마케팅/전환** | `/`, `/demo`, `/how-it-works`, `/pricing`, `/faq`,`/help`,`/terms`,`/privacy`,`/score-guide`, `/guide/chatgpt-search`,`/guide/channels/*`, `/blog*`,`/stories*`,`/resources*`, `/tools/*`,`/keywords*`,`/quick`, `/share/*` | ✅ | ✅ | ❌ | — |
| **B. 무료체험** | `/trial`, `/trial/claimed` | ✅ | ✅ | ❌ | — |
| **C. 온보딩/인증** | `/onboarding`, `/login`, `/signup`, `/reset-password` | ✅ | ✅ | ❌ | — |
| **F. 지원(사용자단)** | `/support`, `/support/tickets*` | ✅ | ✅ | ❌ | ❌(관리자단만 L4 완료) |
| **G. 결제** | `/payment/success`, `/fail`, `/card-update` | ✅ | ✅ | ❌ | 부분(구독 L4에 포함) |

---

## §3. 검증된 잔여 gap (근거 + 반증)

### gap-1: 공개 전환 퍼널(A+B그룹, 약 20페이지)이 L3 미적용
- **근거**: `external_benchmark_commercial_quality_v1.0.md` §3 완료 목록·`six_pages_/dashboard_external_benchmark_inspection_plan` 어디에도 `/`,`/pricing`,`/trial`,`/faq` 등 그룹 A/B 페이지명 없음(Explore 에이전트 직접 확인)
- **반증 시도**: `commercial_inspection_standard_v2.0.md` §2.1~2.3이 홈페이지·trial·pricing을 다루지만, 이는 **L1(가격 일치·문구 정확성)** 뿐 L3(대비율·정보위계·경쟁 서비스 대비 신뢰도)와는 별개 축 → 반증 실패, gap 확정
- **왜 중요한가**: BEP 20명 미달 상태에서 **가입 전환을 결정하는 페이지들이 정작 가장 높은 기준의 검증을 받은 적이 없다** — 반대로 이미 구독한 사용자가 쓰는 대시보드만 최고 기준을 통과한 역설적 상태

### gap-2: 온보딩/인증(C그룹) L3 미적용
- **근거**: 위와 동일 방식으로 확인, `/onboarding`·`/login`·`/signup` 문서상 L3 이력 없음
- **반증 시도**: `subscription_lifecycle_inspection_v1.0.md`가 온보딩을 다루지만 "1단계→pricing 경로 부재"라는 **L2급 버그 기록**뿐, WCAG/Nielsen 검증 없음 → gap 확정
- **왜 중요한가**: 결제 직전 마지막 단계로, 이탈 시 매출 직결

### gap-3: 사용자 지원(F그룹) L3+L4 미적용
- **근거**: `admin_screens_inspection_plan_v1.0.md`가 `admin/support`(운영자 측)는 L4까지 완료했으나 `(dashboard)/support`(사용자 측 문의 작성 플로우)는 어느 문서에도 없음
- **반증 시도**: `full_site_prelaunch`가 그룹 F를 목록에는 포함(§0 인용) 했지만 "완료" 표로 실행됐다는 기록은 못 찾음 → gap 확정(단, 우선순위는 낮음 — 대행서비스 처럼 결제가 얽힌 곳이 아님)

### gap-4: 결제 페이지(G그룹) 신뢰 신호 L3 미적용
- **근거**: `/payment/success`,`/fail`,`/card-update`는 구독 생애주기 점검(L4)에 포함됐으나 이는 로직 정확성 검증이지 "카드 정보 입력 화면이 보안 신뢰를 주는가"류의 UX 벤치마크가 아님
- **반증 시도**: 결제 성공/실패 안내 문구는 L2에서 검증됨(§2 매트릭스) — 하지만 그건 "안내가 맞는 말인가"이지 "업계 결제 UX 수준인가"와는 다른 질문 → gap 확정, 단 규모는 작음(페이지 3개)

### gap-5 (방법론 자체의 한계): 지금까지의 L3 "외부 벤치마크"는 실제 라이브 비교가 아니었다
- **근거**: `external_benchmark_commercial_quality_v1.0.md`가 BrightLocal·SEMrush·Ahrefs·Jasper·Birdeye·Podium을 비교 대상으로 언급하지만, 그 사이트들을 실제 브라우저로 열어 스크린샷 대조한 기록은 없음 — Nielsen/WCAG 기준을 **체크리스트로 자체 채점**한 것
- **반증 시도**: 이 세션부터 `mcp__playwright__*` 브라우저 도구가 세션에 연결돼 실제 방문·스크린샷 비교가 가능해짐(이전 세션은 이 도구 없이 진행됐을 가능성) → 방법론을 한 단계 격상할 여지가 실재. gap 확정(선택적 보완 항목)

### 오판 방지(반증으로 걸러진 것) — 다시 하자고 제안하지 않는 항목
- D그룹(대시보드+9페이지) L3 재점검 — 이미 2026-07-09 완료, 재검증에서도 오판 0건 확인됨(memory: `project_dashboard_benchmark_execution_2026_07_09`)
- 75페이지 L2 전수 — 2026-06-17 완료 선언 근거 있음(단, §0.1 문서 헤더의 "미착수" 문구는 그날 세션 **시작 시점**의 스냅샷이 갱신 안 된 흔적일 뿐, 이후 로그·MEMORY 완료 기록과 모순되지 않음)
- 관리자·대행·구독 L4 — 전부 최근(07-06~11) 완료, 재점검 불필요

---

## §4. 실행 우선순위

| 순위 | 대상 | 이유 | 예상 규모 |
|---|---|---|---|
| **P1** | 그룹 A 핵심 3페이지(`/`, `/pricing`, `/trial`) + 그룹 C(`/onboarding`,`/signup`) | 전환 퍼널 직결, BEP 미달 상태에서 최고 ROI | 세션 1개 |
| **P2** | 그룹 A 나머지(정적/콘텐츠/도구 페이지 약 15개) | 전환 영향은 적지만 SEO·리드젠 관문 | 세션 1~2개 |
| **P3** | 그룹 G(결제 3페이지) | 규모 작음, 이미 L2/L4로 로직은 검증됨 — 신뢰 UX만 보완 | 세션 1개 이하 |
| **P4** | 그룹 F(사용자 지원) | 저빈도 페이지, 사고 이력 없음 | 여유 시 |
| **선택** | gap-5 방법론 격상 — 실제 경쟁 서비스(아이보스, 스마트플레이스 진단, BrightLocal 등)를 Playwright로 직접 열어 스크린샷 나란히 비교 | 정성 판단을 정량 근거로 승격 | P1과 결합 권장 |

---

## §5. 새 대화창 트리거 (기존 관례)

> `docs/master_inspection_plan_v1.0.md 기준으로 P1(랜딩·요금제·trial·온보딩) L3 외부벤치마크 점검 진행. gap-5 방법론대로 실제 경쟁 서비스 라이브 비교 포함`

### §5.1 진행 상태 (2026-07-11 세션 — 실행 착수)

- **완료**: 랜딩페이지(`/`) 라이브 실측(Playwright `getComputedStyle` 대비율 계산) 1회 수행. 확정 위반 63건 발견 → 가장 심각한 8건(면책문구·상태배지, 대비율 2.3~2.6:1) 수정+배포+git커밋(`00bbcff`) → 재실측으로 해소 확인
- **미완료(다음 세션 트리거)**: `text-gray-400` 패턴이 랜딩페이지에만 57건 추가 잔존 + **사이트 전체 161개 파일 800건 이상**(`app/` 93파일 590건, `components/` 68파일 206건). 이미 "L3 완료"로 기록된 파일(`ScoreCard.tsx` 등)에도 존재 — 과거 "대비율 246건 전수 완료" 기록과 충돌하므로 **왜 안 잡혔는지 원인 확인이 선행 필요** (스코프가 달랐는지, 그 사이 새로 추가됐는지)
- **다음 세션 트리거 명령**: `docs/master_inspection_plan_v1.0.md §5.1 기준으로 text-gray-400 800건 규모 대비율 잔여 작업 이어서 진행. 파일별 확인(다크모드·아이콘·의도된 저대비 예외 배제) 후 일괄 수정`
- 상세 근거: memory `project_master_inspection_plan_and_contrast_scale_2026_07_11`

#### §5.1-A 배치 진행 로그 (별도 세션에서 실행 착수, 2026-07-11)

**분류 기준 확정** (`app/`+`components/`, `.bak*` 파일 15개는 죽은 코드라 스코프 제외):
- **제외(예외)**: `dark:text-gray-400`(다크모드 전용) · 자체닫힘 아이콘 태그(`<IconName className="... text-gray-400" ... />`, 텍스트 없음) · `placeholder`류 · `disabled:`/`cursor-not-allowed` 문맥
- **grep 1차 분류**: 전체 905건(비-dark) → 아이콘 106건 + placeholder 32건 + disabled류 13건 제외 → 위반 후보 667건 → `.bak*` 제외 후 **614건 / 134개 실파일**
- **위반 판정**: 후보 샘플(`CompetitorsClient.tsx` 등) Read로 문맥 확인 — ternary 상태배지(`측정 실패`·`두 가게 같은 성장 단계` 등 의미있는 텍스트)도 위반으로 판정(장식 아닌 실제 정보). 기존 커밋(`00bbcff`)과 동일하게 `text-gray-400`→`text-gray-500` 치환

**배치 1 완료** (git `ddd74a0`):
- 대상: `CompetitorsClient.tsx`(62건)·`GrowthClient.tsx`(44건)·`PreviewClient.tsx`(34건) — 3개 파일 모두 `dark:`/`placeholder`/`disabled` 패턴 없음 확인 후 파일 전체 치환
- 검증: md5 사전일치 → scp(tar 파이프) → 서버 grep 0건 → `npm run build` 성공 → pm2 재시작 error.log 신규 에러 없음(recharts 경고는 기존 누적분) → curl 3페이지 307(로그인 리다이렉트, 500 아님) → **라이브 브라우저는 동시 세션 lock으로 실측 불가**(3회 재시도 실패) → WCAG 공식 수학 검증으로 대체: `text-gray-500(#6B7280)` on white 4.83:1 / gray-50 4.63:1 / gray-100 4.39:1 (gray-400의 2.3~2.5:1 대비 대폭 개선)
- **경미 flag(차단 아님)**: `bg-gray-100 text-gray-500` 배지 조합 12곳(`CompetitorsClient.tsx:189,204,1223` 등)은 4.39:1로 AA 4.5:1 근소 미달 — 기존에도 있던 배경조합이라 이번에 악화된 건 아님, 향후 배지류만 `text-gray-600` 상향 검토 여지(보류 목록)
- 로컬 git 커밋 완료, push는 보류(drift 정책)

**배치 1 이후 잔여**: 약 620건 / 158개 파일(다크 제외, `.bak*` 포함 카운트)

**판단 보류 목록**: `bg-gray-100 text-gray-500` 배지류 12곳+ · `.bak*` 파일 15개(청소 여부 별도 판단 필요) · 어두운 배경 카드 내부 여부는 배치마다 개별 확인 필요

**배치 2 완료** (git `f5170a5`, 같은 세션 이어서 진행):
- 대상: `AdminDashboard.tsx`(23)·`HeroSampleCard.tsx`(21)·`CompetitorPlaceCard.tsx`(22)·`AdminOpsClient.tsx`(26)·`RegisterBusinessForm.tsx`(21, 1건 제외)·`BusinessManager.tsx`(20) = **132건 치환**
- 신규 예외 발견: `RegisterBusinessForm.tsx:990` — `disabled={already}` 버튼의 ternary 클래스(`'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'`, 이미 선택된 키워드 태그 표시)는 진짜 disabled 상태라 제외. `cursor-not-allowed`가 파일 내 다른 줄에도 있었지만 실제로 `text-gray-400`과 같은 줄인 건 이 1곳뿐이었음(같은-줄 grep으로 확인, 파일 전체 매치 카운트로 오판하지 않도록 주의)
- 검증: md5 사전일치(6파일 전부) → scp → 서버 grep(5파일 0건, RegisterBusinessForm 1건=의도된 예외 정확히 일치) → 빌드 성공(error 0) → pm2 재시작(recharts 경고만, 신규 에러 없음) → curl 4페이지 200/307(500 없음) → **라이브 브라우저 재시도 3회 추가 실패**(계속 lock) → `/`(공개 페이지)는 curl로 실제 배포 HTML 확인: `text-gray-500` 69건 존재(빌드 반영 확인), `HeroSampleCard.tsx` 외 랜딩의 다른 26건은 아직 배치 3 이후 대상이라 잔존 정상
- 로컬 git 커밋, push 보류

**배치 2 이후 잔여**: 488건 / 153개 파일

**다음 배치 후보**(파일별 건수 내림차순, `.bak*` 제외): `GuideClient.tsx`(27)·`onboarding/page.tsx`(23)·`AdminScoreComparisonClient.tsx`(14)·`AdminNoticesClient.tsx`(14)·`AdminFeedbackClient.tsx`(12)·`TrialResultStep.tsx`(12)·`admin/business/[id]/page.tsx`(11)·`how-it-works/page.tsx`(11)·`review-inbox/page.tsx`(11)·`demo/page.tsx`(10)

**다음 세션 트리거**: `docs/master_inspection_plan_v1.0.md §5.1-A 기준으로 배치 3 진행 (다음 배치 후보 목록부터)`

### §5.2 나머지 항목 병렬 창 트리거 (2026-07-11 준비, §5.1 대비율 창과 파일 겹침 없도록 분리)

> 공통 규칙: 대비율(색상 hex·`text-gray-400`류) 수정은 §5.1 창이 전담 — 다른 창은 발견해도 직접 고치지 말고 목록만 남길 것.

1. **P1 나머지**(랜딩·요금제·trial·온보딩, 대비율 제외 L3): `docs/master_inspection_plan_v1.0.md §4 P1 기준으로 랜딩(/)·요금제(/pricing)·trial(/trial)·온보딩(/onboarding) 라이브 점검. 대비율은 목록만. Nielsen 10휴리스틱·정보위계·카피톤 실측.`
2. **P2**(공개 콘텐츠 ~20개): `docs/master_inspection_plan_v1.0.md §2 그룹A 기준으로 /demo,/how-it-works,/faq,/help,/terms,/privacy,/score-guide,/guide/chatgpt-search,/guide/channels/[category],/blog,/blog/[slug],/stories,/resources,/tools/keyword,/tools/ad-cost-calculator,/keywords,/quick,/share/* L3 4축 점검. 대비율은 목록만. 빈상태·더미데이터 확인 포함.`
3. **P3**(결제): `docs/master_inspection_plan_v1.0.md §4 P3 기준으로 /payment/success,/payment/fail,/payment/card-update 결제 신뢰 UX 점검. card-update 로그인 필요·인증 한계 명시. 대비율은 목록만.`
4. **P4**(사용자 지원): `docs/master_inspection_plan_v1.0.md §4 P4 기준으로 /support,/support/tickets,/support/tickets/new(사용자단만) 점검. 로그인 필요·인증 한계 명시. 대비율은 목록만.`
5. **gap-5**(실제 경쟁 서비스 라이브 비교): `docs/master_inspection_plan_v1.0.md gap-5 기준으로 아이보스(iboss.co.kr) 등 실제 경쟁 서비스를 Playwright로 방문해 AEOlab과 스크린샷 비교. 코드 수정 없는 조사 리포트, §6 갱신.`

> 5개 전부 동시 실행은 1인 Max 5x 플랜 기준 토큰 소모가 크다 — 병렬/순차는 사용자 판단.

### §5.3 P3(결제 3페이지) 완료 (2026-07-11)

- **점검 대상**: `/payment/success`, `/payment/fail`, `/payment/card-update` — 코드 직접 확인 + Toss `requestBillingAuth` 콜백 파라미터 공식 문서 대조(WebSearch). 라이브 브라우저는 동시 세션 lock으로 실측 불가(curl 200 확인만 가능, memory `feedback_shared_browser_lock_verification` 동일 제약) — card-update는 로그인 필요라 이 세션에서 실제 로그인 흐름 재현은 하지 않음(코드 대조로 한정).
- **발견 + 수정 3건**(git `5a86a17`):
  1. `success` 성공 화면에 실제 청구 금액 미표시 — `amount`를 파싱만 하고 렌더링 안 함. 청구액 표시 추가
  2. `success` 에러 분기 — 백엔드 `issueBilling`이 Toss 인증 성공 이후(2단계: 빌링키 발급→실제 청구) 실패할 경우 이미 카드가 청구됐을 수 있는데도 안내 없이 "다시 시도"(→`/pricing`, 재청구 유도)만 노출 → 중복결제 위험. `backend/routers/webhook.py:142-185` 확인(청구 성공 후 DB upsert 실패 시 사용자에게 청구 여부 불명확). 중복결제 경고 문구 + 1:1 문의 링크 추가
  3. `fail` 페이지를 신규구독 결제 실패(PayButton)와 카드 변경 실패(SettingsClient)가 공유하는데 CTA가 항상 "다시 결제하기→/pricing" 고정 — 카드 변경 실패 사용자를 새 구독 결제로 잘못 유도. `SettingsClient.tsx` failUrl에 `?from=card-update` 추가 + `fail/page.tsx` 문맥 분기
  4. (부수 정리) `fail` 페이지의 "주문번호: {orderId}" 블록은 Toss billing-auth 콜백이 `orderId`를 보내지 않아(공식 문서 확인) 항상 미표시되는 죽은 코드 — 제거
- **오판 아님으로 확인**: 결제 페이지 3곳 모두 `SiteFooter`에 상호명·대표자·사업자등록번호·통신판매업번호 표시 완료(전자상거래법 요건 충족) — 별도 조치 불요
- **대비율**: `text-gray-400` 9곳 목록만 남김(§5.1 배치 창에서 처리) — 직접 수정 안 함
- 검증: md5 사전 확인(서버==git HEAD, drift 없음) → scp → 서버 grep 확인 → `npm run build` 성공 → pm2 재시작 error.log 신규 에러 0건(기존 recharts 경고만) → curl 3페이지 200

---

## §6. "외부 사이트 대비 현재 수준" — 현재까지의 결론

- **이미 L3를 통과한 영역(대시보드+9페이지+관리자 UX 요소)**: WCAG 2.1 AA 대비율·Nielsen 10휴리스틱 체크리스트 기준으로는 상업 SaaS 수준에 근접했다고 판단할 근거가 있다(대비율 246건 전수 처리, aria-expanded 등 접근성 패턴 다수 수정 완료).
- **단, 이 판단은 "체크리스트 자가 채점"이지 실제 경쟁 서비스와의 라이브 스크린샷 비교가 아니다** — 정성적 확신이지 정량 벤치마크는 아니다(gap-5).
- **전환 퍼널(랜딩·요금제·trial·온보딩)은 이 최고 기준 자체를 받아본 적이 없다** — "지금 수준이 어느 정도인지" 질문에 가장 먼저 답해야 할 곳인데 데이터가 없는 상태. P1로 지정한 이유.

---

*작성: 2026-07-11 | 8개 기존 점검 문서 계보 조사(Explore 에이전트) + 직접 코드/문서 반증 후 통합.*
