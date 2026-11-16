import type { CSSProperties } from "react";
import { Calculator, MapPin, Receipt, Scale, Search, Truck, Users, type LucideIcon } from "lucide-react";

// 도구별 포인트 색 — 색만으로 뜻을 전달하지 않는다(제목·아이콘·글자가 함께 있음). 글자색(ink)은 흰/연한 배경에서 4.5:1 이상이 되는 짙은 색.
export interface ToolTheme {
  key: string;
  accent: string; // 아이콘 타일·강조선(흰 글자/아이콘을 올리는 색)
  soft: string; // 연한 배경
  ink: string; // 흰·연한 배경 위 글자색
  icon: LucideIcon;
}

export const TOOL_THEMES: Record<string, ToolTheme> = {
  "break-even": {
    key: "break-even",
    accent: "oklch(0.546 0.245 262.881)",
    soft: "oklch(0.97 0.014 254.604)",
    ink: "oklch(0.424 0.199 265.638)",
    icon: Scale,
  },
  "delivery-settlement": {
    key: "delivery-settlement",
    accent: "oklch(0.553 0.195 38.402)",
    soft: "oklch(0.98 0.016 73.684)",
    ink: "oklch(0.47 0.157 37.304)",
    icon: Truck,
  },
  "labor-cost": {
    key: "labor-cost",
    accent: "oklch(0.508 0.118 165.612)",
    soft: "oklch(0.979 0.021 166.113)",
    ink: "oklch(0.432 0.095 166.913)",
    icon: Users,
  },
  vat: {
    key: "vat",
    accent: "oklch(0.491 0.27 292.581)",
    soft: "oklch(0.969 0.016 293.756)",
    ink: "oklch(0.432 0.232 292.759)",
    icon: Receipt,
  },
  "ad-cost-calculator": {
    key: "ad-cost-calculator",
    accent: "oklch(0.514 0.222 16.935)",
    soft: "oklch(0.969 0.015 12.422)",
    ink: "oklch(0.455 0.188 13.697)",
    icon: Calculator,
  },
  keyword: {
    key: "keyword",
    accent: "oklch(0.511 0.096 186.391)",
    soft: "oklch(0.984 0.014 180.72)",
    ink: "oklch(0.437 0.078 188.216)",
    icon: Search,
  },
  area: {
    key: "area",
    accent: "oklch(0.457 0.24 277.023)",
    soft: "oklch(0.962 0.018 272.314)",
    ink: "oklch(0.398 0.195 277.366)",
    icon: MapPin,
  },
};

export function themeForPath(path: string): ToolTheme | null {
  const last = path.split("/").filter(Boolean).pop() ?? "";
  return TOOL_THEMES[last] ?? null;
}

// 하위 요소가 var(--tool-accent) 등으로 쓸 수 있게 CSS 변수로 내려준다
export function themeVars(t: ToolTheme | null): CSSProperties | undefined {
  if (!t) return undefined;
  return { "--tool-accent": t.accent, "--tool-soft": t.soft, "--tool-ink": t.ink } as CSSProperties;
}
