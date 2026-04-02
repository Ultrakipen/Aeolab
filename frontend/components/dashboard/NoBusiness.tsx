import Link from "next/link";
import { type LucideIcon } from "lucide-react";

interface Feature {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

interface NoBusinessProps {
  Icon: LucideIcon;
  title: string;
  description: string;
  features: Feature[];
  planBadge?: string;
}

export function NoBusiness({ Icon, title, description, features, planBadge }: NoBusinessProps) {
  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {planBadge && (
            <span className="text-sm bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">{planBadge}</span>
          )}
        </div>
        <p className="text-gray-500 text-sm mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {features.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-5 shadow-sm flex gap-4">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <f.Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm mb-0.5">{f.title}</div>
              <div className="text-sm text-gray-500">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm mb-0.5">사업장을 등록하면 바로 이용할 수 있습니다</div>
          <div className="text-sm text-gray-500">대시보드에서 사업장을 먼저 등록해 주세요.</div>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 bg-blue-600 text-white text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          사업장 등록하기
        </Link>
      </div>
    </div>
  );
}
