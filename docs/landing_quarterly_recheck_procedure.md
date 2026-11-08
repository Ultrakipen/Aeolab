# 랜딩 근거 분기 재확인 절차 (2026-11-08 작성)

> 랜딩·FAQ·비교표의 외부 사실은 시간이 지나면 낡는다. 분기마다(또는 가격·정책 변경 소식이 있을 때) 아래를 같은 방식으로 다시 확인한다.
> 확인하지 못한 항목은 문구를 지우거나 "조사 시점 N월, 현재 미공개"처럼 날짜와 한계를 적는다(추정을 사실처럼 쓰지 않기).

## 1. 비교표(`components/landing/AEOCompareSection.tsx`)
| 칸 | 확인 방법 | 2026-11-08 결과 |
|---|---|---|
| 기업·컨설팅형 가격 "월 19만 원대부터" | 해당 유형 서비스 1곳의 공개 가격 페이지(AGEO)를 직접 열어 Lite 월 가격 확인 | Lite 199,000·Pro 790,000 확인(2026-11-08). 대상 고객은 페이지에 명시 없음("브랜드") |
| 블로그 전용 진단 가격 "무료~월 2만 원대" | 해당 유형 서비스 사이트의 요금 | 2026-11-08 사이트에 요금 정보 없음(홈과 같은 페이지) → "7월 조사, 현재 가격 미공개"로 표기. 채널은 네이버 블로그 한 곳, "네이버 AI 브리핑" 언급 있음 |
| 무료 자가진단 "네이버 AI 대체로 다루지 않음" | `docs/aeolab_strategic_direction_v1.0.md` §1 유형 B 서비스 재조회 | 07-20 조사값, 재확인 전 |
- 서비스 이름은 화면에 쓰지 않는다(법적 위험·낡음 방지). 기준·한계 문구의 날짜를 확인한 달로 고친다.
- 같은 값이 `FAQSection.tsx`("월 19만 원대")에도 있다 — 함께 고친다.

## 2. 네이버 관련 날짜 표기("2026-11-08 확인", 9곳)
- `blog.naver.com`·`map.naver.com`·`cafe.naver.com`의 `robots.txt`에서 GPTBot·OAI-SearchBot 차단 여부 확인(`curl -s -A "Mozilla/5.0" https://<도메인>/robots.txt`). 바뀌었으면 "ChatGPT 같은 AI가 가져가지 못하게 막아 두었어요" 문구 전체를 고친다(`grep -rn "확인)" frontend/app frontend/components`).

## 3. 네이버 발표 수치(증거 섹션, `app/page.tsx`)
- AI탭 누적 사용자(현재 "400만+ 베타 2개월", 정식 출시 시점 수치): 후속 발표(방송사 헤드라인 "1,000만 돌파" 2026-07-15)가 있으나 본문 미확인.
- AI 브리핑 월 이용자 "3,000만+ (2025.11)": 2026-07-15 기사에서 "월 3천만 명 이상" 확인(날짜 표기 갱신 여부는 판단).
- "업종 확대 계획": 2025-08 발표만 확인, 이행 현황 미확인 → "계획이라고 밝혔습니다(적용 현황은 네이버 공지 기준)".
- AI 브리핑 광고(2026-04 테스트 보도): 플레이스형 적용 여부 미확인.

## 4. 전환·계측
- `cd /var/www/aeolab/backend && PYTHONPATH=. venv/bin/python -c "from dotenv import load_dotenv; load_dotenv('.env'); import runpy; runpy.run_path('scripts/trial_funnel_readonly.py', run_name='__main__')"` (`.env`를 source하지 않는다).
- 기준선(2026-11-08): 체험 267건 중 다량 IP(>3회) 제외 57건·고유 IP 41개, 이메일 입력 21, 결과 저장 2, **가입 연결 0**, 10-13 이후 제외 후 월 7건 안팎. 표본이 작아 방향 참고용.
- GA4 이벤트: `scroll_depth`(25/50/75/100), `landing_section_view`(`section_index`·`section_label`·`viewport`). 섹션 번호는 순서에 의존하므로 라벨 기준으로 본다. **랜딩 세션 수는 아직 미확인** — 유입 부족인지 전환 부족인지 가르는 데 필요하다.

## 5. 문구 회귀 방지
- 새 문구는 `backend/tests/test_frontend_no_unverified_ai_claims.py`의 금지 목록(결과 약속·기간 단정·근거 없는 평균)에 걸리지 않게 쓴다. 서버 테스트가 `frontend` 폴더를 읽으므로 **프론트를 먼저 배포한 뒤 백엔드 테스트를 배포**한다.
- 알림톡·화면에서 변화 방향(▲/▼·상승/하락)을 말할 때는 `stage_names.headline_direction` 규칙(큰 변화 10점 이상, 또는 등급 변경 + 3점 이상)을 따른다. 알림 쪽 단일 구현은 `services/kakao_notify._weekly_direction`·`_grade_change`, 격자 대조 테스트 `tests/test_weekly_direction_noise.py`.

## 6. 작업 함정 (이 작업에서 겪음)
- `while read` 루프 안의 `ssh`는 stdin을 먹어 첫 파일만 올린다 → `ssh -n` 또는 배열 `for`를 쓴다.
- CI 성공 확인은 푸시한 커밋의 `headSha`와 일치하는 실행을 찾아서 한다(직전 실행을 읽는 오류).
- 점검용 Playwright 브라우저는 개발자 계정으로 로그인돼 있어 비로그인 헤더를 못 본다. 접힘 버튼 일괄 클릭은 계정 드롭다운도 연다.
- 모바일 슬라이드 등장 카드(`translateX`)는 등장 전 페이지를 가로로 넘치게 한다 → 모바일은 `translateY`(globals.css).
