"use client";
import { useState, useEffect } from "react";
import { apiBase } from "@/lib/api";
import { getSafeSession } from "@/lib/supabase/client";
import { FLAT_CATEGORY_GROUPS } from "@/lib/categories";
import { StartupReportView, type StartupReport } from "./StartupReportView";

// 마지막 분석 결과를 브라우저에 저장 — 페이지 이동 후 돌아오면 재입력·재생성 없이
// 바로 보이도록 함(2026-09-01 신설). 서버 캐시(24h)와 동일한 유효기간을 써서, 캐시가
// 만료된 뒤에는 복원하지 않고 빈 폼을 보여줌(오래된 결과를 최신인 것처럼 보여주지 않기 위함).
//
// ⚠️ 저장 키에 사용자 id를 반드시 포함할 것 — 최초 구현(고정 키 "aeolab_startup_report_v1")은
// 라이브 재현 확인 결과, 같은 브라우저에서 계정 A로 분석 후 로그아웃→계정 B로 재로그인하면
// B가 A의 분석 결과를 그대로 보는 정합성 버그가 있었음(2026-09-01 실측 재현). localStorage는
// 로그인 세션과 무관하게 도메인 단위로 유지되므로, 로그아웃 시 별도로 지우지 않는 한
// 계정별로 반드시 키를 분리해야 함.
const STORAGE_KEY_PREFIX = "aeolab_startup_report_v1";
const LEGACY_STORAGE_KEY = "aeolab_startup_report_v1"; // 사용자 미분리 구버전 키 — 발견 시 정리만
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

type SavedReport = {
  category: string;
  region: string;
  bizName: string;
  compareRegion: string;
  report: StartupReport;
  savedAt: number;
};

function loadSavedReport(userId: string): SavedReport | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedReport;
    if (!parsed?.report || !parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}:${userId}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function StartupClient() {
  const [category, setCategory] = useState("restaurant");
  const [region, setRegion] = useState("");
  const [bizName, setBizName] = useState("");
  const [compareRegion, setCompareRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<StartupReport | null>(null);
  const [error, setError] = useState("");
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY); // 사용자 미분리 구버전 키 정리
      } catch {
        // 저장소 접근 불가(프라이빗 브라우징 등) — 무시
      }
      const session = await getSafeSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const saved = loadSavedReport(uid);
      if (!saved) return;
      setCategory(saved.category);
      setRegion(saved.region);
      setBizName(saved.bizName);
      setCompareRegion(saved.compareRegion || "");
      setReport(saved.report);
      setRestoredAt(saved.savedAt);
    })();
  }, []);

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
        body: JSON.stringify({
          category,
          region: region.trim(),
          business_name: bizName.trim(),
          compare_region: compareRegion.trim(),
        }),
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
      setRestoredAt(null);
      try {
        const uid = session?.user?.id;
        if (!uid) throw new Error("no user id");
        const saved: SavedReport = {
          category, region: region.trim(), bizName: bizName.trim(),
          compareRegion: compareRegion.trim(), report: data, savedAt: Date.now(),
        };
        window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:${uid}`, JSON.stringify(saved));
      } catch {
        // 저장 실패(프라이빗 브라우징·용량 초과 등)해도 화면 표시엔 영향 없음 — 무시
      }
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
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">비교할 지역 (선택)</label>
          <input
            value={compareRegion}
            onChange={(e) => setCompareRegion(e.target.value)}
            placeholder="예: 다른 후보 상권 (예: 홍대)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">입력하면 이 지역의 상권 밀도를 비교 지역과 실측으로 비교해서 보여드립니다. 전국 평균은 농어촌 지역에 왜곡되어 사용하지 않습니다.</p>
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
        <>
          {restoredAt && (
            <p className="text-sm text-gray-500 mb-3">
              마지막 분석 결과를 불러왔습니다 ({new Date(restoredAt).toLocaleString("ko-KR")} 생성) — 다시 분석하려면 위 버튼을 눌러주세요.
            </p>
          )}
          <StartupReportView report={report} />
        </>
      )}
    </div>
  );
}
