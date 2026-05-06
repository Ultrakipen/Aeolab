# 신뢰도·정확도 최우선 재설계 v2.0
# 스마트플레이스 감지 시스템 — 처음부터 다시 묻기

> 작성일: 2026-04-30 | 기반: smart_place_auto_check.py, naver_place_stats.py, score_engine.py
> 전제: BEP 20명 미달, 1인 개발, iwinv RAM 4GB, 추가 비용 0원
> 이 문서는 A/B/C 옵션 프레임에서 벗어나 "어떻게 하면 시스템이 거짓 정보를 주지 않는가"를 기본부터 재설계한다.

---

## 0. 설계 철학 및 원칙

### 원칙 1: 거짓 양성(False Positive)이 거짓 음성(False Negative)보다 나쁘다

**근거**: 시스템이 "FAQ 있음"이라고 했는데 실제로 없다면, 사용자는 자신의 사업장이 잘 갖춰진 것으로 착각하고 개선 행동을 취하지 않는다. 반대로 "FAQ 없음"이라고 했는데 실제로 있다면, 사용자는 불필요한 FAQ 등록 권고를 받는다. 이는 귀찮지만 신뢰를 깨지는 않는다.

**위반 시 발생 문제**: 소상공인이 AEOlab 점수를 믿고 "우리 가게는 FAQ 잘 되어 있어요"라고 홍보했다가 실제 없는 것이 밝혀지면 서비스 전체 신뢰를 잃는다. BEP 20명 미달 단계에서 이 한 번의 신뢰 훼손이 치명적이다.

**실천**: 불확실하면 boolean True를 반환하지 않는다. `null` 또는 `"uncertain"` 상태를 명시적으로 허용한다.

### 원칙 2: 모든 판정에 근거(Evidence)가 있어야 한다

**근거**: 현행 `_detect_faq(info_body)` 함수는 True/False만 반환한다. 왜 True인지 알 수 없다. 네이버 DOM이 바뀐 후 갑자기 모든 사업장이 has_faq=True가 되어도 알아채기 어렵다.

**위반 시 발생 문제**: 정규식이 CSS pseudo-selector에 오매칭되어도, 오탐이 발생해도, 코드 수정 후 회귀가 생겨도 추적 불가. 디버깅에 몇 시간이 소요된다.

**실천**: 모든 감지 함수는 `(result: bool, evidence: dict)` 형태로 반환. evidence에는 매칭된 패턴명, 매칭된 텍스트 스니펫, 사용된 URL, 스캔 시각을 포함한다.

### 원칙 3: 검증되지 않은 변경은 배포하지 않는다

**근거**: `_detect_faq_stats()` 정규식 `Q\.|Q:` 는 CSS `Q:before` 등과 오매칭 위험이 실측으로 확인됐다 (v1.1 §0). 그러나 이 코드는 회귀 테스트 없이 배포됐다. 홍스튜디오(naver_place_id=1752528839)에서 has_faq=True로 오탐될 수 있다는 것도 사후 분석으로 발견했다.

**위반 시 발생 문제**: 코드 변경 전 "정확도 X%"였는데 변경 후 "정확도 Y%"인지 알 수 없다. 개선인지 퇴보인지 구별이 안 된다.

**실천**: 감지 함수 변경 시 반드시 고정 테스트 케이스(fixture) 통과 여부 확인 후 배포. 자동화가 어려우면 최소한 수동 체크리스트를 유지한다.

### 원칙 4: 시스템이 자신의 정확도를 측정해야 한다

**근거**: 현재 AEOlab 감지 시스템의 정확도가 몇 %인지 아무도 모른다. 사용자가 "FAQ 있는데 없다고 나온다"고 민원을 제기하기 전까지는 오류를 발견할 방법이 없다.

**위반 시 발생 문제**: 1인 개발자가 매주 수동으로 감지 결과를 검증할 수 없다. 자동화되지 않으면 오류가 몇 달간 방치된다.

**실천**: 드리프트 통계(항목별 True/False 비율)를 주 1회 자동 계산하여 baseline에서 크게 벗어나면 알람. 사용자 정정 데이터를 자동 누적하여 정확도 추이를 추적한다.

### 원칙 5: 사용자에게 투명해야 한다

**근거**: 현재 대시보드는 "FAQ 감지됨" 또는 "FAQ 없음"만 표시한다. 사용자는 이 판정이 어떻게 나왔는지 알 수 없다. 오류라고 생각해도 정정할 수단이 없다.

**위반 시 발생 문제**: 사용자가 틀린 판정을 그대로 믿는다. 또는 틀렸다고 생각하지만 시스템을 바꿀 수 없어서 이탈한다. 어느 쪽이든 신뢰와 전환율 모두 손상이다.

**실천**: 판정 근거를 사용자에게 노출 (예: "Q&A 탭에서 'Q.1.' 텍스트 발견"). 사용자 정정 버튼 제공. 정정 시 이유를 선택하게 하여 개선 데이터로 활용.

---

## 1. 현 시스템 정확도 진단

### 1.1 현행 감지 함수별 False Positive / False Negative 위험 평가

이 진단은 코드 분석 + v1.1 실측 결과(2026-04-30 홍스튜디오 검증)를 결합한 것이다.

#### `_detect_faq()` — `smart_place_auto_check.py:276`

```python
has_section = bool(re.search(r"(Q\s*&\s*A|자주\s*묻는\s*질문|FAQ)", info_body, re.I))
has_question = bool(re.search(r"(Q\.|Q:|문의\s*질문)", info_body))
return has_section and has_question
```

**False Positive 위험: 높음 (확인됨)**

- `Q:` 패턴이 CSS 내 `Q:before`, `Q:hover`, `Q:focus` pseudo-selector에 매칭된다. Playwright의 `inner_text("body")`는 렌더된 텍스트만 반환하지만, CSS 클래스명이나 data 속성에 `Q:`가 포함된 경우 텍스트로 노출될 수 있다.
- v1.1 실측: 홍스튜디오 `/qna` 탭에 실제 FAQ 항목 없이 `"qna":"문의"` 레이블 1건만 존재. 현행 패턴에서 `Q:` 또는 `문의` 에 매칭되어 `has_faq=True` 오탐 가능.
- `FAQ` 섹션 헤더가 있는 페이지에서 실제 항목이 0개인 경우(빈 FAQ 섹션)도 오탐.

**False Negative 위험: 중간**

- 2024-02-15 이후 신 FAQ(톡톡 메뉴관리)는 현행 로직으로 감지 불가. 신 FAQ만 있는 사업장은 `has_faq=False` 오탐.
- 사장님이 FAQ를 한글 자연어 형태로만 작성한 경우(`Q.` / `Q:` 없음) `has_question=False`로 오탐.

**위험 등급: 위험 (즉시 수정 필요)**

---

#### `_detect_faq_stats()` — `naver_place_stats.py:369`

```python
has_section  = bool(re.search(r"(Q\s*&\s*A|자주\s*묻는\s*질문|FAQ|사장님\s*Q&A)", info_body, re.I))
has_question = bool(re.search(r"(Q\s*[\.:]|Q&A\s*\d|문의\s*질문)", info_body))
faq_count    = len(re.findall(r"Q\s*[:．]|질문\s*[:．]", info_body))
```

