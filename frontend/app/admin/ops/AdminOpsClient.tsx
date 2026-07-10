"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, ShieldCheck, Bell, CreditCard, Users, Trash2, Rocket } from "lucide-react";

const ADMIN_PROXY = "/api/admin-proxy";

interface AuditLogRow {
  id: string;
  admin_email: string | null;
  method: string;
  path: string;
  status_code: number | null;
  body_snippet: string | null;
  created_at: string;
}

interface SystemAlertRow {
  id: string;
  subject: string;
  message: string | null;
  level: "info" | "warning" | "error";
  source: string | null;
  created_at: string;
}

interface PaymentEventRow {
  id: string;
  user_id: string;
  email: string | null;
  event_type: "billing_issue" | "renewal";
  status: "success" | "failed";
  amount: number | null;
  detail: string | null;
  created_at: string;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  billing_issue: "최초 결제",
  renewal: "자동 갱신",
};

interface AdminUserRow {
  id: string;
  email: string;
  role: "owner" | "support";
  created_at: string;
}

interface StartupReportRow {
  id: string;
  user_id: string;
  business_id: string | null;
  email: string | null;
  category: string;
  region: string;
  business_name: string | null;
  created_at: string;
}

const LEVEL_STYLE: Record<string, string> = {
  error: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-blue-50 text-blue-700",
};

