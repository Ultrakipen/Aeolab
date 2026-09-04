"use client";

import { useState, useEffect } from "react";
import { Lightbulb, X } from "lucide-react";

interface Tip {
  id: string;
  title: string;
  body: string;
  cta_label?: string | null;
  cta_url?: string | null;
}

interface Props {
  section: string;
  industry: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function ContextTipBanner({ section, industry }: Props) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = `tip_dismissed_${section}`;
    if (typeof window !== "undefined" && localStorage.getItem(key)) {
      setDismissed(true);
      return;
    }
    fetch(
      `${BACKEND}/api/tips?section=${encodeURIComponent(section)}&industry=${encodeURIComponent(industry)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        const tips = (data as { tips?: Tip[] } | null)?.tips;
        if (tips && tips.length > 0) setTip(tips[0]);
      });
  }, [section, industry]);

  if (!tip || dismissed) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`tip_dismissed_${section}`, "1");
    }
    setDismissed(true);
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex items-start gap-3">
      <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{tip.title}</p>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5 leading-relaxed">{tip.body}</p>
        {tip.cta_label && tip.cta_url && (
          <a
            href={tip.cta_url}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
          >
            {tip.cta_label} →
          </a>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="text-blue-400 dark:text-blue-600 hover:text-blue-700 dark:hover:text-blue-300 shrink-0 transition-colors"
        aria-label="팁 닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
