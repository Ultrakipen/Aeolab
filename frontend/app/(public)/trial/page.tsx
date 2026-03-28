"use client";

import { useState } from "react";
import { trialScan } from "@/lib/api";
import { TrialScanResult } from "@/types";
import Link from "next/link";
import { CATEGORY_GROUPS, CATEGORY_MAP } from "@/lib/categories";
import { CATEGORY_ICON_MAP } from "@/lib/categoryIcons";
import { ApiError } from "@/lib/api";
import { ChevronLeft } from "lucide-react";

const BREAKDOWN_LABELS: Record<string, string> = {
  exposure_freq:     "AI 노출 빈도",
  review_quality:    "리뷰 품질",
  schema_score:      "Schema 구조화",
  online_mentions:   "온라인 언급",
  info_completeness: "정보 완성도",
  content_freshness: "콘텐츠 최신성",
};

const SCAN_STEPS = [
  "Gemini AI 접속",
  "검색어 생성",
  "AI 응답 분석",
  "노출 여부 판단",
  "점수 계산",
];

type Step = "category" | "tags" | "info" | "scanning" | "result";

const TRIAL_LS_KEY = "aeolab_trial_used_at";
const TRIAL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24시간

function getTrialCooldownRemaining(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(TRIAL_LS_KEY);
  if (!raw) return 0;
  const diff = TRIAL_COOLDOWN_MS - (Date.now() - Number(raw));
  return diff > 0 ? diff : 0;
}

