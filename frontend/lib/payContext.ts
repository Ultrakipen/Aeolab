/**
 * 크렙 카드등록 → 결제 성공 화면으로 plan·amount를 넘기는 방법 (2026-10-27 실결제 시험에서 발견한 결함 수정).
 *
 * 크렙은 successUrl 뒤에 항상 `?auth_key=…`를 붙인다. successUrl에 이미 `?plan=…&amount=…`가 있으면
 * `…&amount=8950?auth_key=…`처럼 되어 amount가 NaN, auth_key가 없는 것으로 읽혀 "결제 정보가 올바르지 않습니다"로
 * 실패했다(카드 승인 전 단계라 청구는 없었다). 그래서 successUrl은 쿼리 없이 쓰고 plan·amount는 이 저장소로 넘긴다.
 * 금액은 서버(billing/issue)가 다시 검증하므로 화면 표시·요청 값일 뿐 신뢰 근거가 아니다.
 */
const KEY = "aeolab_pay_ctx";
const MAX_AGE_MS = 30 * 60 * 1000;

export function savePayContext(plan: string, amount: number): void {
  const v = JSON.stringify({ plan, amount, at: Date.now() });
  try { sessionStorage.setItem(KEY, v); } catch { /* 저장소 차단 환경 — URL 값으로 폴백 */ }
  try { localStorage.setItem(KEY, v); } catch { /* 위와 동일 */ }
}

export function loadPayContext(): { plan: string; amount: number } | null {
  for (const store of [() => sessionStorage, () => localStorage]) {
    try {
      const raw = store().getItem(KEY);
      if (!raw) continue;
      const o = JSON.parse(raw) as { plan?: string; amount?: number; at?: number };
      if (o.plan && typeof o.amount === "number" && o.amount > 0 && Date.now() - (o.at ?? 0) <= MAX_AGE_MS) {
        return { plan: o.plan, amount: o.amount };
      }
    } catch { /* 다음 저장소 시도 */ }
  }
  return null;
}

export function clearPayContext(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* 무시 */ }
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

/** 돌아온 주소에서 auth_key·plan·amount를 읽는다 — 값 안에 `?auth_key=…`가 붙은 깨진 형태(과거 successUrl)도 복구한다. */
export function parseCrebReturn(params: URLSearchParams): { authKey: string | null; plan: string | null; amount: number | null } {
  let authKey = params.get("auth_key");
  const clean: Record<string, string> = {};
  params.forEach((value, name) => {
    const q = value.indexOf("?");
    if (q >= 0) {
      const embedded = new URLSearchParams(value.slice(q + 1));
      authKey = authKey ?? embedded.get("auth_key");
      clean[name] = value.slice(0, q);
    } else {
      clean[name] = value;
    }
  });
  const amount = Number(clean["amount"]);
  return {
    authKey: authKey || null,
    plan: clean["plan"] || null,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
  };
}
