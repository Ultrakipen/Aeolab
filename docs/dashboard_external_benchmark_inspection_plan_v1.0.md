# 대시보드 외부 벤치마크 기반 상업적 수준 점검 계획 v1.0

> 작성: 2026-07-09 | 6개 페이지(변화기록·블로그진단·리뷰답변·AI광고대비·소개글콘텐츠·창업분석) 외부벤치마크 시리즈 완료 직후, 남은 유일한 대상인 대시보드를 위해 신규 작성
> 기반 문서: `docs/external_benchmark_commercial_quality_v1.0.md`(7단계 절차 + §2-B 4축 원본)
> 대상: 대시보드(`/dashboard`) 단 1개 페이지 — 그러나 이 프로젝트에서 **가장 복잡하고 가장 많이 점검당한 페이지**라 별도 계획 문서가 필요함

---

## §0. 새 대화창 트리거

```
docs/dashboard_external_benchmark_inspection_plan_v1.0.md 기준으로 대시보드 점검 진행
```

부분 진행 시: `...기준으로 §4의 <구역명>만 진행`

---

## §1. 대시보드가 다른 6개 페이지와 다른 점 — 왜 별도 계획이 필요한가

1. **압도적 규모** — 다른 6개 페이지는 대부분 단일 목적 페이지(폼 1개+결과 1종)였다. 대시보드는 2026-07-02 전수 점검 기준 **27개 이상의 컴포넌트**로 구성된 복합 화면(Hero, DualTrackCard, ChannelScoreCards, CompetitorTimeline, BriefingTimeline, GuidanceZone, InsightZone, AiTabPreviewCard 등). 한 번에 몰아서 점검하면 놓치는 부분이 생기기 쉽다 — **§4에서 구역별 분할 진행을 제안**.
2. **압도적으로 많은 과거 점검 이력** — 이 프로젝트에서 대시보드만큼 반복 점검당한 페이지가 없다. §2에서 전부 정리한다. **새 세션은 §2를 먼저 읽지 않고 점검을 시작하면 안 된다** — 이미 끝난 축을 재점검하거나(중복 작업), 이미 닫힌 논쟁을 다시 여는(무한 루프) 두 가지 함정이 모두 실제로 발생한 전례가 있다.
3. **편집 지뢰(landmine) 존재** — `frontend/app/(dashboard)/dashboard/DualTrackCard.tsx`는 **고아 파일**이고, 실제 렌더링되는 파일은 `frontend/components/dashboard/DualTrackCard.tsx`다. 두 파일 내용이 이미 갈라져 있다. **대시보드 관련 어떤 파일이든 수정 전에 반드시 `grep -rn "import.*DualTrackCard\|from.*<컴포넌트명>"`으로 실제 import 경로를 먼저 확인할 것** — 잘못된 파일을 고치고 "반영 안 됨" 사고가 날 수 있다.

---

## §2. 과거 점검 이력 전수 정리 (재점검·재논쟁 금지 대상)

> 아래 항목은 전부 **닫힌 이슈**다. 새 세션이 다시 열려면 반드시 "회귀가 실제로 생겼다"는 구체적 근거(라이브 재확인)가 있어야 한다 — 막연히 "다시 봐도 될까"로 재점검하지 말 것.

### ① 콘텐츠 구조·정보 과밀 축 — 완전히 닫힘, 재점검 절대 금지

`feedback_dashboard_inspection_standard`(메모리) — 2026-06-12, "점검해줘"를 10회 이상 반복 요청받고 나서야 확립된 **종료 기준 문서**. 고정 체크리스트 6개(콘솔에러0 / 모바일 첫화면 결론+행동 / 더미·허위수치 없음 / 같은정보 반복≤2회 / 핵심행동까지 스크롤≤2화면 / 읽기순서 결론→행동→상세)로 채점해 **전부 ✅ 확인 완료**, 이후 "디자인 점검은 중단하고 실사용자 관찰로 전환"이 명시적 결론이다.

