const COMPARE_ROWS = [
  {
    label: "측정 채널",
    manual: "ChatGPT·Gemini 등 글로벌 AI만",
    auto: "네이버 AI 브리핑·AI탭 + 글로벌 AI 통합",
  },
  {
    label: "추적 방식",
    manual: "매주 수십 회 직접 질문 필요",
    auto: "자동 추적 + 카카오 알림",
  },
  {
    label: "신뢰도",
    manual: "같은 질문, 매번 다른 답",
    auto: "Gemini·ChatGPT 각 50회 통계 (Basic 플랜 기준)",
  },
  {
    label: "객관성",
    manual: "개인화된 검색 결과",
    auto: "객관적 노출 빈도 측정",
  },
  {
    label: "원인 분석",
    manual: "AI가 이유를 설명 안 함",
    auto: "경쟁사 갭 + 개선 가이드",
  },
];

export default function ChatGPTCompareSection() {
  return (
    <section className="px-4 py-8 md:py-12" style={{ background: "transparent" }}>
      <div className="max-w-[1020px] mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-7 fade-up">
          <p className="text-sm font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
            왜 AEOlab인가요?
          </p>
          <h2
            className="text-2xl md:text-3xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            무료 AI로 직접 하면 되지 않나요?
          </h2>
          <p className="text-sm mt-2 break-keep" style={{ color: "#475569" }}>
            &ldquo;강남 카페 추천해줘&rdquo; — ChatGPT가 답할 때 내 가게가 언급되는지,
            AEOlab은 이걸 50~100회 자동 측정합니다 (Basic 플랜 기준).
            <strong className="block mt-1" style={{ color: "#0F172A" }}>
              ChatGPT·Gemini만 측정하는 다른 서비스와 달리, 네이버 AI까지 함께 다룹니다.
            </strong>
          </p>
        </div>

        {/* 비교 테이블 — PC */}
        <div
          className="hidden md:block rounded-xl overflow-hidden border-2 fade-up"
          style={{ borderColor: "#2563EB", boxShadow: "var(--aeo-shadow)" }}
        >
          {/* 헤더 행 */}
          <div className="grid grid-cols-3 text-sm font-bold" style={{ background: "#FFFFFF" }}>
            <div
              className="px-5 py-3.5 border-r"
              style={{ color: "#64748B", borderColor: "#E2E8F0" }}
            >
              비교 항목
            </div>
            <div
              className="px-5 py-3.5 border-r"
              style={{ color: "#475569", borderColor: "#E2E8F0" }}
            >
              무료 AI 직접 측정
            </div>
            <div
              className="px-5 py-3.5"
              style={{
                color: "#2563EB",
                borderBottom: "2px solid #2563EB",
              }}
            >
              AEOlab 자동 관리
            </div>
          </div>
          {/* 데이터 행 */}
          {COMPARE_ROWS.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-3 text-sm border-t"
              style={{ borderColor: "#E2E8F0" }}
            >
              <div
                className="px-5 py-3.5 font-medium border-r"
                style={{ color: "#1E293B", borderColor: "#E2E8F0", background: "#F8FAFC" }}
              >
                {row.label}
              </div>
              <div
                className="px-5 py-3.5 flex items-center gap-2 border-r"
                style={{ borderColor: "#E2E8F0", background: "#FEF2F2" }}
              >
                <span className="font-bold shrink-0" style={{ color: "#DC2626" }}>✕</span>
                <span style={{ color: "#475569" }}>{row.manual}</span>
              </div>
              <div
                className="px-5 py-3.5 flex items-center gap-2"
                style={{ background: "#EFF6FF" }}
              >
                <span className="font-bold shrink-0" style={{ color: "#059669" }}>✓</span>
                <span className="font-medium" style={{ color: "#0F172A" }}>{row.auto}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 비교 카드 — 모바일 */}
        <div className="md:hidden space-y-3 fade-up">
          {COMPARE_ROWS.map((row, i) => (
            <div
              key={i}
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: "#E2E8F0",
                background: "#FFFFFF",
                boxShadow: "var(--aeo-shadow)",
              }}
            >
              <div
                className="px-4 py-2.5 text-sm font-bold border-b"
                style={{
                  background: "#F8FAFC",
                  borderColor: "#E2E8F0",
                  color: "#475569",
                }}
              >
                {row.label}
              </div>
              <div className="grid grid-cols-2">
                <div className="px-4 py-3 border-r" style={{ borderColor: "#E2E8F0", background: "#FEF2F2" }}>
                  <p className="text-sm font-bold mb-1" style={{ color: "#475569" }}>
                    무료 AI 직접
                  </p>
                  <div className="flex items-start gap-1.5">
                    <span className="text-sm font-bold shrink-0" style={{ color: "#DC2626" }}>✕</span>
                    <p className="text-sm" style={{ color: "#475569" }}>{row.manual}</p>
                  </div>
                </div>
                <div className="px-4 py-3" style={{ background: "#EFF6FF" }}>
                  <p className="text-sm font-bold mb-1" style={{ color: "#2563EB" }}>
                    AEOlab 자동
                  </p>
                  <div className="flex items-start gap-1.5">
                    <span className="text-sm font-bold shrink-0" style={{ color: "#059669" }}>✓</span>
                    <p className="text-sm font-medium" style={{ color: "#0F172A" }}>{row.auto}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 면책 문구 */}
        <p className="text-sm text-gray-500 text-center mt-4 fade-up">
          ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다
        </p>
      </div>
    </section>
  );
}
