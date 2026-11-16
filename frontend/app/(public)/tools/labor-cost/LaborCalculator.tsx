"use client";

import { useState } from "react";
import { currentMinWage, laborCost, parseNum } from "@/lib/calc";
import { useClientValue } from "@/lib/useClientValue";
import { fmtInt, fmtWon } from "../_components/format";
import { CheckField, EmptyState, NumberField, ResetButton, ResultCard, Warn } from "../_components/NumberField";
import { useCalcUsage } from "../_components/useCalcUsage";

export default function LaborCalculator() {
  const [hourly, setHourly] = useState("");
  const [weekly, setWeekly] = useState("");
  const [withInsurance, setWithInsurance] = useState(true);
  const [withSeverance, setWithSeverance] = useState(false);
  const [other, setOther] = useState("");
  // 시행 중인 최저임금(연도별 표에서 방문 시점으로 선택). 없으면 버튼을 숨기고 미달 판정도 하지 않는다.
  // 서버 렌더·캐시 시점과 무관하게 방문 시점으로 판정하려고 useClientValue 사용(처음 렌더에는 0 = 숨김).
  const mwHourly = useClientValue(() => currentMinWage()?.hourly ?? 0, 0);
  const mwYear = useClientValue(() => currentMinWage()?.year ?? 0, 0);

  const h = parseNum(hourly);
  const w = parseNum(weekly);
  const r =
    h !== null && w !== null
      ? laborCost({
          hourly: h,
          weeklyHours: w,
          includeInsurance: withInsurance,
          includeSeverance: withSeverance,
          otherEmployerPct: parseNum(other),
        })
      : null;
  useCalcUsage("labor-cost", r?.ok === true);

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 md:p-6">
        <div>
          <NumberField id="lb-hourly" label="시급" unit="원" value={hourly} onChange={setHourly} />
          {mwHourly > 0 ? (
            <button
              type="button"
              onClick={() => setHourly(String(mwHourly))}
              className="mt-2 min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              {mwYear}년 최저임금 {mwHourly.toLocaleString("ko-KR")}원 입력
            </button>
          ) : null}
        </div>
        <NumberField id="lb-weekly" label="일주일 근무 시간" unit="시간" decimal value={weekly} onChange={setWeekly} hint="휴게시간을 뺀 실제 일하는 시간으로 입력해 주세요." />
        <CheckField
          id="lb-ins"
          label="사업주가 내는 4대보험도 함께 계산"
          checked={withInsurance}
          onChange={setWithInsurance}
          hint="국민연금·건강보험·장기요양보험의 사업주 부담분을 개략으로 더해요."
        />
        <CheckField
          id="lb-sev"
          label="퇴직금 적립(월급의 약 1/12)도 함께 계산"
          checked={withSeverance}
          onChange={setWithSeverance}
          hint="1년 이상, 주 15시간 이상 일한 직원에게 퇴직금이 생겨요. 실제 금액은 평균임금으로 정해져 개략으로만 보여 드려요."
        />
        <NumberField
          id="lb-other"
          label="고용보험·산재보험 등 사업주 부담률"
          unit="%"
          decimal
          value={other}
          onChange={setOther}
          optional
          hint="업종·규모에 따라 달라서 기본값을 넣지 않았어요. 아는 값이 있으면 입력해 주세요."
        />
        <ResetButton
          onClick={() => { setHourly(""); setWeekly(""); setWithInsurance(true); setWithSeverance(false); setOther(""); }}
        />
      </div>

      {r === null ? (
        <EmptyState>시급과 일주일 근무 시간을 입력하면 한 달 인건비가 나와요.</EmptyState>
      ) : !r.ok ? (
        <Warn>
          {r.reason === "hourly_not_positive" && "시급은 0원보다 커야 계산할 수 있어요."}
          {r.reason === "hours_not_positive" && "일주일 근무 시간은 0보다 커야 계산할 수 있어요."}
          {r.reason === "hours_too_large" && "일주일은 168시간이라 그보다 많이 입력할 수 없어요. 근무 시간을 다시 확인해 주세요."}
          {r.reason === "other_pct_out_of_range" && "사업주 부담률은 0~100% 사이로 입력해 주세요."}
        </Warn>
      ) : (
        <>
          {r.belowMinWage === true && r.minWage ? (
            <Warn>
              입력하신 시급이 {r.minWage.year}년 최저임금({r.minWage.hourly.toLocaleString("ko-KR")}원)보다 낮아요. 최저임금은 모든 사업장에 적용돼요.
            </Warn>
          ) : null}
          {r.overFortyHours ? (
            <Warn>주 40시간을 넘는 시간은 연장근로(가산수당)가 필요할 수 있어요. 이 계산에는 가산수당을 넣지 않았어요.</Warn>
          ) : null}
          <ResultCard
            title="한 달 인건비 (직원 1명)"
            rows={[
              { label: "월급 (주휴수당 포함)", value: fmtWon(r.monthlyWage), note: `월 ${fmtInt(r.monthlyHours)}시간 기준${r.paidHolidayHours > 0 ? ` · 주휴 ${r.paidHolidayHours}시간 포함` : " · 주 15시간 미만은 주휴수당 없음"}` },
              ...(withInsurance
                ? [
                    { label: "사업주 국민연금 (개략)", value: fmtWon(r.pension) },
                    { label: "사업주 건강보험 (개략)", value: fmtWon(r.health) },
                    { label: "사업주 장기요양 (개략)", value: fmtWon(r.longTermCare) },
                  ]
                : []),
              ...(r.other > 0 ? [{ label: "입력하신 기타 보험", value: fmtWon(r.other) }] : []),
              ...(withSeverance ? [{ label: "퇴직금 적립 (개략)", value: fmtWon(r.severance) }] : []),
              { label: "사장님이 쓰는 한 달 총액", value: fmtWon(r.monthlyTotal), strong: true },
              { label: "1년 환산", value: fmtWon(r.yearlyTotal) },
            ]}
            footnote={
              withInsurance
                ? "보험료는 월급 전체에 요율만 곱한 개략치예요. 기준소득월액 상·하한, 비과세 수당(식대 등), 단시간 근로자의 가입 예외, 고용·산재보험은 반영하지 않았어요. 연차수당·상여금도 넣지 않았어요. 실제 고지액은 각 공단에서 확인해 주세요."
                : "연차수당·상여금은 넣지 않았어요."
            }
          />
        </>
      )}
    </div>
  );
}
