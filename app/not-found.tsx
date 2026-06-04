import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 브랜드 로고 */}
        <Link href="/" className="inline-block text-2xl font-bold text-blue-600 mb-10">
          AEOlab
        </Link>

        {/* 404 표시 */}
        <div className="text-7xl md:text-8xl font-bold text-gray-100 select-none mb-2">
          404
        </div>

        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm md:text-base text-gray-500 leading-relaxed mb-10">
          요청하신 페이지가 존재하지 않거나, 이동되었거나,<br className="hidden sm:block" />
          삭제되었을 수 있습니다.
        </p>

        {/* 링크 버튼 2개 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            홈으로 돌아가기
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-white text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            대시보드로 이동
          </Link>
        </div>
      </div>
    </main>
  );
}
