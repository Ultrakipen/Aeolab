// 사장님 계산기 순수 함수 시험 — 실행: cd frontend && npm run test:calc
// lib/calc/index.ts 를 TypeScript 컴파일러로 변환해 불러온다(별도 테스트 프레임워크 없이 node 내장 test 사용).
// 기대값은 코드와 별개로 손계산한 값이다(코드의 식을 복사해 검증하지 않는다).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const src = fs.readFileSync(new URL("../lib/calc/index.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = path.join(os.tmpdir(), `aeolab_calc_${process.pid}.mjs`);
fs.writeFileSync(tmp, js);
const C = await import(pathToFileURL(tmp).href);
process.on("exit", () => {
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* 임시 파일 정리 실패는 무시 */
  }
});

test("기준값: 연도별 최저임금 월 환산이 고시값과 일치(2026·2027)", () => {
  const [m26, m27] = C.CALC_BASIS.minWages;
  assert.equal(m26.year, 2026);
  assert.equal(m26.hourly, 10320);
  assert.equal(m26.hourly * m26.monthlyHours, 2156880);
  assert.equal(m26.monthly, 2156880);
  assert.equal(m27.year, 2027);
  assert.equal(m27.hourly, 10700);
  assert.equal(m27.monthlyHours, 209);
  assert.equal(m27.hourly * m27.monthlyHours, 2236300); // 고용노동부 고시 월 환산액
  assert.equal(m27.monthly, 2236300);
  assert.ok(m26.source.url.includes("news_seq=18144") && m27.source.url.includes("news_seq=19744"));
});

test("시행 중 최저임금: 한국 시간 기준 연도 경계에서 자동 전환, 범위 밖이면 null", () => {
  assert.equal(C.currentMinWage(new Date("2026-06-01T00:00:00Z")).year, 2026);
  assert.equal(C.currentMinWage(new Date("2026-12-31T14:59:59Z")).year, 2026); // 23:59:59 KST
  assert.equal(C.currentMinWage(new Date("2026-12-31T15:00:00Z")).year, 2027); // 2027-01-01 00:00 KST
  assert.equal(C.currentMinWage(new Date("2027-12-31T14:59:59Z")).year, 2027);
  assert.equal(C.currentMinWage(new Date("2027-12-31T15:00:00Z")), null); // 2028 고시 전: 옛 값으로 판정하지 않는다
  assert.equal(C.currentMinWage(new Date("2025-12-31T14:59:59Z")), null); // 2026 시행 전
});

test("유효 기간: 한국 시간 당일 끝까지 유효, 다음 순간부터 만료", () => {
  assert.equal(C.isPastValidThrough("2026-12-31", new Date("2026-12-31T14:59:59Z")), false); // 23:59:59 KST
  assert.equal(C.isPastValidThrough("2026-12-31", new Date("2026-12-31T15:00:00Z")), true); // 00:00 KST 다음 날
  assert.equal(C.isPastValidThrough("2026-12-31", new Date("2026-06-01T00:00:00Z")), false);
});

test("parseNum: 비어 있거나 숫자가 아니면 null, 0은 유효한 값", () => {
  assert.equal(C.parseNum("1,234원"), 1234);
  assert.equal(C.parseNum(" 12.5% "), 12.5);
  assert.equal(C.parseNum("0"), 0);
  assert.equal(C.parseNum(""), null);
  assert.equal(C.parseNum("abc"), null);
  assert.equal(C.parseNum(null), null);
  assert.equal(C.parseNum("-"), null);
});