**이 축을 이번 외부벤치마크 점검에서 절대 다시 채점하지 말 것.** 새로 하는 것은 §4(성능·WCAG·시각위계·카피톤)뿐이며, 이 6개 체크리스트와는 판정 기준이 다른 축이다 — 겹치는 것처럼 보여도(둘 다 "화면이 좋은가") 실제로는 서로 다른 질문(정보 구조/스캔가능성 vs 접근성/색상대비)이라는 걸 반드시 구분할 것.

### ② 실측 데이터 무결성 축 — 완료, 재점검 시 이 결과만 회귀 확인

`project-dashboard-full-scale-inspection-2026-07-02`(메모리) — 27개 컴포넌트 전수 점검, "화면 수치가 실측 DB 데이터인지 더미/하드코딩인지" 기준. 위반 1건(`IndustryTrendClientWrapper.tsx`의 가짜 막대그래프) 발견·수정(git `542278e`)했으나 **이 파일은 애초에 어디서도 import 안 되는 고아 코드**였다(실사용자 노출 없었음). 나머지 26개는 문제 없음.

이 축은 `nine_pages_measurement_inspection_v1.0.md`/`eight_pages_commercial_professionalism_recheck_v1.0.md`(사실 정확성 축)에는 대시보드가 **포함돼 있지 않지만**, 사실상 동급 점검이 이미 별도로 완료된 것으로 취급할 것. 재점검하려면 "회귀 확인"만(예: `IndustryTrendClientWrapper.tsx`가 여전히 미사용인지, 다른 컴포넌트에 새 더미값이 생겼는지 grep) 하고 처음부터 27개 다시 조사하지 말 것.

### ③ 개별 UX 결함 수정 — 아래 전부 완료, 회귀만 확인

- `project_dashboard_scan_ux_v1`(2026-06-11): 네이버 3채널 중복(Hero↔InsightZone) 제거, ChatGPT 실측 인용문을 Hero 직하단으로 끌어올림(`DashboardEvidencePreview.tsx`), CTA "지금 할 일"→`#section-action` 앵커 연결
- `project_dashboard_inactive_ux_fix`: INACTIVE 업종 첫인상 개선(부정 평결이 첫 화면에 그대로 노출되던 문제 등)
- `project_dashboard_top_redesign`: 히어로 섹션 PC 2단 배치, stale 배너→"재스캔 권장" 배지 전환(heroTop 45%→27%)
- `project_sidebar_nav_redesign`: 사이드바 메뉴 재편("진단"+"변화 보기"→"내 가게 현황" 통합)
- `reference_getsafesession_401_fix`: 콜드로드 401(만료 토큰 레이스) 수정 — 대시보드 포함 30개 호출처 일괄 수정됨

### ④ 확인이 필요한 것 — "완료"라고 기록됐지만 이번 점검에서 반드시 회귀 확인할 항목

위 ①~③ 전부 **완료 시점의 스냅샷**이다. 이번 점검의 §2단계(코드 재검증)에서 다음을 먼저 짚을 것:
- `IndustryTrendClientWrapper.tsx`가 여전히 미사용(고아)인지, 혹시 그 사이 재연결됐는지
- ①의 6개 체크리스트가 그 사이 코드 변경으로 깨지지 않았는지(예: 콘솔 에러 0건 여전한지 정도만 가볍게)
- ③의 각 수정 라인이 여전히 살아있는지

---

## §3. 이번에 실제로 새로 할 것 — 외부벤치마크 4축 (§2와 안 겹침)

`external_benchmark_commercial_quality_v1.0.md`의 §2-B 그대로:

