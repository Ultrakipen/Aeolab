"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, ShieldCheck, Bell } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [auditRes, alertRes] = await Promise.all([
        fetch(`${ADMIN_PROXY}?path=${encodeURIComponent("admin/audit-log?limit=100")}`),
        fetch(`${ADMIN_PROXY}?path=${encodeURIComponent("admin/system-alerts?limit=100")}`),
      ]);
      if (!auditRes.ok || !alertRes.ok) throw new Error("API 오류");
      setAuditLog(await auditRes.json());
      setAlerts(await alertRes.json());
    } catch {
      setError("운영 현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

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
