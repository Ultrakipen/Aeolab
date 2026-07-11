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

**배치 3 완료** (git `6eb7a70`, 같은 세션 이어서 진행):
- 대상: `GuideClient.tsx`(27, 1건 제외)·`onboarding/page.tsx`(23, placeholder 8건 제외)·`AdminScoreComparisonClient.tsx`(14, dark 12건 제외)·`AdminNoticesClient.tsx`(14, dark4+placeholder4=8건 제외)·`AdminFeedbackClient.tsx`(12, dark 7건 제외)·`TrialResultStep.tsx`(12)·`admin/business/[id]/page.tsx`(11)·`how-it-works/page.tsx`(11)·`review-inbox/page.tsx`(11)·`demo/page.tsx`(10) = **109건 치환**
- **패턴 정정**: 관리자 3개 파일(`AdminScoreComparisonClient`·`AdminNoticesClient`·`AdminFeedbackClient`)은 실제 다크모드 지원 파일이라 `text-gray-400 dark:text-gray-500` 형태 페어가 다수 — 라이트모드 토큰(`text-gray-400`)만 교체하고 `dark:text-gray-500`는 그대로 둠(다크모드 자체의 대비 적정성은 이번 스코프 밖). `perl` 정규식을 `(?<!dark:)(?<!placeholder:)text-gray-400`로 확장해 두 접두사 모두 보존
- 신규 예외: `GuideClient.tsx:1406` disabled ternary 1건 제외
- 검증: md5 사전일치 → scp → 서버 grep 정확히 예상 카운트 일치(0/8/12/8/7/0/0/0/0/0) → 빌드 성공 → pm2 재시작 에러 없음 → curl how-it-works 200 확인 → 라이브 HTML에 `text-gray-400` 6건 잔존 확인했으나 `page.tsx` 자체는 0건 → **원인: `SiteFooter`/`AuthNavControl` 공용 컴포넌트가 아직 미처리 배치라 다른 페이지에서도 계속 보일 것(정상, 버그 아님)**

**배치 3 이후 잔여**: 379건 / 148개 파일

**배치 4 완료** (git `2b932c9`, 같은 세션 이어서 진행):
- 대상: `history/page.tsx`(9)·`BlogScreenshotSection.tsx`(9, 1건 제외)·`DeliveryOrderClient.tsx`(9, placeholder 2건 제외)·`ResultTable.tsx`(8)·`settings/page.tsx`(8)·`ScoreModelV31Client.tsx`(8, dark 5건 제외)·`ad-cost-calculator/page.tsx`(7)·`pricing/page.tsx`(7)·`signup/page.tsx`(7, placeholder 3건 제외)·`(auth)/page.tsx`(7, placeholder 3건 제외)·`TrialStatusSummary.tsx`(6) = **71건 치환**
- `pricing`·`signup`·`(auth)/page.tsx`(로그인)를 §4 P1(gap-1·gap-2, 전환 퍼널 L3) 페이지와 겹치므로 우선 포함시킴 — 대비율만이지만 P1 범위 일부 선반영 효과
- 신규 예외: `BlogScreenshotSection.tsx:568` disabled 상태 배지 1건 제외
- 검증: md5 사전일치 → scp → 서버 grep 정확히 예상 카운트 일치(0/1/2/0/0/5/0/0/3/3/0) → 빌드 성공(에러 0) → pm2 재시작 → curl pricing/signup/login/ad-cost-calc 전부 200 → pricing 라이브 HTML에 9건 잔존(다른 미처리 공용 컴포넌트發, page.tsx 자체는 0건 확인)

**배치 4 이후 잔여**: 276건 위반후보(dark:/placeholder: 제외 기준) / 308건(dark:만 제외, 원 baseline과 동일 집계 기준) / 142개 파일

**누적 진행**: 배치1~4 합계 **452건 수정** (원 baseline 905건 대비, `dark:` 제외 기준으로는 905→308, 약 66% 처리)

**다음 배치 후보 — `components/common/`**(여러 페이지에서 반복 노출되는 공용 컴포넌트라 우선순위 높음, 수정 시 파급 효과 큼): `HelpSearchInput.tsx`(6)·`SiteFooter.tsx`(2)·`ResultSummaryHero.tsx`(2)·`ChannelTimelineBox.tsx`(2)·`AIAssistant.tsx`(2)·`PlanGate.tsx`(1)·`ChannelDifferentiationCard.tsx`(1) — `*.md` 가이드 문서 2건은 코드 아니므로 스코프 제외

