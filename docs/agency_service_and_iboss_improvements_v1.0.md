# AEOlab — 대행 서비스 + 아이보스 착안 개선안 종합 기획 v1.0

> **작성일**: 2026-05-04
> **상태**: 기획 확정, 구현 대기
> **트리거**: 새 대화창에서 "`docs/agency_service_and_iboss_improvements_v1.0.md` 기준으로 Sprint 1부터 진행해줘" 1줄로 작업 시작 가능
> **선행 작업**: 아이보스(i-boss.co.kr) 분석 + 4단계 패키지 가격 협의 + 부정 프레이밍 제거 협의 완료

---

## 0. 새 대화창 시작 안내

이 문서는 **자체 완결형 기획서**입니다. 다음 한 줄로 새 대화창에서 즉시 작업 시작 가능합니다:

```
docs/agency_service_and_iboss_improvements_v1.0.md 기준으로 Sprint 1(대행 의뢰 게시판)부터 진행해줘
```

또는 특정 Sprint만:
- `Sprint 1만`: 대행 의뢰 게시판 MVP + 정적 데이터 2종(톡톡·답글 템플릿) ⭐ 최우선
- `Sprint 2만`: Q&A 게시판 MVP
- `Sprint 3만`: 운영자 보드 + 카카오 알림톡 3종 (접수·진행·완료)
- `Sprint 4만`: 성공 사례 갤러리 + 아이보스 P1 도구
- `Sprint 5만`: SOP 작성 + 베타 시범 운영
- `Phase 2`: 자동화 도구 2종 (소개글 AI + 메뉴 엑셀, BEP 5명+ 후 차후 진행)

---

## 1. 배경 및 결정 이력

### 1.1 사용자 요구사항 (대화 흐름)

| 단계 | 결정 사항 |
|------|---------|
| ① 아이보스 분석 요청 | 유사 사이트 조사 + 적용 가능한 장점 도출 |
| ② 커뮤니티·대행 추가 검토 | 일반 커뮤니티 → **관리자 Q&A 게시판**으로 한정 / 대행은 **자체 1회성**으로 결정 |
| ③ 대행 종류 정의 | 처음에 6~9종 → **수준별 3단계로 통합** (사용자 자가진단 가능) |
| ④ 부정 프레이밍 제거 | "노출 안 되는 사장님" 표현은 **AEOlab 효능 자기부정** → 긍정 프레이밍으로 전면 교체 |
| ⑤ 가격 책정 | 작업 시간 분석(01: 3.1h / 02: 4.4h / 03: 8.5h) → **시급 20,000원 안 C 채택** (소상공인 1초 결정 가능 가격) |
| ⑥ 폐기된 항목 | 사진 가이드+업로드 단독 패키지 (등록 패키지에 흡수), JSON-LD+웹사이트 SEO 패키지 (수요 없음) |

### 1.2 핵심 원칙 (구현 시 반드시 준수)

1. **부정 프레이밍 전면 금지** — "노출 안 됨", "검색 안 됨", "점수 낮음" 등 AEOlab 효능 부정 표현 금지. 긍정 프레이밍("진단 받았는데 직접 작업할 시간이 없는", "다음 단계로 점프", "결과로 증명")으로 통일
2. **소상공인 1초 결정 가격** — 모든 대행 가격은 5만원 미만(외식 1번)~15만원 미만(월 식비 일부) 마지노선 준수
3. **점수 보장 조항 금지** — "30일 후 -X점 하락 시 환불" 형식 금지(부정 프레이밍). 대신 "30일 후 자동 재진단 보고서 + 무료 재작업 1회"
4. **운영자 시급 20,000원 기준** — 1인 운영 가능 범위 내에서 외주 도입 시 손익분기 가능
5. **자동화 우선** — 대행 서비스 출시 전 자동화 도구 4종 먼저 구현하여 작업 시간 50~60% 단축

---

## 2. 아이보스(i-boss.co.kr) 분석 요약

### 2.1 아이보스 개요

- **설립**: 2003년 / **회원**: 340,000명
- **성격**: 마케팅 전문가 대상 커뮤니티 포털 (B2B 지향)
- **주요 서비스**: 커뮤니티·교육·대행사 디렉토리·마케팅 도구·자료실·채용

### 2.2 AEOlab vs 아이보스 포지션 차이

| 항목 | 아이보스 | AEOlab |
|------|---------|--------|
| 타겟 | 마케터·대행사 전문가 | 소상공인 (비전문가) |
| 방식 | 커뮤니티·교육 중심 | AI 진단 자동화 SaaS |
| 수익 | 교육료 + 대행사 노출비 | 구독 SaaS + 1회 대행 |

→ **직접 경쟁이 아닌 보완 관계**. 아이보스의 도구·자료실·시즌 캘린더 등 운영 부담 적은 요소만 선별 차용.

### 2.3 적용 가능한 개선안 (우선순위)

| 우선순위 | 항목 | 공수 | 효과 |
|---------|------|------|------|
| **P1-A** | 시즌 마케팅 캘린더 (MonthlyChecklistCard 연동) | 0.5일 | 재방문·체류 ↑ |
| **P1-B** | 무료 키워드 생성기 (`/tools/keyword`) — 비로그인 리드젠 | 1일 | 회원가입 유입 채널 ↑ |
| **P1-C** | 광고비 절감 계산기 (랜딩 정적 UI) | 0.5일 | 가격 앵커 ↑ |
| **P2-A** | 업종별 가이드 PDF 자료실 (`/resources`) | 2일 | SEO 장기 트래픽 |
| **P2-B** | 성공 사례 갤러리 (`/stories`) — 대행 30일 결과 활용 | 1일 | 신뢰도·전환율 ↑ |
| **P3-A** | AEOlab 인증 파트너 디렉토리 (대행 서비스 안정 후) | 3~5일 | B2B 수익원 |

→ Sprint 5에서 P1 도구 3종 통합 구현. P2·P3는 별도 기획.

---

## 3. 대행 서비스 — 3단 패키지 + 옵션

### 3.1 패키지 가격 (2026-05-04 확정, 정적 데이터 2종 Sprint 1 도입)

| # | 패키지명 | 작업 시간 | 가격 | 시급 환산 | 최저시급 비교 |
|---|---------|---------|--------|--------|--------|
| **01** | 스마트플레이스 등록 대행 | **5.2h** | **49,000원** | 약 9,420원/h | ❌ 미만 |
| **02** | AI 검색 최적화 | **6.0h** (1.3h 단축) | **79,000원** | 약 13,166원/h | ✅ 충족 |
| **03** | 종합 풀패키지 (01+02+코칭+30일 재진단) | **12.2h** (1.3h 단축) | **119,000원** | 약 9,754원/h | ❌ 근접 |
| 옵션 | 1:1 화상 코칭 (60분 추가) | 1h | 30,000원/회 | — | — |

> **정적 데이터 2종 효과** (Sprint 1 도입):
> - 톡톡 채팅방 메뉴 템플릿 (60분 → 20분, -40분)
> - 후기 답글 템플릿 (60분 → 20분, -40분)
> - 적용 패키지: **02·03만** (01에는 해당 작업 없음)
> - 02 시급: 10,820원/h → **13,166원/h** (최저시급 충족)
> - 03 시급: 8,815원/h → **9,754원/h** (여전히 미만, 코칭·재진단 포함이라 회당 시간 길음)
>
> **가격 유지 결정 (2026-05-04)**: 사용자 결정으로 가격 49/79/119 유지. 01·03은 최저시급 미달이지만 1인 부업 수준으로 운영 가능.
>
> **남은 자동화 (Phase 2)**: 소개글 AI 초안 + 메뉴 엑셀 양식 — BEP 5명+ 도달 시 도입 → 01·03도 최저시급 ↑
> - 01 시급 (Phase 2 후): 9,420원/h → **15,800원/h**
> - 03 시급 (Phase 2 후): 9,754원/h → **12,500원/h**

