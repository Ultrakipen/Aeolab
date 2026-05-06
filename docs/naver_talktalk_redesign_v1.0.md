# 네이버 톡톡 채팅방 메뉴 개편 + 스마트플레이스 Q&A 폐기 대응 — v1.0

> **작성일**: 2026-05-01
> **계기**: 사용자(베타 1호) 실측 결과 두 가지 사실 확인
>   - **톡톡 파트너센터** "FAQ" → **"채팅방 메뉴 관리"** 대메뉴 개편 (2024.02.14 공식 공지, AEOlab 미반영 상태)
>   - **스마트플레이스 `/qna` URL 사망** — 사장님 Q&A 탭 자체가 좌측 메뉴/직접 URL 모두 사라짐
> **상태**: 작업 진행 중 (B+ 안)
> **목적**: 실제 동작하지 않는 안내·점수·딥링크를 정리하고 신규 채팅방 메뉴 사양을 반영

---

## 0. 한 줄 요약
사용자가 **본인 스마트플레이스 좌측 메뉴**와 **톡톡 파트너센터 → 채팅방 메뉴 관리** 화면을 직접 확인한 결과, AEOlab이 가정한 옛 "사장님 Q&A 탭" 경로는 **현재 네이버 운영에 존재하지 않음**을 확인. 톡톡 FAQ는 12개 텍스트형 / 1단(3개)·2단(6개) 아이콘형 + 메시지/URL 동작을 선택할 수 있는 **채팅방 메뉴**로 대체됨. 본 작업은 (1) 죽은 URL/안내 정리, (2) 점수 모델 영향 차단, (3) 신규 채팅방 메뉴 사양 반영, (4) 매뉴얼 문구 일관화의 4축.

---

## 1. 사용자 실측 핵심

### 1-1. 스마트플레이스 좌측 메뉴 (2026-05-01 사용자 스크린샷)
```
업체정보 / 예약 / 스마트콜 / 마케팅 / 리뷰
고객 / 통계 / 비즈니스 스쿨 / 금융지원 / 솔루션
문의 채널 ▾
```
- **'Q&A' 또는 '사장님 Q&A' 항목 없음**
- `https://smartplace.naver.com/bizes/{id}/qna` **직접 URL도 작동 안 함**

### 1-2. 톡톡 파트너센터 → 채팅방 메뉴 관리 (2026-05-01 사용자 스크린샷)
- 좌측 트리: 프로필 관리 / 상담관리 / 요청서 관리 / 마케팅관리 / **채팅방 메뉴관리** / 자동응대관리 / 설정 / 통계 / 연동 관리
- 안내문: "**채팅방 하단에 노출되며, 메뉴 클릭시 메시지가 전송되거나 URL이 실행됩니다.**"
- **유형**: 아이콘 2단(6개) / 아이콘 1단(3개) / **텍스트(최대 12개)**
- **메뉴명 6자 제한**
- **클릭 동작**: 메시지 전송 / **URL 실행** 둘 중 선택
- **배경색**: 기본 컬러 15종 + 컬러코드 직접 입력
- **메시지 내용**: 이미지 + 텍스트 + 버튼(URL) 조합

### 1-3. 추정 — 사장님이 직접 작성해 AI 브리핑 인용 후보가 되는 텍스트
| 채널 | 상태 | AI 브리핑 인용 후보 |
|---|---|---|
| 스마트플레이스 **소개글** | 활성 | ✅ 가장 직접 |
| 스마트플레이스 **소식** | 활성 | ✅ |
| 스마트플레이스 **리뷰 답변** | 활성 | ✅ |
| 스마트플레이스 **사장님 Q&A** | **❌ 폐기 추정** | ❌ |
| 톡톡 **채팅방 메뉴** | 신규 활성 | ❌ (챗봇 UI 내부 한정) |

→ 사장님이 직접 컨트롤 가능한 AI 브리핑 인용 경로는 **소개글 / 소식 / 리뷰 답변 3가지**로 좁혀짐. 소개글 안에 Q&A 5개를 자연스럽게 포함하는 전략이 사실상 유일한 "Q&A 직접 인용" 경로.

---

## 2. 코드베이스 영향 범위

