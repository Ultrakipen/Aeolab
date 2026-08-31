"use client";
import { useState } from "react";
import { apiBase } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import { FLAT_CATEGORY_GROUPS } from "@/lib/categories";
import { StartupReportView, type StartupReport } from "./StartupReportView";

export function StartupClient() {
  const [category, setCategory] = useState("restaurant");
  const [region, setRegion] = useState("");
  const [bizName, setBizName] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StartupReport | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!region.trim()) { setError("지역을 입력해주세요"); return; }
    setLoading(true);
    setError("");
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      if (!token) {
        setError("로그인이 필요합니다. 페이지를 새로고침 후 다시 시도해주세요.");
        setLoading(false);
        return;
      }
      const res = await fetch(`${apiBase}/api/startup/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, region: region.trim(), business_name: bizName.trim() }),
      });
      if (res.status === 403) {
        setError("창업 패키지(startup) 이상의 구독이 필요합니다.");
        return;
      }
      if (res.status === 429) {
        const errData = await res.json().catch(() => null);
        setError(errData?.detail?.message || "이번 달 창업 시장 분석 생성 한도를 초과했습니다. 다음 달에 다시 이용하실 수 있습니다.");
        return;
      }
      if (res.status === 409) {
        setError("이미 창업 시장 분석이 생성 중입니다. 완료 후 다시 시도해주세요.");
        return;
      }
      if (!res.ok) {
        setError("분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const data = await res.json();
      setReport(data);
    } catch {
      setError("분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">창업 시장 분석</h1>
      <p className="text-sm text-gray-500 mb-4">실제 상권 규모·트렌드 분석 + 진입 전략 (창업 패키지·Biz 전용, Enterprise는 별도 문의)</p>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-900 leading-relaxed">
        <p className="font-semibold mb-1">이 기능은 이렇게 활용하세요</p>
        <p>창업하려는 <b>업종과 지역</b>을 입력하면, 국세청·카드사 등록 통계(또는 카카오맵 실측)로 <b>실제 상권 규모·밀도</b>와 <b>네이버 검색 수요 트렌드</b>를 보여주고, Claude AI가 이를 바탕으로 진입 전략을 제안합니다. 데이터가 부족한 지역·업종은 그 사실을 명시하며, &quot;경쟁이 없다&quot;고 단정하지 않습니다.</p>
      </div>

      {/* 입력 폼 */}
      <section className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">업종</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {FLAT_CATEGORY_GROUPS.map((g) => (
                <optgroup key={g.groupLabel} label={g.groupLabel}>
                  {g.items.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">지역</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예: 서울 강남"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">시·구 단위로 입력하세요 (예: &quot;강남&quot;, &quot;강남구&quot;, &quot;서울 강남구&quot; 모두 동일하게 인식)</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">예정 사업장명 (선택)</label>
          <input
            value={bizName}
            onChange={(e) => setBizName(e.target.value)}
            placeholder="예: 강남 홍길동 식당"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px] w-full sm:w-auto"
        >
          {loading ? "분석 중..." : "시장 분석 시작"}
        </button>
      </section>

      {/* 결과 */}
      {report && (
        <StartupReportView report={report} />
      )}
    </div>
  );
}
