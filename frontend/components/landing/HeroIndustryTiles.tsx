"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UtensilsCrossed,
  Coffee,
  Scissors,
  Stethoscope,
  BookOpen,
  ShoppingBag,
  Dumbbell,
  Plus,
  X,
} from "lucide-react";
import { trackTrialStart } from "@/lib/analytics";
import { getUserGroup, GROUP_MESSAGES } from "@/lib/userGroup";
import type { LucideIcon } from "lucide-react";

interface Tile {
  value: string;
  label: string;
  Icon: LucideIcon;
  color: string;
}

const TILES: Tile[] = [
  { value: "restaurant", label: "음식점",  Icon: UtensilsCrossed, color: "text-orange-500" },
  { value: "cafe",       label: "카페",    Icon: Coffee,          color: "text-amber-600" },
  { value: "beauty",     label: "미용실",  Icon: Scissors,        color: "text-pink-500"  },
  { value: "medical",    label: "병원",    Icon: Stethoscope,     color: "text-red-500"   },
  { value: "education",  label: "학원",    Icon: BookOpen,        color: "text-blue-500"  },
  { value: "shopping",   label: "쇼핑몰",  Icon: ShoppingBag,     color: "text-purple-500"},
  { value: "fitness",    label: "헬스장",  Icon: Dumbbell,        color: "text-green-600" },
];

interface Props {
  variant?: "default" | "compact";
}

export default function HeroIndustryTiles({ variant = "default" }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isFranchise, setIsFranchise] = useState(false);

  const goTrial = (industry?: string) => {
    trackTrialStart(industry);
    router.push(industry ? `/trial?industry=${industry}` : "/trial");
  };

  const handleTileClick = (value: string) => {
    if (selected === value) {
      // 같은 타일 재클릭 → 트라이얼 이동
      goTrial(value);
    } else {
      setSelected(value);
      setIsFranchise(false);
    }
  };

  const isCompact = variant === "compact";

  const group = selected ? getUserGroup(selected, isFranchise) : null;
  const msg = group ? GROUP_MESSAGES[group] : null;
  const selectedTile = TILES.find((t) => t.value === selected);

  return (
    <div className="w-full max-w-2xl mx-auto lg:mx-0">
      <div className="grid grid-cols-4 gap-2">
        {TILES.map(({ value, label, Icon, color }) => {
          const active = selected === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleTileClick(value)}
              aria-label={`${label} 무료 진단 시작`}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${
                isCompact
                  ? active
                    ? "bg-white/30 border-white/60 text-white"
                    : "bg-white/10 hover:bg-white/20 border-white/25 text-white"
                  : active
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-white hover:border-blue-300 hover:shadow-sm hover:bg-blue-50/30 border-gray-200"
              }`}
            >
              <span className={isCompact ? "text-white/80" : active ? "text-white" : color}>
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className={`text-sm font-medium leading-none ${
                isCompact ? "text-white" : active ? "text-white" : "text-gray-700"
              }`}>
                {label}
              </span>
            </button>
          );
        })}

        {/* 기타 업종 */}
        <button
          type="button"
          onClick={() => goTrial()}
          aria-label="기타 업종 무료 진단 시작"
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
            isCompact
              ? "bg-white/5 hover:bg-white/15 border-white/20 text-white/70"
              : "bg-gray-50 hover:bg-blue-50/30 hover:border-blue-200 border-gray-200 text-gray-500"
          }`}
        >
          <span className={isCompact ? "text-white/60" : "text-gray-400"}>
            <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium leading-none">기타</span>
        </button>
      </div>

      {/* 그룹별 약속 인라인 패널 */}
      {selected && msg && (
        <div className={`mt-3 rounded-xl border px-4 py-3 ${
          isCompact ? "bg-white/10 border-white/25 text-white" : "bg-white border-gray-200 shadow-sm"
        }`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                isCompact ? "bg-white/20 text-white" : msg.badgeColor
              }`}>
                {msg.badge}
              </span>
              {selectedTile && (
                <span className={`text-sm ${isCompact ? "text-white/70" : "text-gray-500"}`}>
                  {selectedTile.label}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="닫기"
              className={`shrink-0 mt-0.5 ${isCompact ? "text-white/60 hover:text-white" : "text-gray-400 hover:text-gray-600"}`}
            >
              <X size={16} />
            </button>
          </div>

          <p className={`text-sm font-semibold leading-snug break-keep mb-1 ${
            isCompact ? "text-white" : "text-gray-900"
          }`}>
            {msg.headline}
          </p>
          <p className={`text-sm leading-relaxed break-keep ${
            isCompact ? "text-white/80" : "text-gray-600"
          }`}>
            {msg.sub}
          </p>

          {/* 프랜차이즈 체크박스 */}
          <label className={`flex items-center gap-2 mt-3 cursor-pointer w-fit ${
            isCompact ? "text-white/80" : "text-gray-600"
          }`}>
            <input
              type="checkbox"
              checked={isFranchise}
              onChange={(e) => setIsFranchise(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">프랜차이즈 가맹점입니다</span>
          </label>

          {/* CTA */}
          <button
            type="button"
            onClick={() => goTrial(selected)}
            className={`mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
              isCompact
                ? "bg-white text-blue-700 hover:bg-blue-50"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {selectedTile?.label} 무료 진단 시작 →
          </button>
        </div>
      )}
    </div>
  );
}
