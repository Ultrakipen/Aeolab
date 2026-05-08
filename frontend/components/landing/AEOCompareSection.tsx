import { Check as CheckIcon } from "lucide-react";

const FEATURES = [
  { label: "AI 추천 최적화", seo: false, naver: false, aeo: true },
  { label: "AI 브리핑 키워드 갭", seo: false, naver: false, aeo: true },
  { label: "경쟁사 AI 노출 비교", seo: false, naver: false, aeo: true },
  { label: "주간 자동 추적", seo: false, naver: false, aeo: true },
  { label: "ChatGPT·Gemini 관리", seo: false, naver: false, aeo: true },
  { label: "네이버 플레이스 관리", seo: false, naver: true, aeo: true },
  { label: "검색 키워드 관리", seo: true, naver: false, aeo: true },
];

function FeatureCheck({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckIcon className="w-4 h-4" style={{ color: "#059669" }} />
  ) : (
    <span className="block w-4 border-t mx-auto" style={{ borderColor: "#CBD5E1" }} />
  );
}

export default function AEOCompareSection() {
  return (
    <section className="px-4 py-8 md:py-12" style={{ background: "#FFFFFF" }}>
      <div className="max-w-[1020px] mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-7 fade-up">
          <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
            서비스 비교
          </p>
          <h2
            className="text-xl md:text-2xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            기존 방법과 무엇이 다른가요?
          </h2>
        </div>

        {/* PC 3열 비교 */}
        <div className="hidden md:grid grid-cols-3 gap-3 fade-up">
          {/* 기존 SEO */}
          <div
            className="card-hover rounded-2xl border p-5"
            style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}
          >
            <p className="text-xs font-bold tracking-wider mb-1" style={{ color: "#64748B" }}>
              기존 SEO 서비스
            </p>
            <p className="text-base font-black mb-4" style={{ color: "#94A3B8" }}>웹 검색 최적화</p>
            <div className="space-y-3">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#94A3B8" }}>{f.label}</span>
                  <FeatureCheck ok={f.seo} />
                </div>
              ))}
            </div>
          </div>

          {/* 네이버 플레이스 */}
          <div
            className="card-hover rounded-2xl border p-5"
            style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}
          >
            <p className="text-xs font-bold tracking-wider mb-1" style={{ color: "#64748B" }}>
              네이버 플레이스 관리
            </p>
            <p className="text-base font-black mb-4" style={{ color: "#94A3B8" }}>플레이스 최적화</p>
            <div className="space-y-3">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#94A3B8" }}>{f.label}</span>
                  <FeatureCheck ok={f.naver} />
                </div>
              ))}
            </div>
          </div>

          {/* AEOlab — 강조 (그라디언트 테두리) */}
          <div
            className="card-hover gradient-border-card p-5 relative"
            style={{
              background: "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)",
              boxShadow: "0 0 0 3px rgba(37,99,235,0.07), 0 10px 40px rgba(37,99,235,0.12)",
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: "#2563EB", color: "#FFFFFF" }}
            >
              추천
            </div>
            <p className="text-xs font-bold tracking-wider mb-1" style={{ color: "#2563EB" }}>
              AEOlab
            </p>
            <p className="text-base font-black mb-4" style={{ color: "#0F172A" }}>AI 노출 통합 관리</p>
            <div className="space-y-3">
              {FEATURES.map((f) => (
                <div key={f.label} className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{f.label}</span>
                  <FeatureCheck ok={f.aeo} />
                </div>
              ))}
            </div>
            <a
              href="/trial"
              className="block w-full mt-5 py-2.5 rounded-xl text-sm font-bold text-white text-center transition-colors hover:bg-[#1D4ED8]"
              style={{ background: "#2563EB" }}
            >
              무료로 시작하기 →
            </a>
          </div>
        </div>

        {/* 모바일 — 간소화 카드 */}
        <div className="md:hidden fade-up">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)",
              border: "1.5px solid #2563EB",
              boxShadow: "var(--aeo-shadow-lg)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#2563EB", color: "#FFFFFF" }}
              >
                AEOlab만의 기능
              </span>
            </div>
            <div className="space-y-2.5">
              {FEATURES.filter((f) => f.aeo && !f.naver && !f.seo).map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <CheckIcon className="w-4 h-4 shrink-0" style={{ color: "#059669" }} />
                  <span className="text-sm font-medium" style={{ color: "#0F172A" }}>{f.label}</span>
                </div>
              ))}
              {FEATURES.filter((f) => f.naver || f.seo).map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <CheckIcon className="w-4 h-4 shrink-0" style={{ color: "#059669" }} />
                  <span className="text-sm" style={{ color: "#475569" }}>{f.label} (기존 포함)</span>
                </div>
              ))}
            </div>
            <a
              href="/trial"
              className="block w-full mt-5 py-3 rounded-xl text-sm font-bold text-white text-center transition-colors hover:bg-[#1D4ED8]"
              style={{ background: "#2563EB" }}
            >
              무료로 시작하기 →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