test("손익분기점: 기본 계산·올림·일 단위", () => {
  const r = C.breakEven({ price: 10000, variableCost: 4000, fixedCost: 3_000_000, operatingDays: 25 });
  assert.equal(r.ok, true);
  assert.equal(r.unitProfit, 6000);
  assert.equal(r.marginRatePct, 60);
  assert.equal(r.markupPct, 150);
  assert.equal(r.bepQty, 500);
  assert.equal(r.bepSales, 5_000_000);
  assert.equal(r.dailyQty, 20);
  assert.equal(r.dailySales, 200_000);
  // 나누어떨어지지 않으면 올림(부족하게 안내하지 않는다)
  assert.equal(C.breakEven({ price: 10000, variableCost: 4000, fixedCost: 3_000_001 }).bepQty, 501);
  // 영업일수를 입력하지 않으면 일 단위는 없음(임의 값으로 채우지 않는다)
  assert.equal(C.breakEven({ price: 10000, variableCost: 4000, fixedCost: 3_000_000 }).dailyQty, null);
  assert.equal(C.breakEven({ price: 10000, variableCost: 4000, fixedCost: 0 }).bepQty, 0);
});

test("손익분기점: 이익이 날 수 없거나 잘못된 입력은 오류로 돌려준다", () => {
  assert.deepEqual(C.breakEven({ price: 10000, variableCost: 10000, fixedCost: 1 }), { ok: false, reason: "no_margin" });
  assert.deepEqual(C.breakEven({ price: 10000, variableCost: 12000, fixedCost: 1 }), { ok: false, reason: "no_margin" });
  assert.deepEqual(C.breakEven({ price: 0, variableCost: 0, fixedCost: 1 }), { ok: false, reason: "price_not_positive" });
  assert.deepEqual(C.breakEven({ price: 100, variableCost: -1, fixedCost: 1 }), { ok: false, reason: "cost_negative" });
  assert.deepEqual(C.breakEven({ price: 100, variableCost: 1, fixedCost: -1 }), { ok: false, reason: "fixed_negative" });
  assert.equal(C.breakEven({ price: 100, variableCost: 0, fixedCost: 1000 }).markupPct, null); // 원가 0이면 마크업은 정의 안 됨
});

test("배달 정산: 수수료·부가세·실수령·이익", () => {
  const base = {
    orderAmount: 20000, brokerRatePct: 10, paymentRatePct: 3, feeVatExtra: true,
    deliveryCostBorne: 2000, discountBorne: 1000, adCost: 500, unitCost: 8000, monthlyOrders: 100,
  };
  const r = C.deliverySettlement(base);
  assert.equal(r.ok, true);
  assert.equal(r.brokerFee, 2000);
  assert.equal(r.paymentFee, 600);
  assert.equal(r.feeVat, 260);
  assert.equal(r.totalFees, 2860);
  assert.equal(r.payout, 13640); // 20000-1000-2860-2000-500
  assert.equal(r.profit, 5640);
  assert.equal(r.profitRatePct, 28.2);
  assert.equal(r.burdenRatePct, 31.8); // (2860+2000+500+1000)/20000
  assert.equal(r.monthlyProfit, 564000);
  const noVat = C.deliverySettlement({ ...base, feeVatExtra: false });
  assert.equal(noVat.feeVat, 0);
  assert.equal(noVat.payout, 13900);
  assert.equal(C.deliverySettlement({ ...base, monthlyOrders: null }).monthlyProfit, null);
});

test("배달 정산: 잘못된 입력", () => {
  const base = { orderAmount: 20000, brokerRatePct: 0, paymentRatePct: 0, feeVatExtra: false, deliveryCostBorne: 0, discountBorne: 0, adCost: 0, unitCost: 0 };
  assert.deepEqual(C.deliverySettlement({ ...base, orderAmount: 0 }), { ok: false, reason: "amount_not_positive" });
  assert.deepEqual(C.deliverySettlement({ ...base, brokerRatePct: -1 }), { ok: false, reason: "negative_input" });
  // 수수료율 0 이어도 계산은 된다(0은 입력 안 한 것과 다름 — 호출부가 빈 값을 구분)
  assert.equal(C.deliverySettlement(base).ok, true);
});

