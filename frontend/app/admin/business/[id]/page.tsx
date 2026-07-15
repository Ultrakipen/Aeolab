import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, AlertCircle } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/categories";

export const metadata = { title: "사업장 상세 | AEOlab Admin" };

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

interface ScanRow {
  id: string;
  scanned_at: string;
  total_score: number | null;
  track1_score: number | null;
  track2_score: number | null;
  unified_score: number | null;
}
interface GuideRow {
  id: string;
  generated_at: string;
  summary: string | null;
  context: string;
}
interface CompetitorRow {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
}
interface BlogAnalysisRow {
  keyword: string;
  my_rank: number | null;
  analyzed_at: string;
}
interface ActionLogRow {
  action_type: string;
  action_label: string;
  action_date: string;
  score_before: number | null;
  score_after: number | null;
}
interface BusinessDetail {
  business: {
    id: string; name: string; category: string; region: string;
    is_active: boolean; created_at: string; user_id: string;
  };
  owner_email: string | null;
  scans: ScanRow[];
  guides: GuideRow[];
  competitors: CompetitorRow[];
  blog_analysis: BlogAnalysisRow[];
  action_log: ActionLogRow[];
}

async function fetchDetail(id: string, adminKey: string): Promise<BusinessDetail | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/businesses/${id}`, {
      headers: { "X-Admin-Key": adminKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const formatDateOnly = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  faq_registered: "톡톡메뉴 등록", intro_updated: "소개글 수정", post_published: "포스팅 발행",
  review_replied: "리뷰 답변", guide_generated: "가이드 생성",
};

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/admin");
  }

  const adminKey = process.env.ADMIN_SECRET_KEY ?? "";
  const detail = await fetchDetail(id, adminKey);

  if (!detail) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium text-red-800">사업장을 찾을 수 없습니다.</p>
            <Link href="/admin/business" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              검색으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { business, owner_email, scans, guides, competitors, blog_analysis, action_log } = detail;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 flex-wrap">
        <Link href="/admin" className="hover:text-blue-600 transition-colors">관리자</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/admin/business" className="hover:text-blue-600 transition-colors">사업장 조회</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 truncate max-w-[160px]">{business.name}</span>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h1 className="text-lg md:text-xl font-bold text-gray-900">{business.name}</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
            {CATEGORY_LABEL[business.category] ?? business.category}
          </span>
          {!business.is_active && (
            <span className="text-sm text-red-600 bg-red-50 px-2.5 py-1 rounded-full">비활성</span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {owner_email ?? business.user_id} {business.region && `· ${business.region}`}
        </p>
        <p className="text-sm text-gray-500 mt-1">등록일 {formatDate(business.created_at)}</p>
      </div>

      {/* 스캔 이력 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">최근 스캔 이력 ({scans.length}건)</h2>
        {scans.length === 0 ? (
          <p className="text-sm text-gray-500">아직 스캔 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-3">일시</th>
                  <th className="pb-2 pr-3">종합</th>
                  <th className="pb-2 pr-3 whitespace-nowrap">네이버 트랙</th>
                  <th className="pb-2 whitespace-nowrap">글로벌 트랙</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{formatDate(s.scanned_at)}</td>
                    <td className="py-2 pr-3 text-gray-800 font-medium">{s.unified_score?.toFixed(1) ?? "—"}</td>
                    <td className="py-2 pr-3 text-gray-600">{s.track1_score?.toFixed(1) ?? "—"}</td>
                    <td className="py-2 text-gray-600">{s.track2_score?.toFixed(1) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 가이드 이력 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">가이드 생성 이력 ({guides.length}건)</h2>
          {guides.length === 0 ? (
            <p className="text-sm text-gray-500">아직 생성된 가이드가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {guides.map((g) => (
                <div key={g.id} className="border border-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{g.context}</span>
                    <span className="text-sm text-gray-500">{formatDate(g.generated_at)}</span>
                  </div>
                  {g.summary && <p className="text-sm text-gray-600 line-clamp-2">{g.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 경쟁사 목록 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">등록된 경쟁사 ({competitors.length}건)</h2>
          {competitors.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 경쟁사가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {competitors.map((c) => (
                <li key={c.id} className="text-sm text-gray-700">
                  <span className="font-medium">{c.name}</span>
                  {c.address && <span className="text-gray-500"> · {c.address}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        {/* 블로그 진단 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">블로그 진단 ({blog_analysis.length}건)</h2>
          {blog_analysis.length === 0 ? (
            <p className="text-sm text-gray-500">아직 블로그 진단 이력이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {blog_analysis.map((b) => (
                <li key={b.keyword} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{b.keyword}</span>
                  <span className="text-gray-500">{b.my_rank != null ? `${b.my_rank}위` : "10위권 밖"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 변화 기록 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">변화 기록 ({action_log.length}건)</h2>
          {action_log.length === 0 ? (
            <p className="text-sm text-gray-500">아직 기록된 변화가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {action_log.map((a, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">{ACTION_TYPE_LABEL[a.action_type] ?? a.action_label}</span>
                    <span className="text-gray-500">{formatDateOnly(a.action_date)}</span>
                  </div>
                  {a.score_before != null && a.score_after != null && (
                    <span className="text-sm text-gray-500">{a.score_before.toFixed(1)} → {a.score_after.toFixed(1)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
