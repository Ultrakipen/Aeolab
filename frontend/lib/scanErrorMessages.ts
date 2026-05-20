/**
 * scanErrorMessages.ts
 * 스캔 API 오류 HTTP 상태 코드 → 사용자 친화적 한국어 메시지 매핑.
 * ScanTrigger 및 기타 스캔 진입점에서 재사용한다.
 */

export interface ScanErrorInfo {
  /** 사용자에게 표시할 메시지 */
  message: string;
  /** 재시도 가능 여부 (UI에서 재시도 버튼 표시 여부 결정) */
  retryable: boolean;
}

/**
 * HTTP status + 백엔드 code 문자열을 받아 사용자 메시지를 반환한다.
 * @param status HTTP 응답 상태코드 (0 = 네트워크 오류)
 * @param code   백엔드 JSON `detail.code` (없으면 빈 문자열)
 */
export function getScanErrorInfo(status: number, code = ""): ScanErrorInfo {
  // 백엔드 에러 코드 우선 분기
  if (code === "SCAN_IN_PROGRESS") {
    return { message: "이미 스캔이 진행 중입니다. 잠시 후 다시 시도해 주세요.", retryable: true };
  }
  if (code === "SCAN_LIMIT" || code === "SCAN_DAILY_LIMIT") {
    return {
      message: "오늘 스캔 한도를 모두 사용했습니다. 내일 다시 시도하거나 Pro로 업그레이드해 주세요.",
      retryable: false,
    };
  }
  if (code === "PLAN_REQUIRED") {
    return {
      message: "무료 체험 스캔 1회를 이미 사용했습니다. 계속 이용하려면 Basic 플랜으로 업그레이드하세요.",
      retryable: false,
    };
  }
  if (code === "BIZ_NOT_FOUND") {
    return { message: "사업장 정보를 찾을 수 없습니다. 페이지를 새로고침해 주세요.", retryable: false };
  }

  // HTTP 상태 기반 분기
  if (status === 0) {
    return { message: "네트워크 연결을 확인하고 다시 시도해 주세요.", retryable: true };
  }
  if (status === 429) {
    return { message: "스캔 요청이 많습니다. 1~2분 후 다시 시도해 주세요.", retryable: true };
  }
  if (status === 402 || status === 403) {
    return {
      message: "오늘 스캔 한도를 모두 사용했습니다. 내일 다시 시도하거나 Pro로 업그레이드해 주세요.",
      retryable: false,
    };
  }
  if (status >= 500) {
    return {
      message:
        "AI 서비스 일시 응답 지연입니다. 잠시 후 다시 시도해 주세요. 문제 지속 시 hello@aeolab.co.kr로 연락 주세요.",
      retryable: true,
    };
  }

  // 기본 폴백
  return { message: "스캔을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.", retryable: true };
}

/** SSE/스캔 중 타임아웃 메시지 (60초 이상 응답 없을 때) */
export const SCAN_TIMEOUT_MESSAGE =
  "스캔이 예상보다 오래 걸리고 있습니다. 페이지를 새로고침하시거나 잠시 후 다시 시도해 주세요.";
