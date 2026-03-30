"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createBusiness } from "@/lib/api";
import {
  Search, BarChart2, Lightbulb, Bell,
  ChevronRight, Sparkles, Rocket, CheckCircle,
  MapPin, Globe
} from "lucide-react";
import { CATEGORY_GROUPS } from "@/lib/categories";

const STEPS = [
  { id: 1, label: "서비스 소개" },
  { id: 2, label: "사업장 등록" },
  { id: 3, label: "시작하기" },
];

const LOCATION_CATEGORIES = ["food", "health", "education", "beauty", "living", "culture", "accommodation"];
const NON_LOCATION_CATEGORIES = ["professional", "media", "shopping"];

const TRACKS = [
  {
    id: "location_based",
    icon: MapPin,
    title: "오프라인 매장",
    desc: "음식점·카페·병원·학원·미용실 등\n지역 손님을 받는 실제 매장",
    color: "blue",
    example: "강남구 치킨집, 홍대 카페, 서초 치과",
  },
  {
    id: "non_location",
    icon: Globe,
    title: "온라인·전문직",
    desc: "온라인 쇼핑몰·세무사·강사·디자이너 등\n지역 무관, 전국 대상 사업",
    color: "violet",
    example: "스마트스토어, 세무사, 유튜버, 웹개발",
  },
];

const FEATURES = [
  {
    Icon: Search,
    color: "bg-blue-50 text-blue-600",
    title: "AI 검색 노출 분석",
    desc: "ChatGPT, 네이버 AI, Google 등 8개 AI가 내 가게를 검색하는지 100회 실측합니다.",
  },
  {
    Icon: BarChart2,
    color: "bg-violet-50 text-violet-600",
    title: "경쟁사 비교",
    desc: "같은 지역·업종 경쟁 가게와 AI 노출 점수를 나란히 비교해 내 위치를 확인합니다.",
  },
  {
    Icon: Lightbulb,
    color: "bg-amber-50 text-amber-600",
    title: "AI 개선 가이드",
    desc: "점수가 낮은 이유와 오늘 당장 할 수 있는 개선 방법을 AI가 구체적으로 알려줍니다.",
  },
  {
    Icon: Bell,
    color: "bg-green-50 text-green-600",
    title: "카카오톡 자동 알림",
    desc: "매일 새벽 자동 스캔 후 점수 변화·경쟁사 동향을 카카오톡으로 바로 받아보세요.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [track, setTrack] = useState<"location_based" | "non_location" | "">("");
  const [form, setForm] = useState({
    name: "",
    category: "food",
    region: "",
    address: "",
    phone: "",
    website: "",
    keywords: "",
    naver_place_id: "",
  });

  const isLocationBased = track === "location_based" || track === "";
  const filteredCategories = CATEGORY_GROUPS.filter(g =>
    isLocationBased
      ? LOCATION_CATEGORIES.includes(g.value)
      : NON_LOCATION_CATEGORIES.includes(g.value)
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("사업장명은 필수입니다.");
      return;
    }
    if (isLocationBased && !form.region) {
      setError("오프라인 매장은 지역 입력이 필수입니다.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      await createBusiness({
        ...form,
        business_type: track || "location_based",
        keywords: form.keywords ? form.keywords.split(",").map((k: string) => k.trim()).filter(Boolean) : [],
      }, user.id);
      setStep(3);
    } catch (e: any) {
      setError(e.message || "사업장 등록에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ onboarding_done: true }).eq("id", user.id);
    }
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">

        {/* 로고 */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-blue-600">AEOlab</span>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
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

        {/* ── Step 1: 서비스 소개 ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                환영합니다
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                내 가게, AI가 추천하고 있나요?
              </h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                손님 10명 중 3명은 이제 AI에게 가게를 물어봅니다.<br />
                AEOlab은 AI 검색에서 내 가게가 얼마나 보이는지 측정하고<br />
                경쟁 가게보다 더 잘 노출되도록 도와줍니다.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-3 p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${f.color}`}>
                    <f.Icon className="w-4 h-4" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-0.5">{f.title}</div>
                    <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              내 가게 등록하고 시작하기
              <ChevronRight className="w-4 h-4" />
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">무료로 시작 · 언제든 해지 가능</p>
          </div>
        )}

        {/* ── Step 2: 사업장 등록 ── */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <button
              onClick={() => setStep(1)}
              className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
            >
              ← 이전
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">내 가게 정보 입력</h2>
            <p className="text-sm text-gray-500 mb-5">AI 스캔에 사용할 기본 정보입니다. 나중에 수정할 수 있습니다.</p>

            {/* 트랙 선택 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">사업 유형 선택 *</label>
              <div className="grid grid-cols-2 gap-3">
                {TRACKS.map((t) => {
                  const selected = track === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTrack(t.id as "location_based" | "non_location");
                        // 트랙에 맞는 카테고리 기본값 설정
                        const cats = t.id === "location_based" ? LOCATION_CATEGORIES : NON_LOCATION_CATEGORIES;
                        setForm(f => ({ ...f, category: cats[0] }));
                      }}
                      className={`relative p-3.5 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? t.color === "blue"
                            ? "border-blue-500 bg-blue-50"
                            : "border-violet-500 bg-violet-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <t.icon className={`w-4 h-4 ${selected ? (t.color === "blue" ? "text-blue-600" : "text-violet-600") : "text-gray-400"}`} strokeWidth={1.8} />
                        <span className={`text-sm font-semibold ${selected ? (t.color === "blue" ? "text-blue-700" : "text-violet-700") : "text-gray-700"}`}>
                          {t.title}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{t.desc}</p>
                      <p className="text-xs text-gray-400 mt-1.5 truncate">{t.example}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
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
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {filteredCategories.map((g) => (
                      <option key={g.value} value={g.value}>{g.emoji} {g.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    지역 {isLocationBased ? "*" : <span className="text-gray-400 font-normal">(선택)</span>}
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={isLocationBased ? "예: 서울 강남구" : "예: 서울 (선택사항)"}
                    value={form.region}
                    onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                    required={isLocationBased}
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
                    placeholder="010-0000-0000"
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
                  placeholder={isLocationBased
                    ? "예: 맛집, 주차가능, 예약불필요"
                    : "예: 세금신고, 스마트스토어 수익화, 세무상담"
                  }
                  value={form.keywords}
                  onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                />
                {!isLocationBased && (
                  <p className="text-xs text-gray-400 mt-1">
                    AI가 검색할 때 사용할 핵심 키워드입니다. 구체적일수록 정확합니다.
                  </p>
                )}
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? "등록 중..." : "등록 완료 →"}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 3: 완료 ── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">등록 완료!</h2>
            <p className="text-sm text-gray-500 mb-6">
              AI 스캔이 준비됐습니다.<br />
              대시보드에서 첫 번째 스캔을 시작해보세요.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left space-y-2">
              <p className="text-xs font-semibold text-blue-700 mb-2">다음 할 일</p>
              {[
                "대시보드에서 AI 스캔 시작 (약 2~3분)",
                "경쟁 가게 1개 이상 등록",
                "설정에서 카카오 알림 번호 등록",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-blue-700">
                  <div className="w-4 h-4 rounded-full border border-blue-300 flex items-center justify-center shrink-0 text-blue-400">
                    {i + 1}
                  </div>
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={handleComplete}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              대시보드로 이동
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
