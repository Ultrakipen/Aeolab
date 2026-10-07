# 공개 페이지 8종 쉬운 말·이모지·디자인 개편 기록 (2026-10-07)

대상: how-it-works · guide/channels(+[category]) · ranking · guide/chatgpt-search · faq · pricing(카드 아래) · demo · showcase. 랜딩(`app/page.tsx`)은 앞선 작업에서 처리.

## 방법
1. 4개 팀 읽기 전용 병렬 점검 → 메인 세션이 핵심 지적을 코드·원문·스크린샷으로 **직접 반증 검증**.
2. 확정 목록으로 5개 팀 병렬 구현 + 메인 세션이 누락·오류를 직접 수정(에이전트 보고에 빠진 항목이 다수 있었음).
3. 서버 md5 대조 → 빌드 → 라이브 PC/태블릿/모바일 점검(가로 넘침·14px 미만 글자·44px 미만 접기 버튼·이모지).

## 공용 컴포넌트 (신규)
- `components/common/MoreInfo.tsx` — "자세히 보기" 접이식(네이티브 `<details>`, 접힌 내용도 DOM 유지).
- `components/common/IconTile.tsx` — 이모지 대체 lucide 아이콘 타일.

## 검증으로 기각한 오탐·오판
- "업종 59개 vs 60개": 60 = 세부 업종 59 + **기타** 1 → "59개 업종" 문구는 정확. (테스트 `WHITELIST_59`는 60개 항목, `other` 포함)
- A팀의 "pricing 키워드 순위 표가 맞다" 오탐 기각이 아니라 반대: **how-it-works 표(Basic 주1회·Pro 매일)가 맞고 pricing 전체 비교표가 틀렸음** — `jobs.py:208-216`(Basic 월 04:00 / Pro·Biz·Enterprise·창업 매일 04:30).
- ranking 점수 숫자 노출·더미 의심: 실데이터, 숫자 비노출 → 문제 아님.

## 확정·수정한 사실 오류
- pricing: 키워드 순위 주기, 경쟁사 수집(비활성 잡 `jobs.py:123-129` 설명)·감지(실제 매일 03:00) 주기, "AI탭 업종 제한 없음"→"업종 제한 발표 없음", 카카오맵을 글로벌 AI로 묶음, 환불 문의 경로(공식은 support@aeolab.co.kr), 근거 없는 "30만원 광고" 수치, 사용자 노출 개발 메모 문구.
- how-it-works: "글로벌 AI도 함께 개선" 단정, Free "월 1회 수동"(실제 0), 소식 알림 7일→14일, 내부 서버 사정 노출, 낡은 업데이트 날짜, AI 모델명 노출.
- demo: 측정 횟수(자동 각 100/수동 각 50), 무료 체험 "ChatGPT 5회"→50회(비유도), 비활성 잡 설명, 근거 없는 "-2일", 지어낸 "AI 노출 N%"(정성 레이블로), "확대 예정" 단정.
- guide: "5가지 완료=AI 노출 준비" 과장, 근거 없는 "LIKELY 즉시 승급"·"전환 효과 최상"·"가장 효과적", ChatGPT에 Gemini 기간(2~4주) 적용.
- faq: C-rank 단정(외부 사실 미검증)·반영 기간 묶음·"Bing이 구글 비즈니스 프로필 인덱싱"·질문 그룹 라벨 불일치.
- showcase: "실제 구독 사업장이 사용 중" → 확인된 사실만("실제 사업장 데이터로 만든 화면, 상호만 가림"). **에이전트가 지어낸 "예시 화면" 문구를 스크린샷으로 반증해 정정.**

## 사용자 확인이 필요한 항목 (미결)
- showcase 스크린샷은 실데이터(경쟁 가게 **실제 상호·리뷰 수·주소** 노출, 내 사업장만 "OO음악학원"으로 가림). 경쟁 가게 상호 공개의 적절성 검토 권장.
- 환불 문의 경로를 이메일로 통일함 — 별도 고객용 톡톡 채널이 있다면 알려줄 것.
- 대시보드 등 범위 밖에 남은 AI탭 "업종 제한 없이" 표현: `GlobalAiFocusCard.tsx`, `ScoreEvidenceCard.tsx`, `AIDiagnosisCard.tsx`, `TrialStatusSummary.tsx`(A-1 규칙은 "업종 제한 발표 없음").
- `lib/userGroup.ts GROUP_MESSAGES`의 "(확대 예상 업종)" — 대시보드 공용이라 미수정.
- 죽은 파일: `pricing/FeatureList.tsx`, `pricing/FaqAccordion.tsx`(import 0건), `demo/page.tsx.bak.20260514`.
- chatgpt-search 부제에 "OAI-SearchBot·인덱스" 용어가 한 줄 남음(상세는 접이식으로 이동됨).