**배치 5 완료** (git `b9907d7`, 같은 세션 이어서 진행):
- 대상: `components/common/` 7개 파일 = **11건 치환**
- 신규 예외 발견: `AIAssistant.tsx:235` `disabled:text-gray-400`(실제 Tailwind `disabled:` 변형자, ternary 클래스가 아닌 진짜 상태 접두사) — `perl` 정규식에 `(?<!disabled:)` 추가해 배치6부터 반영
- `PlanGate.tsx`는 md5 불일치로 발견됐으나 diff 대조 결과 **CRLF/LF 줄바꿈 차이일 뿐 내용은 동일**(유령 diff, `.gitattributes` 정규화 미적용 잔재) — 서버 재확인 없이 안전하게 로컬 편집 진행
- **⚠️ 배포 중 관측된 일시적 이상(해결됨, 기록용)**: `pm2 restart` 직후 error.log에 `/dashboard` 라우트 `client reference manifest` InvariantError + `/500.html` ENOENT 각 2회 발생 → 재시작 순간의 Next.js 콜드스타트 경합으로 추정(수 초 내 자연 소멸, 이후 재시작 1회 추가 + 요청 8회에도 재발 0건, `.next` 빌드 산출물 실존 확인) → CSS 클래스명 문자열 치환만 한 이번 변경과 인과관계 낮음, 다만 다음 배치에서도 재시작 직후 error.log 재확인 습관화 권장
- 검증: md5 사전확인(PlanGate 유령diff 처리) → scp → 서버 grep 정확히 일치(4/0/0/0/1/0/0) → 빌드 성공 → pm2 재시작(위 일시 이상 관측 후 재재시작으로 안정 확인) → curl 다중 요청 정상

**배치 5 이후 잔여**: 약 294건(dark:/placeholder:/disabled: 제외 기준 재산정 필요) / `components/common` 소진, 다음은 `components/dashboard/`·`app/admin/*`·`app/(dashboard)/*` 산재분

**다음 배치 후보**(파일별 건수 내림차순, 이미 처리된 dark:-only 파일 제외): `BeforeAfterCard.tsx`(6)·`admin/support/[id]/page.tsx`(6)·`DualTrackCard.tsx`(6, ⚠️`project_dashboard_full_scale_inspection_2026_07_02` 메모리에 "고아 파일" 경고 있음 — 먼저 실제 import 여부 확인 후 진행)·`BlogDiagnosisCard.tsx`(5)·`ScoreCard.tsx`(5)·`BusinessSearchDropdown.tsx`(5)·`admin/stories/page.tsx`(5)·`AdminDeliveryDetailClient.tsx`(5)·`AdminBusinessSearchClient.tsx`(5)·`support/FAQClient.tsx`(5)

**배치 6 완료** (git `38a8002`, 같은 세션 이어서 진행):
- `DualTrackCard.tsx` import 확인 결과 **확정 오판 방지**: `app/(dashboard)/dashboard/DualTrackCard.tsx`(6건)는 실제로 임포트되지 않는 고아 파일(디렉터리 착오로 남은 구버전), 진짜 사용 컴포넌트는 `components/dashboard/DualTrackCard.tsx`(`DashboardDetailZone.tsx`가 임포트, 이미 0건) — 6건 전부 스코프 제외
- 나머지 9개 파일(BeforeAfterCard·admin/support상세·BlogDiagnosisCard·ScoreCard·BusinessSearchDropdown·admin/stories·AdminDeliveryDetailClient·AdminBusinessSearchClient·FAQClient) = **42건 치환**, 예외 0건
- 검증: md5 일치 → scp → 서버 grep 전부 0 → 빌드 성공 → 재시작 전후 error.log 라인수 불변(2420, 신규 에러 없음 — 배치5의 일시 이상 재발 안 함 확인)

