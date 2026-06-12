"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  id?: string;
  title: string;
  description?: string;
  iconColor?: string;
  defaultOpen?: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}

export default function CollapseSectionWrapper({
  id,
  title,
  description,
  iconColor = "text-blue-600",
  defaultOpen = false,
  highlight = false,
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div id={id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      highlight ? "border-green-200 shadow-md" : "border-gray-200"
    }`}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors ${
          highlight ? "hover:bg-green-50/50" : "hover:bg-gray-50"
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${iconColor.replace("text-", "bg-")} shrink-0`} />
          <span className="text-base font-bold text-gray-800 shrink-0 whitespace-nowrap">{title}</span>
          {description && <span className="text-xs text-gray-400 truncate min-w-0">{description}</span>}
          {highlight && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold hidden sm:inline-flex">
              핵심
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
