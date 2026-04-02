# AEOlab 서비스 현황 문서

> **버전:** v1.0 | **작성일:** 2026-04-01 | **기준:** 실제 서버 코드 점검 결과  
> **서버:** https://aeolab.co.kr | **백엔드 API 버전:** 3.0.0  

---

## 1. 서비스 개요

### 한 줄 정의
한국 소상공인을 위한 **AI 검색 노출 관리 플랫폼**

### 핵심 문제
손님이 ChatGPT·네이버 AI·Google AI에 "근처 맛집 추천해줘"라고 물었을 때 내 가게가 나오는가?  
→ 이를 수치로 측정하고, 경쟁사와 비교하며, 개선 방법을 알려주는 서비스

### 3대 사용자
| 사용자 유형 | 니즈 |
|------------|------|
| 소상공인 | 내 가게의 AI 검색 노출 수준 파악 + 경쟁사 비교 + 개선 방법 |
| 시장 조사자 | 업종·지역별 AI 노출 경쟁 강도 분석 |
| 예비 창업자 | 창업 전 시장 AI 노출 경쟁 현황 파악 |

---

## 2. 핵심 모델 — 듀얼트랙 AI 가시성 점수 (v3.0)

### 개념
단일 점수 대신 **두 가지 채널로 분리** 측정

```
통합 점수 = Track1(네이버 AI) × 업종별 비중 + Track2(글로벌 AI) × 업종별 비중
```

### Track 1 — 네이버 AI 브리핑 준비도 (오프라인 매장 핵심)

| 항목 | 가중치 | 설명 |
|------|--------|------|
| 키워드 커버리지 | 35% | 리뷰에 담긴 업종별 키워드 분포 — 없는 키워드 즉시 확인 |
| 리뷰 수·평점·다양성 | 25% | 리뷰 많고 평점 높을수록 AI 추천 빈도 상승 |
| 스마트플레이스 완성도 | 25% | FAQ·소개글·최근 소식 — AI 브리핑의 직접 인용 경로 |
| 네이버 AI 브리핑 노출 | 15% | 실제 네이버 AI 브리핑에 가게 이름 언급 여부 |

### Track 2 — 글로벌 AI 가시성 (ChatGPT·Gemini·Google 등)

| 항목 | 가중치 | 설명 |
|------|--------|------|
| 글로벌 AI 노출 빈도 | 40% | Gemini 100회 반복 검색 — 정확한 AI 노출 확률(%) |
| 웹사이트·정보 구조화 | 30% | AI가 읽을 수 있는 JSON-LD·블로그 콘텐츠 최적화 |
| 온라인 언급 빈도 | 20% | 블로그·SNS·카페에서 가게 이름 언급 횟수 |
| Google AI 노출 | 10% | Google AI Overview에서 가게 정보 노출 여부 |

### 업종별 듀얼트랙 비율 (9개 업종)

| 업종 | T1 네이버 | T2 글로벌 | 특이사항 |
|------|----------|----------|---------|
| 음식점·카페 | 70% | 30% | 네이버 중심 |
| 병원·한의원 | 60% | 40% | |
| 학원·교육 | 60% | 40% | |
| 미용·뷰티 | 65% | 35% | |
| 법률·세무 | 20% | 80% | 글로벌 AI 중심 |
| 쇼핑몰 | 10% | 90% | 글로벌 AI 중심 |
| 기타 오프라인 | 60% | 40% | 기본값 |
| 전문직 서비스 | 30% | 70% | |
| 미디어·콘텐츠 | 15% | 85% | |

### 성장 단계 (Track1 점수 기준)

| 단계 | 점수 범위 | 설명 |
|------|----------|------|
| 생존기 | 0~30점 | AI 검색에 거의 노출 안 됨 |
| 안정기 | 30~55점 | 기본 노출은 되나 경쟁사에 뒤처짐 |
| 성장기 | 55~75점 | 경쟁력 있는 AI 노출 |
| 지배기 | 75~100점 | 해당 업종·지역 AI 검색 상위 |

---

## 3. AI 스캔 엔진 구성

### 사용 AI 플랫폼 (7개)

| 플랫폼 | 역할 | 방식 |
|--------|------|------|
| **Gemini Flash** | 노출 빈도 100회 샘플링 (핵심 지표) | API |
| **ChatGPT (GPT-4o-mini)** | 인용 예시 확인 | API |
| **Perplexity** | 출처 기반 검색 노출 | API |
| **Grok** | 최신 정보 검색 노출 | API |
| **네이버 AI 브리핑** | 실제 네이버 AI 브리핑 DOM 파싱 | Playwright |
| **Claude (Haiku)** | AI 플랫폼 노출 확인 | API |
| **Google AI Overview** | 구글 SGE 노출 확인 | Playwright |

