import {
  Utensils,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Sparkles,
  ShoppingBag,
  Wrench,
  Music2,
  Camera,
  BedDouble,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface CategoryIconConfig {
  Icon: LucideIcon
  bg: string
  text: string
  border: string
}

export const CATEGORY_ICON_MAP: Record<string, CategoryIconConfig> = {
  food:          { Icon: Utensils,      bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  health:        { Icon: HeartPulse,    bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-red-200'    },
  education:     { Icon: GraduationCap, bg: 'bg-blue-100',   text: 'text-blue-600',   border: 'border-blue-200'   },
  professional:  { Icon: Briefcase,     bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },
  beauty:        { Icon: Sparkles,      bg: 'bg-pink-100',   text: 'text-pink-600',   border: 'border-pink-200'   },
  shopping:      { Icon: ShoppingBag,   bg: 'bg-emerald-100',text: 'text-emerald-600',border: 'border-emerald-200'},
  living:        { Icon: Wrench,        bg: 'bg-amber-100',  text: 'text-amber-600',  border: 'border-amber-200'  },
  culture:       { Icon: Music2,        bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  media:         { Icon: Camera,        bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  accommodation: { Icon: BedDouble,     bg: 'bg-teal-100',   text: 'text-teal-600',   border: 'border-teal-200'   },
}
