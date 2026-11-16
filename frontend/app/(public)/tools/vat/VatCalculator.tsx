"use client";

import { useState } from "react";
import { CALC_BASIS, addVat, generalVatPayable, parseNum, simplifiedVatPayable, splitVat } from "@/lib/calc";
import { fmtWon } from "../_components/format";
import { EmptyState, NumberField, ResetButton, ResultCard, Warn } from "../_components/NumberField";
import { useCalcUsage } from "../_components/useCalcUsage";

type Mode = "split" | "general" | "simplified";

const MODES: { id: Mode; label: string }[] = [
  { id: "split", label: "공급가액 · 부가세 나누기" },
  { id: "general", label: "일반과세 납부세액" },
  { id: "simplified", label: "간이과세 납부세액" },
];

export default function VatCalculator() {
  const [mode, setMode] = useState<Mode>("split");

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="계산 종류" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            id={`vat-tab-${m.id}`}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            aria-controls="vat-panel"
            onClick={() => setMode(m.id)}
            className={`min-h-[44px] rounded-lg border px-4 text-sm font-medium ${
              mode === m.id ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div id="vat-panel" role="tabpanel" aria-labelledby={`vat-tab-${mode}`} className="space-y-5">
        {mode === "split" ? <SplitPanel /> : null}
        {mode === "general" ? <GeneralPanel /> : null}
        {mode === "simplified" ? <SimplifiedPanel /> : null}
      </div>
    </div>
  );
}

function SplitPanel() {
  const [kind, setKind] = useState<"total" | "supply">("total");
  const [amount, setAmount] = useState("");
  const n = parseNum(amount);
  // 항상 {공급가액, 세액, 합계}로 맞춘다(입력이 합계인지 공급가액인지에 따라 한쪽에서 나머지를 계산)
  const result =
    n === null
      ? null
      : kind === "total"
        ? { ...splitVat(n), total: Math.round(n) }
        : { supply: Math.round(n), ...addVat(n) };
  const total = result ? result.total : 0;
  useCalcUsage("vat-split", result !== null);

  return (
    <>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <fieldset>
          <legend className="text-sm font-medium text-gray-800">입력하는 금액</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {[
              { id: "total" as const, label: "부가세 포함 금액" },
              { id: "supply" as const, label: "부가세 뺀 금액(공급가액)" },
            ].map((o) => (
              <label key={o.id} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800">
                <input type="radio" name="vat-kind" checked={kind === o.id} onChange={() => setKind(o.id)} className="h-4 w-4 text-blue-600" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <NumberField id="vat-amount" label="금액" unit="원" value={amount} onChange={setAmount} />
        <ResetButton onClick={() => { setAmount(""); setKind("total"); }} />
      </div>
      {result === null ? (
        <EmptyState>금액을 입력하면 공급가액과 부가세가 나뉘어 나와요.</EmptyState>
      ) : (
        <ResultCard
          title="공급가액과 부가세"
          rows={[
            { label: "공급가액 (부가세 뺀 금액)", value: fmtWon(result.supply), strong: true },
            { label: `부가세 (${CALC_BASIS.vat.generalRatePct}%)`, value: fmtWon(result.tax) },
            { label: "합계 (부가세 포함)", value: fmtWon(total) },
          ]}
          footnote="부가세 포함 금액을 나눌 때는 1.1로 나누고 원 단위로 반올림해요. 세금계산서와 1원 차이가 날 수 있어요."
        />
      )}
    </>
  );
}

function GeneralPanel() {
  const [sales, setSales] = useState("");
  const [purchase, setPurchase] = useState("");
  const s = parseNum(sales);
  const p = parseNum(purchase);
  const r = s !== null ? generalVatPayable({ salesSupply: s, purchaseSupply: p ?? 0 }) : null;
  useCalcUsage("vat-general", r !== null);

  return (
    <>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <NumberField id="vg-sales" label="매출 (부가세 뺀 공급가액)" unit="원" value={sales} onChange={setSales} hint="신고 기간(6개월 또는 1년) 동안의 매출 합계로 입력해 주세요." />
        <NumberField id="vg-purchase" label="매입 (부가세 뺀 공급가액)" unit="원" value={purchase} onChange={setPurchase} optional hint="세금계산서·카드 등 공제받을 수 있는 매입만 넣어 주세요. 비우면 0원이에요." />
        <ResetButton onClick={() => { setSales(""); setPurchase(""); }} />
      </div>
      {r === null ? (
        <EmptyState>매출을 입력하면 일반과세자의 부가세 납부세액을 계산해요.</EmptyState>
      ) : (
        <ResultCard
          title="일반과세 부가세 (추정)"
          rows={[
            { label: "매출세액", value: fmtWon(r.salesTax) },
            { label: "매입세액", value: fmtWon(r.purchaseTax) },
            r.payable >= 0
              ? { label: "납부할 세액 (추정)", value: fmtWon(r.payable), strong: true }
              : { label: "환급받을 세액 (추정)", value: fmtWon(-r.payable), strong: true },
          ]}
          footnote="신용카드 발행세액공제, 공제받지 못하는 매입, 예정고지 납부분 등은 반영하지 않았어요."
        />
      )}
    </>
  );
}

function SimplifiedPanel() {
  const rates = CALC_BASIS.vat.valueAddedRates;
  const [sales, setSales] = useState("");
  const [purchase, setPurchase] = useState("");
  const [key, setKey] = useState(rates[0].key);
  const rate = rates.find((x) => x.key === key) ?? rates[0];
  const s = parseNum(sales);
  const p = parseNum(purchase);
  const r = s !== null ? simplifiedVatPayable({ salesTotal: s, purchaseTotal: p ?? 0, valueAddedPct: rate.pct }) : null;
  useCalcUsage("vat-simplified", r !== null);

  return (
    <>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <div>
          <label htmlFor="vs-type" className="block text-sm font-medium text-gray-800">
            업종
          </label>
          <select
            id="vs-type"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-1 min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {rates.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label} (부가가치율 {x.pct}%)
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm leading-relaxed text-gray-600 break-keep">여러 업종을 함께 하거나 해당 업종이 없으면 홈택스·세무서에서 확인해 주세요.</p>
        </div>
        <NumberField id="vs-sales" label="매출 (부가세 포함 공급대가)" unit="원" value={sales} onChange={setSales} hint="간이과세자는 부가세가 포함된 금액 기준이에요. 신고하려는 기간의 매출 합계를 입력해 주세요(간이과세자는 보통 1년 단위로 신고해요)." />
        <NumberField id="vs-purchase" label="매입 (부가세 포함 공급대가)" unit="원" value={purchase} onChange={setPurchase} optional hint="세금계산서·신용카드 등으로 증빙받은 매입만 넣어 주세요. 비우면 0원이에요." />
        <ResetButton onClick={() => { setSales(""); setPurchase(""); setKey(rates[0].key); }} />
      </div>
      {r === null ? (
        <EmptyState>매출을 입력하면 간이과세자의 부가세 납부세액을 추정해요.</EmptyState>
      ) : (
        <>
          <ResultCard
            title="간이과세 부가세 (추정)"
            rows={[
              { label: `매출세액 (매출 × ${rate.pct}% × 10%)`, value: fmtWon(r.outputTax) },
              { label: `매입세액공제 (매입 × ${CALC_BASIS.vat.purchaseCreditPct}%)`, value: fmtWon(r.credit) },
              { label: "납부할 세액 (추정)", value: fmtWon(r.payable), strong: true },
            ]}
            footnote="간이과세는 환급이 없어서 계산 결과가 0원보다 작으면 0원으로 보여 드려요. 신용카드 발행세액공제와 납부의무 면제 여부, 예정부과 납부분은 반영하지 않았어요."
          />
          <Warn>간이과세는 직전 연도 공급대가가 일정 금액(1억 400만원) 미만인 사업자가 대상이고, 업종·지역에 따라 제외돼요. 연 공급대가가 작으면 납부의무가 면제될 수도 있으니 국세청에서 확인해 주세요.</Warn>
        </>
      )}
    </>
  );
}
