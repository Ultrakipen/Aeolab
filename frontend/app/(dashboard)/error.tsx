"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  const router = useRouter();
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    console.error("[dashboard error]", error);
    const msg = error?.message ?? "";
    if (
      msg.includes("Failed to find Server Action") ||
      msg.includes("older or newer deployment") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Loading chunk")
    ) {
      setIsStale(true);
    }
  }, [error]);

  // 캐시 불일치 오류 시 3초 후 자동 새로고침
  useEffect(() => {
    if (!isStale) return;
    const timer = setTimeout(() => window.location.reload(), 3000);
    return () => clearTimeout(timer);
  }, [isStale]);

  if (isStale) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm max-w-sm w-full text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">서비스가 업데이트되었습니다</h2>
          <p className="text-gray-500 text-sm mb-6">잠시 후 자동으로 새로고침됩니다.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            지금 새로고침
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm max-w-sm w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">일시적인 오류가 발생했습니다</h2>
        <p className="text-gray-500 text-sm mb-6">잠시 후 다시 시도해 주세요.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
          >
            다시 시도
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-sm"
          >
            대시보드로
          </button>
        </div>
      </div>
    </div>
  );
}