`smart_place_auto_check.py`의 `_detect_faq()`와 거의 동일한 구조. 동일한 위험 존재. 다만 `faq_count`를 추가로 반환하여 count=0인 경우 False로 판정하는 방어 로직 추가 가능.

**위험 등급: 위험 (동일 수정 필요)**

---

#### `_detect_intro()` / `_detect_intro_stats()` — 두 파일 모두

```python
m = re.search(r"(업체\s*소개|소개)[\s\S]{0,1500}", info_body)
block = m.group(0)
cleaned = re.sub(r"(업체\s*소개|소개)\s*", "", block, count=1)
cleaned = re.sub(r"\s+", "", cleaned)
return len(cleaned) >= 50
```

**False Positive 위험: 낮음~중간**

- "소개" 키워드 매칭 후 1500자 블록에서 헤더 제거. 실제 소개글이 아닌 내비게이션 메뉴나 영업시간 텍스트가 50자 이상이면 오탐 가능.
- `소개` 단어가 "업무 소개", "메뉴 소개"처럼 다른 섹션 헤더에 포함된 경우 잘못된 블록 추출.

**False Negative 위험: 낮음**

- 소개글이 "안내" 또는 "스토리" 등 다른 레이블로 표시된 경우 미감지.

**위험 등급: 주의 (개선 권장, 즉각적 위험 낮음)**

---

#### `_detect_recent_post()` / `_detect_recent_post_stats()` — 두 파일 모두

```python
if re.search(r"(\d+\s*시간\s*전|\d+\s*분\s*전|방금|오늘|어제)", feed_body):
    return True
m_day = re.search(r"(\d+)\s*일\s*전", feed_body)
```

**False Positive 위험: 중간**

- "30일 전" 패턴: 31일 전 게시물이 있고 최근 다른 날짜 형식으로 표시되면 오탐.
- `/feed` 탭에 게시물 없이 "소식을 올리세요" 유도 문구 또는 네이버 공지가 날짜와 함께 노출된 경우 오탐.
- "오늘 열기" 같은 운영시간 관련 텍스트에 "오늘" 매칭.

**False Negative 위험: 낮음**

- 절대 날짜(YYYY.MM.DD)로만 표시된 경우 30일 계산 로직으로 처리됨. 정상.

**위험 등급: 주의 (false negative보다 false positive 위험 있음)**

---

#### `is_smart_place` 판정 — `smart_place_auto_check.py:148`

```python
if home_text and not re.search(
    r"(존재하지 않|삭제|찾을 수 없|페이지를 찾을 수 없)", home_text
):
    results["is_smart_place"] = True
```

**False Positive 위험: 낮음**

- `/place/{id}/home` 200 응답이지만 사업장 데이터가 아닌 경우. 예: 네이버 오류 페이지가 200을 반환하면서 위 키워드를 포함하지 않는 경우. 드물지만 가능.

**False Negative 위험: 낮음**

- 스마트플레이스는 등록됐지만 로드 실패(timeout)하는 경우 False 반환. 이는 의도된 안전한 동작.

**위험 등급: 양호 (현행 유지 가능)**

---

### 1.2 시스템 전체 정확도 추정 (현재 상태)

| 항목 | FP 위험 | FN 위험 | 추정 정확도 |
|------|---------|---------|-----------|
| is_smart_place | 낮음 | 낮음 | ~90% |
| has_faq | 높음 (CSS 오탐 + 빈 섹션) | 높음 (신 FAQ 미감지) | ~55~65% |
| has_recent_post | 중간 | 낮음 | ~75~80% |
| has_intro | 중간 | 낮음 | ~80~85% |
| **전체 (4항목 모두 정확)** | — | — | **~35~45%** |

전체 4항목이 모두 정확할 확률은 각 확률의 곱. 현 시스템은 10명 중 5~7명에게 적어도 1개 항목에서 잘못된 판정을 줄 가능성이 있다. 이는 소상공인에게 그릇된 개선 방향을 제시하는 것과 같다.

---

## 2. 검증 인프라 (Part A)

### 2.1 HTML 샘플 저장소

**목적**: 네이버 DOM이 변경됐을 때 "이전에 작동했던 텍스트 샘플"을 보존하여 회귀 테스트에 사용.

#### 구조

```
backend/tests/fixtures/naver_place/
├── README.md                          # 각 파일의 수집 방법·일시 설명
├── 1752528839_home_20260430.txt       # 홍스튜디오 홈 탭
├── 1752528839_information_20260430.txt
├── 1752528839_feed_20260430.txt
├── 1752528839_qna_20260430.txt
├── sample_restaurant_with_faq.txt     # FAQ 있는 레스토랑 (ground truth: True)
├── sample_restaurant_no_faq.txt       # FAQ 없는 레스토랑 (ground truth: False)
├── sample_cafe_with_intro.txt         # 소개글 있는 카페
└── sample_cafe_no_intro.txt           # 소개글 없는 카페
```

#### 수집 방법

1인 개발 환경에서 자동 수집 인프라를 별도로 구축하는 것은 과투자다. 대신:

1. **스캔 실행 시 샘플 자동 저장** (선택적, 환경변수로 제어):
   ```python
   # backend/services/smart_place_auto_check.py 상단
   _SAVE_FIXTURE = os.getenv("AEOLAB_SAVE_FIXTURES", "").lower() == "true"
   
   # _run_check() 내 탭별 텍스트 저장 후:
   if _SAVE_FIXTURE and home_text:
       fixture_path = f"tests/fixtures/naver_place/{naver_place_id}_home_{date.today()}.txt"
       with open(fixture_path, "w", encoding="utf-8") as f:
           f.write(home_text[:10000])
   ```
   
   개발 환경에서만 `AEOLAB_SAVE_FIXTURES=true`로 설정. 서버에서는 비활성화.

2. **수동 추가**: 운영자가 실제 사업장에서 확인한 "정답 케이스"를 수동으로 fixture 폴더에 추가.

#### Ground Truth 레이블 파일

```json
// backend/tests/fixtures/naver_place/ground_truth.json
{
  "1752528839": {
    "label": "홍스튜디오 (창원 photo)",
    "collected_at": "2026-04-30",
    "source": "manual_verification",
    "items": {
      "is_smart_place": true,
      "has_faq": false,
      "has_recent_post": null,
      "has_intro": true
    },
    "notes": "qna 탭에 '문의' 레이블만 있음. 실제 FAQ 항목 없음. 소개글 있음(확인)."
  },
  "sample_restaurant_with_faq": {
    "label": "테스트용 레스토랑 (FAQ 있음)",
    "collected_at": "2026-04-30",
    "source": "fixture_manual",
    "items": {
      "is_smart_place": true,
      "has_faq": true,
      "has_recent_post": true,
      "has_intro": true
    }
  }
}
```

`has_recent_post: null`은 "알 수 없음" 상태. Ground truth에서도 불확실한 항목은 null로 처리하고 해당 항목은 테스트에서 제외한다.

