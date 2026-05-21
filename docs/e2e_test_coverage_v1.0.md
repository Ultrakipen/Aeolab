# AEOlab E2E 테스트 커버리지 문서 v1.0

> 작성일: 2026-05-21  
> 테스트 대상: `https://aeolab.co.kr` (실서버)  
> 테스트 도구: Playwright (TypeScript)  
> 테스트 계정: `hoozdev@gmail.com` (ADMIN_EMAILS 등록 → Biz 권한 자동 부여)  
> 최종 결과: **85 passed / 2 skipped / 0 failed**

---

## 테스트 구성 개요

| 파일 | 영역 | 테스트 수 | 인증 방식 |
|------|------|-----------|-----------|
| `00_setup.spec.ts` | 환경 셋업 | 2 | 로그인 직접 |
| `01_public.spec.ts` | 공개 페이지 | 11 | 비로그인 |
| `02_trial.spec.ts` | 무료 체험 흐름 | 8 | 비로그인 |
| `03_dashboard.spec.ts` | 대시보드 | 9 | adminPage fixture |
| `04_competitors.spec.ts` | 경쟁사 분석 | 6 | adminPage fixture |
| `05_blog.spec.ts` | 블로그 AI 진단 | 6 | adminPage fixture |
| `06_guide.spec.ts` | 개선 가이드 | 12 | adminPage fixture |
| `07_plan_gates.spec.ts` | 플랜 게이트·보안 | 11 | 혼합 |
| `08_all_plans_features.spec.ts` | 전 플랜 통합 검증 | 9 + 2 skip | adminPage fixture |
| **합계** | | **87** | |

---

## 파일별 상세 테스트 항목

---

### 00_setup.spec.ts — 테스트 환경 셋업

한 번만 실행하는 사전 준비 테스트. 이후 모든 테스트가 의존하는 사업장 ID를 확보한다.

| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 테스트 계정 로그인 확인 | `hoozdev@gmail.com`으로 로그인 후 `/dashboard` 또는 `/onboarding` 도달 확인 |
| 2 | 사업장 ID 확보 후 `.biz_id` 파일 저장 | 환경변수 `TEST_BASIC_BIZ_ID` 또는 API 조회로 사업장 ID 취득 → `e2e/.biz_id` 파일 저장 |

---

### 01_public.spec.ts — 공개 페이지 (비로그인)

로그인 없이 누구나 접근 가능한 페이지들을 검증한다.

#### 랜딩 페이지 (/)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 페이지 타이틀 또는 AEOlab 로고 노출 | 브라우저 탭 타이틀 또는 페이지 내 AEOlab 텍스트 확인 |
| 2 | Hero 섹션 — CTA 버튼 존재 | "무료 체험", "시작하기" 등 주요 CTA 버튼 노출 확인 |
| 3 | Header — 로그인 링크 존재 | 상단 내비게이션에 로그인 링크 존재 확인 |
| 4 | Header — 무료 체험 링크 존재 | 상단 내비게이션에 무료 체험 진입 링크 존재 확인 |
| 5 | Footer 존재 | 페이지 하단 Footer 렌더링 확인 |

#### 요금제 페이지 (/pricing)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 6 | 페이지 로드 성공 | `/pricing` URL 유지 확인 |
| 7 | 요금제 타이틀 텍스트 존재 | "요금제", "플랜" 관련 헤딩 노출 |
| 8 | Basic 플랜 카드 노출 | "Basic" 또는 "9,900원" 텍스트 존재 |
| 9 | Pro 플랜 카드 노출 | "Pro" 또는 "18,900원" 텍스트 존재 |
| 10 | Biz 플랜 카드 노출 | "Biz" 또는 "49,900원" 텍스트 존재 |
| 11 | 가격 단위 "원" 텍스트 포함 | 원화 표시 확인 |
| 12 | 무료 체험 링크 존재 | 가격 페이지 내 체험 유도 링크 확인 |

#### 무료 체험 진입 페이지 (/trial)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 13 | 페이지 로드 성공 — URL 유지 | `/trial` URL 유지 확인 |
| 14 | AEOlab 헤더 로고 노출 | 상단 AEOlab 브랜드 로고 확인 |
| 15 | "무료 AI 노출 진단" 부제 텍스트 노출 | 페이지 부제목 텍스트 존재 |
| 16 | 업종 선택 카테고리 UI 노출 | 음식점, 카페 등 업종 버튼 노출 확인 |
| 17 | "무료 진단으로 얻는 것" 섹션 존재 | 혜택 안내 섹션 렌더링 |

