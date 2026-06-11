# 대시보드 스캔결과 UX 수정 런북 v1.0 — INACTIVE 업종 첫인상 개선

> 작성: 2026-06-11 | 대상: 대시보드 스캔결과 화면(`/dashboard`)
> 트리거(새 대화창): `docs/dashboard_inactive_ux_fix_v1.0.md 기준으로 진행`

---

## 0. 작업 순서 — 서버 우선 (절대 준수)

> **모든 수정은 서버에서 직접 작업 → 서버 빌드 → 로컬 동기화 순서.** 로컬 먼저 수정 후 scp 업로드 금지(서버 최신본 덮어쓸 위험). 2026-06-11 로컬 `ScanResultNavBar.tsx`가 서버보다 구버전이라 오판한 사고로 이 순서를 못박음.

```bash
# (선행) 수정 대상 컴포넌트가 로컬==서버인지 md5로 먼저 확인. 다르면 서버본을 진실로 삼아 scp 서버→로컬
ssh root@115.68.231.57 "md5sum /var/www/aeolab/frontend/<경로>"
md5sum /c/app_build/aeolab/frontend/<경로>

# 1) 서버 파일 직접 수정 (ssh 또는 scp 로컬→서버는 md5 일치 확인 후에만)
# 2) 서버 빌드 (프론트는 빌드 필수 — 파일 교체만으로 반영 안 됨)
ssh root@115.68.231.57 "cd /var/www/aeolab/frontend && npm run build 2>&1 | tail -5"
# 3) PM2 재시작 + 에러 0건 확인
ssh root@115.68.231.57 "pm2 restart aeolab-frontend && pm2 logs aeolab-frontend --lines 30 --nostream"
# 4) 라이브 검증 — https://aeolab.co.kr 실제 로그인 화면 캡처 육안 확인 (PC+모바일)
# 5) scp 서버 → 로컬 동기화 (마지막 단계, md5 일치 확인)
```

- 백엔드: 파일 교체 즉시 반영 / 프론트: **빌드 필수** — 항상 구분
- 검증: 서버 grep 1줄 이상 + 라이브 스크린샷 + error.log 0건 (에이전트 "완료" 보고만 신뢰 금지)
- 참고 메모리: `feedback_server_workflow.md`, `feedback_frontend_deploy_verification.md`, `project_deploy_reset_hard_risk.md`(main push reset --hard 주의)

---

## 1. 검증된 진단 (라이브 + 서버파일 교차 확인 완료)

대상 사업장 실측: **홍스튜디오(창원·사진·영상) = INACTIVE 업종** 로 라이브 점검.

| # | 발견 | 신뢰 | 근거 |
|---|------|------|------|
| **①** | INACTIVE 업종 **첫 화면이 부정 평결로 시작**. Hero "AI 검색 노출 미흡"(amber) + 서버 4타일 NavBar 중 3개 경고/회색. "네이버 검색·플레이스가 핵심 무기" 긍정 메시지(`IneligibleBusinessNotice`)는 below-fold(~820px) | ✅ 견고 | 라이브 스크린샷 + 서버 `ScanResultNavBar.tsx`(4타일) + `DashboardHeroCard.tsx:25 getStage` |
| **②** | **모바일에서 스캔 패널이 진단(현황)보다 먼저** 노출. 사장님 "현황 먼저" 철학과 어긋남 | ✅ 견고 | 라이브 모바일 스크린샷 + `page.tsx` 스캔 `order-1 lg:order-2` |
| **④** | 헤더 정체성 라벨이 **"ChatGPT·Gemini 노출 가능 업종"** — 네이버 신뢰 사장님에겐 네이버 중심 정체성이 더 안심 | ✅ 견고 | 라이브 스크린샷 (`DashboardHeader`) |

**오판으로 폐기된 것:**
- ③ "라이브가 로컬 구버전" → **정반대(서버가 최신)**. md5 비교로 6개 중 `ScanResultNavBar.tsx` 1개만 어긋난 것 확인, 서버본으로 로컬 복원 완료.
- "ScanNavBar 4타일=Hero 3채널 순수 중복 → 제거" → NavBar는 **앵커 점프 기능** 보유. 제거 아님.
- "IneligibleNotice 4단계 = ④오늘할일 중복" → 정적 교육 vs 동적 미션, 소스 다름. 중복 아님.

