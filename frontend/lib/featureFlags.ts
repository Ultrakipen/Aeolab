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
 */
export const GEMINI_MEASUREMENT_LIVE = false;

const G = GEMINI_MEASUREMENT_LIVE;
/** "ChatGPT·Gemini" 또는 "ChatGPT" */
export const AI_NAMES = G ? "ChatGPT·Gemini" : "ChatGPT";
/** 측정 서비스 수(네이버·ChatGPT·구글 + Gemini) */
export const AI_COUNT_LABEL = G ? "4곳" : "3곳";