test("월 환산 근로시간: 주 40시간은 고시값 209, 단시간·15시간 미만은 주휴 없음", () => {
  assert.deepEqual(C.laborMonthlyHours(40), { paidHolidayHours: 8, monthlyHours: 209 });
  assert.deepEqual(C.laborMonthlyHours(20), { paidHolidayHours: 4, monthlyHours: 104 }); // (20+4)*365/7/12=104.29
  assert.deepEqual(C.laborMonthlyHours(10), { paidHolidayHours: 0, monthlyHours: 43 }); // 10*365/7/12=43.45
  assert.equal(C.laborMonthlyHours(15).paidHolidayHours, 3); // 15시간부터 주휴
  assert.equal(C.laborMonthlyHours(14.9).paidHolidayHours, 0);
  assert.equal(C.laborMonthlyHours(48).paidHolidayHours, 8); // 8시간 상한
});

test("인건비: 최저임금 주 40시간 + 사업주 4대보험 개략", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const r = C.laborCost({ hourly: 10320, weeklyHours: 40, includeInsurance: true, otherEmployerPct: null, now });
  assert.equal(r.ok, true);
  assert.equal(r.monthlyWage, 2156880);
  assert.equal(r.pension, 102452); // 2,156,880 × 9.5% ÷ 2
  assert.equal(r.health, 77540); // × 7.19% ÷ 2
  assert.equal(r.longTermCare, 10189); // × 0.9448% ÷ 2
  assert.equal(r.other, 0);
  assert.equal(r.insuranceTotal, 190181);
  assert.equal(r.monthlyTotal, 2347061);
  assert.equal(r.yearlyTotal, 2347061 * 12);
  assert.equal(r.belowMinWage, false);
  assert.equal(r.overFortyHours, false);
  // 보험 제외·직접 입력(고용·산재) 반영
  const noIns = C.laborCost({ hourly: 10320, weeklyHours: 40, includeInsurance: false, now });
  assert.equal(noIns.insuranceTotal, 0);
  const other = C.laborCost({ hourly: 10320, weeklyHours: 40, includeInsurance: false, otherEmployerPct: 1.5, now });
  assert.equal(other.other, Math.round(2156880 * 0.015));
});

test("인건비: 최저임금 미달 판정은 시행 중인 연도 기준으로, 기준이 없으면 판정하지 않는다", () => {
  const at = (iso, hourly) => C.laborCost({ hourly, weeklyHours: 40, includeInsurance: false, now: new Date(iso) });
  const in26 = at("2026-06-01T00:00:00Z", 9000);
  assert.equal(in26.belowMinWage, true);
  assert.deepEqual(in26.minWage, { year: 2026, hourly: 10320 });
  assert.equal(at("2026-06-01T00:00:00Z", 10320).belowMinWage, false);
  // 2027년에는 2027 기준(10,700원)으로 판정 — 10,500원은 2026엔 통과, 2027엔 미달
  assert.equal(at("2026-06-01T00:00:00Z", 10500).belowMinWage, false);
  const in27 = at("2027-01-02T00:00:00Z", 10500);
  assert.equal(in27.belowMinWage, true);
  assert.deepEqual(in27.minWage, { year: 2027, hourly: 10700 });
  assert.equal(at("2027-01-02T00:00:00Z", 10700).belowMinWage, false);
  // 2028년(고시 전)에는 옛 값으로 단정하지 않는다
  const in28 = at("2028-01-02T00:00:00Z", 9000);
  assert.equal(in28.belowMinWage, null);
  assert.equal(in28.minWage, null);
  assert.equal(C.laborCost({ hourly: 10000, weeklyHours: 45, includeInsurance: false }).overFortyHours, true);
  assert.deepEqual(C.laborCost({ hourly: 0, weeklyHours: 40, includeInsurance: false }), { ok: false, reason: "hourly_not_positive" });
  assert.deepEqual(C.laborCost({ hourly: 10000, weeklyHours: 0, includeInsurance: false }), { ok: false, reason: "hours_not_positive" });
});

