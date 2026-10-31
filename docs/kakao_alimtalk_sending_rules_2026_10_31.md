# 카카오 알림톡 발송 규칙·장애 기록 (2026-10-31)

알림톡이 전체 이력에서 성공 0건이던 장애의 원인·수정과, 앞으로 알림을 만들 때 지킬 규칙. 시험은 모두 관리자 번호로 1건씩 실제 발송해 응답 코드를 확인했다.

## 확정된 규칙 (실측)
1. `templateParameter` 키는 변수 **이름만** (`사업장명`). `#{사업장명}`으로 보내면 `-3004 Please check template parameter`. 코드는 `kakao_notify._template_params`가 껍데기를 벗긴다.
2. 승인 본문의 변수를 **하나도 빼지 않고** 채운다(예: SCORE_01의 `스캔일시`).
3. **변수 값은 14자 이하.** 15자부터 전체 실패(`-1028 ... more than 14 characters in template value`). 긴 문장은 자르지 말고 짧은 대체 문구(`_short`)로, 마지막 안전망으로 14자 절단. 사업장명도 해당.
4. **자유 문구는 보낼 수 없다.** 알림톡은 승인된 본문의 변수만 채운다. `AEOLAB_NOTICE_01`은 존재하지 않는 템플릿(`-3003`)이고, 다른 승인 코드에 자유 문구를 얹으면 `-3004`. `_send_raw`는 기본 꺼짐(`KAKAO_ALLOW_FREE_TEXT`).
5. 전화번호는 숫자만(`01012345678`), 빈 번호·형식 오류는 NHN을 부르지 않는다(`_normalize_phone`).
6. 응답이 HTTP 200이어도 `header.isSuccessful`이 false면 실패(`_kakao_response_ok`). 수신자별 사유는 `_kakao_failure_summary`가 로그에 남긴다.

## 템플릿별 변수 (콘솔 승인 본문 기준)
| 코드 | 변수 | 코드 연결 |
|---|---|---|
| SCORE_01 | 사업장명·이전점수·현재점수·변화·이전순위·현재순위·스캔일시 | `send_score_change` |
| ACTION_01 | 사업장명·기준일·할일목록(14자) | `send_action_items`, `send_post_remind` |
| CITE_01 | 사업장명·AI플랫폼·검색어·인용내용·확인일시 | `send_ai_citation`, `send_first_exposure` |
| COMP_01 | 사업장명·경쟁사명·순위변화·확인일시 | `send_competitor_change` |
| COMP_02 | 사업장명·경쟁사명·내등급·경쟁사등급·격차설명 | `send_competitor_overtake` |
| GROWTH_01 | 사업장명·이전단계·현재단계·이번주추천 | `send_growth_stage_upgrade` |
| MONTHLY_01 | 월·사업장명·추세·스캔횟수·인용건수 | `send_monthly_report` |
| NEWS_01 | 사업장명·업종·시장동향 | `send_market_news` |
| SCAN_01 | 사업장명·현재등급·등급변화메모·추세·최다플랫폼·개선포인트 | `send_scan_complete` |
| WEEKLY_01 | 사업장명·등급변화·추세방향·할일 | `send_weekly_score_report` |
| EXPIRE_01 | 플랜명·잔여일 | `send_expire_warning` |
| PRICEUP_01 | 정상가 | `send_price_increase_notice` |
| PAYFAIL_01 / SUSPEND_01 / RESUME_01 / CANCEL_01 | (없음) | `send_payment_failed` / `send_suspended` / `send_payment_recovered` / `send_subscription_cancelled`(환불 없음) |
| DELIVERY_01~04 | 주문번호·패키지명·사업장명(+예상일수 / 등급변화) | `send_delivery_*` |
| ALERT_01 | 사업장명·별점·리뷰내용·리뷰링크 | 해당 잡 제거됨(10-28) |
| SCOREMODEL01 | name | 1회성 v3.1 안내 — 미연결 |

## 사용자 몫: 환불 포함 해지 안내 템플릿 등록 (미등록 상태)
환불 완료 안내(7일 이내 자동 환불)에 맞는 승인 템플릿이 없어 현재 **발송하지 않고 기록만** 한다(`KAKAO_TEMPLATE_CANCEL_REFUND` 미설정). 환불 안내는 사용자에게 중요하므로 등록 후 설정할 것.

- 제안 코드: `AEOLAB_CANCEL_02`, 이름: 구독 해지 및 환불 완료
- 본문 제안:
```
[AEOlab]
구독 해지 및 전액 환불이 완료되었습니다.

환불 금액: #{환불금액}
영업일 기준 3~5일 내 결제하신 수단으로 환불됩니다.
```
- 변수 `#{환불금액}` 예: `8,950원` (14자 이내). 정보성 알림이라 별도 "해당 메시지는…" 안내 문구는 CANCEL_01과 같은 수준으로 맞출 것(검수 반려 시 NHN 제시 예시 따름).
- 승인 후: 서버 `backend/.env`에 `KAKAO_TEMPLATE_CANCEL_REFUND=AEOLAB_CANCEL_02` 추가(`source` 금지, 편집 후 `pm2 restart aeolab-backend`), 관리자 번호로 환불 경로 시험 1건.

## 아직 보낼 수 없는 알림 (승인 템플릿 없음 — 자유 문구 경로라 건너뜀)
관리자 일괄 공지(`/admin` 공지 발송, 응답에 `failed` 건수 추가), 갭 카드 URL, 키워드 알림, 소식 초안, 월간 성장 카드, 리뷰 인박스, 신규 경쟁사 발견, 브리핑 변화, 경쟁사 급등, 체험 후 전환 안내(D+7/D+30), v3.1 점수 모델 안내. 필요하면 템플릿을 새로 등록하고 `TEMPLATES`+변수 발송으로 연결한다. 체험 후 전환 안내는 광고성 정보라 수신 동의 검토 후.
`detect_new_competitors`는 발송 실패 시 `notifications`에 이력을 남기지 않도록 바꿨다(이전에는 미발송인데 '발송됨' 기록).

## 해지·만료 사용자 차단 (사용자 결정)
`services/notify_gate.py` — 구독 이력이 있고 서비스 기간이 끝난 계정의 번호에는 보내지 않는다. 구독 상태 안내는 제외. `NOTIFY_SUBSCRIPTION_GATE=false`로 해제.
