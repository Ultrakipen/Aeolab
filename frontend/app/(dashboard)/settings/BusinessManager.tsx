"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSafeSession } from "@/lib/supabase/client";
import {
  UtensilsCrossed, Coffee, Croissant, Wine,
  Scissors, Sparkles, Stethoscope, Pill, Dumbbell, PersonStanding,
  PawPrint, BookOpen, GraduationCap,
  Scale, Building2, Sofa, Car, WashingMachine,
  ShoppingBag, Shirt, BedDouble, Store,
  Camera, Film, Palette, RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

import { CATEGORY_LABEL } from "@/lib/categories";

// 업종별 키워드 추천 목록 (AI 검색 쿼리에 사용됨)
const KW_SUGGESTIONS: Record<string, string[]> = {
  restaurant: ["한식","중식","일식","양식","고기집","국밥","분식","배달","야식","점심특선","가성비"],
  cafe:       ["카페","커피","디저트","케이크","브런치","베이커리","아이스크림"],
  bakery:     ["베이커리","빵집","케이크","마카롱","쿠키","주문제작케이크"],
  bar:        ["술집","포차","이자카야","맥주","칵테일","야장","혼술"],
  beauty:     ["미용실","헤어샵","펌","염색","커트","드라이","클리닉"],
  nail:       ["네일샵","젤네일","네일아트","발관리","피부관리","왁싱"],
  medical:    ["내과","소아과","외과","정형외과","피부과","성형외과","한의원"],
  pharmacy:   ["약국","처방전","건강기능식품","영양제"],
  fitness:    ["헬스장","PT","개인트레이닝","체중감량","근력운동"],
  yoga:       ["요가","필라테스","스트레칭","명상","다이어트"],
  pet:        ["동물병원","애견미용","펫샵","강아지","고양이","미용"],
  education:  ["학원","영어","수학","코딩","음악","미술","태권도"],
  tutoring:   ["과외","개인교습","온라인강의","입시","내신"],
  legal:      ["법무사","세무사","변호사","노무사","상담"],
  realestate: ["부동산","아파트","원룸","전세","매매","임대"],
  interior:   ["인테리어","리모델링","가구","벽지","바닥재"],
  auto:       ["자동차정비","카센터","타이어","오일교환","차량관리"],
  cleaning:   ["청소","이사청소","에어컨청소","소독","입주청소"],
  shopping:   ["쇼핑몰","온라인쇼핑","잡화","생활용품"],
  fashion:    ["패션","의류","명품","빈티지","코디"],
  accommodation:["펜션","숙박","민박","독채","풀빌라"],
  photo:      ["웨딩스냅","돌스냅","가족사진","프로필사진","증명사진","기업사진"],
  video:      ["영상촬영","드론촬영","유튜브","광고영상","행사촬영"],
  design:     ["디자인","인쇄","명함","간판","로고","현수막"],
  other:      [],
};

// ── 업종 아이콘 그리드 데이터 ──────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed, Coffee, Croissant, Wine,
  Scissors, Sparkles, Stethoscope, Pill, Dumbbell, PersonStanding,
  PawPrint, BookOpen, GraduationCap,
  Scale, Building2, Sofa, Car, WashingMachine,
  ShoppingBag, Shirt, BedDouble, Store,
  Camera, Film, Palette,
};