**프로모션 정책**: 출시 프로모션 **없음**. 정상가 그대로 운영.

**시장 대비 가격 우위** (§17.3 시장조사 결과 참조):
- 01 대비 시장 1회성 등록 55,000~99,000원 → AEOlab **시장 대비 50~89%**
- 02 대비 시장 정기 30만원/월 → AEOlab **시장 대비 26%** (1회성)
- 03 대비 시장 종합 60만~130만원/월 + SEO 60만~200만원 1회 → AEOlab **시장 대비 10~20%**

**운영 제약 (가격 결정의 전제)**:
- 운영자 1인 직접 작업만 가능 (외주 도입 시 적자 확실)
- 처리 한계: **주 3건 (월 12건)** — 자동화 없이 수동 작업 기준
- 월 매출 한계: 약 **100만원/월** (자동화 도입 시 160만원/월)
- 외주 검토 시점: BEP 50명 + 자동화 도구 도입 후 가격 재검토

**프로모션 정책**: 출시 프로모션 **없음**. 정상가 그대로 운영.

**시장 대비 가격 우위** (§17.3 시장조사 결과 참조):
- 01 대비 시장 1회성 등록 55,000~99,000원 → AEOlab **시장 대비 50~89%**
- 02 대비 시장 정기 30만원/월 → AEOlab **시장 대비 26%** (1회성)
- 03 대비 시장 종합 60만~130만원/월 + SEO 60만~200만원 1회 → AEOlab **시장 대비 10~20%**

**운영 제약 (가격 결정의 전제)**:
- 운영자 1인 직접 작업만 가능 (외주 도입 시 적자 확실 — 외주 시급 25,000원 기준 모든 패키지 적자)
- 처리 한계: **주 5건 (월 20건)** — 자동화 도구 4종 도입 후 기준
- 월 매출 한계: 약 **160만원/월**
- 외주 검토 시점: BEP 50명 + 정기 서비스(소식 작성 월정액) 도입 후 가격 재검토

---

### 3.2 패키지 01 — 스마트플레이스 등록 대행 (49,000원)

**대상**: 스마트플레이스를 처음부터 시작하는 사장님

**메시지 (사용자 노출용)**:
> "스마트플레이스 등록부터 막막하신가요? 처음 한 번만 맡기세요. 이후 운영은 AEOlab 진단으로 직접 가능합니다."

#### 핵심 작업 (3.9h = 235분 — 자동화 차후 미룸 기준)

| # | 작업 | 시간 (수동) | 자동화 도입 시 |
|---|------|------|----------|
| 1 | 소개글 1,000자 작성 | 60분 | (자동화 시 15분) |
| 2 | 기본정보 등록 (영업시간·휴무·전화·주차·결제수단) | 15분 | 자동화 불가 (네이버 직접 입력) |
| 3 | 메뉴/상품 30개 등록 (이름+가격+간단 설명) | 90분 | (자동화 시 30분) |
| 4 | 키워드 5개 발굴·등록 | 30분 | (기존 `keyword_suggester`로 10분 가능) |
| 5 | 카테고리 최적화 | 10분 | 사장님과 상의 |
| 6 | 사용자 제공 사진 업로드·카테고리 분류 (외관/내부/메뉴) | 30분 | 수동 |

#### 부대 작업 (1.25h = 75분)

| 작업 | 시간 |
|------|------|
| 사용자 자료 수신·정리 | 20분 |
| 작업 전 상담 (카톡·전화) | 15분 |
| 작업 후 보고서·스크린샷 정리 | 20분 |
| 사용자 확인·수정 요청 처리 | 20분 |

#### 사용자 제공 자료
- 메뉴 사진 + 가격표 (엑셀 또는 사진)
- 영업정보 폼 (영업시간·휴무·전화·주차·결제수단)
- 매장 콘셉트 3문장
- 스마트플레이스 부운영자 권한 위임 (네이버 공식 기능)

#### 결과물
- 작업 전/후 스크린샷
- 등록 항목 체크리스트 PDF
- 작업 완료 보고서 (이메일 + 카카오 알림톡)

#### 보장
- **등록 완료 보장** (네이버 정책 위반 사항 발견 시 환불)
- **결제 후 7일 내 사용자 자료 미제출 시 자동 취소 + 환불**

---

### 3.3 패키지 02 — AI 검색 최적화 (79,000원)

**대상**: 스마트플레이스는 운영 중, AEOlab 진단 받고 직접 작업할 시간이 없는 사장님

**메시지 (사용자 노출용)**:
> "진단은 받았는데, 콘텐츠 작성·등록까지 손이 안 닿으시나요? AEOlab 가이드 그대로 대신 실행해 드립니다."

#### 핵심 작업 (4.17h = 250분 — Sprint 1 정적 데이터 2종 도입 후)

| # | 작업 | 시간 | 비고 |
|---|------|------|----------|
| 1 | AEOlab 진단 결과 확인·부족 항목 정리 | 30분 | gap_analyzer 결과 활용 |
| 2 | 소개글 AI 브리핑 친화 재작성 (C-rank 4요소 반영) | 60분 | (Phase 2: 20분) |
| 3 | 톡톡 채팅방 메뉴 5종 작성 (예약·메뉴추천·주차·이벤트·문의) | **20분** ✨ | **Sprint 1 템플릿 라이브러리** (-40분) |
| 4 | 첫 소식 1회 작성·발행 | 30분 | 시즌·매장 특성 반영 |
| 5 | 후기 답글 템플릿 10개 (긍정·중립·부정 패턴별) | **20분** ✨ | **Sprint 1 템플릿 라이브러리** (-40분) |
| 6 | 메뉴 설명 AI 친화적 재작성 (30개) | 60분 | (Phase 2: 30분) |
| 7 | 키워드 갭 분석 후 부족 키워드 보강 | 30분 | gap_analyzer 결과 활용 |

#### 부대 작업 (1.8h = 110분)

| 작업 | 시간 |
|------|------|
| 사용자 자료 수신·정리 | 20분 |
| 작업 전 상담 (콘셉트·시그니처 메뉴 청취) | 30분 |
| 작업 후 보고서·스크린샷 정리 | 30분 |
| 사용자 확인·수정 요청 처리 | 30분 |

#### 사용자 제공 자료
- 매장 콘셉트 5문장
- 시그니처 메뉴 3개 + 차별화 포인트
- 스마트플레이스 부운영자 권한 위임

#### 결과물
- 작업 완료 보고서 + 콘텐츠 백업 PDF
- AI 브리핑 5단계 적용 체크리스트
- 후기 답글 템플릿 10종 텍스트 파일

#### 보장
- 콘텐츠 등록 완료
- 결제 후 7일 내 자료 미제출 시 자동 취소 + 환불

---

### 3.4 패키지 03 — 종합 풀패키지 (119,000원)

**대상**: 스마트플레이스 신규 시작 + AI 노출까지 한 번에 끝내고 싶은 사장님

**메시지 (사용자 노출용)**:
> "처음부터 끝까지 다 맡기세요. 30일 후 결과로 증명하겠습니다."

#### 포함 항목

