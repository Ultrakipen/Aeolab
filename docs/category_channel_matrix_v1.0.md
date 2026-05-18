# 25개 업종별 노출 채널 매트릭스 v1.0

> **작성일: 2026-05-18 | 본 문서는 `docs/naver_ai_search_optimization_plan_v1.0.md` 부록**
>
> 25개 화이트리스트 업종 각각에 대해 (1) 네이버 AI 브리핑 게이팅, (2) AI탭 노출 가능성, (3) 글로벌 AI 비중, (4) 콘텐츠 매핑 상태, (5) 핵심 행동 5요소를 단일 표로 통합.
>
> **활용**: 신규 사용자 등록 시 업종별 안내 분기 / 가이드 페이지 자동 생성 / 점수 가중치 조정 근거.

---

## 0. 그룹 요약

| 그룹 | 업종 수 | AI 브리핑 | AI탭 | 듀얼트랙 (naver/global) | 콘텐츠 매핑 |
|------|---------|-----------|------|------------------------|------------|
| **A 양면 ACTIVE** | 5 | ACTIVE | 우선 노출 | 65~70 / 30~35 | 완비 |
| **B AI탭 우선** | 12 | LIKELY (확대 대기) | 베타 가능 | 55~65 / 35~45 | 부분 완비 |
| **C AI탭 중심, 매핑 완료** | 10 | INACTIVE | 가능 | 35~55 / 45~65 | 완비 (`ai_tab_context` 있음) |
| **D AI탭 가능, 매핑 미완성** | ~10 | INACTIVE | 이론상 가능 | 10~35 / 65~90 | **미완성** (M2-1 보강 대상) |
| **E 글로벌 AI 중심** | 1 | INACTIVE | 낮음 | 0 / 100 | 해당 없음 |

---

## 1. Group A — 양면 ACTIVE (5개)

| 업종 | normalize 키 | 브리핑 | AI탭 | naver/global | 핵심 행동 5요소 |
|------|------------|--------|------|--------------|-----------------|
| restaurant | restaurant | ACTIVE | 우선 | 70/30 | 메뉴 사진10+ · 룸 정보 · 주차 · 예약 연동 · 운영시간 |
| cafe | cafe | ACTIVE | 우선 | 65/35 | 분위기 사진 · 메뉴판 · 좌석/공간 · 운영시간 · 동반자(아이/펫) |
| bakery | cafe (alias) | ACTIVE | 우선 | 65/35 | 빵 종류 사진 · 일일 입고 · 포장/매장 · 운영시간 · 인기 메뉴 |
| bar | restaurant (alias) | ACTIVE | 우선 | 70/30 | 메뉴/주류 사진 · 분위기 · 룸 · 운영시간 · 예약 연동 |
| accommodation | accommodation | ACTIVE | 우선 | 60/40 | 객실 사진 · 시설 · 다이닝 · 액티비티 · 예약 연동 |

**공통 우선순위**: 예약 연동 시 AI탭 결과에 **예약 버튼 즉시 노출** → 전환 효과 최상.

---

## 2. Group B — AI탭 우선, AI 브리핑 확대 대기 (12개)

| 업종 | normalize 키 | 브리핑 | AI탭 | naver/global | 핵심 행동 5요소 |
|------|------------|--------|------|--------------|-----------------|
| beauty | beauty | LIKELY | 베타 | 65/35 | 시술 사진 · 자격증 · 가격대 · 예약 연동 · 후기 |
| nail | nail (alias) | LIKELY | 베타 | 60/40 | 디자인 사진 · 가격대 · 예약 · 운영시간 · 후기 |
| skincare | skincare | LIKELY | 베타 | 60/40 | 시술 종류 · 자격 · 가격 · 예약 · 후기 |
| massage | massage | LIKELY | 베타 | 60/40 | 마사지 종류 · 가격 · 예약 · 운영시간 · 분위기 |
| spa | spa | LIKELY | 베타 | 60/40 | 시설 사진 · 프로그램 · 가격 · 예약 · 부대시설 |
| pet | pet | LIKELY | 베타 | 65/35 | 시설 사진 · 서비스 종류 · 가격 · 예약 · 동물병원 자격 |
| fitness | fitness | LIKELY | 베타 | 60/40 | 시설 · 프로그램 · 가격 · 예약 · 트레이너 자격 |
| yoga | yoga | LIKELY | 베타 | 55/45 | 수업 종류 · 강사 · 가격 · 예약 · 후기 |
| pharmacy | pharmacy | LIKELY | 베타 | 70/30 | 운영시간 · 야간 운영 · 위치 · 상담 가능 · 처방전 |
| dance | dance | LIKELY | 베타 | 55/45 | 수업 종류 · 강사 · 가격 · 예약 · 발표회 |
| ballet | ballet | LIKELY | 베타 | 55/45 | 수업 · 강사 · 가격 · 예약 · 연령대 |
| semi_permanent | semi_permanent | LIKELY | 베타 | 60/40 | 시술 · 자격 · 가격 · 예약 · 후기 |

