// 사장님 계산기 — 순수 계산 함수와 기준값(출처·확인일·적용 연도 포함). 서버·DB 호출 없음.
//
// 원칙
// - 기준값은 공식 출처로 확인한 것만 기본값으로 쓴다(확인일·URL 표기). 확인하지 못한 값(배달앱 수수료율, 고용·산재보험 등)은
//   기본값 없이 사용자가 직접 입력한다.
// - 기준값에는 적용 연도(validThrough)가 있다. 그 날짜가 지나면 화면이 경고하고 최저임금 미달 같은 판정은 하지 않는다.
// - 결과는 참고용 추정이다. 실제 세액·보험료·정산액은 국세청·공단·정산서로 확인해야 한다.
// 테스트: frontend/tests/calc.test.mjs (npm run test:calc). 이 파일은 외부 import 없이 한 파일로 유지한다(테스트가 단독 변환).

export interface CalcSource {
  name: string;
  url: string;
}

export interface MinWageEntry {
  year: number;
  effectiveFrom: string; // 시행일 'YYYY-MM-DD'
  validThrough: string; // 적용 종료일
  hourly: number;
  monthlyHours: number;
  monthly: number;
  source: CalcSource;
}

export const CALC_BASIS = {
  checkedAt: "2026-11-16",
  // 연도별 최저임금. 방문 시점에 시행 중인 항목을 currentMinWage()로 고른다(없으면 null → 판정·자동입력 중단).
  minWages: [
    {
      year: 2026,
      effectiveFrom: "2026-01-01",
      validThrough: "2026-12-31",
      hourly: 10320,
      monthlyHours: 209, // 주 40시간 + 주휴 8시간 기준 월 환산 시간(고용노동부 고시)
      monthly: 2156880,
      source: {
        name: "고용노동부 — 2026년 적용 최저임금 시간급 10,320원",
        url: "https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=18144",
      },
    },
    {
      year: 2027,
      effectiveFrom: "2027-01-01",
      validThrough: "2027-12-31",
      hourly: 10700,
      monthlyHours: 209,
      monthly: 2236300,
      source: {
        name: "고용노동부 — 2027년도 적용 최저임금 시간급 10,700원(2026-08-05 고시)",
        url: "https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=19744",
      },
    },
  ] as MinWageEntry[],
  insurance: {
    year: 2026,
    validThrough: "2026-12-31",
    pensionPct: 9.5, // 국민연금 보험료율 — 사업장가입자는 근로자·사용자 각 절반
    healthPct: 7.19, // 직장가입자 건강보험료율 — 가입자·사용자 각 50%
    longTermCarePct: 0.9448, // 장기요양보험료율(소득 대비) — 건강보험료와 같이 각 절반
    sources: [
      {
        name: "보건복지부 — 2026년 건강보험료율 7.19% 결정",
        url: "https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1487279&mid=a10503000000",
      },
      {
        name: "국민건강보험공단 — 2026년도 보험료율 기준 안내",
        url: "https://www.nhis.or.kr/nhis/together/wbhaea01000m01.do?mode=view&articleNo=11008009",
      },
    ] as CalcSource[],
  },
  vat: {
    generalRatePct: 10, // 일반과세자 부가가치세율
    purchaseCreditPct: 0.5, // 간이과세자 매입(공급대가)에 대한 세액공제율
    // 간이과세자 납부의무 면제 기준: 과세기간(1년) 공급대가 합계 4,800만원 미만(신고 의무는 남음). 2026-11-16 세무 해설 자료로 확인, 국세청 원문은 직접 확인하지 못함.
    simplifiedExemptBelow: 48_000_000,
    // 간이과세자 업종별 부가가치율(2021-07-01 이후 기준, 국세청 안내). 시행령 원문은 이번에 직접 확인하지 못함.
    valueAddedRates: [
      { key: "retail_food", label: "소매업 · 음식점업", pct: 15 },
      { key: "manufacturing", label: "제조업 · 농업·임업·어업", pct: 20 },
      { key: "lodging", label: "숙박업", pct: 25 },
      { key: "other_service", label: "그 밖의 서비스업", pct: 30 },
    ] as { key: string; label: string; pct: number }[],
    source: {
      name: "국세청 — 부가가치세 기본정보(세율·간이과세)",
      url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272",
    } as CalcSource,
  },
};

/** 'YYYY-MM-DD' 기준일이 지났는지(한국 시간 해당일 끝까지 유효). now 는 테스트에서 주입. */
export function isPastValidThrough(validThrough: string, now: Date = new Date()): boolean {
  const end = Date.parse(`${validThrough}T23:59:59+09:00`);
  return Number.isFinite(end) && now.getTime() > end;
}