1. **01 등록 대행 전체** (5.2h)
2. **02 AI 검색 최적화 전체** (6.0h, Sprint 1 정적 데이터 2종 도입 후)
3. **1:1 화상 코칭 60분** (작업 결과 설명 + 향후 운영 가이드)
4. **30일 후 자동 재진단 + 결과 보고서 PDF** (스케줄러 + 기존 스캔 엔진 — 운영자 추가 작업 0)
5. **총 작업 시간**: 12.2h (Sprint 1 후) → 9.5h (Phase 2 후)

#### 가격 비교
- 개별 합산: 49,000 + 79,000 + 30,000(코칭) = **158,000원**
- 종합 패키지: **119,000원** → **39,000원 할인 (24.7% 할인)**

#### 결과 보장 (긍정 프레이밍)
- "30일 후 자동 재진단 보고서로 작업 효과 증명"
- 만약 점수 변동이 미미한 경우 (±2점 이내) **무료 재작업 1회** 제공 (환불 대신 재작업)
- 점수 보장 조항(환불) 명시 금지

---

### 3.5 옵션 — 1:1 화상 코칭 60분 추가 (30,000원/회)

**대상**: 01·02 구매자가 추가로 받고 싶을 때 / 03 구매자가 추가 코칭 원할 때

#### 작업 내용
- 화면 공유로 함께 작업
- 사장님이 직접 손으로 익히기 (자립 학습)
- 질문 답변 (AI 브리핑·키워드·운영 노하우)

#### 결과물
- 코칭 녹화본 (선택, 사용자 동의 시)
- 다음 액션 체크리스트

---

## 4. 출시 프로모션 (폐기 — 2026-05-04 결정)

> **최종 결정**: 출시 프로모션 **없음**. 정상가 그대로 운영.
>
> **폐기 사유** (시장조사 결과):
> - 50% 할인 시 모든 패키지 시급이 최저시급(11,000원) 미만으로 적자 확실
>   - 01: 24,500원 → 시급 7,900원/h
>   - 02: 39,500원 → 시급 9,000원/h
>   - 03: 59,500원 → 시급 6,300원/h
> - 정상가(49/79/119)도 이미 시장 대비 10~50% 수준으로 충분히 경쟁력 있음
> - 후기 확보는 다른 방식으로 대체 (예: 첫 5건은 운영자 수동 베타 시범, 이후는 자연스러운 후기)

### 4.1 후기 확보 대안 (프로모션 없이)

| 시점 | 방법 |
|------|------|
| 출시 직전 | 베타 사용자 3~5명 무료 시범 (운영자 직접 운영) |
| 출시 직후 | 정상가 결제자에게 후기 작성 시 다음 1회 옵션 코칭 무료 제공 |
| 30일 후 | 패키지 03 구매자 자동 재진단 보고서 + 후기 요청 (성공 사례 갤러리 게재) |

---

## 5. 게시판 2종 — Q&A 게시판 + 대행 의뢰 게시판

> **2026-05-04 결정**: Q&A 게시판과 대행 의뢰 게시판을 **별도로 분리**. 운영 동선과 보안 정책이 다름.

| 구분 | Q&A 게시판 | 대행 의뢰 게시판 |
|------|---------|--------------|
| 목적 | 결제·기능·점수 등 일반 문의 | 대행 상품 신청 + 자료 제출 + 진행 추적 |
| 공개 여부 | 선택 (공개 시 자체 FAQ 자산화) | **항상 비밀** (사업 정보·자료 포함) |
| 결제 | 무료 | 토스페이먼츠 1회성 결제 필수 |
| 상태 추적 | open / answered / closed | **접수 / 진행 / 완료** (3단계) |
| 첨부 파일 | 선택 (스크린샷 등) | 필수 (사진·메뉴·콘셉트) |
| 알림톡 | 답변 등록 시 1회 | 상태 변경 시 3회 (접수·진행·완료) |
| URL | `/support` | `/delivery` |

---

## 5.1 Q&A 게시판 (관리자 1:1)

#### 5.1.1 컨셉

기존 카카오톡·이메일 CS와 차별점:
- **기록 누적** → 자체 FAQ 자산화
- **선택적 공개** → 다른 사용자가 검색 가능 (운영자 부담 ↓)
- **앱 내 완결** → 사용자 이탈 없음
- **SLA 가시화** → "24시간 내 답변" 신뢰 형성

#### 5.1.2 카테고리 5종

| 카테고리 | 예시 |
|---------|------|
| 결제 | 환불·재결제·플랜 변경 |
| 기능 사용 | 스캔·키워드 등록·가이드 |
| 점수 해석 | 점수 산정·갭 분석 |
| 버그 | 화면 오류·로그인 문제 |
| 기타 | 일반 문의 |

#### 5.1.3 공개 정책

- 사용자가 작성 시 "공개 등록 가능" 옵션 제공 (기본값: 비공개)
- 운영자가 답변 후 공개 전환 권한 보유 (FAQ화)
- 결제·계정 관련은 자동 비공개

#### 5.1.4 요금제별 SLA

| 플랜 | 문의 한도 | SLA |
|------|---------|-----|
| Free | 월 1건 | 48시간 |
| Basic | 월 3건 | 24시간 |
| Pro | 무제한 | 12시간 |
| Biz | 무제한 + 카카오톡 직통 | 4시간 |

---

## 5.2 대행 의뢰 게시판 (비밀 + 결제 + 상태 추적)

> **2026-05-04 신설**: 사용자가 비밀 게시판에 글을 작성하여 대행 상품을 신청. 접수→진행→완료 3단계 상태 알림. 운영자와 1:1 비공개 메시지 교환.

### 5.2.1 컨셉

- **비밀 게시판** — 본인과 관리자만 열람 가능 (사업 정보·자료 보호)
- **상품 선택 → 의뢰 작성 → 결제** 한 흐름으로 통합
- **상태 변경 시 자동 카카오 알림톡** (접수·진행·완료 3단계)
- **운영자 1:1 메시지 교환** (게시판 내에서 카톡 대신 사용 가능)
- **자료 첨부 통합** (Supabase Storage)
- **진행 가시화** — 사용자가 언제든 진행 상황 확인 가능 (CS 부담 ↓)

### 5.2.2 의뢰 작성 흐름

```
1. /delivery 패키지 비교 페이지에서 상품 선택 (01·02·03)
   ↓
2. /delivery/new 의뢰 작성
   - 상품 자동 선택 (변경 가능)
   - 사업장 선택 (다중 사업장 등록 사용자)
   - 의뢰 내용 입력 (콘셉트 5문장·시그니처 메뉴 3개·기타 요청)
   - 자료 첨부 (사진·메뉴 엑셀, 선택)
   ↓
3. 토스 결제 (의뢰 작성과 동시)
   ↓
4. /delivery/orders/{id} 의뢰 상세 (게시판 글)
   - 작성한 의뢰 내용 (변경 불가, 운영자가 본 후 안내 메시지로 협의)
   - 진행 상태 배지 (접수 / 진행 / 완료)
   - 운영자 메시지·답글 영역
   - 추가 자료 업로드 (작업 중 추가 요청 시)
   - 완료 보고서·스크린샷 (운영자가 첨부)
```

### 5.2.3 게시판 상태 (3단계)

| 상태 | 의미 | 트리거 | 알림톡 |
|------|------|------|------|
| **접수** | 결제 완료, 운영자 검토 대기 | 결제 완료 자동 | `AEOLAB_DELIVERY_01` |
| **진행** | 운영자가 작업 시작 | 운영자가 status 변경 | `AEOLAB_DELIVERY_02` |
| **완료** | 작업·보고서 완료 | 운영자가 완료 보고 등록 | `AEOLAB_DELIVERY_03` |