> Trial 스캔: Gemini 10회 (비용 절감) / 풀 스캔: Gemini 100회 + 나머지 6개 병렬

---

## 4. 전체 기능 목록

### 4-1. AI 가시성 진단

| 기능 | 플랜 | 설명 |
|------|------|------|
| 무료 원샷 체험 | 무료 | 로그인 없이 즉시 진단, 하루 3회 제한 |
| 풀 AI 스캔 (수동) | Basic+ | 7개 AI 병렬 스캔, 플랜별 일 1~무제한 |
| 자동 스캔 | Basic+ | 스케줄러 자동 실행 (플랜별 주기 상이) |
| 실시간 SSE 스캔 | Basic+ | 스캔 진행률 실시간 화면 표시 |

### 4-2. 대시보드

| 기능 | 플랜 | 설명 |
|------|------|------|
| 듀얼트랙 점수 카드 | Basic+ | T1/T2 분리 점수 + 성장 단계 + 없는 키워드 3개 |
| 30일 추세 차트 | Basic+ | 점수 변화 시계열 (Pro: 90일, Biz: 무제한) |
| 업종 벤치마크 | Basic+ | 내 점수 vs 업종 평균 vs 상위 10% |
| 시장 현황 분석 | Basic+ | 업종·지역 경쟁 강도 시장 현황 |

### 4-3. 경쟁사 관리

| 기능 | 플랜 | 설명 |
|------|------|------|
| 경쟁사 검색·등록 | Basic+ | 카카오 로컬 / 네이버 검색 / 직접 입력 3가지 방식 |
| 경쟁사 AI 점수 비교 | Basic+ | 경쟁사별 AI 노출 점수 자동 측정 |
| 갭 분석 (GapCard) | Basic+ | 1위 경쟁사와 6개 차원 격차 수치화 |
| 신규 경쟁사 감지 | Basic+ | 매주 자동으로 새 경쟁자 탐지 알림 |
| 경쟁사 수 한도 | - | Basic: 3개 / 창업·Pro: 10개 / Biz: 무제한 |

### 4-4. 개선 가이드 (Claude Sonnet 생성)

| 기능 | 플랜 | 설명 |
|------|------|------|
| AI 개선 가이드 | Basic+ | 내 데이터 기반 맞춤 가이드 생성 |
| 성장 단계별 액션 플랜 | Basic+ | "이번 주 할 것 / 하지 말 것" |
| AI 브리핑 4경로 가이드 | Pro+ | FAQ·리뷰답변·소식·소개글 즉시 복사 문구 |
| ChatGPT 광고 대응 가이드 | Pro+ | SearchGPT 광고 도입 시 유기적 노출 유지 전략 |
| 가이드 생성 횟수 | - | Basic: 월 1회 / 창업·Pro: 월 5회 / Biz: 월 20회 |

### 4-5. 리뷰 관리

| 기능 | 플랜 | 설명 |
|------|------|------|
| 리뷰 답변 초안 생성 | Basic+ | 긍정·부정·일반 리뷰별 Claude 생성 초안 |
| 리뷰 키워드 갭 | Basic+ | 보유·부족·경쟁사 전용 키워드 시각화 + QR 유도 문구 |
| 월 생성 횟수 | - | Basic: 10회 / Pro: 30회 / Biz: 무제한 |

### 4-6. JSON-LD Schema 생성

| 기능 | 플랜 | 설명 |
|------|------|------|
| Schema 자동 생성 | Basic+ | LocalBusiness·FAQ JSON-LD 자동 생성 |
| 홈페이지 삽입 코드 제공 | Basic+ | 복사·붙여넣기용 완성 코드 |

### 4-7. Before / After 히스토리

| 기능 | 플랜 | 설명 |
|------|------|------|
| 스캔 전후 스크린샷 | Basic+ | AI 검색 결과 화면 자동 저장 |
| Before/After 비교 카드 | Pro+ | 개선 전후 나란히 시각 비교 |
| CSV 내보내기 | Pro+ | 분석 데이터 엑셀 내보내기 (한글 호환) |
| PDF 리포트 | Pro+ | 전체 분석 PDF 다운로드 |
| 보관 기간 | - | Basic: 30일 / Pro: 90일 / Biz: 무제한 |

### 4-8. 창업 패키지 (창업 플랜 전용)

