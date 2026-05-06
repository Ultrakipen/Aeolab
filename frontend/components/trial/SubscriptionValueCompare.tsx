"use client";

import Link from "next/link";

interface SubscriptionValueCompareProps {
  isLoggedIn: boolean;
  onSave: () => void;
}

/**
 * 매주 받으려면 (구독 가치 비교) 섹션 (4섹션 구조의 섹션 4)
 *
 * - 좌측: 체험은 1회 (빨간 배지)
 * - 우측: 구독은 매주 (녹색 배지)
 * - 하단 큰 CTA: 첫 달 4,950원 시작
 */
export default function SubscriptionValueCompare({ isLoggedIn, onSave }: SubscriptionValueCompareProps) {
  if (isLoggedIn) {
    // 이미 로그인된 사용자에게도 가치 환기는 유지하되 CTA만 변경
  }

  const trialFeatures = [
    { label: "ChatGPT 1회 확인", icon: "✓" },
    { label: "FAQ 1개 미리보기", icon: "✓" },
    { label: "Gemini 10회 샘플링", icon: "✓" },
    { label: "경쟁사 비교", icon: "✗", locked: true },
    { label: "매주 자동 추적", icon: "✗", locked: true },
    { label: "변화 알림 (카톡)", icon: "✗", locked: true },
    { label: "FAQ 5개 + PDF", icon: "✗", locked: true },
  ];

  const subscriptionFeatures = [
    { label: "Gemini·ChatGPT 각 50회 (총 100회)", icon: "✓" },
    { label: "매주 자동 진단", icon: "✓" },
    { label: "변화 카톡 알림", icon: "✓" },
    { label: "경쟁사 3곳 비교", icon: "✓" },
    { label: "맞춤 FAQ 5개 + 복사", icon: "✓" },
    { label: "PDF 리포트 (Pro+)", icon: "✓" },
    { label: "30일 점수 추세", icon: "✓" },
  ];

  return (
    <section className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-4 md:p-6 mb-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl md:text-3xl">💡</span>
        <p className="text-base md:text-lg font-bold text-gray-800">매주 받으려면 (구독 가치)</p>
      </div>

      {/* 좌우 비교 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-5">
        {/* 좌측 — 체험은 1회 */}
        <div className="bg-white rounded-xl border-2 border-red-200 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-base md:text-lg font-bold text-gray-700">지금 받은 결과</p>
            <span className="text-xs md:text-sm font-bold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
              체험 = 1회
            </span>
          </div>
          <ul className="space-y-2">
            {trialFeatures.map((f) => (
              <li
                key={f.label}
                className={`flex items-start gap-2 text-sm md:text-base leading-relaxed break-keep ${
                  f.locked ? "text-gray-500 line-through" : "text-gray-700"
                }`}
              >
                <span className={`shrink-0 font-bold ${f.locked ? "text-red-300" : "text-emerald-500"}`}>
                  {f.icon}
                </span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 우측 — 구독은 매주 */}
        <div className="bg-white rounded-xl border-2 border-emerald-300 p-4 md:p-5 shadow-md relative">
          <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs md:text-sm font-bold px-2.5 py-1 rounded-full shadow-md">
            추천
          </div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-base md:text-lg font-bold text-gray-900">구독 후 받는 것</p>
            <span className="text-xs md:text-sm font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
              구독 = 매주
            </span>
          </div>
          <ul className="space-y-2">
            {subscriptionFeatures.map((f) => (
              <li
                key={f.label}
                className="flex items-start gap-2 text-sm md:text-base leading-relaxed text-gray-800 break-keep"
              >
                <span className="shrink-0 font-bold text-emerald-500">{f.icon}</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 하단 큰 CTA */}
      {!isLoggedIn ? (
        <Link
          href="/signup"
          onClick={onSave}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-black text-lg md:text-xl py-4 md:py-5 rounded-2xl transition-colors shadow-lg"
        >
          첫 달 <span className="text-emerald-300">4,950원</span> 시작하기
          <span className="block text-xs md:text-sm font-medium text-blue-200 mt-1">
            이후 월 9,900원 · 언제든 해지 · 7일간 자동 추적 시작
          </span>
        </Link>
      ) : (
        <Link
          href="/dashboard"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-black text-lg md:text-xl py-4 md:py-5 rounded-2xl transition-colors shadow-lg"
        >
          내 대시보드로 이동
        </Link>
      )}
    </section>
  );
}