> 기존 `delivery_orders` 세부 상태(materials_pending·consent_pending 등)는 내부 관리용으로 유지. 사용자에게는 3단계만 노출 (단순화).

### 5.2.4 보안 및 비밀 정책

- **RLS 정책**: 본인(`auth.uid() = user_id`)과 admin만 SELECT/UPDATE
- **메시지 첨부 파일**: Supabase Storage 사인드 URL (만료 1시간, 비공개 버킷)
- **공개 전환 불가** — Q&A 게시판과 다르게 영구 비밀 유지

### 5.2.5 게시판과 기존 `delivery_orders` 관계

- 1개 의뢰 = 1개 `delivery_orders` 행
- `delivery_messages` 신규 테이블 — 의뢰 내 운영자·사용자 메시지 (게시판 답글 역할)
- 사용자 노출 게시판 = `/delivery/orders/{id}` 페이지에 의뢰 내용 + 메시지 + 진행 상태 통합

### 5.2.6 요금제별 정책

- 모든 플랜 의뢰 가능 (Free 포함 — 1회성 결제이므로 플랜 게이팅 없음)
- 단, **Biz+ 사용자**는 의뢰 시 우선순위 표시 (`/admin/delivery`에서 상단 노출)

---

## 6. 자동화 도구 — 2종 즉시(Sprint 1) + 2종 차후(Phase 2)

> **2026-05-04 결정**: 자동화 도구 4종 중 **정적 데이터 2종(톡톡·답글 템플릿)만 Sprint 1에 포함**. AI·엑셀 처리 2종은 차후(Phase 2).
>
> **분류 기준**:
> - **Sprint 1 (즉시)**: AI 호출 0회, 정적 JSONB 데이터, 1일 작업 → 02·03 시급 즉시 ↑
> - **Phase 2 (BEP 5명+ 후)**: AI 호출 또는 엑셀 처리 — 비용·테스트 부담 ↑

### 6.1 Sprint 1 정적 데이터 2종 (즉시 도입)

| # | 도구명 | 효과 | 구현 |
|---|--------|------|-----|
| 1 | **톡톡 채팅방 메뉴 업종 템플릿 라이브러리** | 60분 → 20분 (-40분) | JSONB 정적 데이터 + 매장명 치환 |
| 2 | **후기 답글 템플릿 라이브러리** | 60분 → 20분 (-40분) | JSONB 정적 데이터 (업종×감정×패턴) |

**시급 효과**: 02 패키지 13,166원/h 확보 (최저시급 ↑), 03 패키지 9,754원/h (여전히 최저시급 미만)

### 6.2 Phase 2 자동화 도구 (⏸ BEP 5명+ 후)

| # | 도구명 | 효과 | 구현 |
|---|--------|------|-----|
| 3 | 소개글 AI 초안 생성기 (`generate_intro_draft`) | 60분 → 15분 (75% ↓) | Claude Haiku API |
| 4 | 메뉴 일괄 등록 엑셀 양식 | 90분 → 30분 (67% ↓) | openpyxl |

**시급 효과 (Phase 2 후)**: 01 15,800원/h / 02 17,950원/h / 03 12,500원/h

### 6.3 목적

대행 서비스 작업 시간을 단축하고, Pro+ 사용자도 직접 사용 가능한 SaaS 기능으로 일석이조.

### 6.2 도구 목록

| # | 도구명 | 효과 | API |
|---|--------|------|-----|
| 1 | 소개글 AI 초안 생성기 (`generate_intro_draft`) | 60분 → 15분 (75% ↓) | POST `/api/tools/intro-draft` |
| 2 | 톡톡 채팅방 메뉴 업종 템플릿 라이브러리 | 60분 → 20분 (67% ↓) | GET `/api/tools/talktalk-templates/{category}` |
| 3 | 후기 답글 템플릿 라이브러리 | 60분 → 20분 (67% ↓) | GET `/api/tools/reply-templates/{category}/{sentiment}` |
| 4 | 메뉴 일괄 등록 엑셀 양식 | 90분 → 30분 (67% ↓) | GET `/api/tools/menu-template.xlsx` |

### 6.3 각 도구 상세

#### 6.3.1 소개글 AI 초안 생성기

**입력**:
- 업종 (25개 화이트리스트)
- 매장명·지역
- 콘셉트 키워드 5개
- 시그니처 메뉴 3개
- 모드: `standard` (일반) / `ai_briefing` (AI 브리핑 친화)

**출력**:
- 1,000자 소개글 초안
- C-rank 4요소 반영 (Context·Content·Chain·Creator)
- 키워드 자연 삽입

**구현**: 기존 `keyword_suggester.py` 패턴 재활용 + Claude Haiku

#### 6.3.2 톡톡 채팅방 메뉴 업종 템플릿 라이브러리

**구조**: JSONB 정적 데이터 + 매장명·메뉴명 치환

**기본 5종**:
- 예약 안내
- 메뉴 추천
- 주차 안내
- 이벤트·할인
- 일반 문의

**업종별 커스터마이징**: 25개 업종 × 5종 = 125개 템플릿

#### 6.3.3 후기 답글 템플릿 라이브러리

**구조**: 감정 × 패턴 × 업종

**감정 분류**: 긍정 / 중립 / 부정
**패턴**: 음식 칭찬·서비스 칭찬·재방문 의지 / 가격 불만·맛 불만·서비스 불만
**업종별 커스터마이징**: 키워드 자연 삽입

**총 템플릿 수**: 25개 업종 × 3감정 × 5~7패턴 ≈ 400~500개

#### 6.3.4 메뉴 일괄 등록 엑셀 양식

**다운로드 양식**:
| 메뉴명 | 가격 | 설명(150자) | 카테고리 | 대표메뉴여부 |
|--------|------|-----------|---------|------------|

**업로드 시**:
- 파싱 → JSONB 변환 → 사용자 비즈니스에 저장
- 운영자가 직접 네이버 입력 (수동, 자동화 불가)

---

## 7. DB 스키마 (신규 테이블)

### 7.1 `support_tickets` (Q&A 게시판)

```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('payment','feature','score','bug','other')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX idx_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX idx_tickets_public ON support_tickets(visibility, status)
  WHERE visibility = 'public' AND status = 'answered';

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_tickets" ON support_tickets FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "public_answered" ON support_tickets FOR SELECT
  USING (visibility = 'public' AND status = 'answered');
```

### 7.2 `support_replies` (Q&A 답변·코멘트)

```sql
CREATE TABLE support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','admin')),
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_replies_ticket ON support_replies(ticket_id, created_at);
```

### 7.3 `delivery_orders` (대행 의뢰 게시판 = 1행 1글)