**공통 우선순위**: AI 브리핑 확대 대기 중 → AI탭 + 글로벌 AI 동시 준비. 예약 연동 핵심.

---

## 3. Group C — AI탭 중심, 콘텐츠 매핑 완료 (10개)

| 업종 | normalize 키 | 브리핑 | AI탭 | naver/global | 핵심 행동 5요소 | ai_tab_context |
|------|------------|--------|------|--------------|-----------------|---------------|
| medical | clinic | INACTIVE | 가능 | 55/45 | 진료시간 · 전문분야 · 예약 · 후기 · 의사 경력 | ✅ |
| dental | clinic (alias) | INACTIVE | 가능 | 55/45 | 진료시간 · 시술분야 · 예약 · 후기 · 가격대 | ⚠️ alias 검증 필요 |
| oriental_medicine | clinic (alias) | INACTIVE | 가능 | 55/45 | 진료시간 · 한방분야 · 예약 · 후기 · 한약 가격 | ⚠️ alias 검증 필요 |
| legal | legal | INACTIVE | 가능 | 20/80 | 전문분야 · 경력 · 상담방식 · 후기 · 비용 | ✅ |
| accounting | legal (alias) | INACTIVE | 가능 | 25/75 | 전문분야 · 경력 · 상담 · 후기 · 비용 | ⚠️ alias 검증 필요 |
| education | academy | INACTIVE | 가능 | 40/60 | 커리큘럼 · 강사 · 가격 · 시간표 · 합격률 | ✅ |
| tutoring | academy (alias) | INACTIVE | 가능 | 40/60 | 과목 · 강사 · 가격 · 시간 · 후기 | ⚠️ alias 검증 필요 |
| realestate | realestate | INACTIVE | 가능 | 65/35 | 매물 종류 · 지역 전문 · 경력 · 후기 · 운영시간 | ✅ |
| interior | interior | INACTIVE | 가능 | 55/45 | 시공 분야 · 공간 유형 · 견적 · 포트폴리오 · A/S | ✅ |
| fashion | fashion | INACTIVE | 가능 | 30/70 | 브랜드/스타일 · 상품 구색 · 쇼핑 경험 · 운영 · 가격 혜택 | ✅ |

**공통 우선순위**: AI탭 노출 + 글로벌 AI 비중 높음. 의료/세무/법무는 **금융·헬스케어 특화 AI 브리핑 도입 시 LIKELY 즉시 승급 후보**.

---

## 4. Group D — AI탭 가능, 콘텐츠 매핑 미완성 (~10개, M2-1 보강 대상)

