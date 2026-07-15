import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";

interface Props {
  score: number;
  isSmartPlace: boolean;
}

interface PackageInfo {
  number: "01" | "02" | "03";
  name: string;
  price: number;
  packageType: string;
  reason: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
}

function getRecommendedPackage(score: number, isSmartPlace: boolean): PackageInfo {
  if (score < 40 || !isSmartPlace) {
    return {
      number: "01",
      name: "스마트플레이스 등록 대행",
      price: 59000,
      packageType: "smartplace_register",
      reason: score < 40
        ? "점수가 낮으면 기반 등록부터 시작해야 합니다"
        : "스마트플레이스 등록이 먼저입니다",
      accent: "border-blue-200",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700",
    };
  }
  if (score < 70) {
    return {
      number: "02",
      name: "AI 검색 최적화",
      price: 79000,
      packageType: "ai_optimization",
      reason: "기본은 있지만 콘텐츠 보강으로 점수 향상이 가능합니다",
      accent: "border-indigo-200",
      badgeBg: "bg-indigo-50",
      badgeText: "text-indigo-700",
    };
  }
  return {
    number: "03",
    name: "종합 풀패키지",
    price: 129000,
    packageType: "comprehensive",
    reason: "한 번에 완성도 높여 경쟁사와 격차를 벌리세요",
    accent: "border-purple-200",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
  };
}

export default function DeliveryRecommendCard({ score, isSmartPlace }: Props) {
  const pkg = getRecommendedPackage(score, isSmartPlace);

  return (
    <div className={`bg-white rounded-xl border ${pkg.accent} shadow-sm p-5`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-sm font-bold text-gray-700">전문가 추천 서비스</span>
        <span className={`ml-auto text-sm font-bold px-2.5 py-0.5 rounded-full ${pkg.badgeBg} ${pkg.badgeText}`}>
          {pkg.number}
        </span>
      </div>

      {/* 패키지 이름 + 가격 */}
      <div className="mb-2">
        <p className="text-base font-black text-gray-900">{pkg.name}</p>
        <p className="text-2xl font-black text-blue-600 mt-1">
          {pkg.price.toLocaleString()}원
          <span className="text-sm font-normal text-gray-500 ml-1">1회</span>
        </p>
      </div>

      {/* 추천 이유 */}
      <p className="text-sm text-gray-500 mb-4">{pkg.reason}</p>

      {/* CTA 버튼 */}
      <Link
        href={`/delivery?package=${pkg.packageType}`}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
      >
        전문가에게 맡기기
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