test("인건비: 퇴직금 적립(월급의 1/12)은 켰을 때만 총액에 포함", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const off = C.laborCost({ hourly: 10320, weeklyHours: 40, includeInsurance: false, now });
  assert.equal(off.severance, 0);
  assert.equal(off.monthlyTotal, 2156880);
  const on = C.laborCost({ hourly: 10320, weeklyHours: 40, includeInsurance: false, includeSeverance: true, now });
  assert.equal(on.severance, 179740); // 2,156,880 ÷ 12
  assert.equal(on.monthlyTotal, 2156880 + 179740);
  assert.equal(on.yearlyTotal, (2156880 + 179740) * 12);
  const all = C.laborCost({ hourly: 10320, weeklyHours: 40, includeInsurance: true, includeSeverance: true, now });
  assert.equal(all.monthlyTotal, 2156880 + 190181 + 179740);
});

test("입력 범위: 수수료율 100% 초과·합계 초과, 주 168시간 초과, 기타 보험률 범위", () => {
  const d = { orderAmount: 20000, brokerRatePct: 0, paymentRatePct: 0, feeVatExtra: false, deliveryCostBorne: 0, discountBorne: 0, adCost: 0, unitCost: 0 };
  assert.deepEqual(C.deliverySettlement({ ...d, brokerRatePct: 101 }), { ok: false, reason: "rate_out_of_range" });
  assert.deepEqual(C.deliverySettlement({ ...d, brokerRatePct: 60, paymentRatePct: 50 }), { ok: false, reason: "rate_out_of_range" });
  assert.equal(C.deliverySettlement({ ...d, brokerRatePct: 60, paymentRatePct: 40 }).ok, true); // 합계 100%는 허용
  const l = { hourly: 10000, weeklyHours: 40, includeInsurance: false };
  assert.deepEqual(C.laborCost({ ...l, weeklyHours: 169 }), { ok: false, reason: "hours_too_large" });
  assert.equal(C.laborCost({ ...l, weeklyHours: 168 }).ok, true);
  assert.deepEqual(C.laborCost({ ...l, otherEmployerPct: 101 }), { ok: false, reason: "other_pct_out_of_range" });
  assert.deepEqual(C.laborCost({ ...l, otherEmployerPct: -1 }), { ok: false, reason: "other_pct_out_of_range" });
  assert.equal(C.laborCost({ ...l, otherEmployerPct: null }).ok, true);
});

test("부가세: 공급가액·세액 분리와 가산", () => {
  assert.deepEqual(C.splitVat(110000), { supply: 100000, tax: 10000 });
  assert.deepEqual(C.splitVat(11000), { supply: 10000, tax: 1000 });
  assert.deepEqual(C.splitVat(10000), { supply: 9091, tax: 909 }); // 합계는 항상 보존
  assert.deepEqual(C.addVat(100000), { tax: 10000, total: 110000 });
  const s = C.splitVat(123457);
  assert.equal(s.supply + s.tax, 123457);
});

test("부가세: 일반과세 납부세액(환급 가능 추정 포함)", () => {
  assert.deepEqual(C.generalVatPayable({ salesSupply: 10_000_000, purchaseSupply: 6_000_000 }), {
    salesTax: 1_000_000, purchaseTax: 600_000, payable: 400_000,
  });
  assert.equal(C.generalVatPayable({ salesSupply: 1_000_000, purchaseSupply: 3_000_000 }).payable, -200_000);
});

test("부가세: 간이과세 납부세액 — 매출세액 72만원(4,800만원×15%×10%), 공제 15만원, 환급 없음", () => {
  assert.deepEqual(C.simplifiedVatPayable({ salesTotal: 48_000_000, purchaseTotal: 30_000_000, valueAddedPct: 15 }), {
    outputTax: 720_000, credit: 150_000, payable: 570_000,
  });
  assert.equal(C.simplifiedVatPayable({ salesTotal: 1_000_000, purchaseTotal: 5_000_000, valueAddedPct: 15 }).payable, 0);
});

