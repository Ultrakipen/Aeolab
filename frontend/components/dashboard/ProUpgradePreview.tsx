import Link from "next/link";

interface Props {
  businessName: string;
  category: string;
  plan: string;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const PRO_SCAN_DAYS = new Set([0, 2, 4]);

function CalendarIcon({ dayIndex }: { dayIndex: number }) {
  const isProDay = PRO_SCAN_DAYS.has(dayIndex);
  return (
    <div
      className={`flex flex-col items-center justify-center w-9 h-9 rounded-lg text-sm font-bold border ${
        isProDay
          ? "bg-emerald-500 border-emerald-400 text-white"
          : "bg-gray-100 border-gray-200 text-gray-400"
      }`}
    >
      {WEEKDAY_LABELS[dayIndex]}
    </div>
  );
}

function LockedOverlay({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="blur-sm pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/75 gap-2 rounded-xl">
        <span className="text-2xl">🔒</span>
        {label && (
          <span className="text-sm font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-sm">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProUpgradePreview({ businessName, category: _category, plan: _plan }: Props) {
  const sampleQueries = [
    `${businessName} 추천`,
    `${businessName} 후기`,
    `${businessName} 가격`,
    `${businessName} 예약`,
    `${businessName} 위치`,
  ];

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 md:p-6 space-y-5">
      {/* 헤더 배너 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              현재 Basic
            </span>
            <span className="text-gray-400 text-sm">→</span>
            <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
              Pro 업그레이드 시 추가
            </span>
          </div>
          <h2 className="text-base md:text-lg font-bold text-gray-900">
            Pro로 업그레이드하면 이런 결과가 추가됩니다
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Pro · 월 18,900원 · 언제든 해지 가능</p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          지금 Pro로 업그레이드 →
        </Link>
      </div>

      <div className="border-t border-indigo-100" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* A. 스캔 빈도 비교 */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-1">전체 AI 스캔 빈도</h3>
          <p className="text-sm text-gray-400 mb-4">7개 AI 채널을 한 번에 분석하는 전체 스캔 횟수</p>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Basic (현재)
              </span>
              <span className="text-sm text-gray-500">월요일만 전체 스캔</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={`flex flex-col items-center justify-center w-9 h-9 rounded-lg text-sm font-bold border ${
                    i === 0
                      ? "bg-emerald-500 border-emerald-400 text-white"
                      : "bg-gray-100 border-gray-200 text-gray-400"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-1.5">나머지 날: Gemini+네이버만 분석</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                Pro (업그레이드 후)
              </span>
              <span className="text-sm text-gray-500">월·수·금 전체 스캔</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAY_LABELS.map((_, i) => (
                <CalendarIcon key={i} dayIndex={i} />
              ))}
            </div>
            <p className="text-sm text-indigo-600 font-semibold mt-1.5">
              주 3회 전체 AI 스캔 → 경쟁사 변화를 3일 안에 포착
            </p>
          </div>
        </div>

        {/* B. 히스토리 90일 */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-1">점수 추이 히스토리</h3>
          <p className="text-sm text-gray-400 mb-4">장기 추이 분석으로 계절성·이벤트 효과 파악</p>

          <div className="relative h-28 w-full mb-3">
            <svg viewBox="0 0 280 80" className="w-full h-full" preserveAspectRatio="none">
              <polyline
                points="0,60 30,50 60,55 90,40 120,45 150,30 180,35"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="180,35 210,25 240,20 280,15"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="6,4"
                strokeLinecap="round"
                opacity="0.35"
              />
              <line x1="180" y1="0" x2="180" y2="80" stroke="#d1d5db" strokeWidth="1" strokeDasharray="3,3" />
              <text x="5" y="76" fontSize="8" fill="#9ca3af">30일 전</text>
              <text x="155" y="76" fontSize="8" fill="#9ca3af">오늘</text>
              <text x="200" y="10" fontSize="8" fill="#6366f1" opacity="0.7">+60일 (Pro)</text>
            </svg>
            <div className="absolute top-0 right-0 bottom-0 w-[35%] bg-gradient-to-l from-white/90 to-transparent rounded-r-xl flex flex-col items-center justify-center gap-1">
              <span className="text-lg">🔒</span>
              <span className="text-sm font-semibold text-indigo-600">Pro 전용</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <p className="font-semibold text-emerald-700">Basic (현재)</p>
              <p className="text-emerald-600 mt-0.5">최근 30일 추이만</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <p className="font-semibold text-indigo-700">Pro (업그레이드 후)</p>
              <p className="text-indigo-600 mt-0.5">90일 장기 추이 분석</p>
            </div>
          </div>
        </div>

        {/* C. 조건 검색 결과 미리보기 */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-1">조건 검색 분석</h3>
          <p className="text-sm text-gray-400 mb-3">
            고객이 &ldquo;추천&rdquo; &ldquo;맛집&rdquo; &ldquo;근처&rdquo; 같은 조건으로 검색할 때 내 가게가 나오는지 분석
          </p>
          <LockedOverlay label="Pro 전용 기능">
            <div className="space-y-2">
              {sampleQueries.map((query, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{query}</span>
                  <span
                    className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                      i % 2 === 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {i % 2 === 0 ? "언급됨" : "미언급"}
                  </span>
                </div>
              ))}
            </div>
          </LockedOverlay>
        </div>

        {/* D. ChatGPT 광고 대응 분석 미리보기 */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-1">ChatGPT 광고 대응 분석</h3>
          <p className="text-sm text-gray-400 mb-3">
            ChatGPT가 내 업종에서 경쟁사 광고를 어떻게 표시하는지 분석하고 대응 전략 제공
          </p>
          <LockedOverlay label="Pro 전용 기능">
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700 mb-1">경쟁사 광고 노출 감지</p>
                <p className="text-sm text-gray-600">경쟁 업체 3곳이 ChatGPT 검색에서 광고 노출 중</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-gray-600">대응 전략</p>
                {[
                  "리뷰 기반 소개글 Q&A 추가로 자연 노출 강화",
                  "브랜드 키워드 콘텐츠 확보",
                  "구글 비즈니스 프로필 최적화",
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-500">
                    <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </LockedOverlay>
        </div>

        {/* E. PDF 리포트 & CSV 내보내기 */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 md:p-6 md:col-span-2">
          <h3 className="text-sm font-bold text-gray-700 mb-1">리포트 내보내기</h3>
          <p className="text-sm text-gray-400 mb-4">
            전체 AI 노출 분석 결과를 PDF·CSV로 다운로드
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative border border-gray-200 rounded-xl p-4 flex items-center gap-4 overflow-hidden">
              <div className="pointer-events-none select-none opacity-40 flex items-center gap-4 flex-1">
                <div className="w-10 h-12 bg-red-100 border border-red-200 rounded flex items-center justify-center shrink-0">
                  <span className="text-red-600 font-bold text-sm">PDF</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">AI 노출 분석 리포트</p>
                  <p className="text-sm text-gray-400">사업장 전체 분석 1페이지 요약 PDF</p>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/80">
                <span className="text-base">🔒</span>
                <span className="text-sm font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-sm">
                  Pro 전용
                </span>
              </div>
            </div>

            <div className="relative border border-gray-200 rounded-xl p-4 flex items-center gap-4 overflow-hidden">
              <div className="pointer-events-none select-none opacity-40 flex items-center gap-4 flex-1">
                <div className="w-10 h-12 bg-green-100 border border-green-200 rounded flex items-center justify-center shrink-0">
                  <span className="text-green-700 font-bold text-sm">CSV</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">스캔 이력 데이터</p>
                  <p className="text-sm text-gray-400">90일 점수 이력을 엑셀로 내보내기</p>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/80">
                <span className="text-base">🔒</span>
                <span className="text-sm font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-sm">
                  Pro 전용
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA 섹션 */}
      <div className="border-t border-indigo-100 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">
              지금 Pro로 전환하면 위 기능을 즉시 이용할 수 있습니다
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              현재 스캔 데이터는 Pro 전환 후에도 그대로 유지됩니다 · 언제든 해지 가능
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link
              href="/plans-preview"
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-indigo-300 text-indigo-600 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors hover:bg-indigo-50"
            >
              요금제별 결과 미리보기 →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              Pro 업그레이드 · 18,900원/월 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