/** 방문 시점(now)에 시행 중인 최저임금. 시행 전이거나 적용 연도가 지났으면 null(옛 값으로 판정하지 않는다). */
export function currentMinWage(now: Date = new Date()): MinWageEntry | null {
  const t = now.getTime();
  return (
    CALC_BASIS.minWages.find(
      (m) => t >= Date.parse(`${m.effectiveFrom}T00:00:00+09:00`) && !isPastValidThrough(m.validThrough, now),
    ) ?? null
  );
}

/** 비율(%) 표시용 소수 첫째 자리 반올림 — 부동소수점 잔여(28.199999999999996)를 결과에 남기지 않는다 */
const round1 = (n: number): number => Math.round(n * 10) / 10 + 0;

/** 원 단위 반올림. Math.round(-0.4) 는 -0 이라 화면에 "-0"이 찍히므로 + 0 으로 +0 으로 맞춘다 */
const intR = (n: number): number => Math.round(n) + 0;

/** 입력 문자열 → 숫자. 쉼표·공백 제거, 비었거나 숫자가 아니면 null (0으로 취급하지 않는다) */
export function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = v.replace(/[,\s원%]/g, "");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ───────────────────────── 1. 손익분기점 · 마진 ─────────────────────────

export interface BreakEvenInput {
  price: number; // 판매가(부가세 제외, 단가)
  variableCost: number; // 단가당 변동원가(재료비 등)
  fixedCost: number; // 월 고정비(임대료·인건비·기타)
  operatingDays?: number | null; // 월 영업일수(입력했을 때만 일 단위 표시)
}

export type BreakEvenResult =
  | { ok: false; reason: "price_not_positive" | "cost_negative" | "fixed_negative" | "no_margin" }
  | {
      ok: true;
      unitProfit: number;
      marginRatePct: number; // (판매가-원가)/판매가
      markupPct: number | null; // (판매가-원가)/원가, 원가 0이면 null
      bepQty: number; // 월 손익분기 판매 수량(올림)
      bepSales: number; // 월 손익분기 매출 = 수량 × 판매가
      dailyQty: number | null;
      dailySales: number | null;
    };

export function breakEven(i: BreakEvenInput): BreakEvenResult {
  if (!(i.price > 0)) return { ok: false, reason: "price_not_positive" };
  if (i.variableCost < 0) return { ok: false, reason: "cost_negative" };
  if (i.fixedCost < 0) return { ok: false, reason: "fixed_negative" };
  const unitProfit = i.price - i.variableCost;
  if (unitProfit <= 0) return { ok: false, reason: "no_margin" };
  // 올림(부족하게 안내하지 않음). 고정비 0이면 Math.ceil(-1e-9) 가 -0 이 되므로 Math.max 로 +0 으로 맞춘다.
  const bepQty = Math.max(0, Math.ceil(i.fixedCost / unitProfit - 1e-9));
  const days = i.operatingDays && i.operatingDays > 0 ? i.operatingDays : null;
  return {
    ok: true,
    unitProfit,
    marginRatePct: round1((unitProfit / i.price) * 100),
    markupPct: i.variableCost > 0 ? round1((unitProfit / i.variableCost) * 100) : null,
    bepQty,
    bepSales: bepQty * i.price,
    dailyQty: days ? Math.max(0, Math.ceil(bepQty / days - 1e-9)) : null,
    dailySales: days ? Math.max(0, Math.ceil((bepQty * i.price) / days - 1e-9)) : null,
  };
}

// ───────────────────────── 2. 배달앱 정산 (주문 1건 기준) ─────────────────────────

export interface DeliveryInput {
  orderAmount: number; // 주문금액(메뉴 금액)
  brokerRatePct: number; // 중개수수료율 — 정산서 값을 사용자가 직접 입력(기본값 없음)
  paymentRatePct: number; // 결제수수료율 — 〃
  feeVatExtra: boolean; // 수수료에 부가세 10%가 별도로 붙는지(정산서 확인)
  deliveryCostBorne: number; // 업주 부담 배달비(원)
  discountBorne: number; // 업주 부담 할인·쿠폰(원)
  adCost: number; // 주문당 광고비(원)
  unitCost: number; // 이 주문의 원가(원)
  monthlyOrders?: number | null;
}

