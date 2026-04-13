import Link from "next/link";

export const metadata = {
  title: "서비스 이용약관 | AEOlab",
  description: "AEOlab 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 상단 네비게이션 */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          ← 돌아가기
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          서비스 이용약관
        </h1>
        <p className="text-sm text-gray-500 mb-8">시행일: 2026년 4월 1일</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm md:text-base leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
            <p>
              이 약관은 AEOlab(이하 &ldquo;회사&rdquo;)이 제공하는 AI 검색 노출 관리 서비스(이하 &ldquo;서비스&rdquo;)의 이용과 관련하여
              회사와 이용자 사이의 권리·의무 및 책임 사항, 그 밖에 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제2조 (용어 정의)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>&ldquo;서비스&rdquo;란 회사가 제공하는 AI 검색 노출 분석, 경쟁사 비교, 개선 가이드 생성 등의 기능을 포함한 일체의 서비스를 말합니다.</li>
              <li>&ldquo;이용자&rdquo;란 이 약관에 동의하고 서비스를 이용하는 개인 또는 사업자를 말합니다.</li>
              <li>&ldquo;구독&rdquo;이란 월정액 요금을 지불하고 서비스를 이용하는 계약을 말합니다.</li>
              <li>&ldquo;사업장&rdquo;이란 이용자가 서비스에 등록하여 AI 검색 노출 분석 대상으로 지정한 가게, 업체 또는 서비스를 말합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제3조 (서비스 제공)</h2>
            <p className="mb-2">회사는 다음의 서비스를 제공합니다.</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>AI 검색 플랫폼(네이버, Gemini, ChatGPT, Claude, Perplexity, Google AI 등)에서의 사업장 노출 빈도 분석</li>
              <li>경쟁사 AI 노출 현황 비교 및 갭 분석</li>
              <li>AI 검색 노출 개선을 위한 가이드 자동 생성</li>
              <li>스마트플레이스 및 웹사이트 SEO 체크리스트 제공</li>
              <li>AI 검색 최적화 데이터 자동 생성</li>
              <li>Before/After 스크린샷 비교</li>
              <li>기타 회사가 정하는 서비스</li>
            </ol>
            <p className="mt-3">
              이용자의 사업장 분석 데이터는 개인을 특정할 수 없는 수준으로 익명화·집계한 후 업종·지역 단위 통계 데이터로 활용될 수 있습니다.
              최소 5개 이상 사업장이 포함된 집계 단위에서만 공개하며, 개별 사업장 정보는 외부에 공개되지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제4조 (이용계약 체결)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이용계약은 이용자가 이 약관의 내용에 동의하고 회원가입을 완료함으로써 성립합니다.</li>
              <li>회사는 다음의 경우 이용계약 신청을 거부할 수 있습니다.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>실명이 아니거나 타인의 정보를 도용한 경우</li>
                  <li>이전에 서비스 이용 제한 또는 계약 해지 처분을 받은 경우</li>
                  <li>기타 이용 신청 요건이 충족되지 않은 경우</li>
                </ul>
              </li>
              <li>이용자는 만 19세 이상이어야 하며, 미성년자의 경우 법정대리인의 동의가 필요합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제5조 (구독 요금 및 결제)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스 구독 요금은 다음과 같습니다.
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Basic: 월 9,900원</li>
                  <li>창업패키지: 월 16,900원</li>
                  <li>Pro: 월 22,900원</li>
                  <li>Biz: 월 49,900원</li>
                  <li>Enterprise: 월 200,000원</li>
                </ul>
              </li>
              <li>결제는 토스페이먼츠를 통한 신용카드·체크카드 자동결제(빌링키 방식)로 이루어집니다.</li>
              <li>구독은 매월 결제일에 자동으로 갱신됩니다.</li>
              <li>요금은 부가세(VAT) 포함 금액입니다.</li>
              <li>구독 기간 중 해지 신청 시 해당 월의 구독 기간이 만료된 후 해지가 처리되며, 잔여 기간에 대한 환불은 제공되지 않습니다.</li>
              <li>회사는 사전 고지 후 요금 정책을 변경할 수 있습니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제6조 (서비스 이용 제한)</h2>
            <p className="mb-2">이용자가 다음의 행위를 한 경우 서비스 이용이 제한될 수 있습니다.</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>타인의 정보를 도용하거나 허위 정보를 등록한 경우</li>
              <li>서비스를 통해 얻은 데이터를 무단으로 수집·배포·판매하는 경우</li>
              <li>서비스 시스템에 과도한 부하를 주거나 정상 운영을 방해하는 경우</li>
              <li>서비스를 상업적 목적으로 재판매하는 경우 (Biz·Enterprise 플랜 제외)</li>
              <li>기타 법령 또는 이 약관에 위반되는 행위를 한 경우</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제7조 (이용자의 의무)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>이용자는 본인의 계정 정보를 안전하게 관리할 의무가 있으며, 계정 도용으로 인한 손해는 이용자가 책임집니다.</li>
              <li>이용자는 서비스 이용 시 관련 법령 및 이 약관을 준수해야 합니다.</li>
              <li>이용자는 등록한 사업장 정보가 실존하는 합법적인 사업체임을 확인합니다.</li>
              <li>이용자는 서비스를 통해 생성된 가이드 내용의 실행 여부와 결과에 대한 책임을 집니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제8조 (서비스 변경 및 중단)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>회사는 서비스 개선을 위해 사전 고지 후 서비스의 전부 또는 일부를 변경할 수 있습니다.</li>
              <li>천재지변, 시스템 장애 등 불가피한 사유로 서비스가 일시 중단될 수 있으며, 이 경우 사전 또는 사후 고지합니다.</li>
              <li>서비스 종료 시 최소 30일 전 이용자에게 이메일로 고지하며, 잔여 구독 기간에 대한 요금을 환불합니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제9조 (손해배상)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스는 AI 기반 분석 정보를 제공하며, 분석 결과의 정확성을 보증하지 않습니다.</li>
              <li>회사는 서비스 이용으로 발생한 간접 손해, 특별 손해, 결과적 손해에 대해 책임을 지지 않습니다.</li>
              <li>회사의 손해배상 한도는 최근 3개월간 이용자가 납부한 구독 요금을 초과하지 않습니다.</li>
              <li>이용자의 고의 또는 과실로 회사에 손해가 발생한 경우 이용자가 배상 책임을 집니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">제10조 (분쟁 해결)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>서비스 이용과 관련한 분쟁 발생 시 회사와 이용자는 상호 협의를 통해 해결을 우선합니다.</li>
              <li>협의가 이루어지지 않은 경우, 관련 법령에 따른 분쟁 해결 절차를 따릅니다.</li>
              <li>이 약관에 관한 소송의 관할 법원은 민사소송법에 따른 관할 법원으로 합니다.</li>
              <li>이 약관에 명시되지 않은 사항은 전자상거래 등에서의 소비자보호에 관한 법률, 개인정보보호법 등 관련 법령에 따릅니다.</li>
            </ol>
          </section>

          <section className="border-t border-gray-200 pt-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-3">부칙</h2>
            <p>이 약관은 2026년 4월 1일부터 시행합니다.</p>
            <p className="mt-2">문의: <a href="mailto:hoozdev@gmail.com" className="text-blue-600 hover:underline">hoozdev@gmail.com</a></p>
          </section>

        </div>
      </div>
    </main>
  );
}
