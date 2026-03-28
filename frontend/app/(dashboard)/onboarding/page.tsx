"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createBusiness } from "@/lib/api";
import { Sparkles, Search, Clock, BarChart2, Smartphone, Rocket } from "lucide-react";

import { CATEGORY_GROUPS } from "@/lib/categories";

const STEPS = [
  { id: 1, label: "사업장 등록",  desc: "내 가게 정보 입력" },
  { id: 2, label: "첫 스캔 안내", desc: "AI 스캔 방법 확인" },
  { id: 3, label: "시작하기",     desc: "대시보드로 이동" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "restaurant",
    region: "",
    address: "",
    phone: "",
    website: "",
    keywords: "",
    naver_place_id: "",
  });

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      await createBusiness({
        ...form,
        keywords: form.keywords ? form.keywords.split(",").map(k => k.trim()).filter(Boolean) : [],
      }, user.id);
      setStep(2);
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
            <h1 className="text-xl font-bold text-gray-900 mb-1">내 가게 정보를 입력해주세요</h1>
            <p className="text-sm text-gray-500 mb-6">AI 스캔에 사용될 기본 정보입니다.</p>
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
                    {CATEGORY_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>{g.emoji} {g.label}</option>
                    ))}
                  </select>
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
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="text-center mb-6">
              <Sparkles className="w-10 h-10 text-blue-500 mx-auto mb-3" strokeWidth={1.5} />
              <h1 className="text-xl font-bold text-gray-900 mb-2">사업장 등록 완료!</h1>
              <p className="text-sm text-gray-500">이제 AI 스캔을 시작하는 방법을 알려드릴게요.</p>
            </div>
            <div className="space-y-4 mb-8">
              {[
                {
                  Icon: Search,
                  title: "AI 스캔이란?",
                  desc: "ChatGPT·네이버 AI·Google 등 8개 AI에서 내 가게를 100회 검색해 노출 빈도를 측정합니다.",
                },
                {
                  Icon: Clock,
                  title: "첫 스캔은 언제?",
                  desc: "등록 직후 자동으로 Before 스크린샷이 저장됩니다. 대시보드에서 지금 바로 수동 스캔을 시작할 수 있습니다.",
                },
                {
                  Icon: BarChart2,
                  title: "결과는 어디서?",
                  desc: "대시보드에서 AI Visibility Score, 경쟁사 비교, 30일 추세를 확인할 수 있습니다.",
                },
                {
                  Icon: Smartphone,
                  title: "카카오톡 알림",
                  desc: "설정에서 전화번호를 등록하면 점수 변화·AI 인용 등 5가지 알림을 받을 수 있습니다.",
                },
              ].map(item => (
                <div key={item.title} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                  <item.Icon className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-0.5">{item.title}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              다음 →
            </button>
          </div>
        )}

        {/* Step 3: 완료 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Rocket className="w-12 h-12 text-blue-500 mx-auto mb-4" strokeWidth={1.5} />
            <h1 className="text-xl font-bold text-gray-900 mb-2">준비 완료!</h1>
            <p className="text-gray-500 text-sm mb-8">
              대시보드에서 첫 AI 스캔을 시작하세요.<br />
              스캔은 약 2~3분 소요됩니다.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 mb-8 text-left">
              <div className="text-sm font-semibold text-blue-800 mb-2">시작 체크리스트</div>
              <ul className="space-y-1.5 text-sm text-blue-700">
                <li className="flex gap-2"><span>✓</span> 사업장 등록 완료</li>
                <li className="flex gap-2"><span>○</span> 첫 AI 스캔 실행 (대시보드에서)</li>
                <li className="flex gap-2"><span>○</span> 경쟁사 최소 1개 등록</li>
                <li className="flex gap-2"><span>○</span> 카카오 알림 수신 번호 등록 (설정)</li>
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
