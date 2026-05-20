
export default function DashboardPreview() {
  return (
    <div>
      <div>

        {/* 미니 대시보드 카드 — PC: 3열, 모바일: 2열+1열 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 fade-up">
          {/* 카카오톡 알림톡 화면 */}
          <div
            className="col-span-2 md:col-span-1 relative rounded-xl overflow-hidden border border-gray-200"
            style={{ boxShadow: "var(--aeo-shadow)", background: "#fff" }}
          >
            <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full z-10" style={{ background: "rgba(0,0,0,0.10)", color: "#5B4A00" }}>
              예시
            </span>
            {/* 카카오톡 헤더 */}
            <div className="flex items-center px-3 py-2" style={{ background: "#FAE100" }}>
              <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="#5B4A00" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <div className="flex-1 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}>A</div>
                <span className="text-sm font-bold" style={{ color: "#3B2800" }}>AEOlab</span>
              </div>
              <svg className="w-3.5 h-3.5" fill="none" stroke="#5B4A00" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {/* 채팅 배경 */}
            <div className="px-3 py-2.5" style={{ background: "#B2C4D8" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.5)" }} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>오늘</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.5)" }} />
              </div>
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-black" style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}>AE</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-1" style={{ color: "#3B3B3B" }}>AEOlab</p>
                  <div className="relative">
                    <div className="absolute -left-1.5 top-2.5 w-0 h-0" style={{ borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderRight: "6px solid #fff" }} />
                    <div className="rounded-2xl rounded-tl-sm p-2.5 text-sm" style={{ background: "#fff", maxWidth: "200px" }}>
                      <p className="font-bold mb-1" style={{ color: "#0F172A" }}>[AEOlab] 주간 노출 리포트 <span className="text-xs font-normal text-gray-400">(예시)</span></p>
                      <div className="mb-1.5 pb-1.5 border-b" style={{ borderColor: "#E2E8F0" }}>
                        <p style={{ color: "#475569" }}>이번 주 AI 노출 점수</p>
                        <p className="text-sm font-black" style={{ color: "#2563EB" }}>78점 ↑ <span className="text-xs text-green-600">(+6점)</span></p>
                      </div>
                      <p style={{ color: "#475569" }}>ChatGPT: <span className="font-bold text-gray-800">31→38회</span></p>
                      <p style={{ color: "#475569" }}>경쟁사 대비: <span className="font-bold text-indigo-600">상위 35%</span></p>
                    </div>
                    <div className="mt-1 rounded-xl overflow-hidden" style={{ maxWidth: "200px" }}>
                      <div className="w-full py-1.5 text-sm font-bold text-center" style={{ background: "#FAE100", color: "#3B2800" }}>
                        대시보드 보기 →
                      </div>
                    </div>
                  </div>
                  <p className="text-right mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.8)", maxWidth: "200px" }}>오전 9:41</p>
                </div>
              </div>
            </div>
          </div>

          {/* 네이버 점수 */}
          <div
            className="rounded-xl p-4 border"
            style={{ background: "#EFF6FF", borderColor: "#BFDBFE", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#2563EB" }}>
              네이버 채널 점수
            </p>
            <p
              className="text-3xl font-black mb-0.5"
              style={{ color: "#2563EB", fontFamily: "var(--font-pretendard, 'Pretendard Variable', sans-serif)", letterSpacing: "-1px" }}
            >
              52
            </p>
            <div className="w-full rounded-full h-1.5 mb-1" style={{ background: "#BFDBFE" }}>
              <div className="h-1.5 rounded-full" style={{ width: "52%", background: "#2563EB" }} />
            </div>
            <p className="text-sm" style={{ color: "#475569" }}>AI 브리핑 노출도 · 100점 기준 · 예시</p>
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
            className="rounded-xl p-4 border"
            style={{ background: "#F8FAFC", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>
              글로벌 AI 점수
            </p>
            <p
              className="text-3xl font-black mb-0.5"
              style={{ color: "#0F172A", fontFamily: "var(--font-pretendard, 'Pretendard Variable', sans-serif)", letterSpacing: "-1px" }}
            >
              38
            </p>
            <div className="w-full rounded-full h-1.5 mb-1" style={{ background: "#E2E8F0" }}>
              <div className="h-1.5 rounded-full" style={{ width: "38%", background: "#475569" }} />
            </div>
            <p className="text-sm" style={{ color: "#475569" }}>ChatGPT·Gemini · 100점 기준 · 예시</p>
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

          {/* 7주 추세 — 예시 SVG 라인차트 */}
          <div
            className="col-span-2 md:col-span-3 rounded-xl p-4 border"
            style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold" style={{ color: "#0F172A" }}>7주 추세 · 통합 점수</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: "#ECFDF5", color: "#065F46" }}>+21점</span>
                <span className="text-xs text-gray-400">(예시)</span>
              </div>
            </div>
            <svg viewBox="0 0 300 82" className="w-full h-auto" aria-hidden="true">
              <defs>
                <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* 배경 가이드라인 */}
              {[20, 40, 60].map((y) => (
                <line key={y} x1="8" y1={y} x2="292" y2={y} stroke="#F1F5F9" strokeWidth="1" />
              ))}
              {/* 면 채우기 */}
              <path
                d="M 15,47 L 58,38 L 101,43 L 144,32 L 187,28 L 230,23 L 273,16 L 273,65 L 15,65 Z"
                fill="url(#trend-fill)"
              />
              {/* 라인 */}
              <path
                d="M 15,47 L 58,38 L 101,43 L 144,32 L 187,28 L 230,23 L 273,16"
                stroke="#2563EB" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
              />
              {/* 점 */}
              {[
                [15, 47], [58, 38], [101, 43], [144, 32], [187, 28], [230, 23], [273, 16],
              ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i === 0 || i === 6 ? 3.5 : 2.5}
                  fill={i === 6 ? "#2563EB" : "#FFFFFF"} stroke="#2563EB" strokeWidth="1.5" />
              ))}
              {/* 시작·끝 점수 레이블 */}
              <text x="15" y="44" textAnchor="middle" fontSize="8" fill="#94A3B8">42</text>
              <text x="273" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#2563EB">63</text>
              {/* 주차 레이블 */}
              {["1주", "2주", "3주", "4주", "5주", "6주", "7주"].map((label, i) => (
                <text key={i} x={15 + i * 43} y="78" textAnchor="middle" fontSize="8" fill="#94A3B8">{label}</text>
              ))}
            </svg>
          </div>

          {/* 키워드 갭 */}
          <div
            className="rounded-xl p-4 border"
            style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-sm font-bold mb-2.5" style={{ color: "#0F172A" }}>키워드 갭</p>
            <div className="space-y-1.5">
              {[
                { kw: "주차 가능", type: "missing" },
                { kw: "단체석", type: "missing" },
                { kw: "포장 가능", type: "owned" },
              ].map(({ kw, type }) => (
                <span
                  key={kw}
                  className="inline-flex mr-1.5 text-sm font-semibold px-2 py-0.5 rounded-full"
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

        <p className="text-center text-sm mt-4 fade-up" style={{ color: "#64748B" }}>
          모든 수치는 예시입니다 · 실제 데이터는 내 가게 스캔 후 표시됩니다
        </p>
      </div>
    </div>
  );
}
