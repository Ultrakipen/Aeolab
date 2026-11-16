"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CALC_BASIS, menuCost, parseNum, type CostIngredient } from "@/lib/calc";
import { fmtPct, fmtWon } from "../_components/format";
import { CheckField, EmptyState, NumberField, ResetButton, ResultCard, Warn } from "../_components/NumberField";
import { useCalcUsage } from "../_components/useCalcUsage";

interface Row {
  id: number;
  name: string;
  price: string;
  qty: string;
  use: string;
  loss: string;
}

const MAX_ROWS = 20;
const blankRow = (id: number): Row => ({ id, name: "", price: "", qty: "", use: "", loss: "" });
const isBlank = (r: Row) => r.price === "" && r.qty === "" && r.use === "";
const isComplete = (r: Row) => r.price !== "" && r.qty !== "" && r.use !== "";

export default function MenuCostCalculator() {
  const nextId = useRef(3);
  const [rows, setRows] = useState<Row[]>([blankRow(1), blankRow(2)]);
  const [other, setOther] = useState("");
  const [price, setPrice] = useState("");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [target, setTarget] = useState("");

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  // 새 줄 번호는 setState 함수 밖에서 뽑는다(개발 모드에서 함수가 두 번 실행돼도 번호가 건너뛰지 않게)
  const addRow = () => {
    const id = nextId.current++;
    setRows((rs) => (rs.length >= MAX_ROWS ? rs : [...rs, blankRow(id)]));
  };
  const removeRow = (id: number) => {
    const fresh = nextId.current++;
    setRows((rs) => (rs.length <= 1 ? [blankRow(fresh)] : rs.filter((r) => r.id !== id)));
  };

  const filled = rows.filter((r) => !isBlank(r));
  const incomplete = filled.filter((r) => !isComplete(r));
  // 화면에 보이는 줄 번호(재료 N)를 기억해 둔다 — 빈 줄이 앞에 있어도 경고·재료별 원가의 번호가 화면과 같게
  const complete = rows.map((row, i) => ({ row, no: i + 1 })).filter(({ row }) => !isBlank(row) && isComplete(row));
  const ingredients: CostIngredient[] = complete.map(({ row }) => ({
    purchasePrice: parseNum(row.price) ?? 0,
    purchaseQty: parseNum(row.qty) ?? 0,
    useQty: parseNum(row.use) ?? 0,
    lossPct: parseNum(row.loss) ?? 0,
  }));

  // 입력이 덜 끝난 재료가 있으면 일부만 더한 값이 "원가"처럼 보이지 않게 계산을 멈추고 안내한다
  const ready = filled.length > 0 && incomplete.length === 0;
  const p = parseNum(price);
  const t = parseNum(target);
  const r = ready
    ? menuCost({
        ingredients,
        otherCost: parseNum(other) ?? 0,
        price: p,
        priceIncludesVat: vatIncluded,
        targetCostPct: t,
      })
    : null;
  useCalcUsage("menu-cost", r?.ok === true);

  const reset = () => {
    setRows([blankRow(nextId.current++), blankRow(nextId.current++)]);
    setOther("");
    setPrice("");
    setVatIncluded(false);
    setTarget("");
  };

  const rowNames = complete.map(({ row, no }) => row.name.trim() || `재료 ${no}`);

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">1인분에 들어가는 재료</h2>
          <p className="mt-1 break-keep text-sm leading-relaxed text-gray-600">
            재료마다 산 금액·산 양·1인분에 쓰는 양을 넣어 주세요. 양은 g·ml·개처럼 같은 단위로 맞춰 주세요(예: 1kg을 1,000g으로).
          </p>
        </div>

        {rows.map((row, idx) => (
          <fieldset key={row.id} className="rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">재료 {idx + 1}</legend>
            <div className="space-y-3">
              <div>
                <label htmlFor={`mc-name-${row.id}`} className="block text-sm font-medium text-gray-800">
                  재료 이름 <span className="ml-1 font-normal text-gray-600">(선택)</span>
                </label>
                <input
                  id={`mc-name-${row.id}`}
                  type="text"
                  value={row.name}
                  maxLength={30}
                  autoComplete="off"
                  placeholder="예: 원두"
                  onChange={(e) => update(row.id, { name: e.target.value })}
                  className="mt-1 min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--tool-accent,#3b82f6)]"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField id={`mc-price-${row.id}`} label="산 금액" unit="원" value={row.price} onChange={(v) => update(row.id, { price: v })} />
                <NumberField id={`mc-qty-${row.id}`} label="산 양" unit="g·ml·개" decimal value={row.qty} onChange={(v) => update(row.id, { qty: v })} />
                <NumberField id={`mc-use-${row.id}`} label="1인분에 쓰는 양" unit="g·ml·개" decimal value={row.use} onChange={(v) => update(row.id, { use: v })} />
                <NumberField id={`mc-loss-${row.id}`} label="손실률" unit="%" decimal optional value={row.loss} onChange={(v) => update(row.id, { loss: v })} hint="다듬거나 조리하며 버리는 비율" />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                이 재료 지우기
              </button>
            </div>
          </fieldset>
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_ROWS}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-400 bg-white px-4 text-base font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-500"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          재료 추가 {rows.length >= MAX_ROWS ? `(최대 ${MAX_ROWS}개)` : ""}
        </button>

        <NumberField
          id="mc-other"
          label="재료 말고 1인분에 드는 비용"
          unit="원"
          value={other}
          onChange={setOther}
          optional
          hint="컵·포장 용기·빨대·소스 등. 비우면 0원으로 계산해요."
        />
        <NumberField
          id="mc-price"
          label="판매가"
          unit="원"
          value={price}
          onChange={setPrice}
          optional
          hint="넣으면 원가율과 남는 돈을 계산해요."
        />
        <CheckField
          id="mc-vat"
          label="판매가에 부가세 10%가 포함돼 있어요"
          checked={vatIncluded}
          onChange={setVatIncluded}
          hint="체크하면 부가세를 뺀 금액(공급가액)을 기준으로 원가율을 봐요. 재료 금액도 부가세를 뺀 금액으로 넣으면 더 정확해요."
        />
        <NumberField
          id="mc-target"
          label="목표 원가율"
          unit="%"
          decimal
          value={target}
          onChange={setTarget}
          optional
          hint="정하신 원가율을 맞추려면 판매가를 얼마로 해야 하는지 알려 드려요. 적정 원가율은 업종·매장마다 달라서 기본값을 넣지 않았어요."
        />
        <ResetButton onClick={reset} />
      </div>

      <div className="space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        {filled.length === 0 ? (
          <EmptyState>재료의 산 금액·산 양·1인분에 쓰는 양을 넣으면 1인분 원가가 나와요.</EmptyState>
        ) : incomplete.length > 0 ? (
          <Warn>
            입력이 덜 끝난 재료가 있어요. 산 금액·산 양·1인분에 쓰는 양을 모두 넣거나, 쓰지 않는 칸은 지워 주세요. 일부만 더한 값이 원가처럼
            보이지 않도록 계산을 멈췄어요.
          </Warn>
        ) : r === null ? null : !r.ok ? (
          <Warn>
            {r.reason === "ingredient_invalid" && `재료 ${complete[r.index ?? 0]?.no ?? (r.index ?? 0) + 1}번의 값을 확인해 주세요. 산 양은 0보다 커야 하고 손실률은 0% 이상 100% 미만이어야 해요.`}
            {r.reason === "other_negative" && "재료 말고 드는 비용은 0원 이상으로 입력해 주세요."}
            {r.reason === "price_not_positive" && "판매가는 0원보다 커야 해요."}
            {r.reason === "target_out_of_range" && "목표 원가율은 0%보다 크고 100% 이하로 입력해 주세요."}
            {r.reason === "no_ingredients" && "재료를 한 줄 이상 입력해 주세요."}
          </Warn>
        ) : (
          <>
            <ResultCard
              title="1인분 원가"
              rows={[
                { label: "재료비 합계", value: fmtWon(r.materialCost) },
                ...(parseNum(other) ? [{ label: "그 밖의 비용", value: fmtWon(parseNum(other) ?? 0) }] : []),
                { label: "1인분 원가", value: fmtWon(r.totalCost), strong: true },
                ...(r.costRatePct !== null
                  ? [
                      { label: vatIncluded ? "원가율 (부가세 뺀 판매가 기준)" : "원가율 (원가 ÷ 판매가)", value: fmtPct(r.costRatePct), strong: true },
                      { label: "남는 돈", value: fmtWon(r.unitProfit ?? 0), note: vatIncluded && r.netPrice !== null ? `부가세 뺀 판매가 ${fmtWon(r.netPrice)} 기준` : undefined },
                      { label: "마진율", value: fmtPct(r.marginRatePct ?? 0) },
                    ]
                  : []),
              ]}
              footnote={
                r.costRatePct !== null && (r.unitProfit ?? 0) < 0
                  ? "원가가 판매가보다 높아서 팔수록 손해가 나요. 재료 양·판매가를 다시 확인해 보세요."
                  : "원가율은 판매가 중 원가가 차지하는 비율이에요. 인건비·임대료 같은 고정비는 포함하지 않아요."
              }
            />
            {r.suggestedPrice !== null ? (
              <ResultCard
                title={`목표 원가율 ${fmtPct(t ?? 0)}를 맞추는 판매가`}
                rows={[
                  { label: vatIncluded ? "판매가 (부가세 포함)" : "판매가", value: fmtWon(r.suggestedPrice), strong: true },
                  { label: "100원 단위로 올리면", value: fmtWon(r.suggestedPriceCeil100 ?? 0) },
                ]}
                footnote="원가를 목표 원가율로 나눈 값이에요. 경쟁 가게 가격과 손님 반응은 반영하지 않았어요."
              />
            ) : null}
            {filled.length > 1 ? (
              <ResultCard
                title="재료별 원가"
                rows={r.ingredientCosts.map((c, idx) => ({
                  label: rowNames[idx] ?? `재료 ${idx + 1}`,
                  value: fmtWon(c),
                  note: r.materialCost > 0 ? `재료비의 ${fmtPct((c / r.materialCost) * 100)}` : undefined,
                }))}
              />
            ) : null}
            <p className="text-sm leading-relaxed text-gray-600 break-keep">
              부가세율은 {CALC_BASIS.vat.generalRatePct}%(국세청 기준)로 계산해요. 입력한 값은 저장하지 않고 이 화면에서만 계산해요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
