# 네이버 AI 브리핑 "정보형" 캐비엇 점검 표준 v1.0

> 2026-07-01 작성. 11차례 스윕(4차~11차)에 걸쳐 반복 발견된 "정보형 AI 브리핑 캐비엇 누락" 패턴을 표준화한 문서.
> **새 대화창 트리거**: `docs/naver_briefing_infotype_caveat_standard_v1.0.md 기준으로 정보형 캐비엇 재점검 진행`

---

## 1. 배경 — 반드시 먼저 이해할 것

네이버 AI 브리핑 5유형 중 이 서비스와 관련된 건 2가지뿐이다.

| 유형 | 업종 제한 | 노출 조건 |
|------|---------|---------|
| **플레이스형** (가게 플레이스 카드 요약형) | **있음** — `BRIEFING_ACTIVE_CATEGORIES`(음식점·카페·베이커리·바·숙박)만 ACTIVE, 미용·네일·헬스장·반려동물 등은 LIKELY(확대 예정) | 스마트플레이스 완성도·소식·소개글·리뷰 |
| **정보형/공식형 멀티출처** (추천형) | **없음** — 전 업종 | 블로그·콘텐츠가 출처로 채택되면 노출 (C-rank·D.I.A. 최적화) |

**핵심 원칙**: LIKELY·INACTIVE·franchise 업종이라도 "네이버 AI 브리핑 전면 불가"가 아니다. 플레이스형만 비대상이고, 정보형은 콘텐츠만 갖추면 지금도 가능하다. 이 사실을 안내하지 않으면 사용자가 "내 업종은 AI 브리핑 완전히 안 되는구나"로 오해하고 이탈한다.

**단일 소스**:
- `backend/services/score_engine.py:30` `BRIEFING_ACTIVE_CATEGORIES`
- `frontend/lib/userGroup.ts:58` `BRIEFING_ACTIVE_CATEGORIES` + `GROUP_MESSAGES`(93-118행, 이미 4개 그룹 전부 정정 완료 — 신규 파일 작성 시 이 객체를 참조 모델로 삼을 것)

---

## 2. 반복 발견된 3가지 버그 유형

### 유형 ① LIKELY 분기만 INACTIVE 대비 누락 (가장 흔함, 전체 발견의 절반 이상)

같은 파일 안에 ACTIVE/LIKELY/INACTIVE(또는 franchise) 3~4단 분기가 있는데, **INACTIVE 분기에는 정보형 캐비엇이 있고 LIKELY 분기에는 없는** 불일치. franchise 분기가 별도로 있다면 거기도 확인 대상.

체크 방법: 같은 파일 내 `likely`/`LIKELY`와 `inactive`/`INACTIVE` 분기 텍스트를 나란히 놓고 대조. 하나만 고치고 나머지를 안 보면 반드시 놓친다.

### 유형 ② 문법 변형 전체 누락

"업종 공식 제한 없음"처럼 특정 표현을 고칠 때 **정확 문자열(exact string)만 고치면 조사·어미가 다른 변형**("없이", "이 없습니다", "이 없으므로")을 놓친다. 정규식 없이 `replace_all`만 믿지 말 것.

체크 방법: `\s*` 를 낀 정규식으로 재검색. 예: `업종\s*공식\s*제한` (exact match "업종 공식 제한 없음"보다 넓게 잡힘).

### 유형 ③ 분기 없는 정적 카피에서 암묵적 배타 인상

코드에 업종 분기(if/else) 자체가 없는 고정 문구라도, **배지·라벨이 "AI 브리핑" 바로 앞에 붙어 있으면** 독자는 "이 업종만 가능"으로 읽는다. "코드가 실제로 분기하지 않으니 문제 아니다"라는 논리는 **오판**이다 — 독자 체감이 기준이지 구현 디테일이 기준이 아니다.

예시(11차, 히어로 섹션): "음식점·카페·숙박업 등 [배지] 네이버 AI 브리핑에 우리 가게가 나오는지 확인하세요" — 분기 없는 정적 문구인데도 배타적으로 읽혀서 수정함.

---

## 3. 점검 절차 (새 대화창에서 이 순서로 진행)

1. **정보형 키워드 포함 파일과 likely 관련 파일을 자동 대조**한다. 이게 "완료"를 자칭하는 스윕에서도 매번 잔여를 찾아낸 유일하게 신뢰할 수 있는 방법이었다.
   ```bash
   grep -rl "정보형" frontend/          # 이미 캐비엇 있는 파일 목록
   grep -rl "likely\|LIKELY" frontend/  # 브리핑 자격 분기가 있을 가능성이 있는 파일 목록
   ```
   두 목록을 diff해서 "likely는 있는데 정보형은 없는" 파일을 우선 확인한다.
2. **문법 변형 재검색**: `업종\s*공식\s*제한`, `업종.{0,4}제한.{0,6}(없|있)` 같은 넓은 정규식으로 exact-match가 놓친 변형을 잡는다.
3. 발견한 파일은 **직접 Read해서 확인** — grep 스니펫만 보고 판단 금지 (앞뒤 문맥에 따라 다른 의미일 수 있음, 예: 코드 주석·전통SEO 도구 비교·관리자 패널 특정 스텝 설명 등은 정당한 예외).
4. 에이전트에 전수조사를 위임했다면 **"완료" 보고를 그대로 믿지 말 것** — 10차 스윕에서 Explore 에이전트가 52개 파일 중 6개만 확인하고 "최종 보고서"를 낸 전례가 있다. 위 1번의 자동 대조로 에이전트가 실제로 다 봤는지 검증한다.