```sql
CREATE TABLE delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('smartplace_register','ai_optimization','comprehensive')),
  amount INT NOT NULL,
  payment_id TEXT,                   -- 토스 결제 ID

  -- 의뢰 내용 (게시판 글 본문)
  request_title TEXT NOT NULL,                  -- 게시글 제목 (사용자 작성)
  request_body TEXT NOT NULL,                   -- 의뢰 내용 (콘셉트 5문장·시그니처 메뉴 3개·기타 요청)

  -- 사용자 노출 상태 (3단계, 단순화)
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received',                      -- 접수 (결제 완료, 운영자 검토 대기)
    'in_progress',                   -- 진행 (운영자가 작업 시작)
    'completed',                     -- 완료 (작업·보고서 완료)
    'rework',                        -- 재작업 진행 (점수 ±2점 이내 시)
    'refunded',                      -- 환불 완료
    'cancelled'                      -- 취소 (자료 미제출 7일 경과 등)
  )),

  -- 위임 동의 (단순 체크박스)
  consent_agreed BOOLEAN DEFAULT FALSE,
  consent_signed_at TIMESTAMPTZ,
  consent_ip TEXT,                   -- IP 기록 (분쟁 증빙)

  -- 자료
  materials_url JSONB,               -- 사용자 업로드 자료 (Supabase Storage 사인드 URL 목록)

  -- 작업 진행
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  completion_report JSONB,           -- 작업 결과 체크리스트·스크린샷 URL

  -- 30일 재진단 (패키지 03만)
  score_before NUMERIC,
  score_after NUMERIC,
  followup_scan_id UUID,
  rework_reason TEXT,
  rework_count INT DEFAULT 0,

  -- 환불·후기
  refund_reason TEXT,
  refund_amount INT,
  testimonial_consent BOOLEAN DEFAULT FALSE,
  testimonial_submitted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_user ON delivery_orders(user_id, created_at DESC);
CREATE INDEX idx_delivery_status ON delivery_orders(status, created_at);

ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
-- 비밀 게시판: 본인과 admin만 열람·수정 (RLS는 본인만, admin은 service_role 사용)
CREATE POLICY "user_own_orders" ON delivery_orders FOR ALL
  USING (auth.uid() = user_id);
```

### 7.3.2 `delivery_messages` (대행 의뢰 게시판 — 운영자·사용자 메시지)

```sql
CREATE TABLE delivery_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','admin')),
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  attachment_urls JSONB DEFAULT '[]'::jsonb,    -- 추가 첨부 파일 (사인드 URL)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ                            -- 상대방이 읽은 시각
);

CREATE INDEX idx_msg_order ON delivery_messages(order_id, created_at);

ALTER TABLE delivery_messages ENABLE ROW LEVEL SECURITY;
-- 본인의 의뢰에 속한 메시지만 열람 가능
CREATE POLICY "user_own_order_messages" ON delivery_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM delivery_orders o
      WHERE o.id = delivery_messages.order_id AND o.user_id = auth.uid()
    )
  );
```

### 7.4 `success_stories` (성공 사례 갤러리)

```sql
CREATE TABLE success_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  delivery_order_id UUID REFERENCES delivery_orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL,                       -- 업종
  region TEXT NOT NULL,                         -- 지역 (시·구 단위)
  title TEXT NOT NULL,
  body TEXT NOT NULL,                           -- 후기 본문
  score_before NUMERIC,
  score_after NUMERIC,
  score_delta NUMERIC GENERATED ALWAYS AS (score_after - score_before) STORED,
  is_anonymous BOOLEAN DEFAULT TRUE,
  display_name TEXT,                            -- 익명 시 NULL
  consent_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INT DEFAULT 0
);

CREATE INDEX idx_stories_category ON success_stories(category, published_at DESC);
CREATE INDEX idx_stories_delta ON success_stories(score_delta DESC) WHERE score_delta > 0;
```

### 7.5 `tool_usage_log` (자동화 도구 사용량 추적 — 플랜 게이트용)

```sql
CREATE TABLE tool_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL CHECK (tool_name IN (
    'intro_draft','talktalk_templates','reply_templates','menu_template'
  )),
  used_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB                               -- 입력값 일부·결과 ID 등
);

CREATE INDEX idx_tool_usage_user_month ON tool_usage_log(user_id, used_at DESC);
```

---

## 8. API 엔드포인트 (신규)

### 8.1 자동화 도구 (Sprint 1)

| Method | Endpoint | 인증 | 플랜 게이트 | 비고 |
|--------|----------|------|---------|------|
| POST | `/api/tools/intro-draft` | 필수 | Pro+ | 월 10회 (Pro), 무제한 (Biz+) |
| GET | `/api/tools/talktalk-templates/{category}` | 필수 | Basic+ | 정적 데이터, 무제한 |
| GET | `/api/tools/reply-templates/{category}/{sentiment}` | 필수 | Basic+ | 정적 데이터, 무제한 |
| GET | `/api/tools/menu-template.xlsx` | 필수 | Basic+ | 엑셀 양식 다운로드 |

### 8.2 Q&A 게시판 (Sprint 2)

| Method | Endpoint | 인증 | 비고 |
|--------|----------|------|------|
| POST | `/api/support/tickets` | 필수 | 카테고리·공개여부 선택 |
| GET | `/api/support/tickets/me` | 필수 | 내 문의 목록 |
| GET | `/api/support/tickets/{id}` | 필수 | 본인 또는 공개+답변완료만 |
| POST | `/api/support/tickets/{id}/replies` | 필수 | 추가 코멘트 |
| GET | `/api/support/public` | 비로그인 | 공개 답변 게시판 (검색·카테고리 필터) |
| POST | `/admin/support/{id}/reply` | admin | 관리자 답변 |
| PATCH | `/admin/support/{id}/visibility` | admin | 공개 전환 |

### 8.3 대행 의뢰 게시판 (Sprint 1·3)

| Method | Endpoint | 인증 | 비고 |
|--------|----------|------|------|
| GET | `/api/delivery/packages` | 비로그인 | 패키지 3종 가격·내용 |
| POST | `/api/delivery/orders` | 필수 | 의뢰 작성 + 토스 결제 (제목·본문·상품·자료) |
| POST | `/api/delivery/orders/{id}/materials` | 필수 | 추가 자료 업로드 (Supabase Storage 비공개 버킷) |
| POST | `/api/delivery/orders/{id}/consent` | 필수 | 위임 동의 체크 (단순 boolean + IP 기록) |
| GET | `/api/delivery/orders/me` | 필수 | 내 의뢰 목록 (게시판) |
| GET | `/api/delivery/orders/{id}` | 필수 | 의뢰 상세 (게시글 + 상태) |
| GET | `/api/delivery/orders/{id}/messages` | 필수 | 의뢰 메시지 목록 (운영자·사용자) |
| POST | `/api/delivery/orders/{id}/messages` | 필수 | 사용자가 메시지 작성 |
| GET | `/api/delivery/orders/{id}/report` | 필수 | 완료 보고서 |
| POST | `/api/delivery/orders/{id}/testimonial` | 필수 | 후기 작성 (옵션 코칭 무료 쿠폰 발급) |
| POST | `/admin/delivery/{id}/status` | admin | 운영자 상태 업데이트 (접수→진행→완료, 알림톡 자동 트리거) |
| POST | `/admin/delivery/{id}/messages` | admin | 운영자 메시지·답글 작성 |
| POST | `/admin/delivery/{id}/complete` | admin | 완료 보고서 등록 (스크린샷·체크리스트) |
| POST | `/admin/delivery/{id}/rework` | admin | 무료 재작업 1회 (점수 ±2점 이내 시) |

### 8.4 성공 사례 갤러리 (Sprint 5)

| Method | Endpoint | 인증 | 비고 |
|--------|----------|------|------|
| GET | `/api/stories` | 비로그인 | 카테고리·지역 필터 |
| GET | `/api/stories/{id}` | 비로그인 | 상세 |
| POST | `/admin/stories` | admin | 큐레이션 게시 |

### 8.5 아이보스 P1 도구 (Sprint 5)

| Method | Endpoint | 인증 | 비고 |
|--------|----------|------|------|
| GET | `/api/tools/seasonal-keywords/{category}/{month}` | 비로그인 | 시즌 키워드 (정적 데이터) |
| POST | `/api/tools/keyword-public` | 비로그인 | 공개 키워드 생성기 (IP당 분당 3회) |
| GET | `/api/tools/ad-cost-calculator` | 비로그인 | 정적 계산기 (서버리스 가능) |

