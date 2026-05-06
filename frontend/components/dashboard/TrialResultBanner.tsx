"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "aeolab_trial_result";
const DISMISS_KEY = "aeolab_trial_result_banner_dismissed";
// 24시간 이내 결과만 표시
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export default function TrialResultBanner() {
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) return;

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw) as { business_name?: string; timestamp?: number };
      if (!saved.timestamp || Date.now() - saved.timestamp > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (saved.business_name) {
        setBusinessName(saved.business_name);
        setVisible(true);
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 무시
    }
  };

  if (!visible) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="text-amber-500 text-lg shrink-0">✓</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            이전 무료 체험 결과가 있습니다
            {businessName && <span className="font-normal"> — {businessName}</span>}
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            전체 AI 분석 결과를 보려면 스캔을 시작하거나 체험 결과를 다시 확인하세요.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <Link
          href="/trial"
          className="text-sm font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          결과 다시 보기 →
        </Link>
        <button
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 transition-colors p-1"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