### 2.2 회귀 테스트 구조

#### 파일 구조

```
backend/tests/
├── test_smart_place_detection.py    # 핵심 감지 함수 단위 테스트
├── test_detection_fixtures.py       # fixture 파일 기반 통합 테스트
└── run_detection_audit.py           # 수동 실행용 정확도 감사 스크립트
```

#### `test_smart_place_detection.py` 핵심 테스트 케이스

```python
"""
감지 함수 단위 테스트 — pytest 기반.
네트워크 접근 없이 텍스트 입력만으로 테스트.
"""
import pytest
from services.smart_place_auto_check import _detect_faq, _detect_intro, _detect_recent_post
from services.naver_place_stats import _detect_faq_stats, _detect_intro_stats

class TestDetectFaq:
    def test_empty_body_returns_false(self):
        has_faq, evidence = _detect_faq_v2("")
        assert has_faq is False
        assert evidence["matched_pattern"] is None

    def test_no_faq_text_returns_false(self):
        body = "영업시간: 10:00-22:00\n소개: 맛있는 카페입니다."
        has_faq, evidence = _detect_faq_v2(body)
        assert has_faq is False

    def test_css_pseudo_selector_not_matched(self):
        # 핵심: CSS Q: 오탐 방지 검증
        body = "Q:before { content: ''; } Q:hover { color: blue; }\nQ&A 섹션"
        has_faq, evidence = _detect_faq_v2(body)
        # Q&A 섹션 헤더는 있지만 실제 Q&A 항목 없으므로 False여야 함
        assert has_faq is False

    def test_real_faq_items_returns_true(self):
        body = "Q&A\nQ. 주차가 가능한가요?\nA. 네, 건물 주차장을 이용하세요.\nQ. 예약 필수인가요?\nA. 예약 없이 방문 가능합니다."
        has_faq, evidence = _detect_faq_v2(body)
        assert has_faq is True
        assert evidence["faq_item_count"] >= 2

    def test_empty_faq_section_returns_false(self):
        # 빈 FAQ 섹션 오탐 방지
        body = "Q&A\n등록된 Q&A가 없습니다.\nFAQ"
        has_faq, evidence = _detect_faq_v2(body)
        assert has_faq is False

    def test_naver_qa_label_only_returns_false(self):
        # 홍스튜디오 케이스: "문의" 레이블만 있고 실제 항목 없음
        body = '{"qna":"문의"}\nQ&A'
        has_faq, evidence = _detect_faq_v2(body)
        assert has_faq is False

class TestDetectIntro:
    def test_sufficient_intro_returns_true(self):
        intro_text = "업체 소개: " + "저희 스튜디오는 창원에서 15년간 " * 5  # 충분한 길이
        has_intro, evidence = _detect_intro_v2(intro_text)
        assert has_intro is True
        assert evidence["char_count"] >= 50

    def test_short_intro_returns_false(self):
        body = "업체 소개: 안녕"
        has_intro, evidence = _detect_intro_v2(body)
        assert has_intro is False

class TestDetectRecentPost:
    def test_hours_ago_returns_true(self):
        body = "3시간 전\n소식 내용"
        has_recent, evidence = _detect_recent_post_v2(body)
        assert has_recent is True

    def test_no_post_message_returns_false(self):
        body = "등록된 소식이 없습니다."
        has_recent, evidence = _detect_recent_post_v2(body)
        assert has_recent is False

    def test_business_hours_today_not_matched(self):
        # "오늘" 텍스트가 영업시간 문구에 있을 때 오탐 방지
        body = "오늘 영업시간: 10:00-22:00"
        # has_recent_post는 feed 탭 텍스트만 대상 — 맥락상 이 케이스는 feed 탭에 노출 안 됨
        # 단, 만약 feed 탭에 영업시간이 포함된다면 오탐. 이 케이스를 명시적으로 기록.
        has_recent, evidence = _detect_recent_post_v2(body)
        # 이 테스트는 현재 오탐이 발생할 수 있음을 문서화하는 의미
        assert evidence["matched_pattern"] in (None, "today_keyword")  # 어느 쪽이든 기록

class TestFixtureRegression:
    """ground_truth.json 기반 회귀 테스트."""
    
    def test_1752528839_has_faq_false(self):
        """홍스튜디오: has_faq=False가 정답."""
        with open("tests/fixtures/naver_place/1752528839_qna_20260430.txt") as f:
            qna_text = f.read()
        has_faq, evidence = _detect_faq_v2(qna_text)
        assert has_faq is False, (
            f"홍스튜디오 has_faq 오탐! evidence={evidence}. "
            "네이버 '문의' 레이블이 FAQ로 잘못 감지됨."
        )
```

**실행 방법**:
```bash
cd backend
python -m pytest tests/test_smart_place_detection.py -v
```

네트워크 없이 실행 가능 (텍스트 입력만 사용). CI/CD 없어도 배포 전 로컬에서 수동 실행 가능.

### 2.3 배포 전 검증 파이프라인

1인 개발 환경에서 자동 CI/CD는 과투자다. 대신 **배포 전 체크리스트**를 코드 옆에 README로 유지한다.

#### `backend/tests/DEPLOY_CHECKLIST.md`

```markdown
## 감지 함수 변경 시 배포 전 필수 확인

1. [ ] `python -m pytest tests/test_smart_place_detection.py -v` 전체 통과
2. [ ] 홍스튜디오(1752528839) fixture 테스트 통과
3. [ ] `_detect_faq_v2("")` 빈 문자열 테스트 통과
4. [ ] CSS pseudo-selector 오탐 테스트 통과
5. [ ] ground_truth.json에 새 케이스 추가했는가
6. [ ] CLAUDE.md 변경 이력 기록했는가
```

Git commit hook으로 자동화하지 않는다 (1인 개발 부담). 대신 Slack/이메일 배포 알림에 "체크리스트 확인 필수" 문구를 포함한다.

---

## 3. 감지 엔진 v2 (Part B)

### 3.1 다중 방법 검증 아키텍처

핵심 원칙: **한 가지 신호로 판정하지 않는다.** 두 가지 이상의 독립적 신호가 일치할 때만 높은 신뢰도로 판정한다.

#### FAQ 감지 v2 — 다중 방법

| 신호 | 방법 | 가중치 |
|------|------|--------|
| S1: 부재 확인 | "등록된 Q&A가 없" 패턴 → 확실한 False | 결정적 (다른 신호 무시) |
| S2: 섹션 헤더 | `Q&A|자주 묻는 질문|FAQ` 존재 | 필요 조건 (충분하지 않음) |
| S3: 실제 항목 | `Q. 내용\nA. 답변` 패턴 (Q와 A가 쌍으로) | 핵심 신호 (+60점) |
| S4: 항목 수량 | Q. 또는 Q: 패턴 매칭 개수 >= 1 | 보조 신호 (+20점) |
| S5: 답변 존재 | `A.` 또는 `답변:` 패턴이 Q 다음에 존재 | 확인 신호 (+20점) |