---

## 2. 수정 방안 + 묶음 판단

### 묶음 A (핵심·단독 안전) — INACTIVE Hero 긍정 리드  ← ① (④는 보류 검토)
> **2026-06-11 정정**: 당초 "①+④ 반드시 함께(안 하면 충돌)"라 했으나 **과장 오판**. 코드 확인 결과 ④ 헤더 배지(`DashboardHeader.tsx:196-208`)는 "AI 브리핑 **자격**" 슬롯(active/likely/inactive 3분기 병렬)이고, ①은 "네이버 **SEO**로 어떻게 크냐"라는 다른 질문 → **모순 아님**. ① 단독 진행해도 안 깨짐.
- **① `DashboardHeroCard.tsx`** (핵심): `briefingEligibility==="inactive" || isFranchise`일 때 최상단 단계 레이블을 점수 기반 "AI 검색 노출 미흡" 대신/위에 **"네이버 검색·플레이스가 핵심 무기"** 긍정 리드로. 부정 톤 다운. (점수 숫자 노출 금지 — `feedback_score_display_text_only`)
- **④ `DashboardHeader.tsx:206`** (보류 검토): inactive 배지 "ChatGPT·Gemini 노출 가능 업종"은 **사실이고 중립적**. "네이버 중심"으로 바꾸면 **3분기 배지의 의미 병렬(브리핑 자격)을 깨뜨림** → 건드리지 않거나, 네이버 강조는 ①(Hero)에서 하는 게 안전. **수정 우선순위 낮음/보류.**
- **위험**: ① 낮음(카피·조건분기, 레이아웃 불변). ④ 손대면 배지 병렬 깨질 위험.

### 묶음 B (그다음·로직 분리) — 모바일 진단-우선  ← ②
- **이유**: ②는 ①④와 **독립**(다른 파일 `page.tsx`)이고 **트레이드오프**가 있음. 현재 스캔-먼저는 **신규 사용자(스캔 이력 없음)**에겐 합리적. 단순 순서 뒤집기 금지 → **`hasLatestScan` 조건 분기** 필요: 스캔 있으면 진단(현황) 먼저, 없으면 스캔 먼저.
- **`page.tsx`**: 모바일 `order` 클래스를 `latestScan` 유무로 분기.
- **위험**: 중간. 모바일 레이아웃 변경 → PC/모바일 **각각 라이브 재검증 필수**.

### 판단 — "모두 함께가 최적인가?" (2026-06-11 정정)
- **아니오, 단계적이 최적.** ①이 **단독 핵심**(우선순위 1, 단독 안전). ④는 **보류 검토**(배지 병렬 깨질 위험, 사실·중립이라 안 고쳐도 무방). ②는 **로직 분리**(조건분기, 신규 사용자 스캔-먼저 회귀 위험).
- **권장 실행**: **① 먼저 구현·배포·라이브 검증** → 효과 확인 후 ②를 별도 조건분기로. ④는 ① 적용 후 화면 보고 정말 필요한지 재판단(아마 불필요). 빌드·배포 1회로 묶더라도 검증은 항목별 독립.
- 우선순위: **① > ② > ④(보류)**

---

## 3. 체크리스트
- [ ] A: `DashboardHeroCard.tsx` INACTIVE 긍정 리드 (서버 수정)
- [ ] A: `DashboardHeader` INACTIVE 서브타이틀 (서버 수정)
- [ ] B: `page.tsx` 모바일 `hasLatestScan` 조건 순서 분기 (서버 수정)
- [ ] 서버 `npm run build` 성공 + grep 반영 확인
- [ ] `pm2 restart` + error.log 0건
- [ ] 라이브 검증: PC(INACTIVE 긍정 리드) + 모바일(진단-우선) 스크린샷 육안
- [ ] scp 서버→로컬 동기화 + md5 일치
- [ ] git add/commit (서버 미커밋 누적 주의 — `project_deploy_reset_hard_risk`)
