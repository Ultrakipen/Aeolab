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
  // 33개 확장 카테고리 추가 아이콘
  Droplets,
  Hand,
  Calculator,
  Flower2,
  Package,
  Baby,
  Hammer,
  // 43개 확장 카테고리 추가 아이콘 (v5.6)
  Waves,
  Flame,
  Target,
  ChefHat,
  Puzzle,
  // 48개 확장 카테고리 추가 아이콘 (v5.7)
  Gem,
  Music,
  Tag,
  Gamepad2,
  // 62개 확장 카테고리 추가 아이콘 (v5.8 — 14개 신규)
  Smile,
  Leaf,
  Eye,
  Pen,
  Shield,
  Mountain,
  Pencil,
  Heart,
  Smartphone,
  PenLine,
  Mic,
  Dices,
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

  // 8개 신규 카테고리 (v5.5 — 33개 확장)
  skincare:   { Icon: Droplets,        bg: 'bg-sky-100',    text: 'text-sky-600',    border: 'border-sky-200'    },
  massage:    { Icon: Hand,            bg: 'bg-teal-100',   text: 'text-teal-600',   border: 'border-teal-200'   },
  study:      { Icon: BookOpen,        bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  accounting: { Icon: Calculator,      bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },
  flower:     { Icon: Flower2,         bg: 'bg-pink-100',   text: 'text-pink-600',   border: 'border-pink-200'   },
  laundry:    { Icon: Package,         bg: 'bg-cyan-100',   text: 'text-cyan-600',   border: 'border-cyan-200'   },
  kids:       { Icon: Baby,            bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  workshop:   { Icon: Hammer,          bg: 'bg-stone-100',  text: 'text-stone-600',  border: 'border-stone-200'  },

  // 10개 신규 카테고리 (v5.6 — 43개 확장)
  dance:        { Icon: PersonStanding, bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  golf:         { Icon: Target,         bg: 'bg-lime-100',   text: 'text-lime-700',   border: 'border-lime-200'   },
  swim:         { Icon: Waves,          bg: 'bg-cyan-100',   text: 'text-cyan-600',   border: 'border-cyan-200'   },
  jjimjil:      { Icon: Flame,          bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  music_lesson: { Icon: Music2,         bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  cooking:      { Icon: ChefHat,        bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200'  },
  escape:       { Icon: Puzzle,         bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200'  },

  // 5개 신규 카테고리 (v5.7 — 48개 확장, 쌍 분리)
  spa:          { Icon: Gem,            bg: 'bg-fuchsia-100',text: 'text-fuchsia-600',border: 'border-fuchsia-200'},
  ballet:       { Icon: PersonStanding, bg: 'bg-pink-100',   text: 'text-pink-600',   border: 'border-pink-200'   },
  music_class:  { Icon: Music,          bg: 'bg-sky-100',    text: 'text-sky-600',    border: 'border-sky-200'    },
  clothing:     { Icon: Tag,            bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200'  },
  experience:   { Icon: Gamepad2,       bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },

  // 14개 신규 카테고리 (v5.8 — 62개 확장)
  dental:            { Icon: Smile,      bg: 'bg-cyan-100',    text: 'text-cyan-600',    border: 'border-cyan-200'    },
  oriental_medicine: { Icon: Leaf,       bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-200'   },
  optics:            { Icon: Eye,        bg: 'bg-indigo-100',  text: 'text-indigo-600',  border: 'border-indigo-200'  },
  semi_permanent:    { Icon: Pen,        bg: 'bg-rose-100',    text: 'text-rose-600',    border: 'border-rose-200'    },
  martial_arts:      { Icon: Shield,     bg: 'bg-zinc-100',    text: 'text-zinc-700',    border: 'border-zinc-200'    },
  climbing:          { Icon: Mountain,   bg: 'bg-stone-100',   text: 'text-stone-700',   border: 'border-stone-200'   },
  art_class:         { Icon: Pencil,     bg: 'bg-purple-100',  text: 'text-purple-600',  border: 'border-purple-200'  },
  childcare:         { Icon: Heart,      bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-200'  },
  car_wash:          { Icon: Droplets,   bg: 'bg-blue-100',    text: 'text-blue-600',    border: 'border-blue-200'    },
  electronics_repair:{ Icon: Smartphone, bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200'   },
  footwear:          { Icon: Store,      bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200'   },
  stationery:        { Icon: PenLine,    bg: 'bg-orange-100',  text: 'text-orange-600',  border: 'border-orange-200'  },
  norebang:          { Icon: Mic,        bg: 'bg-violet-100',  text: 'text-violet-600',  border: 'border-violet-200'  },
  billiards:         { Icon: Dices,      bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },

  // sub-aliases inside design/photo/video already covered by group keys

  other:      { Icon: Store,           bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200'   },
}
