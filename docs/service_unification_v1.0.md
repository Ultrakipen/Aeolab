# AEOlab 서비스 통합 재편 기획서 v1.1

> 작성일: 2026-04-30 (v1.1 — 실측·사실 기반 재검토 반영)
> 상태: 기획 확정 후 (#1~#3 확정, #4~#8 권장안 대기)
> 선행 문서: `model_engine_v3.0.md`, `ai_briefing_implementation_plan_v2.0.md`, `session_summary_20260430_naver_briefing_v4.1.md`
> 후속 문서: 확정 시 `model_engine_v3.1.md` (가중치 재설계), `service_unification_implementation_v1.0.md` (구현 로드맵)
> v1.0 → v1.1 변경: 작업 지침 #7(실측·사실 기반) 적용 — 추정 8개소 명시, 검증 게이트 추가, 환경변수 분리, 빈 상태/에러 폴백 가이드 신설

---

## 0. 한 줄 요약 (새 대화 1분 파악용)

**현재 문제:** 서비스의 한 줄 약속이 "네이버 AI 브리핑 + ChatGPT 노출"인데, AI 브리핑은 음식점·카페·베이커리·바·숙박(ACTIVE) + 비프랜차이즈만 직접 이용 가능. 전체의 약 60~65%(LIKELY/INACTIVE/프랜차이즈)에게는 약속이 부분 허위 또는 불일치.

**해결 방향(사용자 결정):** 트랙 분리는 폐기. **단일 상품 유지 + 모든 사용자에게 공통 가치(스마트플레이스·키워드 검색·블로그·지도) + AI 브리핑/ChatGPT는 부가 가치**로 재포지셔닝.

**점수 비중:** Track1(네이버) 55% / Track2(글로벌) 45%로 통일하되, **Track1 내부 5개 항목의 비중을 사용자 그룹(ACTIVE/INACTIVE)별로 자동 재분배**하여 비대상 업종도 점수상 불이익 없게 함.

### v1.1 핵심 변경(실측·사실 기반 재검토 결과)

- ✅ 추정 8개소 모두 "실측 후 갱신" 표기 (그룹 분포·KPI·서버 부담·C-rank 산식·Haiku 비용·점수 변동·검색광고 한도·Phase A 시간)
- ✅ Phase A-0 베이스라인 측정을 핵심 가치 보강 작업의 선행으로 추가 (BI 갱신 후 §1.1·§11 갱신)
- ✅ Phase A-4.5 Claude Haiku/검색광고 API 비용·한도 실측 게이트 추가
- ✅ Phase A-10 출시 전 통합 검증 게이트 추가 (TypeScript·Python·Playwright RAM·면책·빈 상태 모두)
- ✅ 환경변수 분리(§14.5) — 서버 업그레이드 시 코드 수정 없이 동시성·주기 확장
- ✅ 빈 상태·에러 폴백 가이드(§17) — 가짜 수치 절대 금지, 실패 시 N/A·"아직 데이터 없음" 표시
- ✅ 면책 문구 적용 위치 구체화(§5.3) — 컴포넌트별 적용 위치 표

### v1.2 핵심 변경 (3차 재검토 Critical 4건 반영)

- ✅ **Track1 5항목 → 6항목 확장** — `review_quality` 25% 부활(15~20%로 감축), 기존 `calc_review_quality()` 함수 자산 보존
- ✅ **`keyword_gap_score` 35% 매핑 명시** — 신규 키워드 검색 25%(실측 순위) + 스마트플레이스 흡수(콘텐츠 매칭). `analyze_keyword_coverage()` 함수는 스마트플레이스 계산의 일부로 활용
- ✅ **`naver_visibility.blog_mention_score()` 충돌 방지** — 블로그 항목은 별도 분리, 기존 함수는 콘텐츠 매칭에 한정 사용
- ✅ **v3.0 → v3.1 코드 매핑 표** 추가 (§3.2) — `briefing_engine`/`gap_analyzer`/`guide_generator` 작업 시 항목별 매핑 참조 가능

---

## 1. 배경 및 문제 정의

### 1.1 사용자 그룹별 분포 및 약속 불일치

⚠️ **아래 비율은 시장 추정값(통계청 사업체 통계 + 자체 가설)이며 실데이터 아님.** Phase A-0 작업으로 현재 가입자 데이터 백필 후 갱신 필요. 의사결정 시 비율 자체보다 **그룹 자체의 존재**에 무게.

| 그룹 | 시장 추정 비율 | 측정 방법 | AI 브리핑 노출 | 글로벌 AI | 현재 메시지 적합도 | 환불·민원 리스크 |
|---|---|---|---|---|---|---|
| A. ACTIVE 비프랜차이즈 (음식점·카페·베이커리·바·숙박) | 추정 30~40% | 통계청 사업체 통계 | 직접 가능 | 가능 | ✅ 일치 | 낮음 |
| B. LIKELY (미용·네일·피트니스·요가·펫·약국) | 추정 20~30% | 통계청 + 자체 가설 | 확대 예상 (시기 미정) | 가능 | ⚠️ 절반 일치 | 중간 |
| C. INACTIVE (의료·법무·학원·쇼핑·인테리어·자동차·청소·디자인 등) | 추정 25~35% | 통계청 잔여 | 불가능 | 가능 | ❌ 불일치 | 높음 |
| D. 프랜차이즈 가맹점 (전 업종) | 추정 5~15% | 공정위 가맹사업거래 통계 | 불가능 (네이버 공식) | 가능 | ❌ 불일치 | 높음 |

**Phase A-0 베이스라인 측정 결과 (2026-04-30 실측):**

⚠️ **현재 베타 사용자 1명만 존재** (`fccf289b...`, education 업종, 비프랜차이즈, INACTIVE 그룹). 통계적 유의성 없음.

| 측정 항목 | 실측치 |
|---|---|
| 고유 사업장 수 | 1개 |
| 그룹 분류 | INACTIVE 1명 (100%) |
| Track1 점수 분포 | 28.00~40.70 (10회 스캔, 평균 ~31.6) |
| Track2 점수 | 16.00 (고정) |
| Unified 점수 | 20.80~25.90 (생존 단계 `survival`) |

**시사점:**
- INACTIVE 사용자가 실제로 가입한다는 가설은 1건 검증됨
- Track1·Track2 모두 30점대 이하 → 가입 후 즉시 서비스 가치 체감 어려움 → **신규 사용자에게 "최소 1주 내 점수 향상 가능 항목"을 즉시 제시할 필요**
- v3.1 가중치 재분배 시 이 사용자 점수 예상: Track1 28~40 → 30~45 (소폭 상승, ±10점 변동 가능성)

**§11 KPI 베이스라인 확정 시점:** 베타 사용자 5명 이상 확보 후 재측정. 그 전까지는 추세 보고만 가능.

### 1.2 사용자 행동 데이터 추정

소상공인 매출의 가장 강한 예측 변수 순위(자체 추정·인터뷰 기반):
1. 네이버 통합검색 키워드 노출 ("○○동 ○○집")
2. 네이버 지도/플레이스 검색 결과 순위
3. 네이버 블로그 후기 발견 가능성
4. AI 브리핑 인용 (ACTIVE 한정)
5. ChatGPT/Gemini/Google AI 인용

→ **결론:** AI 브리핑은 1~3순위 다음에 오는 부가 가치. 현재 사이트는 이 우선순위를 거꾸로 표현하고 있음.

### 1.3 현재 점수 모델(v3.0)의 한계

`model_engine_v3.0.md` 기준 Track1 가중치:
- `keyword_gap_score`: 35%
- `review_quality`: 25%
- `smart_place_completeness`: 15%
- `naver_exposure_confirmed`: 15% (AI 브리핑 실측)
- `kakao_completeness`: 10%

**한계:**
- "네이버 키워드 검색 노출 순위"가 별도 항목으로 없음 (keyword_gap은 리뷰·블로그 텍스트 매칭이지 실제 검색 결과 순위가 아님)
- AI 브리핑 비대상 업종은 `naver_exposure_confirmed` 15%가 영구 0점 → 점수 불이익
- 블로그 C-rank 모니터링은 `online_mentions` 안에 묻힘 (가시성 부족)

---

## 2. 핵심 결정 사항

### 2.1 새 한 줄 정의

> **"네이버에서 우리 가게가 검색·지도·AI 브리핑·블로그 어디서든 먼저 보이게, 추가로 ChatGPT·Google AI에서도."**

### 2.2 상품 구성

- **트랙 분리 폐기** (이전 검토안 번복). 단일 상품 라인 유지: Basic 9,900 / Pro 18,900 / Biz 49,900 / Enterprise 200,000.
- **메시지·대시보드·이메일은 그룹별 자동 분기** (DB 컬럼 1개로 구동).
- **점수 가중치는 통일된 카테고리(5개)로 운영하되 그룹별 배분이 다름** (§3 참조).

### 2.3 그룹 판정 규칙

`backend/services/score_engine.py`에 단일 함수로 통일:

```python
def get_user_group(category: str, is_franchise: bool) -> str:
    """ACTIVE / LIKELY / INACTIVE 반환. INACTIVE는 프랜차이즈 포함."""
    if is_franchise:
        return "INACTIVE"
    if category in BRIEFING_ACTIVE_CATEGORIES:
        return "ACTIVE"
    if category in BRIEFING_LIKELY_CATEGORIES:
        return "LIKELY"
    return "INACTIVE"
```

기존 `get_briefing_eligibility()`와 출력 동일(active/likely/inactive 소문자) — **별칭 함수로 추가하고 기존 함수 유지**(역방향 호환).

---

## 3. 점수 모델 v3.1 재설계

### 3.1 Track1/Track2 비율 통일

```python
# 기존 DUAL_TRACK_RATIO 업종별 차등 → 전 업종 55:45로 통일
DEFAULT_DUAL_TRACK_RATIO = {"naver": 0.55, "global": 0.45}
DUAL_TRACK_RATIO = {}  # 비움 (기본값으로 폴백)
```

**예외 유지(소수):** `legal`/`shopping`은 명백히 위치 무관 업종 → 별도 비율 유지 권장:
- `legal`: {naver: 0.30, global: 0.70} (기존 0.20 → 0.30 상향, 키워드 검색 비중 반영)
- `shopping`: {naver: 0.20, global: 0.80} (기존 0.10 → 0.20 상향)

이 외 23개 업종은 모두 55:45.

### 3.2 Track1 내부 6개 항목 (그룹별 가중치 표) — v1.2 review_quality 부활

⚠️ **v1.1의 5항목 안은 review_quality 25%(v3.0 핵심 항목)를 누락한 결함.** v1.2에서 6항목으로 확장하여 기존 `calc_review_quality()` 함수와 호환 유지.

**전체 Track1 = 100% 기준. Track1 자체의 점수가 100점이고, unified_score 계산 시 ×0.55 곱해짐.**

| 항목 | ACTIVE | LIKELY | INACTIVE | 측정 방법 | v3.0 기존 항목 매핑 |
|---|---|---|---|---|---|
| 1. **네이버 키워드 검색 노출** (신규) | 25% | 30% | **35%** | 사장님 입력 키워드 3~10개의 네이버 통합검색 결과 1페이지 순위 (Playwright) | 신규 (keyword_gap_score와 별개) |
| 2. **리뷰 품질** | 15% | 17% | **20%** | 리뷰수·평점·최신성·영수증 리뷰 (기존 `calc_review_quality()` 유지) | review_quality 25% (감축) |
| 3. **스마트플레이스 완성도** (콘텐츠 매칭 포함) | 15% | 18% | **20%** | 소개글·소식·메뉴·사진·FAQ + **keyword_gap_score 흡수** (콘텐츠 키워드 매칭) | smart_place 15% + keyword_gap 35% 일부 흡수 |
| 4. **블로그 생태계 (C-rank 추정)** | 10% | 10% | 10% | 30일 내 발행·외부 인용·업체명 매칭 | 신규 분리 (online_mentions에서 분리) |
| 5. **지도/플레이스 + 카카오맵** | 10% | 10% | 15% | 네이버 지도 순위 + 카카오맵 자동 점검 | kakao_completeness 10% + 신규 |
| 6. **AI 브리핑 인용** | 25% | 15% | 0% | Gemini/Naver 스캐너 실측 + 사용자 토글 ON | naver_exposure_confirmed 15% (확장) |
| **합계** | **100%** | **100%** | **100%** | | |

**재분배 규칙 (확정 #2 + v1.2 review_quality 보강):**
- ACTIVE → INACTIVE: AI 브리핑 25%p가 키워드(+10%p), 리뷰(+5%p), 스마트플레이스(+5%p), 지도(+5%p)로 재분배
- ACTIVE → LIKELY: AI 브리핑 10%p 차이가 키워드(+5%p), 리뷰(+2%p), 스마트플레이스(+3%p)로 재분배
- 블로그 10%는 그룹 무관 동일 (측정 변동성 ↓)

**v3.0 → v3.1 매핑 (코드 호환성):**
- `keyword_gap_score` 35% → 신규 키워드 검색 25%(실측 순위) + 스마트플레이스 흡수 10%(콘텐츠 매칭). 기존 `analyze_keyword_coverage()` 함수는 스마트플레이스 점수의 일부로 활용 → 함수 살아남음
- `review_quality` 25% → 15~20% (감축, 측정 방법 동일)
- `smart_place_completeness` 15% → 15~20% (확장)
- `naver_exposure_confirmed` 15% → AI 브리핑 25% (확장)
- `kakao_completeness` 10% → 지도/플레이스 + 카카오맵 10~15%로 통합

**근거:** 6개 항목으로 확장하여 ① v3.0 함수 자산 보존 ② 측정 방법 명확 분리 ③ 그룹별 가중치 합 100% 보장.

### 3.3 Track2 (글로벌 AI) — 그룹 무관 통일

| 항목 | 가중치 | 측정 방법 |
|---|---|---|
| ChatGPT 노출 | 30% | gpt-4o-mini 다중 쿼리 |
| Gemini 노출 | 25% | Gemini 2.0 Flash 100회 (Trial 10회) |
| Google AI Overview | 15% | Playwright |
| 웹사이트 SEO | 15% | 메타 태그·H1·이미지 alt·로딩속도 |
| JSON-LD 스키마 | 15% | LocalBusiness·FAQPage·Product 자동 검사 |

### 3.4 `unified_score` 계산식 (기존 유지)

```
unified_score = track1 × naver_weight + track2 × global_weight
GrowthStage 기준 = track1_score (업종별 비율 차이 오판 방지)
```

### 3.5 v3.0 → v3.1 마이그레이션 영향

⚠️ **점수 변동 ±5~10점은 가정.** Phase A-3 작업 시 기존 사용자 10명 샘플로 시뮬레이션하여 실측 차이 측정 후 본 문서 갱신.

**시뮬레이션 절차:**
```python
# 기존 사용자 10명 샘플 추출
sample = supabase.table("scan_results").select("*").limit(10).execute()
for s in sample.data:
    v30_track1 = s["track1_score"]                               # 기존
    v31_track1 = recalc_with_v3_1(s, biz=...)                    # 신규
    delta = v31_track1 - v30_track1
    print(f"biz_id={s['business_id']} delta={delta:+.1f}")
```

**합격 기준:** 그룹별 평균 변동 |Δ| < 10점. 초과 시 가중치 재조정 후 재시뮬레이션.

- `score_history` 30일 데이터는 그대로 두고 **시뮬레이션 통과 후 신규 스캔부터 v3.1 적용**
- 사용자 안내: 카카오 알림톡 + 대시보드 배너 1주일 노출
- 변동 폭이 10점 초과인 사용자는 개별 알림(이메일)로 사유 설명

---

## 4. 신규/보강 기능 목록

### 4.1 [Phase A 핵심] 네이버 키워드 순위 트래킹

**현재 자산:** `services/naver_visibility.py` (단발 검색만), `services/naver_datalab.py` (미연동)

**추가 작업:**
- `services/naver_keyword_rank.py` 신규 작성
- 사장님이 입력한 키워드 5~10개에 대해:
  - PC 검색 결과 1페이지 내 우리 가게 노출 여부 + 순위
  - 모바일 검색 결과 1페이지 내 노출 여부 + 순위
  - 통합검색 vs 플레이스 vs 지도 탭 분리 측정
- 결과 저장: `scan_results.keyword_ranks JSONB`
- 시계열: `score_history.keyword_rank_avg FLOAT`
- 실패 시 graceful fallback (Playwright 셀렉터 변경 감지 포함)

**서버 부담 분석:**
- Playwright 1키워드당 ~2초, RAM ~300MB (인스턴스 1개 기준)
- 100명 × 5키워드 × 주 1회 = 500회/주 ≈ 71회/일 → 시간 분산 시 무부담
- 1,000명 × 10키워드 × 일 1회 = 10,000회/일 → 시간당 ~420회 = Semaphore(2) + 24시간 분산 처리 필요

### 4.2 [Phase A] 키워드 자동 추천 (사용자 입력 부담 완화)

**문제:** 키워드 3개 입력도 소상공인에게 진입 장벽.

**해결:**
- `POST /api/businesses/{id}/keyword-suggest`
- Claude Haiku 1회 호출
  - **실측 비용 검증 필요(Phase A-1.5):** 모델 가격 $0.80/1M input·$4.00/1M output (claude-haiku-4-5 기준 추정). 실제 토큰: 프롬프트 ~500토큰 + 응답 ~300토큰 = 약 ~₩2~3원/요청 추정.
  - **확정 절차:** Phase A 첫 구현 후 Anthropic 콘솔에서 5건 호출 비용 측정 → 본 문서 갱신
- 네이버 검색광고 API(`NAVER_SEARCHAD`):
  - **실측 검증 필요:** "일 25,000건 무료"는 환경변수 주석 기반. 실제 API 응답 헤더로 일일 한도 확인 후 본 문서 갱신
  - 검색량 데이터·경쟁도 데이터 결합
  - 추천 → 검색량 정렬 → 사장님 클릭 1회로 등록
- **에러 폴백:** Claude Haiku 또는 검색광고 API 실패 시 → "수동 입력해주세요" + 업종별 베이스 키워드 5개 제시 (`services/keyword_taxonomy.py` 활용). 임의 추천 금지.

### 4.3 [Phase A] 블로그 C-rank 추정 모니터링

**현재 자산:** `services/blog_analyzer.py` (텍스트 키워드 매칭만)

**추가 작업:**
- 30일 내 발행 블로그 검색 결과 노출 빈도
- 우리 가게 발견 가능성(상위 30개 블로그 중 사업장명 언급 수)
- **C-rank 추정 점수(초기 가중치 — 베타 데이터 후 조정):**
  - 발행 빈도 × 0.4 + 외부 인용 × 0.3 + 업체명 매칭 × 0.3
  - **이 가중치는 임시값.** Phase A 출시 후 베타 사용자 20명 데이터 확보 시 회귀 분석으로 재조정 (실측 AI 브리핑 인용 vs C-rank 점수 상관관계)
  - 베타 데이터 부족 시 회귀 분석 보류, 가중치 유지
- **사용자 화면 표시:** "C-rank 추정 — 정확한 C-rank는 네이버 비공개" 면책 문구 함께
- **빈 상태:** 30일 내 발행 블로그 0건 → "블로그 미발견 — 첫 블로그 발행 후 측정" 안내 + 블로그 작성 가이드 링크

### 4.4 [Phase A] 카카오맵 노출 점검 (기존 항목 보강)

**현재 자산:** `kakao_completeness` Track1에 있으나 자가체크 기반.

**추가 작업:**
- 카카오맵 검색 시 노출 여부 자동 확인 (Playwright)
- 카카오맵 리뷰 수집 (선택)
- Track1 기존 비중 유지(약 5%), 자동 측정으로 신뢰도 ↑

### 4.5 [Phase B] 키워드 순위 변동 알림톡 (신규 템플릿)

**현재:** 5종 알림톡 (점수·인용·경쟁사·뉴스·할 일).

**추가:** `AEOLAB_KW_01` — "키워드 순위 변동" (TOP10 진입·이탈 시).
INACTIVE 사용자에게 가장 체감되는 알림 → 유지율 핵심.

### 4.6 [Phase B] 보고서(CSV·PDF) 키워드 섹션 추가

- CSV: 키워드별 7일·30일 평균 순위·최저·최고
- PDF: 키워드 순위 시계열 차트 + 경쟁사 평균 비교

### 4.7 [Phase C] 키워드 추천 AI v2 (BEP 이후)

- 자체 학습 데이터(베타 사용자 100명 이상) 기반 키워드 추천 정확도 ↑
- 검색광고 API 데이터로 검색량·전환율 예측

---

## 5. 데이터 수집 방법론

### 5.1 데이터 소스 분담

| 데이터 | 방법 | 비용 | 비고 |
|---|---|---|---|
| 네이버 키워드 순위 | Playwright | 0원 (서버 RAM만) | Semaphore(2) 필수 |
| 네이버 검색량·경쟁도 | 검색광고 API | 무료 (일 25,000건) | `NAVER_SEARCHAD` 키 사용 |
| 네이버 블로그 발견 | 블로그 검색 API | 무료 | `NAVER_CLIENT_ID/SECRET` |
| 스마트플레이스 완성도 | Playwright + 사용자 체크박스 | 0원 | 기존 `smart_place_auto_check.py` |
| 카카오맵 노출 | Playwright | 0원 | 신규 |
| AI 브리핑 인용 | Naver Scanner (Playwright) | 0원 | 기존 |
| ChatGPT 인용 | OpenAI gpt-4o-mini | ~$0.001/쿼리 | 기존 |
| Gemini 인용 | Gemini 2.0 Flash | ~$0.0002/쿼리 | 기존 |
| Google AI Overview | Playwright | 0원 | 기존 |
| 키워드 자동 추천 | Claude Haiku | ~50원/요청 | 신규 |

### 5.2 서버 부담 단계별 측정 계획

**현재 상태(2026-04-30 기준):** 가입자 N명(실측 필요 — Phase A-0에서 백필). PM2 메모리 사용량 실측치 = aeolab-frontend 60MB / aeolab-backend 137MB.

⚠️ **이전 v1.0의 "1,000명 시나리오 가능"은 이론적 가정.** 실측 단계별 측정으로 검증 필요:

| 단계 | 사용자 수 | 측정 항목 | 액션 |
|---|---|---|---|
| 단계 0 | 현재 | 백필 + RAM 사용량 베이스라인 | Phase A-0 |
| 단계 1 | 50명 | Playwright 동시 부하 + 응답 시간 | 실측 후 동시성 한도 조정 |
| 단계 2 | 100명 (BEP 5배) | 시간당 처리량 + RAM peak | 측정 주기 분산 검증 |
| 단계 3 | 200명 | 서버 업그레이드 효과 확인 | 업그레이드 후 동시성 ↑ |
| 단계 4 | 500명 | Phase 2+ 인프라 분리 검토 | Vercel + Railway |

**환경변수 분리(필수):**
```python
# backend/config/concurrency.py
import os
MAX_PLAYWRIGHT_CONCURRENCY = int(os.getenv("BACKEND_MAX_CONCURRENCY", "2"))
KEYWORD_SCAN_INTERVAL_HOURS = int(os.getenv("KEYWORD_SCAN_INTERVAL_HOURS", "168"))  # Basic 주 1회 = 168h
KAKAO_AUTOCHECK_INTERVAL_HOURS = int(os.getenv("KAKAO_AUTOCHECK_INTERVAL_HOURS", "720"))  # Basic 월 1회
```
서버 업그레이드 시 `.env`만 수정하여 동시성·주기 확장. 코드 수정 불필요.

**RAM peak 자동 알람:** `psutil.virtual_memory().percent > 85` 시 운영자 카카오 알림 (Phase A-2).

### 5.3 데이터 변동 면책 (필수) — 적용 위치 구체화

**측정 환경 표준화:**
- 위치: 서울 (특정 IP 고정 — 운영자 결정)
- 디바이스: PC + 모바일 양쪽
- 로그인: 비로그인
- 시간대: 서버 분산(시간당 다른 시간대)
- 결과: `scan_results.measurement_context JSONB`에 매번 기록 (재현성 검증용)

**면책 문구 적용 위치(전수):**

| 화면 | 컴포넌트 | 위치 |
|---|---|---|
| 대시보드 키워드 순위 카드 | `KeywordRankCard.tsx` | 카드 하단 회색 1줄 |
| 대시보드 점수 카드 | `ScoreCard.tsx` | "점수 자세히 보기" 모달 내 |
| 대시보드 AI 인용 카드 | `AiCitationCard.tsx` | 카드 하단 회색 1줄 |
| 트라이얼 결과 | `TrialResultStep.tsx` | 키워드 미리보기 아래 |
| 보고서 PDF | `services/pdf_generator.py` | 푸터 1줄 |
| 매뉴얼 페이지 §5(결과 측정) | `how-it-works/page.tsx` | 별도 박스 |

**표준 면책 문구:**
> "키워드 순위·AI 인용·점수는 측정 시점·기기·검색 환경에 따라 달라질 수 있습니다. AEOlab은 서울 기준 비로그인 PC/모바일로 측정합니다."

**금지:** 면책 없이 단정적 표현("귀하의 가게는 N위입니다") 사용 금지. 항상 "측정 시점 기준 N위"로 표기.

---

## 6. 요금제별 차등 (확정 #3 — 키워드 3개 의무 입력)

**모든 신규 가입자: 사업장 등록 폼에서 키워드 3개 필수 입력 (자동 추천 1회 무료 제공). 추적 한도는 플랜별 차등.**

| 항목 | Free | Basic 9,900 | Pro 18,900 | Biz 49,900 | Enterprise 200,000 |
|---|---|---|---|---|---|
| 키워드 입력 최소 | 3개 (가입 시 필수) | 3개 | 3개 | 3개 | 3개 |
| 키워드 추적 한도 | 3개 (트라이얼) | 5개 | 10개 | 20개 | 50개 |
| 측정 주기 | 월 1회 (트라이얼) | 주 1회 | 일 1회 | 6시간 단위 | 시간 단위 |
| 키워드 자동 추천 | ✅ 가입 시 1회 | ✅ 월 1회 | ✅ 월 4회 | ✅ 월 10회 | ✅ 무제한 |
| 블로그 C-rank 모니터링 | ❌ | ✅ 주 1회 | ✅ 일 1회 | ✅ 6시간 단위 | ✅ 시간 단위 |
| 카카오맵 자동 점검 | ❌ | ✅ 월 1회 | ✅ 주 1회 | ✅ 일 1회 | ✅ 일 1회 |
| AI 브리핑 인용 (ACTIVE 전용) | ❌ | ✅ 주 1회 | ✅ 일 1회 | ✅ 일 1회 | ✅ 일 1회 |
| ChatGPT/Gemini/Google 인용 | ❌ (트라이얼만) | ✅ 주 1회 | ✅ 일 1회 | ✅ 일 1회 | ✅ 일 1회 |
| 키워드 변동 알림톡 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 멀티 사업장 | 1개 | 1개 | 1개 | 5개 | 20개 |
| Public API | ❌ | ❌ | ❌ | ✅ | ✅ |

**핵심 설계:**
- 모든 사용자 동일한 키워드 입력 부담 (3개) → 진입 장벽 최소화
- 자동 추천은 Free 가입자에게도 1회 무료 제공 (입력 부담 거의 0)
- 추적 한도는 플랜 차등 → 더 많이 추적하려면 업그레이드 유도

---

## 7. UI/UX 분기 (단일 상품, 그룹별 메시지)

### 7.1 헤드라인 분기 표

| 그룹 | 메인 헤드라인 | 서브 메시지 |
|---|---|---|
| ACTIVE | "네이버 AI 브리핑·검색·지도·블로그 + ChatGPT 통합 노출 관리" | 음식점·카페·베이커리·바·숙박 사장님 전용 매뉴얼 포함 |
| LIKELY | "네이버 검색·지도·블로그 + ChatGPT 통합 관리. AI 브리핑 확대 시 즉시 활용" | 미용·네일·피트니스·요가·펫·약국 — 베타 대비 사전 최적화 |
| INACTIVE | "네이버 검색·지도·블로그 + ChatGPT 통합 노출 관리" | 학원·법무·의료·쇼핑·인테리어·자동차 사장님 — AI 검색 시대 차별화 |
| 프랜차이즈 | "프랜차이즈 가맹점이 직접 할 수 있는 네이버·블로그·ChatGPT 노출 관리" | 본사 정책 내에서 가능한 모든 채널 최적화 |

### 7.2 대시보드 카드 우선순위 분기

```typescript
// frontend/app/(dashboard)/dashboard/page.tsx
const userGroup = getUserGroup(business.category, business.is_franchise);

const cardOrder = {
  ACTIVE:   ["AI브리핑5단계", "키워드순위", "스마트플레이스", "블로그", "ChatGPT인용"],
  LIKELY:   ["키워드순위", "스마트플레이스", "AI브리핑준비", "블로그", "ChatGPT인용"],
  INACTIVE: ["키워드순위", "스마트플레이스", "블로그", "ChatGPT인용", "지도랭킹"],
};
```

### 7.3 랜딩 페이지 변경

- HeroIndustryTiles 클릭 시 그룹별 약속 표시 (현재는 무차별)
- ServiceMechanismSection의 "점수 100점" 그래픽을 사용자 그룹별로 다른 도넛으로 표시
- FAQ 신규 항목: "AI 브리핑 비대상 업종도 가입할 가치가 있나요?" (Yes + 키워드·블로그·지도 가치)

### 7.4 트라이얼 흐름

- IP 분당 10회 제약 → 키워드 1개만 즉시 측정
- 트라이얼 결과에 키워드 순위 미리보기 강조 (그룹 무관 모든 사용자에게 가치)
- INACTIVE/프랜차이즈 안내 배너 유지하되 "그래도 받게 되는 가치 4가지" 명시

---

## 8. DB 마이그레이션 (Supabase SQL Editor 실행)

```sql
-- v3.1 사용자 그룹 캐시 (계산 결과 저장으로 성능 향상)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS user_group TEXT
    CHECK (user_group IN ('ACTIVE', 'LIKELY', 'INACTIVE'));
COMMENT ON COLUMN businesses.user_group IS 'AI 브리핑 노출 가능성 + 프랜차이즈 게이팅 결과. INACTIVE는 프랜차이즈 포함';

-- 키워드 순위 추적 결과
ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS keyword_ranks JSONB;
COMMENT ON COLUMN scan_results.keyword_ranks IS
  '{"keyword1": {"pc_rank": 3, "mobile_rank": 5, "place_rank": 2, "measured_at": "..."}, ...}';

-- 시계열 평균 순위 (Quick chart용)
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS keyword_rank_avg FLOAT,
  ADD COLUMN IF NOT EXISTS blog_crank_score FLOAT;

-- 키워드 변동 알림톡 멱등키
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS keyword_change_payload JSONB;

-- 카카오맵 자동 점검 결과
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS kakao_auto_check_result JSONB,
  ADD COLUMN IF NOT EXISTS kakao_auto_check_at TIMESTAMPTZ;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_businesses_user_group ON businesses(user_group);
CREATE INDEX IF NOT EXISTS idx_scan_results_keyword_ranks ON scan_results USING GIN (keyword_ranks);
```

**미실행 시 graceful fallback:** 백엔드는 `_BIZ_OPTIONAL_COLS`에 추가, 프론트엔드는 별도 SELECT + try/catch로 누락 시 무시.

---

## 9. 기존 사용자 처리 (마이그레이션)

### 9.1 자동 처리

1. `user_group` 컬럼 일괄 백필:
```sql
UPDATE businesses SET user_group = CASE
  WHEN is_franchise = TRUE THEN 'INACTIVE'
  WHEN category IN ('restaurant','cafe','bakery','bar','accommodation') THEN 'ACTIVE'
  WHEN category IN ('beauty','nail','pet','fitness','yoga','pharmacy') THEN 'LIKELY'
  ELSE 'INACTIVE'
END WHERE user_group IS NULL;
```

2. v3.1 가중치 적용은 **2026-05-XX(확정 후) 이후 신규 스캔만** — 기존 점수는 보존

### 9.2 사용자 알림 (1주일 1회)

- 카카오 알림톡: "AEOlab 점수 모델 v3.1로 업데이트되었습니다. 키워드 검색 노출 추적이 추가되어 더 정확한 점수를 받을 수 있습니다."
- 이메일: 변경점 안내 + 키워드 입력 가이드 링크
- 대시보드 배너: 7일간 노출 + 키워드 입력 CTA

### 9.3 키워드 입력 정책 (확정 #3)

- **신규 가입자(전 플랜):** 사업장 등록 폼에서 키워드 **3개 필수 입력**
  - 자동 추천 1회 무료 (Claude Haiku + 검색광고 API)
  - 사장님은 추천된 10개 중 3개를 클릭만으로 등록 가능 → 입력 부담 ~30초
- **기존 사용자:** 마이그레이션 후 7일 안내 + 대시보드 배너로 "키워드 3개 등록 시 점수 정확도 향상" 권장
  - 강제 X (신뢰 손상 방지)
  - 7일 후에도 미입력 시 대시보드 점수 카드에 "키워드 입력 시 +20점 가능" 부드러운 CTA 노출
- **3개 입력 후:** 사용자는 사업장 정보로 활용 가능 — 트라이얼·전체 스캔 결과·매뉴얼·키워드 추천 모든 곳에 반영됨

---

## 10. 우선순위 매트릭스

### Phase A — 핵심 가치 보강 (2~3주, 즉시)

⚠️ **시간 추정은 단일 개발자 기준 작업 시간 가정.** 실측 디버깅·서버 배포 시간 미포함. 환경 변수: 첫 작업 후 실측치로 갱신.

| ID | 항목 | 추정 시간 | 영향도 | 의존성 | 검증 게이트 |
|---|---|---|---|---|---|
| **A-0** | **베이스라인 측정** (그룹 분포·점수·전환율·환불률 백필) | 2h | 必 | - | 본 문서 §1.1·§11 갱신 |
| A-1 | DB v3.1 마이그레이션 (`user_group`, `keyword_ranks`, `score_history` 컬럼) | 1h | 高 | A-0 | `psql \d businesses` 신규 컬럼 확인 |
| A-2 | `services/naver_keyword_rank.py` 신규 (Playwright 키워드 순위) + RAM peak 알람 | 6h | 高 | A-1 | 베타 사용자 1명 실측 통과 |
| A-3 | `score_engine.py` v3.1 가중치 + 그룹별 재분배 로직 | 4h | 高 | A-1 | 기존 사용자 10명 점수 ±10점 시뮬레이션 |
| **A-4.5** | **Claude Haiku 비용 + 검색광고 API 한도 실측** (5건 호출 후 콘솔 비용 확인) | 1h | 必 | A-4 | 본 문서 §4.2 갱신 |
| A-4 | 키워드 자동 추천 API (Claude Haiku + 검색광고 API + 폴백) | 4h | 中 | - | 베타 1명 추천 결과 1건 검증 |
| A-5 | `services/blog_analyzer.py` C-rank 추정 보강 + 빈 상태 처리 | 3h | 中 | - | 신규 사업장 빈 상태 화면 정상 |
| A-6 | 카카오맵 자동 점검 (Playwright) + 에러 폴백 | 3h | 中 | A-1 | 폴백 시 0/N/A 표시 정상 |
| A-7 | `RegisterBusinessForm.tsx` 키워드 3개 필수 입력 + 자동 추천 버튼 | 2h | 高 | A-4 | 2개 입력 시 폼 차단 검증 |
| A-8 | 대시보드 카드 우선순위 그룹별 분기 + 키워드 순위 카드 신규 + 면책 문구 | 5h | 高 | A-2, A-3 | 3개 그룹 화면 모두 검증 |
| A-9 | 점수 모델 안내 배너 + 매뉴얼 페이지 v3.1 업데이트 | 2h | 中 | - | 라이브 검증 |
| **A-10** | **출시 전 통합 검증** (TypeScript·Python·Playwright RAM·면책 문구·빈 상태) | 2h | 必 | A-1~A-9 | §17 체크리스트 통과 |

**Phase A 추정 시간:** ~35h (검증 게이트·실측 보강 작업 5h 추가됨)
**필수 게이트 작업(A-0 / A-4.5 / A-10)은 추정값 갱신 + 검증 책임이며 생략 불가.**

### Phase B — 메시지·알림 재정렬 (3~4주)

| ID | 항목 | 예상 시간 |
|---|---|---|
| B-1 | 헤드라인 그룹별 분기 (랜딩·트라이얼·요금제) | 4h |
| B-2 | `AEOLAB_KW_01` 알림톡 템플릿 신청 + 발송 로직 | 3h |
| B-3 | 보고서(CSV·PDF) 키워드 섹션 추가 | 4h |
| B-4 | 사용자 마이그레이션 알림 (카카오 + 이메일 + 배너) | 3h |
| B-5 | 트라이얼 결과에 키워드 순위 미리보기 강조 | 2h |
| B-6 | 면책 문구 일관 적용 (대시보드·매뉴얼·트라이얼) | 1h |

**Phase B 합계:** ~17h

### Phase C — 차별화·심화 (BEP 이후)

| ID | 항목 |
|---|---|
| C-1 | 키워드 추천 AI v2 (베타 데이터 기반) |
| C-2 | 경쟁사 키워드 갭 자동 분석 |
| C-3 | 블로그 자동 발행 가이드 + 협업 블로거 매칭 |
| C-4 | 키워드 검색량·전환율 예측 |
| C-5 | 단일 소스 API (`/api/public/briefing-categories`) |

---

## 11. KPI 및 성공 지표

⚠️ **베이스라인 미측정 상태에서 목표 수치 단정 금지.** Phase A 출시 직전(D-1) 베이스라인 측정 → 출시 후 4주·12주 시점 비교.

### 11.1 베이스라인 측정 항목 (Phase A 출시 직전)

| 지표 | 측정 쿼리 | 측정 시점 |
|---|---|---|
| 그룹별 가입자 분포 | `SELECT user_group, COUNT(*) FROM businesses GROUP BY user_group` | Phase A-0 |
| 그룹별 평균 점수 | `AVG(track1_score), AVG(track2_score)` | Phase A-0 |
| 트라이얼 → 가입 전환율 | GA4 `trial_complete → signup_complete` 30일 funnel | D-1 |
| 가입 → 결제 전환율 | GA4 `signup → subscription_active` 30일 funnel | D-1 |
| 30일 환불·취소율 | `subscriptions WHERE canceled_at < created_at + 30d` | D-1 |
| 그룹별 평균 ARPU | 그룹별 MRR / 활성 사용자 수 | D-1 |

### 11.2 출시 후 4주 측정 지표 (베이스라인 대비 상대 비교)

| 지표 | 비교 방식 | 합격 기준(가설) |
|---|---|---|
| INACTIVE 사용자 신규 가입 비율 | 전월 동기 대비 | **상승** (수치 단정 금지 — 변동 추이만 보고) |
| 키워드 입력 완료율 | 신규 가입자 100% | 신규는 의무 입력 → 100% 정상 |
| 트라이얼 → 가입 전환율 | D-1 베이스라인 대비 | 상승 (수치는 베이스라인 측정 후 결정) |
| 가입 → 결제 전환율 | D-1 베이스라인 대비 | 상승 |
| 30일 환불·취소율 | D-1 베이스라인 대비 | 하락 |
| 그룹별 ARPU | D-1 베이스라인 대비 | INACTIVE ARPU 상승 |

### 11.3 12주 측정 지표

| 지표 | 비교 방식 | 합격 기준 |
|---|---|---|
| 점수 모델 v3.1 적용 후 평균 점수 변동 | v3.0 마지막 스캔 vs v3.1 첫 스캔 | 그룹별 평균 ±10점 이내 |
| 키워드 순위 평균 개선 | 사용자별 첫 스캔 vs 12주 후 | 그룹별 추이 기록 (목표값 X) |
| Day7 재방문율 | 신규 가입 코호트별 | 베이스라인 대비 추이 기록 |
| 카카오 알림톡 클릭률 (`AEOLAB_KW_01`) | 발송 → 클릭 7일 funnel | 발송 후 측정값 기록 |

**원칙:** "+20%, +30%" 등 임의 목표 폐기. 베이스라인 측정 후 추이 보고 → 4주 결과 보고 시 다음 분기 목표 설정.

---

## 12. 리스크 및 미해결 질문

### 12.1 기술 리스크

| 리스크 | 완화 방안 |
|---|---|
| Playwright 셀렉터 변경 → 키워드 측정 실패 | Drift Detection 30분 모니터링 + 실패율 ≥20% 시 운영자 알림 |
| 사용자 1,000명 도달 시 RAM 한계 | 시간 분산 + Phase 2+ 인프라 분리 (Vercel + Railway) |
| 네이버 검색광고 API 일 25,000건 초과 | 캐싱 1주일 + 사용자 그룹 단위로 호출 분산 |
| 카카오 알림톡 신규 템플릿 승인 지연 | 이메일 우선 발송, 알림톡 승인 후 전환 |

### 12.2 사업·법적 리스크

| 리스크 | 완화 방안 |
|---|---|
| 키워드 순위 데이터 변동 → "약속과 다르다" 클레임 | 면책 문구 모든 페이지 일관 적용 + 측정 환경 명시 |
| 점수 모델 변경 → 기존 사용자 신뢰 손상 | 마이그레이션 안내 1주일 + 기존 점수 보존 |
| 프랜차이즈 가맹점 본사 항의 (네이버 게이팅 인용) | 출처 링크 명시 (네이버 공식) + AEOlab은 안내 채널일 뿐 |
| INACTIVE 사용자 ARPU 낮음 → 매출 분산 | Pro/Biz 차등으로 상위 플랜 유도 + 키워드 개수 차이 강조 |

### 12.3 미해결 질문 (사용자 결정 필요)

(§13 의사결정 항목 참조)

---

## 13. 사용자 의사결정 항목

### 13.1 확정 사항 (2026-04-30)

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| 1 | DUAL_TRACK_RATIO 통일 범위 | **(B) legal(30:70)·shopping(20:80) 예외 유지**, 나머지 23개 업종 55:45 통일 | 위치 무관 업종 특성 반영 |
| 2 | INACTIVE 그룹 AI 브리핑 25% 재분배 | **(C) 키워드 +15%p + 스마트플레이스 +10%p** | 가장 체감되는 2개 채널, 변동성 분산 |
| 3 | 키워드 입력 강제 강도 | **신규 가입자 3개 필수 입력** + 자동 추천 1회 무료 | 입력 부담 최소화 + 사업장 정보 반영 보장 |

### 13.2 권장안 (사용자 답변 대기, 무답 시 권장안으로 진행)

| # | 항목 | 옵션 | 권장 |
|---|---|---|---|
| 4 | 키워드 자동 추천 비용 부담 | (A) 모든 플랜 무제한 / (B) 플랜별 차등 (§6 표) | **(B)** — Free 가입 시 1회, Basic 월 1회 |
| 5 | 점수 모델 v3.1 적용 시점 | (A) 즉시 / (B) 1주 안내 후 / (C) 2주 안내 후 | **(B)** — 사용자 신뢰·전환 균형 |
| 6 | 헤드라인 변경 범위 | (A) 메인 헤드라인 단일 통합 (그룹 무관) / (B) 그룹별 분기 표시 | **(A)** — 단일 통합 + 업종 타일 클릭 시 서브 메시지 |
| 7 | 기존 사용자 키워드 미입력 시 | (A) 강제 입력 (대시보드 차단) / (B) 권장 + 점수 페널티 / (C) 권장만 | **(C)** — 신뢰 손상 방지 |
| 8 | Phase A 작업 시작 시점 | (A) 즉시 (Supabase ALTER 실행 후) / (B) v3.1 문서 검토 후 | **(B)** — 본 문서 검토 후 시작 |

---

## 14. 작업 재개 가이드

### 14.1 새 대화 시작 시

```
"docs/service_unification_v1.0.md 읽고 §13 의사결정 항목 확정 후 Phase A부터 진행해주세요."
```

### 14.2 에이전트 자동 라우팅

| Phase A 작업 | 에이전트 |
|---|---|
| A-1 (DB 마이그레이션) | `db-migrate` |
| A-2 (`naver_keyword_rank.py`) | `backend-dev` |
| A-3 (`score_engine.py`) | `scan-engine` |
| A-4 (키워드 추천 API) | `backend-dev` |
| A-5 (`blog_analyzer.py`) | `scan-engine` |
| A-6 (카카오맵 자동 점검) | `backend-dev` |
| A-7 (`RegisterBusinessForm.tsx`) | `frontend-dev` |
| A-8 (대시보드 분기) | `frontend-dev` |
| A-9 (매뉴얼 v3.1) | `frontend-dev` |

### 14.3 검증 체크리스트

- [ ] TypeScript: `cd frontend && npx tsc --noEmit`
- [ ] Python: `python -c "import ast; ast.parse(open('backend/services/score_engine.py').read())"`
- [ ] DB: Supabase SQL Editor 실행 후 `SELECT user_group, COUNT(*) FROM businesses GROUP BY user_group;`
- [ ] 라이브: `curl -s https://aeolab.co.kr/dashboard | grep "키워드 순위"` (로그인 후)
- [ ] 점수 변동 검증: 기존 사용자 10명 샘플로 v3.0 → v3.1 점수 차이 ±5점 이내 확인

---

## 14.5 환경변수 분리 가이드 (작업 지침 #7 적용)

서버 업그레이드 시 코드 수정 없이 동시성·측정 주기 확장 가능하도록 분리 필수.

### 백엔드 (.env)

```bash
# Playwright 동시 실행 한도 (현재 RAM4GB → 2, 업그레이드 후 RAM8GB → 3~4)
BACKEND_MAX_CONCURRENCY=2

# 키워드 측정 주기 (시간 단위, 플랜별 차등)
KEYWORD_SCAN_INTERVAL_FREE_HOURS=720       # 월 1회
KEYWORD_SCAN_INTERVAL_BASIC_HOURS=168      # 주 1회
KEYWORD_SCAN_INTERVAL_PRO_HOURS=24         # 일 1회
KEYWORD_SCAN_INTERVAL_BIZ_HOURS=6          # 6시간
KEYWORD_SCAN_INTERVAL_ENT_HOURS=1          # 시간

# 카카오맵 자동 점검 주기 (시간 단위)
KAKAO_AUTOCHECK_INTERVAL_BASIC_HOURS=720   # 월 1회
KAKAO_AUTOCHECK_INTERVAL_PRO_HOURS=168
KAKAO_AUTOCHECK_INTERVAL_BIZ_HOURS=24

# 측정 시간대 분산 (CRON 충돌 방지)
SCAN_DISTRIBUTION_HOURS=24

# RAM peak 알람 임계
RAM_PEAK_ALERT_PERCENT=85
```

### 프론트엔드 (NEXT_PUBLIC_*)

기능 플래그(서버 업그레이드 후 토글):
```bash
NEXT_PUBLIC_FEATURE_HOURLY_KEYWORD_SCAN=false   # 업그레이드 후 true
NEXT_PUBLIC_FEATURE_BIZ_REALTIME=false          # Biz 시간 단위 동시성 가능 시 true
```

---

## 15. 부록 — 본 기획에서 의도적으로 제외한 것

| 제외 항목 | 이유 |
|---|---|
| 트랙별 가격 분리 (이전 검토안) | 사용자 결정으로 폐기. 단일 가격 + 메시지 분기로 대체 |
| 인스타그램·당근마켓 노출 | Phase C 이후 (현재 사용자 데이터 부족) |
| 네이버 데이터랩 API 직접 연동 | Phase C — 검색광고 API로 대체 가능 |
| 자동 회귀 테스트 (Playwright + pytest) | BEP 20명 이후 |
| 키워드 검색 결과 PC vs 모바일 분리 표시 | Phase B에서 검토 |
| 사용자 자체 결제 금액 변경 | 가격은 단일 라인 유지(혼란 방지) |

---

## 16. 핵심 의사결정 기록

### 16.1 확정 (2026-04-30 사용자 답변)

- **#1 DUAL_TRACK_RATIO**: legal(30:70)·shopping(20:80) 예외 유지, 나머지 23개 업종 55:45 통일
  - `score_engine.py:DUAL_TRACK_RATIO`에서 위 2개 업종만 명시, 나머지는 `DEFAULT_DUAL_TRACK_RATIO = {naver: 0.55, global: 0.45}`로 폴백
- **#2 INACTIVE 재분배**: 키워드 검색 +15%p + 스마트플레이스 +10%p (그룹별 가중치 §3.2 참조)
  - LIKELY는 +5%p / +5%p 적용
- **#3 키워드 입력 정책**: 신규 가입자 전 플랜 3개 의무 입력 + 자동 추천 1회 무료
  - `RegisterBusinessForm.tsx`에서 폼 제출 차단 (3개 미만)
  - 등록된 키워드는 사업장 정보 전체에 반영 (스캔·매뉴얼·트라이얼·보고서)

### 16.2 미확정 항목 (#4~#8) — 권장안으로 진행 가능

§13.2 표 참조. 사용자 별도 답변 없으면 권장안 일괄 채택하여 Phase A 진행.

---

*최종 업데이트: 2026-04-30 — v1.1 실측·사실 기반 재검토 반영*
*작성자: Claude Opus 4.7*
*검토 상태: 핵심 3개 확정 + 부수 5개 권장안 대기 / Phase A 착수 가능 (A-0 베이스라인 측정 선행 필수)*

---

## 17. 빈 상태·에러 폴백·검증 게이트 (작업 지침 #7 적용)

### 17.1 빈 상태 처리 (Empty State) — 신규 사용자 데이터 0건 시

| 화면 | 빈 상태 메시지 | 가짜 수치 사용 |
|---|---|---|
| 대시보드 키워드 순위 카드 | "아직 측정 데이터 없음 — 첫 스캔(N분 소요) 후 표시됩니다" + [지금 스캔] 버튼 | 금지 |
| 대시보드 점수 카드 | "키워드 3개 등록 + 첫 스캔 완료 시 점수 산출" + 진행 단계(2/2) | 금지 |
| 블로그 C-rank 카드 | "30일 내 발행 블로그 미발견 — 블로그 작성 가이드" + 링크 | 금지 |
| 카카오맵 카드 | "카카오맵 등록 정보 미확인 — 등록 안내" | 금지 |
| AI 인용 카드 | "AI 인용 0건 — 키워드·소개글 충실도 향상으로 인용 가능성 ↑" | 금지 |

### 17.2 에러 폴백 처리

| 에러 상황 | 표시 | 금지 |
|---|---|---|
| Playwright 키워드 측정 실패 | "측정 일시 실패 — 6시간 후 자동 재시도" + 회색 카드 | 무작위 순위 ❌ |
| Claude Haiku 자동 추천 실패 | "자동 추천 일시 사용 불가 — 수동 입력해주세요" + 베이스 키워드 5개 | 임의 추천 ❌ |
| 검색광고 API 실패 | "검색량 데이터 일시 사용 불가 — 키워드만 입력 가능" | 가짜 검색량 ❌ |
| Naver Place Stats 실패 | "스마트플레이스 자동 점검 실패 — 수동 체크박스 사용" | 임의 체크 ❌ |
| AI 브리핑 스캐너 실패 | "AI 브리핑 측정 일시 실패" + 회색 N/A | 가짜 인용 ❌ |
| Supabase 연결 끊김 | `_reset_client()` + 1회 재시도 (기존 패턴) | silent pass ❌ |

### 17.3 신규 기능 출시 전 검증 게이트

신규 기능을 사용자에게 노출하기 전 **반드시 통과해야 할 검증 항목**:

```
- [ ] TypeScript 컴파일: `npx tsc --noEmit` EXIT=0
- [ ] Python 구문: `ast.parse` OK
- [ ] 베타 사용자 1명 이상의 실제 데이터로 검증 화면 렌더링 확인
- [ ] 빈 상태 화면 (데이터 0건) 정상 표시 — "아직 데이터 없음" 메시지
- [ ] 에러 폴백 (의도적 실패 주입) 정상 표시 — 가짜 수치 없음
- [ ] 면책 문구 적용 (§5.3 위치 표 모두)
- [ ] 모바일·PC 양쪽 화면 검증
- [ ] Playwright RAM peak 측정 (`psutil` 로그)
- [ ] 환경변수 분리 (§14.5 가이드 적용)
- [ ] 실측 비용 검증 (Claude Haiku·외부 API 5건 호출 후 콘솔 비용 확인)
```

**모든 ✅ 통과 후에만 사용자에게 노출.** 미통과 시 기능 플래그(`NEXT_PUBLIC_FEATURE_*`) `false` 유지.

### 17.4 데이터 표기 원칙

| 표기 | 사용 조건 |
|---|---|
| 정확한 수치 (예: "키워드 노출 3위") | 실측 데이터, 측정 시점 함께 표시 |
| `(추정)` 회색 배지 + 근거 | 데이터 부족 시(예: "리뷰 미수집 — 업종 평균 사용") |
| `N/A` | API 실패 또는 측정 불가 |
| "아직 데이터 없음" | 신규 사용자, 첫 스캔 전 |
| 면책 문구 | 모든 변동 데이터 |

**금지:**
- "예시: ~위" 같은 더미 수치
- 계산 근거 없는 "약 N건" 표기
- "로딩 중" 화면 5초 이상 표시 (Skeleton UI 또는 진행률 표시)
- 부정확 표기를 정확 표기로 위장

---
