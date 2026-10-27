# CLAUDE.md 작업 참고 문서 표 원본 (2026-10-27 그룹 색인화로 이관)

| 파일 | 내용 |
|------|------|
| **`docs/naver_scraping_legal_risk_assessment_v1.0.md`** ⭐ | **네이버 AI브리핑 스캔의 로그인우회·CAPTCHA우회 기법(NID_AUT/NID_SES 쿠키 주입+stealth+IP로테이션)에 대한 정보통신망법 제48조·판례(대법원 2021도1533, 부산지법 2017노4344) 기반 법적 리스크 평가. 결론: 회색지대, 변호사 자문 필요 — 핵심 사업가치라 코드 임의 축소 금지 (2026-07-13)** |
| **`docs/naver_scraping_legal_risk_resolution_plan_v1.0.md`** ⭐ | **위 문서의 후속 실행계획 — Phase 0(법률자문요청서+약관원문대조, 사용자액션)~4(계정정지 감지 알림) 단계별 방안. stealth는 이미 제거됨, "CAPTCHA우회"는 실제론 능동 풀이 코드 없는 "회피+감지"임을 재확인·정정. 구조적 해법은 Phase 2(사용자 본인계정+크롬익스텐션) 제안, 코드 변경은 전부 사용자 승인 대기 (2026-08-08)** |
| **`docs/commercial_launch_inspection_status_v1.0.md`** ⭐ | **상업 서비스 점검 이력·비중분석·잔여과제 마스터 요약 — L1~L4(페이지단위)+A~D(서비스전체) 두 축 정리, 어디에 비중을 뒀는지·어디가 공백이었는지(A/D축 3개월 무점검이 최대 공백) 분석. §6에 실제 미해결 잔여과제 전체 정리(개인정보방침 문구 2건·PG우대등급확인·pip-audit 등). 신규 배포마다 L1+A 스팟체크 반복 필요 원칙 명시 (2026-07-13)** |
| **`docs/inspection_request_full.md`** ⭐ | **새 대화창 1줄 트리거용 종합 점검 문서 (§3.1~§3.10 영역)** |
| **`docs/naver_ai_prelaunch_inspection_v1.0.md`** ⭐ | **상업 서비스 전 AI 브리핑·AI탭·ChatGPT 차별화 14개 체크포인트 점검 (2026-05-19 재검토 확정본)** |
| **`docs/agency_service_and_iboss_improvements_v1.0.md`** ⭐ | **대행 서비스(3종) + Q&A 게시판 + 아이보스 착안 개선안 — 5 Sprint 구현 기획. 새 대화창에서 §0 트리거 명령으로 즉시 작업 시작 가능** |
| **`docs/naver_gpt_work_standard_v1.0.md`** ⭐ | **네이버·GPT 관련 기능 작업 전 필수 — 업종 분류·점수 가중치·스캐너·콘텐츠 구조·UI 분기 전 영역** |
| **`docs/ai_exposure_standard_and_naver_seo_v1.0.md`** ⭐ | **5채널 AI 노출 판정 기준 단일 소스 + 네이버 일반 검색 개선 안내 설계 — 스캔 엔진·갭 분석·가이드·UI 수정 전 필수** |
| `docs/model_engine_v3.0.md` | 듀얼트랙 모델 엔진 설계 (단일 참조 문서) |
| `docs/next_features_v1.0.md` | 다음 구현할 추천 기능 목록 |
| `docs/service_unification_v1.0.md` | 서비스 통합 재편 기획서 — 점수 모델 v3.1, 그룹 분기, KPI |
| `docs/phase_a_completion_report.md` | Phase A 완료 보고서 — 17건 작업 + 검증 결과 |
| `docs/changelog_archive.md` | v1.2~v3.5 완료 내역 아카이브 |
| **`docs/remaining_tasks_v1.0.md`** ⭐ | **잔여 작업 런북 — DB 테이블 생성 SQL·대행 서비스 체크리스트·git 커밋·P2/P3 트리거 명령 전체 정리 (2026-05-18)** |
| **`docs/inspection_fixes_runbook_v1.0.md`** ⭐ | **출시 전 점검 수정 런북 — §1~§15 전 영역 점검 결과 기반. P0 except 42건·content_validator 게이트·Claude 호출 상한·세마포어 등 §A~§I 수정 순서 정리 (2026-05-19)** |
| **`docs/scan_result_screens_inspection_v1.0.md`** ⭐ | **스캔 결과 화면 종합 점검 — 무료 체험·대시보드 5채널 인식·AI탭 measured 파이프 3중 단절·LockedScoreCard 더미·ScoreBreakdownBox 레이블·LIKELY 단정 분리. P0 4건·P1 6건·P2 4건·P3 1건 (2026-05-22, 5단계 메타 점검)** |
| **`docs/dashboard_top_redesign_handoff_v1.0.md`** ⭐ | **대시보드 상단 임팩트 개선 핸드오프 (2026-06-11) — 리뷰 P1버그·카피 수정 완료(scp 라이브). 남은 C(hero 45%→상단 레이아웃 재배치) 트리거. ⚠️§1 git push 금지(deploy reset --hard·서버 미커밋 46개)** |
| **`docs/naver_briefing_block_countermeasure_handoff_v1.0.md`** ⭐ | **네이버 3종(AI 브리핑/정보형/AI탭) 차단 대응 핸드오프 (2026-06-30, §9 2026-07-01 추가) — 정보형 ✅완료·AI탭 ✅우회운영·플레이스형 AI 브리핑 ✅차단우회 완료(git 3314fdf). §4-A 이식 완료: Chrome레시피+NID_AUT+NID_SES 2쿠키 주입, captcha_detected=False 실측 확인. NID_SES ~30일 만료 → 월 1회 교체 필요. §9: 월간 모니터 잡 오탐버그 수정+Slack무동작 발견→이메일알림 신설** |
| **`docs/session_2026_07_01_naver_recheck_and_usergroup_fix_v1.0.md`** ⭐ | **2026-07-01 세션 종합 정리 — 네이버 재검증(오판아님)·모니터잡 P0 버그·Slack무동작→이메일알림·NID_SES추적 신설·monthly_market_news_job PGRST200 수정·getUserGroup/getBriefingEligibility 정적호출 15곳 동적 override 전수 연결(git f7326bf). 잔여: NID_AUT/SES 자동 재로그인 여부(사용자 결정 대기)** |
| **`docs/naver_briefing_infotype_caveat_standard_v1.0.md`** ⭐ | **네이버 AI 브리핑 "정보형" 캐비엇 점검 표준 — 플레이스형(업종제한)/정보형(전업종) 구분·반복 버그 3유형(LIKELY만 누락/문법변형/암묵적배타)·점검 절차·정당한 예외·수정완료 파일 목록. 11차 스윕(2026-07-01) 종합** |
| **`docs/nine_pages_measurement_inspection_v1.0.md`** ⭐ | **9개 페이지(경쟁사 관리·변화 기록·성장 리포트·개선 가이드·소개글 콘텐츠·블로그 진단·리뷰 답변·AI 광고 대비·창업 시장 분석) 실측 점검 작업 문서 — 2단 레이어(프론트 UI 하드코딩 + 백엔드 측정 파이프라인 무결성) 방법론, 페이지·컴포넌트·API 매핑, 검증 절차 (2026-07-02)** |
| `docs/blog_analysis_improvement_v2.0.md` | 블로그 관리 페이지 개선 v2.0 — 전체 결론남(2026-07-17). 재점검 불필요 |
| *(완료된 점검 문서·트리거 15건)* | 재점검 불필요로 종결된 문서 행과 이어가기 트리거는 `docs/claude_md_completed_refs_archive.md`로 이관(2026-10-10). 필요할 때만 참조 |
| `docs/subscription_lifecycle_inspection_v1.0.md` | 구독 생애주기(갱신·카드변경·해지) 점검 — §1~4(git `df4f55f`~`3ee38fb`) + §6 P0/P1/FK조인버그 + §5 7일 자동환불 전체 배포완료(git `170b002`). 잔여 없음 |
| **`docs/eight_pages_commercial_professionalism_recheck_v1.0.md`** ⭐ | **8개 페이지 상업적 전문성 재점검 — P0 2건(FAQ한도·SearchGPT)+P1 8건 + 심층개선 6건(DataLab연동 등) + 실API호출로 발견한 최고심각도 2건(가이드 max_tokens 침묵실패, 소개글 허위수치 지어내기) + intro_draft CHECK 제약 사전존재 버그 + keyword_taxonomy law/미술 별칭 버그(전수검증). §13에 잔여 작업 5건 정리(max_tokens 타업종 점검·타업종 소개글 종단테스트·경쟁사 AI언급 추정치 한계·git push 결정 등) (git `258dff7`~`89afa5e`, 2026-07-08)** |
| **`docs/external_benchmark_commercial_quality_v1.0.md`** ⭐ | **외부 벤치마크(Nielsen 10휴리스틱·WCAG 2.1 AA·상업 SaaS 도구·감사이력 UX 관행) 기반 상업적 수준 점검 방법론 — 7단계 절차(과거이력→코드재검증→라이브접속→외부조사→반증→수정→드리프트확인). 경쟁사관리 3건·변화기록 2건·성장리포트 2건+P1·개선가이드 6건(1라운드 정보구조4건+2라운드 WCAG접근성2건) 수정 완료. 미점검 6개 페이지는 `docs/six_pages_external_benchmark_inspection_plan_v1.0.md`로 이관 (2026-07-09)** |
| **`docs/master_inspection_plan_v1.0.md`** ⭐ | **8개 파편화 점검 문서를 4-레이어(L1사실정확성·L2기능정합성·L3외부벤치마크·L4실측재현)로 통합 + 영역×레이어 매트릭스. 핵심 발견: 전환 퍼널(랜딩·요금제·trial·온보딩)은 L3 미적용. §5.1: 랜딩 실측으로 text-gray-400 대비율 위반 800+건(161개 파일) 발견, 8건만 수정(git `00bbcff`), 잔여 대량 작업 다음 세션 트리거 (2026-07-11)** |
| `docs/dashboard_external_benchmark_inspection_plan_v1.0.md` | 대시보드 외부벤치마크 점검 계획 — 이 축(Nielsen/WCAG)에서 유일하게 남은 대상. §1 필수 참고(소상공인은 네이버 100% 신뢰·대행업체 의뢰 실증 → 네이버 정보 최상단 배치·"AI노출개선→네이버SEO상위노출" 정방향 메시징·AI채널별 노출기간 정확 안내 3대 원칙), §3에 과거 점검 이력 전수 정리("닫힌 이슈 재점검 금지"), §2에 편집 지뢰(DualTrackCard 고아파일 경로) 경고, §5에 27개+ 컴포넌트 구역별 분할 진행 순서 (2026-07-09)** |
| **`docs/admin_panel_complete_documentation_v1.0.md`** ⭐ | **관리자 페이지 종합 문서(as-built) — 접속정보·인증구조 3단계·페이지 13개 전체 인벤토리·신규 DB테이블 5개·신규 엔드포인트 13개·git커밋 이력·알려진 제약 6건. 관리자 기능 추가/수정 작업 전 필수 참조 (2026-07-11)** |
| **`docs/session_2026_07_11_next_steps_handoff_v1.0.md`** ⭐ | **마스터 점검 계획 전체 완료 후 다음 단계 핸드오프 — A(정리: origin 대비 51커밋 push·스크린샷93개 정리·stale 문서 정리)와 B(신규 기능: next-feature 에이전트로 스코프 재기획) 2트랙. A 먼저 권장 (2026-07-11)** |
| **`docs/legal_compliance_and_infra_resilience_audit_v1.0.md`** ⭐ | **B(법적)+D(인프라) 점검 결과 — D축 P0(DB 백업 생성 이래 0회 성공, pg_dump 아웃바운드 차단+비밀번호 미설정 이중원인) 발견 즉시 수정(REST API 전환, 43개 테이블, 실패알림, git `3ab9545`). B축 P1(정기결제 요금인상 사전고지, 법률자문 권장)+P2 3건은 문서화만(사용자 결정 대기). 잔여: 외부 업타임 모니터링·day-30 알림 구현 (2026-07-12)** |
| **`docs/business_viability_audit_v1.0.md`** ⭐ | **C(사업성) 점검 결과 — Gemini SDK(0.8.3) thinking_config 미지원+AI 호출 텔레메트리 전무 발견(ai_usage_logger.py 신설·배포·SQL실행·실측검증 완료), 마진율 계산에서 PG수수료 누락 발견·재계산 — **2026-07-16 재확인으로 브랜드페이(4.3%)→표준카드(3.4%) 카테고리 정정 + 영세등급(0.40%) 사용자 확인 + 현재가 반영, 최종 Basic 83.8%/창업 83.9%/Pro 86.4%/Biz 91.4%**, 경쟁사가격비교 "없음" 주장은 오판(TalkB 비교표 기존재), trial→가입→유료전환 선행지표 실제공백 확인→`/admin/growth-funnel` 신설. **§1-A: 실측검증 도중 OpenAI 결제수단 미등록으로 ChatGPT 스캔 전면실패(insufficient_quota) P0 우연 발견·사용자 카드등록으로 해결**. 후속과제 잔여: max_tokens 등 (2026-07-12, PG 우대등급 항목은 2026-07-16 해소)** |
| **`docs/chargeback_response_checklist_v1.0.md`** ⭐ | **카드 분쟁(차지백) 대응 체크리스트 — 결제 라이브 키 승인 전 점검에서 발견한 누락(코드·문서 0건). 이미 있는 증빙 소스(payment_events·subscriptions 등) 정리 + 통보받았을 때 절차만 문서화, 코드 변경 없음 (2026-07-16)** |
| **`docs/blog_diagnosis_session_2026_07_18_handoff_v1.0.md`** ⭐ | **블로그 진단 페이지 종합 핸드오프 — 목적 확정(①내블로그현황 ②AI노출개선, 경쟁사대비는 방식A(comp_keywords 재사용, 부하없음)로 포함/방식B(실시간블로그크롤링)는 비채택)·20개상한 키워드누락 P0(git `a8f76ec`)·자기추세 upsert 누락(git `dc59ae4`)·comp_keywords 오판 2회 정정 상세. **재점검 발견**: `showDetail`(기본값 false) 단일 토글이 키워드커버리지·자기추세·경쟁사대비 3축을 전부 기본 숨김 처리 중 — §6-1 토글 재설계가 최우선 (2026-07-18)** |
| **`docs/trial_experience_persuasiveness_and_growth_v1.0.md`** ⭐ | **무료체험/가입후1회체험 설득력 검토 — 시나리오 5개 라이브 실측 + P0(FAQ·리뷰답변 자동생성 카피가 "미보유 추정" 키워드를 "전문으로 합니다/운영하고 있습니다"로 단정 서술, `smartplace-faq` 등 3곳) 발견 즉시 수정·배포(git `bd379c0`). §3 잔여(채널강점 vs 총점라벨 불일치·죽은 3단계비교박스 정리·프랜차이즈 메시징 재확인) + §5 사업성장 방안(결제심사 대기 중 체험 최적화 우선순위) (2026-08-22)** |
| **`docs/dashboard_load_test_and_capacity_v1.0.md`** ⭐ | **대시보드 페이지 부하테스트 실측 — QA임시계정+`@supabase/ssr` 쿠키 리버스엔지니어링으로 실제 로그인 세션 확보해 라이브 `/dashboard` 동시성 5~80 램프. 동시 30명은 3~9초, 50명 부근에서 34초로 급붕괴하나 그 순간 서버 CPU/RAM은 완전 유휴 — **병목이 vCPU2 서버가 아니라 대시보드 1회 로드당 약10개 Supabase 병렬쿼리의 Supabase Cloud 큐잉**임을 확인. vCPU/RAM 업그레이드로 해결 안 되는 별도 축(기존 Playwright 세마포어/워커=1 이슈와 무관). 페이지 동시접속 실질 안전선 약 30명 (2026-08-23)** |
| **`docs/guide_sibling_pages_inspection_v1.0.md`** ⭐ | **`/guide/chatgpt-search` 점검(사실정확성·논리모순·PC/모바일 디자인, git `dd58c2b`·`09ff1ac`) 완료 후 형제 페이지 `/guide/channels/[category]` 점검용 트리거 문서 — 동일 방법론 재사용 절차 + "오픈 전 트래픽 낮은 건 문제 아님" 주의사항 포함 (2026-09-02)** |
| **`docs/dashboard_load_delay_investigation_v1.0.md`** ⭐ | **대시보드 로딩 지연 조사 — 5가지 원인 순차 발견·수정(SSR공개도메인경유·Cloudflare해외우회·서버DNS정체·RLS정책중복·gap무캐시), 최댓값 106s→10.7s. **미완료**: 격리테스트로 남은 지연이 Supabase측 확률적 정체임을 확정, 다음 후보(Suspense 스트리밍 / Supabase 유료플랜) 미착수. §0에 재현용 벤치마크 스크립트 포함 (git `4211000`~`4ff0b4d`, 2026-09-22)** |
| **`docs/popular_shop_trust_improvement_handoff_v1.0.md`** ⭐ | **인기·유명 가게(예: 어니언 성수) 사장님이 스캔 결과를 보고 신뢰를 잃는 문제 — 사례·원인 6유형(A~F)·이미 구현된 방어선(ID 자동확정·미측정 재정규화·강점 신호 등)·남은 약점 8개·보완 과제 우선순위·오판 방지 규칙. 새 대화창 트리거 §0 포함 (2026-10-27)** |
| **`docs/next_session_handoff_trust_block_scale_v1.0.md`** ⭐ | **다음 세션 핸드오프 — 과제 01(인기/비인기 가게 스캔 결과 신뢰 정보)·02(네이버 차단 방지 전 축 체크리스트)·02-1(유료 IP 우회: 기술적으로 가능·과거 Decodo 가동 실측 있으나 차단 방지 근거 없고 법적 결합 쟁점, 현재 미적용)·03(300~500명 대응: 모델상 현 구조 약 50곳 한계, 500곳은 전부 적용해도 평균 3,500/일로 속도 기준 초과 → 구조 변경 필요). 현재 상태 스냅샷·미검증 목록·사용자 결정 대기 목록 포함 (2026-10-27)** |
| **`docs/trial_improvement_2026_09_28_v1.0.md`** ⭐ | **무료 체험 개선 작업 기록 — P0(체험 결과 DB 저장 실패: INTEGER 컬럼에 실수, 7/15~ 0건·즉시이메일 미발송)·Gemini 무료티어 한도(하루20회)·ChatGPT 유도형 프롬프트 오탐(표본 50회에서 가짜 가게 노출 판정)→비유도형 `sample_recommend` 교체·미측정→미노출 오표기 정정·탭 구조 재구성(5탭)·경쟁 5곳 블로그 막대·키워드 월검색량·AI 추천 가게+네이버 실존 대조. 잔여: Gemini 결제 연결(사용자 작업)·유료 스캔 ChatGPT 유도형 프로브·Google AI Overview 실체 재검토 (2026-09-28)** |