const METHOD_STYLE: Record<string, string> = {
  POST: "bg-blue-50 text-blue-700",
  PATCH: "bg-amber-50 text-amber-700",
  DELETE: "bg-red-50 text-red-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AdminOpsClient() {
  const [auditLog, setAuditLog] = useState<AuditLogRow[]>([]);
  const [alerts, setAlerts] = useState<SystemAlertRow[]>([]);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEventRow[]>([]);
  const [startupReports, setStartupReports] = useState<StartupReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"owner" | "support">("support");
  const [adminUserSubmitting, setAdminUserSubmitting] = useState(false);

  const loadAdminUsers = useCallback(async () => {
    setAdminUsersError("");
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=${encodeURIComponent("admin/admin-users")}`);
      if (res.status === 403) {
        setAdminUsersError("owner 권한 계정만 관리자 목록을 볼 수 있습니다.");
        return;
      }
      if (!res.ok) throw new Error("API 오류");
      setAdminUsers(await res.json());
    } catch {
      setAdminUsersError("관리자 목록을 불러오지 못했습니다.");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 섹션별 독립 로드 — 하나가 실패(예: 신규 테이블 SQL 마이그레이션 미실행으로 500)해도
      // 나머지 섹션은 정상 표시하고, 실패한 섹션만 빈 배열로 남겨 원인 파악이 쉽도록 함
      // (재점검에서 발견: 기존 OR조건 일괄 실패 처리는 generic 에러만 보여 진단이 어려웠음).
      const failedSections: string[] = [];
      const [auditRes, alertRes, paymentRes, startupRes] = await Promise.all([
        fetch(`${ADMIN_PROXY}?path=${encodeURIComponent("admin/audit-log?limit=100")}`),
        fetch(`${ADMIN_PROXY}?path=${encodeURIComponent("admin/system-alerts?limit=100")}`),
        fetch(`${ADMIN_PROXY}?path=${encodeURIComponent("admin/payment-events?limit=100")}`),
        fetch(`${ADMIN_PROXY}?path=${encodeURIComponent("admin/startup-reports?limit=100")}`),
      ]);
      if (auditRes.ok) setAuditLog(await auditRes.json()); else failedSections.push("감사 로그");
      if (alertRes.ok) setAlerts(await alertRes.json()); else failedSections.push("시스템 알림");
      if (paymentRes.ok) setPaymentEvents(await paymentRes.json()); else failedSections.push("결제 이벤트");
      if (startupRes.ok) setStartupReports(await startupRes.json()); else failedSections.push("창업리포트");
      if (failedSections.length > 0) {
        setError(`다음 섹션을 불러오지 못했습니다: ${failedSections.join(", ")} (신규 테이블 마이그레이션 미실행일 수 있음)`);
      }
    } catch {
      setError("운영 현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
    loadAdminUsers();
  }, [loadAdminUsers]);

  const handleAddAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newAdminEmail.trim();
    if (!email) return;
    setAdminUserSubmitting(true);
    setAdminUsersError("");
    try {
      const res = await fetch(
        `${ADMIN_PROXY}?path=${encodeURIComponent(`admin/admin-users?email=${encodeURIComponent(email)}&role=${newAdminRole}`)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail ?? "추가 실패");
      }
      setNewAdminEmail("");
      setNewAdminRole("support");
      loadAdminUsers();
    } catch (err: unknown) {
      setAdminUsersError((err as Error).message ?? "추가에 실패했습니다.");
    } finally {
      setAdminUserSubmitting(false);
    }
  };

  const handleRemoveAdminUser = async (email: string) => {
    if (!confirm(`${email} 관리자 권한을 제거하시겠습니까?`)) return;
    try {
      const res = await fetch(`${ADMIN_PROXY}?path=${encodeURIComponent(`admin/admin-users/${encodeURIComponent(email)}`)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.detail ?? "제거 실패");
      }
      loadAdminUsers();
    } catch (err: unknown) {
      setAdminUsersError((err as Error).message ?? "제거에 실패했습니다.");
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">운영 현황</h1>
          <p className="text-sm text-gray-400 mt-1">관리자 감사 로그 · 시스템 알림 이력</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </button>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
            ← 관리자 메인
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>
      )}

      {/* 시스템 알림 이력 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-800">시스템 알림 이력 ({alerts.length}건)</h2>
        </div>
        {loading ? (
          <div className="text-sm text-gray-400 py-4">불러오는 중...</div>
        ) : alerts.length === 0 ? (
          <div className="text-sm text-gray-400 py-4">아직 기록된 알림이 없습니다.</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {alerts.map((a) => (
              <div key={a.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${LEVEL_STYLE[a.level] ?? "bg-gray-100 text-gray-600"}`}>
                    {a.level}
                  </span>
                  {a.source && <span className="text-sm text-gray-400">{a.source}</span>}
                  <span className="text-sm text-gray-400 ml-auto">{formatDate(a.created_at)}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{a.subject}</p>
                {a.message && <p className="text-sm text-gray-500 mt-0.5 whitespace-pre-wrap line-clamp-3">{a.message}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 결제 이벤트 이력 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-800">결제 이벤트 이력 ({paymentEvents.length}건)</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">2026-07-10 이후 이벤트만 기록됩니다(소급 이력 없음). 최초 결제·자동 갱신 재시도를 성공/실패와 함께 기록합니다.</p>
        {loading ? (
          <div className="text-sm text-gray-400 py-4">불러오는 중...</div>
        ) : paymentEvents.length === 0 ? (
          <div className="text-sm text-gray-400 py-4">아직 기록된 결제 이벤트가 없습니다.</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {paymentEvents.map((p) => (
              <div key={p.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${p.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {p.status === "success" ? "성공" : "실패"}
                  </span>
                  <span className="text-sm text-gray-500">{EVENT_TYPE_LABEL[p.event_type] ?? p.event_type}</span>
                  {p.amount != null && <span className="text-sm text-gray-500">{p.amount.toLocaleString()}원</span>}
                  <span className="text-sm text-gray-400 ml-auto">{formatDate(p.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700">{p.email ?? p.user_id}</p>
                {p.status === "failed" && p.detail && (
                  <p className="text-sm text-red-500 mt-0.5 whitespace-pre-wrap line-clamp-2">{p.detail}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 창업 시장 분석 리포트 이력 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-800">창업 시장 분석 리포트 ({startupReports.length}건)</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">2026-07-10 이후 요청만 기록됩니다(소급 이력 없음). 사업장 미등록(예비 창업자)이면 &quot;미등록&quot;으로 표시됩니다.</p>
        {startupReports.length === 0 ? (
          <div className="text-sm text-gray-400 py-2">아직 기록된 창업리포트 요청이 없습니다.</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {startupReports.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-800">{r.category} · {r.region}</span>
                  {!r.business_id && (
                    <span className="text-sm text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">미등록(예비 창업자)</span>
                  )}
                  <span className="text-sm text-gray-400 ml-auto">{formatDate(r.created_at)}</span>
                </div>
                <p className="text-sm text-gray-500">{r.email ?? r.user_id}{r.business_name ? ` · ${r.business_name}` : ""}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 관리자 계정 권한 관리 (owner 전용) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-800">관리자 계정 ({adminUsers.length}명)</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">owner는 구독 강제해지/환불까지 전체 권한, support는 조회·콘텐츠 관리만 가능(금전이동 불가). owner 계정으로 로그인해야 이 섹션을 관리할 수 있습니다.</p>

        {adminUsersError && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-700">{adminUsersError}</div>
        )}

        <form onSubmit={handleAddAdminUser} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="관리자 이메일"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newAdminRole}
            onChange={(e) => setNewAdminRole(e.target.value as "owner" | "support")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="support">support (조회·콘텐츠)</option>
            <option value="owner">owner (전체 권한)</option>
          </select>
          <button
            type="submit"
            disabled={adminUserSubmitting || !newAdminEmail.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {adminUserSubmitting ? "추가 중..." : "추가"}
          </button>
        </form>

        {adminUsers.length === 0 && !adminUsersError ? (
          <div className="text-sm text-gray-400 py-2">등록된 관리자 계정이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {adminUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <span className="text-sm font-medium text-gray-800">{u.email}</span>
                  <span className={`ml-2 text-sm px-2 py-0.5 rounded-full ${u.role === "owner" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                    {u.role}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveAdminUser(u.email)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  aria-label={`${u.email} 제거`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 관리자 감사 로그 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-800">관리자 감사 로그 ({auditLog.length}건)</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">POST·PATCH·DELETE 관리자 액션만 기록됩니다(조회는 제외). admin_email이 비어있으면 curl 등 직접 호출입니다.</p>
        {loading ? (
          <div className="text-sm text-gray-400 py-4">불러오는 중...</div>
        ) : auditLog.length === 0 ? (
          <div className="text-sm text-gray-400 py-4">아직 기록된 관리자 액션이 없습니다.</div>
        ) : (
          <>
            {/* PC 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-sm text-gray-400 border-b border-gray-100">
                    <th className="pb-2 pr-3">시각</th>
                    <th className="pb-2 pr-3">관리자</th>
                    <th className="pb-2 pr-3">액션</th>
                    <th className="pb-2 pr-3">경로</th>
                    <th className="pb-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50 align-top">
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{formatDate(row.created_at)}</td>
                      <td className="py-2 pr-3 text-gray-700">{row.admin_email ?? <span className="text-gray-300">직접호출</span>}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${METHOD_STYLE[row.method] ?? "bg-gray-100 text-gray-600"}`}>
                          {row.method}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-600 font-mono text-sm break-all">{row.path}</td>
                      <td className="py-2 text-gray-500">{row.status_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 모바일 카드 */}
            <div className="md:hidden space-y-2">
              {auditLog.map((row) => (
                <div key={row.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${METHOD_STYLE[row.method] ?? "bg-gray-100 text-gray-600"}`}>
                      {row.method}
                    </span>
                    <span className="text-sm text-gray-400">{formatDate(row.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 font-mono break-all">{row.path}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {row.admin_email ?? "직접호출"} · 상태 {row.status_code}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
