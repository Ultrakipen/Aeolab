"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
    // app/error.tsx·(dashboard)/error.tsx와 동일 필터 — 배포 직후 구버전 캐시가
    // 새 Server Action ID를 못 찾는 무해한 케이스까지 Sentry에 보내지 않도록 함
    const msg = error?.message ?? "";
    if (
      msg.includes("Failed to find Server Action") ||
      msg.includes("older or newer deployment") ||
      msg.includes("Server Reference ID did not match the expected format")
    ) {
      return;
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl p-4 sm:p-6 md:p-12 shadow-sm max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl text-red-700">!</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              일시적인 오류가 발생했습니다
            </h1>
            <p className="text-gray-600 text-sm mb-8">
              잠시 후 다시 시도하거나 새로고침해주세요.
            </p>
            <button
              onClick={reset}
              className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
