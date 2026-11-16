"use client";

import { useRef, useState } from "react";
import { cleanNumberInput, displayNumberInput } from "./format";

// 숫자 입력칸 — value 는 쉼표 없는 원문 문자열("" 이면 입력 안 한 것, 0 과 구분한다)
export function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  hint,
  decimal = false,
  placeholder,
  optional = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  hint?: string;
  decimal?: boolean;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label}
        {optional ? <span className="ml-1 font-normal text-gray-600">(선택)</span> : null}
      </label>
      <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-[var(--tool-accent,#3b82f6)]">
        <input
          id={id}
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={displayNumberInput(value)}
          placeholder={placeholder}
          onChange={(e) => onChange(cleanNumberInput(e.target.value, decimal))}
          className="min-h-[48px] w-full min-w-0 bg-transparent px-3 text-base text-gray-900 outline-none placeholder:text-gray-400"
        />
        {unit ? <span className="whitespace-nowrap pr-3 text-sm text-gray-600">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-1 text-sm leading-relaxed text-gray-600 break-keep">{hint}</p> : null}
    </div>
  );
}

export function CheckField({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-gray-800">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-blue-600"
        />
        {label}
      </label>
      {hint ? <p className="ml-8 text-sm leading-relaxed text-gray-600 break-keep">{hint}</p> : null}
    </div>
  );
}

export function ResultCard({
  title,
  rows,
  footnote,
}: {
  title: string;
  rows: { label: string; value: string; strong?: boolean; note?: string }[];
  footnote?: string;
}) {
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 결과를 메신저·메모에 붙여 넣기 좋은 글로 복사한다(입력값은 포함하지 않고 화면에 보이는 결과만)
  async function copyResult() {
    const lines = [title, ...rows.map((r) => `${r.label}: ${r.value}${r.note ? ` (${r.note})` : ""}`)];
    if (footnote) lines.push(footnote);
    lines.push(typeof window !== "undefined" ? window.location.href : "");
    const text = lines.filter(Boolean).join("\n");
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setCopied(ok ? "ok" : "fail");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(""), 2500);
  }

  return (
    <div className="rounded-xl border border-gray-200 border-t-4 border-t-[var(--tool-accent,#3b82f6)] bg-[var(--tool-soft,#eff6ff)] p-4 md:p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900 md:text-lg">{title}</h2>
        <button
          type="button"
          onClick={copyResult}
          className="min-h-[44px] shrink-0 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-[var(--tool-ink,#1d4ed8)] hover:bg-gray-50"
        >
          {copied === "ok" ? "복사했어요" : copied === "fail" ? "복사할 수 없어요" : "결과 복사"}
        </button>
      </div>
      <dl className="mt-3 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-sm text-gray-700">{r.label}</dt>
            <dd className={`${r.strong ? "text-xl font-bold text-[var(--tool-ink,#111827)] md:text-2xl" : "text-base font-semibold text-gray-900"} sm:text-right`}>
              {r.value}
              {r.note ? <span className="block text-sm font-normal text-gray-600">{r.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {footnote ? <p className="mt-3 text-sm leading-relaxed text-gray-600 break-keep">{footnote}</p> : null}
    </div>
  );
}

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      입력 지우기
    </button>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm leading-relaxed text-gray-600 break-keep md:p-5">
      {children}
    </div>
  );
}

export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 break-keep" role="alert">
      {children}
    </p>
  );
}
