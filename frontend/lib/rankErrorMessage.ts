/**
 * 키워드 순위 측정 중 일부가 실패했을 때 사용자에게 보여 줄 안내 문장 (2026-11-10).
 *
 * 서버(`/api/scan/keyword-rank`)는 `_context.errors`를 그대로 돌려준다(예: "키워드: search_blocked", "playwright: TimeoutError…",
 * "playwright_queue_timeout"). 이전 화면은 이 문자열 앞 2개를 `일부 키워드 측정 실패: …`로 그대로 찍어 영문 내부 코드가 사용자에게 보였다.
 * 원인을 쉬운 말로 바꾸고, 측정하지 못한 키워드가 '첫 화면 밖'(순위권에 없음)이 아니라는 점을 분명히 한다. 내부 코드는 절대 노출하지 않는다.
 */
export function describeRankErrors(errors: unknown[] | null | undefined): string {
  const joined = (errors ?? []).map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join(" ").toLowerCase();

  if (joined.includes("search_blocked") || joined.includes("cooldown")) {
    return "네이버가 잠시 검색 화면 접속을 제한해 일부 키워드는 확인하지 못했습니다. 잠시 뒤 다시 측정해 주세요. 확인하지 못한 키워드는 '첫 화면 밖'이라는 뜻이 아닙니다.";
  }
  if (joined.includes("playwright_queue_timeout")) {
    return "지금 다른 측정이 진행 중이라 이번에는 일부 키워드를 확인하지 못했습니다. 잠시 뒤 다시 측정해 주세요.";
  }
  if (joined.includes("list_unread")) {
    return "일부 키워드는 검색 결과 화면을 읽지 못해 순위를 확인하지 못했습니다. 잠시 뒤 다시 측정해 주세요.";
  }
  return "일부 키워드는 이번에 측정하지 못했습니다. 잠시 뒤 다시 시도해 주세요. 측정하지 못한 키워드는 순위권 밖으로 기록하지 않습니다.";
}