function formatCooldown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export default function TrialPage() {
  const [step, setStep] = useState<Step>("category");
  const [result, setResult] = useState<TrialScanResult | null>(null);
  const [error, setError] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [cooldownMs, setCooldownMs] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [form, setForm] = useState({
    business_name: "",
    region: "",
    extra_keyword: "",
    email: "",
  });

  // 마운트 시 쿨다운 확인
  useState(() => {
    setCooldownMs(getTrialCooldownRemaining());
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const buildKeyword = () => {
    const tags = selectedTags.slice(0, 3).join(" ");
    return form.extra_keyword
      ? `${tags} ${form.extra_keyword}`.trim()
      : tags;
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    // 클라이언트 쿨다운 체크
    const remaining = getTrialCooldownRemaining();
    if (remaining > 0) {
      setCooldownMs(remaining);
      setError(`오늘 무료 체험을 이미 사용하셨습니다. ${formatCooldown(remaining)} 후 다시 이용하거나 회원가입 후 전체 분석을 이용하세요.`);
      return;
    }
    setError("");
    setStep("scanning");
    setScanStep(0);

    const stepInterval = setInterval(() => {
      setScanStep((prev) => {
        if (prev < SCAN_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 600);

    try {
      const keyword = buildKeyword();
      const data = await trialScan({
        business_name: form.business_name,
        category: selectedCategory,
        region: form.region,
        keyword: keyword || undefined,
        email: form.email || undefined,
      });
      clearInterval(stepInterval);
      setScanStep(SCAN_STEPS.length - 1);
      // 성공 시 쿨다운 기록
      if (typeof window !== "undefined") {
        localStorage.setItem(TRIAL_LS_KEY, String(Date.now()));
      }
      setResult(data);
      setStep("result");
    } catch (err: unknown) {
      clearInterval(stepInterval);
      if (err instanceof ApiError && err.code === "TRIAL_LIMIT") {
        setError("하루 무료 체험 한도(3회)에 도달했습니다. 내일 다시 시도하거나 회원가입 후 전체 분석을 이용하세요.");
        if (typeof window !== "undefined") {
          localStorage.setItem(TRIAL_LS_KEY, String(Date.now()));
        }
      } else {
        setError("스캔 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
      setStep("info");
    }
  };

  const gradeColor = (grade: string) => {
    const map: Record<string, string> = {
      A: "text-green-500", B: "text-blue-500",
      C: "text-yellow-500", D: "text-orange-500", F: "text-red-500",
    };
    return map[grade] ?? "text-gray-500";
  };

  const reset = () => {
    setStep("category");
    setResult(null);
    setSelectedCategory("");
    setSelectedTags([]);
    setForm({ business_name: "", region: "", extra_keyword: "", email: "" });
    setScanStep(0);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
          <span className="text-sm text-gray-500">무료 AI 노출 진단</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-10 px-4">

        {/* 단계 표시 */}
        {step !== "scanning" && step !== "result" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[
              { key: "category", label: "업종" },
              { key: "tags", label: "서비스" },
              { key: "info", label: "정보 입력" },
            ].map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
                  step === s.key
                    ? "bg-blue-600 text-white"
                    : ["category", "tags", "info"].indexOf(step) > i
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  <span>{i + 1}</span>
                  <span>{s.label}</span>
                </div>
                {i < 2 && <div className="w-4 h-px bg-gray-300" />}
              </div>
            ))}
          </div>
        )}

        {/* 1단계: 업종 선택 */}
        {step === "category" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">
              어떤 업종인가요?
            </h1>
            <p className="text-gray-500 text-center text-sm mb-6">
              가장 가까운 업종을 선택하세요
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {CATEGORY_GROUPS.map((cat) => {
                const cfg = CATEGORY_ICON_MAP[cat.value];
                const Icon = cfg?.Icon;
                return (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setSelectedCategory(cat.value);
                      setSelectedTags([]);
                      setStep("tags");
                    }}
                    className={`flex items-center gap-3 bg-white rounded-xl p-3.5 border-2 border-gray-100 hover:border-current hover:shadow-sm transition-all text-left group ${cfg?.text ?? ''}`}
                  >
                    {Icon && (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.text}`} strokeWidth={1.8} />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-gray-800 leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2단계: 서비스 태그 선택 */}
        {step === "tags" && selectedCategory && (
          <div>
            <button
              onClick={() => setStep("category")}
              className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> 업종 다시 선택
            </button>
            {(() => {
              const cfg = CATEGORY_ICON_MAP[selectedCategory];
              const Icon = cfg?.Icon;
              return (
                <div className="flex items-center gap-2.5 mb-1">
                  {Icon && (
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon className={`w-5 h-5 ${cfg.text}`} strokeWidth={1.8} />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-gray-900">
                    {CATEGORY_MAP[selectedCategory]?.label}
                  </h2>
                </div>
              );
            })()}
            <p className="text-sm text-gray-500 mb-4">
              해당하는 서비스를 모두 선택하세요 <span className="text-blue-500">(복수 선택 가능)</span>
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORY_MAP[selectedCategory]?.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedTags.includes(tag)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {selectedTags.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm text-blue-700">
                선택한 서비스: <strong>{selectedTags.join(", ")}</strong>
              </div>
            )}

            <button
              onClick={() => setStep("info")}
              disabled={selectedTags.length === 0}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              다음 →
            </button>
            <p className="text-xs text-center text-gray-400 mt-2">서비스를 1개 이상 선택하세요</p>
          </div>
        )}

        {/* 3단계: 정보 입력 */}
        {step === "info" && (
          <div>
            <button
              onClick={() => setStep("tags")}
              className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> 서비스 다시 선택
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              사업장 정보를 입력하세요
            </h2>

            {/* 선택 요약 */}
            {(() => {
              const cfg = CATEGORY_ICON_MAP[selectedCategory];
              const Icon = cfg?.Icon;
              return (
                <div className={`rounded-xl p-3 mb-4 flex items-center gap-3 ${cfg?.bg ?? 'bg-gray-50'}`}>
                  {Icon && (
                    <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 ${cfg?.text ?? 'text-gray-600'}`} strokeWidth={1.8} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${cfg?.text ?? 'text-gray-600'}`}>{CATEGORY_MAP[selectedCategory]?.label}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTags.map((t) => (
                        <span key={t} className="bg-white/70 text-gray-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업장 이름 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 홍스튜디오"
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 창원시 성산구"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  추가 키워드 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 야외촬영 가능 / 신생아 전문 / 출장 가능"
                  value={form.extra_keyword}
                  onChange={(e) => setForm({ ...form, extra_keyword: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  가게만의 특징을 입력하면 더 정확한 분석이 가능합니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-gray-400 font-normal">(결과 발송, 선택)</span>
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
                AI 노출 진단 시작 (무료)
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
              &ldquo;{form.region} {selectedTags[0]} 추천&rdquo; 검색어로 Gemini를 확인하고 있습니다.
            </p>
            <div className="max-w-xs mx-auto space-y-2">
              {SCAN_STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
                    i < scanStep ? "text-green-600 bg-green-50"
                      : i === scanStep ? "text-blue-600 bg-blue-50 font-medium"
                      : "text-gray-300"
                  }`}
                >
                  {i < scanStep ? <span>✓</span>
                    : i === scanStep ? <span className="w-3 h-3 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin inline-block" />
                    : <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />}
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 결과 */}
        {step === "result" && result && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">진단 결과</h2>

            {/* 측정 신뢰도 */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-yellow-800">측정 신뢰도</span>
                <span className="text-sm font-bold text-yellow-800">1 / 100회</span>
              </div>
              <div className="w-full bg-yellow-200 rounded-full h-3 mb-2">
                <div className="bg-yellow-500 h-3 rounded-full" style={{ width: "1%" }} />
              </div>
              <p className="text-xs text-yellow-700">
                손님 <strong>1명</strong>에게만 물어본 결과입니다.
                구독하면 <strong>100명</strong>에게 물어봐 정확한 노출 확률을 알 수 있습니다.
              </p>
            </div>

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
                            className="bg-blue-500 h-1.5 rounded-full"
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

            {/* 잠긴 기능 */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl">
                <div className="text-3xl mb-2">🔒</div>
                <div className="text-sm font-bold text-gray-800 mb-1">구독 시 확인 가능</div>
                <div className="text-xs text-gray-500 text-center px-4">
                  8개 AI × 100회 측정으로 정확한 노출 확률과<br />경쟁사 대비 순위를 확인하세요
                </div>
              </div>
              <div className="text-xs font-medium text-gray-400 mb-3">구독 전용 분석</div>
              <div className="space-y-3 opacity-30 select-none">
                <div className="flex justify-between"><span className="text-sm">ChatGPT 노출율</span><span className="font-bold">??%</span></div>
                <div className="flex justify-between"><span className="text-sm">네이버 AI 브리핑</span><span className="font-bold">??%</span></div>
                <div className="flex justify-between"><span className="text-sm">경쟁사 대비 순위</span><span className="font-bold">?위</span></div>
                <div className="flex justify-between"><span className="text-sm">AI 개선 가이드</span><span className="font-bold text-blue-500">보기 →</span></div>
              </div>
            </div>

            {/* CTA */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
              <p className="font-bold text-amber-900 mb-1 text-lg">
                {result.result.gemini?.mentioned
                  ? "AI에 나오고 있지만, 경쟁사보다 자주 나오나요?"
                  : "AI 검색에 내 가게가 보이지 않습니다"}
              </p>
              <p className="text-sm text-amber-700 mb-3">
                지금 결과는 손님 <strong>1명</strong>에게 물어본 것입니다.<br />
                구독하면 <strong>8개 AI × 100명</strong>에게 물어봐 정확한 노출 확률과
                경쟁사 격차를 알 수 있습니다.
              </p>
              <ul className="text-sm text-amber-700 mb-4 space-y-1">
                <li>✓ ChatGPT·Perplexity·네이버 AI 등 8개 플랫폼 동시 분석</li>
                <li>✓ 경쟁사 대비 내 가게 순위 확인</li>
                <li>✓ AI 노출을 높이는 맞춤 개선 가이드</li>
                <li>✓ 매일 자동 스캔 + 카카오톡 알림</li>
              </ul>
              <Link
                href="/signup"
                className="block w-full bg-amber-600 text-white rounded-lg py-3 font-semibold text-center hover:bg-amber-700 transition-colors"
              >
                월 9,900원으로 정확한 분석 시작하기 →
              </Link>
              <p className="text-xs text-amber-600 text-center mt-2">언제든 해지 가능 · 첫 달 무료</p>
            </div>

            <button
              onClick={reset}
              className="w-full border border-gray-300 text-gray-600 py-3 rounded-xl hover:bg-gray-50 text-sm"
            >
              다른 사업장 진단하기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
