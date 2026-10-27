# 인기 가게 신뢰도 — 검증 사례 세트 (2026-10-27)

> `docs/popular_shop_trust_improvement_handoff_v1.0.md` §4 P1 진행 결과. 모든 항목은 서버(115.68.231.57) 코드·DB를 직접 읽어 확인한 값이다. 유형 A~F는 핸드오프 §1-2 분류.

## 0. §2 방어선 서버 존재 확인 (2026-10-27)

| 방어선 | 서버 위치 | 결과 |
|--------|-----------|------|
| 플레이스 ID 확정 | `services/naver_place_resolver.py`, `routers/business.py:107` `/resolve-place` | 있음 |
| 순위 재구현 | `services/naver_keyword_rank.py:151` `_place_card_rank` | 있음 |
| 접속 실패 ≠ 미노출 | `ai_scanner/naver_scanner.py:382`, `routers/scan.py:2165` | 있음 |
| 미측정 제외·재정규화 | `score_engine.py:1441` `_renormalized_track1`, `:508` `_is_naver_unmeasured` | 있음 |
| 한쪽 AI 실패 처리 | `score_engine.py:811`, `:827` | 있음 |
| 강점 신호 | `strength_signals.py:32`, `routers/report.py:2749` | 있음 |
| 카나리 잡 | `scheduler/jobs.py:5504`, 서버 `backend/.env` `RANK_CANARY` 설정됨 | 있음 (**실행 기록은 로그에서 못 찾음 — 미검증**) |
| 프론트 | `keywordBrand.ts`, `scoreMethodChange.ts`, `StrengthSignalsCard.tsx`, `ScoreMethodChangeNote.tsx`, `featureFlags.ts GEMINI_MEASUREMENT_LIVE=true` | 있음 |

## 1. 사례 1 — 어니언 성수 (카나리 가게, 플레이스 ID 38561949)

최신 스캔 2026-10-26 07:23 UTC 저장값: 종합 39.6 / 네이버 34.6 / 글로벌 54.5, 단계 "성장 중".

| 항목 | 저장값 | 판정 |
|------|--------|------|
| 리뷰 | 2,283건 수집, review_quality 100 | 정상 |
| 키워드 순위 | `measured:false` → 제외 | 정상(방어선 작동) |
| 네이버 AI 브리핑 | `error: PLAYWRIGHT_QUEUE_TIMEOUT`, ai_briefing_score 0, **제외 표시 없음** | **의심 → 아래 반증으로 기각** |
| ChatGPT | 50회 중 25회 노출(50%), 평균 2.1위 | 정상 |
| Gemini | 50회 중 42회 실패(known, 결제 연결 전) | 알려진 상태 |

### 의심 → 반증 (유형 A)
- **의심 근거**: 항목 점수로 역산하면 키워드 순위만 제외한 값(34.6)과 일치. AI 브리핑(가중치 25%)이 오류인데도 0점으로 합산된 것으로 보임.
- **반증**: 이 스캔은 `excluded` 로직 커밋 `6e29479`(10-26 20:43 KST) **이전**에 저장된 값. 현재 코드로 같은 입력을 재계산하면 `excluded=['ai_briefing_score','keyword_search_rank']`로 둘 다 제외(재계산 40.2, naver_data 빈 값 기준 근사). 커밋 이후 스캔(`9a8cdd…` 10-26 17:04 UTC)은 `excluded` 필드가 저장됨.
- **결론**: 현재 코드 결함 아님. 다음 스캔에서 갱신됨. 기록값 34.6은 수정 전 계산분.
- 단, 이 사례에서 **측정 실패 원인이 우리 쪽 큐 초과**(`PLAYWRIGHT_QUEUE_TIMEOUT`)였다는 점은 남음. 현재 `.env`는 `PLAYWRIGHT_QUEUE_TIMEOUT_SEC` 설정됨(값 비공개, 10-25 기록상 60초).

## 2. 확인된 문제 (근거 + 반증 시도)

### 문제 1 — 성장 단계 안내문에 점수 숫자가 노출됨 (점수 숫자 비노출 원칙 위반)
- **근거**: `gap_analyzer.py:~410` 경쟁사 점수가 있으면 `"지역 경쟁사 평균 {comp_avg}점 대비 당신은 {my_rounded}점 ({gap}점 차이)"`를 `focus_message`에 넣음. `GuideClient.tsx:1676`이 그대로 렌더. 서버에서 함수 직접 실행: `"지역 경쟁사 평균 49.6점 대비 당신은 34.6점 (15.0점 차이). …"`.
- **반증 시도**: ① 경쟁사 미등록·스마트플레이스 미등록이면 이 분기가 안 탐(숫자 없음) → 경쟁사가 있는 사용자만 해당. ② `simplify()`는 단계명만 치환, 숫자 제거 없음. ③ `demo/page.tsx:1015`는 하드코딩이라 숫자 없음. → 반증 실패, **경쟁사 등록한 사용자 화면에서 발생**.
- **유명 가게 관점**: "15.0점 차이"는 1위 가게 사장님에게 "경쟁사가 더 높다"로 읽힘(유형 A·D).

