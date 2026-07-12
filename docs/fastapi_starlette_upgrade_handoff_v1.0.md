# FastAPI/Starlette 업그레이드 핸드오프 v1.0

> 작성일 2026-07-12. `docs/commercial_launch_readiness_audit_v1.0.md` 재검증 세션의 마지막 잔여 작업.
> 이 세션에서 완료한 작업은 §0 참조, 남은 작업(본론)은 §1 이하.

## 0. 이 세션에서 완료된 작업 (참조만, 재작업 금지)

`commercial_launch_readiness_audit_v1.0.md`/`legal_compliance_and_infra_resilience_audit_v1.0.md`/`business_viability_audit_v1.0.md` 3개 문서를 병렬 에이전트 3개(법적/사업성/누락사냥) + 메인 세션 직접 재검증(git 커밋 실존·서버 코드·라이브 DB백업)으로 재점검 — **오판 없음** 확인. 발견된 진짜 공백을 아래와 같이 즉시 처리 완료:

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | 개인정보처리방침 §4 Resend 위탁 누락 | ✅ 수정·배포 | `privacy/page.tsx`, git `f51f490` |
| 2 | 개인정보처리방침 §3 "IP해시 24시간 삭제" 문구 vs 실제 무기한 보관 불일치 | ✅ 문구 정정·배포 | 위와 동일 커밋 |
| 3 | DMARC 레코드 전무 | ✅ 추가·라이브 확인 | `_dmarc.aeolab.co.kr` TXT, 사용자가 Cloudflare에서 직접 추가, DoH 재조회로 확인 |
| 4 | 성능 실측(Lighthouse/Core Web Vitals) 이력 0건 | ✅ 최초 베이스라인 확보 | `.gstack/benchmark-reports/baselines/baseline.json` — 랜딩 웜로드 661ms/47req/2.4MB, `/trial` 웜로드 325ms |
| 5 | `pip-audit` 미실행(백엔드 의존성 CVE) | ✅ 실행 + 저~중위험 4건 패치 | `python-dotenv`→1.2.2, `python-multipart`→0.0.32, `Pillow`→12.3.0, `aiohttp`→3.14.1. 서버 설치·재시작·`/health`+`/api/scan/trial-count` 200 확인. git `6c65ab8` |

**오판 정정 사례** (기록 목적): 카카오 위탁표 누락 의심 → git blame으로 이미 §4 "제3자 제공"에 등재돼 있었음을 확인해 철회. Pillow가 "전이 종속성이라 미고정" 의심 → 대소문자(`Pillow` vs `pillow`) grep 실수였고 실제로는 직접 고정돼 있었음을 확인해 정정.

**미완료로 남긴 항목**: `starlette` (아래 본론), 상표권/PG정산대사(실사용자 0명 상태라 낮은 우선순위, 액션 없음), `send.aeolab.co.kr`의 별도 MX/SPF 구성(Resend 온보딩 산출물로 추정, 특이하지만 조사 안 함 — 필요시 별도 확인).

---

## 1. 본론 — FastAPI/Starlette 업그레이드

### 배경

`pip-audit` 실행 결과 `starlette==0.38.6`에 CVE/PYSEC 7건(전부 아래 표 참조). `starlette`는 `fastapi==0.115.0`의 종속성이라 단독 업그레이드 불가 — FastAPI 자체를 starlette 신버전과 호환되는 버전으로 같이 올려야 함.

### 발견된 취약점 (starlette 0.38.6 기준)

| CVE/PYSEC | 수정 버전 |
|---|---|
| PYSEC-2026-1943 | 0.40.0 |
| PYSEC-2026-1941 | 0.47.2 |
| PYSEC-2026-161 | 1.0.1 |
| CVE-2026-48817, CVE-2026-48818 | 1.1.0 |
| PYSEC-2026-248 | 1.3.0 |
| PYSEC-2026-249 | 1.3.1 |

→ 전체 해결하려면 **`starlette>=1.3.1`** 필요.

### 권장 타겟 버전 (이번 세션에서 조사 완료)

**`fastapi==0.135.0` + `starlette==1.3.1`**

버전 조사 결과 (`pypi.org` JSON API로 각 버전의 `requires_dist` 직접 확인):

