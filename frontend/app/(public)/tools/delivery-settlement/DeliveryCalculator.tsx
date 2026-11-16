"use client";

import { useState } from "react";
import { deliverySettlement, parseNum } from "@/lib/calc";
import { fmtPct, fmtWon } from "../_components/format";
import { CheckField, EmptyState, NumberField, ResetButton, ResultCard, Warn } from "../_components/NumberField";
import { useCalcUsage } from "../_components/useCalcUsage";

export default function DeliveryCalculator() {
  const [amount, setAmount] = useState("");
  const [broker, setBroker] = useState("");
  const [payment, setPayment] = useState("");
  const [vatExtra, setVatExtra] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState("");
  const [discount, setDiscount] = useState("");
  const [ad, setAd] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [orders, setOrders] = useState("");

  const a = parseNum(amount);
  const b = parseNum(broker);
  const pay = parseNum(payment);
  // 주문금액·수수료율은 반드시 입력해야 계산한다(수수료율 0%와 입력 안 함을 구분). 나머지 비용은 비우면 0원.
  const ready = a !== null && b !== null && pay !== null;
  const r = ready
    ? deliverySettlement({
        orderAmount: a,
        brokerRatePct: b,
        paymentRatePct: pay,
        feeVatExtra: vatExtra,
        deliveryCostBorne: parseNum(deliveryCost) ?? 0,
        discountBorne: parseNum(discount) ?? 0,
        adCost: parseNum(ad) ?? 0,
        unitCost: parseNum(unitCost) ?? 0,
        monthlyOrders: parseNum(orders),
      })
    : null;
  useCalcUsage("delivery-settlement", r?.ok === true);

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <NumberField id="dl-amount" label="주문금액 (1건)" unit="원" value={amount} onChange={setAmount} />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="dl-broker" label="중개수수료율" unit="%" decimal value={broker} onChange={setBroker} hint="배달앱 정산서에 적힌 값을 입력해 주세요." />
          <NumberField id="dl-pay" label="결제수수료율" unit="%" decimal value={payment} onChange={setPayment} hint="없으면 0을 입력하세요." />
        </div>
        <CheckField
          id="dl-vat"
          label="수수료에 부가세 10%가 따로 붙어요"
          checked={vatExtra}
          onChange={setVatExtra}
          hint="정산서에서 수수료 옆에 부가세가 별도 줄로 있으면 체크하세요."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="dl-delivery" label="사장님이 내는 배달비" unit="원" value={deliveryCost} onChange={setDeliveryCost} optional />
          <NumberField id="dl-discount" label="사장님이 부담하는 할인·쿠폰" unit="원" value={discount} onChange={setDiscount} optional />
          <NumberField id="dl-ad" label="광고비 (주문 1건당)" unit="원" value={ad} onChange={setAd} optional />
          <NumberField id="dl-cost" label="이 주문의 원가" unit="원" value={unitCost} onChange={setUnitCost} optional />
        </div>
        <NumberField id="dl-orders" label="한 달 주문 건수" unit="건" value={orders} onChange={setOrders} optional hint="입력하면 한 달 이익도 보여 드려요. 비운 항목은 0원으로 계산해요." />
        <ResetButton
          onClick={() => {
            setAmount(""); setBroker(""); setPayment(""); setVatExtra(false);
            setDeliveryCost(""); setDiscount(""); setAd(""); setUnitCost(""); setOrders("");
          }}
        />
      </div>

      {r === null ? (
        <EmptyState>주문금액과 수수료율(중개·결제)을 입력하면 실제로 받는 금액이 나와요. 수수료율은 배달앱 정산서의 값을 그대로 넣어 주세요.</EmptyState>
      ) : !r.ok ? (
        <Warn>
          {r.reason === "amount_not_positive" && "주문금액은 0원보다 커야 계산할 수 있어요."}
          {r.reason === "negative_input" && "음수는 입력할 수 없어요. 0 이상의 값으로 입력해 주세요."}
          {r.reason === "rate_out_of_range" && "수수료율은 0~100% 사이로, 중개와 결제 수수료율을 합쳐서도 100%를 넘을 수 없어요. 입력한 값을 다시 확인해 주세요."}
        </Warn>
      ) : (
        <>
          <ResultCard
            title="이 주문으로 실제 받는 돈"
            rows={[
              { label: "실수령액", value: fmtWon(r.payout), strong: true },
              { label: "수수료 합계", value: fmtWon(r.totalFees), note: vatExtra ? `부가세 ${fmtWon(r.feeVat)} 포함` : undefined },
              { label: "원가를 뺀 이익", value: fmtWon(r.profit), strong: true },
              { label: "이익률 (이익 ÷ 주문금액)", value: fmtPct(r.profitRatePct) },
              { label: "주문금액 중 비용 비중", value: fmtPct(r.burdenRatePct), note: "수수료·배달비·광고비·할인 합" },
              ...(r.monthlyProfit !== null ? [{ label: "한 달 이익", value: fmtWon(r.monthlyProfit) }] : []),
            ]}
            footnote="수수료를 어떤 금액에 매기는지는 배달앱·요금제마다 달라요. 정산서의 계산 기준이 다르면 결과도 달라질 수 있어요."
          />
          {r.profit < 0 ? <Warn>이 조건에서는 주문 1건마다 손해가 나요. 수수료·배달비·원가를 다시 확인해 보세요.</Warn> : null}
        </>
      )}
    </div>
  );
}