### 문제 2 — 이메일만 옛 단계명 + 점수 구간을 표시
- **근거**: `email_sender.py:722-725` `_STAGE_META` → "생존기 · 0~30점", "안정기 · 30~55점". 화면(DB 라벨·`score_engine._GROWTH_THRESHOLDS`)은 "시작 단계 / 성장 중 / 빠른 성장 / 지역 1등". `GuideClient.simplify()`가 같은 이유로 "생존기→시작 단계"를 치환 중.
- **반증 시도**: `email_sender.py:26` `_GROWTH_STAGE_KO`도 옛 이름. 이메일 경로(`growth_stage` 인자)는 체험 요약(`trial_summary`)에서 오므로 체험 사용자(첫 접점)가 받는 메일. 점수 구간 "0~30점"은 본인 점수가 아니라 단계 기준표이나 숫자 비노출 원칙의 취지에는 어긋남.
- 카카오 알림톡의 단계 이름(`jobs.py:1068`, `gap_analyzer._build_growth_stage().stage_label` = "생존기" 등)도 같은 옛 이름 — 알림톡은 승인 템플릿이라 **문구 변경 전 템플릿 변수 영향 확인 필요**(미확인).

### 문제 3 — 같은 단계가 화면마다 다른 이름
- 대시보드 배지: "시작 단계"(빨강 `bg-red-100`, `DualTrackCard.tsx:144`) / 가이드: `simplify`로 "시작 단계" / 이메일: "생존기" / 알림톡: "생존기" 가능성. 핸드오프 §3-7("생존 단계가 모욕적") 우려는 **화면에서는 이미 "시작 단계"로 완화돼 있고, 남은 곳은 이메일·알림톡·gap 원문**이다.
- 배지 색: 첫 단계는 빨강 — 유명 가게가 이 단계가 되는 경로는 현재 거의 없음(ID 자동 확정 + 재정규화 이후). 근거: 어니언 "성장 중", 7개 사업장 중 '시작 단계'는 2곳(모두 수정 전 09-28 스캔).

## 3. 아직 확인하지 못한 것
- 로그인 대시보드 실제 화면(핸드오프 §3-1) — 권한 분류기 제약 그대로.
- 카나리 일일 실행 결과 — 로그에서 `rank_canary` 흔적 없음. 다음 04:50 KST 이후 `pm2 logs`로 확인 필요.
- PC/모바일 순위가 네이버 직접 검색과 일치하는지 — 라이브 Playwright 요청이 필요해 이번엔 실행하지 않음.
- P2(순위 점수 연결·강점 임계값·전수 면책 점검)·P3는 이번 범위 밖.

## 4. 구현·배포 결과 (2026-10-27, git `ef30394` + 라벨 커밋)

### 배포한 것
- 점수: 순위 None(지역검색 5곳 한계)을 0점이 아닌 제외·환산 — `score_engine._smart_place_base_rank_aware`, `calc_local_map_score`. 8개 사업장 전후 단계 변화 없음.
- 화면 측정 실패 판정 통일: `frontend/lib/naverMeasure.ts` (`captcha_detected`/`error`/`quota_skipped`) — 기존 4곳은 캡차만 봄.
- 네이버 검색 칸 실측 우선: `frontend/lib/keywordExposure.ts` (서버 `strength_signals._keywords_item`과 동일 규칙, 8개 가게 대조 불일치 0).
- 상단 카드: "어떻게 조사했나요?" 접이식, 측정 못 한 항목 안내, 인과 문구("소개글 보강하면 가능") → "이번 측정 미노출 · 측정 시점 기준 · 노출 기준 미공개".
- 라벨 C안: "AI 검색 노출 미흡" → "AI 검색 준비도 · 보강 단계" (양호/개선 중/보강 단계/시작 전), 네이버 측정 일부 실패 시 단계 대신 "일부 항목 측정 전". 프론트 2곳(`DashboardHeroCard.getStage`, `lib/scoreLabels.getStageView`) + 백엔드 이미지 카드 2곳(`share_card`, `before_after_card`, 월간 이미지는 share_card 함수 재사용). Pillow로 4단계 렌더 확인(글자 넘침 없음).

### 판단 근거와 한계
- 점수는 인기를 거의 구분하지 못함(어니언 vs 리뷰 45건 가게 2.8점 차) → 라벨 이름을 "준비도"로, 등급어 "미흡" 제거. 반응 추정이며 **실사용자(인기 가게 사장님) 확인 전**.
- 최근 30일 스캔 36건 중 네이버 측정 실패 1건(3%) — 대부분의 "미노출"은 정상 측정 결과. 인기 가게도 실제로 브리핑 미노출일 수 있음.
- 로그인 대시보드 실화면 미확인(코드·실데이터 추적만).

### 남은 것
- 홈페이지 "URL 없음" 0점 처리(미등록 vs 측정 불가 구분): 홈페이지 없는 전 가게 글로벌 점수가 크게 오르는 문제로 보류 — 별도 결정 필요.
- 공유 이미지의 "업종 평균 이하" 문구(share_card)는 별도 판정 표현 — 미변경.
- 모바일 줄바꿈·접이식 설명 실화면 확인, 인기 가게 사장님 2~3분 반응 확인.