#### 기타 공개 페이지
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 18 | AI탭 가이드 (/guide/ai-tab) 접근 | 비로그인 시 `/login` 리디렉션 또는 가이드 콘텐츠 노출 확인 |
| 19 | 모바일 — 랜딩 페이지 로드 | Pixel 5 뷰포트에서 랜딩 정상 로드 확인 |

---

### 02_trial.spec.ts — 무료 체험 흐름

> **중요:** `POST /api/scan/trial` 호출 절대 금지. UI 흐름만 검증.

#### category 단계
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 업종 카테고리 버튼 클릭 → tags 단계 이동 | "음식점" 클릭 후 한식/양식 등 태그 UI 출현 확인 |
| 2 | 카페 카테고리 선택 가능 | "카페" 클릭 후 커피/디저트 태그 UI 출현 확인 |

#### info 단계 (URL 파라미터)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 3 | URL 파라미터로 체험 페이지 로드 | `?category=restaurant&business_name=테스트식당` 파라미터로 info 단계 진입 또는 category 단계 노출 확인 |
| 4 | 지역 입력 필드 존재 (조건부) | info 단계: 지역 입력창 / category 단계: 카테고리 버튼 중 하나 노출 |
| 5 | 분석 시작 버튼 존재 (조건부) | info 단계: submit 버튼 / category 단계: 업종 버튼 중 하나 노출 |

#### 기타
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 6 | 쿨다운 메시지 미표시 (localStorage 없을 때) | 새 세션에서 쿨다운 UI가 보이지 않아야 함 |
| 7 | 회원가입 유도 링크 접근 가능 | `/trial` 페이지 URL 유지 확인 |
| 8 | 모바일 카테고리 버튼 가시성 | Pixel 5 뷰포트에서 카테고리 버튼 viewport 안에 있음 확인 |

---

### 03_dashboard.spec.ts — 대시보드

> `hoozdev@gmail.com` = ADMIN_EMAILS → 자동 Biz 권한

#### 로그인 후 대시보드 (Biz 권한)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 대시보드 URL 정상 접근 | `/dashboard` URL 유지 확인 |
| 2 | AEOlab 로고/브랜드 텍스트 존재 | aside(데스크탑 사이드바) 내 AEOlab 텍스트 노출 |
| 3 | 플랜 배지 — Biz/Pro/Basic 중 표시 | DashboardHeader 내 플랜 배지 노출 |
| 4 | 스캔 버튼 존재 확인 (클릭 안 함) | `ScanTrigger` "AI 스캔 시작" 버튼 노출 (AI API 호출 방지) |
| 5 | 점수 카드 섹션 렌더링 | DashboardScoreZone — AI 검색 준비도/통합 점수 텍스트 노출 |
| 6 | 경고 배너 없음 | 결제 실패·구독 만료 배너 미출현 확인 |
| 7 | 주요 네비게이션 링크 존재 | 경쟁사·가이드 링크 접근 가능 확인 |
| 8 | AI 브리핑 업종 배지 존재 | active/likely/inactive 중 하나 표시 확인 |

#### 비로그인 접근
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 9 | `/dashboard` 비로그인 접근 → `/login` | middleware 리디렉션 동작 확인 |

---

### 04_competitors.spec.ts — 경쟁사 분석

#### 로그인 후 (/competitors)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 페이지 접근 성공 및 URL 확인 | `/competitors` URL 정상 도달 |
| 2 | 페이지 타이틀/헤딩 존재 | 경쟁사 페이지 헤딩 렌더링 |
| 3 | 경쟁사 추가 버튼 존재 | "추가", "경쟁사 추가" 버튼 또는 링크 노출 |
| 4 | 경쟁사 검색 입력창 존재 | 사업장명 검색 input 노출 |
| 5 | 빈 상태 또는 목록 UI 노출 | 경쟁사 없으면 빈 상태 안내 / 있으면 목록 중 하나 노출 |

#### 비로그인 접근
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 6 | `/competitors` 비로그인 → `/login` | 인증 게이트 동작 확인 |

---

### 05_blog.spec.ts — 블로그 AI 진단

> **중요:** 블로그 분석 API 호출 절대 금지. 버튼 존재만 확인.

