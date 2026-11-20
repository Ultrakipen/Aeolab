"use client";

import { useState } from "react";
import { parseNum, salesTarget } from "@/lib/calc";
import { fmtInt, fmtPct, fmtWon } from "../_components/format";
import { EmptyState, NumberField, ResetButton, ResultCard, Warn } from "../_components/NumberField";
import { useCalcUsage } from "../_components/useCalcUsage";

export default function SalesTargetCalculator() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [fee, setFee] = useState("");
  const [fixed, setFixed] = useState("");
  const [qty, setQty] = useState("");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("");

  const p = parseNum(price);
  const c = parseNum(cost);
  const ready = p !== null && c !== null;
  const r = ready
    ? salesTarget({
        price: p,
        unitCost: c,
        feePct: parseNum(fee),
        fixedCost: parseNum(fixed),
        qty: parseNum(qty),
        targetProfit: parseNum(target),
        operatingDays: parseNum(days),
      })
    : null;
  useCalcUsage("sales-target", r?.ok === true && (r.atQty !== null || r.forTarget !== null));

  const label = name.trim() || "이 상품";
  const hasFixed = (parseNum(fixed) ?? 0) > 0;

  const reset = () => {
    setName("");
    setPrice("");
    setCost("");
    setFee("");
    setFixed("");
    setQty("");
    setTarget("");
    setDays("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <div>
          <label htmlFor="st-name" className="block text-sm font-medium text-gray-800">
            상품 이름 <span className="ml-1 font-normal text-gray-600">(선택)</span>
          </label>
          <input
            id="st-name"
            type="text"
            value={name}
            maxLength={30}
            autoComplete="off"
            placeholder="예: 아메리카노"
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--tool-accent,#3b82f6)]"
          />
        </div>
        <NumberField id="st-price" label="판매가 (1개당)" unit="원" value={price} onChange={setPrice} hint="원가와 같은 기준(둘 다 부가세 포함이거나 둘 다 제외)으로 넣어 주세요." />
        <NumberField id="st-cost" label="원가 (1개당)" unit="원" value={cost} onChange={setCost} hint="재료비·포장비처럼 팔 때마다 드는 비용이에요. 메뉴 원가 계산기로 먼저 구할 수 있어요." />
        <NumberField id="st-fee" label="판매 수수료율" unit="%" decimal optional value={fee} onChange={setFee} hint="카드·배달앱처럼 판매가에 비례해 떼는 비율. 비우면 0%로 계산해요." />
        <NumberField id="st-fixed" label="한 달 고정비" unit="원" optional value={fixed} onChange={setFixed} hint="임대료·인건비·관리비 등 팔지 않아도 나가는 비용. 넣으면 순이익까지 계산해요." />

        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-3 md:p-4">
          <p className="text-sm font-semibold text-gray-800">궁금한 것을 골라 넣어 보세요 (둘 다 넣어도 돼요)</p>
          <NumberField id="st-qty" label="한 달에 몇 개 팔면?" unit="개" optional value={qty} onChange={setQty} hint="넣으면 매출과 남는 돈, 순이익을 보여 드려요." />
          <NumberField id="st-target" label="한 달 목표 순이익" unit="원" optional value={target} onChange={setTarget} hint="넣으면 그 이익을 내려면 몇 개를 팔아야 하는지 알려 드려요." />
          <NumberField id="st-days" label="한 달 영업일수" unit="일" optional value={days} onChange={setDays} hint="목표 판매 개수를 하루 기준으로도 보고 싶을 때 넣어요." />
        </div>
        <ResetButton onClick={reset} />
      </div>

      <div className="space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        {r === null ? (
          <EmptyState>판매가와 원가를 넣고, 아래에서 판매 개수나 목표 이익을 넣으면 결과가 나와요.</EmptyState>
        ) : !r.ok ? (
          <Warn>
            {r.reason === "price_not_positive" && "판매가는 0원보다 커야 계산할 수 있어요."}
            {r.reason === "cost_negative" && "원가는 0원 이상으로 입력해 주세요."}
            {r.reason === "fee_out_of_range" && "수수료율은 0% 이상 100% 미만으로 입력해 주세요."}
            {r.reason === "fixed_negative" && "고정비는 0원 이상으로 입력해 주세요."}
            {r.reason === "qty_invalid" && "판매 개수는 0 이상으로 입력해 주세요."}
            {r.reason === "target_negative" && "목표 순이익은 0원 이상으로 입력해 주세요."}
          </Warn>
        ) : (
          <>
            {r.unitProfit <= 0 ? (
              <Warn>1개를 팔 때마다 {fmtWon(Math.abs(Math.round(r.unitProfit)))} 손해가 나는(또는 남는 돈이 없는) 값이에요. 판매가·원가·수수료율을 다시 확인해 보세요.</Warn>
            ) : null}
            <ResultCard
              title={`${label} 1개를 팔면`}
              rows={[
                ...(r.unitFee > 0 ? [{ label: "수수료", value: fmtWon(Math.round(r.unitFee)) }] : []),
                { label: "1개당 이익", value: fmtWon(Math.round(r.unitProfit)), strong: true },
                { label: "마진율 (이익 ÷ 판매가)", value: fmtPct(r.marginRatePct) },
              ]}
              footnote="원가와 수수료를 뺀 금액이에요. 고정비는 판매 개수를 넣으면 반영돼요."
            />
            {r.atQty ? (
              <ResultCard
                title={`${label} ${fmtInt(r.atQty.qty)}개를 팔면`}
                rows={[
                  { label: "매출", value: fmtWon(r.atQty.sales) },
                  { label: "원가 합계", value: fmtWon(r.atQty.costTotal) },
                  ...(r.atQty.feeTotal > 0 ? [{ label: "수수료 합계", value: fmtWon(r.atQty.feeTotal) }] : []),
                  { label: hasFixed ? "원가·수수료를 뺀 이익" : "순이익 (원가·수수료 제외)", value: fmtWon(r.atQty.remain), strong: !hasFixed },
                  ...(hasFixed
                    ? [
                        { label: "한 달 고정비", value: fmtWon(r.atQty.fixed) },
                        { label: "순이익 (고정비까지 뺀 금액)", value: fmtWon(r.atQty.netProfit), strong: true },
                      ]
                    : []),
                ]}
                footnote={
                  hasFixed
                    ? r.atQty.netProfit < 0
                      ? "고정비를 다 갚지 못하는 판매량이에요(손해). 세금은 반영하지 않았어요."
                      : "세금(부가세·소득세)과 사장님 인건비는 반영하지 않았어요. 고정비에 넣었는지 확인해 보세요."
                    : "고정비는 넣지 않았어요. 고정비를 넣으면 실제로 손에 남는 순이익을 계산해요. 세금은 반영하지 않았어요."
                }
              />
            ) : null}
            {r.targetUnreachable ? (
              <Warn>1개당 이익이 0원 이하라 아무리 팔아도 목표 이익을 채울 수 없어요. 판매가를 올리거나 원가·수수료를 낮춰야 해요.</Warn>
            ) : r.forTarget ? (
              <ResultCard
                title={`한 달 순이익 ${fmtWon(r.forTarget.targetProfit)}을 내려면`}
                rows={[
                  { label: "팔아야 하는 개수", value: `${fmtInt(r.forTarget.qty)}개`, strong: true },
                  { label: "그때 한 달 매출", value: fmtWon(r.forTarget.sales) },
                  ...(r.forTarget.dailyQty !== null && r.forTarget.dailySales !== null
                    ? [
                        { label: "하루 판매 개수", value: `${fmtInt(r.forTarget.dailyQty)}개` },
                        { label: "하루 매출", value: fmtWon(r.forTarget.dailySales) },
                      ]
                    : []),
                ]}
                footnote="목표를 넘기도록 올림한 개수예요. 하루 판매 개수는 올림해서, 하루 매출(올림 전 값)과 조금 다르게 보일 수 있어요. 판매량이 늘 때 손님 수·가격 변화는 반영하지 않았어요."
              />
            ) : null}
            {r.atQty === null && r.forTarget === null && !r.targetUnreachable ? (
              <EmptyState>한 달에 몇 개를 팔지(또는 목표 순이익)를 넣으면 순이익과 필요한 판매 개수를 계산해 드려요.</EmptyState>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
