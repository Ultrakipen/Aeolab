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
