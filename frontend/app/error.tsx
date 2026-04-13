"use client";

import Link from "next/link";
import { useEffect } from "react";

interface Props {
  error: Error;
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // 오류를 콘솔에 기록 (운영 모니터링용)
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl text-red-500">!</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
          일시적인 오류가 발생했습니다
        </h1>
        <p className="text-gray-500 text-base mb-2">
          서버 또는 네트워크 문제가 발생했습니다.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          잠시 후 다시 시도하거나 홈으로 이동해주세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="border border-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
