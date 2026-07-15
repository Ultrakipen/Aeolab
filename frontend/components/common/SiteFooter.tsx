import Link from 'next/link'

export function SiteFooter({ activePage }: { activePage?: string }) {
  const mainLinks = [
    { href: '/how-it-works',         label: '서비스 안내' },
    { href: '/resources',            label: '업종별 가이드' },
    { href: '/guide/chatgpt-search', label: 'ChatGPT 가이드' },
    { href: '/faq',     label: 'FAQ' },
    { href: '/pricing', label: '요금제' },
    { href: '/demo',    label: '미리보기' },
    { href: '/trial',   label: '무료 체험' },
  ]
  const legalLinks = [
    { href: '/terms',   label: '이용약관' },
    { href: '/privacy', label: '개인정보처리방침' },
  ]
  return (
    <footer className="border-t border-gray-100 py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="shrink-0">
          <p className="text-sm font-semibold text-gray-700">AEOlab</p>
          <p className="text-sm text-gray-500 mt-0.5 whitespace-nowrap">AI 검색 노출 관리 서비스</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2 min-w-0">
          <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap justify-start sm:justify-end">
            {mainLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`hover:text-gray-700 whitespace-nowrap ${activePage === href ? 'text-blue-600 font-medium' : ''}`}
              >
                {label}
              </Link>
            ))}
            <a href="mailto:contact@aeolab.co.kr" className="hover:text-gray-700 whitespace-nowrap">문의</a>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap justify-start sm:justify-end">
            {legalLinks.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-gray-500 whitespace-nowrap">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-gray-100 text-sm text-gray-500 leading-relaxed text-center sm:text-left break-keep">
        <p>상호: 케이엔디 커뮤니티 (KND Community) &nbsp;|&nbsp; 대표자: 김봉후 &nbsp;|&nbsp; 사업자등록번호: 202-19-10353</p>
        <p>사업장 소재지: 경상남도 김해시 번화2로 2, 402-34호(삼문동, 아쿠아빌딩) &nbsp;|&nbsp; 통신판매업번호: 2020-김해장유-0252</p>
        <p>고객센터: 050-6694-9824</p>
      </div>
    </footer>
  )
}
