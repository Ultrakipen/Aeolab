# CLAUDE.md에서 이관한 완료 문서 행·트리거 (2026-10-10)

> 모두 재점검·재작업 불필요로 종결된 항목. CLAUDE.md 700줄 기준 압축으로 이관(원문 그대로).

| `docs/five_pages_and_action_history_handoff_v1.0.md` | 경쟁사관리·성장리포트·개선가이드·소개글콘텐츠·변화기록 + 9개 영역 전체 완료(git `71707d4`~`963228c`, 2026-07-06). 재점검 불필요 |
| `docs/six_pages_external_benchmark_inspection_plan_v1.0.md` | 6개 페이지 외부벤치마크 점검 전체 완료(git `368c1f2`~`4cc68ca`, 2026-07-09). 재점검 불필요 |
| `docs/admin_screens_inspection_plan_v1.0.md` | 관리자(`/admin/*`) 화면 전체 점검 — P0/P1/P2 전체 완료+사후재검증까지 완료(git `27ddf98`~`6da216c`). 재점검 불필요 |
| **`docs/commercial_launch_readiness_audit_v1.0.md`** ⭐ | **상업 서비스 총괄 점검 계획 — 4개 신규 축(A보안·B법적컴플라이언스·C사업성·D인프라복원력). A·B·C·D 전체 완료(2026-07-12)** |
| `docs/naver_api_hub_migration_v1.0.md` | 네이버 Search/DataLab API → NAVER API Hub(NCP) 이관 완료(2026-09-02, git `41f3c01`+`aa38a1f`) — 라이브 전환 완료, 프로덕션이 API Hub 경유로 동작 중. 전환 중 Content-Type 불일치·뉴스카드 미승인 2건 실전 발견·수정. 재작업 불필요 |
| `docs/fastapi_starlette_upgrade_handoff_v1.0.md` | A·B·C·D 3개 문서 재검증 세션(2026-07-12) 결과물 — privacy §4 Resend 위탁 누락·§3 IP해시 문구 불일치·DMARC 부재·성능측정 이력 0건·pip-audit 미실행 5건 수정·배포(git `f51f490`·`6c65ab8`). `starlette` CVE 7건 → **fastapi 0.135.0+starlette 1.3.1 업그레이드 완료**(로컬 회귀검증 후 서버 배포·라이브 검증, git `7d23596`) — 이 문서 시리즈 전체 종료, 재작업 불필요 |
| `docs/closure_rate_data_source_investigation_v1.0.md` | 창업 시장 분석용 지역별 폐업율 데이터 소스 조사 — **조사·매핑·라이브 검증 전부 완료(2026-09-01), 재점검 불필요.** 행안부 지방행정 인허가 통합API로 16개 업종(음식점·카페·미용·숙박·피트니스·애견·약국·마사지·댄스·무술·안경원·노래방·당구장 등) 검증 완료, 지역 필터는 `cond[LOTNO_ADDR::LIKE]=<지역명>` 확정. `bar`는 `general_restaurants`를 `BZSTAT_SE_NM`으로 필터링. 골프·수영장·찜질방은 SearchAd 실측 검색량이 낮아 제외 확정. 학원/독서실(NEIS)은 폐업 이력이 없어 이 기능엔 사용 불가. 요가/필라테스·스터디카페·클라이밍·방탈출은 커버 불가 |
| `docs/closure_rate_feature_implementation_plan_v1.0.md` | 폐업율 기능 설계 + 외부상업서비스 벤치마크 재검증(2026-09-01) — SBIZ "창업진단(생존가능성)"과 개념 일치 확인, 실제 누락 1건(AI 프롬프트 미반영) 발견·아키텍처 정정. **구현·배포·실측검증 전체 완료(2026-09-01)** — 재작업 불필요, 상세는 아래 "최근 업데이트" 참조 |
| `docs/full_site_user_perspective_ux_audit_v1.0.md` | 전체 66페이지(관리자 제외) 사용자 관점 UX 점검(편의성·구조·스크롤흐름·가독성) — 오판검증 2회 사이클(최초6건중5건 오판→기각), P1 2건(score-model-v3-1 biz_id무시·keywords 헤더푸터단절)+P2 7건 수정·배포 완료(git `fa8cdb1`). 잔여 테스트데이터 2건은 사용자 지시로 미삭제·문서화만 (2026-09-03). 재작업 불필요 |
> **관리자 화면 점검**: 완료됨 — 재점검 불필요(위 표 참조)
> **외부 벤치마크 기반 상업적 수준 점검**: 9개 페이지(경쟁사관리·성장리포트·개선가이드·변화기록·소개글콘텐츠·블로그진단·리뷰답변·AI광고대비·창업시장분석) 전체 완료. 남은 건 대시보드뿐
> **마스터 점검 계획 이어가기(전환 퍼널 L3 + 대비율 800건 잔여)**: `docs/master_inspection_plan_v1.0.md §5.1 기준으로 이어서 진행` — 2026-07-11 전 항목 완료됨, 재점검 불필요
> **창업 시장 분석 폐업율 기능**: 구현·배포·실측검증 완료(2026-09-01, git `4bd5d14`·`ac01425`) — 재작업 불필요
> **상업 서비스 총괄 점검(보안/법적/사업성/인프라)**: A·B·C·D 전체 완료(2026-07-12) — A·B·D는 `docs/legal_compliance_and_infra_resilience_audit_v1.0.md`(git `3ab9545`), C는 `docs/business_viability_audit_v1.0.md` 참조. 재점검 불필요, 후속 과제만 `docs/business_viability_audit_v1.0.md §6` 참조
> **FastAPI/Starlette 업그레이드**: 완료됨(2026-07-12, git `7d23596`) — 재작업 불필요