**배치 7 완료** (git `43c65a0`, 같은 세션 이어서 진행):
- 대상: `delivery/new/page.tsx`(5, placeholder 2건 제외)·`DashboardPreview.tsx`(4)·`CompetitorKeywordAlert.tsx`(4)·`payment/success/page.tsx`(4)·`payment/card-update/page.tsx`(4)·`app/page.tsx`(랜딩 추가분, 4)·`AdminSupportClient.tsx`(4)·`stories/[id]/page.tsx`(4)·`guide/channels/[category]/page.tsx`(4)·`blog/page.tsx`(4)·`settings/api-keys/page.tsx`(4)·`NoticesClient.tsx`(4)·`DashboardSidebar.tsx`(4) = **51건 치환**(커밋 메시지에 47로 오기재, 실제 diff는 51 — 문서에 정정 기록)
- `payment/success`·`payment/card-update`는 gap-4(P3) 범위와 겹침 — §5.3(병렬 P3 세션)과 파일 중복 없음(§5.3은 로직/문구, 이쪽은 대비율만) 확인
- 검증: md5 일치 → scp → 서버 grep 전부 예상치 일치(delivery/new만 2, 나머지 0) → 빌드 성공 → 재시작 전후 error.log 불변(2420) → curl landing/pricing/blog/payment 전부 200 → 랜딩페이지 라이브 HTML `text-gray-400` 26건→4건(공용 컴포넌트 미처리분만 잔존)

**배치 7 이후 잔여**: 199건(dark: 제외 기준) / 파일 수 재확인 필요

**배치 8 완료** (git `19afa57`, 같은 세션 이어서 진행):
- 대상: `TrialDetailAccordion.tsx`·`QuickDiagnosisForm.tsx`·`KeywordCompletenessGauge.tsx`·`ActionTimelineCard.tsx`·`PlaceCompareTable.tsx`·`NaverSearchStrengthCard.tsx`·`KeywordManagerModal.tsx`(disabled: 2건 제외)·`AiTabPreviewCard.tsx`·`AIDiagnosisCard.tsx`·`tools/keyword/page.tsx`(placeholder 1건 제외)·`StoriesClient.tsx`·`blog/[slug]/page.tsx`·`settings/team/page.tsx`·`SettingsClient.tsx`·`AccountClient.tsx` 15개 파일 = **42건 치환**
- 검증: md5 일치 → scp → 서버 grep 전부 예상치 일치(disabled·placeholder 제외분만 잔존) → 빌드 성공 → 재시작 전후 error.log 불변(2420) → curl settings/stories/tools-keyword 정상(500 없음)

**배치 8 이후 잔여**: 157건(dark: 제외 기준) / 103개 파일

**누적 진행**: 배치1~8 합계 **598건 수정** (원 baseline 905건 대비, raw grep 기준 905→157 = 약 82.6% 감소) — `.bak*` 15개(죽은 코드)·orphan `DualTrackCard.tsx`(1개) 스코프 확정 제외. 남은 157건은 대부분 파일당 1~3건 산재라 배치 규모가 계속 작아지는 추세(수렴 단계)

**배치 9 완료 — 사실상 마무리** (git `4239788`, 같은 세션 이어서 진행):
- 92개 파일 대량 처리 = **115건 치환**, 신규 예외 3건 발견(`ExportButton.tsx:32,89,114` — `<button disabled>` 정적 비활성 버튼, `disabled:` 접두사가 아닌 plain class라 라인번호로 개별 제외)
- **⚠️ 로컬 파일 동시편집 충돌 발견**: md5 사전확인 중 `signup/page.tsx`·`onboarding/page.tsx` 2개 파일이 로컬↔서버 뿐 아니라 **로컬 자체가 다른 병렬 세션에 의해 실시간 수정 중**임을 확인(`git status`에 내가 만들지 않은 unstaged 변경 존재 — 같은 로컬 저장소를 여러 세션이 동시 사용). 두 파일 모두 이번 배치에서 완전히 제외, 커밋에도 포함 안 됨(확인 완료)
- `SchemaClient.tsx`·`support/tickets/[id]/page.tsx`는 초기 md5 불일치였으나 diff 대조로 CRLF/LF 유령diff 확인 후 안전 처리
- `DualTrackCard.tsx`(orphan, 배치6에서 스코프 제외 판정)가 이번 재확인 시점엔 0건으로 이미 정리되어 있음 — 내가 손대지 않았으므로 다른 세션이 처리한 것으로 추정(무해, 확인만)
- 검증: md5 사전확인(4개 파일 재검토 포함) → scp → 서버 합계 grep 31건(예상치 정확 일치) → 빌드 성공 → 재시작 전후 error.log 불변(2420) → 8개 페이지(`/`·`/pricing`·`/login`·`/admin`·`/support`·`/keywords`·`/faq`·`/help`) curl 전부 정상(500 없음)

