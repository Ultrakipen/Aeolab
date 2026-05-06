"use client";

import { useState } from "react";
import { X, Mail, Copy, Check, MessageSquare } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ContactModal({ open, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  if (!open) return null;

  const EMAIL = "hello@aeolab.co.kr";

  const handleCopy = () => {
    navigator.clipboard.writeText(EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleMailto = () => {
    const subject = encodeURIComponent("[Biz 문의] AEOlab 기업 플랜 문의");
    const body = encodeURIComponent(
      `담당자 이름: ${name}\n회신 이메일: ${email}\n\n문의 내용:\n${message}\n\n---\nAEOlab Biz 플랜 문의입니다.`
    );
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Biz 플랜 문의하기</h2>
            <p className="text-sm text-gray-500 mt-0.5">다점포·대행사 전용 — 맞춤 견적 안내드립니다</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">이메일 앱이 열렸습니다</p>
              <p className="text-sm text-gray-500">
                이메일 앱이 열리지 않으면 아래 주소로 직접 보내주세요.
              </p>
              <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{EMAIL}</span>
                <button onClick={handleCopy} className="ml-2 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
              <button
                onClick={onClose}
                className="mt-4 w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">담당자 이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">회신받을 이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">문의 내용</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="사업장 수, 현재 상황, 궁금한 점을 자유롭게 적어주세요"
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* 이메일 주소 표시 */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{EMAIL}</span>
                </div>
                <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors" title="이메일 복사">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>

              <button
                onClick={handleMailto}
                disabled={!email || !message}
                className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                이메일로 문의 보내기
              </button>
              <p className="text-sm text-center text-gray-500">
                영업일 기준 1일 이내 회신드립니다
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
