"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { trackDetailsToggle } from "@/lib/analytics";

interface Props {
  id?: string;
  title: string;
  description?: string;
  iconColor?: string;
  defaultOpen?: boolean;
  /** 모바일(< 768px) 전용 기본 상태. 미지정 시 defaultOpen과 동일 */
  mobileDefaultOpen?: boolean;
  highlight?: boolean;
  badgeText?: string;
  badgeColor?: "amber" | "red" | "green" | "blue";
  children: React.ReactNode;
}

export default function CollapseSectionWrapper({
  id,
  title,
  description,
  iconColor = "text-blue-600",
  defaultOpen = false,
  mobileDefaultOpen,
  highlight = false,
  badgeText,
  badgeColor = "amber",
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // 모바일 기본 상태 오버라이드 — useEffect로 하이드레이션 후 적용 (flash 최소화)
  useEffect(() => {
    if (mobileDefaultOpen === undefined) return;
    if (window.innerWidth < 768) {
      setIsOpen(mobileDefaultOpen);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id={id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      highlight ? "border-green-200 shadow-md" : "border-gray-200"
    }`}>
      <button
        onClick={() => setIsOpen((v) => {
          const next = !v;
          trackDetailsToggle(`dashboard_${id ?? title}`, next);
          return next;
        })}
        className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors ${
          highlight ? "hover:bg-green-50/50" : "hover:bg-gray-50"
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${iconColor.replace("text-", "bg-")} shrink-0`} />
          <span className="text-base font-bold text-gray-800 shrink-0 whitespace-nowrap">{title}</span>
          {description && <span className="text-sm text-gray-600 truncate min-w-0">{description}</span>}
          {highlight && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold shrink-0 whitespace-nowrap">
              핵심
            </span>
          )}
          {badgeText && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
              badgeColor === "red"   ? "bg-red-100 text-red-700" :
              badgeColor === "green" ? "bg-green-100 text-green-700" :
              badgeColor === "blue"  ? "bg-blue-100 text-blue-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {badgeText}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 p-4">
          {children}
        </div>
      )}
    </div>
  );
}
