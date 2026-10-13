import Link from "next/link";
import { Lock, Megaphone, PenLine } from "lucide-react";
import { BOARD_CATEGORY_LABEL, formatBoardDate, type BoardItem } from "@/lib/board";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const PAGE_SIZE = 15;

interface ListResponse {
  notices: BoardItem[];
  items: BoardItem[];
  total: number;
  page: number;
}

async function fetchList(page: number): Promise<ListResponse | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/board?page=${page}&limit=${PAGE_SIZE}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: BoardItem["status"] }) {
  return status === "answered" ? (
    <span className="inline-block text-sm font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 whitespace-nowrap">
      답변완료
    </span>
  ) : (
    <span className="inline-block text-sm font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
      답변대기
    </span>
  );
}

export default async function BoardListPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Math.min(500, parseInt(sp.page ?? "1", 10) || 1));
  const data = await fetchList(page);
  const notices = data?.notices ?? [];
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <section className="px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep">문의·건의 게시판</h1>
            <p className="text-base text-gray-600 mt-2 break-keep">
              이용 문의, 건의, 제휴·광고 문의를 남겨 주세요. 로그인 없이 작성할 수 있습니다.
            </p>
          </div>
          <Link
            href="/board/new"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-base font-semibold px-5 py-3 rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <PenLine className="w-4 h-4" aria-hidden="true" />
            글쓰기
          </Link>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6 text-sm text-gray-700 leading-relaxed break-keep">
          <p>
            <Lock className="inline w-4 h-4 mr-1 -mt-0.5 text-blue-700" aria-hidden="true" />
            제목만 공개되고, 내용과 답변은 글을 쓸 때 정한 <b>비밀번호</b>로만 볼 수 있습니다.
          </p>
          <p className="mt-1">
            구독 중이라면 <Link href="/login?next=/support/tickets/new" className="text-blue-700 underline">로그인 후 1:1 문의</Link>를 쓰시면
            계정·결제 문제를 더 빠르게 처리해 드립니다.
          </p>
        </div>

        {data === null && (
          <div className="py-12 text-center text-base text-gray-700 border border-gray-100 rounded-xl">
            목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        )}

        {data !== null && (
          <>
            {/* PC 표 */}
            <div className="hidden md:block border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th scope="col" className="text-left px-4 py-3 text-sm font-semibold text-gray-700 w-28">유형</th>
                    <th scope="col" className="text-left px-4 py-3 text-sm font-semibold text-gray-700">제목</th>
                    <th scope="col" className="text-left px-4 py-3 text-sm font-semibold text-gray-700 w-28">작성자</th>
                    <th scope="col" className="text-left px-4 py-3 text-sm font-semibold text-gray-700 w-28">상태</th>
                    <th scope="col" className="text-right px-4 py-3 text-sm font-semibold text-gray-700 w-28">작성일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...notices, ...items].map((p) => (
                    <tr key={p.id} className={p.is_notice ? "bg-blue-50/40" : "hover:bg-gray-50"}>
                      <td className="px-4 py-3.5 text-sm text-gray-700">
                        {p.is_notice ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                            <Megaphone className="w-4 h-4" aria-hidden="true" />공지
                          </span>
                        ) : (
                          BOARD_CATEGORY_LABEL[p.category] ?? p.category
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/board/${p.id}`} className="text-base text-gray-900 hover:text-blue-700 hover:underline break-keep">
                          {!p.is_notice && <Lock className="inline w-4 h-4 mr-1.5 -mt-0.5 text-gray-500" aria-label="비밀번호로 보호된 글" />}
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-700">{p.author_name}</td>
                      <td className="px-4 py-3.5">{!p.is_notice && <StatusBadge status={p.status} />}</td>
                      <td className="px-4 py-3.5 text-right text-sm text-gray-700">{formatBoardDate(p.created_at)}</td>
                    </tr>
                  ))}
                  {notices.length + items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center text-base text-gray-700">
                        아직 등록된 글이 없습니다. 첫 문의를 남겨 주세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <ul className="md:hidden space-y-3">
              {[...notices, ...items].map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/board/${p.id}`}
                    className={`block rounded-xl border p-4 ${p.is_notice ? "border-blue-100 bg-blue-50/40" : "border-gray-100 bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm text-gray-700">
                        {p.is_notice ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                            <Megaphone className="w-4 h-4" aria-hidden="true" />공지
                          </span>
                        ) : (
                          BOARD_CATEGORY_LABEL[p.category] ?? p.category
                        )}
                      </span>
                      {!p.is_notice && <StatusBadge status={p.status} />}
                    </div>
                    <p className="text-base font-medium text-gray-900 break-keep">
                      {!p.is_notice && <Lock className="inline w-4 h-4 mr-1.5 -mt-0.5 text-gray-500" aria-label="비밀번호로 보호된 글" />}
                      {p.title}
                    </p>
                    <p className="text-sm text-gray-700 mt-1.5">
                      {p.author_name} · {formatBoardDate(p.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
              {notices.length + items.length === 0 && (
                <li className="py-12 text-center text-base text-gray-700 border border-gray-100 rounded-xl">
                  아직 등록된 글이 없습니다. 첫 문의를 남겨 주세요.
                </li>
              )}
            </ul>

            {totalPages > 1 && (
              <nav className="flex items-center justify-center gap-2 mt-8" aria-label="페이지 이동">
                {page > 1 && (
                  <Link href={`/board?page=${page - 1}`} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                    이전
                  </Link>
                )}
                <span className="text-sm text-gray-700 px-2">
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Link href={`/board?page=${page + 1}`} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">
                    다음
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
