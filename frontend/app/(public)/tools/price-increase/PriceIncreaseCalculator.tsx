"use client";

import { useState } from "react";
import { parseNum, priceIncrease } from "@/lib/calc";
import { fmtPct, fmtWon } from "../_components/format";
import { EmptyState, NumberField, ResetButton, ResultCard, Warn } from "../_components/NumberField";
import { useCalcUsage } from "../_components/useCalcUsage";

export default function PriceIncreaseCalculator() {
  const [price, setPrice] = useState("");
  const [rising, setRising] = useState("");
  const [other, setOther] = useState("");
  const [rise, setRise] = useState("");
  const [qty, setQty] = useState("");

  const pr = parseNum(price);
  const ri = parseNum(rising);
  const rs = parseNum(rise);
  const ready = pr !== null && ri !== null && rs !== null;
  const r = ready
    ? priceIncrease({ price: pr, risingCost: ri, otherCost: parseNum(other) ?? 0, risePct: rs, monthlyQty: parseNum(qty) })
    : null;
  useCalcUsage("price-increase", r?.ok === true);

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <NumberField
          id="pi-price"
          label="지금 판매가 (1개당)"
          unit="원"
          value={price}
          onChange={setPrice}
          hint="아래 원가와 같은 기준(둘 다 부가세 포함이거나 둘 다 제외)으로 넣어 주세요."
        />
        <NumberField
          id="pi-rising"
          label="값이 오르는 재료비 (1개당)"
          unit="원"
          value={rising}
          onChange={setRising}
          hint="오르는 재료가 1개 만드는 데 드는 금액의 합계예요."
        />
        <NumberField
          id="pi-other"
          label="오르지 않는 원가 (1개당)"
          unit="원"
          value={other}
          onChange={setOther}
          optional
          hint="포장·소스·값이 그대로인 재료 등. 비우면 0원으로 계산해요."
        />
        <NumberField
          id="pi-rise"
          label="재료비가 오른 비율"
          unit="%"
          decimal
          value={rise}
          onChange={setRise}
          hint="예: 20% 올랐으면 20을 넣어요."
        />
        <NumberField
          id="pi-qty"
          label="한 달 판매 개수"
          unit="개"
          value={qty}
          onChange={setQty}
          optional
          hint="넣으면 가격을 안 올릴 때 한 달 이익이 얼마나 줄어드는지도 보여 드려요."
        />
        <ResetButton
          onClick={() => {
            setPrice("");
            setRising("");
            setOther("");
            setRise("");
            setQty("");
          }}
        />
      </div>

      <div className="space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        {r === null ? (
          <EmptyState>
            지금 판매가, 값이 오르는 재료비, 오른 비율을 넣으면 가격을 올리지 않을 때 남는 돈이 얼마나 줄고, 가격을 얼마로 올려야 하는지 계산해요.
          </EmptyState>
        ) : !r.ok ? (
          <Warn>
            {r.reason === "price_not_positive" && "판매가는 0원보다 커야 계산할 수 있어요."}
            {r.reason === "cost_not_positive" && "원가(오르는 재료비와 오르지 않는 원가)의 합이 0원보다 커야 해요."}
            {r.reason === "negative_input" && "음수는 입력할 수 없어요. 0 이상의 값으로 입력해 주세요."}
            {r.reason === "rise_out_of_range" && "오른 비율은 0% 이상 1,000% 이하로 입력해 주세요."}
          </Warn>
        ) : (
          <>
            {r.lossBefore ? (
              <Warn>지금도 원가가 판매가 이상이라 팔수록 손해가 나는 상태예요. 아래 숫자는 참고만 하고 원가·판매가를 다시 확인해 보세요.</Warn>
            ) : null}
            <ResultCard
              title="가격을 그대로 두면"
              rows={[
                { label: "1개당 원가", value: `${fmtWon(r.costBefore)} → ${fmtWon(r.costAfter)}`, note: `+${fmtWon(r.extraCost)}` },
                {
                  label: "1개당 남는 돈",
                  value: `${fmtWon(r.marginBefore)} → ${fmtWon(r.marginAfter)}`,
                  strong: true,
                  note: r.marginDropPct !== null ? `${fmtPct(r.marginDropPct)} 줄어요` : undefined,
                },
                { label: "원가율", value: `${fmtPct(r.costRateBeforePct)} → ${fmtPct(r.costRateAfterPct)}` },
                ...(r.monthlyProfitChange !== null ? [{ label: "한 달 이익 변화", value: fmtWon(r.monthlyProfitChange) }] : []),
              ]}
            />
            <ResultCard
              title="가격을 올린다면"
              rows={[
                {
                  label: "남는 돈(원)을 지키려면",
                  value: fmtWon(r.priceKeepMargin),
                  strong: true,
                  note: `${fmtPct(r.raiseKeepMarginPct)} 인상 · 100원 단위로 올리면 ${fmtWon(r.priceKeepMarginCeil100)}`,
                },
                {
                  label: "원가율(%)을 지키려면",
                  value: fmtWon(r.priceKeepRate),
                  strong: true,
                  note: `${fmtPct(r.raiseKeepRatePct)} 인상 · 100원 단위로 올리면 ${fmtWon(r.priceKeepRateCeil100)}`,
                },
              ]}
              footnote="앞의 값은 늘어난 원가만큼만 올려 남는 돈을 그대로 두는 가격, 뒤의 값은 원가가 오른 비율만큼 올려 원가율을 그대로 두는 가격이에요. 가격을 올리면 손님이 줄 수 있는데, 판매량 변화와 경쟁 가게 가격은 반영하지 않았어요."
            />
          </>
        )}
      </div>
    </div>
  );
}
