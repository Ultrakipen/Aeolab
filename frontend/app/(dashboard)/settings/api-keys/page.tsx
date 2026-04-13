"use client";
import { useState, useEffect } from "react";
import { apiBase } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadKeys() {
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/v1/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setKeys(await res.json());
    } catch {}
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    setNewKey("");
    try {
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/v1/keys?name=${encodeURIComponent(name.trim())}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { setError("Biz 플랜 이상의 구독이 필요합니다."); return; }
      if (!res.ok) { setError("발급 중 오류가 발생했습니다."); return; }
      const data = await res.json();
      setNewKey(data.raw_key);
      setName("");
      await loadKeys();
    } catch { setError("오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  async function handleRevoke(id: string) {
    const token = await getToken();
    await fetch(`${apiBase}/api/v1/keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadKeys();
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-5 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Public API 키 관리</h1>
        <p className="text-sm text-gray-500 mt-1">개발자·대행사용 API 접근 키 (Biz/Enterprise 전용, 최대 5개)</p>
      </div>

      {/* 새 키 발급 */}
      <section className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-700 mb-4">새 API 키 발급</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="키 이름 (예: 대행사용)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "발급 중..." : "발급"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {newKey && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-medium text-yellow-800 mb-2">
              API 키가 발급되었습니다. 지금만 확인 가능합니다.
            </p>
            <code className="text-sm font-mono text-yellow-900 break-all">{newKey}</code>
          </div>
        )}
      </section>

      {/* 키 목록 */}
      <section className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <h2 className="text-base md:text-lg font-semibold text-gray-700 mb-3">발급된 키 ({keys.length}/5)</h2>
        {keys.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">발급된 API 키가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">위에서 키 이름을 입력해 발급하세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-3 px-1 border-b border-gray-50 last:border-0">
                <div className="min-w-0 mr-3">
                  <p className="text-sm md:text-base font-medium text-gray-900">{k.name}</p>
                  <p className="text-sm text-gray-400 font-mono mt-0.5">
                    {k.key_prefix}... · 생성: {k.created_at.slice(0, 10)}
                    {k.last_used_at && ` · 최근: ${k.last_used_at.slice(0, 10)}`}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="shrink-0 text-sm text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  폐기
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API 문서 안내 */}
      <section className="bg-gray-50 rounded-2xl p-4 md:p-5 mt-4 border border-gray-100">
        <p className="text-sm text-gray-500">
          API 키 사용: <code className="font-mono text-sm bg-white px-1.5 py-0.5 rounded border border-gray-200">Authorization: Bearer &lt;api_key&gt;</code> 헤더로 전송.
        </p>
        <p className="text-sm text-gray-400 mt-1">
          문서: <span className="text-blue-600">aeolab.co.kr/docs/api</span> (준비 중)
        </p>
      </section>
    </div>
  );
}
