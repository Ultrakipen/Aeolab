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
  Video,
  Palette,
  BedDouble,
  // 25개 평면 카테고리용 추가 아이콘
  UtensilsCrossed,
  Coffee,
  Croissant,
  Wine,
  Scissors,
  Stethoscope,
  Pill,
  Dumbbell,
  PersonStanding,
  PawPrint,
  BookOpen,
  Scale,
  Building2,
  Sofa,
  Car,
  WashingMachine,
  Shirt,
  Film,
  Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface CategoryIconConfig {
  Icon: LucideIcon
  bg: string
  text: string
  border: string
}

export const CATEGORY_ICON_MAP: Record<string, CategoryIconConfig> = {
  // 13개 그룹 키 (기존 — 하위 호환 유지)
  food:          { Icon: Utensils,      bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  health:        { Icon: HeartPulse,    bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-red-200'    },
  education:     { Icon: GraduationCap, bg: 'bg-blue-100',   text: 'text-blue-600',   border: 'border-blue-200'   },
  professional:  { Icon: Briefcase,     bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },
  beauty:        { Icon: Sparkles,      bg: 'bg-pink-100',   text: 'text-pink-600',   border: 'border-pink-200'   },
  shopping:      { Icon: ShoppingBag,   bg: 'bg-emerald-100',text: 'text-emerald-600',border: 'border-emerald-200'},
  living:        { Icon: Wrench,        bg: 'bg-amber-100',  text: 'text-amber-600',  border: 'border-amber-200'  },
  culture:       { Icon: Music2,        bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  photo:         { Icon: Camera,        bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  video:         { Icon: Video,         bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-red-200'    },
  design:        { Icon: Palette,       bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  accommodation: { Icon: BedDouble,     bg: 'bg-teal-100',   text: 'text-teal-600',   border: 'border-teal-200'   },
  it:            { Icon: Briefcase,     bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },

  // 25개 평면 키 (RegisterBusinessForm + trial — 단일 진실 소스)
  restaurant: { Icon: UtensilsCrossed, bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  cafe:       { Icon: Coffee,          bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200'  },
  bakery:     { Icon: Croissant,       bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  bar:        { Icon: Wine,            bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },

  nail:       { Icon: Sparkles,        bg: 'bg-rose-100',   text: 'text-rose-600',   border: 'border-rose-200'   },
  medical:    { Icon: Stethoscope,     bg: 'bg-blue-100',   text: 'text-blue-600',   border: 'border-blue-200'   },
  pharmacy:   { Icon: Pill,            bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200'  },
  fitness:    { Icon: Dumbbell,        bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-red-200'    },
  yoga:       { Icon: PersonStanding,  bg: 'bg-teal-100',   text: 'text-teal-600',   border: 'border-teal-200'   },

  pet:        { Icon: PawPrint,        bg: 'bg-lime-100',   text: 'text-lime-700',   border: 'border-lime-200'   },

  tutoring:   { Icon: GraduationCap,   bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },

  legal:      { Icon: Scale,           bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },
  realestate: { Icon: Building2,       bg: 'bg-sky-100',    text: 'text-sky-700',    border: 'border-sky-200'    },
  interior:   { Icon: Sofa,            bg: 'bg-stone-100',  text: 'text-stone-700',  border: 'border-stone-200'  },
  auto:       { Icon: Car,             bg: 'bg-zinc-100',   text: 'text-zinc-700',   border: 'border-zinc-200'   },
  cleaning:   { Icon: WashingMachine,  bg: 'bg-cyan-100',   text: 'text-cyan-700',   border: 'border-cyan-200'   },

  fashion:    { Icon: Shirt,           bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-200'},

  // sub-aliases inside design/photo/video already covered by group keys

  other:      { Icon: Store,           bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200'   },
}
