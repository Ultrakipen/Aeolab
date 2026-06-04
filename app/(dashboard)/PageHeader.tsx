import { PageHeaderAvatarMenu } from "./PageHeaderAvatarMenu";
import HeaderHelpSearch from "@/components/landing/HeaderHelpSearch";

interface Props {
  email: string;
  plan: string | null;
  title?: string;
}

/**
 * 데스크톱 전용 페이지 헤더 (lg+ 에서만 표시)
 * - 좌측: 페이지 제목 (optional)
 * - 중앙: FAQ 도움말 검색창
 * - 우측: 사용자 아바타 드롭다운
 */
export function PageHeader({ email, plan, title }: Props) {
  return (
    <header className="hidden lg:flex sticky top-0 z-20 h-12 bg-white border-b border-gray-100 px-6 items-center justify-between shrink-0 gap-4">
      <div className="flex items-center min-w-0">
        {title && (
          <h1 className="text-[15px] font-semibold text-gray-700 truncate">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        <HeaderHelpSearch />
        <PageHeaderAvatarMenu email={email} plan={plan} />
      </div>
    </header>
  );
}
