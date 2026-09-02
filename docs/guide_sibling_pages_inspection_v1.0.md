# 가이드 형제 페이지 점검 — 트리거 문서 (v1.0, 2026-09-02)

## 배경

`/guide/chatgpt-search` 페이지를 종합 점검(사실 정확성·논리 모순·PC/모바일 디자인 수준)해 전부 수정·배포 완료(git `dd58c2b` 카피/구조, `09ff1ac` 디자인). 같은 `guide/` 디렉토리 아래 있는 형제 페이지에도 동일한 방식의 점검이 필요.

- 완료: `frontend/app/(public)/guide/chatgpt-search/page.tsx` + `ChatGptChecklist.tsx`
- 미점검: `frontend/app/(public)/guide/channels/[category]/page.tsx` (업종별 AI 채널 노출 동적 가이드 페이지)

## `/guide/chatgpt-search`에서 적용했던 점검 방법론 (그대로 재사용)

1. **사실 정확성** — 페이지가 다루는 외부 사양(네이버/ChatGPT/Google 등)에 대한 서술을 `WebSearch`/`WebFetch`로 원문 매체명·날짜까지 확인. 스니펫 요약만 믿지 말고 가능하면 1차 출처(공식 문서) 확인, 막히면 서버 실측 데이터(`ai_usage_log` 등)로 교차검증.
2. **논리적 모순** — 페이지 내 서로 다른 섹션이 같은 개념을 다르게 설명하거나, 사용자가 특정 액션(체크리스트 등)을 완료했을 때 유도되는 기대와 실제 시스템 동작이 어긋나는지 확인.
3. **PC/모바일 라이브 디자인 점검** — Playwright로 `https://aeolab.co.kr/guide/channels/<category>` 실제 라이브 URL을 1440px(PC)·390px(모바일) 두 뷰포트로 스크린샷, 콘솔 에러 확인. 아이콘·색상 시맨틱·카드 시각 리듬·정보 이해를 돕는 시각 요소(흐름도 등) 유무를 `chatgpt-search`에서 썼던 기준(이모지 대신 `lucide-react`, 경고색과 중립색 분리, 카드 shadow/hover, 개념 흐름도)으로 평가.
4. **수정은 전부 배포까지** — md5 선확인 → 로컬 편집 → scp → 서버 `npm run build` → `pm2 restart aeolab-frontend` → 에러 로그 확인 → 라이브 재스크린샷 → md5 재일치 확인 → git 커밋.

## ⚠️ 트래픽 실측 시 주의 (2026-09-02 세션에서 얻은 교훈)

`chatgpt-search` 점검 중 nginx 로그로 방문자를 실측했다가("실방문자 0명, 전부 봇/스캐너/개발자 본인") 이를 "SEO·발견성부터 풀어야 할 병목"이라고 문제처럼 보고해 사용자에게 정정받음 — **서비스가 아직 개발 중(오픈 전)이므로 트래픽이 낮은 건 정상 상태이지 결함이 아님**. 이 페이지 점검에서도 트래픽/방문자 수를 실측하게 되면 절대 "문제"로 프레이밍하지 말 것. (상세: 사용자 메모리 `project_similar_service_comparison_and_strategy_2026_08_25.md`, `project_chatgpt_search_guide_zero_real_traffic_2026_09_02.md`)

## `[category]` 동적 라우트 특이사항 — 점검 전 먼저 확인할 것

- 이 페이지는 동적 라우트(`[category]`)이므로 업종마다 콘텐츠가 달라질 가능성이 있음 — 실제 어떤 카테고리 값들이 유효한지, 콘텐츠가 정적 텍스트인지 DB/props 기반인지 먼저 `page.tsx` 코드를 읽어 확인.
- `docs/naver_briefing_placetype_vs_infotype` 계열 문서(ACTIVE/LIKELY/INACTIVE 업종 분류)와 관련된 페이지일 가능성이 높음 — 있다면 `score_engine.py:30`·`userGroup.ts:43`의 `BRIEFING_ACTIVE_CATEGORIES`를 단일 소스로 대조.
