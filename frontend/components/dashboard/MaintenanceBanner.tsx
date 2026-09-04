"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface SystemStatus {
  maintenance: boolean;
  maintenance_message?: string;
  scan_status: string;
  scan_message?: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export function MaintenanceBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/system/status`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        if (data) setStatus(data as SystemStatus);
      });
  }, []);

  if (!status?.maintenance) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">시스템 점검 중</p>
        {status.maintenance_message && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{status.maintenance_message}</p>
        )}
        {!status.maintenance_message && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
            일시적으로 일부 기능이 제한될 수 있습니다. 이용에 불편을 드려 죄송합니다.
          </p>
        )}
      </div>
    </div>
  );
}