| 기능 | 설명 |
|------|------|
| 업종·지역 경쟁 강도 분석 | 창업 전 시장 AI 노출 경쟁 강도 |
| 틈새 키워드 발굴 | AI 노출이 적은 빈틈 키워드 탐색 |
| 시장 진입 난이도 점수 | 업종·지역별 신규 진입 가능성 측정 |

### 4-9. 팀·API 관리 (Biz 플랜)

| 기능 | 설명 |
|------|------|
| 팀 계정 5명 | 멤버 초대·역할 관리 |
| Public API 키 발급 | 외부 서비스 연동용 API 키 (최대 5개) |
| 사업장 5개 등록 | 각 사업장별 독립 대시보드 |

### 4-10. 공유 기능

| 기능 | 설명 |
|------|------|
| AI 점수 공유 링크 | 내 AI 노출 점수를 SNS 공유 카드로 발행 |
| OG 이미지 자동 생성 | 공유 시 점수 카드 이미지 자동 생성 |

---

## 5. 자동화 스케줄러

백그라운드에서 자동 실행되는 작업 목록

| 실행 시간 | 작업 | 설명 |
|----------|------|------|
| 매일 새벽 2시 | 전체 AI 풀스캔 | 플랜별 주기에 맞춰 사업장 자동 스캔 |
| 매일 오전 3시 | 경쟁사 추월 감지 | 경쟁사가 내 점수를 추월한 경우 감지 |
| 매일 오전 4시 | 경쟁사 리뷰 발췌 보강 | 경쟁사 키워드 갭 분석용 데이터 보강 |
| 매일 오전 8시 | After 스크린샷 캡처 | 스캔 후 AI 화면 자동 저장 |
| 매일 오전 8시 | 리뷰 키워드 알림 | 경쟁사 신규 키워드 등장 시 알림 |
| 매일 오전 9시 10분 | 카카오 일별 알림 | 점수 변화·경쟁사 알림 |
| 매일 오전 10시 | 무료 체험 팔로업 | 체험 후 미가입 사용자 이메일 발송 |
| 매주 월요일 오전 9시 | 카카오 주간 요약 | 주간 AI 노출 변화 요약 알림톡 |
| 매주 월요일 오전 9시 | 주간 소식 초안 생성 | 스마트플레이스 소식 작성 초안 자동 생성 |
| 매주 월요일 오전 4시 30분 | 신규 경쟁사 감지 | 동종업계 새 경쟁자 자동 탐지 |
| 매월 1일 오전 10시 | 시장 뉴스 요약 | 업종별 AI 트렌드 월간 알림 |
| 매월 말일 오후 6시 | 월간 성장 카드 | 이번 달 성장 요약 카드 생성 |
| 매 10분 | 메모리 정리 | TTL 캐시·SSE 토큰 주기 정리 |
| 매일 새벽 1시 | 구독 생애주기 관리 | 만료·갱신·유예 기간 처리 |

---

## 6. 요금제

| 플랜 | 월 금액 | 주요 대상 | 자동 스캔 주기 |
|------|--------|----------|--------------|
| **무료 체험** | 0원 | 처음 사용자 | 없음 (1회 즉시 진단) |
| **Basic** | 9,900원 | 1개 매장 운영 소상공인 | 주 1회 풀스캔 + 매일 핵심 지표 |
| **창업 패키지** | 14,900원 | 예비 창업자 | 주 1회 풀스캔 + 매일 핵심 지표 |
| **Pro** | 19,900원 | 적극적 온라인 관리 희망자 | 주 3회 풀스캔 + 매일 핵심 지표 |
| **Biz** | 49,900원 | 다점포·프랜차이즈·대행사 | 매일 풀스캔 (사업장 5개) |

### 플랜별 주요 한도 비교

| 항목 | Basic | 창업 | Pro | Biz |
|------|-------|------|-----|-----|
| 사업장 수 | 1개 | 1개 | 1개 | 5개 |
| 경쟁사 수 | 3개 | 10개 | 10개 | 무제한 |
| 수동 스캔 | 하루 1회 | 하루 3회 | 하루 5회 | 무제한 |
| 가이드 생성 | 월 1회 | 월 5회 | 월 5회 | 월 20회 |
| 리뷰 답변 초안 | 월 10회 | 월 10회 | 월 30회 | 무제한 |
| 추세 보관 | 30일 | 30일 | 90일 | 무제한 |
| 팀 계정 | - | - | - | 5명 |
| API 키 | - | - | - | O |

---

## 7. 페이지 구조

