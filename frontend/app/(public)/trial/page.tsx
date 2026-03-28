"use client";

import { useState } from "react";
import { trialScan } from "@/lib/api";
import { Category, TrialScanResult } from "@/types";
import Link from "next/link";
import { CATEGORY_GROUPS } from "@/lib/categories";

const BREAKDOWN_LABELS: Record<string, string> = {
  exposure_freq:    "AI 노출 빈도",
  review_quality:   "리뷰 품질",
  schema_score:     "Schema 구조화",
  online_mentions:  "온라인 언급",
  info_completeness:"정보 완성도",
  content_freshness:"콘텐츠 최신성",
};

const SCAN_STEPS = [
  "Gemini AI 접속",
  "검색어 생성",
  "AI 응답 분석",
  "노출 여부 판단",
  "점수 계산",
];

type Step = "input" | "scanning" | "result";

export default function TrialPage() {
  const [step, setStep] = useState<Step>("input");
  const [result, setResult] = useState<TrialScanResult | null>(null);
  const [error, setError] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [form, setForm] = useState({
    business_name: "",
    category: "restaurant" as Category,
    region: "",
    keyword: "",
    email: "",
  });

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("scanning");
    setScanStep(0);

    // 단계별 프로그레스 시뮬레이션
    const stepInterval = setInterval(() => {
      setScanStep((prev) => {
        if (prev < SCAN_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 600);

    try {
      const scanData = { ...form, keyword: form.keyword || undefined };
      const data = await trialScan(scanData);
      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length - 1);
      setResult(data);
      setStep("result");
    } catch {
      clearInterval(stepInterval);
      setError("스캔 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setStep("input");
    }
  };

  const gradeColor = (grade: string) => {
    const map: Record<string, string> = {
      A: "text-green-500", B: "text-blue-500",
      C: "text-yellow-500", D: "text-orange-500", F: "text-red-500",
    };
    return map[grade] ?? "text-gray-500";
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
          <span className="text-sm text-gray-500">무료 AI 노출 진단 (1회)</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-12 px-4">

        {/* 입력 단계 */}
        {step === "input" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">
              내 가게 AI 노출 진단
            </h1>
            <p className="text-gray-500 text-center text-sm mb-8">
              Gemini AI로 내 가게가 추천되는지 1회 무료로 확인하세요.
            </p>

            {/* 1회 vs 100회 설명 */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <div className="text-sm font-semibold text-blue-800 mb-2">이 체험은 1회 스캔입니다</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white rounded-lg p-3">
                  <div className="font-medium text-gray-700 mb-1">무료 체험 (지금)</div>
                  <div className="text-gray-400">Gemini AI 1회만 확인</div>
                  <div className="text-gray-400">노출 여부만 판단 가능</div>
                </div>
                <div className="bg-blue-600 rounded-lg p-3 text-white">
                  <div className="font-medium mb-1">구독 (월 9,900원)</div>
                  <div className="text-blue-100">6개 AI × 100회 샘플링</div>
                  <div className="text-blue-100">정확한 노출 확률 측정</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleScan} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업장 이름 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 강남 맛있는 치킨"
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">업종 *</label>
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORY_GROUPS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 (구/동 단위) *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 강남구, 마포구, 홍대"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  실제 서비스 키워드 <span className="text-gray-400 font-normal">(선택 — 더 정확한 분석)</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 결혼식 촬영 / 돌잔치 사진 / 행사 사진촬영"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  실제 제공하는 서비스를 입력하세요. 업종 선택보다 정확한 분석이 가능합니다.<br/>
                  입력 예시: <span className="text-gray-500">강남 헤어샵 / 여성 커트 전문 / 염색 펌</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-gray-400 font-normal">(결과 발송·업데이트 알림, 선택)</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
              >
                AI 노출 진단 시작
              </button>
            </form>
          </div>
        )}

        {/* 스캔 단계 */}
        {step === "scanning" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-gray-900 mb-1">AI 검색 분석 중...</h2>
            <p className="text-gray-500 text-sm mb-8">
              &ldquo;{form.region} {form.category} 추천&rdquo; 검색어로 Gemini를 확인하고 있습니다.
            </p>
            <div className="max-w-xs mx-auto space-y-2">
              {SCAN_STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
                    i < scanStep
                      ? "text-green-600 bg-green-50"
                      : i === scanStep
                      ? "text-blue-600 bg-blue-50 font-medium"
                      : "text-gray-300"
                  }`}
                >
                  {i < scanStep ? (
                    <span>✓</span>
                  ) : i === scanStep ? (
                    <span className="w-3 h-3 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin inline-block" />
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
                  )}
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 결과 단계 */}
        {step === "result" && result && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">진단 결과</h2>

            {/* 핵심 점수 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className={`text-5xl font-bold ${gradeColor(result.score.grade)}`}>
                    {result.score.grade}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {Math.round(result.score.total_score)}점
                  </div>
                  <div className="text-xs text-gray-400">AI Visibility Score / 100점</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${
                    result.result.gemini?.mentioned ? "text-green-600" : "text-red-500"
                  }`}>
                    {result.result.gemini?.mentioned ? "AI에 노출됨" : "AI 미노출"}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    검색어: &ldquo;{result.query}&rdquo;
                  </div>
                  {result.result.gemini?.excerpt && (
                    <div className="text-xs text-gray-500 mt-2 max-w-48 text-right leading-relaxed">
                      &ldquo;{result.result.gemini.excerpt.slice(0, 60)}...&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* 항목별 점수 */}
              {result.score.breakdown && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs font-medium text-gray-500 mb-3">항목별 분석</div>
                  <div className="space-y-2">
                    {Object.entries(result.score.breakdown).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-3">
                        <div className="text-xs text-gray-600 w-28 shrink-0">
                          {BREAKDOWN_LABELS[key] ?? key}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Number(value))}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-400 w-8 text-right">
                          {Math.round(Number(value))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 1회 vs 100회 비교 설명 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                이 결과는 1회 스캔입니다
              </div>
              <p className="text-xs text-gray-500 mb-3">
                AI 답변은 매번 달라집니다. 1회 결과만으로는 실제 노출 확률을 알 수 없습니다.
                같은 질문을 100번 해야 &ldquo;30%의 확률로 노출된다&rdquo;는 통계가 나옵니다.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  { label: "1회 스캔", value: "노출 여부만", color: "bg-gray-100 text-gray-600" },
                  { label: "100회 샘플링", value: "정확한 확률", color: "bg-blue-50 text-blue-700" },
                  { label: "경쟁사 비교", value: "격차 분석", color: "bg-blue-50 text-blue-700" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg p-2 ${item.color}`}>
                    <div className="font-medium">{item.label}</div>
                    <div className="opacity-70">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 업그레이드 CTA — 점수 맞춤형 메시지 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
              <p className="font-semibold text-amber-800 mb-1">
                지금 보이는 점수는 AI 1개가 1번 검색한 결과입니다
              </p>
              <p className="text-sm text-amber-700 mb-3">
                구독하면 <strong>8개 AI × 100회 = 800회 측정</strong>으로
                오차 ±3% 이내의 정확한 AI 노출 점수를 받습니다
              </p>
              <ul className="text-sm text-amber-700 mb-4 space-y-1">
                <li>• ChatGPT·Perplexity·Grok·네이버 AI 등 8개 플랫폼 동시 분석</li>
                <li>• 경쟁사{result.score.total_score > 60 ? " 앞서는" : " 추월하는"} 맞춤 개선 전략 제공</li>
                <li>• 매일 자동 스캔 + 카카오톡 알림</li>
              </ul>
              <Link
                href="/signup"
                className="block w-full bg-amber-600 text-white rounded-lg py-3 font-semibold text-center hover:bg-amber-700 transition-colors"
              >
                월 9,900원으로 정확한 분석 시작하기 →
              </Link>
            </div>

            <button
              onClick={() => { setStep("input"); setResult(null); setScanStep(0); }}
              className="w-full border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              다른 사업장 진단하기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
