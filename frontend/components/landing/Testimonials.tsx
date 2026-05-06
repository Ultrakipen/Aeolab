import { TESTIMONIALS } from "@/lib/testimonials";
import DiagnosisCounter from "@/components/landing/DiagnosisCounter";

/**
 * 베타 사용자 후기 섹션
 *
 * - lib/testimonials.ts 의 데이터 사용
 * - 모든 항목이 isPlaceholder: true 이면 섹션 자체를 렌더링하지 않음 (빈 자리 노출 방지)
 * - 실제 후기 확보 후 isPlaceholder: false 변경 + quote 교체
 */
export default function Testimonials() {
  const items = TESTIMONIALS;
  const hasReal = items.some((t) => !t.isPlaceholder);

  // 실제 후기 0개면 진단 카운터 + 서비스 신뢰 프록시 통계 4종으로 대체
  if (!hasReal) {
    return (
      <section className="bg-gray-50 border-y border-gray-100 py-8 md:py-10 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-base text-gray-600 mb-3 break-keep">
            소상공인 사업장에서 AI 노출 개선을 시작했습니다
          </p>
          <DiagnosisCounter />

          {/* 신뢰 프록시 통계 4종 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6">
            <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
              <p className="text-2xl md:text-3xl font-bold text-blue-600">4종</p>
              <p className="text-sm text-gray-700 mt-1 leading-snug break-keep">
                AI 측정<br />
                <span className="text-xs text-gray-500">Gemini · ChatGPT<br />네이버 · Google</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
              <p className="text-2xl md:text-3xl font-bold text-blue-600">100회</p>
              <p className="text-sm text-gray-700 mt-1 leading-snug break-keep">
                Full 스캔<br />
                <span className="text-xs text-gray-500">Gemini·ChatGPT<br />각 100회 샘플링</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
              <p className="text-2xl md:text-3xl font-bold text-blue-600">25종</p>
              <p className="text-sm text-gray-700 mt-1 leading-snug break-keep">
                지원 업종<br />
                <span className="text-xs text-gray-500">음식점·미용<br />법무·교육 등</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
              <p className="text-2xl md:text-3xl font-bold text-blue-600">7일</p>
              <p className="text-sm text-gray-700 mt-1 leading-snug break-keep">
                자동 재측정<br />
                <span className="text-xs text-gray-500">변화 추적<br />카카오톡 알림</span>
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-5 break-keep">
            * 베타 사용자 후기는 확보 후 추가 게시 — 측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white py-8 md:py-10 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-2 break-keep">
          베타 사용자 후기
        </h2>
        <p className="text-sm md:text-base text-center text-gray-600 mb-6 break-keep">
          실제로 사용해 본 사장님들의 변화
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {items.map((t) => (
            <article
              key={t.id}
              className={`relative rounded-2xl border p-4 md:p-6 shadow-sm ${
                t.isPlaceholder
                  ? "bg-gray-50 border-gray-200"
                  : "bg-white border-gray-200"
              }`}
            >
              {t.isPlaceholder && (
                <span className="absolute top-3 right-3 inline-block text-sm font-semibold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                  샘플 데이터
                </span>
              )}

              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                  {t.industry}
                </span>
                <span className="text-sm text-gray-500">{t.region}</span>
              </div>

              <p
                className={`text-base md:text-lg leading-relaxed mb-4 break-keep ${
                  t.isPlaceholder ? "text-gray-500" : "text-gray-800"
                }`}
              >
                &ldquo;{t.quote}&rdquo;
              </p>

              <p
                className={`text-sm md:text-base font-bold ${
                  t.isPlaceholder ? "text-gray-500" : "text-emerald-600"
                }`}
              >
                결과: {t.result}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