### 2-1. 백엔드
| 파일 | 영향 항목 | 현재 코드 | 필요 조치 |
|---|---|---|---|
| `backend/services/briefing_engine.py` | `_SMARTPLACE_PATHS["faq"]="qna"` (L:32) | 죽은 URL 생성 중 | 키 삭제 또는 `intro_qa`로 의미 전환 |
| `backend/services/briefing_engine.py` | `_ACTION_STEPS["faq"]` (L:56-61) | "사장님 Q&A 탭" 안내 — **잘못된 안내** | "소개글에 Q&A 포함" 또는 "톡톡 채팅방 메뉴" 분리 안내 |
| `backend/services/briefing_engine.py` | "직접 인용합니다" 단정 표현 (L:60 등) | 정직 원칙 위반 가능 | "직접 인용 후보입니다" 톤다운 |
| `backend/services/smart_place_auto_check.py` | `_detect_faq()` + `/qna` 탭 크롤링 (L:188-199, 276-288) | **항상 False 반환** → 점수 왜곡 | 제거. `has_faq` 결과 키 자체 deprecated 또는 None |
| `backend/services/smart_place_auto_check.py` | `_calc_score_loss()` `has_faq` 25점 손실 (L:56-57) | 모든 사용자 25점 손실 | 점수 재배분 (소개글·소식 가중) |
| `backend/services/score_engine.py` | `has_faq`/`talktalk_faq_draft` (L:234-241, 372-379) | 이미 일부 재배분 처리되어 있으나 일관성 부족 | `has_faq` 가중치 명시적으로 0 + 주석 갱신 |
| `backend/services/guide_generator.py` | `_TALKTALK_FAQ_PROMPT_TMPL` (L:1239-1266) | 5개 메뉴 권장, URL 옵션 없음 | **6개 메뉴 (아이콘 2단 권장) + 메뉴명 6자 제한 + link_type/url 필드 + 메시지 내용 초안** |
| `backend/routers/guide.py` | `/smartplace-faq` 응답 구조 (L:608-711) | `{items, chat_menus[]}` 단순 | `chat_menus[].link_type, .url, .message` 확장 |

### 2-2. 프론트엔드
| 파일 | 영향 항목 | 필요 조치 |
|---|---|---|
| `frontend/components/dashboard/TalktalkFAQGeneratorCard.tsx` | 카드 명칭 "톡톡 FAQ", chat_menus 5개 가정, message-only | 명칭 **"톡톡 채팅방 메뉴 자동 생성"**, 6개, link_type 토글 표시, "톡톡 파트너센터 → 채팅방 메뉴관리" 정확 안내 |
| `frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx` | 단계 3-b "톡톡 FAQ 등록" + "스마트플레이스 톡톡 FAQ" 표현 (L:170-220) | "**톡톡 채팅방 메뉴 등록 (선택)**"으로 명칭 변경. "Q&A 직접 인용" → "Q&A 인용 후보" 톤다운 |
| `frontend/app/(public)/how-it-works/page.tsx` | "톡톡 FAQ 자동 생성" 카드 (L:348-366), "FAQ 직접 인용" 표현 (L:355) | 명칭/문구 갱신, 톡톡 메뉴는 챗봇 UI 한정임을 명시 |
| `frontend/app/(public)/how-it-works/page.tsx` | "Q&A 5개" 인용 추정 표현 (L:230-238) | 소개글 안 Q&A 섹션이 핵심 경로임을 강조하는 표현으로 재작성 |
| `frontend/components/dashboard/IneligibleBusinessNotice.tsx` | 잠재 영향 — 검토 | "사장님 Q&A 등록" 안내가 있다면 제거 |
| `frontend/app/(public)/trial/components/TrialResultStep.tsx` | 잠재 영향 — 검토 | 동상 |

### 2-3. DB
- 변경 없음. `talktalk_faq_draft JSONB` 컬럼 구조는 신규 사양과 호환 (items + chat_menus 확장 필드 추가만으로 충분).
- `businesses.has_faq` 컬럼은 폐기 대상이지만 컬럼 삭제는 보류 — 하위 호환을 위해 컬럼은 유지하되 항상 False/None로 기록.

---

## 3. 작업 우선순위

### 🔴 P0 — 죽은 동작/허위 안내 차단
1. **`smart_place_auto_check.py` `/qna` 탭 크롤링 제거** — 항상 실패하므로 자원 낭비 + 점수 왜곡
2. **`briefing_engine.py` `_SMARTPLACE_PATHS["faq"]` 삭제** + 호출부 안내 문구 교체
3. **5단계 가이드/매뉴얼의 "스마트플레이스 Q&A 등록" 표현** 일괄 제거 또는 "소개글 Q&A 섹션"으로 의미 전환
4. **"FAQ 직접 인용합니다" 단정 표현** → "인용 후보" 톤다운

### 🟡 P1 — 톡톡 채팅방 메뉴 신규 사양 반영
5. **`_TALKTALK_FAQ_PROMPT_TMPL` 재설계** — 6개 메뉴 + 메뉴명 6자 제한 + `link_type: "message" | "url"` + 권장 URL (예: 네이버 예약·블로그·홈페이지) + 메시지 내용 초안
6. **`TalktalkFAQGeneratorCard` UI 재설계** — "톡톡 채팅방 메뉴 자동 생성" 명칭, 6개 카드 + 메시지/URL 배지, "톡톡 파트너센터 → 채팅방 메뉴관리" 안내
7. **응답 구조 확장** — `routers/guide.py` 응답 모델에 `link_type/url/message` 필드 추가 (Optional)

