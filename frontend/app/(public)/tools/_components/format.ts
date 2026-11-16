// 계산기 공통 표기 — 원·퍼센트·입력 문자열 정리

/** 입력 중인 문자열을 숫자 형태로만 남긴다(소수 허용 시 점은 한 번만). 쉼표는 표시 단계에서만 붙인다. */
export function cleanNumberInput(raw: string, decimal: boolean): string {
  let s = raw.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
  if (decimal) {
    const i = s.indexOf(".");
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  }
  // 정수부 12자리(1조 미만)·소수부 4자리까지 — 너무 큰 값은 지수 표기(1e+21)로 깨져 보이므로 입력 단계에서 막는다
  const [int, frac] = s.split(".");
  const head = int.slice(0, 12);
  return frac === undefined ? head : `${head}.${frac.slice(0, 4)}`;
}

/** 표시용: 정수부에 천 단위 쉼표(입력 중인 소수점·끝자리 0은 그대로 보존) */
export function displayNumberInput(s: string): string {
  if (s === "") return "";
  const [int, frac] = s.split(".");
  const head = int === "" ? "0" : String(Number(int)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === undefined ? head : `${head}.${frac}`;
}

export function fmtWon(n: number): string {
  // -0 / 비정상 값은 "0원"/"-"로 정리
  if (!Number.isFinite(n)) return "-";
  const v = Math.round(n) + 0;
  return `${v.toLocaleString("ko-KR")}원`;
}

export function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return `${(Math.round(n * 10) / 10 + 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}

export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return (Math.round(n) + 0).toLocaleString("ko-KR");
}
