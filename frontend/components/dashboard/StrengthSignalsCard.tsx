"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, ExternalLink } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";

interface StrengthItem {
  key: string;
  text: string;
  detail: string | null;
  measured_at: string | null;
  link: string | null;
  link_label: string | null;
}

interface StrengthResponse {
  items: StrengthItem[];
  unmeasured: string[];
  empty_reason: "no_place_id" | "none" | null;
  total_found: number;
  needs_place_id: boolean;
  disclaimer?: string;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

/**
 * 측정으로 확인된 점 — 점수와 별개로, 측정으로 확인된 사실만 보여준다 (설계: docs/strength_signals_design_v1.0.md).
 * 규칙(0·오류·오래됨·입력값 제외)은 백엔드 services/strength_signals.py 단일 소스. 조회 실패 시 아무것도 그리지 않는다.
 */
export default function StrengthSignalsCard({ bizId, accessToken }: { bizId: string; accessToken: string }) {
  const [data, setData] = useState<StrengthResponse | null>(null);

  useEffect(() => {
    if (!bizId || !accessToken) return;
    let alive = true;
    fetch(`${BACKEND}/api/report/strengths/${bizId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: StrengthResponse | null) => {
        if (!alive || !j || !Array.isArray(j.items)) return;
        setData(j);
        trackEvent("strength_signals_view", { count: j.items.length, empty: j.empty_reason ?? "" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bizId, accessToken]);

  if (!data) return null;

  return (
    <section
      aria-label="측정으로 확인된 점"
      className="rounded-xl border border-green-200 bg-white px-4 py-4 md:px-5"
    >
      <h2 className="text-base md:text-lg font-bold text-gray-900">측정으로 확인된 점</h2>
      <p className="text-sm text-gray-600 mt-0.5 break-keep">
        점수와 별개로, 직접 측정해 확인된 사실만 보여드립니다.
      </p>

      {data.items.length > 0 ? (
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.items.map((it) => {
            const d = fmtDate(it.measured_at);
            return (
              <li key={it.key} className="flex items-start gap-2.5 rounded-lg bg-green-50 border border-green-100 px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-900 break-keep">{it.text}</p>
                  {it.detail && <p className="text-sm text-gray-700 mt-0.5 break-keep">{it.detail}</p>}
                  <p className="text-sm text-gray-600 mt-0.5 flex flex-wrap items-center gap-x-3">
                    {d && <span>측정 {d}</span>}
                    {it.link && (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackEvent("strength_signal_link_click", { key: it.key })}
                        className="inline-flex items-center gap-1 text-blue-700 underline"
                      >
                        {it.link_label ?? "직접 확인"}
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-700 break-keep rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
          {data.empty_reason === "no_place_id"
            ? "스마트플레이스를 연결하면(사업장 설정에서 플레이스 주소 입력) 리뷰 수 등 확인된 항목이 여기에 표시됩니다."
            : "아직 확인된 항목이 없습니다. 측정이 쌓이면 이곳에 표시됩니다."}
        </p>
      )}

      {data.needs_place_id && data.items.length > 0 && (
        <p className="mt-2 text-sm text-gray-700 break-keep">
          스마트플레이스를 연결하면 리뷰 수 등 더 많은 항목을 확인할 수 있습니다.
        </p>
      )}

      {data.unmeasured.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-700 break-keep">
          <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            이번에 확인하지 못한 항목: {data.unmeasured.join(", ")}. 다음 측정 때 다시 시도합니다(노출 여부와는 무관합니다).
          </span>
        </p>
      )}

      <p className="mt-2 text-sm text-gray-600 break-keep">
        {data.disclaimer ?? "측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다."}
      </p>
    </section>
  );
}