const COLOR_MAP: Record<string, { bg: string; icon: string; border: string; ring: string; gradient: string }> = {
  orange:  { bg: "bg-orange-50",  icon: "text-orange-500",  border: "border-orange-300",  ring: "ring-orange-300",  gradient: "from-orange-400 to-rose-500" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   border: "border-amber-300",   ring: "ring-amber-300",   gradient: "from-amber-400 to-orange-500" },
  yellow:  { bg: "bg-yellow-50",  icon: "text-yellow-600",  border: "border-yellow-300",  ring: "ring-yellow-300",  gradient: "from-yellow-400 to-amber-500" },
  purple:  { bg: "bg-purple-50",  icon: "text-purple-500",  border: "border-purple-300",  ring: "ring-purple-300",  gradient: "from-purple-500 to-violet-600" },
  pink:    { bg: "bg-pink-50",    icon: "text-pink-500",    border: "border-pink-300",    ring: "ring-pink-300",    gradient: "from-pink-400 to-rose-500" },
  rose:    { bg: "bg-rose-50",    icon: "text-rose-500",    border: "border-rose-300",    ring: "ring-rose-300",    gradient: "from-rose-400 to-pink-500" },
  blue:    { bg: "bg-blue-50",    icon: "text-blue-500",    border: "border-blue-300",    ring: "ring-blue-300",    gradient: "from-blue-500 to-indigo-600" },
  green:   { bg: "bg-green-50",   icon: "text-green-600",   border: "border-green-300",   ring: "ring-green-300",   gradient: "from-green-400 to-emerald-500" },
  red:     { bg: "bg-red-50",     icon: "text-red-500",     border: "border-red-300",     ring: "ring-red-300",     gradient: "from-red-400 to-rose-500" },
  teal:    { bg: "bg-teal-50",    icon: "text-teal-600",    border: "border-teal-300",    ring: "ring-teal-300",    gradient: "from-teal-400 to-cyan-500" },
  lime:    { bg: "bg-lime-50",    icon: "text-lime-600",    border: "border-lime-300",    ring: "ring-lime-300",    gradient: "from-lime-400 to-green-500" },
  indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-500",  border: "border-indigo-300",  ring: "ring-indigo-300",  gradient: "from-indigo-500 to-blue-600" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-500",  border: "border-violet-300",  ring: "ring-violet-300",  gradient: "from-violet-500 to-purple-600" },
  slate:   { bg: "bg-slate-50",   icon: "text-slate-500",   border: "border-slate-300",   ring: "ring-slate-300",   gradient: "from-slate-500 to-gray-600" },
  sky:     { bg: "bg-sky-50",     icon: "text-sky-500",     border: "border-sky-300",     ring: "ring-sky-300",     gradient: "from-sky-400 to-blue-500" },
  stone:   { bg: "bg-stone-50",   icon: "text-stone-500",   border: "border-stone-300",   ring: "ring-stone-300",   gradient: "from-stone-400 to-slate-500" },
  zinc:    { bg: "bg-zinc-50",    icon: "text-zinc-500",    border: "border-zinc-300",    ring: "ring-zinc-300",    gradient: "from-zinc-400 to-slate-500" },
  cyan:    { bg: "bg-cyan-50",    icon: "text-cyan-600",    border: "border-cyan-300",    ring: "ring-cyan-300",    gradient: "from-cyan-400 to-teal-500" },
  fuchsia: { bg: "bg-fuchsia-50", icon: "text-fuchsia-500", border: "border-fuchsia-300", ring: "ring-fuchsia-300", gradient: "from-fuchsia-500 to-pink-600" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-300", ring: "ring-emerald-300", gradient: "from-emerald-400 to-teal-500" },
  gray:    { bg: "bg-gray-50",    icon: "text-gray-500",    border: "border-gray-300",    ring: "ring-gray-300",    gradient: "from-gray-400 to-slate-500" },
};

const EDIT_CATEGORIES = [
  // 음식·음료
  { value: "restaurant", label: "음식점",       icon: "UtensilsCrossed", color: "orange" },
  { value: "cafe",       label: "카페",          icon: "Coffee",          color: "amber"  },
  { value: "bakery",     label: "베이커리",      icon: "Croissant",       color: "yellow" },
  { value: "bar",        label: "술집·바",       icon: "Wine",            color: "purple" },
  // 뷰티·건강
  { value: "beauty",     label: "미용·헤어",     icon: "Scissors",        color: "pink"   },
  { value: "nail",       label: "네일·피부",     icon: "Sparkles",        color: "rose"   },
  { value: "medical",    label: "병원·의원",     icon: "Stethoscope",     color: "blue"   },
  { value: "pharmacy",   label: "약국",          icon: "Pill",            color: "green"  },
  { value: "fitness",    label: "헬스·피트니스", icon: "Dumbbell",        color: "red"    },
  { value: "yoga",       label: "요가·필라테스", icon: "PersonStanding",  color: "teal"   },
  // 반려동물
  { value: "pet",        label: "반려동물",      icon: "PawPrint",        color: "lime"   },
  // 교육
  { value: "education",  label: "학원·교육",     icon: "BookOpen",        color: "indigo" },
  { value: "tutoring",   label: "과외·튜터링",   icon: "GraduationCap",   color: "violet" },
  // 전문직·서비스
  { value: "legal",      label: "법률·세무",     icon: "Scale",           color: "slate"  },
  { value: "realestate", label: "부동산",        icon: "Building2",       color: "sky"    },
  { value: "interior",   label: "인테리어",      icon: "Sofa",            color: "stone"  },
  { value: "auto",       label: "자동차·정비",   icon: "Car",             color: "zinc"   },
  { value: "cleaning",   label: "청소·세탁",     icon: "WashingMachine",  color: "cyan"   },
  // 쇼핑
  { value: "shopping",   label: "쇼핑몰",        icon: "ShoppingBag",     color: "fuchsia"},
  { value: "fashion",    label: "의류·패션",     icon: "Shirt",           color: "emerald"},
  // 사진·영상·디자인
  { value: "photo",          label: "사진·영상",     icon: "Camera",   color: "indigo" },
  { value: "video",          label: "영상·드론",     icon: "Film",     color: "red"    },
  { value: "design",         label: "디자인·인쇄",   icon: "Palette",  color: "violet" },
  // 숙박
  { value: "accommodation",  label: "숙박·펜션",     icon: "BedDouble", color: "blue"  },
  // 기타 (하위 호환: categories.ts 그룹 값)
  { value: "food",        label: "음식·식음료",   icon: "UtensilsCrossed", color: "orange" },
  { value: "health",      label: "의료·건강",     icon: "Stethoscope",     color: "blue"   },
  { value: "professional",label: "전문직",        icon: "Scale",           color: "slate"  },
  { value: "living",      label: "생활서비스",    icon: "WashingMachine",  color: "cyan"   },
  { value: "culture",     label: "문화·여가",     icon: "Palette",         color: "violet" },
  { value: "other",       label: "기타",          icon: "Store",           color: "gray"   },
];