---

## 9. 카카오 알림톡 신규 템플릿 4종 (2026-05-04 재정의)

| 템플릿 ID | 이름 | 트리거 |
|---------|------|------|
| `AEOLAB_DELIVERY_01` | 대행 의뢰 접수 완료 | 결제 완료 자동 (게시판 status='접수') |
| `AEOLAB_DELIVERY_02` | 대행 작업 시작 | 운영자가 status='진행' 변경 시 자동 |
| `AEOLAB_DELIVERY_03` | 대행 작업 완료 | 운영자가 완료 보고 등록 시 자동 (status='완료') |
| `AEOLAB_DELIVERY_04` | 30일 결과 보고 | 스케줄러 자동 (패키지 03만) |

> Q&A 답변 알림(`AEOLAB_SUPPORT_01`)은 **이메일로 대체** — 알림톡 템플릿 추가 신청 부담 ↓ + Q&A는 긴급도 낮음
>
> 4종 모두 **비즈센터 신규 신청 필요** (사용자 직접 작업).

---

## 10. 프론트엔드 페이지 (신규)

### 10.1 사용자 페이지

```
frontend/app/
├── (dashboard)/support/                    # Q&A 게시판
│   ├── page.tsx                           # 내 문의 목록 + "새 문의" 버튼
│   ├── new/page.tsx                       # 문의 작성 폼
│   └── [id]/page.tsx                      # 상세 + 코멘트
├── (dashboard)/delivery/                   # 대행 의뢰 게시판 (비밀)
│   ├── page.tsx                           # 패키지 3종 비교 + "새 의뢰" 버튼
│   ├── new/page.tsx                       # 의뢰 작성 폼 (상품 선택·내용·자료·결제)
│   └── orders/                             # 내 의뢰 목록 = 게시판
│       ├── page.tsx                       # 의뢰 목록 (status 배지)
│       └── [id]/page.tsx                  # 의뢰 상세 (게시글 + 메시지 + 진행 상태)
│           # 단일 페이지에 통합:
│           # - 의뢰 내용 (변경 불가)
│           # - 진행 상태 배지 (접수/진행/완료)
│           # - 운영자 메시지·답글
│           # - 추가 자료 업로드
│           # - 완료 보고서·스크린샷 (운영자 첨부)
├── (public)/help/page.tsx                  # 공개 FAQ (비로그인)
├── (public)/stories/                       # 성공 사례 갤러리
│   ├── page.tsx                           # 카테고리·지역 필터
│   └── [id]/page.tsx                      # 상세
└── (public)/tools/                         # 무료 도구 (아이보스 P1)
    ├── keyword/page.tsx                   # 키워드 생성기 (비로그인)
    └── ad-cost-calculator/page.tsx        # 광고비 계산기 (정적)
```

### 10.2 관리자 페이지

```
frontend/app/admin/
├── support/page.tsx                        # 단순 목록 + 미답변 필터
├── delivery/                               # 대행 의뢰 관리
│   ├── page.tsx                           # 단순 목록 + status 필터 (칸반 X)
│   └── [id]/page.tsx                      # 의뢰 상세 + 작업 입력 + 메시지·완료 보고
└── stories/page.tsx                        # 성공 사례 큐레이션
```

### 10.3 대시보드 위젯 (기존 페이지에 추가)

| 위치 | 위젯 | 내용 |
|------|------|------|
| `dashboard/page.tsx` | `DeliveryRecommendCard` | 점수·등록 상태 기반 패키지 추천 (자가진단) |
| `dashboard/page.tsx` | `SeasonalKeywordBanner` | 시즌 키워드 (이번 달 추천) |
| 랜딩 `app/page.tsx` | `AdCostCalculator` 섹션 | 광고비 절감 계산기 (가격 앵커) |
| 랜딩 `app/page.tsx` | `FreeToolsSection` | 무료 키워드 생성기 안내 |

---

## 11. 구현 로드맵 (5 Sprint, 2026-05-04 재편성 — 자동화 차후 미룸)

> **재편성 이유**: 자동화 도구 4종은 차후로 미루고, 대행 의뢰 게시판을 Sprint 1로 우선 구현. 출시 핵심 인프라(게시판·결제·운영보드)부터 먼저 갖춤.

### Sprint 1 (1주차) — 대행 의뢰 게시판 MVP + 정적 데이터 2종 ⭐ 최우선

**목적**: 사용자가 비밀 게시판에서 상품 선택 → 의뢰 작성 → 결제 → 진행 추적. 운영자 작업 시간 80분 단축(02·03).

#### 1-A. 대행 의뢰 게시판 (메인)

- [ ] `delivery_orders` DB 마이그레이션 + RLS
- [ ] `delivery_messages` DB 마이그레이션 (운영자·사용자 메시지)
- [ ] Supabase Storage 비공개 버킷 생성 (`delivery-materials` — 사인드 URL 1시간)
- [ ] `backend/routers/delivery.py` — 주문 생성·메시지·자료 업로드 엔드포인트
- [ ] 토스페이먼츠 1회성 결제 연동 (3개 패키지 등록: 49,000 / 79,000 / 119,000원)
- [ ] 프론트 `/delivery` 패키지 3종 비교 페이지
- [ ] 프론트 `/delivery/new` 의뢰 작성 폼 (상품 선택·의뢰 내용·자료 첨부·결제)
- [ ] 프론트 `/delivery/orders` 내 의뢰 목록 (게시판)
- [ ] 프론트 `/delivery/orders/[id]` 의뢰 상세 (게시글 + 메시지 + 진행 상태 배지)
- [ ] 단순 위임 동의 체크박스 + DB 기록 (PDF·전자서명 X)
- [ ] 7일 내 자료 미제출 시 자동 취소·환불 (간단 스케줄러)

#### 1-B. 정적 데이터 2종 (운영자 작업 시간 단축, 1일 작업)

- [ ] `backend/services/talktalk_templates.py` — 톡톡 채팅방 메뉴 업종 템플릿 (JSONB 정적, 25개 업종 × 5종 = 125개 템플릿)
- [ ] `backend/services/reply_templates.py` — 후기 답글 템플릿 (25개 업종 × 3감정 × 5~7패턴 ≈ 400~500개)
- [ ] `backend/routers/tools.py` — 2개 GET 엔드포인트 (admin·Pro+ 인증)
- [ ] 매장명·메뉴명 치환 헬퍼 함수
- [ ] 운영자 보드(`/admin/delivery/[id]`)에서 템플릿 즉시 호출·복사 기능

### Sprint 2 (2주차) — Q&A 게시판 MVP

- [ ] `support_tickets` + `support_replies` DB 마이그레이션 + RLS
- [ ] `backend/routers/support.py` — 사용자·관리자 엔드포인트
- [ ] 운영자 알림 (이메일 + 카카오톡 직접 — 새 문의 등록 시)
- [ ] 프론트 사용자 페이지 (`/support`, `/support/new`, `/support/[id]`)
- [ ] 프론트 관리자 페이지 (`/admin/support` — 단순 목록 + 미답변 필터)
- [ ] 프론트 공개 FAQ (`/help` — 비로그인 접근, 운영자 공개 전환 시 노출)

### Sprint 3 (3주차) — 운영자 보드 + 알림톡 3종

