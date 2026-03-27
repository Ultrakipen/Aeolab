"use client";
import { useState, useEffect } from "react";
import { apiBase } from "@/lib/api";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadMembers() {
    try {
      const res = await fetch(`${apiBase}/api/teams/members`, { credentials: "include" });
      if (res.ok) setMembers(await res.json());
    } catch {}
  }

  useEffect(() => { loadMembers(); }, []);

  async function handleInvite() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${apiBase}/api/teams/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (res.status === 403) { setError("Biz 플랜 이상의 구독이 필요합니다."); return; }
      if (res.status === 400) {
        const d = await res.json();
        setError(d.detail?.code === "TEAM_LIMIT_REACHED"
          ? `팀원 한도(${d.detail.limit}명)에 도달했습니다.`
          : "오류가 발생했습니다.");
        return;
      }
      setSuccess(`${email} 초대 완료`);
      setEmail("");
      await loadMembers();
    } catch { setError("초대 중 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  async function handleRemove(id: string) {
    await fetch(`${apiBase}/api/teams/members/${id}`, { method: "DELETE", credentials: "include" });
    await loadMembers();
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">팀 계정 관리</h1>
      <p className="text-sm text-gray-500 mb-6">Biz 플랜: 최대 5명, Enterprise: 최대 20명</p>

      {/* 초대 폼 */}
      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">팀원 초대</h2>
        <div className="flex gap-3 mb-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="member">멤버</option>
            <option value="viewer">뷰어</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            초대
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
      </section>

      {/* 멤버 목록 */}
      <section className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">팀원 목록 ({members.length}명)</h2>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400">초대된 팀원이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-900">{m.email}</p>
                  <p className="text-xs text-gray-400">
                    {m.role === "member" ? "멤버" : "뷰어"} ·{" "}
                    <span className={m.status === "pending" ? "text-yellow-600" : "text-green-600"}>
                      {m.status === "pending" ? "초대 대기" : "활성"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(m.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  제거
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