**최종 재확인(같은 세션, 병렬 세션 전부 중지 후)**: `signup/page.tsx`(3건)·`onboarding/page.tsx`(8건)를 직접 재조사 — **둘 다 이미 배치3·4에서 완료된 상태였음(오판 정정)**. 두 파일에 남은 3건·8건은 전부 `placeholder:text-gray-400`(정당한 예외)이고, 배치3·4에서 처리한 `text-gray-500` 치환은 그대로 살아있음(`grep -c text-gray-500` 각 7건·35건 확인) — 즉 **처리할 위반이 애초에 없었음**. md5 불일치의 실제 원인은 다른 세션이 이 두 파일에 **무관한 별도 기능**(온보딩 아코디언 `aria-expanded`/`aria-haspopup` 접근성, 요금제 카드 문구·앵커링크, 회원가입 "이미 가입됨" 에러 UX 개선)을 로컬에만 적용하고 커밋·배포하지 않은 채 남긴 것 — **대비율 스코프와 무관**이라 이 시리즈에서 손대지 않음(다른 세션의 미완료 작업을 임의로 커밋/배포하지 않는다는 원칙)

**최종 상태**: raw grep 잔여 **42건 전부 정당한 예외**(다크모드 페어 27+placeholder 8+disabled류 6+`.md`문서 2 — 파일별 세부는 위 배치 로그 참조) — **`text-gray-400` WCAG 위반 후보 0건, 스윕 완전 종료**
- 누적 수정: **713건**(배치1~9 합계, 140+132+109+71+11+42+51+42+115), 원 baseline 905건 대비
- **⚠️ 별도 트랙(대비율 아님) — 사용자 확인 필요**: `signup/page.tsx`·`onboarding/page.tsx` 로컬에 커밋되지 않은 다른 세션의 UX 개선 3건이 남아있음(위 내용) — 배포 전 내용 검토 후 커밋 여부 결정 필요. `git diff frontend/app/(auth)/signup/page.tsx frontend/app/(dashboard)/onboarding/page.tsx`로 확인 가능

**다음 세션 트리거**: 없음 — text-gray-400 대비율 시리즈 완전 종료. 이후 §5.1-A 재트리거 불필요

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
- **발견 2의 근본 수정 추가 완료**(같은 세션, 사용자 지시 "지금할것", git `dd691aa`): 프론트 안내 문구만으론 부족 판단 — `webhook.py` 첫 결제(2단계) 직전에 `payment_events`에서 같은 금액·10분 이내 성공 이벤트를 조회, 있으면 Toss 재청구를 건너뛰고 구독 저장(3단계)만 재시도하도록 이중청구 방지 로직 추가. md5 사전확인(drift 없음) → scp → 서버 grep 확인 → pm2 재시작(`Application startup complete`, 에러 0건) → `/health` ok 확인
- **card-update 라이브 재검증 시도**: gstack `/browse`로 실제 로그인(hoozdev@gmail.com) 후 `/settings` 진입·카드 변경 버튼 확인까지는 성공했으나, 같은 시간대 다른 세션이 동일 공유 브라우저 데몬을 사용 중이라 클릭 직후 스크린샷이 엉뚱한 페이지(`/support/tickets/new`)를 찍는 등 신뢰할 수 없는 간섭 발생 → 라이브 클릭 검증은 중단, 코드 대조 수준으로 한정(memory `feedback_shared_browser_lock_verification` 갱신)

### §5.4 P1 나머지 + P2 완료 (2026-07-11)

