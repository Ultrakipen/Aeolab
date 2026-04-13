"use client";
import { useState, useEffect } from "react";
import { apiBase } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
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
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/teams/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const token = await getToken();
      const res = await fetch(`${apiBase}/api/teams/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    const token = await getToken();
    await fetch(`${apiBase}/api/teams/members/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadMembers();
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-5 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">팀 계정 관리</h1>
        <p className="text-sm text-gray-500 mt-1">Biz 플랜: 최대 5명, Enterprise: 최대 20명</p>
      </div>

      {/* 초대 폼 */}
      <section className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 mb-4 md:mb-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-700 mb-4">팀원 초대</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none sm:w-28"
          >
            <option value="member">멤버</option>
            <option value="viewer">뷰어</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={loading}
            className="w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "초대 중..." : "초대"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        {success && <p className="text-sm text-green-600 mt-2">{success}</p>}
      </section>

      {/* 멤버 목록 */}
      <section className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <h2 className="text-base md:text-lg font-semibold text-gray-700 mb-3">팀원 목록 ({members.length}명)</h2>
        {members.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">초대된 팀원이 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">위에서 이메일 주소를 입력해 팀원을 초대하세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3 px-1 border-b border-gray-50 last:border-0">
                <div className="min-w-0 mr-3">
                  <p className="text-sm md:text-base font-medium text-gray-900 truncate">{m.email}</p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {m.role === "member" ? "멤버" : "뷰어"} ·{" "}
                    <span className={m.status === "pending" ? "text-yellow-600" : "text-green-600"}>
                      {m.status === "pending" ? "초대 대기" : "활성"}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(m.id)}
                  className="shrink-0 text-sm text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
