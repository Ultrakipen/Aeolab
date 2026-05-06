export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 md:p-8 min-h-screen bg-gray-50">
      {/* 헤더 스켈레톤 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 mb-5 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-7 w-40 bg-gray-200 rounded-lg" />
          <div className="h-5 w-16 bg-gray-100 rounded-full ml-auto" />
        </div>
        <div className="h-4 w-32 bg-gray-100 rounded" />
      </div>

      {/* 점수 카드 스켈레톤 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 mb-5 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-200 rounded-xl" />
          <div className="h-6 w-48 bg-gray-200 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-20 bg-gray-100 rounded-xl" />
        </div>
      </div>

      {/* 3단 행동 카드 스켈레톤 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm animate-pulse">
            <div className="h-4 w-16 bg-gray-200 rounded mb-3" />
            <div className="h-5 w-full bg-gray-100 rounded mb-2" />
            <div className="h-4 w-3/4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* AI 채널 스켈레톤 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-pulse">
          <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-gray-200 rounded-full shrink-0" />
                <div className="flex-1 h-3 bg-gray-100 rounded" />
                <div className="w-12 h-3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-pulse">
          <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
          <div className="h-24 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