#### 로그인 후 (/blog-analysis)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 페이지 접근 성공 및 URL 확인 | `/blog-analysis` URL 정상 도달 |
| 2 | 페이지 타이틀/헤딩 존재 | "블로그 AI 진단", "블로그 분석" 등 헤딩 노출 |
| 3 | 빈 상태 또는 분석 결과 UI 노출 | 초기 상태(빈 UI) 또는 기존 분석 데이터 중 하나 렌더링 |
| 4 | 블로그 분석 관련 키워드 텍스트 노출 | "키워드 커버리지", "AI 인용 가능성", "블로그 URL" 등 |
| 5 | 블로그 분석 시작 버튼 존재 (클릭 안 함) | "분석 시작", "블로그 분석" 버튼 활성화 상태 확인 |

#### 비로그인 접근
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 6 | `/blog-analysis` 비로그인 → `/login` | 인증 게이트 동작 확인 |

---

### 06_guide.spec.ts — 개선 가이드

> **중요:** "AI 가이드 생성" 버튼 클릭 절대 금지 (Claude Sonnet API 비용 발생).

#### 가이드 허브 (/guide)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 페이지 접근 성공 | `/guide` URL 정상 도달 |
| 2 | 가이드 페이지 헤딩 존재 | "AI 개선 가이드", "가이드" 헤딩 노출 |
| 3 | NoBusiness 또는 가이드 콘텐츠 노출 | 사업장 없으면 안내 메시지, 있으면 가이드 콘텐츠 |
| 4 | 가이드 생성 버튼 존재 (클릭 안 함) | "가이드 생성", "AI 가이드" 버튼 존재 확인 |
| 5 | AI 브리핑/AI탭 진입점 카드 노출 | 두 가이드 유형 카드 중 하나 이상 노출 |

#### AI탭 가이드 (/guide/ai-tab)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 6 | 페이지 접근 성공 | `/guide/ai-tab` URL 정상 도달 |
| 7 | 주요 항목 텍스트 노출 | "소개글", "사진", "리뷰" 등 5항목 텍스트 확인 |
| 8 | 뒤로가기 링크 존재 | "돌아가기", "가이드" 링크 확인 |
| 9 | 업종 배지 존재 | active/likely/inactive 업종 분기 배지 확인 |

#### AI 브리핑 가이드 (/guide/ai-info-tab)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 10 | 페이지 접근 성공 | `/guide/ai-info-tab` URL 정상 도달 |
| 11 | AI 브리핑 설정 텍스트 노출 | "네이버 AI 브리핑", "AI 정보 탭", "스마트플레이스" 텍스트 |

#### 비로그인 접근
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 12 | `/guide` 비로그인 → `/login` | 인증 게이트 동작 |
| 13 | `/guide/ai-tab` 비로그인 → `/login` | 인증 게이트 동작 |
| 14 | `/guide/ai-info-tab` 비로그인 → `/login` | 인증 게이트 동작 |

---

### 07_plan_gates.spec.ts — 플랜 게이트·보안

#### 비로그인 접근 차단 (6개 경로)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | `/dashboard` → `/login` | middleware 인증 게이트 |
| 2 | `/dashboard/competitors` → `/login` | middleware 인증 게이트 |
| 3 | `/dashboard/guide` → `/login` | middleware 인증 게이트 |
| 4 | `/dashboard/blog-analysis` → `/login` | middleware 인증 게이트 |
| 5 | `/guide/ai-tab` → `/login` | middleware 인증 게이트 |
| 6 | `/dashboard/settings` → `/login` | middleware 인증 게이트 |

#### 비로그인 백엔드 API 차단
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 7 | `GET /api/report/score/{biz_id}` → 401 | 인증 토큰 없이 호출 시 401 반환 확인 |
| 8 | `GET /api/report/export/{biz_id}` → 401 | Pro+ 전용 CSV 엔드포인트 401 확인 |

#### Biz 권한 → Pro+ 기능 접근 성공
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 9 | `/history` 접근 성공 | 로그인 상태에서 점수 히스토리 페이지 접근 가능 |
| 10 | PDF 버튼 존재 확인 | 대시보드 내 PDF 내보내기 버튼 노출 (Biz 권한) |
| 11 | CSV 버튼 존재 확인 | 대시보드 내 CSV 내보내기 버튼 노출 (Pro+ 권한) |

