import Link from "next/link";

interface Package {
  num: string;
  name: string;
  price: string;
  desc: string;
  items: string[];
  extra?: string;
  badge?: string;
  highlight: boolean;
}

const PACKAGES: Package[] = [
  {
    num: "01",
    name: "스마트플레이스 등록 대행",
    price: "49,000원",
    desc: "처음부터 네이버 스마트플레이스를 등록하고 싶은 사장님",
    items: [
      "소개글 1,000자 작성",
      "기본정보·메뉴 등록",
      "키워드 5개 발굴",
      "사진 업로드·분류",
    ],
    highlight: false,
  },
  {
    num: "02",
    name: "AI 검색 최적화",
    price: "79,000원",
    desc: "이미 운영 중인 플레이스, AEOlab 진단 결과 그대로 최적화 대행",
    items: [
      "AI 브리핑 친화 최적화",
      "톡톡 채팅방 메뉴 5종",
      "후기 답글 템플릿 10개",
    ],
    highlight: false,
  },
  {
    num: "03",
    name: "종합 풀패키지",
    price: "119,000원",
    desc: "01+02 등록부터 최적화까지 + 1:1 코칭 + 30일 재진단",
    items: [
      "01 + 02 전체 포함",
      "1:1 화상 코칭 60분",
      "30일 후 자동 재진단 보고서",
    ],
    extra: "개별 합산 158,000원 → 24.7% 할인",
    badge: "추천",
    highlight: true,
  },
];

export default function AgencyServiceSection() {
  return (
    <section
      style={{
        background: "#FFFBEB",
        borderTop: "1px solid #FDE68A",
      }}
    >
      <div
        className="max-w-[1020px] mx-auto px-4 py-12 md:py-20"
      >
        {/* 헤더 */}
        <div className="flex flex-col items-center text-center gap-3 mb-10">
          <span
            className="inline-block text-sm font-semibold px-3 py-1 rounded-full"
            style={{ background: "#FEF3C7", color: "#92400E" }}
          >
            대행 서비스
          </span>
          <h2
            className="text-2xl md:text-3xl font-black break-keep"
            style={{ color: "#0F172A", letterSpacing: "-0.5px" }}
          >
            직접 할 시간이 없다면,
            <br className="hidden sm:block" />
            {" "}전문가가 대신 해드립니다
          </h2>
          <p className="text-sm" style={{ color: "#78716C" }}>
            AEOlab 진단 결과 그대로 실행 대행 — 결과로 증명합니다
          </p>
        </div>

        {/* 패키지 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.num}
              className="bg-white rounded-xl flex flex-col gap-3 p-5"
              style={{
                border: pkg.highlight ? "2px solid #2563EB" : "1px solid #E2E8F0",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              {/* 패키지 번호 + 추천 배지 */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold"
                  style={{ color: pkg.highlight ? "#2563EB" : "#94A3B8" }}
                >
                  {pkg.num}
                </span>
                {pkg.badge && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "#2563EB", color: "#FFFFFF" }}
                  >
                    {pkg.badge}
                  </span>
                )}
              </div>

              {/* 이름 */}
              <p
                className="text-base font-black break-keep leading-tight"
                style={{ color: "#0F172A" }}
              >
                {pkg.name}
              </p>

              {/* 가격 */}
              <p
                className="text-2xl font-black"
                style={{ color: "#0F172A" }}
              >
                {pkg.price}
              </p>

              {/* 설명 */}
              <p className="text-sm" style={{ color: "#64748B" }}>
                {pkg.desc}
              </p>

              {/* 포함 항목 */}
              <ul className="flex flex-col gap-1.5">
                {pkg.items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-sm" style={{ color: "#059669" }}>
                    <span className="mt-px font-bold shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {/* 03 추가 할인 안내 */}
              {"extra" in pkg && pkg.extra && (
                <p className="text-sm font-semibold" style={{ color: "#B45309" }}>
                  {pkg.extra}
                </p>
              )}

              {/* CTA 버튼 */}
              <div className="mt-auto pt-2">
                <Link
                  href="/login?returnTo=/delivery"
                  className="block w-full text-center text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
                  style={
                    pkg.highlight
                      ? { background: "#2563EB", color: "#FFFFFF" }
                      : {
                          background: "#FFFFFF",
                          color: "#0F172A",
                          border: "1px solid #E2E8F0",
                        }
                  }
                >
                  대행 신청하기 →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 안내 */}
        <p
          className="text-sm text-center mt-8"
          style={{ color: "#78716C" }}
        >
          결제 후 담당자가 카카오톡으로 연락드립니다 · 7일 내 자료 미제출 시 자동 환불
        </p>
      </div>
    </section>
  );
}