test("기준값 표: 간이과세 업종 부가가치율·출처가 비어 있지 않다", () => {
  const rates = Object.fromEntries(C.CALC_BASIS.vat.valueAddedRates.map((r) => [r.key, r.pct]));
  assert.equal(rates.retail_food, 15);
  assert.equal(rates.manufacturing, 20);
  assert.equal(rates.lodging, 25);
  assert.equal(rates.other_service, 30);
  assert.ok(C.CALC_BASIS.minWages.every((m) => m.source.url.startsWith("https://")));
  assert.ok(C.CALC_BASIS.insurance.sources.length >= 1);
  assert.ok(C.CALC_BASIS.vat.source.url.startsWith("https://"));
  assert.equal(C.CALC_BASIS.insurance.pensionPct, 9.5);
  assert.equal(C.CALC_BASIS.insurance.healthPct, 7.19);
  assert.equal(C.CALC_BASIS.insurance.longTermCarePct, 0.9448);
});

test("-0 이 결과에 남지 않는다(화면에 '-0' 방지)", () => {
  // 고정비 0 → 손익분기 수량 +0
  const be = C.breakEven({ price: 10000, variableCost: 4000, fixedCost: 0, operatingDays: 25 });
  assert.ok(Object.is(be.bepQty, 0) && Object.is(be.bepSales, 0) && Object.is(be.dailyQty, 0) && Object.is(be.dailySales, 0));
  // 이익이 -0.4원으로 계산돼도 반올림 결과는 +0
  const d = C.deliverySettlement({
    orderAmount: 10000, brokerRatePct: 1.234, paymentRatePct: 0, feeVatExtra: false,
    deliveryCostBorne: 0, discountBorne: 0, adCost: 0, unitCost: 9877, monthlyOrders: 10,
  });
  assert.ok(Object.is(d.profit, 0), `profit=${Object.is(d.profit, -0) ? "-0" : d.profit}`);
  // 월 이익은 반올림 전 이익(-0.4원) × 10건 = -4원이 정확한 값(건당 표시 0원을 10배한 0이 아님)
  assert.equal(d.monthlyProfit, -4);
});

// ───────────────────────── 메뉴 원가 · 원가 상승 대응 (손계산 기대값) ─────────────────────────

const CAFE_LATTE = {
  ingredients: [
    { purchasePrice: 30000, purchaseQty: 1000, useQty: 18 }, // 원두 30원/g × 18g = 540
    { purchasePrice: 2500, purchaseQty: 1000, useQty: 200 }, // 우유 2.5원/ml × 200ml = 500
  ],
  otherCost: 300, // 컵·빨대
};

test("메뉴 원가: 재료별 원가·재료비·총원가(원두 540 + 우유 500 + 기타 300 = 1,340)", () => {
  const r = C.menuCost(CAFE_LATTE);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ingredientCosts, [540, 500]);
  assert.equal(r.materialCost, 1040);
  assert.equal(r.totalCost, 1340);
  assert.equal(r.netPrice, null); // 판매가를 안 넣으면 원가율·마진은 계산하지 않는다
  assert.equal(r.costRatePct, null);
});

test("메뉴 원가: 판매가 4,500원 → 원가율 29.8%·남는 돈 3,160원·마진 70.2%", () => {
  const r = C.menuCost({ ...CAFE_LATTE, price: 4500 });
  assert.equal(r.costRatePct, 29.8); // 1340/4500
  assert.equal(r.unitProfit, 3160);
  assert.equal(r.marginRatePct, 70.2);
});