### 공개 페이지 (비로그인)
| URL | 설명 |
|-----|------|
| `/` | 랜딩 페이지 |
| `/trial` | 무료 원샷 체험 |
| `/pricing` | 요금제 안내 |
| `/demo` | 데모 결과 페이지 |
| `/share/[bizId]` | AI 점수 공유 카드 |
| `/terms` | 이용약관 |
| `/privacy` | 개인정보처리방침 |

### 인증 페이지
| URL | 설명 |
|-----|------|
| `/login` | 로그인 |
| `/signup` | 회원가입 |
| `/reset-password` | 비밀번호 재설정 |

### 대시보드 (로그인 필요)
| URL | 설명 |
|-----|------|
| `/onboarding` | 신규 가입 후 사업장 등록 온보딩 |
| `/dashboard` | 메인 대시보드 (듀얼트랙 점수 + 경쟁사 비교) |
| `/competitors` | 경쟁사 관리 + 갭 분석 |
| `/guide` | AI 개선 가이드 + 브리핑 4경로 + 키워드 갭 |
| `/review-inbox` | 리뷰 답변 초안 생성·관리 |
| `/history` | Before/After 스크린샷 히스토리 |
| `/schema` | JSON-LD Schema 생성 |
| `/startup` | 창업 시장 분석 (창업 플랜) |
| `/ad-defense` | ChatGPT 광고 대응 가이드 (Pro+) |
| `/settings` | 구독·알림·계정 설정 |
| `/settings/team` | 팀 멤버 관리 (Biz) |
| `/settings/api-keys` | API 키 관리 (Biz) |
| `/admin` | 관리자 대시보드 (내부용) |

---

## 8. 백엔드 API 엔드포인트

### 스캔
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/scan/trial` | 무료 원샷 스캔 (비로그인) |
| POST | `/api/scan/full` | 7개 AI 풀스캔 (구독자) |
| POST | `/api/scan/stream/prepare` | SSE 스캔 토큰 발급 |
| GET | `/api/scan/stream` | 실시간 SSE 스캔 진행률 |
| GET | `/api/scan/{id}` | 스캔 결과 조회 |

### 리포트
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/report/score/{biz_id}` | 듀얼트랙 점수 + 진단 보고서 |
| GET | `/api/report/history/{biz_id}` | 30일 점수 추세 |
| GET | `/api/report/competitors/{biz_id}` | 경쟁사 비교 분석 |
| GET | `/api/report/before-after/{biz_id}` | 스크린샷 Before/After 목록 |
| GET | `/api/report/ranking/{category}/{region}` | 업종·지역 AI 노출 TOP10 랭킹 |
| GET | `/api/report/benchmark/{category}/{region}` | 업종 벤치마크 (평균·상위10%·분포) |
| GET | `/api/report/market/{biz_id}` | 시장 현황 Domain 2 통합 |
| GET | `/api/report/gap/{biz_id}` | 갭 분석 (경쟁사 대비 6차원) |
| GET | `/api/report/export/{biz_id}` | CSV 내보내기 (Pro+) |
| GET | `/api/report/pdf/{biz_id}` | PDF 리포트 (Pro+) |
| GET | `/api/report/share/{biz_id}` | 공유 페이지 데이터 |
| GET | `/api/report/share-card/{biz_id}` | 공유 OG 이미지 생성 |
| GET | `/api/report/badge/{biz_id}` | AI 점수 배지 (SVG) |

### 가이드
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/guide/generate` | AI 개선 가이드 생성 (Claude Sonnet) |
| GET | `/api/guide/{biz_id}/latest` | 최신 가이드 조회 |
| PATCH | `/api/guide/{guide_id}/checklist` | 가이드 체크리스트 업데이트 |
| POST | `/api/guide/review-reply` | 리뷰 답변 초안 생성 |
| GET | `/api/guide/{biz_id}/review-replies` | 리뷰 답변 이력 |
| GET | `/api/guide/{biz_id}/qr-card` | QR 리뷰 유도 카드 |
| POST | `/api/guide/ad-defense/{biz_id}` | ChatGPT 광고 대응 가이드 (Pro+) |

### 사업장·경쟁사
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/businesses` | 사업장 등록 |
| GET | `/api/businesses/me` | 내 사업장 목록 |
| GET | `/api/businesses/{id}` | 사업장 상세 조회 |
| PATCH | `/api/businesses/{id}` | 사업장 정보 수정 |
| DELETE | `/api/businesses/{id}` | 사업장 삭제 |
| GET | `/api/businesses/search-address` | 주소 검색 |
| GET | `/api/businesses/lookup` | 사업자등록번호 조회 |
| GET | `/api/competitors/{biz_id}` | 경쟁사 목록 |
| POST | `/api/competitors` | 경쟁사 등록 |
| DELETE | `/api/competitors/{id}` | 경쟁사 삭제 |
| GET | `/api/competitors/search` | 카카오·네이버 지역 검색 |
| GET | `/api/competitors/suggest/list` | 동종업계 AEOlab 내 추천 |

