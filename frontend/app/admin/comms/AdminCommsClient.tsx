"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const PROXY = "/api/admin-proxy";

type Tab = "status" | "tips" | "messages";

interface SystemStatus {
  maintenance: boolean;
  maintenance_message: string;
  scan_status: string;
  scan_message: string;
  ai_tab_enabled?: boolean;
}

interface Tip {
  id: string;
  section: string;
  title: string;
  body: string;
  cta_label?: string;
  cta_url?: string;
  is_active: boolean;
  priority: number;
  industry_filter?: string[] | null;
  created_at: string;
}

interface Message {
  id: string;
  title: string;
  body: string;
  cta_label?: string;
  cta_url?: string;
  target_segment: string;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
}

async function proxyGet(path: string) {
  try {
    const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`);
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function proxyPost(path: string, body: object) {
  try {
    const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function proxyPatch(path: string, body: object) {
  try {
    const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function proxyDelete(path: string) {
  try {
    const res = await fetch(`${PROXY}?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    return res.ok;
  } catch { return false; }
}

export function AdminCommsClient() {
  const [tab, setTab] = useState<Tab>("status");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const notify = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const loadStatus = useCallback(async () => {
    const data = await proxyGet("api/system/status");
    if (data) setStatus(data);
  }, []);

  const loadTips = useCallback(async () => {
    const data = await proxyGet("api/tips/admin/list");
    if (data) setTips(data.tips || []);
  }, []);

  const loadMessages = useCallback(async () => {
    const data = await proxyGet("api/messages");
    if (data) setMessages(data.messages || []);
  }, []);

  useEffect(() => {
    if (tab === "status") loadStatus();
    else if (tab === "tips") loadTips();
    else if (tab === "messages") loadMessages();
  }, [tab, loadStatus, loadTips, loadMessages]);

  const toggleStatus = async (key: string, currentValue: string | boolean) => {
    const next = currentValue === true || currentValue === "true" ? "false" : "true";
    setLoading(true);
    await proxyPost(`api/system/status/${key}`, { value: next, message: "" });
    await loadStatus();
    setLoading(false);
    notify(`${key} → ${next}`);
  };

  const toggleTip = async (tip: Tip) => {
    await proxyPatch(`api/tips/${tip.id}`, { is_active: !tip.is_active });
    setTips((prev) => prev.map((t) => t.id === tip.id ? { ...t, is_active: !t.is_active } : t));
    notify(tip.is_active ? "팁 비활성화" : "팁 활성화");
  };

  const deleteTip = async (tip: Tip) => {
    if (!confirm(`"${tip.title}" 삭제?`)) return;
    await proxyDelete(`api/tips/${tip.id}`);
    setTips((prev) => prev.filter((t) => t.id !== tip.id));
    notify("팁 삭제됨");
  };

  const toggleMessage = async (m: Message) => {
    await proxyPatch(`api/messages/${m.id}`, { is_active: !m.is_active });
    setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, is_active: !x.is_active } : x));
    notify(m.is_active ? "메시지 비활성화" : "메시지 활성화");
  };

  const deleteMessage = async (m: Message) => {
    if (!confirm(`"${m.title}" 삭제?`)) return;
    await proxyDelete(`api/messages/${m.id}`);
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    notify("메시지 삭제됨");
  };

  // 팁 추가 폼
  const [tipForm, setTipForm] = useState({ section: "score", title: "", body: "", priority: "10" });
  const submitTip = async () => {
    if (!tipForm.title || !tipForm.body) return;
    setLoading(true);
    await proxyPost("api/tips", {
      section: tipForm.section,
      title: tipForm.title,
      body: tipForm.body,
      priority: parseInt(tipForm.priority),
      is_active: true,
    });
    setTipForm({ section: "score", title: "", body: "", priority: "10" });
    await loadTips();
    setLoading(false);
    notify("팁 추가됨");
  };

  // 메시지 추가 폼
  const [msgForm, setMsgForm] = useState({ title: "", body: "", target_segment: "all", cta_label: "", cta_url: "" });
  const submitMessage = async () => {
    if (!msgForm.title || !msgForm.body) return;
    setLoading(true);
    await proxyPost("api/messages", {
      title: msgForm.title,
      body: msgForm.body,
      target_segment: msgForm.target_segment,
      cta_label: msgForm.cta_label || null,
      cta_url: msgForm.cta_url || null,
      is_active: true,
    });
    setMsgForm({ title: "", body: "", target_segment: "all", cta_label: "", cta_url: "" });
    await loadMessages();
    setLoading(false);
    notify("메시지 추가됨");
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "status", label: "시스템 상태" },
    { key: "tips", label: "컨텍스트 팁" },
    { key: "messages", label: "인앱 메시지" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">운영자 소통 관리</h1>
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">← 어드민 홈</Link>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {msg}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 시스템 상태 탭 */}
      {tab === "status" && (
        <div className="space-y-4">
          {status ? (
            <>
              {[
                { key: "maintenance", label: "점검 모드", value: status.maintenance, danger: true },
                { key: "ai_tab_enabled", label: "AI탭 스캐너", value: status.ai_tab_enabled ?? false, danger: false },
              ].map(({ key, label, value, danger }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-white border rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-500">key: {key}</p>
                  </div>
                  <button
                    onClick={() => toggleStatus(key, value)}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      value
                        ? danger ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {value ? "ON" : "OFF"}
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between p-4 bg-white border rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">스캔 상태</p>
                  <p className="text-sm text-gray-500">key: scan_status · 현재: {status.scan_status}</p>
                </div>
                <div className="flex gap-2">
                  {["normal", "degraded", "down"].map((v) => (
                    <button
                      key={v}
                      onClick={async () => {
                        await proxyPost(`api/system/status/scan_status`, { value: v, message: "" });
                        await loadStatus();
                        notify(`scan_status → ${v}`);
                      }}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        status.scan_status === v
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          )}
        </div>
      )}

      {/* 컨텍스트 팁 탭 */}
      {tab === "tips" && (
        <div className="space-y-6">
          {/* 추가 폼 */}
          <div className="p-4 bg-gray-50 rounded-xl border space-y-3">
            <p className="text-sm font-semibold text-gray-700">새 팁 추가</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="text-sm text-gray-500 mb-1 block">섹션</label>
                <select
                  value={tipForm.section}
                  onChange={(e) => setTipForm((f) => ({ ...f, section: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  {["score", "action", "ai_insight", "guide"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="text-sm text-gray-500 mb-1 block">우선순위 (낮을수록 먼저)</label>
                <input
                  type="number"
                  value={tipForm.priority}
                  onChange={(e) => setTipForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <input
              placeholder="제목"
              value={tipForm.title}
              onChange={(e) => setTipForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <textarea
              placeholder="내용"
              value={tipForm.body}
              onChange={(e) => setTipForm((f) => ({ ...f, body: e.target.value }))}
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
            <button
              onClick={submitTip}
              disabled={loading || !tipForm.title || !tipForm.body}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              추가
            </button>
          </div>

          {/* 목록 */}
          <div className="space-y-3">
            {tips.length === 0 && <p className="text-sm text-gray-500">팁이 없습니다.</p>}
            {tips.map((tip) => (
              <div key={tip.id} className={`p-4 border rounded-xl ${tip.is_active ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{tip.section}</span>
                      <span className="text-sm text-gray-400">p{tip.priority}</span>
                      {!tip.is_active && <span className="text-sm bg-gray-200 text-gray-500 px-2 py-0.5 rounded">비활성</span>}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{tip.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{tip.body}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => toggleTip(tip)}
                      className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 transition-colors"
                    >
                      {tip.is_active ? "비활성화" : "활성화"}
                    </button>
                    <button
                      onClick={() => deleteTip(tip)}
                      className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 인앱 메시지 탭 */}
      {tab === "messages" && (
        <div className="space-y-6">
          {/* 추가 폼 */}
          <div className="p-4 bg-gray-50 rounded-xl border space-y-3">
            <p className="text-sm font-semibold text-gray-700">새 메시지 추가</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="text-sm text-gray-500 mb-1 block">대상 세그먼트</label>
                <select
                  value={msgForm.target_segment}
                  onChange={(e) => setMsgForm((f) => ({ ...f, target_segment: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  {["all", "free", "basic", "pro", "biz"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="text-sm text-gray-500 mb-1 block">CTA 버튼 텍스트 (선택)</label>
                <input
                  placeholder="예: 자세히 보기"
                  value={msgForm.cta_label}
                  onChange={(e) => setMsgForm((f) => ({ ...f, cta_label: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <input
              placeholder="제목"
              value={msgForm.title}
              onChange={(e) => setMsgForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <textarea
              placeholder="내용"
              value={msgForm.body}
              onChange={(e) => setMsgForm((f) => ({ ...f, body: e.target.value }))}
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
            />
            {msgForm.cta_label && (
              <input
                placeholder="CTA URL (예: /pricing)"
                value={msgForm.cta_url}
                onChange={(e) => setMsgForm((f) => ({ ...f, cta_url: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            )}
            <button
              onClick={submitMessage}
              disabled={loading || !msgForm.title || !msgForm.body}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              추가
            </button>
          </div>

          {/* 목록 */}
          <div className="space-y-3">
            {messages.length === 0 && <p className="text-sm text-gray-500">메시지가 없습니다.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`p-4 border rounded-xl ${m.is_active ? "bg-white" : "bg-gray-50 opacity-60"}`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{m.target_segment}</span>
                      {!m.is_active && <span className="text-sm bg-gray-200 text-gray-500 px-2 py-0.5 rounded">비활성</span>}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{m.body}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => toggleMessage(m)}
                      className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 transition-colors"
                    >
                      {m.is_active ? "비활성화" : "활성화"}
                    </button>
                    <button
                      onClick={() => deleteMessage(m)}
                      className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