```python
def _detect_faq_v2(info_body: str) -> tuple[bool, dict]:
    """
    FAQ 감지 v2 — 다중 신호 기반, 근거(Evidence Trail) 반환.
    
    Returns:
        (has_faq: bool, evidence: dict)
        evidence = {
            "matched_pattern": str | None,    # 매칭된 패턴명
            "matched_text": str | None,        # 매칭된 텍스트 스니펫 (최대 100자)
            "faq_item_count": int,             # 감지된 FAQ 항목 수
            "confidence": float,               # 0.0~1.0
            "method": str,                     # 판정 방법 설명
            "signals": dict,                   # 각 신호별 결과
        }
    """
    empty_evidence = {
        "matched_pattern": None, "matched_text": None,
        "faq_item_count": 0, "confidence": 0.0,
        "method": "no_signal", "signals": {}
    }
    
    if not info_body:
        return False, empty_evidence
    
    signals = {}
    
    # S1: 명시적 부재 메시지 — 결정적 False
    if re.search(r"(등록된\s*(Q&A|질문|문의)가\s*없|아직\s*등록된\s*(Q&A|질문)이\s*없)", info_body):
        signals["s1_absence"] = True
        return False, {
            **empty_evidence,
            "method": "explicit_absence_message",
            "confidence": 0.95,
            "signals": signals,
        }
    signals["s1_absence"] = False
    
    # S2: 섹션 헤더 존재
    section_match = re.search(r"(Q\s*&\s*A|자주\s*묻는\s*질문|FAQ|사장님\s*Q&A)", info_body, re.I)
    signals["s2_section_header"] = bool(section_match)
    
    # S3: Q+A 쌍 패턴 — 가장 신뢰성 높은 신호
    # 주의: Q: 단독은 CSS pseudo-selector 오탐 위험. Q. 다음 줄에 A. 패턴만 신뢰.
    qa_pairs = re.findall(
        r"Q\s*[\.\：]\s*([^\n]{5,100})\s*\n\s*A\s*[\.\：]",
        info_body, re.MULTILINE
    )
    signals["s3_qa_pairs"] = len(qa_pairs)
    
    # S4: 항목 수량 (Q. 단독, 최소 3자 이상 내용)
    # CSS Q:hover 오탐 방지: Q 다음에 .(점) 또는 ．(전각 점)만 허용, : (콜론) 제외
    faq_items = re.findall(r"Q\s*[\.\．]\s*[^\n]{3,}", info_body)
    # CSS/JS 코드처럼 보이는 경우 제외 (영문+특수문자만으로 구성된 경우)
    faq_items = [item for item in faq_items if re.search(r"[가-힣]", item)]
    signals["s4_item_count"] = len(faq_items)
    
    # S5: 답변 존재 확인
    answer_matches = re.findall(r"A\s*[\.\：]\s*[^\n]{5,}", info_body)
    answer_matches = [a for a in answer_matches if re.search(r"[가-힣]", a)]
    signals["s5_answer_count"] = len(answer_matches)
    
    # 신뢰도 계산
    confidence = 0.0
    matched_pattern = None
    matched_text = None
    faq_item_count = 0
    
    if signals["s3_qa_pairs"] >= 1:
        # Q+A 쌍이 1개 이상 있으면 높은 신뢰도
        confidence = 0.90
        matched_pattern = "qa_pair_pattern"
        matched_text = qa_pairs[0][:100] if qa_pairs else None
        faq_item_count = len(qa_pairs)
    elif signals["s2_section_header"] and signals["s4_item_count"] >= 2:
        # 섹션 헤더 + Q. 항목 2개 이상
        confidence = 0.75
        matched_pattern = "section_with_items"
        matched_text = faq_items[0][:100] if faq_items else None
        faq_item_count = len(faq_items)
    elif signals["s2_section_header"] and signals["s4_item_count"] == 1 and signals["s5_answer_count"] >= 1:
        # 섹션 헤더 + Q. 1개 + A. 1개
        confidence = 0.60
        matched_pattern = "section_with_single_item"
        matched_text = faq_items[0][:100] if faq_items else None
        faq_item_count = 1
    elif signals["s2_section_header"] and signals["s4_item_count"] == 0:
        # 섹션 헤더만 있고 실제 항목 없음 — 빈 FAQ 섹션 또는 미등록
        confidence = 0.10  # 불확실하지만 낮은 신뢰도로 False
        matched_pattern = "empty_section_header"
        faq_item_count = 0
    
    # 임계값: confidence >= 0.60이면 True
    has_faq = confidence >= 0.60
    
    return has_faq, {
        "matched_pattern": matched_pattern,
        "matched_text": matched_text,
        "faq_item_count": faq_item_count,
        "confidence": round(confidence, 2),
        "method": "multi_signal_v2",
        "signals": signals,
    }
```

### 3.2 Confidence Score 모델

각 항목별 신뢰도 기준:

| 항목 | 신호 조합 | 신뢰도 | 판정 |
|------|-----------|--------|------|
| has_faq | 명시적 부재 메시지 | 0.95 | False |
| has_faq | Q+A 쌍 >= 1 | 0.90 | True |
| has_faq | 섹션 헤더 + Q. 항목 >= 2 | 0.75 | True |
| has_faq | 섹션 헤더 + Q. 항목 1 + A. 1 | 0.60 | True |
| has_faq | 섹션 헤더만 (항목 0) | 0.10 | False |
| has_faq | 어떤 신호도 없음 | 0.00 | False |
| has_intro | 소개 헤더 + 한글 50자 이상 | 0.85 | True |
| has_intro | 소개 헤더만 (50자 미만) | 0.20 | False |
| has_recent_post | 명시적 부재 메시지 | 0.95 | False |
| has_recent_post | N분/시간 전 패턴 (feed 탭 한정) | 0.85 | True |
| has_recent_post | N일 전 (N<=30) | 0.80 | True |
| has_recent_post | 절대 날짜 (30일 이내) | 0.75 | True |
| is_smart_place | HTTP 200 + 비오류 텍스트 | 0.85 | True |

**임계값 정책**: 0.60 미만이면 `False`. 0.60~0.80은 UI에서 "확인 필요" 배지 표시. 0.80 이상은 자동 판정.

### 3.3 Evidence Trail 데이터 구조

모든 스캔 결과에 근거를 함께 저장한다. `smart_place_completeness_result` JSONB 컬럼을 활용한다.

```json
{
  "scanned_at": "2026-04-30T14:23:11Z",
  "base_url": "https://m.place.naver.com/place/1752528839",
  "is_smart_place": {
    "value": true,
    "confidence": 0.85,
    "method": "http_200_no_error_text",
    "evidence": {}
  },
  "has_faq": {
    "value": false,
    "confidence": 0.95,
    "method": "explicit_absence_message",
    "evidence": {
      "matched_pattern": "explicit_absence_message",
      "matched_text": "등록된 Q&A가 없습니다",
      "faq_item_count": 0,
      "signals": {
        "s1_absence": true,
        "s2_section_header": true,
        "s3_qa_pairs": 0,
        "s4_item_count": 0,
        "s5_answer_count": 0
      }
    }
  },
  "has_recent_post": {
    "value": true,
    "confidence": 0.80,
    "method": "relative_date_pattern",
    "evidence": {
      "matched_pattern": "n_days_ago",
      "matched_text": "5일 전",
      "days": 5
    }
  },
  "has_intro": {
    "value": true,
    "confidence": 0.85,
    "method": "section_header_with_content",
    "evidence": {
      "matched_pattern": "intro_section_50plus",
      "char_count": 143,
      "snippet": "저희 홍스튜디오는 창원에서..."
    }
  },
  "version": "v2.0",
  "user_verified": null
}
```