### 🟢 P2 — 점수 일관성/검증
8. **`score_engine.py` `has_faq` 가중치 0 명시 + 주석 갱신** (이미 25점 흡수 처리되어 있으나 코드 의도 명확화)
9. **베타 1명 점수 시뮬레이션** — 변화 폭 측정 후 changelog 명시

---

## 4. 결정 — 보류 사항

- **`businesses.has_faq` 컬럼 삭제 여부** → 하위 호환 위해 유지. 추후 사용 0 확인 후 6개월+ 시점에 ALTER 검토.
- **`_FAQ_TEMPLATES` / `_FAQ_QUESTIONS` 콘텐츠** → 콘텐츠 자체는 유효 (질문 표현이 자연 구어체로 검증됨). 사용처를 **소개글 Q&A 섹션 + 톡톡 채팅방 메뉴 메시지 내용**으로 전환만 하고 콘텐츠는 유지.
- **JSON-LD `FAQPage` 스키마 (`schema_generator.py`)** → 웹사이트 메타에 삽입하는 용도이므로 네이버 백오피스와 무관. **유지**.

---

## 5. 작업 진행 로그

| 일시 | 항목 | 상태 | 비고 |
|---|---|---|---|
| 2026-05-01 | 컴플라이언스 문서 v1.0 작성 | ✅ 완료 | 본 문서 |
| 2026-05-01 | P0 백엔드 정리 | ⏳ 진행 | backend-dev 위임 |
| 2026-05-01 | P1 채팅방 메뉴 사양 반영 (백엔드) | ⏳ 진행 | backend-dev 위임 |
| 2026-05-01 | P1 채팅방 메뉴 사양 반영 (프론트엔드) | ⏳ 대기 | frontend-dev 위임 예정 |
| 2026-05-01 | P0 매뉴얼/가이드 문구 정리 | ⏳ 대기 | frontend-dev 위임 예정 |
| 2026-05-01 | P2 점수 일관성/시뮬레이션 | ⏳ 대기 | code-review |
| 2026-05-01 | 서버 배포 + 헬스체크 | ⏳ 대기 | deploy |

---

## 6. 검증 절차 (배포 전 체크리스트)

### 6-1. 코드
- [ ] `grep -r "qna" backend/services/` → 의도된 사용처만 남는지 확인
- [ ] `python -m py_compile backend/services/briefing_engine.py smart_place_auto_check.py score_engine.py guide_generator.py` → 0 오류
- [ ] `npx tsc --noEmit` (frontend) → 0 오류
- [ ] `pm2 logs aeolab-backend` 60초 모니터 → import/NameError 0건

### 6-2. 동작
- [ ] `POST /api/guide/{biz_id}/smartplace-faq` 응답에 `chat_menus[].link_type` 필드 포함
- [ ] 대시보드 "톡톡 채팅방 메뉴 자동 생성" 카드 정상 렌더 (6개 메뉴, 메시지/URL 배지)
- [ ] `/how-it-works` "FAQ 직접 인용" 문구 0건
- [ ] `/guide/ai-info-tab` 단계 3-b 명칭 "톡톡 채팅방 메뉴" 확인
- [ ] 기존 사용자(`talktalk_faq_draft` 5개 저장됨)도 신규 카드에서 마이그레이션 없이 표시되는지 (link_type 미저장 → 기본 "message" 표시)

### 6-3. 점수
- [ ] 베타 1호(현재 Track1 ~31.6) 변화 폭 ±5점 이내인지 측정
- [ ] `score_history` 30일 데이터에 급변 없는지 확인 (스케줄러 재실행 전)

---

## 7. 핵심 파일 빠른 참조

```
backend/services/briefing_engine.py   _SMARTPLACE_PATHS, _ACTION_STEPS, _FAQ_*
backend/services/smart_place_auto_check.py   _detect_faq, _calc_score_loss
backend/services/score_engine.py   calc_smart_place_completeness
backend/services/guide_generator.py   _TALKTALK_FAQ_PROMPT_TMPL, generate_talktalk_faq
backend/routers/guide.py   /smartplace-faq 엔드포인트
frontend/components/dashboard/TalktalkFAQGeneratorCard.tsx
frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx
frontend/app/(public)/how-it-works/page.tsx
```

## 8. CLAUDE.md 업데이트 필요 항목 (작업 완료 후)

- 카카오 알림톡 5종 옆에 "톡톡 채팅방 메뉴 6개" 신규 사양 명시
- "최근 업데이트" 섹션에 본 문서 링크 + 변경 요약 추가
- "남은 작업"에 P3 (`avg_rating` 컬럼 등) 분리 명시

*최종 업데이트: 2026-05-01 v1.0*
