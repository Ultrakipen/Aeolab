"use client";

import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";

interface Props {
  businessId: string;
  businessName?: string;
  plan?: string;
  hasScanResult: boolean;
}

/**
 * 온보딩 완료 직후 첫 스캔 유도 배너.
 * URL에 ?onboarding=1 쿼리가 있고 스캔 결과가 없는 사용자에게만 노출.
 * 닫기(X) 또는 스캔 완료 시 sessionStorage에 기록하여 재표시 방지.
 */
export default function FirstScanBanner({ businessId, businessName, plan, hasScanResult }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasScanResult) return;
    const dismissed = sessionStorage.getItem("first_scan_banner_dismissed");
    if (dismissed) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "1") {
      setVisible(true);
    }
  }, [hasScanResult]);

  const dismiss = () => {
    sessionStorage.setItem("first_scan_banner_dismissed", "1");
    setVisible(false);
  };

  const handleScanClick = () => {
    dismiss();
    // 대시보드 내 스캔 버튼으로 스크롤 (id=scan-trigger) 또는 페이지 새로고침으로 스캔 모달 유도
    const el = document.getElementById("scan-trigger-btn");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.click();
    } else {
      // 폴백: 스캔 트리거 버튼을 찾지 못한 경우 대시보드 상단으로 스크롤
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!visible) return null;

  const planLabel = plan === "free" || !plan ? "Free 플랜" : `${plan.charAt(0).toUpperCase()}${plan.slice(1)} 플랜`;

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 relative">
      {/* 닫기 버튼 */}
      <button
        onClick={dismiss}
        aria-label="배너 닫기"
        className="absolute top-3 right-3 text-gray-600 hover:text-gray-700 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-6">
        {/* 아이콘 */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
          <Sparkles className="w-6 h-6 text-white" strokeWidth={1.5} />
        </div>

        {/* 텍스트 */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
            {businessName ? `${businessName} 등록 완료!` : "환영합니다!"} 첫 스캔으로 AI 노출 진단을 시작하세요
          </h2>
          <p className="text-sm text-gray-600">
            약 1분 소요 · 4개 AI 채널 측정 · {planLabel} 무료 스캔 1회
          </p>
        </div>

        {/* CTA 버튼 */}
        <button
          onClick={handleScanClick}
          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-3 rounded-lg transition-colors w-full sm:w-auto text-center"
        >
          지금 첫 스캔 실행하기
        </button>
      </div>
    </div>
  );
}