`user_verified` 필드는 사용자 정정 후 `{"has_faq": false, "verified_at": "..."}` 형태로 업데이트된다.

### 3.4 불일치 처리 정책

| 상황 | 처리 방법 |
|------|----------|
| confidence >= 0.80 | 자동 판정. UI에 "확인됨" 표시 |
| 0.60 <= confidence < 0.80 | 자동 판정하되 UI에 "추정값 — 직접 확인 가능" 배지 |
| confidence < 0.60 | "확인 필요" 표시. 점수에는 0으로 반영. 사용자에게 직접 체크 요청 |
| 스캔 실패 (타임아웃 등) | "자동 확인 실패 — 직접 체크 가능" 표시. 점수 0으로 반영 |
| 사용자 정정 후 | confidence 무시하고 사용자 값 우선 적용. 정정 이력 DB 저장 |

---

## 4. 사용자 피드백 루프 (Part C)

### 4.1 정정 UX 설계

#### 현행 UI 문제

현재 대시보드에서 스마트플레이스 완성도 항목은 체크박스로만 표시된다. 사용자가 "FAQ 없음"이라고 나왔는데 실제로 있는 경우 수정할 방법이 없다.

#### v2 UX 설계

각 판정 항목 옆에 두 가지 요소를 추가한다:

1. **근거 툴팁** (i 버튼):
   - "Q&A 탭에서 'Q+A 쌍' 패턴 2건 발견 (신뢰도 90%)" 형태
   - 신뢰도 < 0.80이면 "추정값" 배지 추가

2. **정정 버튼**:
   - "이 판정이 틀렸나요?" 클릭 → 인라인 팝업
   - 선택지: "실제로는 있습니다" / "실제로는 없습니다" / "잘 모르겠습니다"
   - 선택 후 이유 텍스트 (선택 입력)
   - 저장 시 즉시 점수에 반영 (사용자 값 우선)

#### 프론트엔드 컴포넌트 수정 범위

- `frontend/components/dashboard/SmartPlaceCheckCard.tsx` 또는 관련 컴포넌트에 `DetectionBadge` 서브컴포넌트 추가
- confidence < 0.80이면 `"추정"` 배지 (amber/orange 색상)
- 정정 버튼 → `POST /api/businesses/{biz_id}/detection-correction` 호출

#### 백엔드 엔드포인트

```python
# backend/routers/business.py 추가
@router.post("/{biz_id}/detection-correction")
async def correction_detection(
    biz_id: str,
    body: DetectionCorrectionRequest,  # field: str, correct_value: bool, reason: str
    user = Depends(get_current_user)
):
    """사용자가 감지 결과를 직접 정정하는 엔드포인트."""
    # 1. businesses 테이블의 해당 필드 업데이트 (has_faq, has_intro 등)
    # 2. detection_corrections 테이블에 정정 이력 저장
    # 3. 정정된 필드는 자동 감지보다 우선 적용 (manual_override=true 플래그)
```

#### DB: 정정 이력 저장

```sql
-- 신규 테이블 (소규모이므로 별도 테이블로 분리)
CREATE TABLE IF NOT EXISTS detection_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  field VARCHAR(50) NOT NULL,        -- 'has_faq', 'has_intro', 등
  original_value BOOLEAN,            -- 시스템 판정값
  original_confidence FLOAT,         -- 시스템 신뢰도
  corrected_value BOOLEAN NOT NULL,  -- 사용자 정정값
  reason TEXT,                       -- 사용자 입력 이유
  corrected_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_corrections_biz ON detection_corrections(business_id, field);
```

### 4.2 운영자 검증 큐

신뢰도 < 0.60인 판정은 운영자 큐에 자동 추가된다. 1인 개발자는 이 큐를 주 1회 확인하고, 수동으로 사업장 플레이스 페이지를 방문해 실제 상태를 확인한다. 확인 결과를 ground_truth.json에 추가한다.

```python
# backend/scheduler/jobs.py 추가
async def detection_audit_queue_job():
    """신뢰도 낮은 감지 결과 수집 — 매주 금요일 09:00 KST
    
    conditions:
    - smart_place_completeness_result JSONB에 confidence < 0.60인 항목이 있는 경우
    - 최근 7일 이내 스캔 결과만 대상
    
    action:
    - 해당 business_id 목록을 개발자 이메일로 발송
    - "이 사업장들의 감지 결과를 수동으로 확인해주세요" + 플레이스 URL 목록
    """
```

### 4.3 정확도 개선 학습 루프

정정 데이터가 5건 이상 누적된 항목에 대해 주 1회 정확도 분석 실행:

```python
# backend/scheduler/jobs.py 추가
async def detection_accuracy_report_job():
    """정정 이력 기반 정확도 분석 — 매주 월요일 06:00 KST
    
    분석 내용:
    - 항목별 정정 횟수 (has_faq 정정 N건, has_intro 정정 N건 등)
    - 방향성: 시스템이 True→False 정정이 많은가 vs False→True 정정이 많은가
      (True→False 정정 多 = False Positive 과다, 원칙 1 위반)
    - confidence 구간별 정정률: 0.6~0.8 구간 정정률이 높으면 임계값 조정 고려
    
    출력: 개발자 이메일 + logs
    """
```

**가중치 자동 변경 금지**: 정정 데이터가 제안하더라도 감지 로직을 자동으로 변경하지 않는다. 분석 결과를 보고 개발자가 수동으로 정규식·임계값을 수정한 후, 반드시 회귀 테스트를 통과시킨 다음 배포한다.

---

## 5. 드리프트 감지 (Part D)

### 5.1 Baseline 모니터링

네이버 DOM이 변경되면 모든 사업장의 특정 항목 True/False 비율이 갑자기 변한다. 이를 통계적으로 감지한다.

#### Baseline 정의

현재 구독자 데이터가 없으므로 trial_scans 데이터를 활용한다. 최초 30건의 스캔 결과에서 항목별 비율을 baseline으로 설정한다.

| 항목 | 예상 baseline 범위 (소상공인 일반) |
|------|----------------------------------|
| has_faq | 20~40% (네이버 공식 가이드 권장 기능이지만 실제 등록률 낮음) |
| has_intro | 60~80% (스마트플레이스 등록 초기에 대부분 입력) |
| has_recent_post | 30~50% (월 1회 이상 소식 게시하는 사업장) |
| is_smart_place | 85~95% (trial_scans는 place_id 있는 케이스만 있음) |

#### 드리프트 알람 조건

