"use client";

interface Props {
  myScore: number;
  avgScore: number;
  top10Score: number;
  category: string;
  region: string;
}

export default function CompetitorGapHighlightCard({
  myScore,
  avgScore,
  top10Score,
}: Props) {
  if (!avgScore || avgScore === 0) return null;

  const gap = Math.abs(avgScore - myScore);
  const isAhead = myScore >= avgScore;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 mb-4 shadow-sm">
      <p className="text-base md:text-lg font-bold text-slate-800 mb-4">
        경쟁 업체들과의 격차
      </p>

      {/* 숫자 비교 3개 */}
      <div className="grid grid-cols-3 gap-3 text-center mb-4">
        <div className="bg-slate-50 rounded-xl py-3 px-2 border border-slate-200">
          <p className="text-sm text-gray-500 mb-1">업종 평균</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-700">
            {avgScore.toFixed(1)}점
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl py-3 px-2 border-2 border-blue-400">
          <p className="text-sm text-blue-600 font-semibold mb-1">내 가게</p>
          <p className="text-2xl md:text-3xl font-bold text-blue-700">
            {myScore}점
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl py-3 px-2 border border-slate-200">
          <p className="text-sm text-gray-500 mb-1">상위 10%</p>
          <p className="text-2xl md:text-3xl font-bold text-emerald-600">
            {top10Score.toFixed(1)}점
          </p>
        </div>
      </div>

      {/* 갭 배지 */}
      <div className="flex justify-center mb-4">
        {isAhead ? (
          <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 font-semibold text-sm md:text-base px-4 py-1.5 rounded-full">
            업종 평균보다{" "}
            <strong>{gap.toFixed(1)}점</strong>{" "}
            앞섬
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 font-semibold text-sm md:text-base px-4 py-1.5 rounded-full">
            업종 평균보다{" "}
            <strong>{gap.toFixed(1)}점</strong>{" "}
            뒤처짐
          </span>
        )}
      </div>

      {/* 하단 문구 */}
      <p className="text-sm md:text-base text-slate-600 leading-relaxed text-center break-keep">
        상위 10% 업체들은 키워드·리뷰·콘텐츠 최적화로 이 격차를 만들었습니다
      </p>
    </div>
  );
}
