import Link from "next/link";
import { MessageCircle } from "lucide-react";

export const metadata = { title: "도움말 FAQ | AEOlab" };

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface PublicTicket {
  id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  replies?: { sender_type: string; body: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  payment: "결제",
  feature: "기능 사용",
  score: "점수 해석",
  bug: "버그",
  other: "기타",
};

const CATEGORY_FILTERS = [
  { value: "", label: "전체" },
  { value: "payment", label: "결제" },
  { value: "feature", label: "기능 사용" },
  { value: "score", label: "점수 해석" },
  { value: "bug", label: "버그" },
];

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

async function fetchPublicFAQ(): Promise<PublicTicket[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/support/public`, {
      cache: "no-store",
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.tickets ?? data ?? [];
  } catch {
    return [];
  }
}

export default async function HelpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const categoryFilter = params.category ?? "";

  const tickets = await fetchPublicFAQ();
  const filtered = categoryFilter
    ? tickets.filter((t) => t.category === categoryFilter)
    : tickets;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {/* 헤더 */}
        <div className="mb-6 md:mb-8">
          <Link href="/" className="text-xl font-bold text-blue-600 block mb-4">AEOlab</Link>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">도움말 FAQ</h1>
          <p className="text-sm md:text-base text-gray-500">자주 묻는 질문과 운영자 답변을 모아 두었습니다.</p>

          {/* 로그인 CTA */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">직접 문의하려면 로그인이 필요합니다.</p>
                <p className="text-sm text-blue-600">로그인 후 1:1 문의를 작성할 수 있습니다.</p>
              </div>
            </div>
            <Link
              href="/login?next=/support/tickets/new"
              className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
            >
              로그인 후 문의하기 →
            </Link>
          </div>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORY_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/help?category=${f.value}` : "/help"}
              className={[
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                categoryFilter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* FAQ 목록 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-500 mb-1">
              {categoryFilter ? "해당 카테고리의 FAQ가 없습니다." : "아직 공개 FAQ가 없습니다."}
            </p>
            <p className="text-sm text-gray-400">
              궁금한 점은{" "}
              <Link href="/login?next=/support/tickets/new" className="text-blue-600 hover:underline">
                로그인 후 직접 문의
              </Link>
              해 주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ticket) => {
              const adminReply = (ticket.replies ?? []).find((r) => r.sender_type === "admin");
              return (
                <div key={ticket.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* 질문 */}
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="shrink-0 inline-block text-sm font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                        {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                      </span>
                      <span className="text-sm text-gray-400 mt-1">{formatDate(ticket.created_at)}</span>
                    </div>
                    <h2 className="text-base font-semibold text-gray-900 mb-2">Q. {ticket.title}</h2>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.body}</p>
                  </div>

                  {/* 운영자 답변 */}
                  {adminReply && (
                    <div className="border-t border-gray-100 bg-blue-50 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-blue-700">운영자</span>
                        <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">답변</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{adminReply.body}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 하단 문의 CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-3">원하는 답변을 찾지 못하셨나요?</p>
          <Link
            href="/login?next=/support/tickets/new"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            1:1 직접 문의하기
          </Link>
        </div>
      </div>
    </div>
  );
}