> **신뢰 정보·차단 방지·300~500명 대응 이어가기**: `docs/next_session_handoff_trust_block_scale_v1.0.md 기준으로 작업을 이어가줘. 진행할 과제: [01/02/02-1/03]`
> **새 대화창 시작 시 우선 트리거**: `docs/inspection_request_full.md` 1줄 명령으로 전체 시스템 점검·수정·배포 자동 진행. 부분 점검은 `§3.X`만 지정.
> **가이드 형제 페이지 점검**: `docs/guide_sibling_pages_inspection_v1.0.md 기준으로 /guide/channels/[category] 점검 진행`
> **대시보드 로딩 지연 이어가기**: `docs/dashboard_load_delay_investigation_v1.0.md 기준으로 §6 다음 후보(Suspense 스트리밍 또는 Supabase 유료플랜) 진행할지 알려줘`
> **관리자 기능 작업**: `docs/admin_panel_complete_documentation_v1.0.md 기준으로 관리자 페이지 현황 확인 후 진행`
> **대시보드 상단 디자인 이어가기**: `docs/dashboard_top_redesign_handoff_v1.0.md 기준으로 C(상단 디자인) 이어서 진행`
> **네이버 차단 대응 이어가기**: `docs/naver_briefing_block_countermeasure_handoff_v1.0.md 기준으로 작업 시작. 먼저 §3 선결 검증부터 실측한 뒤 §4 진행`
> **이번 세션 이어가기**: `docs/session_2026_07_01_naver_recheck_and_usergroup_fix_v1.0.md 기준으로 §7 NID_AUT/NID_SES 자동 재로그인 여부를 결정하고 진행할지 알려줘`
> **정보형 캐비엇 재점검**: `docs/naver_briefing_infotype_caveat_standard_v1.0.md 기준으로 정보형 캐비엇 재점검 진행`
> **9개 페이지 실측 점검**: `docs/nine_pages_measurement_inspection_v1.0.md 기준으로 실측 점검 진행`
> **블로그 진단 페이지 잔여작업**: `docs/blog_analysis_improvement_v2.0.md §4 기준으로 CI테스트게이트·비동기테스트·git reconcile 중 진행할 것 선택`
> **8개 페이지 상업적 전문성 재점검 잔여작업**: `docs/eight_pages_commercial_professionalism_recheck_v1.0.md 기준으로 §13 남은 작업 이어서 진행`
> **대시보드 외부벤치마크 점검**: `docs/dashboard_external_benchmark_inspection_plan_v1.0.md 기준으로 대시보드 점검 진행`
> **마스터 점검 종료 후 다음 단계(정리 또는 신규 기획)**: `docs/session_2026_07_11_next_steps_handoff_v1.0.md 기준으로 A(정리) 먼저 진행 후 B(신규 기능 기획)로 넘어가줘`
> **상업 서비스 점검 현황 파악/이어가기**: `docs/commercial_launch_inspection_status_v1.0.md 기준으로 §6-1(즉시 가치) 항목부터 진행`
> **블로그 진단 페이지 잔여작업 이어가기**: `docs/blog_diagnosis_session_2026_07_18_handoff_v1.0.md 기준으로 §6-1(showDetail 토글 재설계)부터 진행`