export type DeliveryResult =
  | { ok: false; reason: "amount_not_positive" | "negative_input" | "rate_out_of_range" }
  | {
      ok: true;
      brokerFee: number;
      paymentFee: number;
      feeVat: number;
      totalFees: number; // 수수료 합(부가세 포함)
      payout: number; // 실수령 = 주문금액 - 할인 - 수수료 - 배달비 - 광고비
      profit: number; // 실수령 - 원가
      profitRatePct: number; // 이익 / 주문금액
      burdenRatePct: number; // (수수료+배달비+광고비+할인) / 주문금액
      monthlyProfit: number | null;
    };

export function deliverySettlement(i: DeliveryInput): DeliveryResult {
  if (!(i.orderAmount > 0)) return { ok: false, reason: "amount_not_positive" };
  const nums = [i.brokerRatePct, i.paymentRatePct, i.deliveryCostBorne, i.discountBorne, i.adCost, i.unitCost];
  if (nums.some((n) => n < 0)) return { ok: false, reason: "negative_input" };
  // 수수료율은 0~100%, 합계도 100%를 넘을 수 없다(오타로 100 이상을 넣은 결과가 그럴듯하게 나오지 않게)
  if (i.brokerRatePct > 100 || i.paymentRatePct > 100 || i.brokerRatePct + i.paymentRatePct > 100) {
    return { ok: false, reason: "rate_out_of_range" };
  }
  // 수수료 부과 기준은 주문금액으로 둔다(정산서의 기준이 다르면 결과도 달라질 수 있음 — 화면에 안내)
  const brokerFee = (i.orderAmount * i.brokerRatePct) / 100;
  const paymentFee = (i.orderAmount * i.paymentRatePct) / 100;
  const feeVat = i.feeVatExtra ? ((brokerFee + paymentFee) * CALC_BASIS.vat.generalRatePct) / 100 : 0;
  const totalFees = brokerFee + paymentFee + feeVat;
  const payout = i.orderAmount - i.discountBorne - totalFees - i.deliveryCostBorne - i.adCost;
  const profit = payout - i.unitCost;
  const orders = i.monthlyOrders && i.monthlyOrders > 0 ? i.monthlyOrders : null;
  return {
    ok: true,
    brokerFee: intR(brokerFee),
    paymentFee: intR(paymentFee),
    feeVat: intR(feeVat),
    totalFees: intR(totalFees),
    payout: intR(payout),
    profit: intR(profit),
    profitRatePct: round1((profit / i.orderAmount) * 100),
    burdenRatePct: round1(((totalFees + i.deliveryCostBorne + i.adCost + i.discountBorne) / i.orderAmount) * 100),
    monthlyProfit: orders ? intR(profit * orders) : null,
  };
}

// ───────────────────────── 3. 인건비 ─────────────────────────

/**
 * 월 환산 근로시간(주휴 포함) = (주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12 를 반올림.
 * 주 40시간이면 209시간(고용노동부 고시와 일치). 주휴시간은 주 15시간 이상일 때 (주 소정근로시간 ÷ 40 × 8, 최대 8시간).
 */
export function laborMonthlyHours(weeklyHours: number): { paidHolidayHours: number; monthlyHours: number } {
  const w = Math.max(0, weeklyHours);
  const paidHolidayHours = w >= 15 ? Math.min(8, (w / 40) * 8) : 0;
  const monthlyHours = Math.round(((w + paidHolidayHours) * 365) / 7 / 12);
  return { paidHolidayHours, monthlyHours };
}

export interface LaborInput {
  hourly: number; // 시급(원)
  weeklyHours: number; // 주 소정근로시간
  includeInsurance: boolean; // 사업주 부담 4대보험(국민연금·건강·장기요양) 개략 포함
  otherEmployerPct?: number | null; // 고용·산재보험 등 직접 입력(%) — 기본값 없음
  includeSeverance?: boolean; // 퇴직금 적립(월급의 약 1/12) 개략 포함
  now?: Date;
}

export type LaborResult =
  | { ok: false; reason: "hourly_not_positive" | "hours_not_positive" | "hours_too_large" | "other_pct_out_of_range" }
  | {
      ok: true;
      monthlyHours: number;
      paidHolidayHours: number;
      monthlyWage: number; // 시급 × 월 환산 시간(주휴수당 포함)
      pension: number; // 사업주 국민연금(개략)
      health: number;
      longTermCare: number;
      other: number;
      insuranceTotal: number;
      severance: number; // 퇴직금 적립(개략, 월급 ÷ 12)
      monthlyTotal: number;
      yearlyTotal: number;
      minWage: { year: number; hourly: number } | null; // 판정에 쓴 시행 중 최저임금(없으면 null)
      belowMinWage: boolean | null; // null = 시행 중인 기준이 없어 판정하지 않음
      overFortyHours: boolean;
    };

