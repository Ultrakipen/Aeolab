import Link from "next/link";
import { SiteFooter } from "@/components/common/SiteFooter";
import { AuthNavControlClient } from "@/components/common/AuthNavControlClient";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import RelatedTools from "./RelatedTools";
import { themeForPath, themeVars } from "./toolTheme";

// 사장님 계산기 공통 틀 — 헤더·제목·면책·푸터. 계산 UI는 children.
export default function ToolShell({
  title,
  intro,
  path,
  children,
}: {
  title: string;
  intro: string;
  path: string; // 예: "/tools/vat" — 구조화 데이터(브레드크럼·웹 앱)에 쓴다
  children: React.ReactNode;
}) {
  const url = `https://aeolab.co.kr${path}`;
  const theme = themeForPath(path);
  const Icon = theme?.icon;
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "ko",
    description: intro,
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  };
  return (
    <main className="min-h-screen bg-gray-50" style={themeVars(theme)}>
      <BreadcrumbJsonLd
        items={[
          { name: "AEOlab", url: "https://aeolab.co.kr/" },
          { name: "사장님 계산기", url: "https://aeolab.co.kr/tools" },
          { name: title, url },
        ]}
      />
      <script
        type="application/ld+json"
        // </script> 조기 종료 방지 — JSON.stringify는 "<"를 이스케이프하지 않음
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApp).replace(/</g, "\\u003c") }}
      />
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xl font-bold text-blue-600 md:text-2xl">
              AEOlab
            </Link>
            <span className="hidden text-gray-300 sm:inline" aria-hidden="true">/</span>
            <Link href="/tools" className="hidden min-h-[44px] items-center text-sm text-gray-600 hover:text-gray-900 sm:inline-flex">
              사장님 계산기
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

      <div
        className="border-b border-gray-100 bg-white"
        style={theme ? { backgroundImage: "linear-gradient(to bottom, var(--tool-soft), #ffffff)" } : undefined}
      >
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
          <nav aria-label="현재 위치" className="mb-3 text-sm text-gray-600">
            <Link href="/tools" className="inline-flex min-h-[44px] items-center hover:text-gray-900">
              사장님 계산기
            </Link>
          </nav>
          <div className="mb-3 flex items-center gap-3">
            {Icon ? (
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white md:h-14 md:w-14"
                style={{ backgroundColor: "var(--tool-accent)" }}
                aria-hidden="true"
              >
                <Icon className="h-6 w-6 md:h-7 md:w-7" />
              </span>
            ) : null}
            <h1 className="break-keep text-2xl font-bold text-gray-900 md:text-3xl">{title}</h1>
          </div>
          <p className="max-w-3xl break-keep text-sm leading-relaxed text-gray-600 md:text-base">{intro}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 md:px-6">
        {children}

        <RelatedTools />

        <p className="max-w-3xl text-sm leading-relaxed text-gray-600 break-keep">
          이 계산기는 입력하신 값으로 계산한 참고용 추정이며 세무·노무·회계 상담을 대체하지 않습니다. 실제 세액·보험료·정산액은
          국세청·공단·정산서 등으로 확인해 주세요. 입력하신 값은 저장하거나 전송하지 않고 이 화면에서만 계산합니다.
        </p>
      </div>

      <SiteFooter activePage="/tools" />
    </main>
  );
}
