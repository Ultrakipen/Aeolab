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
interface BusinessDetail {
  business: {
    id: string; name: string; category: string; region: string;
    is_active: boolean; created_at: string; user_id: string;
  };
  owner_email: string | null;
  scans: ScanRow[];
  guides: GuideRow[];
  competitors: CompetitorRow[];
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
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
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

  const { business, owner_email, scans, guides, competitors } = detail;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 flex-wrap">
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
        <p className="text-sm text-gray-400 mt-1">등록일 {formatDate(business.created_at)}</p>
      </div>

      {/* 스캔 이력 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">최근 스캔 이력 ({scans.length}건)</h2>
        {scans.length === 0 ? (
          <p className="text-sm text-gray-400">아직 스캔 이력이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-3">일시</th>
                  <th className="pb-2 pr-3">종합</th>
                  <th className="pb-2 pr-3">네이버 트랙</th>
                  <th className="pb-2">글로벌 트랙</th>
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
            <p className="text-sm text-gray-400">아직 생성된 가이드가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {guides.map((g) => (
                <div key={g.id} className="border border-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{g.context}</span>
                    <span className="text-sm text-gray-400">{formatDate(g.generated_at)}</span>
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
            <p className="text-sm text-gray-400">등록된 경쟁사가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {competitors.map((c) => (
                <li key={c.id} className="text-sm text-gray-700">
                  <span className="font-medium">{c.name}</span>
                  {c.address && <span className="text-gray-400"> · {c.address}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
