"use client";
import { useState, useEffect } from "react";
import { apiBase } from "@/lib/api";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadKeys() {
    try {
      const res = await fetch(`${apiBase}/api/v1/keys`, { credentials: "include" });
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
      const res = await fetch(`${apiBase}/api/v1/keys?name=${encodeURIComponent(name.trim())}`, {
        method: "POST",
        credentials: "include",
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
    await fetch(`${apiBase}/api/v1/keys/${id}`, { method: "DELETE", credentials: "include" });
    await loadKeys();
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Public API 키 관리</h1>
      <p className="text-sm text-gray-500 mb-6">개발자·대행사용 API 접근 키 (Biz/Enterprise 전용, 최대 5개)</p>

      {/* 새 키 발급 */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">새 API 키 발급</h2>
        <div className="flex gap-3 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="키 이름 (예: 대행사용)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            발급
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {newKey && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs font-medium text-yellow-800 mb-1">
              API 키가 발급되었습니다. 지금만 확인 가능합니다.
            </p>
            <code className="text-xs font-mono text-yellow-900 break-all">{newKey}</code>
          </div>
        )}
      </section>

      {/* 키 목록 */}
      <section className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">발급된 키 ({keys.length}/5)</h2>
        {keys.length === 0 ? (
          <p className="text-sm text-gray-400">발급된 API 키가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-400 font-mono">
                    {k.key_prefix}... · 생성: {k.created_at.slice(0, 10)}
                    {k.last_used_at && ` · 최근 사용: ${k.last_used_at.slice(0, 10)}`}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  폐기
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API 문서 안내 */}
      <section className="bg-gray-50 rounded-2xl p-5 mt-4">
        <p className="text-xs text-gray-500">
          API 키 사용: <code className="font-mono">Authorization: Bearer {"<api_key>"}</code> 헤더로 전송.
          <br />
          문서: <span className="text-blue-600">aeolab.co.kr/docs/api</span> (준비 중)
        </p>
      </section>
    </div>
  );
}
