"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

interface Props {
  items: FaqItem[];
}

export function FaqAccordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2 max-w-2xl mx-auto">
      {items.map(({ q, a }, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={`border rounded-xl overflow-hidden transition-colors ${
              isOpen ? "border-blue-200 bg-blue-50/30" : "border-gray-100 bg-white"
            }`}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-semibold text-gray-900 text-base leading-snug">
                {q}
              </span>
              <ChevronDown
                className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-4 md:px-5 pb-4 text-base text-gray-600 leading-relaxed border-t border-blue-100 pt-3">
                {a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