```python
# backend/scheduler/jobs.py 추가
async def detection_drift_monitor_job():
    """감지 결과 드리프트 모니터링 — 매주 수요일 07:00 KST
    
    로직:
    1. 최근 7일 스캔 결과에서 항목별 True 비율 계산
    2. baseline 대비 20%p 이상 차이 나면 알람
       예: has_faq baseline=30%, 최근 7일=5% → 드리프트 의심
    3. 알람 발송: 개발자 이메일 + WARNING 로그
    """
    from db.supabase_client import get_client
    supabase = get_client()
    
    # 최근 7일 scan_results에서 smart_place_completeness_result JSONB 분석
    # ... (구현 의사 코드)
    
    DRIFT_THRESHOLDS = {
        "has_faq": {"baseline_min": 0.20, "baseline_max": 0.40, "alert_delta": 0.20},
        "has_intro": {"baseline_min": 0.60, "baseline_max": 0.80, "alert_delta": 0.20},
        "has_recent_post": {"baseline_min": 0.30, "baseline_max": 0.50, "alert_delta": 0.20},
    }
    
    alerts = []
    for field, thresholds in DRIFT_THRESHOLDS.items():
        # 최근 7일 비율 계산
        recent_rate = ...  # DB 쿼리
        baseline_center = (thresholds["baseline_min"] + thresholds["baseline_max"]) / 2
        if abs(recent_rate - baseline_center) > thresholds["alert_delta"]:
            alerts.append({
                "field": field,
                "recent_rate": recent_rate,
                "baseline": f"{thresholds['baseline_min']*100:.0f}%~{thresholds['baseline_max']*100:.0f}%",
                "delta": abs(recent_rate - baseline_center),
            })
    
    if alerts:
        await email_sender.send_drift_alert(alerts)
        _logger.warning(f"Detection drift detected: {alerts}")
```

### 5.2 정규식 매칭률 모니터링

Evidence Trail을 활용하여 어떤 패턴이 얼마나 매칭되는지 추적한다.

매주 1회 분석:
- `matched_pattern=None` (어떤 신호도 없음) 비율이 급증하면 DOM 변경 의심
- 특정 패턴의 매칭률이 갑자기 0%가 되면 해당 패턴 더 이상 작동하지 않음

```python
# backend/scheduler/jobs.py (detection_drift_monitor_job 내 추가)
# matched_pattern 분포 집계
pattern_distribution = {}
for scan in recent_scans:
    sp_result = scan.get("smart_place_completeness_result") or {}
    for field in ["has_faq", "has_intro", "has_recent_post"]:
        pattern = (sp_result.get(field) or {}).get("evidence", {}).get("matched_pattern", "none")
        key = f"{field}:{pattern}"
        pattern_distribution[key] = pattern_distribution.get(key, 0) + 1

_logger.info(f"Pattern distribution (recent 7d): {pattern_distribution}")
```

### 5.3 자동 Fallback

드리프트 알람 발생 시 자동으로 점수 계산에서 해당 항목을 "불확실" 처리한다. 개발자가 수동으로 정규식을 수정·검증·배포할 때까지:

```python
# backend/services/score_engine.py
def calc_smart_place_completeness(naver_data: dict, biz: dict) -> float:
    # ...기존 로직...
    
    # Fallback: 드리프트 상태인 항목은 0.5 (neutral) 처리
    _DRIFTED_FIELDS = set(os.getenv("DETECTION_DRIFTED_FIELDS", "").split(","))
    # 예: DETECTION_DRIFTED_FIELDS=has_faq → 환경변수로 제어
    
    if "has_faq" in _DRIFTED_FIELDS:
        has_faq = None  # neutral — 점수에 0.5로 반영
    # ...
```

환경변수로 제어하므로 코드 배포 없이 즉시 fallback 적용 가능. `pm2 restart aeolab-backend` 또는 systemd reload로 적용.

---

## 6. 점수 시스템 통합 (Part E)

### 6.1 Confidence를 점수에 반영하는 방식

#### 현행 방식의 문제

`calc_smart_place_completeness()`는 `has_faq=True`이면 25점을 그대로 부여한다. 이 True 판정이 confidence 0.62인지 0.95인지 구별하지 않는다.

#### v2 방식: Confidence 가중 점수

```python
def calc_smart_place_completeness_v2(naver_data: dict, biz: dict, sp_result: dict = None) -> float:
    """
    스마트플레이스 완성도 점수 v2 — confidence 반영.
    
    sp_result: smart_place_completeness_result JSONB (scan_results 저장값)
    """
    
    def _get_value_and_confidence(field: str, fallback_from_biz: bool = None) -> tuple[bool | None, float]:
        """sp_result에서 값과 신뢰도를 가져온다. 없으면 biz의 체크박스 값 사용."""
        # 사용자 정정값이 있으면 최우선 (confidence=1.0)
        if biz.get(f"{field}_manual_override"):
            return biz.get(field), 1.0
        # sp_result (자동 감지 결과)
        if sp_result and field in sp_result:
            item = sp_result[field]
            return item.get("value"), item.get("confidence", 0.5)
        # biz 체크박스 (구버전 데이터 하위호환)
        if fallback_from_biz is not None:
            return fallback_from_biz, 0.70  # 체크박스는 사용자가 직접 입력했으므로 70% 신뢰도 부여
        return None, 0.0
    
    is_smart_place, sp_conf = _get_value_and_confidence("is_smart_place", biz.get("is_smart_place") or bool(biz.get("naver_place_id")))
    has_faq, faq_conf = _get_value_and_confidence("has_faq", biz.get("has_faq"))
    has_recent_post, post_conf = _get_value_and_confidence("has_recent_post", biz.get("has_recent_post"))
    has_intro, intro_conf = _get_value_and_confidence("has_intro", biz.get("has_intro"))
    
    # 순위 점수 (기존과 동일)
    _rank = naver_data.get("my_rank") or naver_data.get("naver_place_rank")
    rank_score = (30 if _rank == 1 else 20 if _rank and _rank <= 5 else 12 if _rank and _rank <= 10 else 5 if _rank else 0)
    
    def _score_with_confidence(raw_score: float, value: bool | None, confidence: float) -> float:
        """
        confidence 반영 점수 계산.
        - value=True, confidence>=0.80: raw_score 전부
        - value=True, confidence 0.60~0.80: raw_score × confidence (추정값 할인)
        - value=True, confidence<0.60: 0 (불확실 — 점수 없음)
        - value=False: 0
        - value=None: 0 (데이터 없음)
        """
        if not value:
            return 0.0
        if confidence >= 0.80:
            return raw_score
        elif confidence >= 0.60:
            return raw_score * confidence  # 예: 25점 × 0.70 = 17.5점
        else:
            return 0.0  # 원칙 1: 불확실하면 주지 않는다
    
    return min(100, (
        _score_with_confidence(25, is_smart_place, sp_conf) +
        rank_score +
        _score_with_confidence(25, has_faq, faq_conf) +
        _score_with_confidence(15, has_recent_post, post_conf) +
        _score_with_confidence(5, has_intro, intro_conf)
    ))
```

### 6.2 사용자에게 보여주는 점수의 투명성

#### 점수 breakdown UI 개선

