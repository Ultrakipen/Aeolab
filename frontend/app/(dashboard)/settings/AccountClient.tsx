"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  currentEmail: string;
}

export function AccountClient({ currentEmail }: Props) {
  // 비밀번호 변경
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 이메일 변경
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 계정 탈퇴
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const supabase = createClient();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({ type: "err", text: "비밀번호는 8자 이상이어야 합니다." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "err", text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMsg({ type: "ok", text: "비밀번호가 변경되었습니다." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setPwMsg({ type: "err", text: msg });
    } finally {
      setPwSaving(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    if (!newEmail || !newEmail.includes("@")) {
      setEmailMsg({ type: "err", text: "올바른 이메일 주소를 입력하세요." });
      return;
    }
    if (newEmail === currentEmail) {
      setEmailMsg({ type: "err", text: "현재 이메일과 동일합니다." });
      return;
    }
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setEmailMsg({ type: "ok", text: `${newEmail}으로 확인 메일을 발송했습니다. 메일함을 확인해 주세요.` });
      setNewEmail("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setEmailMsg({ type: "err", text: msg });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("인증 세션이 만료되었습니다. 다시 로그인해 주세요.");
      const res = await fetch(`${BACKEND}/api/settings/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "삭제 중 오류가 발생했습니다.");
      }
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setDeleteMsg(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 비밀번호 변경 */}
      <div className="border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-1">비밀번호 변경</h3>
        <p className="text-xs text-gray-400 mb-3">새 비밀번호는 8자 이상이어야 합니다.</p>
        <form onSubmit={handlePasswordChange} className="space-y-2">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호 (8자 이상)"
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
            autoComplete="new-password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {pwMsg && (
            <p className={`text-xs ${pwMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{pwMsg.text}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving || !newPassword || !confirmPassword}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
            >
              {pwSaving ? "변경 중..." : "변경"}
            </button>
          </div>
        </form>
      </div>

      {/* 이메일 변경 */}
      <div className="border border-gray-100 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-1">이메일 변경</h3>
        <p className="text-xs text-gray-400 mb-3">
          현재: <span className="text-gray-600">{currentEmail}</span>
          {" "}— 새 이메일로 확인 메일이 발송됩니다.
        </p>
        <form onSubmit={handleEmailChange} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="새 이메일 주소"
            autoComplete="email"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={emailSaving || !newEmail}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {emailSaving ? "발송 중..." : "변경"}
          </button>
        </form>
        {emailMsg && (
          <p className={`text-xs mt-2 ${emailMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{emailMsg.text}</p>
        )}
      </div>

      {/* 계정 탈퇴 */}
      <div className="border border-red-100 rounded-xl p-5">
        <h3 className="text-sm font-medium text-red-700 mb-1">계정 탈퇴</h3>
        <p className="text-xs text-gray-400 mb-3">탈퇴 시 모든 사업장, 스캔 기록, 구독이 영구 삭제됩니다.</p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-500 hover:text-red-700 underline transition-colors"
          >
            계정 탈퇴하기
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-700">
              탈퇴를 확인하려면 아래에 <strong>탈퇴합니다</strong>를 입력하세요.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="탈퇴합니다"
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            {deleteMsg && <p className="text-xs text-red-500">{deleteMsg}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteInput !== "탈퇴합니다"}
                className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting ? "처리 중..." : "탈퇴 확인"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); setDeleteMsg(""); }}
                className="text-sm border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