export function laborCost(i: LaborInput): LaborResult {
  if (!(i.hourly > 0)) return { ok: false, reason: "hourly_not_positive" };
  if (!(i.weeklyHours > 0)) return { ok: false, reason: "hours_not_positive" };
  if (i.weeklyHours > 168) return { ok: false, reason: "hours_too_large" }; // 일주일은 168시간
  if (i.otherEmployerPct != null && (i.otherEmployerPct < 0 || i.otherEmployerPct > 100)) {
    return { ok: false, reason: "other_pct_out_of_range" };
  }
  const { paidHolidayHours, monthlyHours } = laborMonthlyHours(i.weeklyHours);
  const monthlyWage = Math.round(i.hourly * monthlyHours);
  const ins = CALC_BASIS.insurance;
  // 사업주 부담 = 노사 각 절반. 상·하한 기준소득·비과세 제외·단시간근로자 가입 예외는 반영하지 않은 개략치.
  const pension = i.includeInsurance ? Math.round((monthlyWage * ins.pensionPct) / 100 / 2) : 0;
  const health = i.includeInsurance ? Math.round((monthlyWage * ins.healthPct) / 100 / 2) : 0;
  const longTermCare = i.includeInsurance ? Math.round((monthlyWage * ins.longTermCarePct) / 100 / 2) : 0;
  const other = i.otherEmployerPct && i.otherEmployerPct > 0 ? Math.round((monthlyWage * i.otherEmployerPct) / 100) : 0;
  const insuranceTotal = pension + health + longTermCare + other;
  // 퇴직금은 1년 이상 근무·주 15시간 이상 등 조건이 있고 실제 금액은 평균임금으로 정해지므로 월급의 1/12 개략치만 보여 준다
  const severance = i.includeSeverance ? Math.round(monthlyWage / 12) : 0;
  const monthlyTotal = monthlyWage + insuranceTotal + severance;
  const mw = currentMinWage(i.now);
  return {
    ok: true,
    monthlyHours,
    paidHolidayHours,
    monthlyWage,
    pension,
    health,
    longTermCare,
    other,
    insuranceTotal,
    severance,
    monthlyTotal,
    yearlyTotal: monthlyTotal * 12,
    minWage: mw ? { year: mw.year, hourly: mw.hourly } : null,
    belowMinWage: mw ? i.hourly < mw.hourly : null,
    overFortyHours: i.weeklyHours > 40,
  };
}

// ───────────────────────── 4. 부가가치세 ─────────────────────────

/** 부가세 포함 합계 → 공급가액·세액 (합계 ÷ 1.1, 원 미만 반올림 — 신고서와 1원 차이가 날 수 있음) */
export function splitVat(total: number): { supply: number; tax: number } {
  const supply = Math.round(total / (1 + CALC_BASIS.vat.generalRatePct / 100));
  return { supply, tax: Math.round(total) - supply };
}

/** 공급가액 → 세액·합계 */
export function addVat(supply: number): { tax: number; total: number } {
  const tax = Math.round((supply * CALC_BASIS.vat.generalRatePct) / 100);
  return { tax, total: Math.round(supply) + tax };
}

/** 일반과세 납부세액 추정 = 매출세액 - 매입세액 (음수면 환급 가능 추정) */
export function generalVatPayable(i: { salesSupply: number; purchaseSupply: number }) {
  const salesTax = Math.round((i.salesSupply * CALC_BASIS.vat.generalRatePct) / 100);
  const purchaseTax = Math.round((i.purchaseSupply * CALC_BASIS.vat.generalRatePct) / 100);
  return { salesTax, purchaseTax, payable: salesTax - purchaseTax };
}

/**
 * 간이과세 납부세액 추정 = 공급대가 × 업종 부가가치율 × 10% - 매입(공급대가) × 0.5%. 음수는 0(환급 없음).
 * 신용카드 발행세액공제·납부의무 면제·예정부과 등은 반영하지 않는다.
 */
export function simplifiedVatPayable(i: { salesTotal: number; purchaseTotal: number; valueAddedPct: number }) {
  const outputTax = Math.round((i.salesTotal * i.valueAddedPct * CALC_BASIS.vat.generalRatePct) / 100 / 100);
  const credit = Math.round((i.purchaseTotal * CALC_BASIS.vat.purchaseCreditPct) / 100);
  return { outputTax, credit, payable: Math.max(0, outputTax - credit) };
}
