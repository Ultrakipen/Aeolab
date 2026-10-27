"use client";
import { useEffect, useState } from "react";

export default function DiagnosisCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [today, setToday] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/scan/trial-count`)
      .then((r) => r.json())
      .then((d) => {
        setCount(d.count);
        setToday(d.today);
      })
      .catch(() => {
        setFailed(true);
      });
  }, []);

  if (count === null && !failed) return null;

  // 집계를 못 가져왔거나 아직 0이면 아무것도 보여 주지 않는다 — "지금도 진행 중" 같은 확인되지 않은 활동 주장 금지
  if (failed || count === 0) return null;

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-3">
      <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-4 py-2 text-sm text-green-700">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span>
          지금까지 <strong className="text-green-800">{count!.toLocaleString()}개</strong> 사업장이 무료 진단을 받았습니다
        </span>
      </div>
      {today !== null && today > 0 && (
        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full px-3 py-1.5 text-sm text-amber-700">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shrink-0" />
          <span>오늘 <strong>{today}곳</strong> 진단</span>
        </div>
      )}
    </div>
  );
}
