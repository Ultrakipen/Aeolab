"use client";
import { useState, useEffect } from "react";
import { X, Clock } from "lucide-react";

const STORAGE_KEY = "aeolab_expectation_dismissed";

export function ExpectationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
      <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-800">AI 노출 개선은 즉각적이지 않습니다</p>
        <p className="text-sm text-blue-700 mt-0.5 leading-relaxed">
          스마트플레이스 설정 변경은 1일 이내 반영되지만, 콘텐츠 최적화 효과는 수주~수개월 후 나타납니다.
          AEOlab은 그 과정을 매주 추적해 변화를 알려드립니다.
          <span className="block mt-1 text-blue-500 text-xs">
            네이버는 AI 브리핑 개선 소요 기간을 공식 발표하지 않습니다. 업종·지역·경쟁도에 따라 다릅니다.
          </span>
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
        className="text-blue-400 hover:text-blue-600 shrink-0"
        aria-label="닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