현재 "스마트플레이스 완성도: 70점" 처럼 점수만 표시한다. v2에서는:

```
스마트플레이스 완성도: 62점 / 100점

  ✅ 스마트플레이스 등록: +25점
  ✅ 지역 검색 3위: +20점
  ⚠️ FAQ: 0점 (추정 — 자동 감지에서 FAQ 항목을 찾지 못했습니다. 실제로 있다면 직접 확인해주세요.)
  ✅ 소식 게시 (3일 전): +12점  [신뢰도 80%]
  ✅ 소개글: +5점
```

"추정" 배지는 confidence < 0.80인 항목에 표시. 사용자가 직접 확인하도록 안내.
FAQ 미감지 시 "실제로 있다면 정정하기" 버튼 제공.

#### 전체 점수의 투명성

```
AI 가시성 점수: 68점 (Track1 기반)

[i] 이 점수는 자동 감지 결과를 기반으로 합니다.
추정값이 포함된 항목: FAQ (-25점 미적용 중)
실제 상태를 확인해 정정하면 점수가 달라질 수 있습니다.
```

---

## 7. 단계별 구현 (Part F)

### 단계 0: 즉시 (오늘, 0.5일)

**목적**: 가장 위험한 False Positive 제거.

**작업**:
1. `smart_place_auto_check.py`의 `_detect_faq()` 정규식에서 `Q:` 패턴 제거. `Q\.` 단독 패턴 + 한글 내용 필수 조건 추가.
2. `naver_place_stats.py`의 `_detect_faq_stats()` 동일 수정.
3. URL `/restaurant/` → `/place/` 통일 + fallback 추가 (`smart_place_auto_check.py:115`, `naver_place_stats.py:173,177`).

**검증 (배포 전)**:
- 빈 문자열 입력 → False 확인
- `"Q&A\n등록된 Q&A가 없습니다"` → False 확인
- `"Q&A\nQ. 주차 가능한가요?\nA. 네 가능합니다"` → True 확인

**출구 조건**: 회귀 테스트 3개 수동 통과.
**롤백**: git revert 1개 커밋.

---

### 단계 1: 단기 (1~2일)

**목적**: Evidence Trail 기반 감지 엔진 v2 도입.

**작업**:
1. `_detect_faq_v2()`, `_detect_intro_v2()`, `_detect_recent_post_v2()` 함수 구현 (§3.1 코드 기반).
2. 기존 함수는 유지하고 새 함수를 `_v2` 접미사로 병렬 추가.
3. `smart_place_auto_check.py`와 `naver_place_stats.py`에서 `_v2` 함수 호출로 교체.
4. 반환값에 evidence dict 포함.
5. `scan_results.smart_place_completeness_result` JSONB에 evidence Trail 저장.

**공수 추정**: 4~6시간.

**검증 (배포 전)**:
- `test_smart_place_detection.py` 전체 통과.
- 홍스튜디오(1752528839) fixture 테스트: `has_faq=False` 확인.

**출구 조건**: fixture 테스트 통과 + 서버 배포 후 1건 이상 스캔 실행 시 `smart_place_completeness_result`에 evidence dict 저장 확인.

**롤백**: `_v2` 함수 미사용으로 설정 (기존 함수 복원, 환경변수로 제어).

---

### 단계 2: 중기 (3~5일)

**목적**: 점수 계산에 confidence 반영 + 사용자 정정 UX.

**작업**:
1. `calc_smart_place_completeness_v2()` 구현 (§6.1).
2. `score_engine.py`에서 `_v2` 함수 호출.
3. `backend/routers/business.py`에 `POST /{biz_id}/detection-correction` 엔드포인트 추가.
4. `detection_corrections` 테이블 생성 (Supabase SQL Editor).
5. 프론트 `SmartPlaceCheckCard`에 근거 툴팁 + 정정 버튼 추가.

**공수 추정**: 8~12시간.

**DB 변경**:
```sql
CREATE TABLE IF NOT EXISTS detection_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  field VARCHAR(50) NOT NULL,
  original_value BOOLEAN,
  original_confidence FLOAT,
  corrected_value BOOLEAN NOT NULL,
  reason TEXT,
  corrected_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_corrections_biz ON detection_corrections(business_id, field);

-- businesses 테이블에 manual_override 플래그 추가
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS has_faq_manual_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_intro_manual_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_recent_post_manual_override BOOLEAN DEFAULT FALSE;
```

**출구 조건**: 테스트 사업장에서 "FAQ 있음 → 없음 정정" 플로우가 end-to-end 작동. 점수 즉시 반영 확인.
**롤백**: 기존 `calc_smart_place_completeness()` 복원 (함수 교체 취소).

---

### 단계 3: 중기 (1주일)

**목적**: 드리프트 감지 + 정확도 모니터링 자동화.

**작업**:
1. `detection_drift_monitor_job()` 구현 (§5.1).
2. `detection_accuracy_report_job()` 구현 (§4.3).
3. `detection_audit_queue_job()` 구현 (§4.2).
4. `backend/tests/fixtures/naver_place/` 폴더 생성 + 홍스튜디오 fixture 추가.
5. `backend/tests/test_smart_place_detection.py` 작성 (§2.2).
6. `AEOLAB_SAVE_FIXTURES` 환경변수 로직 추가.

**공수 추정**: 6~8시간.

**출구 조건**: 매주 금요일 audit 이메일 수신 확인. 드리프트 테스트: 환경변수로 `has_faq` baseline을 임의로 낮게 설정해 알람 발생 여부 확인.
**롤백**: 잡 중단 (scheduler에서 해당 잡 제거). 점수 로직에 영향 없음.

---

### 단계 4: 장기 (구독자 20명 이후)

**목적**: 데이터 기반 가중치 개선.

**작업**:
1. `briefing_signal_analysis_job()` 구현 (v1.1 §2.3 설계 활용).
2. `scan_results.naver_briefing_attributes` JSONB 컬럼 추가.
3. 스캔 실행 시 naver_briefing_attributes 저장.
4. 업종별 N=30 이상 확보 후 가중치 분석 실행.
5. 분석 결과 기반 `NAVER_TRACK_WEIGHTS` 수동 업데이트.

**출구 조건**: 업종별 30건 이상 데이터 확보 + 분석 결과에서 통계적으로 유의미한 패턴 발견.

---

## 8. 운영 환경 제약 적합성 (Part G)

### 1인 개발 유지 가능성

| 설계 요소 | 유지보수 부담 | 적합성 판단 |
|-----------|-------------|------------|
| Evidence Trail (JSON 저장) | 낮음 — 스캔 시 자동 저장, 코드 변경 불필요 | 적합 |
| 드리프트 모니터링 잡 | 낮음 — 주 1회 자동 실행, 이메일만 확인 | 적합 |
| Fixture 기반 회귀 테스트 | 중간 — 배포마다 수동 실행. 자동화 미적용 | 수용 가능 |
| 사용자 정정 UX | 중간 — 프론트 + 백엔드 추가 구현 필요 | 단계 2에서 투자 |
| 자동 가중치 조정 | 없음 — 의도적으로 제외 (수동만) | 적합 |
| CI/CD 자동 테스트 | 없음 — 수동 체크리스트로 대체 | 적합 (BEP 이전) |

