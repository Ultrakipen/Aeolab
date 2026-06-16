
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
            <span className="absolute top-2 right-2 text-sm px-1.5 py-0.5 rounded-full z-10" style={{ background: "rgba(0,0,0,0.10)", color: "#5B4A00" }}>
              예시
            </span>
            {/* 카카오톡 헤더 */}
            <div className="flex items-center px-3 py-2" style={{ background: "#FAE100" }}>
              <svg className="w-3.5 h-3.5 mr-2" fill="none" stroke="#5B4A00" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <div className="flex-1 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}>A</div>
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
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>오늘</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.5)" }} />
              </div>
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-black" style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)" }}>AE</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-1" style={{ color: "#3B3B3B" }}>AEOlab</p>
                  <div className="relative">
                    <div className="absolute -left-1.5 top-2.5 w-0 h-0" style={{ borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderRight: "6px solid #fff" }} />
                    <div className="rounded-2xl rounded-tl-sm p-2.5 text-sm" style={{ background: "#fff", maxWidth: "200px" }}>
                      <p className="font-bold mb-1" style={{ color: "#0F172A" }}>[AEOlab] 주간 노출 리포트 <span className="text-sm font-normal text-gray-400">(예시)</span></p>
                      <div className="mb-1.5 pb-1.5 border-b" style={{ borderColor: "#E2E8F0" }}>
                        <p style={{ color: "#475569" }}>이번 주 AI 노출 등급</p>
                        <p className="text-sm font-black" style={{ color: "#2563EB" }}>보통 → 양호 <span className="text-sm text-green-600">↑ 한 단계 성장!</span></p>
                      </div>
                      <p style={{ color: "#475569" }}>ChatGPT 언급: <span className="font-bold text-gray-800">+8회 증가</span></p>
                      <p style={{ color: "#475569" }}>경쟁사 대비: <span className="font-bold text-indigo-600">업종 3위 → 2위</span></p>
                    </div>
                    <div className="mt-1 rounded-xl overflow-hidden" style={{ maxWidth: "200px" }}>
                      <div className="w-full py-1.5 text-sm font-bold text-center" style={{ background: "#FAE100", color: "#3B2800" }}>
                        대시보드 보기 →
                      </div>
                    </div>
                  </div>
                  <p className="text-right mt-0.5 text-sm" style={{ color: "rgba(255,255,255,0.8)", maxWidth: "200px" }}>오전 9:41</p>
                </div>
              </div>
            </div>
          </div>

          {/* 네이버 점수 */}
          <div
            className="rounded-xl p-4 border flex flex-col"
            style={{ background: "#EFF6FF", borderColor: "#BFDBFE", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#2563EB" }}>
              네이버 채널 진단
            </p>
            <p
              className="text-lg font-black mb-1"
              style={{ color: "#2563EB" }}
            >
              AI 브리핑 노출 중
            </p>
            <span
              className="text-sm font-bold px-2 py-0.5 rounded-full mb-1.5 self-start"
              style={{ background: "#DBEAFE", color: "#1D4ED8" }}
            >
              양호
            </span>
            <p className="text-sm mb-1" style={{ color: "#1D4ED8", fontWeight: 600 }}>
              ✓ 업종 평균보다 높은 노출
            </p>
            <p className="text-sm" style={{ color: "#475569" }}>AI 브리핑 노출 현황 · 예시</p>
            <div className="mt-2 flex items-center gap-1 mb-2">
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#BFDBFE", color: "#1D4ED8" }}
              >
                업종 2위
              </span>
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#ECFDF5", color: "#065F46" }}
              >
                노출 증가
              </span>
            </div>
            {/* 개선 소요 기간 안내 */}
            <div className="mt-auto rounded-lg px-2.5 py-2" style={{ background: "#DBEAFE" }}>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "#1E40AF" }}>⏱ 개선 효과 확인까지</p>
              <p className="text-sm" style={{ color: "#1D4ED8" }}>소개글·소식 업데이트 후 <strong>2~4주</strong> 내 변화</p>
            </div>
          </div>

          {/* 글로벌 AI 점수 */}
          <div
            className="rounded-xl p-4 border flex flex-col"
            style={{ background: "#F8FAFC", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "#475569" }}>
              글로벌 AI 인식 현황
            </p>
            <p
              className="text-lg font-black mb-1"
              style={{ color: "#0F172A" }}
            >
              인식 시작 단계
            </p>
            <span
              className="text-sm font-bold px-2 py-0.5 rounded-full mb-1.5 self-start"
              style={{ background: "#FEF9C3", color: "#92400E" }}
            >
              보통
            </span>
            <p className="text-sm" style={{ color: "#475569" }}>ChatGPT·Gemini 노출 현황 · 예시</p>
            <div className="mt-2 flex items-center gap-1 mb-2">
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#E2E8F0", color: "#475569" }}
              >
                업종 3위
              </span>
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#ECFDF5", color: "#065F46" }}
              >
                노출 증가
              </span>
            </div>
            {/* 채널별 현실 안내 */}
            <div className="mt-auto rounded-lg px-2.5 py-2 space-y-1" style={{ background: "#F1F5F9" }}>
              <p className="text-sm font-semibold" style={{ color: "#475569" }}>📌 현실적인 기대치</p>
              <p className="text-sm" style={{ color: "#475569" }}>
                <span className="font-semibold" style={{ color: "#4F46E5" }}>Gemini</span>
                {" — "}Google 실시간 검색 연동: <strong>수 주</strong> / 학습 데이터: <strong>수개월~1년</strong>
              </p>
              <p className="text-sm" style={{ color: "#475569" }}>
                <span className="font-semibold" style={{ color: "#10A37F" }}>ChatGPT</span>
                {" — "}학습 데이터 기반 · 노출까지 <strong>수개월~1년</strong> 소요
              </p>
              <p className="text-sm" style={{ color: "#64748B" }}>
                🌱 대부분의 가게가 아직 준비 중 — 지금 시작하면 선점 유리
              </p>
            </div>
          </div>

          {/* 7주 추세 — 예시 SVG 라인차트 */}
          <div
            className="col-span-2 md:col-span-3 rounded-xl p-4 border"
            style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            {/* 헤더: 스토리 텍스트로 점수 의미 전달 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: "#0F172A" }}>7주 추세 · 노출 단계 변화</p>
                <p className="text-sm" style={{ color: "#475569" }}>
                  <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: "#FEF9C3", color: "#92400E" }}>보통</span>
                  <span className="mx-1.5 text-gray-400">→ 7주 후 →</span>
                  <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>양호</span>
                  <span className="ml-1.5 text-green-600 font-semibold">↑ 한 단계 성장</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: "#ECFDF5", color: "#065F46" }}>한 단계 성장</span>
                <span className="text-sm text-gray-400">(예시)</span>
              </div>
            </div>
            {/* 납작한 스파크라인 — viewBox 가로:세로 = 8:1로 높이 최소화 */}
            <svg viewBox="0 0 400 50" className="w-full h-auto" aria-hidden="true">
              <defs>
                <linearGradient id="trend-fill2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {/* 가이드라인 1개 (중간선) */}
              <line x1="0" y1="25" x2="400" y2="25" stroke="#F1F5F9" strokeWidth="1" />
              {/* 면 채우기 — y 정규화: score48→y=38, score76→y=5 */}
              <path
                d="M 20,38 L 83,33 L 146,36 L 209,25 L 272,22 L 335,17 L 385,5 L 385,43 L 20,43 Z"
                fill="url(#trend-fill2)"
              />
              {/* 라인 */}
              <path
                d="M 20,38 L 83,33 L 146,36 L 209,25 L 272,22 L 335,17 L 385,5"
                stroke="#2563EB" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
              />
              {/* 시작·끝 점만 강조 */}
              <circle cx="20"  cy="38" r="3" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
              <circle cx="385" cy="5"  r="4" fill="#2563EB" stroke="#2563EB" strokeWidth="1.5" />
              {/* 주차 레이블 */}
              {["1주", "2주", "3주", "4주", "5주", "6주", "7주"].map((label, i) => (
                <text key={i} x={20 + i * 60.8} y="50" textAnchor="middle" fontSize="7" fill="#CBD5E1">{label}</text>
              ))}
            </svg>
          </div>

          {/* 키워드 갭 — 전체 너비 */}
          <div
            className="col-span-2 md:col-span-3 rounded-xl p-4 border"
            style={{ background: "#FFFFFF", borderColor: "#E2E8F0", boxShadow: "var(--aeo-shadow)" }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-sm font-bold" style={{ color: "#0F172A" }}>키워드 갭</p>
              <span className="text-sm text-gray-400">AI 검색에서 누락된 키워드 · 예시</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { kw: "주차 가능", type: "missing" },
                { kw: "단체석", type: "missing" },
                { kw: "반려동물 동반", type: "missing" },
                { kw: "포장 가능", type: "owned" },
                { kw: "예약 가능", type: "owned" },
              ].map(({ kw, type }) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full"
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