### 기타
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/schema/generate` | JSON-LD Schema 생성 |
| POST | `/api/startup/report` | 창업 시장 분석 리포트 |
| GET | `/api/startup/market/{cat}/{region}` | 업종·지역 시장 현황 |
| GET | `/api/settings/me` | 계정·구독 설정 조회 |
| PATCH | `/api/settings/me` | 설정 변경 (알림·전화번호 등) |
| POST | `/api/settings/cancel` | 구독 해지 |
| DELETE | `/api/settings/account` | 계정 탈퇴 |
| GET | `/api/teams/members` | 팀 멤버 목록 (Biz+) |
| POST | `/api/teams/invite` | 팀원 초대 |
| DELETE | `/api/teams/members/{id}` | 팀원 제거 |
| PATCH | `/api/teams/members/{id}/role` | 팀원 역할 변경 |
| GET | `/api/v1/keys` | API 키 목록 (Biz+) |
| POST | `/api/v1/keys` | API 키 발급 |
| DELETE | `/api/v1/keys/{id}` | API 키 폐기 |
| POST | `/api/webhook/toss/confirm` | 토스 결제 확정 |
| POST | `/api/webhook/toss/billing/issue` | 토스 빌링키 발급 |
| GET | `/admin/stats` | 관리자: 구독자·MRR·BEP 현황 |
| GET | `/admin/subscriptions` | 관리자: 구독자 목록 |
| GET | `/admin/revenue` | 관리자: 월별 매출 추이 |
| GET | `/admin/scan-logs` | 관리자: 스캔 로그 |
| POST | `/admin/broadcast` | 관리자: 전체 공지 발송 |

---

## 9. 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| 프론트엔드 | Next.js | 16.x (App Router) |
| 프론트엔드 | Tailwind CSS | 3.x |
| 프론트엔드 | shadcn/ui | latest |
| 프론트엔드 | Recharts | 2.x |
| 백엔드 | Python FastAPI | 0.110+ |
| 백엔드 | Pydantic | v2 |
| 백엔드 | APScheduler | 3.x |
| DB | Supabase (PostgreSQL) | Free Tier |
| 결제 | 토스페이먼츠 | v2 |
| 알림 | 카카오 알림톡 | v2 (심사 중) |
| 스크린샷 | Playwright | 1.44+ |
| 프로세스 | PM2 | 5.x |
| 프록시 | Nginx | 1.24+ |

---

## 10. 데이터베이스 주요 테이블

| 테이블 | 역할 |
|--------|------|
| `users` | Supabase Auth 연동 |
| `profiles` | 사용자 프로필 (전화번호·알림 설정) |
| `businesses` | 등록 사업장 (업종·지역·키워드) |
| `competitors` | 경쟁사 목록 |
| `scan_results` | AI 스캔 원본 결과 (track1·track2·unified_score 포함) |
| `score_history` | 점수 시계열 (30일 추세용) |
| `ai_citations` | AI 인용 실증 데이터 |
| `guides` | 생성된 개선 가이드 |
| `before_after` | 스크린샷 Before/After |
| `subscriptions` | 구독 정보 (빌링키·갱신일·유예기간) |
| `trial_scans` | 무료 체험 스캔 결과 (비로그인, IP 해시) |
| `waitlist` | 대기자 명단 |
| `gap_cards` | 갭 분석 카드 캐시 |
| `team_members` | 팀 계정 |
| `api_keys` | Public API 키 (SHA256 해시 저장) |

---

## 11. 운영 환경

| 항목 | 내용 |
|------|------|
| 서버 | iwinv 단독형 vCPU2/RAM4GB, Ubuntu 24.04 LTS |
| 도메인 | aeolab.co.kr |
| 프로세스 | PM2 (frontend: 포트 3000 / backend: 포트 8000) |
| 배포 | GitHub Actions — main 브랜치 push 시 자동 배포 |
| SSL | Nginx 리버스 프록시 |
| 비용 구조 | 서버 27,800원 + AI API ~5만원 = 월 약 8만원 (BEP: 구독자 20명) |

---

*작성일: 2026-04-01 | 실제 서버 코드 점검 기준 | 다음 업데이트 시 버전 올릴 것*
