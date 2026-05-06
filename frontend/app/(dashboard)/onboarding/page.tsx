"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, getSafeSession } from "@/lib/supabase/client";
import { createBusiness } from "@/lib/api";
import {
  Sparkles, Search, Clock, BarChart2, Smartphone, Rocket,
  UtensilsCrossed, Stethoscope, BookOpen, Scale, Scissors,
  ShoppingBag, Wrench, Music2, Camera, Film, Palette, BedDouble, ChevronDown, Check,
  Bot, BarChart3, TrendingUp, KeyRound, Lightbulb, MapPin, CheckCircle2, Circle,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORY_GROUPS } from "@/lib/categories";
import BusinessSearchDropdown, { mapKakaoCategory } from "@/components/dashboard/BusinessSearchDropdown";
import type { BusinessSearchResult } from "@/types";

const STEPS = [
  { id: 1, label: "사업장 등록",  desc: "내 가게 정보 입력" },
  { id: 2, label: "첫 스캔 안내", desc: "AI 스캔 방법 확인" },
  { id: 3, label: "시작하기",     desc: "대시보드로 이동" },
];

const CATEGORY_ICON_CONFIG: Record<string, { icon: LucideIcon; gradient: string }> = {
  food:          { icon: UtensilsCrossed, gradient: "from-orange-400 to-rose-500"   },
  health:        { icon: Stethoscope,     gradient: "from-blue-500 to-indigo-600"   },
  education:     { icon: BookOpen,        gradient: "from-indigo-500 to-blue-600"   },
  professional:  { icon: Scale,           gradient: "from-slate-500 to-gray-600"    },
  beauty:        { icon: Scissors,        gradient: "from-pink-400 to-rose-500"     },
  shopping:      { icon: ShoppingBag,     gradient: "from-fuchsia-500 to-pink-600"  },
  living:        { icon: Wrench,          gradient: "from-zinc-400 to-slate-500"    },
  culture:       { icon: Music2,          gradient: "from-purple-500 to-violet-600" },
  photo:         { icon: Camera,           gradient: "from-indigo-400 to-blue-500"   },
  video:         { icon: Film,            gradient: "from-red-400 to-rose-500"      },
  design:        { icon: Palette,         gradient: "from-violet-500 to-purple-600" },
  accommodation: { icon: BedDouble,       gradient: "from-sky-400 to-blue-500"      },
};

function CategoryDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = CATEGORY_GROUPS.find((g) => g.value === value);
  const cfg = selected ? (CATEGORY_ICON_CONFIG[selected.value] ?? null) : null;
  const SelIcon = cfg?.icon ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 border rounded-lg px-3 py-3 text-base bg-white transition-all
          ${open ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-300 hover:border-gray-400"}`}
      >
        {SelIcon && cfg && (
          <div className={`w-7 h-7 rounded-md flex items-center justify-center bg-gradient-to-br ${cfg.gradient} shrink-0`}>
            <SelIcon className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
        )}
        <span className="flex-1 text-left text-gray-800 font-medium text-base">{selected?.label ?? "선택"}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="py-1 max-h-64 overflow-y-auto">
            {CATEGORY_GROUPS.map((g) => {
              const c = CATEGORY_ICON_CONFIG[g.value];
              const Icon = c?.icon ?? null;
              const isSelected = g.value === value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => { onChange(g.value); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-base transition-colors
                    ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  {c && Icon ? (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${c.gradient} shrink-0 shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
                    </div>
                  ) : (
                    <span className="text-xl w-9 text-center">{g.emoji}</span>
                  )}
                  <span className={`flex-1 text-left font-medium text-base ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                    {g.label}
                  </span>
                  {isSelected && <Check className="w-5 h-5 text-blue-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "food",
    region: "",
    address: "",
    phone: "",
    website: "",
    blog_url: "",
    keywords: "",
    naver_place_id: "",
    naver_place_url: "",
    kakao_place_id: "",
  });
  const [autoFillMsg, setAutoFillMsg] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [naverSearching, setNaverSearching] = useState(false);
  const [naverSearchMsg, setNaverSearchMsg] = useState("");
  const [registeredBizId, setRegisteredBizId] = useState<string | null>(null);
  const [hasCompetitor, setHasCompetitor] = useState(false);
  const [hasFirstScan, setHasFirstScan] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // 무료 체험에서 입력한 데이터 자동 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aeolab_trial_prefill");
      if (saved) {
        const data = JSON.parse(saved) as { name?: string; category?: string; region?: string };
        if (data.name || data.category || data.region) {
          setForm(prev => ({
            ...prev,
            name: data.name || prev.name,
            category: data.category || prev.category,
            region: data.region || prev.region,
          }));
          setAutoFillMsg("무료 체험 입력 정보가 자동으로 채워졌습니다 ✓");
          setTimeout(() => setAutoFillMsg(""), 5000);
        }
        localStorage.removeItem("aeolab_trial_prefill");
      }
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }, []);

  // 주소에서 지역 추출: "서울특별시 마포구 연남동..." → "서울 마포구"
  const extractRegion = (address: string): string => {
    if (!address) return "";
    const parts = address.trim().split(/\s+/);
    const city = (parts[0] || "")
      .replace("특별시", "").replace("광역시", "")
      .replace("특별자치시", "").replace("특별자치도", "")
      .replace("도", "");
    const gu = parts[1] || "";
    return gu ? `${city} ${gu}` : city;
  };

  const handleBusinessSelect = async (result: BusinessSearchResult) => {
    const extractedRegion = result.region || extractRegion(result.address || "");
    let naverPlaceId = result.naver_place_id || "";
    let naverPlaceUrl = result.naver_place_url || "";

    setForm(prev => ({
      ...prev,
      name: result.name || prev.name,
      address: result.address || prev.address,
      phone: result.phone || prev.phone,
      category: mapKakaoCategory(result.category) || prev.category,
      region: extractedRegion || prev.region,
      naver_place_url: naverPlaceUrl || prev.naver_place_url,
      naver_place_id: naverPlaceId || prev.naver_place_id,
      kakao_place_id: result.kakao_place_id || prev.kakao_place_id,
    }));
    setShowManualInput(false);
    setAutoFillMsg("가게 정보가 자동으로 입력되었습니다 ✓");
    setTimeout(() => setAutoFillMsg(""), 5000);

    // 네이버 플레이스 ID가 없으면 자동 재검색
    if (!naverPlaceId && result.name) {
      setNaverSearching(true);
      setNaverSearchMsg("");
      try {
        const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
        const q = encodeURIComponent(result.name.trim());
        const r = encodeURIComponent(extractedRegion.trim());
        const res = await fetch(`${BACKEND}/api/businesses/search?query=${q}&region=${r}`);
        if (res.ok) {
          const items = await res.json() as Array<{
            name: string; naver_place_id: string; naver_place_url: string;
          }>;
          // 이름이 가장 유사한 결과에서 naver_place_id 추출
          const match = items.find(
            (it) => it.naver_place_id && it.name.replace(/\s/g, "").includes(result.name.replace(/\s/g, "").slice(0, 3))
          ) || items.find((it) => it.naver_place_id);
          if (match?.naver_place_id) {
            setForm(prev => ({
              ...prev,
              naver_place_id: match.naver_place_id,
              naver_place_url: match.naver_place_url || prev.naver_place_url,
            }));
            setNaverSearchMsg("✓ 네이버 스마트플레이스 ID가 자동으로 입력되었습니다");
          } else {
            setNaverSearchMsg("네이버 ID는 자동 입력이 어렵습니다. 아래 안내를 참고해 네이버 지도에서 직접 복사해 주세요.");
          }
        } else {
          setNaverSearchMsg("");
        }
      } catch {
        setNaverSearchMsg("");
      } finally {
        setNaverSearching(false);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.region) {
      setError("사업장명과 지역은 필수입니다.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await getSafeSession();
      if (!session) { router.push("/login"); return; }

      const biz = await createBusiness({
        name: form.name,
        category: form.category,
        region: form.region,
        address: form.address,
        phone: form.phone,
        website_url: form.website,
        blog_url: form.blog_url || undefined,
        naver_place_id: form.naver_place_id || undefined,
        naver_place_url: form.naver_place_url || undefined,
        kakao_place_id: form.kakao_place_id || undefined,
        keywords: form.keywords ? form.keywords.split(",").map(k => k.trim()).filter(Boolean) : [],
      }, session.user.id, session.access_token) as { id?: string } | null;
      if (biz?.id) setRegisteredBizId(biz.id);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "사업장 등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // step 3 진입 시 실제 데이터 조회
  useEffect(() => {
    if (step !== 3) return;
    const fetchChecklist = async () => {
      const session = await getSafeSession();
      if (!session) return;
      const supabase = createClient();

      let bizId = registeredBizId;
      if (!bizId) {
        const { data: bizList } = await supabase
          .from("businesses")
          .select("id")
          .eq("user_id", session.user.id)
          .limit(1)
          .single();
        bizId = bizList?.id ?? null;
      }
      if (!bizId) return;

      const { data: competitors } = await supabase
        .from("competitors")
        .select("id")
        .eq("business_id", bizId)
        .limit(1);
      if (competitors && competitors.length > 0) setHasCompetitor(true);

      const { data: scans } = await supabase
        .from("scan_results")
        .select("id")
        .eq("business_id", bizId)
        .limit(1);
      if (scans && scans.length > 0) setHasFirstScan(true);
    };
    fetchChecklist();
  }, [step, registeredBizId]);

  const handleComplete = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, onboarding_done: true }, { onConflict: "id" });
      if (updateErr) {
        console.warn("[onboarding] profiles 업데이트 실패:", updateErr.message);
      }

      // 이미 활성 구독이 있으면 바로 대시보드로 이동 (신규 사업장 biz_id 파라미터 포함)
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, plan")
        .eq("user_id", user.id)
        .in("status", ["active", "grace_period"])
        .maybeSingle();
      if (sub) {
        const dest = registeredBizId ? `/dashboard?biz_id=${registeredBizId}` : "/dashboard";
        router.push(dest);
        return;
      }
    }
    setShowPlanModal(true);
  };

  const handleGoToDashboard = () => {
    setShowPlanModal(false);
    const dest = registeredBizId ? `/dashboard?biz_id=${registeredBizId}` : "/dashboard";
    router.push(dest);
  };

  const handleGoToPricing = () => {
    setShowPlanModal(false);
    router.push("/pricing");
  };

  return (
    <>
    {/* 플랜 선택 모달 */}
    {showPlanModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-5 md:p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">요금제를 선택해 주세요</h2>
            <p className="text-base text-gray-500">첫 달부터 경쟁사와 비교하고 싶다면 지금 시작하세요.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {/* Basic */}
            <div className="border-2 border-blue-500 rounded-xl p-4 relative">
              <span className="absolute -top-3 left-3 bg-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full">가장 인기</span>
              <div className="text-base font-bold text-gray-900 mb-1 mt-1">Basic</div>
              <div className="text-2xl font-extrabold text-blue-600 mb-2">
                9,900원<span className="text-sm font-normal text-gray-400">/월</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500 shrink-0" />주 1회 자동 AI 스캔</li>
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500 shrink-0" />경쟁사 5곳 비교</li>
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-blue-500 shrink-0" />리뷰 답변 · FAQ 무제한</li>
              </ul>
              <button
                onClick={handleGoToPricing}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors"
              >
                지금 결제
              </button>
            </div>

            {/* Pro */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="text-base font-bold text-gray-900 mb-1">Pro</div>
              <div className="text-2xl font-extrabold text-indigo-600 mb-2">
                18,900원<span className="text-sm font-normal text-gray-400">/월</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-indigo-400 shrink-0" />경쟁사 10곳 비교</li>
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-indigo-400 shrink-0" />경쟁사 변화 즉시 알림</li>
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-indigo-400 shrink-0" />PDF 성과 보고서</li>
              </ul>
              <button
                onClick={handleGoToPricing}
                className="w-full border border-indigo-300 text-indigo-600 py-3 rounded-lg text-base font-semibold hover:bg-indigo-50 transition-colors"
              >
                지금 결제
              </button>
            </div>

            {/* Biz */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="text-base font-bold text-gray-900 mb-1">Biz</div>
              <div className="text-2xl font-extrabold text-emerald-600 mb-2">
                39,900원<span className="text-sm font-normal text-gray-400">/월</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1.5 mb-4">
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500 shrink-0" />사업장 5개 관리</li>
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500 shrink-0" />경쟁사 무제한</li>
                <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500 shrink-0" />팀 계정 5명</li>
              </ul>
              <button
                onClick={handleGoToPricing}
                className="w-full border border-emerald-300 text-emerald-600 py-3 rounded-lg text-base font-semibold hover:bg-emerald-50 transition-colors"
              >
                지금 결제
              </button>
            </div>
          </div>

          <button
            onClick={handleGoToDashboard}
            className="w-full text-base text-gray-400 hover:text-gray-600 py-3 transition-colors"
          >
            나중에 결제 — 대시보드로 이동
          </button>
        </div>
      </div>
    )}

    <main className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-10 md:py-16">
      <div className="max-w-2xl w-full">

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              {/* 스텝 원 */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-base transition-colors ${
                  step === s.id ? "bg-blue-600 text-white shadow-md shadow-blue-200" :
                  step > s.id  ? "bg-green-500 text-white" :
                  "bg-gray-200 text-gray-400"
                }`}>
                  {step > s.id ? <Check className="w-5 h-5" /> : s.id}
                </div>
                <div className="hidden sm:block">
                  <div className={`text-sm font-semibold leading-tight ${step === s.id ? "text-gray-900" : "text-gray-400"}`}>
                    {s.label}
                  </div>
                  <div className={`text-sm leading-tight ${step === s.id ? "text-gray-500" : "text-gray-300"}`}>
                    {s.desc}
                  </div>
                </div>
              </div>
              {/* 구분선 */}
              {i < STEPS.length - 1 && (
                <div className={`w-8 md:w-12 h-0.5 mx-1 ${step > s.id ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: 사업장 등록 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-8">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-semibold text-blue-800 mb-1">가게 정보를 등록하면 AI가 내 가게를 어떻게 인식하는지 진단해 드립니다.</p>
              <p className="text-sm text-blue-700 leading-relaxed">블로그 URL과 스마트플레이스 URL을 함께 등록하면 블로그 분석·스마트플레이스 완성도 체크 등 더 정확한 분석이 가능합니다.</p>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">내 가게를 검색해서 선택하세요</h1>
            <p className="text-base text-gray-500 mb-6 leading-relaxed">
              가게 이름을 검색하면 주소·전화번호·업종이 자동으로 채워집니다.
              <br className="hidden sm:block" />
              등록 후 매일 자동으로 경쟁 가게와 AI 노출을 비교해 드립니다.
            </p>

            <form onSubmit={handleRegister} className="space-y-5">

              {/* ─── 가게 검색 자동완성 ─── */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  가게 검색
                  <span className="text-blue-600 font-semibold ml-1 text-xs bg-blue-50 px-2 py-0.5 rounded-full">카카오맵 + 네이버 동시 검색</span>
                </label>
                <p className="text-sm text-gray-500 mb-2 leading-relaxed">
                  지역과 가게 이름을 입력하면 <strong>카카오맵·네이버</strong>에서 동시에 검색하여 이름·주소·업종을 자동으로 채워줍니다. 네이버 스마트플레이스 ID는 아래 안내를 참고해 직접 입력해 주세요.
                </p>

                <BusinessSearchDropdown
                  region={form.region}
                  onSelect={handleBusinessSelect}
                />

                {/* 자동입력 완료 메시지 */}
                {autoFillMsg && (
                  <p className="text-sm text-green-600 font-semibold mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {autoFillMsg}
                  </p>
                )}
              </div>

              {/* ─── 선택된 가게 정보 카드 ─── */}
              {form.name && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-blue-800">선택된 가게 정보</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 block">상호명</span>
                      <span className="font-semibold text-gray-900">{form.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">지역</span>
                      <span className={`font-semibold ${form.region ? "text-gray-900" : "text-amber-600"}`}>
                        {form.region || "직접 입력 필요"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500 block">주소</span>
                      <span className="font-medium text-gray-800 text-sm leading-relaxed">{form.address || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">전화</span>
                      <span className="font-medium text-gray-800">{form.phone || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">업종</span>
                      <span className="font-medium text-gray-800">
                        {CATEGORY_GROUPS.find(g => g.value === form.category)?.label || form.category}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, name: "", region: "", address: "", phone: "" }));
                      setShowManualInput(false);
                    }}
                    className="text-sm text-red-500 hover:text-red-700 underline transition-colors"
                  >
                    다시 검색하기
                  </button>
                </div>
              )}

              {/* ─── 직접 입력 토글 ─── */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowManualInput(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showManualInput ? "rotate-180" : ""}`} />
                  {form.name ? "정보를 직접 수정하기" : "검색이 안 된다면 직접 입력하기"}
                </button>
              </div>

              {/* ─── 직접 입력 영역 (토글) ─── */}
              {(showManualInput || !form.name) && (
                <div className="space-y-4 border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-600">직접 입력</p>

                  {/* 사업장명 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      사업장명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                      placeholder="예: 연남동 미숙이돈까스"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">카카오맵·네이버에 등록된 정확한 이름</p>
                  </div>

                  {/* 업종 + 지역 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        업종 <span className="text-red-500">*</span>
                      </label>
                      <CategoryDropdown
                        value={form.category}
                        onChange={(v) => setForm(f => ({ ...f, category: v }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">AI가 업종별 최적 키워드를 자동 선택합니다</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">
                        지역 <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                        placeholder="예: 서울 강남구"
                        value={form.region}
                        onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">읍·면·동 수준으로 입력할수록 정확합니다</p>
                    </div>
                  </div>

                  {/* 주소 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">주소</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                      placeholder="예: 서울 마포구 연남로 123"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>

                  {/* 전화번호 + 웹사이트 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">전화번호</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                        placeholder="02-1234-5678"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">웹사이트</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                        placeholder="https://..."
                        value={form.website}
                        onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                      />
                    </div>

                  </div>
                </div>
              )}

              {/* ─── 업종 (검색으로 선택 시, 직접 입력 접힌 상태에서도 변경 가능) ─── */}
              {form.name && !showManualInput && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    업종 <span className="text-red-500">*</span>
                  </label>
                  <CategoryDropdown
                    value={form.category}
                    onChange={(v) => setForm(f => ({ ...f, category: v }))}
                  />
                </div>
              )}

              {/* ─── 블로그 URL ─── */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  블로그 URL
                  <span className="ml-1 text-sm font-normal text-gray-400">(네이버·티스토리·워드프레스 등)</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                  placeholder="https://blog.naver.com/내블로그"
                  value={form.blog_url}
                  onChange={e => setForm(f => ({ ...f, blog_url: e.target.value }))}
                />
                {/* 블로그 자동 분석 안내 */}
                <p className="text-sm text-blue-600 mt-1 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">💡</span>
                  <span>블로그 주소를 입력하면 등록 후 자동으로 분석됩니다. AI 브리핑 노출 가능성을 진단해 드립니다.</span>
                </p>
              </div>

              {/* ─── 핵심 키워드 ─── */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  핵심 키워드 <span className="text-gray-400 font-normal">(쉼표로 구분)</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                  placeholder="예: 가정식, 주차가능, 예약불필요"
                  value={form.keywords}
                  onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                />
              </div>

              {/* ─── 네이버 플레이스 ID ─── */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  네이버 스마트플레이스 ID
                  <span className="ml-1 text-sm font-normal text-gray-400">(선택사항 — 없어도 됩니다)</span>
                </label>

                {/* 스마트플레이스 안내 박스 — 항상 표시 */}
                <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 mb-1">네이버 스마트플레이스란?</p>
                  <p className="text-sm text-blue-700 leading-relaxed mb-3">
                    네이버 지도·검색에서 내 가게 정보(위치, 영업시간, 메뉴, 사진 등)를 관리하는 공식 플랫폼입니다.
                    <strong className="block mt-1">스마트플레이스에 등록된 가게일수록 네이버 AI 브리핑에 더 잘 노출됩니다.</strong>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                      <p className="text-sm font-bold text-blue-700 mb-1">아직 등록하지 않으셨나요?</p>
                      <p className="text-sm text-blue-600 mb-2">지금 바로 무료로 등록하세요. 네이버 검색 노출이 크게 올라갑니다.</p>
                      <a
                        href="https://smartplace.naver.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        스마트플레이스 무료 등록 →
                      </a>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                      <p className="text-sm font-bold text-blue-700 mb-1">이미 등록하셨나요?</p>
                      <p className="text-sm text-blue-600 mb-2">네이버 지도에서 내 가게를 검색 후 URL의 숫자를 입력하세요.</p>
                      <a
                        href={`https://map.naver.com/v5/search/${encodeURIComponent(form.name || "내 가게 이름")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        네이버 지도에서 확인 →
                      </a>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-blue-500">
                    예시 URL: map.naver.com/v5/entry/place/<strong>12345678</strong> ← 이 숫자가 ID입니다
                  </p>
                </div>
                {/* 자동 검색 상태 표시 */}
                {naverSearching && (
                  <div className="mb-2 flex items-center gap-2 text-sm text-blue-600">
                    <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    네이버 스마트플레이스 ID 자동 검색 중...
                  </div>
                )}
                <div className="relative">
                  <input
                    className={`w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 placeholder:text-gray-400 ${
                      form.naver_place_id
                        ? "border-green-400 focus:ring-green-500 bg-green-50"
                        : "border-gray-300 focus:ring-blue-500"
                    }`}
                    placeholder="예: 12345678 (가게 선택 시 자동 입력)"
                    value={form.naver_place_id}
                    onChange={e => setForm(f => ({ ...f, naver_place_id: e.target.value }))}
                    readOnly={naverSearching}
                  />
                  {form.naver_place_id && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-lg">✓</span>
                  )}
                </div>
                {/* 자동 검색 결과 메시지 */}
                {naverSearchMsg && !naverSearching && (
                  <div className={`mt-1.5 text-sm font-medium flex items-start gap-1.5 ${
                    naverSearchMsg.startsWith("✓") ? "text-green-600" : "text-amber-700"
                  }`}>
                    <span className="shrink-0 mt-0.5">{naverSearchMsg.startsWith("✓") ? "" : "⚠️"}</span>
                    <span>{naverSearchMsg}</span>
                  </div>
                )}

                {/* ID 자동 입력된 경우 확인 메시지 */}
                {form.naver_place_id && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <p className="text-sm text-green-700 font-medium">✓ 네이버 스마트플레이스 ID가 입력되었습니다. AI 스캔 정확도가 높아집니다.</p>
                  </div>
                )}
              </div>

              {/* ─── 에러 메시지 ─── */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-red-500 text-base mt-0.5">!</span>
                  <p className="text-base text-red-600 font-medium">{error}</p>
                </div>
              )}

              {/* ─── 등록 버튼 ─── */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>등록 중...</span>
                  </>
                ) : (
                  "다음 단계 →"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: 첫 스캔 안내 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                <Sparkles className="w-8 h-8 text-white" strokeWidth={1.5} />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">가게 분석 준비 완료!</h1>
              <p className="text-base text-gray-500 leading-relaxed">
                매일 자동으로 경쟁 가게와 비교해 드립니다.<br className="hidden sm:block" />
                AI 스캔 방법을 먼저 확인하세요.
              </p>
            </div>

            {/* 첫 스캔 무료 배너 */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-green-500 text-white text-sm font-bold px-3 py-0.5 rounded-full">무료</span>
                <span className="text-base font-bold text-green-800">첫 스캔 1회는 완전 무료입니다</span>
              </div>
              <p className="text-base text-green-700 leading-relaxed">
                지금 바로 대시보드에서 AI 스캔을 시작하세요.<br className="hidden sm:block" />
                약 2~3분이면 아래 정보를 모두 확인할 수 있습니다.
              </p>
            </div>

            {/* 첫 스캔 제공 정보 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-green-500" strokeWidth={1.8} />
                <span className="text-base font-bold text-gray-700">첫 스캔 1회로 확인할 수 있는 정보</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {[
                  { icon: Bot,        bg: "bg-blue-100",   color: "text-blue-600",   label: "3채널 노출 신호",       detail: "네이버 AI 브리핑·카카오맵·ChatGPT에서 내 가게 검색 결과" },
                  { icon: BarChart3,  bg: "bg-indigo-100", color: "text-indigo-600", label: "AI 노출 종합 점수",      detail: "0~100점 종합 점수 + 네이버 채널 / 글로벌 AI 채널 분리 점수" },
                  { icon: TrendingUp, bg: "bg-amber-100",  color: "text-amber-600",  label: "성장 단계 진단",         detail: "시작→성장→빠른 성장→지역 1등 중 내 가게의 현재 단계 판정" },
                  { icon: KeyRound,   bg: "bg-red-100",    color: "text-red-600",    label: "없는 키워드 TOP 3",     detail: "경쟁사는 있고 내 가게에 없는 핵심 키워드 — 지금 당장 추가해야 할 단어" },
                  { icon: Camera,     bg: "bg-purple-100", color: "text-purple-600", label: "Before 스크린샷",       detail: "현재 AI 검색 노출 화면 자동 캡처 — 개선 전후 비교의 기준점" },
                  { icon: Lightbulb,  bg: "bg-green-100",  color: "text-green-600",  label: "즉시 활용 가이드",       detail: "소개글 Q&A 문구·리뷰 답변 초안·소식 업데이트 문구 자동 생성" },
                ].map(item => (
                  <div key={item.label} className="flex gap-3 items-start p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} strokeWidth={1.8} />
                    </div>
                    <div>
                      <span className="text-base font-semibold text-gray-900">{item.label}</span>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 기본 안내 항목 */}
            <div className="space-y-3 mb-6">
              {[
                {
                  Icon: Clock,
                  title: "첫 스캔은 언제?",
                  desc: "등록 직후 자동으로 Before 스크린샷이 저장됩니다. 대시보드에서 지금 바로 수동 스캔을 시작할 수 있습니다.",
                },
                {
                  Icon: Smartphone,
                  title: "카카오톡 알림",
                  desc: "설정에서 전화번호를 등록하면 점수 변화·AI 인용 등 5가지 알림을 받을 수 있습니다.",
                },
              ].map(item => (
                <div key={item.title} className="flex gap-4 p-4 bg-blue-50 rounded-xl">
                  <item.Icon className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <div className="text-base font-bold text-gray-900 mb-1">{item.title}</div>
                    <div className="text-base text-gray-600 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 카카오맵 비즈니스 프로필 안내 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5 text-yellow-600" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-base font-bold text-yellow-900">카카오맵 비즈니스 프로필도 확인해보세요</span>
                    <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 border border-yellow-300">선택 사항</span>
                  </div>
                  <p className="text-base text-yellow-800 leading-relaxed mb-2">
                    카카오맵은 한국에서 네이버 다음으로 많이 사용되는 지역 검색 플랫폼입니다.
                    영업시간·전화번호·사진을 등록하면 카카오 AI 검색 노출이 향상됩니다.
                  </p>
                  <a
                    href="https://map.kakao.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-base font-bold text-yellow-700 hover:text-yellow-900 underline transition-colors"
                  >
                    카카오맵 바로가기 →
                  </a>
                  <p className="text-sm text-yellow-600 mt-1.5">
                    대시보드에서 카카오맵 완성도 체크리스트를 확인할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors"
            >
              다음 →
            </button>
          </div>
        )}

        {/* Step 3: 완료 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
              <Rocket className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">가입 완료! 첫 번째 AI 진단을 시작합니다</h1>
            <p className="text-base text-gray-500 mb-5">아래 3단계를 순서대로 완료하면 내 가게의 AI 노출 현황을 바로 확인할 수 있습니다.</p>

            {/* 3단계 온보딩 진행 흐름 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-left">
              {[
                {
                  no: "Step 1/3",
                  title: "AI 스캔 실행",
                  desc: "대시보드에서 [AI 스캔 시작] 버튼을 누르면 약 30초 안에 결과가 나옵니다.",
                  status: hasFirstScan ? "완료" : "자동 시작 중...",
                  done: hasFirstScan,
                  link: "/dashboard",
                  linkLabel: "대시보드로 이동",
                  color: "blue",
                },
                {
                  no: "Step 2/3",
                  title: "없는 키워드 3개 확인",
                  desc: "스캔 완료 후 가이드 페이지에서 부족한 키워드를 확인하세요.",
                  status: hasFirstScan ? "확인 가능" : "스캔 후 가능",
                  done: false,
                  link: "/guide",
                  linkLabel: "가이드에서 확인하기",
                  color: "amber",
                },
                {
                  no: "Step 3/3",
                  title: "FAQ 초안 1개 복사",
                  desc: "가이드 페이지에서 바로 복사해 스마트플레이스에 붙여넣으세요.",
                  status: "복사 버튼 제공",
                  done: false,
                  link: "/guide",
                  linkLabel: "복사하기",
                  color: "green",
                },
              ].map((s) => (
                <div
                  key={s.no}
                  className={`rounded-xl border p-4 text-left ${
                    s.done
                      ? "bg-emerald-50 border-emerald-200"
                      : s.color === "blue"
                      ? "bg-blue-50 border-blue-200"
                      : s.color === "amber"
                      ? "bg-amber-50 border-amber-100"
                      : "bg-green-50 border-green-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500">{s.no}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.done
                        ? "bg-emerald-200 text-emerald-800"
                        : s.color === "blue"
                        ? "bg-blue-200 text-blue-800"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 mb-1">{s.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">{s.desc}</p>
                  <a
                    href={s.link}
                    className={`inline-flex items-center text-sm font-semibold underline ${
                      s.done ? "text-emerald-700" : s.color === "blue" ? "text-blue-700" : s.color === "amber" ? "text-amber-700" : "text-green-700"
                    }`}
                  >
                    {s.linkLabel} →
                  </a>
                </div>
              ))}
            </div>

            {/* 첫 스캔 강조 안내 */}
            <div className="bg-blue-600 text-white rounded-xl px-4 py-4 mb-5 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5 text-blue-200" />
                <div>
                  <p className="text-base font-bold mb-1">사업장 등록 완료!</p>
                  <p className="text-base text-blue-100 leading-relaxed">
                    대시보드에서 <span className="font-bold text-white">[AI 스캔 시작]</span> 버튼을 눌러
                    <br className="hidden sm:block" />
                    첫 결과를 확인하세요 <span className="font-semibold">(약 30초)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 시작 체크리스트 */}
            <div className="bg-blue-50 rounded-xl p-4 mb-8 text-left">
              <div className="text-base font-bold text-blue-800 mb-3">시작 체크리스트</div>
              <ul className="space-y-3">
                {/* 사업장 등록: step 3에 도달했다면 항상 완료 */}
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-base font-semibold text-green-700">사업장 등록 완료</span>
                </li>
                {/* 첫 AI 스캔 */}
                <li className="flex items-start gap-3">
                  {hasFirstScan
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    : <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
                  }
                  <span className={`text-base font-medium ${hasFirstScan ? "text-green-700" : "text-gray-700"}`}>
                    첫 AI 스캔 실행
                    {!hasFirstScan && <span className="ml-1 text-sm text-gray-400 font-normal">(대시보드에서)</span>}
                  </span>
                </li>
                {/* 경쟁사 등록 */}
                <li className="flex items-start gap-3">
                  {hasCompetitor
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    : <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
                  }
                  <span className={`text-base font-medium ${hasCompetitor ? "text-green-700" : "text-gray-700"}`}>
                    경쟁사 최소 1개 등록
                    {!hasCompetitor && <span className="ml-1 text-sm text-gray-400 font-normal">(경쟁사 메뉴에서)</span>}
                    <span className="block text-xs text-gray-500 mt-0.5 font-normal">경쟁사를 등록하면 비교 분석이 가능합니다</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
                  <span className="text-base font-medium text-gray-700">
                    카카오 알림 수신 번호 등록
                    <span className="ml-1 text-sm text-gray-400 font-normal">(설정에서)</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
                  <span className="text-base font-medium text-gray-700">
                    네이버 리뷰 수·별점 입력
                    <span className="ml-1 text-sm text-gray-400 font-normal">(설정 → 내 가게 수정에서)</span>
                    <span className="block text-sm text-amber-600 mt-0.5 font-normal">리뷰 수를 입력하면 AI 노출 점수 정확도가 높아집니다</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
                  <span className="text-base font-medium text-gray-600">
                    카카오맵 완성도 체크리스트 확인
                    <span className="ml-1 text-sm text-blue-500 font-normal">(선택)</span>
                  </span>
                </li>
              </ul>
            </div>

            {hasFirstScan && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-800 flex items-center gap-2 justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                첫 번째 개선 행동 완료! 7일 후 점수 변화를 알려드립니다
              </div>
            )}
            <button
              onClick={handleComplete}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-colors"
            >
              대시보드로 이동 →
            </button>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
