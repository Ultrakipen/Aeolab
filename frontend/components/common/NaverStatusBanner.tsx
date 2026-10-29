"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const REFRESH_MS = 5 * 60 * 1000;

interface NaverStatus {
  state: "ok" | "delayed" | "recovering";
  message: string;
  detail: string;
}

/**
 * 네이버 확인이 지연될 때만 보이는 안내 배너 (2026-10-29).
 *
 * 네이버 접속은 차단 보호 때문에 한동안 멈출 수 있다. 그동안 점수·순위가 왜 안 바뀌는지, 언제 다시 확인되는지
 * 알려 주지 않으면 서비스가 고장 난 것으로 보인다. 정상일 때는 아무것도 그리지 않고, 상태를 읽지 못해도 화면을
 * 막지 않는다. 내부 한도·횟수는 서버가 내려 주지 않으므로 여기서도 보일 수 없다.
 */
export default function NaverStatusBanner() {
  const [status, setStatus] = useState<NaverStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${BACKEND}/api/status/naver`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as Partial<NaverStatus>;
        if (cancelled) return;
        if ((d.state === "delayed" || d.state === "recovering") && d.message) {
          setStatus({ state: d.state, message: d.message, detail: d.detail ?? "" });
        } else {
          setStatus(null);
        }
      } catch {
        /* 상태를 읽지 못해도 화면은 그대로 둔다 */
      }
    }

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!status) return null;

  const delayed = status.state === "delayed";
  return (
    <div className="px-4 md:px-8 pt-3 md:pt-4">
      <div
        role="status"
        aria-live="polite"
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          delayed ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-blue-50 border-blue-200 text-blue-900"
        }`}
      >
        <Clock className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm md:text-base font-semibold break-keep">{status.message}</p>
          {status.detail && <p className="text-sm mt-1 break-keep">{status.detail}</p>}
        </div>
      </div>
    </div>
  );
}