- **실행**: §5.2-1(P1 나머지)·§5.2-2(P2) 2개 백그라운드 에이전트 병렬 실행. 대비율은 양쪽 다 목록만(§5.1 창 전담 원칙 준수).
- **P1 나머지 발견+수정**(에이전트가 직접 Edit, 메인 세션 grep 검증 후 배포): onboarding 플랜모달 경쟁사 한도 오기재(`plan_gate.py` Basic=3/Pro=5와 불일치하던 5곳/10곳 표기 정정), `trial/page.tsx` `TRIAL_DAY_LIMIT=999` 미복구, signup "이미 가입" 에러에 로그인 링크 누락(Nielsen #9), onboarding CTA 앵커라우팅·모바일 스텝라벨·aria-expanded 3건.
- **P2 발견**(에이전트는 보고서만, Edit 금지 지시): `quick/page.tsx`에도 `TRIAL_DAY_LIMIT=999` 동일 반복 + 백엔드 59개 화이트리스트에 없는 비표준 업종코드(`health`/`professional`/`living`) 사용 중이던 실버그, Claude 스캐너 잔존 언급, Trial 5회를 "10회 샘플"로 오기재, AI탭 subtitle "베타 공개" 잔존, score-guide `AuthNavControl` 누락, ad-cost-calculator 30% 가정값 (추정)배지 누락, `share/[bizId]` 성장단계 설명 점수구간 수치 노출.
- **메인 세션 자체 발견(에이전트 보고에 없던 것, 가장 중요)**: 라이브 curl 스모크테스트 중 `/guide/channels/[category]`(59업종 SSG 공개 SEO 페이지, `(public)` 라우트 그룹)가 `/login`으로 307 리다이렉트되는 것을 발견. `middleware.ts`의 `protectedPaths`가 `/guide` 전체를 프리픽스로 보호 처리하는데 `publicGuidePaths`는 `/guide/chatgpt-search`만 예외 — `/guide/channels/*`는 비로그인 사용자·검색엔진 크롤러 전부 로그인 페이지로 리다이렉트되어 SEO 목적이 완전히 무력화되고 있었음. `publicGuidePaths`에 `/guide/channels` 추가로 수정.
- **검증**: P2발견분+middleware(6파일)·P1에이전트 직접수정분(3파일) 총 9개 파일 전부 md5 사전일치(drift 없음) → scp → `npm run build` 성공 → pm2 재시작 error.log 0건 → curl 실측(`/guide/channels/restaurant`·`/cafe` 200, `/dashboard`·`/onboarding`은 여전히 307로 정상 보호, `/quick`·`/score-guide`·`/tools/ad-cost-calculator`·`/trial`·`/signup` 200) 전부 확인
- git 커밋 `5b1f915`(P2발견분+middleware), `f65d090`(P1에이전트 직접수정분). push는 drift 정책상 보류.
- 상세: memory `project_p1_p2_gap5_inspection_2026_07_11`

---

## §6. "외부 사이트 대비 현재 수준" — 현재까지의 결론

- **이미 L3를 통과한 영역(대시보드+9페이지+관리자 UX 요소)**: WCAG 2.1 AA 대비율·Nielsen 10휴리스틱 체크리스트 기준으로는 상업 SaaS 수준에 근접했다고 판단할 근거가 있다(대비율 246건 전수 처리, aria-expanded 등 접근성 패턴 다수 수정 완료).
- **단, 이 판단은 "체크리스트 자가 채점"이지 실제 경쟁 서비스와의 라이브 스크린샷 비교가 아니다** — 정성적 확신이지 정량 벤치마크는 아니다(gap-5).
- **전환 퍼널(랜딩·요금제·trial·온보딩)은 이 최고 기준 자체를 받아본 적이 없다** — "지금 수준이 어느 정도인지" 질문에 가장 먼저 답해야 할 곳인데 데이터가 없는 상태. P1로 지정한 이유.

### §6.1 gap-5 실행 시도 결과 (2026-07-11, 별도 세션)

- **핵심 결론: 이번에도 실제 스크린샷 라이브 비교는 완료하지 못했다.** `mcp__playwright__*` 도구가 이번 세션에도 연결은 되어 있었으나, 호출할 때마다 `Browser is already in use for ...mcp-chrome-b8163ae` 오류로 전량 실패(9회 이상 재시도, 세션 전체에 걸쳐 지속 — `아이보스` 뿐 아니라 `aeolab.co.kr` 자체 접속도 동일하게 막힘, §5.3 로그의 "동일 시간대 다른 세션이 공유 브라우저 데몬 사용 중" 기록과 정합). 즉 gap-5가 "이 세션부터 브라우저 도구가 연결돼 격상 여지가 실재한다"고 적은 전제는, 최소 이번 세션에서는 **실제로는 사용 불가능했다** — 방법론 격상은 다음번 락이 풀린 세션으로 재이월. (memory `feedback_shared_browser_lock_verification`과 동일한 공유 브라우저 프로필 충돌 패턴, 재확인)
- **도메인 오류 발견**: `iboss.co.kr`(하이픈 없음)은 **만료/파킹된 도메인**으로 Sedo 도메인 거래 페이지(`sedo.com`)로 301 리다이렉트된다 — 실제 서비스가 아니다. 실제 아이보스 서비스 도메인은 **`i-boss.co.kr`(하이픈 포함)**이다(WebSearch로 확인). 향후 이 경쟁사를 언급할 때는 반드시 하이픈 포함 도메인을 사용할 것 — 이전 메모리·문서에 하이픈 없는 표기가 있다면 정정 필요.
- **대체 조사 방법(스크린샷 아님, 명시)**: `WebFetch`는 `i-boss.co.kr`에서 403(봇 차단)으로 실패 → `curl`에 실제 브라우저 User-Agent를 지정하니 200 OK로 통과(HTML 원문 확보 가능, 스크린샷은 여전히 불가). 이 HTML과 AEOlab 실제 소스코드(`frontend/app/page.tsx`, `frontend/app/(public)/pricing/page.tsx`)를 직접 대조하는 **구조적 텍스트 비교**만 수행했다. 이는 L3가 요구하는 "실제 시각적 라이브 비교"에는 못 미치는 차선책임을 명시한다.
- **구조 비교로 확인된 사실(시각 비교 아님, 코드/HTML 근거)**:
  - `i-boss.co.kr` 홈은 SaaS형 전환 랜딩페이지가 아니라 **커뮤니티/포털 구조**다 — 순위 게시판("지금 인기"·"주간 인기"), 채용 광고 배너 다수(더스크랙·해피카·패스트파이브 등), 교육 상품 메가메뉴(`ibossedu.co.kr` 크로스셀)로 구성됨(`iboss_home.html` 직접 확인). 2003년 설립된 마케터 커뮤니티 + 대행사 디렉토리 + 교육 판매가 본업이며, "대행 서비스"는 회원이 올리는 개별 게시글(디렉토리) 형태다.
  - **아이보스에는 AEOlab `/pricing`에 대응하는 통합 요금제 페이지가 없다** — 확인한 서비스 홍보 게시글(`/ab-2987-291567`, "체험단 마케팅... 9년차 실행사에 맡겨보세요")에도 고정 가격 표시를 찾지 못함(로그인 요구 또는 개별 문의 유도 구조로 추정). 반면 AEOlab `/pricing`은 4단계 가격(9,900~49,900원)이 최상단에 즉시 노출 + 기능 비교표 + FAQ 아코디언까지 한 페이지에 구조화되어 있음(`pricing/page.tsx` 직접 확인) — **가격 정보 명확성 축에서 AEOlab이 구조적으로 우위**라고 판단할 근거가 있다(단, 아이보스는 "포털+대행사 디렉토리", AEOlab은 "단일 SaaS 상품"으로 카테고리 자체가 달라 1:1 비교의 타당성에는 한계가 있음을 함께 명시).
  - 첫인상 신뢰도·정보 위계(스크롤 없이 핵심이 보이는가)·카피 톤 축은 **실제 렌더링 스크린샷 없이는 정량 판단 불가** — 위 커뮤니티형 구조 특성상 "광고 배너·게시판 밀도가 높다"는 사실까지만 확인했고, 그것이 실제로 신뢰도를 낮추는지(오래된 커뮤니티라 오히려 신뢰 신호일 수도 있음)는 시각 비교 없이 단정하지 않는다.
- **다음 세션 트리거**: `docs/master_inspection_plan_v1.0.md §6.1 기준으로 브라우저 락 해제 확인 후 i-boss.co.kr(하이픈 포함)·AEOlab 실제 스크린샷 비교 재시도`

---

*작성: 2026-07-11 | 8개 기존 점검 문서 계보 조사(Explore 에이전트) + 직접 코드/문서 반증 후 통합. §6.1은 같은 날 별도 세션에서 gap-5 실행 시도 기록 추가.*
