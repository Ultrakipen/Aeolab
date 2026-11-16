"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

// 모바일에서 입력이 길어 결과가 화면 밖에 있을 때, 핵심 결과를 하단 막대로 보여 주고 누르면 결과로 이동한다.
// 결과 카드(ResultCard)가 data-tool-result / data-summary-* 로 알려 주는 값을 읽는다 — 계산기마다 따로 연결하지 않는다.
// 입력 중(입력칸에 커서가 있을 때)에는 숨겨 키보드·입력칸을 가리지 않고, 결과가 화면에 보이거나 페이지 맨 아래일 때도 숨긴다.
export default function MobileResultBar() {
  const [summary, setSummary] = useState<{ label: string; value: string } | null>(null);
  const [inView, setInView] = useState(false);
  const [typing, setTyping] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = document.querySelector<HTMLElement>("[data-tool-result]");
      const label = el?.dataset.summaryLabel;
      const value = el?.dataset.summaryValue;
      setSummary((prev) => {
        if (!el || !label || !value) return prev === null ? prev : null;
        return prev && prev.label === label && prev.value === value ? prev : { label, value };
      });
      if (el) {
        const r = el.getBoundingClientRect();
        setInView(r.top < window.innerHeight * 0.85 && r.bottom > 0);
      } else {
        setInView(false);
      }
      setAtBottom(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      setTyping(!!t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName));
    };
    const onFocusOut = () => setTyping(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  if (!summary || inView || typing || atBottom) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={() => {
          const el = document.querySelector("[data-tool-result]");
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg px-4 text-base font-semibold text-white"
        style={{ backgroundColor: "var(--tool-accent, #2563eb)" }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
          <span className="truncate">결과 보기 · {summary.label}</span>
        </span>
        <span className="shrink-0">{summary.value}</span>
      </button>
    </div>
  );
}
