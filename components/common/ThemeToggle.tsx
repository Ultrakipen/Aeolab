"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "aeolab.theme";

/**
 * 다크모드 토글 (라이트 / 다크 / 시스템).
 *
 * 인프라: globals.css의 `@custom-variant dark (&:is(.dark *))` + `:root`/`.dark` CSS 변수.
 *
 * 주의: 일부 카드 컴포넌트는 bg-white·text-gray-900 등 하드코딩 다수 (157+ 위치) —
 * 다크모드 활성화 시 점진 마이그레이션 필요. 현재는 토글만 제공.
 */

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    applyTheme(stored);
    setMounted(true);
    // 시스템 모드 추적
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Theme | null) === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const change = (next: Theme) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  // SSR 안전: 마운트 전엔 빈 영역 유지 (FOUC 방지)
  if (!mounted) {
    return (
      <div className={`inline-flex items-center gap-1 rounded-xl border border-gray-200 p-1 ${className}`} aria-hidden />
    );
  }

  const options: Array<{ key: Theme; icon: React.ReactNode; label: string }> = [
    { key: "light", icon: <Sun className="w-4 h-4" />, label: "라이트" },
    { key: "dark", icon: <Moon className="w-4 h-4" />, label: "다크" },
    { key: "system", icon: <Monitor className="w-4 h-4" />, label: "시스템" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="테마 모드"
      className={`inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = theme === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => change(opt.key)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[36px] ${
              active
                ? "bg-blue-600 text-white"
                : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
