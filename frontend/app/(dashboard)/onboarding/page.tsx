"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createBusiness } from "@/lib/api";
import {
  Sparkles, Search, Clock, BarChart2, Smartphone, Rocket,
  UtensilsCrossed, Stethoscope, BookOpen, Scale, Scissors,
  ShoppingBag, Wrench, Music2, Camera, Film, Palette, BedDouble, ChevronDown, Check,
  Bot, BarChart3, TrendingUp, KeyRound, Lightbulb, MapPin, CheckCircle2, Circle,
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
        className={`w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-white transition-all
          ${open ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-300 hover:border-gray-400"}`}
      >
        {SelIcon && cfg && (
          <div className={`w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br ${cfg.gradient} shrink-0`}>
            <SelIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
          </div>
        )}
        <span className="flex-1 text-left text-gray-800 font-medium">{selected?.label ?? "선택"}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors
                    ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  {c && Icon ? (
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${c.gradient} shrink-0 shadow-sm`}>
                      <Icon className="w-4 h-4 text-white" strokeWidth={1.8} />
                    </div>
                  ) : (
                    <span className="text-xl w-8 text-center">{g.emoji}</span>
                  )}
                  <span className={`flex-1 text-left font-medium ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                    {g.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
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
    keywords: "",
    naver_place_id: "",
    naver_place_url: "",
    kakao_place_id: "",
  });
  const [autoFillMsg, setAutoFillMsg] = useState("");
  // 등록된 사업장 ID (step 3 체크리스트 조회용)
  const [registeredBizId, setRegisteredBizId] = useState<string | null>(null);
  // 실제 데이터 기반 체크 상태
  const [hasCompetitor, setHasCompetitor] = useState(false);
  const [hasFirstScan, setHasFirstScan] = useState(false);

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

  const handleBusinessSelect = (result: BusinessSearchResult) => {
    setForm(prev => ({
      ...prev,
      name: result.name,
      address: result.address || prev.address,
      phone: result.phone || prev.phone,
      category: mapKakaoCategory(result.category) || prev.category,
      naver_place_url: result.naver_place_url || prev.naver_place_url,
      naver_place_id: result.naver_place_id || prev.naver_place_id,
      kakao_place_id: result.kakao_place_id || prev.kakao_place_id,
    }));
    setAutoFillMsg("가게 정보가 자동으로 입력되었습니다 ✓");
    setTimeout(() => setAutoFillMsg(""), 4000);
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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const biz = await createBusiness({
        name: form.name,
        category: form.category,
        region: form.region,
        address: form.address,
        phone: form.phone,
        website_url: form.website,
        naver_place_id: form.naver_place_id || undefined,
        naver_place_url: form.naver_place_url || undefined,
        kakao_place_id: form.kakao_place_id || undefined,
        keywords: form.keywords ? form.keywords.split(",").map(k => k.trim()).filter(Boolean) : [],
      }, session.user.id, session.access_token) as { id?: string } | null;
      // 등록된 사업장 ID 저장 (step 3 체크리스트 조회용)
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
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 사업장 ID 결정 (등록 직후 = registeredBizId, 재진입 = DB에서 조회)
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

      // 경쟁사 1개 이상 등록 여부 확인
      const { data: competitors } = await supabase
        .from("competitors")
        .select("id")
        .eq("business_id", bizId)
        .limit(1);
      if (competitors && competitors.length > 0) setHasCompetitor(true);

      // 첫 스캔 실행 여부 확인
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
        .update({ onboarding_done: true })
        .eq("user_id", user.id);
      if (updateErr) {
        console.warn("[onboarding] profiles 업데이트 실패:", updateErr.message);
      }
    }
    // 실패해도 대시보드로 이동
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                step === s.id ? "bg-blue-600 text-white" :
                step > s.id  ? "bg-green-500 text-white" :
                "bg-gray-200 text-gray-400"
              }`}>
                {step > s.id ? "✓" : s.id}
              </div>
              <span className={`text-xs hidden sm:block ${step === s.id ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${step > s.id ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: 사업장 등록 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h1 className="text-xl font-bold text-gray-900 mb-1">방금 확인한 내 가게 정보를 저장합니다</h1>
            <p className="text-sm text-gray-500 mb-6">체험에서 입력한 정보를 그대로 사용합니다. 확인 후 저장하면 매일 자동으로 경쟁사와 비교해드립니다.</p>
            <form onSubmit={handleRegister} className="space-y-4">
              {/* 가게 검색 자동완성 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  가게 검색 <span className="text-gray-400 font-normal">(네이버·카카오 자동입력)</span>
                </label>
                <p className="text-sm text-gray-500 mb-1.5">가게 이름으로 검색하면 정보를 자동으로 입력합니다</p>
                <BusinessSearchDropdown
                  region={form.region}
                  onSelect={handleBusinessSelect}
                />
                {autoFillMsg && (
                  <p className="text-sm text-green-600 font-medium mt-1.5">{autoFillMsg}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업장명 *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 강남 맛있는 치킨"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업종 *</label>
                  <CategoryDropdown
                    value={form.category}
                    onChange={(v) => setForm(f => ({ ...f, category: v }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 서울 강남구"
                    value={form.region}
                    onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 서울 강남구 테헤란로 123"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="02-1234-5678"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">웹사이트</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  핵심 키워드 <span className="text-gray-400 font-normal">(쉼표로 구분)</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 맛집, 주차가능, 예약불필요"
                  value={form.keywords}
                  onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  네이버 플레이스 ID <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="네이버 지도 URL의 숫자 ID"
                  value={form.naver_place_id}
                  onChange={e => setForm(f => ({ ...f, naver_place_id: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">map.naver.com/v5/entry/place/<strong>123456789</strong> 에서 숫자 부분</p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? "등록 중..." : "다음 단계 →"}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: 첫 스캔 안내 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                <Sparkles className="w-8 h-8 text-white" strokeWidth={1.5} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">가게 분석 준비 완료!</h1>
              <p className="text-base text-gray-500">매일 자동으로 경쟁 가게와 비교해드립니다. AI 스캔 방법을 확인하세요.</p>
            </div>

            {/* 첫 스캔 무료 배너 */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">무료</span>
                <span className="text-base font-bold text-green-800">첫 스캔 1회는 완전 무료입니다</span>
              </div>
              <p className="text-sm text-green-700">지금 바로 대시보드에서 AI 스캔을 시작하세요. 약 2~3분이면 아래 정보를 모두 확인할 수 있습니다.</p>
            </div>

            {/* 첫 스캔 제공 정보 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                <Lightbulb className="w-4 h-4 text-green-500" strokeWidth={1.8} />
                첫 스캔 1회로 확인할 수 있는 정보
              </div>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { icon: Bot,        bg: "bg-blue-100",   color: "text-blue-600",   label: "3채널 노출 신호",       detail: "네이버 AI 브리핑·카카오맵·ChatGPT에서 내 가게 검색 결과" },
                  { icon: BarChart3,  bg: "bg-indigo-100", color: "text-indigo-600", label: "AI 노출 종합 점수",      detail: "0~100점 종합 점수 + 네이버 채널 / 글로벌 AI 채널 분리 점수" },
                  { icon: TrendingUp, bg: "bg-amber-100",  color: "text-amber-600",  label: "성장 단계 진단",         detail: "시작→성장→빠른 성장→지역 1등 중 내 가게의 현재 단계 판정" },
                  { icon: KeyRound,   bg: "bg-red-100",    color: "text-red-600",    label: "없는 키워드 TOP 3",     detail: "경쟁사는 있고 내 가게에 없는 핵심 키워드 — 지금 당장 추가해야 할 단어" },
                  { icon: Camera,     bg: "bg-purple-100", color: "text-purple-600", label: "Before 스크린샷",       detail: "현재 AI 검색 노출 화면 자동 캡처 — 개선 전후 비교의 기준점" },
                  { icon: Lightbulb,  bg: "bg-green-100",  color: "text-green-600",  label: "즉시 활용 가이드",       detail: "FAQ 등록 문구·리뷰 답변 초안·소식 업데이트 문구 자동 생성" },
                ].map(item => (
                  <div key={item.label} className="flex gap-3 items-start p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
                      <item.icon className={`w-5 h-5 ${item.color}`} strokeWidth={1.8} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                      <p className="text-sm text-gray-500 mt-0.5">{item.detail}</p>
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
                    <div className="text-base font-semibold text-gray-900 mb-1">{item.title}</div>
                    <div className="text-sm text-gray-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 카카오맵 비즈니스 프로필 안내 (선택 사항) */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5 text-yellow-600" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-yellow-900">카카오맵 비즈니스 프로필도 확인해보세요</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 border border-yellow-300">선택 사항</span>
                  </div>
                  <p className="text-sm text-yellow-800 leading-relaxed mb-2">
                    카카오맵은 한국에서 네이버 다음으로 많이 사용되는 지역 검색 플랫폼입니다.
                    영업시간·전화번호·사진을 등록하면 카카오 AI 검색 노출이 향상됩니다.
                  </p>
                  <a
                    href="https://place.kakao.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-700 hover:text-yellow-900 underline transition-colors"
                  >
                    카카오 플레이스 바로가기 →
                  </a>
                  <p className="text-xs text-yellow-600 mt-1.5">
                    대시보드에서 카카오맵 완성도 체크리스트를 확인할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors"
            >
              다음 →
            </button>
          </div>
        )}

        {/* Step 3: 완료 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
              <Rocket className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">준비 완료!</h1>
            <p className="text-gray-500 text-sm mb-8">
              대시보드에서 첫 AI 스캔을 시작하세요.<br />
              스캔은 약 2~3분 소요됩니다.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 mb-8 text-left">
              <div className="text-sm font-semibold text-blue-800 mb-2">시작 체크리스트</div>
              <ul className="space-y-1.5 text-sm text-blue-700">
                {/* 사업장 등록: step 3에 도달했다면 항상 완료 */}
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>사업장 등록 완료</span>
                </li>
                {/* 첫 AI 스캔: scan_results 조회 결과 반영 */}
                <li className="flex items-start gap-2">
                  {hasFirstScan
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    : <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  }
                  <span className={hasFirstScan ? "text-green-700 font-medium" : ""}>
                    첫 AI 스캔 실행 (대시보드에서)
                  </span>
                </li>
                {/* 경쟁사 등록: competitors 조회 결과 반영 */}
                <li className="flex items-start gap-2">
                  {hasCompetitor
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    : <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  }
                  <span className={hasCompetitor ? "text-green-700 font-medium" : ""}>
                    경쟁사 최소 1개 등록
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  <span>카카오 알림 수신 번호 등록 (설정)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                  <span>
                    카카오맵 완성도 체크리스트 확인 (대시보드){" "}
                    <span className="text-xs text-blue-500 font-normal">(선택)</span>
                  </span>
                </li>
              </ul>
            </div>
            <button
              onClick={handleComplete}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              대시보드로 이동 →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