1. **성능(TTFB)** — 자체 기준선 역할이었던 페이지라(다른 6개 페이지 점검 때 항상 "vs `/dashboard`"로 비교) 이번엔 대시보드 자체를 다른 페이지와 비교할 대상이 마땅치 않음. 그냥 절대값 기록 + "vCPU2/RAM4GB 서버 전역 특성" 감안해서 판단.
2. **WCAG 2.1 AA** — 대비율(canvas 2D `fillStyle`+`getImageData`로 sRGB 강제 변환 후 계산, `text-gray-400`=2.60:1 실패/`text-gray-500`=4.83:1 통과 기준값 재사용) + `aria-expanded`(InsightZone의 네이버 순위표·AI탭·브리핑 카드가 이미 기본 접힘 상태로 구현돼 있음 — `feedback_dashboard_inspection_standard` §6 참조. 이 토글들에 `aria-expanded` 있는지 직접 확인 필요, 아이콘 스왑+회전 패턴 둘 다 체크)
3. **시각 위계** — 27개 컴포넌트가 한 화면에 있는 만큼 특히 중요한 축. 단, ①에서 이미 "결론→행동→상세" 순서가 검증된 상태이므로 완전히 새로 판단하기보다 **WCAG 관점에서만**(예: CTA 대비, 배지 색상 일관성) 추가로 볼 것 — 정보구조 관점은 ①과 중복이므로 재논쟁 금지.
4. **카피 톤** — 다른 6개 페이지와 톤이 일관되는지.

**사이트 전역 백로그 2건도 대시보드에서 마주칠 가능성 높음** — `HelpFAQFloat` 위젯(모든 페이지 공통)과 화살표/체크 불릿 아이콘 저대비 패턴. 대시보드에서 새로 발견해도 "이 페이지의 결함"으로 기록하지 말고 기존 사이트 전역 백로그에 합산할 것(`external_benchmark_commercial_quality_v1.0.md` §4).

---

## §4. 실행 순서 제안 — 구역별 분할

27개 컴포넌트를 한 번에 훑으면 놓치는 게 나온다. 다음 4개 구역으로 나눠 순서대로 진행할 것을 권장(각 구역 종료 시 §2-B 4축 적용):

1. **Hero/점수 구역** — `DashboardHeroCard.tsx`, `components/dashboard/DualTrackCard.tsx`(⚠️ 고아 파일 아님, 이 경로가 진짜), `ChannelScoreCards` 계열, `DashboardEvidencePreview.tsx`
2. **InsightZone 구역** — 네이버 채널별 카드, AI탭(`AiTabPreviewCard.tsx`), 브리핑, 기본 접힘 토글들 — `aria-expanded` 집중 확인 구역
3. **GuidanceZone/오늘의 행동 구역** — "오늘 할 일" 카드, CTA 앵커(`#section-action`) 연결부
4. **하단 부가 구역** — 경쟁사·트렌드·기타 카드 (다른 페이지에서 이미 전용 페이지로 분리된 기능의 요약 위젯이 있다면 중복 여부만 가볍게 확인 — 새 기능 제안 금지, `feedback_improvement_proposal_verification` 원칙)

각 구역 종료 시 `docs/external_benchmark_commercial_quality_v1.0.md` §3에 결과 추가. 대시보드는 페이지가 1개뿐이므로 4개 구역 전부 끝나야 §3에 최종 1행으로 등재하고 §4(미점검 후보)에서 제거.

---

## §5. 종료 기준

- §2의 과거 이력을 전부 확인했고(재점검이 아니라 회귀 확인으로) 새로 깨진 것이 없음을 확인
- §4의 4개 구역 전부 §3(4축) 점검 완료, 문제 없는 축은 "문제 없음"으로 명시 기록
- 확정된 문제만 CLAUDE.md 절차대로 수정·배포·라이브 재검증·git 커밋(+push는 사용자 확인 후)
- `external_benchmark_commercial_quality_v1.0.md` §3/§4 갱신 — 이걸로 이 문서 전체(9개 페이지: 6개+경쟁사관리+성장리포트+개선가이드+대시보드)가 완전히 종료됨
- MEMORY.md에 세션 기록. 특히 §2의 "닫힌 이슈를 다시 열지 않았는지" 여부를 메모리에 명시할 것 — 이 문서 자체의 재발 방지 목적