| fastapi 버전 | starlette 요구 범위 | pydantic 요구 범위 |
|---|---|---|
| 0.115.0 (현재) | `<0.39.0,>=0.37.2` | — |
| 0.130.0 | `<1.0.0,>=0.40.0` (1.x 아직 불가) | — |
| **0.133.0~0.135.0** | **`>=0.40.0`(0.135은 `>=0.46.0`, 상한 없음 → 1.x 가능)** | **`>=2.7.0`** ← 현재 고정 `pydantic==2.8.2`가 이미 충족 |
| 0.136.0+ | `>=0.46.0` | **`>=2.9.0`** ← 여기서부터 pydantic도 같이 올려야 함 |
| 0.139.0 (최신) | `>=0.46.0` | `>=2.9.0` |

**`0.135.0`을 선택하면 pydantic을 안 건드리고 starlette 1.3.1까지 갈 수 있어 최신(0.139.0)보다 변경 범위가 작음.** pydantic 동시 변경은 이메일 검증(`pydantic[email]`)·strict 모드 등 이 프로젝트의 스캔/폼 검증 로직에 추가 리스크를 더하므로, 최초 시도는 0.135.0으로 범위를 좁히는 것을 권장. (0.135.0이 나중에 실제로 문제가 있으면 그때 0.139.0+pydantic 동시 업그레이드로 확장 검토)

### 실행 절차

1. **로컬 사전 검증** (`backend_venv`, 서버는 건드리지 않음)
   ```
   pip install fastapi==0.135.0 starlette==1.3.1
   ```
   앱 기동(`uvicorn main:app --reload`) → 임포트 에러 없는지, Swagger UI(`/docs`) 정상 노출되는지 확인

2. **Breaking Changes 조사** — WebSearch로 FastAPI 0.115→0.135, Starlette 0.38→1.3 공식 changelog 확인. 특히 이 프로젝트가 실제 쓰는 패턴 위주로:
   - SSE 스트리밍 응답(`/api/scan/stream`) — Starlette의 `StreamingResponse`/`EventSourceResponse` 관련 동작 변경 여부
   - 미들웨어(`middleware.ts`는 프론트지만 백엔드 `main.py`의 CORS/인증 미들웨어도 확인)
   - `Depends()` 기반 인증 — 변경 이력 없는지
   - Pydantic v2 모델 검증(버전 안 올리지만 FastAPI 내부 스키마 생성 로직이 바뀌었을 수 있음)

3. **핵심 경로 로컬 회귀 테스트**
   - `backend/routers/webhook.py` — Toss 웹훅 서명 검증 로직 (mock 요청으로)
   - `/api/scan/stream` SSE 흐름
   - 파일 업로드가 있는 엔드포인트(`python-multipart` 관련, 이미 이번 세션에서 0.0.32로 올림 — 궁합 확인)
   - 인증이 걸린 대표 엔드포인트 1~2개 (`/api/businesses/me` 등)

4. **롤백 준비 후 서버 적용**
   ```
   ssh root@115.68.231.57 "source /var/www/aeolab/venv/bin/activate && pip freeze > /tmp/pre_fastapi_upgrade_freeze.txt"
   ```
   문제 시: `pip install fastapi==0.115.0 starlette==0.38.6` (또는 freeze 파일 기준 복원)

5. **서버 배포** — 기존 절차 동일(md5 확인은 `requirements.txt` 대상, scp, `pip install`, `pm2 restart aeolab-backend`, `pm2 logs --err` 확인)

6. **재시작 후 관찰 시간 확대** — 평소보다 길게(예: 30분) 에러 로그 모니터링. 특히 스캔 관련 엔드포인트가 야간 스케줄러 잡(`jobs.py`)과 겹치지 않는 시간대에 배포 권장

### 트리거 명령

새 세션에서: `docs/fastapi_starlette_upgrade_handoff_v1.0.md 기준으로 FastAPI/Starlette 업그레이드 진행`

---

## 2. 참고 — 이번 세션에서 발견했으나 액션 안 한 것 (기록용)

- **npm audit의 새 postcss(moderate) 이슈**: `next` 패키지 내부 번들 postc서스 관련, npm이 제안하는 수정은 next를 9.3.3으로 다운그레이드하는 것이라 비현실적(7개 메이저 버전 회귀). Next.js 자체의 다음 패치 릴리스가 내부 postcss를 올리면 자연 해소될 가능성 높음 — 별도 액션 불필요, 모니터링만.
- **`/benchmark` 측정 중 발견한 느린 prefetch 호출 5개**(pricing/faq/trial-count/trial/login, 각 550~860ms) — 렌더링을 막지는 않지만 백엔드 응답시간 조사 후보. `.gstack/benchmark-reports/baselines/baseline.json`에 원본 데이터 있음.
- **`send.aeolab.co.kr`의 별도 MX/SPF**(`feedback-smtp.ap-northeast-1.amazonses.com`) — Resend 온보딩 산출물로 추정되나 미조사.