- [ ] 프론트 `/admin/delivery` **단순 목록 + status 필터** (칸반 X — 단순화)
- [ ] 프론트 `/admin/delivery/[id]` 작업 입력 화면 (status 변경·메시지·완료 보고서 첨부)
- [ ] 카카오 알림톡 3종 신청·연동 (`AEOLAB_DELIVERY_01·02·03` — 접수·진행·완료)
- [ ] status 변경 시 알림톡 자동 발송 (간단한 트리거)
- [ ] 운영자가 작업 전/후 스크린샷 직접 첨부 (자동 캡처 X)
- [ ] 완료 보고서 PDF 생성 (기존 `pdf_generator.py` 재사용 — 운영자가 항목 채우면 PDF 출력)
- [ ] 30일 후 자동 재진단 스케줄러 (패키지 03만, 기존 스캔 엔진 재사용)
- [ ] 무료 재작업 1회 처리 로직 (점수 ±2점 이내 시 status='rework')

### Sprint 4 (4주차) — 성공 사례 갤러리 + 아이보스 P1 도구

> 출시 프로모션 **폐기** (§4 참조).

- [ ] `success_stories` DB 마이그레이션
- [ ] 프론트 `/stories` 갤러리 + `/admin/stories` 큐레이션 (운영자 직접 게시)
- [ ] 프론트 `/tools/keyword` 공개 키워드 생성기 (비로그인 분당 3회, 기존 `keyword_suggester` 활용)
- [ ] 프론트 `/tools/ad-cost-calculator` 정적 계산기 (서버 호출 0)
- [ ] 랜딩 `AdCostCalculator` 섹션 추가
- [ ] 대시보드 `SeasonalKeywordBanner` 위젯 (정적 시즌 키워드 테이블)

### Sprint 5 (5주차) — SOP 작성 + 베타 시범

- [ ] 운영자 본인이 베타 사용자 3~5명에게 직접 무료 시범 운영
- [ ] 시범 운영 결과로 SOP (작업 표준 매뉴얼) 작성
- [ ] 후기 작성 시 옵션 코칭 무료 1회 제공 로직 (간단한 쿠폰 코드)
- [ ] 시범 후기 → `/stories` 첫 콘텐츠로 게시
- [ ] 정상가 출시 (홈페이지 게시판 안내)

### Phase 2 (BEP 5명+ 또는 1~2개월 후) — 자동화 도구 2종 (⏸ 차후)

> Sprint 1에서 정적 데이터 2종(톡톡·답글 템플릿)은 이미 도입됨. Phase 2는 AI·엑셀 처리 2종만 남음.

- [ ] `tool_usage_log` DB 마이그레이션
- [ ] **소개글 AI 초안 생성기** (`generate_intro_draft`) — Claude Haiku (60분 → 15분)
- [ ] **메뉴 일괄 등록 엑셀 양식** — openpyxl (90분 → 30분)
- [ ] Pro+ 사용자에게도 도구 노출 (월 한도)
- [ ] 작업 시간 단축 효과 측정 → 가격 재검토 (시급 01 9,420 → 15,800원/h, 03 9,754 → 12,500원/h)

### Phase 3 (BEP 20명+) — 확장 (별도 기획)

- 외주 알바 1명 채용 + 가격 재조정
- 옵션 4: 소식 정기 작성 (월 4회) 출시
- 업종별 가이드 PDF 자료실 (`/resources`)
- AEOlab 인증 파트너 디렉토리

---

## 12. 운영 부담 검토 (1인 개발자 현실)

| 단계 | 처리 가능 건수 | 운영자 시간 |
|------|---------------|----------|
| **출시 직후 (수동, 자동화 차후)** | **주 2~3건** | 본인 직접 (주 13~20시간 — 평균 6.5h/건) |
| **자동화 4종 도입 후 (Phase 2)** | 주 4~5건 | 본인 직접 (주 10~12시간) |
| **BEP 20명 + 외주 알바 1명** | 주 8~10건 | 운영자 검수만 (주 5시간) |
| **외주 2~3명 + SOP 정착** | 주 15~20건 | 운영자 마케팅 집중 |

### 12.1 자동화로 줄일 수 있는 것

- 자료 수신·정리: 표준 폼 + Supabase Storage 직접 업로드
- 작업 전 상담: 카톡봇 1차 접수 → 운영자 30분 단위 슬롯 예약
- 보고서 작성: PDF 자동 생성
- 30일 후 재진단: 스케줄러 자동 (운영자 0)

### 12.2 자동화 불가 (운영자 직접 필수)

- 네이버 직접 입력 작업 (정책상 자동화 금지)
- 매장 콘셉트·차별화 청취 (1:1 상담)
- 콘텐츠 검수 (품질 직결)
- 사장님과의 신뢰 관계 형성

---

## 13. 리스크 대응

| 리스크 | 대응책 |
|--------|------|
| **네이버 ToS 위반 우려** | 사용자 본인 계정 부운영자 권한 위임 (네이버 공식 기능). 비밀번호 직접 받지 않음. 위임 동의서 필수 서명 |
| **점수 미변동 분쟁** | 환불 대신 무료 재작업 1회 보장. 약관 명시. 패키지 03만 적용 |
| **사용자 자료 누락** | 결제 후 7일 내 자료 미제출 시 자동 취소 + 환불 (스케줄러) |
| **외주 품질 관리** | 본인 5건 직접 작업 → SOP 매뉴얼 작성 → 외주 도입 시 매뉴얼 기준 검수 |
| **작업 결과 분쟁** | 모든 작업에 작업 전/후 스크린샷 의무 + JSONB로 DB 보존 |
| **Q&A 스팸·욕설** | 비로그인 작성 차단(Pro+ 무제한, Free·Basic 한도). 운영자 공개 전환 권한으로 자체 모더레이션 |
| **외주 도입 시 적자** | 외주 시급 25,000원 기준 모든 패키지 적자. BEP 50명 + 자동화 SOP 정착 후 가격 재검토. 그 전까지 운영자 1인 직접 작업만 |

---

## 14. 측정 KPI (출시 후 90일)

| 지표 | 목표 |
|------|------|
| 대행 주문 건수 | 30건 (정상가 기준, 1인 처리 한계 주 5건 × 6주) |
| 대행 매출 | 약 240만원 (정상가 평균 8만원 × 30건) |
| 후기 작성률 | 50% (15개 이상, 옵션 코칭 무료 인센티브 효과) |
| Q&A 게시판 활용 | 월 30건 이상 |
| 자동화 도구 사용량 | Pro 사용자의 50%가 월 1회 이상 |
| 종합 패키지 비율 | 전체 주문의 30% 이상 (가장 마진 좋음 — 시급 12,500원/h) |
| 30일 후 재진단 점수 변화 | 평균 +5점 이상 (긍정 사례 확보) |
| 자동화 도구 도입 후 작업 시간 단축률 | 50% 이상 (기존 4.4h → 2.6h 등) |

---

## 15. 다음 액션 (체크리스트)

### 사용자 (운영자) 직접 해야 할 것

- [ ] 카카오 비즈센터에서 알림톡 4종 신규 신청 (`AEOLAB_DELIVERY_01·02·03·04`) — Q&A는 이메일로 대체
- [ ] Supabase SQL Editor에서 신규 테이블 5개 생성 (Sprint별 분할: `delivery_orders`, `delivery_messages`, `support_tickets`, `support_replies`, `success_stories`)
- [ ] Supabase Storage **비공개 버킷** 생성 (`delivery-materials`, 사인드 URL 1시간)
- [ ] 토스페이먼츠 1회성 결제 상품 등록 (3종 패키지: 49,000 / 79,000 / 119,000원)
- [ ] 약관에 위임 동의 + 콘텐츠 등록 권한 위임 명시 (PDF·법무 검토는 BEP 50명 이후)
- [ ] 베타 시범 사용자 3~5명 모집 (Sprint 5 시작 전)
- [ ] SOP 작성 (본인 시범 5건 작업 후 — Sprint 5 결과)

