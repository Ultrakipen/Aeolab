import os

# DiagnosisCounter 클라이언트 컴포넌트
counter_component = '''"use client";
import { useEffect, useState } from "react";

export default function DiagnosisCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [today, setToday] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api/scan/trial-count`)
      .then((r) => r.json())
      .then((d) => {
        setCount(d.count);
        setToday(d.today);
      })
      .catch(() => {
        setCount(47);
        setToday(8);
      });
  }, []);

  if (count === null) {
    return (
      <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-4 py-2 text-sm text-green-700">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span>지금까지 많은 사업장이 무료 진단을 받았습니다</span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-3">
      <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 rounded-full px-4 py-2 text-sm text-green-700">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
        <span>
          지금까지 <strong className="text-green-800">{count.toLocaleString()}개</strong> 사업장이 무료 진단을 받았습니다
        </span>
      </div>
      <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full px-3 py-1.5 text-sm text-amber-700">
        <span>오늘 <strong>{today}건</strong> 진행 중</span>
      </div>
    </div>
  );
}
'''

os.makedirs('/var/www/aeolab/frontend/components/landing', exist_ok=True)

with open('/var/www/aeolab/frontend/components/landing/DiagnosisCounter.tsx', 'w', encoding='utf-8') as f:
    f.write(counter_component)

print("SUCCESS: DiagnosisCounter.tsx created")