---

## Phase 5 (2026-10-08, git ba2feae) — 상호·주소 가림 / 이모지 / 어려운 용어 금지

사용자 지시: "상호와 주소는 가릴것. 이모지를 개선할것. 어려운 용어 사용금지". 대상: 랜딩 + 공개 8페이지.

### 상호·주소 가림 (위 "미결" 첫 항목 해소)
- showcase 스크린샷 16장 처리. Windows.Media.Ocr(PowerShell)로 여러 배율 타일 OCR → 상호·주소 정규식 + 수동 박스 + 가우시안 블러 → 재OCR로 잔존 확인. 원본은 작업 폴더에 백업(저장소 밖).
- demo 페이지의 실제 상호·주소는 "경쟁 가게 A"·`○○` 표기로 익명화. 이미지 URL에 `?v=20261008` 추가(캐시 갱신).
- **미결**: 원본 이미지는 git 기록에 남아 있음. 완전 제거는 기록 재작성(되돌리기 어려움)이라 사용자 결정 필요.

### 어려운 용어 금지
- 금지어 목록(채널·스캔·스캐너·인덱싱·크롤·robots·JSON-LD·스키마·UGC·쿼리·인용·그라운딩·학습 데이터·가중치·트랙·알고리즘·샘플링·백분위·Bing·C-rank·SEO·최적화·키워드 갭·GBP·API·트래픽 등)을 자동 검사기(`lint_terms.py`, 주석 제외)로 검사 → 화면 문구 `TOTAL 0`.
- 예외: 법적 면책 원문 "ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다"는 페이지당 1회 원문 유지 + 바로 옆 쉬운 설명.
- 플레이스형/정보형 → 본문은 "가게 요약형"/"글 모음형", 파일당 1회만 "(플레이스형)"/"(정보형)" 병기(점검 grep 호환).
- 이모지 → lucide 아이콘(업종 칩 포함), 버튼 `→` → `ArrowRight`.
- 마지막 점검에서 라이브 DOM 전수 스캔으로 잔여 3건(how-it-works "스캐너·Bing", demo 공용 `ResultSummaryHero` "핵심 채널") 추가 발견·수정.

### 검증
라이브 10페이지 × 390/1440px: 가로 넘침 0, 금지어(화면) 0, 컬러 이모지 0. 서버 md5 일치, 빌드·pm2 재시작 후 오류 0.

### 남은 것
- 구조화 데이터(JSON-LD) 내부에 "채널·플랫폼" 잔존(화면 미노출).
- 범위 밖: `DashboardHeroCard.tsx` "소상공인 핵심 채널", 대시보드의 AI탭 "업종 제한 없이" 표현, `lib/userGroup.ts` "(확대 예상 업종)", 죽은 파일(`pricing/FeatureList.tsx`, `FaqAccordion.tsx`, `demo/page.tsx.bak.20260514`).
- 무관한 미커밋 파일 5개(AdDefenseClient, SchemaClient, settings/team, StartupClient, tools/keyword)는 커밋 제외.

---

## Phase 6 (2026-10-08, git 94bf475) — 무료 체험·나머지 공개 페이지 용어 정리
- 4개 전문 에이전트 병렬(체험 결과 화면 / 체험 컴포넌트 19개 / 기타 공개 페이지 / 공용 컴포넌트) + 메인 세션 검증(검사기 TOTAL 0, tsc 통과, 서버 md5 일치, 라이브 16개 URL×2폭 DOM 스캔).
- 대상: /trial 전 흐름, score-guide, plans-preview, quick, share, stories, help, blog 목록, tools, 가입, PlanGate 등. 컬러 이모지→lucide, `→`→ArrowRight, 체험 결과에 "왜 네이버 정보가 ChatGPT에 잘 안 나오나요?" 접이식 추가.
- **미배포/미커밋(사용자 기존 미커밋 변경과 섞임)**: `SchemaClient.tsx`, `AdDefenseClient.tsx`(에이전트가 용어 수정함, 서버와 md5 다름), `settings/team`, `StartupClient`, `tools/keyword/page.tsx` — 기존 변경 내용 확인 후 함께 배포 결정 필요.
- **남음**: `lib/blog-posts.ts` 블로그 글 본문(검사기 21건, "최적화·세 채널" 등), terms/privacy(법적 문서라 제외), 대시보드(약 500건)·그 공용 컴포넌트.
