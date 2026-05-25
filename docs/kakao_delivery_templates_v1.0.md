# 카카오 알림톡 대행 서비스 템플릿 신청 가이드 v1.0

> 작성일: 2026-05-25 | 대상: AEOlab 대행 서비스 AEOLAB_DELIVERY_01~04
> 신청처: 카카오 비즈센터 → 알림톡 → 템플릿 관리 → 새 템플릿 추가

---

## 0. 사전 준비

| 항목 | 확인 |
|------|------|
| 카카오 비즈센터 계정 | https://business.kakao.com |
| AEOlab 카카오 채널 | 이미 개설됨 (기존 5종 알림톡 승인 채널) |
| 채널 검색용 ID | AEOlab 채널 ID 확인 후 동일 채널에 신청 |

> 기존 `AEOLAB_SCORE_01`, `AEOLAB_CITE_01` 등 5종 승인 채널과 **같은 채널**에 추가 신청합니다.

---

## 1. AEOLAB_DELIVERY_01 — 대행 서비스 접수 완료

### 발송 시점
결제 완료 직후 (토스페이먼츠 서버 검증 → status `paid` 전환 시)

### 코드 연동
```
delivery.py → confirm_delivery_payment() → KakaoNotifier.send_delivery_received()
환경변수: KAKAO_TEMPLATE_DELIVERY_01
```

### 템플릿 코드 (비즈센터 입력용)
```
AEOLAB_DELIVERY_01
```

### 템플릿 본문 (비즈센터 "메시지 내용" 칸에 그대로 입력)

```
[AEOlab] 대행 서비스 접수 완료

안녕하세요, AEOlab입니다.
#{사업장명}의 대행 서비스 신청이 완료되었습니다.

■ 주문번호: #{주문번호}
■ 신청 패키지: #{패키지명}

영업일 3일 내 담당자가 연락드려 작업을 시작합니다.
진행 현황은 아래 링크에서 확인하실 수 있습니다.
```

### 버튼 (비즈센터 "버튼 설정" 칸)

| 버튼명 | 유형 | URL |
|--------|------|-----|
| 주문 상세 보기 | 웹링크 | `https://aeolab.co.kr/delivery/orders` |

### 치환 변수 목록

| 변수 | 설명 | 예시 |
|------|------|------|
| `#{주문번호}` | 내부 UUID 앞 20자 | `a1b2c3d4-e5f6-...` |
| `#{패키지명}` | 패키지 한글명 | `AI 검색 최적화` |
| `#{사업장명}` | 사업장 이름 | `강남 맛집` |

---

## 2. AEOLAB_DELIVERY_02 — 작업 시작 알림

### 발송 시점
운영자가 관리자 페이지에서 status → `in_progress` 전환 시

### 코드 연동
```
delivery.py → admin_update_status() → _send_status_kakao() → KakaoNotifier.send_delivery_in_progress()
환경변수: KAKAO_TEMPLATE_DELIVERY_02
```

### 템플릿 코드
```
AEOLAB_DELIVERY_02
```

### 템플릿 본문

```
[AEOlab] 대행 서비스 작업 시작

안녕하세요, AEOlab입니다.
#{사업장명}의 대행 서비스 작업이 시작되었습니다.

■ 주문번호: #{주문번호}
■ 신청 패키지: #{패키지명}
■ 예상 완료: 영업일 #{예상일수}일 이내

작업 완료 시 별도 안내 드리겠습니다.
궁금한 점은 아래 버튼으로 확인해 주세요.
```

### 버튼

| 버튼명 | 유형 | URL |
|--------|------|-----|
| 주문 상세 보기 | 웹링크 | `https://aeolab.co.kr/delivery/orders` |

### 치환 변수 목록

| 변수 | 설명 | 예시 |
|------|------|------|
| `#{주문번호}` | 내부 UUID 앞 20자 | `a1b2c3d4-e5f6-...` |
| `#{패키지명}` | 패키지 한글명 | `스마트플레이스 등록 대행` |
| `#{사업장명}` | 사업장 이름 | `강남 맛집` |
| `#{예상일수}` | 영업일 기준 (기본값 3) | `3` |

---

## 3. AEOLAB_DELIVERY_03 — 작업 완료 알림

### 발송 시점
운영자가 status → `completed` 전환 또는 완료 보고서 등록 시

### 코드 연동
```
delivery.py → admin_update_status() / admin_complete_order()
  → _send_status_kakao("completed") → KakaoNotifier.send_delivery_completed()
환경변수: KAKAO_TEMPLATE_DELIVERY_03
```

### 템플릿 코드
```
AEOLAB_DELIVERY_03
```

### 템플릿 본문

```
[AEOlab] 대행 서비스 완료

안녕하세요, AEOlab입니다.
#{사업장명}의 대행 서비스가 완료되었습니다.

■ 주문번호: #{주문번호}
■ 완료 패키지: #{패키지명}

완료 보고서와 재스캔 결과는 주문 상세에서 확인하실 수 있습니다.
후기를 작성해 주시면 추가 혜택을 드립니다.
```

### 버튼

| 버튼명 | 유형 | URL |
|--------|------|-----|
| 완료 보고서 보기 | 웹링크 | `https://aeolab.co.kr/delivery/orders` |