---

## 4. 정당한 예외 (수정 불필요 — 오탐 방지)

- **짧은 배지/라벨** (예: "AI 브리핑 확대 예정" 한 줄짜리 pill 뱃지): 공간 제약상 캐비엇 생략 허용. 문단 단위 설명(2문장 이상)에만 캐비엇 필수. (`DashboardHeader.tsx`, `KeywordRankCard.tsx`, `NaverSeoBaseCard.tsx`, `GlobalAIBanner.tsx` 등)
- **코드 주석·JSX 주석**: 렌더링되지 않는 텍스트는 대상 아님.
- **다른 문맥의 "노출 안 됨"**: `AEOvsTraditionalSection.tsx`의 "AI 브리핑 측정 불가"는 전통 SEO 도구 비교(업종 자격 얘기 아님). `AiInfoTabGuide.tsx`의 특정 스텝(StepSkipped) 설명도 일반 노출 여부 주장과 문맥이 다름.
- **관리자 전용 페이지** (`app/admin/*`): 사업주에게 노출되지 않으므로 대상 아님.
- **ACTIVE 비율·점수 로직**: 이 문서와 무관, 손대지 말 것.

---

## 5. 배포 워크플로 (CLAUDE.md 표준과 동일)

1. 편집 전 로컬 vs 서버 md5 확인 (`git show HEAD:<path> | md5sum` vs `ssh ... md5sum`)
2. **md5 불일치 시 CRLF/LF 줄바꿈 차이인지 먼저 재확인**: `diff <(tr -d '\r' < local) <(tr -d '\r' < server)` — 10차 스윕에서 실제로 이 재확인 덕분에 진짜 drift가 아님을 확인한 사례 있음. 정규화 후에도 다르면 서버본을 먼저 받아 병합.
3. 로컬 편집 → scp 업로드
4. 서버에서 `npm run build` (프론트엔드는 빌드 필수 — 파일 교체만으로는 반영 안 됨)
5. `pm2 restart aeolab-frontend` → `pm2 logs --lines 30 --nostream`으로 에러 0건 확인 (`Failed to find Server Action`은 기존에도 있던 무해한 클라이언트 캐시 로그, 무시 가능)
6. 서버 grep으로 반영 확인
7. 로컬 git 커밋 (push는 별도 판단)

---

## 6. 지금까지 수정 완료된 파일 목록 (재작업 방지용 — 이미 정확함)

`userGroup.ts GROUP_MESSAGES`, `public_briefing.py`, `score_engine.py` 주석, `FAQSection.tsx`, `faq/page.tsx`, `TrialInputStep.tsx`, `TrialResultStep.tsx`, `TrialStatusSummary.tsx`, `NaverTrackCard.tsx`, `NaverStatusSection.tsx`, `ScanResultNavBar.tsx`, `guide/channels/[category]/page.tsx`, `channelGuideData.ts`, `ServiceMechanismSection.tsx`, `quick/page.tsx`, `frontend/app/page.tsx`(랜딩, 전체), `AiTabPreviewCard.tsx`, `ScoreEvidenceCard.tsx`, `guide/ai-tab/page.tsx`, `guide/ai-info-tab/page.tsx`+`AiInfoTabGuide.tsx`, `resources/[category]/page.tsx`, `demo/page.tsx`, `ChannelDifferentiationCard.tsx`, `pricing/page.tsx`, `AiInfoTabStatusCard.tsx`, `HeroSampleCard.tsx`, `ResultTable.tsx`, `DualTrackCard.tsx`(2개 버전), `HeroSection.tsx`.

**12차 스윕 (2026-07-01, git `f464977`) 추가 수정**: `guide/page.tsx`(채널별 심화 가이드 카드 — 유형③), `guide/ai-info-tab/page.tsx`(상단 경로 안내 배너 — 유형③, INACTIVE/franchise 랜딩 페이지인데도 캐비엇 없었음), `guide/ai-tab/page.tsx`(AI 브리핑 교차 CTA — 유형③), `schema/SchemaClient.tsx`(소개글 SEO 안내 문단 — 유형③), `NaverAiPathwayCard.tsx`(2곳: INACTIVE 상단 문단 + franchise 전용이던 캐비엇을 LIKELY/INACTIVE 전체로 확장 — 유형①), `backend/services/guide_generator.py::_naver_briefing_exposure_msg`(LIKELY 분기만 캐비엇 누락 — 유형①, Claude 가이드 프롬프트 컨텍스트).

**미구현 후속 (사용자 미선택, 착수하지 말 것)**: Track1 점수 모델에 정보형 브리핑 기여도 반영 — 점수 모델 변경이라 보류 결정됨.

---

## 7. 관련 문서

- `docs/naver_briefing_block_countermeasure_handoff_v1.0.md` — 네이버 차단 대응 전체 핸드오프 (§9~§11에 이 문서 이전 이력 상세 기록)
- `docs/session_2026_07_01_naver_recheck_and_usergroup_fix_v1.0.md` — 2026-07-01 세션 종합 정리
- 메모리 `project_naver_briefing_placetype_vs_infotype` — 11차 스윕 전체 원본 로그(이 문서는 그 압축본)
