/**
 * Gemini 측정 정상 가동 여부 (2026-10-27).
 *
 * ⚠️ 2026-10-30: **false로 되돌림.** 2026-10-27에는 사용자 지시로 true였으나(결제·크레딧 곧 연결 가정) 2026-10-30에 사용자가
 * Gemini 결제 연결을 차후로 결정했고, 같은 날 서버 `ai_usage_log` 최근 24시간 Gemini 측정이 4 성공/96 실패(ResourceExhausted)였다.
 * 결제를 연결한 직후 `scripts/check_ai_providers.py`로 Gemini 10회 중 9회 이상 성공하는지 확인하고 true로 바꿔 재빌드할 것.
 *
 * Gemini 무료 티어 한도로 100회 측정 중 90회 이상이 실패하는 동안(AI 호출 성공 표본 4~9회)
 * "Gemini·ChatGPT 각 100회 자동 측정"이라는 안내는 사실과 다르다. false인 동안 공개·가입·결제 화면의
 * 측정 횟수 문구는 ChatGPT 기준으로만 쓴다.
 *
 * 결제 연결 후 대시보드에서 Gemini 표본이 정상(100회 근처)으로 쌓이는 것을 확인하고 true로 바꾼 뒤 재빌드한다.
 * (개별 기능 설명·반영 기간 같은 교육용 문구는 이 플래그와 무관하게 그대로 둔다.)
 *
 * ── 켜는 절차(2026-11-02, 유료화 예정에 맞춰 문구를 미리 정리해 둠) ──────────────────────────────
 * 이 플래그 하나로 사이트 전체의 제미나이 문구가 '준비 중' → '정상 측정'으로 바뀐다. 제미나이를 언급하는 모든 '준비 중' 표기는
 * 같은 줄에 이 플래그를 두도록 `tests/test_frontend_no_unverified_ai_claims.py`가 강제한다(고정 문구가 남아 켠 뒤에도 '준비 중'이
 * 보이는 일을 막는다). 켜기 전 확인:
 *   1) AI Studio에서 이 키의 프로젝트가 유료 등급(Tier 1 이상)으로 표시되는지
 *   2) 서버에서 동시 30건 호출 시험(제한 없이)이 전부 성공하는지 — 무료 등급이면 분당 한도로 일부가 ResourceExhausted
 *   3) `scripts/check_ai_providers.py`의 Gemini가 10/10 성공
 *   4) 야간 스캔 한 번의 gemini_result 표본이 요청 수 근처인지(`scripts/check_nightly_after_model_switch.py`)
 *   5) 서버 .env의 GEMINI_MIN_INTERVAL(무료 등급용 4.5초)을 줄여 100표본이 야간 스캔 시간 안에 끝나게 조정
 * 켠 뒤: 프론트를 빌드·재시작하고 랜딩·요금제·FAQ·체험 결과·결제 완료 화면에서 '준비 중'이 사라졌는지 확인한다.
 * 켜는 순간부터 공개 문구가 "각 100회", "4곳 측정"으로 바뀌므로 위 확인 전에 켜지 말 것.
 */
export const GEMINI_MEASUREMENT_LIVE = false;

const G = GEMINI_MEASUREMENT_LIVE;
/** "ChatGPT·Gemini" 또는 "ChatGPT" */
export const AI_NAMES = G ? "ChatGPT·Gemini" : "ChatGPT";
/** 측정 서비스 수(네이버·ChatGPT·구글 + Gemini) */
export const AI_COUNT_LABEL = G ? "4곳" : "3곳";
/** 측정 서비스 수 숫자(네이버·ChatGPT·구글 + Gemini) */
export const AI_COUNT_N = G ? 4 : 3;
/** "ChatGPT·Gemini 각 100회" 또는 "ChatGPT 100회" */
export const aiEach = (n: number, unit = "회") => (G ? `ChatGPT·Gemini 각 ${n}${unit}` : `ChatGPT ${n}${unit}`);