### 치환 변수 목록

| 변수 | 설명 | 예시 |
|------|------|------|
| `#{주문번호}` | 내부 UUID 앞 20자 | `a1b2c3d4-e5f6-...` |
| `#{패키지명}` | 패키지 한글명 | `종합 풀패키지` |
| `#{사업장명}` | 사업장 이름 | `강남 맛집` |

---

## 4. AEOLAB_DELIVERY_04 — 재스캔 결과 (점수 변화)

### 발송 시점
작업 완료 후 재스캔 점수가 기록된 시점 (현재는 **수동 호출** — 자동화 미구현)

> **현재 상태**: `KakaoNotifier.send_delivery_rescan()` 함수는 구현됐으나, 재스캔 자동 발송 트리거는 미구현. 운영자가 수동으로 스캔 → 점수 업데이트 후 별도 발송 또는 향후 자동화 연결 예정.

### 코드 연동
```
delivery.py → (미연결) → KakaoNotifier.send_delivery_rescan()
환경변수: KAKAO_TEMPLATE_DELIVERY_04
```

### 템플릿 코드
```
AEOLAB_DELIVERY_04
```

### 템플릿 본문

```
[AEOlab] 대행 후 AI 노출 점수 변화

안녕하세요, AEOlab입니다.
#{사업장명}의 대행 서비스 후 재스캔 결과를 알려드립니다.

■ 주문번호: #{주문번호}
■ 작업 전 점수: #{점수전}점
■ 작업 후 점수: #{점수후}점

상세 변화 내역은 대시보드에서 확인하실 수 있습니다.
```

### 버튼

| 버튼명 | 유형 | URL |
|--------|------|-----|
| 점수 변화 보기 | 웹링크 | `https://aeolab.co.kr/dashboard` |

### 치환 변수 목록

| 변수 | 설명 | 예시 |
|------|------|------|
| `#{주문번호}` | 내부 UUID 앞 20자 | `a1b2c3d4-e5f6-...` |
| `#{사업장명}` | 사업장 이름 | `강남 맛집` |
| `#{점수전}` | 작업 전 AI 노출 점수 | `42.5` |
| `#{점수후}` | 작업 후 AI 노출 점수 | `61.3` |

---

## 5. 비즈센터 신청 순서 (공통)

1. **카카오 비즈센터** https://business.kakao.com 접속
2. 좌측 메뉴 → **알림톡** → **템플릿 관리**
3. **새 템플릿 추가** 클릭
4. 아래 항목 순서대로 입력:

| 항목 | 입력값 |
|------|--------|
| 카카오톡 채널 | AEOlab 기존 채널 선택 |
| 템플릿 코드 | `AEOLAB_DELIVERY_01` (각 번호별로) |
| 템플릿명 | `대행 접수 완료` / `작업 시작` / `작업 완료` / `재스캔 결과` |
| 메시지 유형 | 기본형 |
| 메시지 내용 | 위 본문 그대로 복사·붙여넣기 |
| 버튼 | 위 버튼 설정 |

5. **저장 후 검수 요청** → 보통 1~2 영업일 내 승인
6. 승인 후 서버 `.env`에 템플릿 코드 등록:

```bash
# 서버 .env에 추가
KAKAO_TEMPLATE_DELIVERY_01=AEOLAB_DELIVERY_01
KAKAO_TEMPLATE_DELIVERY_02=AEOLAB_DELIVERY_02
KAKAO_TEMPLATE_DELIVERY_03=AEOLAB_DELIVERY_03
KAKAO_TEMPLATE_DELIVERY_04=AEOLAB_DELIVERY_04
```

7. PM2 재시작:

```bash
ssh root@115.68.231.57 'pm2 restart aeolab-backend'
```

---

## 6. 승인 후 동작 흐름

```
사용자 결제 완료
    → DELIVERY_01 (접수 완료) 자동 발송

운영자: 관리자 페이지 /admin → 상태 in_progress 전환
    → DELIVERY_02 (작업 시작) 자동 발송

운영자: 완료 보고서 등록 또는 상태 completed 전환
    → DELIVERY_03 (작업 완료) 자동 발송

운영자: 재스캔 실행 후 수동 호출 (현재) / 향후 자동화
    → DELIVERY_04 (점수 변화) 발송
```

---

## 7. 검수 거부 시 수정 포인트

카카오 알림톡 검수 거부 사유 TOP 3:

| 사유 | 수정 방법 |
|------|----------|
| 광고성 문구 포함 | "추가 혜택" 표현 삭제 또는 순화 |
| 치환 변수 형식 오류 | `#{변수명}` 형식 정확히 일치 확인 |
| 버튼 URL 불일치 | 실제 서비스 URL과 동일 도메인 사용 |

---

## 8. 환경변수 미설정 시 동작

`KAKAO_TEMPLATE_DELIVERY_01~04` 미설정 → **graceful skip** (debug 로그만, 주문 플로우에 영향 없음)

`KAKAO_APP_KEY` 미설정 → **graceful skip** (동일)

템플릿 신청 전에도 대행 서비스 주문·결제·상태 변경 전체 정상 동작.

---

*최종 업데이트: 2026-05-25 | 코드 기반: backend/routers/delivery.py + backend/services/kakao_notify.py*