/** 카테고리 값 → 표시용 레이블 (새 분류 우선, 구 분류 fallback) */
function getCategoryLabel(value: string): string {
  const cat = EDIT_CATEGORIES.find((c) => c.value === value);
  if (cat) return cat.label;
  return CATEGORY_LABEL[value] ?? value;
}

// ── 업종 아이콘 그리드 컴포넌트 ───────────────────────────────────────────
interface CategoryGridProps {
  value: string;
  onChange: (val: string) => void;
}

function CategoryIconGrid({ value, onChange }: CategoryGridProps) {
  // 구 분류(food, health 등) 를 쓰는 기존 사업장 → 표시는 하되 새 값 선택 유도
  const displayCategories = EDIT_CATEGORIES.filter(
    (c) => !["food", "health", "professional", "living", "culture"].includes(c.value)
  );
  const legacyGroups = EDIT_CATEGORIES.filter(
    (c) => ["food", "health", "professional", "living", "culture"].includes(c.value)
  );
  const currentIsLegacy = legacyGroups.some((c) => c.value === value);

  return (
    <div className="space-y-2">
      {currentIsLegacy && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          현재 선택된 업종({getCategoryLabel(value)})은 구 분류입니다. 아래에서 세부 업종을 재선택하면 분석 정확도가 높아집니다.
        </p>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {displayCategories.map((cat) => {
          const colors = COLOR_MAP[cat.color] ?? COLOR_MAP.gray;
          const IconComponent = ICON_MAP[cat.icon];
          const selected = value === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => onChange(cat.value)}
              className={[
                "group flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border cursor-pointer",
                "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                selected
                  ? `bg-white ${colors.border} ring-2 ${colors.ring} ring-offset-1 shadow-md`
                  : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50",
              ].join(" ")}
            >
              <div className={[
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                selected
                  ? `bg-gradient-to-br ${colors.gradient} shadow-sm`
                  : `${colors.bg} group-hover:scale-110`,
              ].join(" ")}>
                {IconComponent && (
                  <IconComponent
                    className={`w-5 h-5 transition-colors duration-200 ${selected ? "text-white drop-shadow-sm" : colors.icon}`}
                    strokeWidth={1.6}
                  />
                )}
              </div>
              <span className={`text-xs font-semibold text-center leading-tight transition-colors duration-200 ${selected ? colors.icon : "text-gray-600 group-hover:text-gray-800"}`}>
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

async function getAuthToken(): Promise<string | null> {
  const session = await getSafeSession();
  return session?.access_token ?? null;
}

interface Business {
  id: string;
  name: string;
  category: string;
  region: string;
  address?: string;
  phone?: string;
  website_url?: string;
  blog_url?: string;
  keywords?: string[];
  receipt_review_count?: number;
  visitor_review_count?: number;
  avg_rating?: number;
  naver_place_id?: string;
  google_place_id?: string;
  naver_place_url?: string;
  kakao_place_id?: string;
  is_smart_place?: boolean;
  has_faq?: boolean;
  has_recent_post?: boolean;
  has_intro?: boolean;
  review_sample?: string;
  created_at: string;
}

// ── 행정단위 접미사 제거 ──────────────────────────────────────────────────
function stripRegion(r: string) {
  return r.split(" ")[0].replace(/(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$/, "").trim();
}

// ── 키워드 태그 편집 컴포넌트 ─────────────────────────────────────────────
function KeywordEditor({
  keywords, category, region, onChange,
}: {
  keywords: string[];
  category: string;
  region: string;
  onChange: (kws: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = (KW_SUGGESTIONS[category] ?? []).filter((s) => !keywords.includes(s));
  const displayRegion = stripRegion(region || "");

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    onChange([...keywords, trimmed]);
    setInput("");
    inputRef.current?.focus();
  };

  const removeKeyword = (kw: string) => onChange(keywords.filter((k) => k !== kw));

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addKeyword(input);
    } else if (e.key === "Backspace" && !input && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-800">
          핵심 키워드
          <span className="ml-1.5 text-sm font-normal text-gray-400">AI가 이 키워드로 검색합니다</span>
        </label>
        {keywords.length > 0 && (
          <span className="text-sm text-blue-600 font-medium">{keywords.length}개 등록됨</span>
        )}
      </div>

      {/* 현재 키워드 칩 + 입력 */}
      <div
        className="flex flex-wrap gap-2 min-h-[44px] w-full border border-gray-300 rounded-xl px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full"
          >
            {kw}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeKeyword(kw); }}
              className="ml-0.5 text-blue-200 hover:text-white text-base leading-none"
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={() => { if (input.trim()) addKeyword(input); }}
          placeholder={keywords.length === 0 ? "키워드 입력 후 Enter" : "추가 입력..."}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        />
      </div>
      <p className="text-sm text-gray-400 -mt-1">Enter 또는 쉼표로 추가 · 칩의 ×로 삭제 · Backspace로 마지막 삭제</p>

      {/* 업종별 추천 키워드 */}
      {suggestions.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1.5">추천 키워드 (클릭하여 추가)</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 10).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addKeyword(s)}
                className="px-2.5 py-1 text-sm rounded-full border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI 검색 쿼리 미리보기 */}
      {keywords.length > 0 && (
        <div className="bg-slate-800 rounded-xl px-4 py-3">
          <p className="text-sm text-slate-400 mb-1.5">손님이 AI에게 물어봤을 때 이렇게 검색됩니다</p>
          <div className="space-y-1">
            {keywords.slice(0, 3).map((kw, i) => (
              <p key={kw} className="text-sm font-mono text-slate-200">
                {i === 0 ? "▶" : "·"}{" "}
                &ldquo;{displayRegion} <span className="text-blue-300 font-semibold">{kw}</span> 추천해줘&rdquo;
              </p>
            ))}
            {keywords.length > 3 && (
              <p className="text-sm text-slate-500">+ {keywords.length - 3}개 키워드 더 검색됩니다</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 사업장 데이터 → editForm 초기값 변환 헬퍼 ─────────────────────────────
function bizToForm(biz: Business): Omit<Business, "id" | "created_at"> {
  return {
    name: biz.name,
    category: biz.category,
    region: biz.region,
    address: biz.address ?? "",
    phone: biz.phone ?? "",
    website_url: biz.website_url ?? "",
    blog_url: biz.blog_url ?? "",
    keywords: biz.keywords ?? [],
    receipt_review_count: biz.receipt_review_count ?? 0,
    visitor_review_count: biz.visitor_review_count ?? 0,
    avg_rating: biz.avg_rating ?? 0,
    naver_place_id: biz.naver_place_id ?? "",
    google_place_id: biz.google_place_id ?? "",
    naver_place_url: biz.naver_place_url ?? "",
    kakao_place_id: biz.kakao_place_id ?? "",
    is_smart_place: biz.is_smart_place ?? false,
    has_faq: biz.has_faq ?? false,
    has_recent_post: biz.has_recent_post ?? false,
    has_intro: biz.has_intro ?? false,
    review_sample: biz.review_sample ?? "",
  };
}

interface Props {
  businesses: Business[];
  userId: string;
  autoEdit?: boolean;
  autoEditId?: string | null;
}

export function BusinessManager({ businesses, userId, autoEdit, autoEditId }: Props) {
  const router = useRouter();

  // 탭 초기값: autoEditId → 해당 사업장, 없으면 첫 번째
  const initialBiz = autoEditId
    ? (businesses.find((b) => b.id === autoEditId) ?? businesses[0])
    : businesses[0];

  const [activeTabId, setActiveTabId] = useState<string>(initialBiz?.id ?? "");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [syncingReviews, setSyncingReviews] = useState(false);
  const [syncReviewMsg, setSyncReviewMsg] = useState<string | null>(null);
  const [syncingSmartplace, setSyncingSmartplace] = useState(false);
  const [syncSmartplaceMsg, setSyncSmartplaceMsg] = useState<string | null>(null);

  const [editForm, setEditForm] = useState<Omit<Business, "id" | "created_at">>(() =>
    initialBiz ? bizToForm(initialBiz) : {
      name: "", category: "restaurant", region: "",
      address: "", phone: "", website_url: "", blog_url: "", keywords: [],
      receipt_review_count: 0, visitor_review_count: 0, avg_rating: 0,
      naver_place_id: "", google_place_id: "", naver_place_url: "", kakao_place_id: "",
      is_smart_place: false, has_faq: false, has_recent_post: false,
      has_intro: false, review_sample: "",
    }
  );

  // 현재 활성 탭 사업장 원본 데이터
  const activeBiz = businesses.find((b) => b.id === activeTabId) ?? null;

  // isDirty: editForm과 원본 데이터가 다른지 확인
  const isDirty = activeBiz !== null && (() => {
    const original = bizToForm(activeBiz);
    return JSON.stringify(editForm) !== JSON.stringify(original);
  })();

  // URL 쿼리 파라미터에 현재 탭 동기화 (새로고침 후에도 같은 탭 유지)
  const syncTabToUrl = (bizId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "business");
    url.searchParams.set("biz_id", bizId);
    window.history.replaceState(null, "", url.toString());
  };

  // 탭 전환 핸들러
  const handleTabChange = (bizId: string) => {
    if (bizId === activeTabId) return;
    if (isDirty) {
      if (!confirm("저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?")) return;
    }
    const nextBiz = businesses.find((b) => b.id === bizId);
    if (nextBiz) {
      setActiveTabId(bizId);
      setEditForm(bizToForm(nextBiz));
      setError("");
      setSaveSuccess(false);
      setSyncReviewMsg(null);
      setSyncSmartplaceMsg(null);
      syncTabToUrl(bizId);
    }
  };

  // autoEdit: 페이지 진입 시 사업장 섹션으로 스크롤
  useEffect(() => {
    if (autoEdit) {
      setTimeout(() => {
        document.getElementById("biz-edit-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [autoEdit]);

  const handleSyncReviews = async (bizId: string) => {
    setSyncingReviews(true);
    setSyncReviewMsg(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}/sync-review-stats`, {
        method: "POST",
        headers: {
          "X-User-Id": userId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSyncReviewMsg(data.detail || data.error || "불러오기 실패. 직접 입력해주세요.");
        return;
      }
      setEditForm((prev) => ({
        ...prev,
        visitor_review_count: data.visitor_review_count ?? prev.visitor_review_count,
        receipt_review_count: data.receipt_review_count ?? prev.receipt_review_count,
        avg_rating: data.avg_rating ?? prev.avg_rating,
      }));
      setSyncReviewMsg("✓ 자동으로 불러왔습니다. 저장 버튼을 눌러 반영하세요.");
    } catch {
      setSyncReviewMsg("네트워크 오류. 직접 입력해주세요.");
    } finally {
      setSyncingReviews(false);
    }
  };

  const handleSyncSmartplace = async (bizId: string) => {
    setSyncingSmartplace(true);
    setSyncSmartplaceMsg(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}/sync-smartplace-completeness`, {
        method: "POST",
        headers: {
          "X-User-Id": userId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSyncSmartplaceMsg(data.detail || data.error || "확인 실패. 직접 체크해주세요.");
        return;
      }
      setEditForm((prev) => ({
        ...prev,
        has_faq: data.has_faq ?? prev.has_faq,
        has_recent_post: data.has_recent_post ?? prev.has_recent_post,
        has_intro: data.has_intro ?? prev.has_intro,
      }));
      setSyncSmartplaceMsg("✓ 자동으로 확인했습니다. 저장 버튼을 눌러 반영하세요.");
    } catch {
      setSyncSmartplaceMsg("네트워크 오류. 직접 체크해주세요.");
    } finally {
      setSyncingSmartplace(false);
    }
  };

  const handleSave = async (bizId: string) => {
    setSaving(true);
    setError("");
    try {
      const token = await getAuthToken();
      if (!token) {
        setError("인증 세션이 만료되었습니다. 페이지를 새로고침 후 다시 로그인해 주세요.");
        return;
      }
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editForm,
          keywords: typeof editForm.keywords === "string"
            ? (editForm.keywords as string).split(",").map((k) => k.trim()).filter(Boolean)
            : editForm.keywords,
          // review_count = 방문자 + 영수증 리뷰 합산 (score_engine이 사용하는 필드)
          review_count: (editForm.visitor_review_count ?? 0) + (editForm.receipt_review_count ?? 0),
        }),
      });
      if (!res.ok) {
        let detail = "저장 중 오류가 발생했습니다.";
        try {
          const err = await res.json();
          if (typeof err?.detail === "string") detail = err.detail;
        } catch {
          // JSON 파싱 실패 시 기본 메시지 유지
        }
        setError(detail);
        return;
      }
      // 저장 성공 피드백 (2초 후 자동 해제)
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      // activeTabId 유지 — router.refresh() 후에도 현재 탭 유지
      syncTabToUrl(bizId);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bizId: string) => {
    setDeleting(true);
    setError("");
    try {
      const token = await getAuthToken();
      if (!token) {
        setError("인증 세션이 만료되었습니다. 페이지를 새로고침 후 다시 로그인해 주세요.");
        return;
      }
      const res = await fetch(`${BACKEND}/api/businesses/${bizId}`, {
        method: "DELETE",
        headers: {
          "X-User-Id": userId,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        let detail = "삭제 중 오류가 발생했습니다.";
        try {
          const err = await res.json();
          if (typeof err?.detail === "string") detail = err.detail;
        } catch {
          // JSON 파싱 실패 시 기본 메시지 유지
        }
        setError(detail);
        return;
      }
      setDeleteId(null);
      // 삭제된 탭이 현재 활성 탭이면 남은 첫 번째 사업장으로 이동
      const remaining = businesses.filter((b) => b.id !== bizId);
      if (activeTabId === bizId && remaining.length > 0) {
        const nextBiz = remaining[0];
        setActiveTabId(nextBiz.id);
        setEditForm(bizToForm(nextBiz));
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  if (businesses.length === 0) return null;

  return (
    <div id="biz-edit-section">
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {/* ── 탭 바 ──────────────────────────────────────────────────── */}
      <div className="flex items-end gap-0 overflow-x-auto scrollbar-hide border-b border-gray-200">
        {businesses.map((biz, idx) => {
          const cat = EDIT_CATEGORIES.find((c) => c.value === biz.category);
          const colors = cat ? (COLOR_MAP[cat.color] ?? COLOR_MAP.gray) : COLOR_MAP.gray;
          const IconComp = cat ? ICON_MAP[cat.icon] : null;
          const isActive = biz.id === activeTabId;
          // 첫 번째 탭이 활성이면 좌상단 모서리 둥글기 제거
          const roundedClass = isActive && idx === 0
            ? "rounded-t-xl rounded-tl-none"
            : "rounded-t-xl";
          return (
            <button
              key={biz.id}
              type="button"
              onClick={() => handleTabChange(biz.id)}
              className={[
                "flex items-center gap-1.5 px-3 py-2.5 shrink-0 border-t border-l border-r transition-colors",
                roundedClass,
                isActive
                  ? "border-blue-600 border-b-2 border-b-white -mb-px bg-white text-blue-700 font-semibold z-10"
                  : "border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700 hover:bg-gray-100",
              ].join(" ")}
            >
              {/* 아이콘: 항상 표시 */}
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isActive ? colors.bg : "bg-transparent"}`}>
                {IconComp
                  ? <IconComp className={`w-3.5 h-3.5 ${isActive ? colors.icon : "text-gray-400"}`} strokeWidth={1.8} />
                  : <span className="text-sm">{biz.category.slice(0, 1).toUpperCase()}</span>
                }
              </div>
              {/* 이름: 모바일에서도 표시 (최대 8자 truncate) */}
              <span className="text-sm max-w-[7rem] truncate">{biz.name}</span>
              {/* 미저장 변경 표시 점 */}
              {isActive && isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="저장되지 않은 변경사항" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── 활성 탭 콘텐츠 ─────────────────────────────────────────── */}
      {activeBiz && (
        <div className="border border-t-0 border-gray-200 rounded-b-xl rounded-tr-xl overflow-hidden shadow-sm">
          {/* 사업장 헤더 (활성 탭만) */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              {(() => {
                const cat = EDIT_CATEGORIES.find((c) => c.value === activeBiz.category);
                const colors = cat ? (COLOR_MAP[cat.color] ?? COLOR_MAP.gray) : COLOR_MAP.gray;
                const IconComp = cat ? ICON_MAP[cat.icon] : null;
                return (
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                    {IconComp
                      ? <IconComp className={`w-5 h-5 ${colors.icon}`} strokeWidth={1.6} />
                      : <span className="text-base">{activeBiz.category.slice(0, 1).toUpperCase()}</span>
                    }
                  </div>
                );
              })()}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{activeBiz.name}</div>
                <div className="text-sm text-gray-400 truncate">
                  {activeBiz.region} · {getCategoryLabel(activeBiz.category)} · {formatDate(activeBiz.created_at)}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setDeleteId(activeBiz.id); setError(""); }}
              className="shrink-0 ml-2 text-sm px-3 py-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
            >
              삭제
            </button>
          </div>

          {/* 삭제 확인 패널 */}
          {deleteId === activeBiz.id && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-4">
              <p className="text-sm text-red-700 mb-3">
                <strong>{activeBiz.name}</strong>을(를) 삭제하시겠습니까?<br />
                <span className="text-sm text-red-500">관련 스캔 기록, 경쟁사 데이터가 모두 비활성화됩니다.</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(activeBiz.id)}
                  disabled={deleting}
                  className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {deleting ? "삭제 중..." : "삭제 확인"}
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 수정 폼 — 탭 내에서 항상 펼쳐진 상태 */}
          <div className="bg-gray-50 px-4 py-5 space-y-4">
            {/* 사업장 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사업장 이름</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* 업종 아이콘 그리드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">업종 선택</label>
              <CategoryIconGrid
                value={editForm.category}
                onChange={(val) => setEditForm({ ...editForm, category: val })}
              />
            </div>
            {/* 지역 / 전화 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">지역 (구/동)</label>
                <input
                  value={editForm.region}
                  onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">전화번호</label>
                <input
                  value={editForm.phone ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">주소</label>
              <input
                value={editForm.address ?? ""}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">웹사이트</label>
              <input
                value={editForm.website_url ?? ""}
                onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                블로그 주소
                <span className="ml-1 font-normal text-gray-400 text-sm">(선택)</span>
              </label>
              <input
                value={editForm.blog_url ?? ""}
                onChange={(e) => setEditForm({ ...editForm, blog_url: e.target.value })}
                placeholder="https://blog.naver.com/내계정 또는 티스토리 주소"
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  editForm.blog_url && !(editForm.blog_url.startsWith('http://') || editForm.blog_url.startsWith('https://'))
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-300'
                }`}
              />
              {editForm.blog_url && !(editForm.blog_url.startsWith('http://') || editForm.blog_url.startsWith('https://')) && (
                <p className="text-sm text-red-500 mt-1">http:// 또는 https://로 시작하는 주소를 입력해주세요.</p>
              )}
              <p className="text-sm text-gray-400 mt-1">
                블로그 주소를 등록하면 가이드 페이지에서 AI 브리핑 최적화 진단을 받을 수 있습니다.
              </p>
            </div>
            {/* 네이버 스마트플레이스 ID + URL + 카카오 */}
            <div className="bg-gray-100 rounded-xl px-4 py-3 space-y-3">
              <p className="text-sm font-semibold text-gray-700">플랫폼 등록 정보 <span className="font-normal text-gray-400">(선택)</span></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  네이버 스마트플레이스 ID
                </label>
                <input
                  value={editForm.naver_place_id ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, naver_place_id: e.target.value })}
                  placeholder="예: 12345678"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-400 mt-1">예: place.naver.com/place/<strong className="text-gray-500">12345678</strong> → 12345678</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  네이버 플레이스 URL
                </label>
                <input
                  value={editForm.naver_place_url ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, naver_place_url: e.target.value })}
                  placeholder="예: https://map.naver.com/p/entry/place/12345678"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-400 mt-1">입력 시 FAQ·소식·소개글 등록 여부를 스캔 때 자동으로 확인합니다.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  구글 Place ID
                </label>
                <input
                  value={editForm.google_place_id ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, google_place_id: e.target.value })}
                  placeholder="예: ChIJN1t_..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-400 mt-1">Google 지도 → 공유 → "장소 삽입"에서 확인 · 등록 시 AI 노출 점수 +10점</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카카오맵 Place ID
                </label>
                <input
                  value={editForm.kakao_place_id ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, kakao_place_id: e.target.value })}
                  placeholder="예: 1234567890"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-400 mt-1">카카오맵 주소창 맨 끝 숫자 (예: map.kakao.com/장소/<strong className="text-gray-500">1234567890</strong>)</p>
              </div>
            </div>
            {/* ── 핵심 키워드 편집 ─────────────────────────────── */}
            <KeywordEditor
              keywords={Array.isArray(editForm.keywords) ? editForm.keywords : []}
              category={editForm.category}
              region={editForm.region}
              onChange={(kws) => setEditForm({ ...editForm, keywords: kws })}
            />
            {/* 네이버 리뷰 현황 — 점수에 반영됨 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-3">
              <div>
                <div className="text-sm font-semibold text-amber-800">네이버 리뷰 현황</div>
                <div className="text-sm text-amber-700 mt-0.5">리뷰 수·별점이 AI 노출 점수(리뷰 품질 20%)에 반영됩니다</div>
              </div>

              {/* 확인 방법 안내 */}
              <div className="bg-white border border-amber-200 rounded-lg px-3 py-2.5 space-y-1.5">
                <div className="text-sm font-semibold text-amber-800">리뷰 수 확인 방법</div>
                <ol className="text-sm text-amber-700 space-y-1 pl-1">
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold text-amber-500">1.</span><span>네이버 앱 또는 PC에서 <strong>내 가게 이름</strong> 검색</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold text-amber-500">2.</span><span>플레이스 카드 하단 <strong>"리뷰 N개"</strong> 탭 클릭</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold text-amber-500">3.</span><span><strong>영수증 리뷰</strong>(네이버페이 결제 후 작성)와 <strong>방문자 리뷰</strong>(일반 리뷰) 수 각각 확인</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 font-bold text-amber-500">4.</span><span>별점은 리뷰 탭 상단 <strong>평균 별점</strong> 숫자 확인</span></li>
                </ol>
                <a
                  href="https://smartplace.naver.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
                >
                  → 네이버 스마트플레이스 관리 바로가기 ↗
                </a>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    영수증 리뷰 수
                    <span className="block font-normal text-gray-400 text-sm">네이버페이 결제 후 작성</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.receipt_review_count ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, receipt_review_count: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    방문자 리뷰 수
                    <span className="block font-normal text-gray-400 text-sm">일반 방문자 작성</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.visitor_review_count ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, visitor_review_count: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    평균 별점
                    <span className="block font-normal text-gray-400 text-sm">0.0 ~ 5.0</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={editForm.avg_rating ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, avg_rating: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                <span className="text-amber-700">
                  총 <strong>{(editForm.visitor_review_count ?? 0) + (editForm.receipt_review_count ?? 0)}개</strong> · 별점 <strong>{(editForm.avg_rating ?? 0).toFixed(1)}점</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleSyncReviews(activeBiz.id)}
                  disabled={syncingReviews || !editForm.naver_place_id}
                  title={!editForm.naver_place_id ? "네이버 플레이스 ID를 먼저 등록해주세요" : undefined}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {syncingReviews ? (
                    <>
                      <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      불러오는 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} />
                      네이버에서 자동 불러오기
                    </>
                  )}
                </button>
              </div>
              {syncReviewMsg && (
                <p className={`text-sm mt-1 ${syncReviewMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {syncReviewMsg}
                </p>
              )}
            </div>

            {/* 스마트플레이스 현황 — Track 1 점수 직결 */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-3">
              <div>
                <div className="text-sm font-semibold text-green-800">스마트플레이스 현황</div>
                <div className="text-sm text-green-600 mt-0.5">
                  아래 항목이 AI 노출 점수(Track 1)에 직접 반영됩니다. 직접 확인 후 체크하세요.
                </div>
              </div>

              {/* 확인/등록 방법 안내 */}
              <div className="bg-white border border-green-200 rounded-lg px-3 py-2.5 space-y-1.5">
                <div className="text-sm font-semibold text-green-800">확인 및 등록 방법</div>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>① Q&A(질문/답변)</strong> — 스마트플레이스 관리 → [기본정보] → 업체 소개 하단에 Q&A 삽입 (Q&A 탭 2026년 폐기됨)</p>
                  <p><strong>② 최근 소식</strong> — 스마트플레이스 관리 → [소식] → 소식 작성 (1개월 이내)</p>
                  <p><strong>③ 소개글</strong> — 스마트플레이스 관리 → [기본정보] → 업체 소개 입력</p>
                </div>
                <a
                  href="https://smartplace.naver.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1"
                >
                  네이버 스마트플레이스 관리 바로가기 ↗
                </a>
              </div>

              {/* 스마트플레이스 등록 여부 — 점수 기반 핵심 항목 */}
              <label className="flex items-start gap-3 cursor-pointer group bg-white border border-green-300 rounded-lg px-3 py-3">
                <input
                  type="checkbox"
                  checked={editForm.is_smart_place ?? false}
                  onChange={(e) => setEditForm({ ...editForm, is_smart_place: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">네이버 스마트플레이스 등록됨</span>
                  <span className="block text-sm text-gray-400">네이버 지도·검색에서 가게가 플레이스 카드로 표시되면 체크</span>
                </div>
                <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                  Track 1 기반
                </span>
              </label>

              <div className="space-y-2">
                {([
                  { key: "has_recent_post", label: "최근 소식 등록됨 (1개월 내)", points: "+20점", desc: "최신성 점수 유지" },
                  { key: "has_intro", label: "소개글 작성됨", points: "+10점", desc: "기본 정보 완성도 (소개글 안에 Q&A 섹션 포함 시 인용 후보)" },
                ] as const).map(({ key, label, points, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={editForm[key] ?? false}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.checked })}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
                      <span className="block text-sm text-gray-400">{desc}</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded shrink-0">
                      {points}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm border-t border-green-100 pt-2">
                <span className="text-green-700">
                  현재 추가 점수: <strong>{(editForm.has_recent_post ? 20 : 0) + (editForm.has_intro ? 10 : 0)}점</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleSyncSmartplace(activeBiz.id)}
                  disabled={syncingSmartplace || !editForm.naver_place_id}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {syncingSmartplace ? (
                    <><svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>확인 중...</>
                  ) : (
                    <><RefreshCw size={12} />네이버에서 자동 확인</>
                  )}
                </button>
              </div>
              {!editForm.naver_place_id && (
                <p className="text-sm text-amber-600 mt-1">네이버 플레이스 ID를 먼저 등록해야 자동 확인이 가능합니다.</p>
              )}
              {syncSmartplaceMsg ? (
                <p className={`text-sm mt-1 ${syncSmartplaceMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {syncSmartplaceMsg}
                  {syncSmartplaceMsg.startsWith("✓") && " 결과가 실제와 다를 수 있으니 체크 항목을 직접 확인해 주세요."}
                </p>
              ) : (
                <p className="text-sm text-gray-400 mt-1">자동 확인은 1시간에 1회 가능 · 결과가 실제와 다를 수 있으니 반드시 직접 확인 후 수정하세요.</p>
              )}
            </div>

            {/* 고객 리뷰 샘플 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                고객 리뷰 샘플
                <span className="ml-1 font-normal text-gray-400">(키워드 갭 분석에 사용, 선택)</span>
              </label>
              <textarea
                rows={4}
                value={editForm.review_sample ?? ""}
                onChange={(e) => setEditForm({ ...editForm, review_sample: e.target.value })}
                placeholder={"네이버 플레이스에서 받은 리뷰 2~3개를 붙여넣으세요.\n예: \"맛있어요, 분위기 좋아요, 다시 오고 싶어요\"\n\"친절하고 음식이 빨리 나와서 좋았습니다\""}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-sm text-gray-400 mt-1">
                리뷰 내 키워드를 분석해 부족한 키워드를 찾아드립니다
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 gap-3">
              {saveSuccess ? (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  저장되었습니다
                </span>
              ) : (
                <span />
              )}
              <button
                onClick={() => handleSave(activeTabId)}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-3 bg-blue-600 text-white text-base font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
