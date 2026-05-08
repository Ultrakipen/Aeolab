const TREND_POINTS = [70, 63, 68, 72, 67, 74, 78];
const TREND_LABELS = ["5주전", "4주전", "3주전", "2주전", "지난주", "", "이번주"];

function TrendSvg() {
  const w = 200;
  const h = 48;
  const pad = 8;
  const min = Math.min(...TREND_POINTS);
  const max = Math.max(...TREND_POINTS);
  const range = max - min || 1;
  const pts = TREND_POINTS.map((v, i) => {
    const x = pad + (i / (TREND_POINTS.length - 1)) * (w - pad * 2);
    const y = pad + ((max - v) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const areaPath = `M ${pts[0]} L ${pts.join(" L ")} L ${pad + (w - pad * 2)},${h} L ${pad},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <path d={areaPath} fill="rgba(37,99,235,0.08)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 마지막 점 강조 */}
      <circle
        cx={pts[pts.length - 1].split(",")[0]}
        cy={pts[pts.length - 1].split(",")[1]}
        r="3"
        fill="#2563EB"
      />
    </svg>
  );
}

export default function DashboardPreview() {
  return (
    <section className="px-4 py-8 md:py-12" style={{ background: "transparent" }}>
      <div className="max-w-[1020px] mx-auto">
        <div className="text-center mb-7 fade-up">
          <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "#2563EB" }}>
            대시보드 미리보기
          </p>
          <h2
            className="text-xl md:text-2xl font-black tracking-tight break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.6px" }}
          >
            매주 이런 정보를 받게 됩니다
          </h2>
        </div>

        {/* 미니 대시보드 카드 — PC: 3열, 모바일: 2열+1열 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 fade-up">
          {/* 카카오 알림 말풍선 */}
          <div
            className="col-span-2 md:col-span-1 rounded-2xl p-4 border"
            style={{ background: "#FAE100", borderColor: "#D4B800", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-xs font-bold mb-3" style={{ color: "#5B4A00" }}>카카오 알림톡 예시</p>
            <div
              className="rounded-xl p-3.5"
              style={{ background: "rgba(255,255,255,0.7)" }}
            >
              <p className="text-xs font-bold mb-1" style={{ color: "#0F172A" }}>AEOlab 주간 리포트</p>
              <p className="text-xs leading-relaxed" style={{ color: "#1E293B" }}>
                이번 주 AI 노출 점수: <strong>78점</strong> (+6점 상승)<br />
                ChatGPT 언급: 31회 → 38회<br />
                경쟁사 대비: 상위 35%
              </p>
            </div>
            <p className="text-xs mt-2 text-center" style={{ color: "#5B4A00" }}>
              노출 변화 시 자동 발송 · 예시
            </p>
          </div>

          {/* 네이버 점수 */}
          <div
            className="rounded-2xl p-4 border"
            style={{ background: "#EFF6FF", borderColor: "#BFDBFE", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#2563EB" }}>
              Track 1 · 네이버
            </p>
            <p
              className="text-3xl font-black mb-0.5"
              style={{ color: "#2563EB", fontFamily: "Outfit, sans-serif", letterSpacing: "-1px" }}
            >
              52
            </p>
            <div className="w-full rounded-full h-1.5 mb-1" style={{ background: "#BFDBFE" }}>
              <div className="h-1.5 rounded-full" style={{ width: "52%", background: "#2563EB" }} />
            </div>
            <p className="text-xs" style={{ color: "#475569" }}>AI 브리핑 노출도 · 100점 기준</p>
            <div className="mt-2 flex items-center gap-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#BFDBFE", color: "#1D4ED8" }}
              >
                업종 4위
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#ECFDF5", color: "#065F46" }}
              >
                +6점
              </span>
            </div>
          </div>

          {/* ChatGPT 점수 */}
          <div
            className="rounded-2xl p-4 border"
            style={{ background: "#F8FAFC", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>
              Track 2 · 글로벌 AI
            </p>
            <p
              className="text-3xl font-black mb-0.5"
              style={{ color: "#0F172A", fontFamily: "Outfit, sans-serif", letterSpacing: "-1px" }}
            >
              38
            </p>
            <div className="w-full rounded-full h-1.5 mb-1" style={{ background: "#E2E8F0" }}>
              <div className="h-1.5 rounded-full" style={{ width: "38%", background: "#475569" }} />
            </div>
            <p className="text-xs" style={{ color: "#475569" }}>ChatGPT·Gemini · 100점 기준</p>
            <div className="mt-2 flex items-center gap-1">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#E2E8F0", color: "#475569" }}
              >
                업종 5위
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#ECFDF5", color: "#065F46" }}
              >
                +3점
              </span>
            </div>
          </div>

          {/* 한 달 트렌드 */}
          <div
            className="col-span-2 md:col-span-3 rounded-2xl p-4 border"
            style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold" style={{ color: "#0F172A" }}>7주 추세</p>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#ECFDF5", color: "#065F46" }}
              >
                +8점 향상
              </span>
            </div>
            <TrendSvg />
            <div className="flex justify-between mt-1">
              {TREND_LABELS.map((l, i) => (
                <span
                  key={i}
                  className="text-xs"
                  style={{ color: "#64748B", visibility: l ? "visible" : "hidden" }}
                >
                  {l || ""}
                </span>
              ))}
            </div>
          </div>

          {/* 키워드 갭 */}
          <div
            className="rounded-2xl p-4 border"
            style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-xs font-bold mb-2.5" style={{ color: "#0F172A" }}>키워드 갭</p>
            <div className="space-y-1.5">
              {[
                { kw: "주차 가능", type: "missing" },
                { kw: "단체석", type: "missing" },
                { kw: "포장 가능", type: "owned" },
              ].map(({ kw, type }) => (
                <span
                  key={kw}
                  className="inline-flex mr-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={
                    type === "missing"
                      ? { background: "#FFFBEB", color: "#92400E" }
                      : { background: "#ECFDF5", color: "#065F46" }
                  }
                >
                  {type === "missing" ? "✗" : "✓"} {kw}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-4 fade-up" style={{ color: "#64748B" }}>
          모든 수치는 예시입니다 · 실제 데이터는 내 가게 스캔 후 표시됩니다
        </p>
      </div>
    </section>
  );
}
