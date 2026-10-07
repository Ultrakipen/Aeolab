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