### RAM 4GB 제약

- 드리프트 모니터링 잡: DB 쿼리만. Playwright 없음. RAM 영향 없음.
- 정정 이력 잡: DB 쿼리만. 영향 없음.
- 스캔 시 evidence 저장: 기존 Playwright 스캔 내에서 추가 처리. 수 KB JSONB. 영향 없음.
- Playwright Semaphore(1) 유지: 변경 없음.

### 데이터셋 크기 (BEP 미달)

**문제**: trial_scans 데이터만으로는 분석용 N이 부족할 수 있다.

**대응**:
- 단계 0~2는 데이터 없이도 적용 가능 (코드 레벨 개선, 사용자 정정 UX).
- 드리프트 감지는 절대 수치보다 변화율(전주 대비 비율 변화)을 보면 N=10으로도 작동.
- 경쟁사 스캔 데이터(매주 자동)를 briefing_attributes에 포함하면 구독자 0명에서도 N 누적 가능.

### 추가 비용 0원 준수

- 모든 감지 로직은 기존 Playwright 스캔 내에서 처리 (추가 API 호출 없음).
- Evidence Trail은 기존 `smart_place_completeness_result` JSONB 컬럼 활용 (신규 컬럼 추가 없음).
- 드리프트 잡은 DB 쿼리만 (Gemini/Claude 호출 없음).
- 정정 이력은 신규 테이블이지만 Supabase Free Tier 내 충분히 수용 가능.

---

## 9. 위험 및 한계

### 이 설계가 해결하지 못하는 문제

#### 한계 1: 신 FAQ(톡톡 메뉴관리) 감지 불가

신 FAQ는 플레이스 페이지 → 톡톡 버튼 → 채팅창 내부에 노출된다. Playwright로 채팅창에 진입하는 것은 기술적으로 가능하지만:
- 로그인 상태가 필요할 가능성 높음
- 채팅창 UI가 자주 변경됨
- RAM 부담 증가 (추가 탭)

**이 설계의 입장**: 신 FAQ 감지를 "현재 구현하지 않는다"고 명시한다. 대신 UI에서 "신 FAQ(톡톡 메뉴관리)는 자동 감지가 어렵습니다. 사장님이 직접 확인해주세요" 안내문을 표시한다. 이는 거짓 정보를 주는 것보다 낫다.

#### 한계 2: Playwright 렌더링 의존성

`inner_text("body")`는 JS 렌더링 후 텍스트를 반환한다. 네이버가 SSR→CSR 방식을 바꾸거나 봇 감지를 강화하면 전체 감지 시스템이 중단된다.

**이 설계의 입장**: 드리프트 감지가 이를 조기에 발견하고 알람을 보낸다. 근본적 해결책(공식 API)은 네이버가 제공하지 않는 이상 불가능하다. 이 위험을 사용자에게 투명하게 알린다.

#### 한계 3: 데이터셋 크기 한계

BEP 20명 미달 상태에서 통계적으로 신뢰할 수 있는 가중치 분석(업종당 N=30)은 3~6개월 이상 걸릴 수 있다.

**이 설계의 입장**: 단계 0~2는 데이터 없이 즉시 적용 가능한 코드 품질 개선이다. 데이터 기반 개선(단계 4)은 구독자 확보 후 자연스럽게 실행한다. 데이터가 없을 때는 외부 공개 가이드(네이버 공식, 2025.08)를 기준으로 삼는 것이 현재 최선이다.

#### 한계 4: 사용자 정정 데이터의 신뢰성

사용자가 정정 버튼을 잘못 사용할 수 있다 (실제로 FAQ가 없는데 "있음"으로 정정). 이를 검증할 방법이 없다.

**이 설계의 입장**: 사용자 정정 데이터는 사용자 본인의 점수에만 반영하고, 전체 가중치 학습에는 사용하지 않는다. 운영자 검증 큐(주 1회 수동 확인)에서 이상한 정정 패턴을 모니터링한다.

---

## 10. 결론 및 즉시 시작 가능한 첫 작업

### 이 설계의 핵심 3가지

**핵심 1: boolean → (value, confidence, evidence) 삼중 반환**

현행 `True/False` 반환을 `(판정값, 신뢰도, 근거)` 삼중으로 변경한다. 이것 하나로 원칙 1,2,5가 동시에 해결된다. 신뢰도가 낮으면 점수를 줄이거나 0으로 처리 (원칙 1). 근거가 저장되어 디버깅 가능 (원칙 2). 사용자에게 근거 표시 가능 (원칙 5).

**핵심 2: CSS Q: 오탐 제거가 즉각적 위험**

현행 `Q:` 패턴은 CSS pseudo-selector와 충돌한다. 홍스튜디오처럼 실제 FAQ가 없는데 "Q&A" 헤더와 JSON 내 "문의" 문자열이 있는 경우 has_faq=True로 오탐할 수 있다. 이 하나의 수정이 단계 0의 전부이며, 오늘 당장 할 수 있다.

**핵심 3: 드리프트 감지가 시스템 수명을 결정**

네이버 DOM은 언제든 바뀐다. 정확한 정규식을 만드는 것보다, DOM이 바뀌었을 때 빠르게 감지하는 모니터링이 더 중요하다. 드리프트 잡이 없으면 오류가 몇 달간 방치된다.

### 첫 작업 (오늘 당장)

**단계 0: 즉각 수정 — 30분**

`smart_place_auto_check.py:276~285`의 `_detect_faq()`:
1. `Q:` 패턴을 `Q\.` 로만 제한 + 한글 포함 필터 추가
2. `naver_place_stats.py:369~378`의 `_detect_faq_stats()` 동일 수정
3. `smart_place_auto_check.py:115` URL `/restaurant/` → `/place/` 변경
4. `naver_place_stats.py:173,177` URL 동일 변경

그 다음: 텍스트 3개로 수동 검증 후 git commit.

### 전체 공수 추정

| 단계 | 작업 | 공수 |
|------|------|------|
| 0 | URL + 정규식 즉각 수정 | 0.5일 |
| 1 | Evidence Trail 감지 엔진 v2 | 1~2일 |
| 2 | Confidence 점수 반영 + 정정 UX | 2~3일 |
| 3 | 드리프트 감지 + 모니터링 잡 | 1~1.5일 |
| 4 | 데이터 기반 가중치 개선 | 구독자 20명 이후 |
| **합계 (단계 0~3)** | | **5~8일** |

단계 0~1은 사용자에게 보이는 변화 없이 내부 정확도만 개선된다. 단계 2부터 사용자가 체감하는 변화가 나타난다 (근거 툴팁, 정정 버튼). 단계 3은 운영자만 영향을 받는다. 비용 추가 없음.

---

*작성: 2026-04-30 | 참고: v1.0/v1.1 실측 검증 + CLAUDE.md 운영 원칙*
*다음 버전: v3.0 — 데이터 기반 가중치 개선 (단계 4, 구독자 20명 이후)*
