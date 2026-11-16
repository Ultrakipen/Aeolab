"use client";

import { useState } from "react";
import { breakEven, parseNum } from "@/lib/calc";
import { fmtInt, fmtPct, fmtWon } from "../_components/format";
import { EmptyState, NumberField, ResetButton, ResultCard, Warn } from "../_components/NumberField";
import { useCalcUsage } from "../_components/useCalcUsage";

export default function BreakEvenCalculator() {
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [fixed, setFixed] = useState("");
  const [days, setDays] = useState("");

  const p = parseNum(price);
  const c = parseNum(cost);
  const f = parseNum(fixed);
  const d = parseNum(days);
  const ready = p !== null && c !== null;
  const r = ready ? breakEven({ price: p, variableCost: c, fixedCost: f ?? 0, operatingDays: d }) : null;
  useCalcUsage("break-even", r?.ok === true);

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <NumberField id="be-price" label="판매가 (1개당)" unit="원" value={price} onChange={setPrice} hint="부가세를 뺀 가격으로 입력하면 세금 전 기준으로 계산돼요." />
        <NumberField id="be-cost" label="원가 (1개당 재료비 등 변동비)" unit="원" value={cost} onChange={setCost} hint="팔 때마다 따라 늘어나는 비용만 넣어 주세요(재료비·포장비·수수료 등)." />
        <NumberField id="be-fixed" label="한 달 고정비" unit="원" value={fixed} onChange={setFixed} optional hint="팔지 않아도 나가는 비용(임대료·인건비·관리비 등). 비워 두면 0원으로 계산해요." />
        <NumberField id="be-days" label="한 달 영업일수" unit="일" value={days} onChange={setDays} optional hint="입력하면 하루 기준 목표도 보여 드려요." />
        <ResetButton onClick={() => { setPrice(""); setCost(""); setFixed(""); setDays(""); }} />
      </div>

      {r === null ? (
        <EmptyState>판매가와 원가를 입력하면 마진율과 손익분기점이 나와요.</EmptyState>
      ) : !r.ok ? (
        <Warn>
          {r.reason === "price_not_positive" && "판매가는 0원보다 커야 계산할 수 있어요."}
          {r.reason === "cost_negative" && "원가는 0원 이상으로 입력해 주세요."}
          {r.reason === "fixed_negative" && "고정비는 0원 이상으로 입력해 주세요."}
          {r.reason === "no_margin" && "판매가가 원가보다 높아야 이익이 남아요. 지금 값으로는 팔수록 이익이 나지 않아 손익분기점이 없습니다."}
        </Warn>
      ) : (
        <>
          <ResultCard
            title="1개 팔 때 남는 돈"
            rows={[
              { label: "1개당 이익", value: fmtWon(r.unitProfit), strong: true },
              { label: "마진율 (이익 ÷ 판매가)", value: fmtPct(r.marginRatePct) },
              ...(r.markupPct !== null ? [{ label: "마크업 (이익 ÷ 원가)", value: fmtPct(r.markupPct) }] : []),
            ]}
            footnote="마진율은 판매가를 기준으로, 마크업은 원가를 기준으로 계산해서 같은 가격이라도 숫자가 달라요."
          />
          <ResultCard
            title="손익분기점 (이익이 0원이 되는 판매량)"
            rows={[
              { label: "한 달 판매 개수", value: `${fmtInt(r.bepQty)}개`, strong: true },
              { label: "한 달 매출", value: fmtWon(r.bepSales) },
              ...(r.dailyQty !== null && r.dailySales !== null
                ? [
                    { label: "하루 판매 개수", value: `${fmtInt(r.dailyQty)}개` },
                    { label: "하루 매출", value: fmtWon(r.dailySales) },
                  ]
                : []),
            ]}
            footnote="이 판매량을 넘겨야 이익이 생겨요. 세금·대출 이자·사장님 인건비를 고정비에 넣었는지도 확인해 보세요."
          />
        </>
      )}
    </div>
  );
}
