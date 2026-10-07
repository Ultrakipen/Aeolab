import type { LucideIcon } from "lucide-react";

const TONES = {
  blue: "bg-blue-50 text-blue-600",
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
  navy: "bg-[#0E1A3A] text-white",
} as const;

const SIZES = {
  sm: { box: "w-8 h-8 rounded-lg", icon: "w-4 h-4" },
  md: { box: "w-10 h-10 rounded-xl", icon: "w-5 h-5" },
  lg: { box: "w-12 h-12 rounded-2xl", icon: "w-6 h-6" },
} as const;

/**
 * 이모지 대체용 아이콘 타일 (2026-10-07). 장식용이므로 aria-hidden.
 * 이모지 대신 lucide 아이콘을 둥근 색 배경에 넣어 모든 기기에서 같은 모양으로 보이게 한다.
 */
export function IconTile({
  icon: Icon,
  tone = "blue",
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${s.box} ${TONES[tone]} ${className}`} aria-hidden="true">
      <Icon className={s.icon} strokeWidth={2} />
    </span>
  );
}
