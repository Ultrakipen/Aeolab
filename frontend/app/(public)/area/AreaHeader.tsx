import Link from "next/link";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";

export default function AreaHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white px-4 py-4 md:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-xl font-bold text-blue-600 md:text-2xl">
            AEOlab
          </Link>
          <span className="hidden text-gray-300 sm:inline" aria-hidden="true">/</span>
          <Link href="/area" className="hidden min-h-[44px] items-center text-sm text-gray-600 hover:text-gray-900 sm:inline-flex">
            우리 동네 상권
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/trial" className="hidden min-h-[44px] items-center text-sm text-gray-600 hover:text-gray-900 sm:inline-flex">
            무료 체험
          </Link>
          <AuthNavControlClient />
        </div>
      </div>
    </header>
  );
}