test("메뉴 원가: 판매가에 부가세 포함이면 공급가액(4,500÷1.1=4,091) 기준 — 원가율 32.8%·남는 돈 2,751원", () => {
  const r = C.menuCost({ ...CAFE_LATTE, price: 4500, priceIncludesVat: true });
  assert.equal(r.netPrice, 4091);
  assert.equal(r.costRatePct, 32.8);
  assert.equal(r.unitProfit, 2751);
  assert.equal(r.marginRatePct, 67.2);
});

test("메뉴 원가: 목표 원가율 30% 판매가(1340÷0.3=4,466.67 → 4,467, 100원 올림 4,500), 부가세 포함이면 ×1.1(4,913 → 5,000)", () => {
  const a = C.menuCost({ ...CAFE_LATTE, targetCostPct: 30 });
  assert.equal(a.suggestedPrice, 4467);
  assert.equal(a.suggestedPriceCeil100, 4500);
  const b = C.menuCost({ ...CAFE_LATTE, targetCostPct: 30, priceIncludesVat: true });
  assert.equal(b.suggestedPrice, 4913);
  assert.equal(b.suggestedPriceCeil100, 5000);
});

test("메뉴 원가: 정확히 100원 단위로 떨어지는 값은 올리지 않는다(원가 1,350 ÷ 30% = 4,500 → 4,500)", () => {
  const r = C.menuCost({ ingredients: [{ purchasePrice: 1350, purchaseQty: 1, useQty: 1 }], targetCostPct: 30 });
  assert.equal(r.suggestedPrice, 4500);
  assert.equal(r.suggestedPriceCeil100, 4500);
});

test("메뉴 원가: 손실률은 사용량을 늘려 계산(닭 10,000원/1,000g, 200g 사용, 손실 20% → 2,500원)", () => {
  const r = C.menuCost({ ingredients: [{ purchasePrice: 10000, purchaseQty: 1000, useQty: 200, lossPct: 20 }] });
  assert.equal(r.ingredientCosts[0], 2500);
});

test("메뉴 원가: 잘못된 입력은 계산하지 않고 사유를 돌려준다(구매 수량 0·손실 100%·재료 없음·목표 범위·판매가 0)", () => {
  assert.deepEqual(C.menuCost({ ingredients: [] }), { ok: false, reason: "no_ingredients" });
  const bad = C.menuCost({ ingredients: [CAFE_LATTE.ingredients[0], { purchasePrice: 100, purchaseQty: 0, useQty: 1 }] });
  assert.deepEqual(bad, { ok: false, reason: "ingredient_invalid", index: 1 });
  assert.equal(C.menuCost({ ingredients: [{ purchasePrice: 100, purchaseQty: 1, useQty: 1, lossPct: 100 }] }).reason, "ingredient_invalid");
  assert.equal(C.menuCost({ ...CAFE_LATTE, targetCostPct: 0 }).reason, "target_out_of_range");
  assert.equal(C.menuCost({ ...CAFE_LATTE, targetCostPct: 101 }).reason, "target_out_of_range");
  assert.equal(C.menuCost({ ...CAFE_LATTE, price: 0 }).reason, "price_not_positive");
  assert.equal(C.menuCost({ ...CAFE_LATTE, otherCost: -1 }).reason, "other_negative");
});

