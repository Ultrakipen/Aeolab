import Link from 'next/link'

export function SiteFooter({ activePage }: { activePage?: string }) {
  const links = [
    { href: '/how-it-works', label: '서비스 안내' },
    { href: '/faq',     label: 'FAQ' },
    { href: '/pricing', label: '요금제' },
    { href: '/demo',    label: '미리보기' },
    { href: '/trial',   label: '무료 체험' },
    { href: '/terms',   label: '이용약관' },
    { href: '/privacy', label: '개인정보처리방침' },
  ]
  return (
    <footer className="border-t border-gray-100 py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-base text-gray-500 text-center sm:text-left break-keep">
          AEOlab · 네이버 AI 브리핑 노출 관리 서비스
        </div>
        <div className="flex items-center gap-4 text-base text-gray-500 flex-wrap justify-center sm:justify-end">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`hover:text-gray-700 ${activePage === href ? 'text-blue-600 font-medium' : ''}`}
            >
              {label}
            </Link>
          ))}
          <a href="mailto:hello@aeolab.co.kr" className="hover:text-gray-700">문의</a>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-6 pt-6 border-t border-gray-100 text-sm text-gray-500 leading-relaxed text-center sm:text-left break-keep">
        <p>상호: 케이엔디 커뮤니티 (KND Community) &nbsp;|&nbsp; 대표자: 김봉후 &nbsp;|&nbsp; 사업자등록번호: 202-19-10353</p>
        <p>사업장 소재지: 경상남도 김해시 계동로 76-22, 701-903 &nbsp;|&nbsp; 통신판매업번호: 2020-김해장유-0252</p>
        <p>고객센터: 070-8095-1478</p>
      </div>
    </footer>
  )
}