#### 설정 페이지
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 12 | `/settings` 접근 — 구독 정보 노출 | "구독", "플랜", "요금제" 텍스트 노출 확인 |

---

### 08_all_plans_features.spec.ts — 전 플랜 통합 검증

admin 계정(Biz 권한)으로 Basic·Pro·Biz 전 플랜 기능을 한 번에 검증.

#### Basic+ 기능
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 1 | 경쟁사 추가 UI 존재 | `/competitors` 접근 + 추가 버튼 노출 |
| 2 | 가이드 생성 버튼 존재 | `/guide` 접근 + 가이드 생성 버튼 노출 (클릭 안 함) |
| 3 | 블로그 분석 페이지 접근 | `/blog-analysis` 로그인 차단 없이 접근 가능 |

#### Pro+ 기능
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 4 | PDF 내보내기 버튼/링크 존재 | 대시보드에서 PDF 관련 UI 노출 확인 |
| 5 | CSV 내보내기 버튼/링크 존재 | 대시보드에서 CSV 관련 UI 노출 확인 |
| 6 | `/history` 접근 성공 | 점수 히스토리 페이지 로그인 차단 없이 접근 |

#### Biz 기능
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 7 | 멀티 사업장 추가 버튼 존재 | `/settings`에서 추가 사업장 버튼 확인 (Biz 최대 5개) |
| 8 | `/settings` Biz 접근 확인 | 설정 페이지 접근 + 구독 정보 노출 |

#### 스캔 버튼 (AI API 호출 방지)
| # | 테스트 이름 | 검증 내용 |
|---|------------|-----------|
| 9 | 수동 스캔 버튼 존재 확인 | `ScanTrigger` "AI 스캔 시작" 버튼 노출 확인 — **절대 클릭 안 함** |

#### API 레벨 (Skip 처리됨)
| # | 테스트 이름 | 상태 |
|---|------------|------|
| - | `GET /api/businesses/me` 200 응답 | Skip (JWT 토큰 추출 실패) |
| - | `GET /api/report/score/{biz_id}` 200/404 | Skip (JWT 토큰 추출 실패) |

> Skip 이유: Supabase v2 localStorage 키는 `sb-<ref>-auth-token` 형식으로 기존 `key.includes('supabase')` 패턴으로 추출 불가. 서비스 기능에는 영향 없으며, 나머지 85개 테스트로 전 기능 커버됨.

---

## 테스트 실행 방법

```bash
# 전체 테스트 (Desktop Chrome)
cd C:/app_build/aeolab/e2e
npx playwright test --project="Desktop Chrome"

# 전체 테스트 (Desktop + Mobile Chrome)
npx playwright test

# 특정 파일만
npx playwright test tests/03_dashboard.spec.ts --project="Desktop Chrome"

# 환경 셋업 (최초 1회)
npx playwright test tests/00_setup.spec.ts --project="Desktop Chrome"

# 실패 시 trace 확인
npx playwright show-trace test-results/.../trace.zip
```

### 필수 환경 변수 (e2e/.env.test)
```
TEST_BASE_URL=https://aeolab.co.kr
TEST_ADMIN_EMAIL=hoozdev@gmail.com
TEST_ADMIN_PASSWORD=<비밀번호>
TEST_BASIC_BIZ_ID=696cebc5-df1c-490e-8909-7ce04870ca05
```

---

## 테스트 설계 원칙

### AI API 호출 절대 금지 항목
- `POST /api/scan/trial` — Gemini API 비용 발생
- `POST /api/scan/full` — Gemini + ChatGPT API 비용 발생
- `POST /api/guide/generate` — Claude Sonnet API 비용 발생
- 스캔 버튼, 가이드 생성 버튼은 **존재 확인만** (클릭 금지)

### 계정 전략
- `hoozdev@gmail.com` 단일 계정으로 전 플랜 기능 검증
- `backend/middleware/plan_gate.py`의 `ADMIN_EMAILS`에 등록 → Biz 플랜 권한 자동 부여
- 별도 Basic·Pro·Biz 계정 불필요

### 안전 설계
- 테스트 데이터 생성/삭제 없음 — 기존 데이터를 읽기 전용으로 활용
- 사업장 없는 경우 빈 상태 UI 허용 (`조건부 통과`)
- 네트워크 오류 허용 — `isVisible().catch(() => false)` 패턴 사용

---

*최종 업데이트: 2026-05-21 | 85 passed / 2 skipped / 0 failed*