### 개발 (Claude Code 에이전트로 자동 진행)

- [ ] **Sprint 1** → db-migrate (`delivery_orders`+`delivery_messages`) + backend-dev + frontend-dev 병렬
- [ ] **Sprint 2** → db-migrate (`support_tickets`+`support_replies`) + backend-dev + frontend-dev 순차
- [ ] **Sprint 3** → backend-dev (admin 엔드포인트·알림톡 트리거·30일 스케줄러) + frontend-dev (`/admin/delivery` 단순 목록)
- [ ] **Sprint 4** → db-migrate (`success_stories`) + frontend-dev (스토리·도구·랜딩 섹션)
- [ ] **Sprint 5** → 운영자 직접 시범 + 결과 큐레이션
- [ ] **Phase 2 (차후)** → 자동화 도구 4종 (BEP 5명+ 도달 시)

---

## 16. 부록 A — 사용자 거친 결정 이력 (변경 시 재논의 필요)

| 결정 항목 | 최종값 | 결정 이유 |
|---------|------|---------|
| 커뮤니티 형태 | 일반 X, **관리자 Q&A 한정** | 1인 운영 부담·임계 질량 부족 |
| 대행 형태 | **자체 1회성** | 파트너 매칭은 BEP 50명 이후 |
| 패키지 수 | **3종 + 옵션 1** | 사장님 자가진단 가능한 최소 단위 |
| 가격 책정 기준 | **시급 20,000원** | 소상공인 1초 결정 가격 |
| 01 가격 | **49,000원** | 시급 약 15,800원/h × 3.1h (시장 1회 등록 대행 55,000~99,000원 대비 50~89%) |
| 02 가격 | **79,000원** | 시급 약 17,950원/h × 4.4h (시장 정기 30만원/월 대비 26%, 1회성) |
| 03 가격 | **119,000원** | 시급 약 12,500원/h × 9.5h (개별 합산 -24.7% 할인, 시장 종합 60만~130만원/월 대비 10~20%) |
| 옵션 코칭 | 30,000원/회 | 시급 × 1.5h (상담 포함) |
| 결과 보장 | **재작업** (환불 X) | 부정 프레이밍 제거 |
| **출시 프로모션** | **없음** (2026-05-04 결정) | 50% 할인 시 모두 최저시급(11,000원) 미만 적자 |
| 외주 채용 | **불가** (현재 가격 기준) | 외주 시급 25,000원 시 전 패키지 적자. BEP 50명 이후 가격·외주 재검토 |
| 폐기 항목 | 사진 가이드 단독·웹 SEO 패키지 | 수요 부족·중복 |
| 부정 프레이밍 표현 | **전면 금지** | "노출 안 됨" 등 AEOlab 효능 부정 표현 |
| **자동화 도구** | **2종 즉시 + 2종 차후** (2026-05-04 최종) | 정적 데이터 2종(톡톡·답글 템플릿)은 Sprint 1 즉시(AI 호출 0, 1일 작업, 02 시급 ↑) / AI·엑셀 2종은 Phase 2 차후 |
| **대행 의뢰 게시판** | **신설** (2026-05-04 결정) | 비밀 게시판 + 상품 선택 + 의뢰 작성 + 결제 + 상태 추적(접수·진행·완료) 통합 |
| **카카오 알림톡** | 5종 → **4종** | Q&A 답변 알림은 이메일 대체. 대행 4종(접수·진행·완료·30일)만 유지 |
| **운영자 보드** | 칸반 → **단순 목록 + 필터** | 칸반 UI 개발 부담 ↓, 단순 목록으로 충분 |
| **위임 동의** | 전자서명 X | 단순 체크박스 + DB 기록 + 약관 명시 (출시 초기) |
| **수동 처리 영역** | 작업 전 상담·작업 진행 알림·스크린샷·코칭 예약·수정 요청 | 카카오톡으로 직접 (외부 도구 0건) |

---

## 17. 부록 B — 아이보스 분석 원본 데이터

### 17.1 아이보스 핵심 서비스 7종

1. 커뮤니티 (자유게시판·세미나·Q&A)
2. 정보공유 (검색·SNS·콘텐츠 마케팅)
3. 대행컨설팅 매칭 (D-day 기반 의뢰)
4. 대행사 디렉토리 (18×45×17 필터)
5. 교육 플랫폼 (44,000~400,000원, 온/오프라인)
6. 마케팅 자료실 (1,500+ PDF, 30개사 제공)
7. 마케팅 도구 (키워드조합기·캘린더·크롤링모니터·스크립트분석)

### 17.3 시장 가격 조사 결과 (2026-05-04 실측, 가격 결정의 근거)

#### 1회성 등록 대행

| 업체 | 가격 | 작업 범위 | 비고 |
|------|------|---------|------|
| 웹존 | 99,000원 | 위치·영업시간·메뉴 등록 | 3~5일, 재등록·수정 불가 |
| 일반 시장 | 55,000원 | 1회 등록 | 5~15일 |

#### 월 정기 마케팅 대행

| 업체 | 가격 | 작업 범위 |
|------|------|---------|
| 트리플아이 Standard | 30만원/월 | SEO + 컨설팅 + 리포트 + 1:1 케어 |
| 트리플아이 Pro | 60만원/월 | Standard + 검색광고 + 기자단 리뷰 12건 |
| 트리플아이 Premium | 130만원/월 | Pro + 댓글 관리 + 인스타·당근 광고 |
| 호미피온 | 10만원~/월 | 맞춤 견적 |

#### SEO 최적화 1회

| 항목 | 가격 |
|------|------|
| 일반 SEO 최적화 1회 | 60만~200만원 |

#### AEOlab vs 시장 가격 비율

| 패키지 | AEOlab | 시장 | 비율 |
|--------|--------|------|------|
| 01 등록 대행 | 49,000원 | 55,000~99,000원 (1회) | **50~89%** |
| 02 AI 최적화 | 79,000원 | 300,000원/월 (정기) | **26%** |
| 03 종합 풀패키지 | 119,000원 | 600,000~1,300,000원/월 + 60만원 SEO | **10~20%** |

**출처**: 웹존, 트리플아이, 호미피온, 마케SEO, 샤이닝, 에즈마케팅, 크몽 가격 안내 (2026-05-04 WebFetch)

### 17.2 AEOlab에 적용 가능한 것 (재정리)

| 요소 | 우선순위 | 본 문서 반영 |
|------|--------|---------|
| 무료 도구 (리드젠) | P1 | Sprint 5 — 키워드 생성기·광고비 계산기 |
| 시즌 마케팅 캘린더 | P1 | Sprint 5 — 대시보드 배너 |
| 자료실 (PDF 가이드) | P2 | Sprint 6+ (별도 기획) |
| 대행사 디렉토리 | P3 | BEP 50명 이후 (별도 기획) |
| 성공 사례 갤러리 | P2 | Sprint 5 — 대행 30일 결과 활용 |
| 커뮤니티 게시판 | 폐기 | 1인 운영 부담·임계 질량 부족 |
| 교육 플랫폼 | 폐기 | AEOlab 자체 매뉴얼(`/how-it-works`)로 대체 |

---

*문서 종료. 새 대화창에서 작업 시작 시 §0 트리거 명령 사용.*