| 업종 | normalize 키 | 브리핑 | AI탭 | naver/global | 권장 행동 5요소 (M2-1로 추가) |
|------|------------|--------|------|--------------|------------------------------|
| optics | optics | INACTIVE | 가능 | 50/50 | 안경 종류 · 가격 · 시력 검사 · 운영시간 · 후기 |
| martial_arts | martial_arts | INACTIVE | 가능 | 45/55 | 종목 · 사범 · 가격 · 시간표 · 연령대 |
| climbing | climbing | INACTIVE | 가능 | 40/60 | 시설 · 난이도 · 가격 · 운영 · 강습 |
| art_class | art_class | INACTIVE | 가능 | 35/65 | 분야 · 강사 · 가격 · 시간 · 작품 발표 |
| childcare | childcare | INACTIVE | 가능 | 55/45 | 시설 · 보육 시간 · 비용 · 식단 · 안전 |
| car_wash | car_wash | INACTIVE | 가능 | 50/50 | 종류 · 가격 · 예약 · 운영시간 · 옵션 |
| electronics_repair | electronics_repair | INACTIVE | 가능 | 50/50 | 수리 종류 · 가격 · 운영시간 · 출장 · 후기 |
| footwear | footwear | INACTIVE | 가능 | 35/65 | 브랜드 · 종류 · 가격 · 매장 · 운영시간 |
| stationery | stationery | INACTIVE | 가능 | 40/60 | 상품 종류 · 가격 · 운영시간 · 결제 · 위치 |
| norebang | norebang | INACTIVE | 가능 | 60/40 | 룸 종류 · 시간당 가격 · 음식/주류 · 운영시간 · 예약 |
| billiards | billiards | INACTIVE | 가능 | 55/45 | 테이블 · 시간당 가격 · 운영시간 · 음식 · 분위기 |
| photo | photo | INACTIVE | 가능 | 65/35 | 촬영 분야 · 가격 · 포트폴리오 · 예약 · 운영 |
| video | video | INACTIVE | 가능 | 55/45 | 영상 유형 · 가격 · 포트폴리오 · 일정 · 후기 |
| design | design | INACTIVE | 가능 | 35/65 | 디자인 분야 · 가격 · 포트폴리오 · 일정 · 후기 |
| auto | auto | INACTIVE | 가능 | 50/50 | 서비스 · 가격 · 운영시간 · 예약 · 후기 |
| cleaning | cleaning | INACTIVE | 가능 | 45/55 | 청소 종류 · 가격 · 예약 · 출장 · 후기 |
| laundry | laundry | INACTIVE | 가능 | 50/50 | 종류 · 가격 · 운영시간 · 출장 · 옵션 |
| shopping | shopping | INACTIVE | 가능 | 10/90 | 상품 종류 · 가격 · 배송 · 후기 · 적립 |
| clothing | fashion (alias) | INACTIVE | 가능 | 30/70 | 의류 종류 · 가격 · 사이즈 · 매장 · 운영 |
| flower | flower | INACTIVE | 가능 | 50/50 | 꽃 종류 · 가격 · 배송 · 예약 · 운영 |
| kids | kids | INACTIVE | 가능 | 50/50 | 프로그램 · 강사 · 가격 · 시간 · 안전 |
| study | study | INACTIVE | 가능 | 40/60 | 좌석 · 가격 · 운영시간 · 부대시설 · 위치 |
| workshop | workshop | INACTIVE | 가능 | 35/65 | 분야 · 강사 · 가격 · 일정 · 결과물 |
| music_class | music_class | INACTIVE | 가능 | 45/55 | 악기 · 강사 · 가격 · 시간 · 발표회 |
| music_lesson | music_class (alias) | INACTIVE | 가능 | 45/55 | 악기 · 강사 · 가격 · 시간 · 후기 |
| cooking | cooking | INACTIVE | 가능 | 45/55 | 종류 · 강사 · 가격 · 일정 · 식자재 |
| experience | experience | INACTIVE | 가능 | 40/60 | 체험 종류 · 가격 · 예약 · 인원 · 후기 |

**M2-1 작업**: 각 업종에 `ai_tab_context` 그룹 (weight 0.05, 키워드 5~10개) 추가.

---

## 5. Group E — 글로벌 AI 중심 (1개)

| 업종 | normalize 키 | 브리핑 | AI탭 | naver/global | 권장 행동 |
|------|------------|--------|------|--------------|-----------|
| other | restaurant (강제 inactive) | INACTIVE | 낮음 | 0/100 | 사업장 정보 정확 입력 + ChatGPT/Gemini 인용 강화 |

---

## 6. 매트릭스 활용 가이드

### 사용자 등록 시 (RegisterBusinessForm)
1. 업종 선택 → `get_briefing_eligibility()` + `get_ai_tab_eligibility()` 호출
2. 그룹 자동 분류 → 그룹별 안내 메시지 표시 (Group A: "AI 브리핑 + AI탭 양면 ACTIVE" / Group D: "AI탭 중심, 콘텐츠 보강 권장")
3. 핵심 행동 5요소를 등록 폼 다음 단계에 체크리스트로 제공

### 가이드 페이지 자동 생성 (M2-4)
- `/guide/channels/[category]` 동적 라우트 (25개 SSG)
- 각 페이지에 본 매트릭스의 한 행을 풀 페이지로 펼침

### 점수 가중치 결정 (M3-2)
- 그룹별 `naver_ai_tab_visible` 가중치 차별화 근거로 사용
- Group A: 0.05 / Group B: 0.10 / Group C·D: 0.15

### 신규 업종 추가 시
1. `WHITELIST_25`에 추가
2. `score_engine.py` BRIEFING_*_CATEGORIES 분류
3. `keyword_taxonomy.py`에 그룹 + `ai_tab_context` 추가
4. 본 매트릭스에 행 추가
5. `tests/test_category_alias.py` 통과 확인

---

## 7. 변경 이력

| 일자 | 변경 |
|------|------|
| 2026-05-18 | v1.0 신규 작성 (25개 업종 5그룹 분류 + 행동 5요소) |

---

*다음 갱신: M2-1 Group D `ai_tab_context` 추가 완료 시 / 금융·헬스케어 LIKELY 승급 시*