test("원가 상승 대응: 4,500원 메뉴, 오르는 재료비 1,000원 + 그 밖 340원, 20% 상승 → 원가 +200원", () => {
  const r = C.priceIncrease({ price: 4500, risingCost: 1000, otherCost: 340, risePct: 20, monthlyQty: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.extraCost, 200);
  assert.equal(r.costBefore, 1340);
  assert.equal(r.costAfter, 1540);
  // 가격을 안 올리면
  assert.equal(r.marginBefore, 3160);
  assert.equal(r.marginAfter, 2960);
  assert.equal(r.marginDropPct, 6.3); // 200/3160
  assert.equal(r.costRateBeforePct, 29.8);
  assert.equal(r.costRateAfterPct, 34.2); // 1540/4500
  assert.equal(r.monthlyProfitChange, -200000);
  // 올린다면
  assert.equal(r.priceKeepMargin, 4700); // 남는 돈 유지: 4500 + 200
  assert.equal(r.priceKeepMarginCeil100, 4700);
  assert.equal(r.raiseKeepMarginPct, 4.4); // 200/4500
  assert.equal(r.priceKeepRate, 5172); // 원가율 유지: 4500 × 1540/1340 = 5171.64
  assert.equal(r.priceKeepRateCeil100, 5200);
  assert.equal(r.raiseKeepRatePct, 14.9); // 1540/1340 − 1
});

test("원가 상승 대응: 한 달 판매 개수를 비우면 월 변화는 계산하지 않는다(0으로 지어내지 않음)", () => {
  const r = C.priceIncrease({ price: 4500, risingCost: 1000, risePct: 20 });
  assert.equal(r.monthlyProfitChange, null);
});

test("원가 상승 대응: 지금도 원가가 판매가 이상이면 감소율을 만들지 않고 손해 표시(lossBefore)", () => {
  const r = C.priceIncrease({ price: 1000, risingCost: 900, otherCost: 300, risePct: 10 });
  assert.equal(r.lossBefore, true);
  assert.equal(r.marginBefore, -200);
  assert.equal(r.marginDropPct, null);
});

test("원가 상승 대응: 오르는 재료비가 0이면 가격은 그대로(원가 상승 0)", () => {
  const r = C.priceIncrease({ price: 5000, risingCost: 0, otherCost: 500, risePct: 50 });
  assert.equal(r.extraCost, 0);
  assert.equal(r.priceKeepMargin, 5000);
  assert.equal(r.priceKeepRate, 5000);
});

test("원가 상승 대응: 잘못된 입력(판매가 0·원가 0·음수·상승률 −100% 이하·1000% 초과)은 계산하지 않는다", () => {
  assert.equal(C.priceIncrease({ price: 0, risingCost: 100, risePct: 10 }).reason, "price_not_positive");
  assert.equal(C.priceIncrease({ price: 1000, risingCost: 0, otherCost: 0, risePct: 10 }).reason, "cost_not_positive");
  assert.equal(C.priceIncrease({ price: 1000, risingCost: -1, risePct: 10 }).reason, "negative_input");
  assert.equal(C.priceIncrease({ price: 1000, risingCost: 100, risePct: -100 }).reason, "rise_out_of_range");
  assert.equal(C.priceIncrease({ price: 1000, risingCost: 100, risePct: 1001 }).reason, "rise_out_of_range");
  assert.equal(C.priceIncrease({ price: 1000, risingCost: 100, risePct: Number.NaN }).reason, "rise_out_of_range");
});

test("원가 상승 대응: 재료비가 내려가는 경우(−10%)도 같은 식 — 원가 −100원이면 판매가를 100원 내려도 남는 돈 동일", () => {
  const r = C.priceIncrease({ price: 4500, risingCost: 1000, otherCost: 340, risePct: -10 });
  assert.equal(r.extraCost, -100);
  assert.equal(r.priceKeepMargin, 4400);
  assert.equal(r.marginAfter, 3260);
});

// ───────── 매출·이익 목표 (손계산 기대값) ─────────
test("매출 목표: 4,500원·원가 1,340원·100개 → 매출 450,000 · 원가 134,000 · 남는 돈 316,000 (고정비 0)", () => {
  const r = C.salesTarget({ price: 4500, unitCost: 1340, qty: 100 });
  assert.equal(r.ok, true);
  assert.equal(r.unitProfit, 3160);
  assert.deepEqual(r.atQty, { qty: 100, sales: 450000, costTotal: 134000, feeTotal: 0, remain: 316000, fixed: 0, netProfit: 316000 });
  assert.equal(r.marginRatePct, 70.2); // 3160/4500 = 70.22%
});

test("매출 목표: 수수료 3% · 고정비 100만원이면 순이익이 음수(손해)로 나온다", () => {
  const r = C.salesTarget({ price: 4500, unitCost: 1340, feePct: 3, fixedCost: 1000000, qty: 100 });
  assert.equal(r.unitFee, 135); // 4500 × 3%
  assert.equal(r.unitProfit, 3025);
  assert.equal(r.atQty.feeTotal, 13500);
  assert.equal(r.atQty.remain, 302500); // 450000 − 134000 − 13500
  assert.equal(r.atQty.netProfit, -697500); // 302500 − 1,000,000
});

test("목표 판매량: 고정비 200만 + 목표 순이익 100만 → 949.4개 → 950개(올림), 매출 4,275,000, 하루 26일 기준 37개", () => {
  const r = C.salesTarget({ price: 4500, unitCost: 1340, fixedCost: 2000000, targetProfit: 1000000, operatingDays: 26 });
  assert.equal(r.forTarget.qty, 950);
  assert.equal(r.forTarget.sales, 4275000);
  assert.equal(r.forTarget.dailyQty, 37); // 950/26 = 36.5
  // 949개에서는 목표 미달, 950개에서는 달성(올림이 맞는지 직접 확인)
  assert.equal(C.salesTarget({ price: 4500, unitCost: 1340, fixedCost: 2000000, qty: 949 }).atQty.netProfit, 998840);
  assert.equal(C.salesTarget({ price: 4500, unitCost: 1340, fixedCost: 2000000, qty: 950 }).atQty.netProfit, 1002000);
});

test("목표 판매량: 목표 0원이면 손익분기 판매량(고정비 ÷ 1개당 이익 올림)과 같다", () => {
  const r = C.salesTarget({ price: 4500, unitCost: 1340, fixedCost: 2000000, targetProfit: 0 });
  assert.equal(r.forTarget.qty, 633); // 2,000,000/3,160 = 632.9
  assert.equal(C.breakEven({ price: 4500, variableCost: 1340, fixedCost: 2000000 }).bepQty, 633);
});

test("목표 판매량: 1개당 이익이 0 이하면 채울 수 없음 표시(개수를 만들지 않는다)", () => {
  const r = C.salesTarget({ price: 1000, unitCost: 1000, targetProfit: 100000 });
  assert.equal(r.targetUnreachable, true);
  assert.equal(r.forTarget, null);
  const loss = C.salesTarget({ price: 1000, unitCost: 1200, qty: 10, fixedCost: 0 });
  assert.equal(loss.atQty.netProfit, -2000); // 팔수록 손해
});

test("매출 목표: 입력이 없으면 해당 계산은 null, 잘못된 입력은 계산하지 않는다", () => {
  const r = C.salesTarget({ price: 4500, unitCost: 1340 });
  assert.equal(r.atQty, null);
  assert.equal(r.forTarget, null);
  assert.equal(C.salesTarget({ price: 0, unitCost: 1 }).reason, "price_not_positive");
  assert.equal(C.salesTarget({ price: 1000, unitCost: -1 }).reason, "cost_negative");
  assert.equal(C.salesTarget({ price: 1000, unitCost: 1, feePct: 100 }).reason, "fee_out_of_range");
  assert.equal(C.salesTarget({ price: 1000, unitCost: 1, feePct: -1 }).reason, "fee_out_of_range");
  assert.equal(C.salesTarget({ price: 1000, unitCost: 1, fixedCost: -5 }).reason, "fixed_negative");
  assert.equal(C.salesTarget({ price: 1000, unitCost: 1, qty: -1 }).reason, "qty_invalid");
  assert.equal(C.salesTarget({ price: 1000, unitCost: 1, targetProfit: -1 }).reason, "target_negative");
});
