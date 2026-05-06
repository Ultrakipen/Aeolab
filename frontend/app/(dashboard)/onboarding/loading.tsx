export default function OnboardingLoading() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-10 md:py-16">
      <div className="max-w-2xl w-full">
        {/* 스텝 인디케이터 스켈레톤 */}
        <div className="flex items-center justify-center gap-2 mb-8 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="hidden sm:block">
                  <div className="h-4 w-16 bg-gray-200 rounded mb-1" />
                  <div className="h-3 w-12 bg-gray-100 rounded" />
                </div>
              </div>
              {i < 3 && <div className="w-8 md:w-12 h-0.5 mx-1 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* 카드 스켈레톤 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-8 animate-pulse">
          <div className="h-7 w-48 bg-gray-200 rounded-lg mb-3" />
          <div className="h-4 w-full bg-gray-100 rounded mb-1" />
          <div className="h-4 w-3/4 bg-gray-100 rounded mb-6" />
          <div className="h-12 bg-gray-200 rounded-xl mb-4" />
          <div className="space-y-4">
            <div className="h-4 w-full bg-gray-100 rounded" />
            <div className="h-4 w-5/6 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="h-12 bg-gray-100 rounded-xl" />
          </div>
          <div className="mt-6 h-14 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
