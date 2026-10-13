"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { apiBase } from "@/lib/api";
import {
  BOARD_CATEGORIES,
  BOARD_CONTENT_MAX,
  BOARD_PW_MIN,
  BOARD_TITLE_MAX,
  boardErrorMessage,
} from "@/lib/board";

const inputCls =
  "w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelCls = "block text-sm font-semibold text-gray-800 mb-1.5";

export function BoardNewForm({ initialType }: { initialType: string }) {
  const [category, setCategory] = useState(
    BOARD_CATEGORIES.some((c) => c.value === initialType) ? initialType : "general",
  );
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titlePrivate, setTitlePrivate] = useState(false);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // 허니팟
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneId, setDoneId] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (password.length < BOARD_PW_MIN) {
      setError(`비밀번호는 ${BOARD_PW_MIN}자 이상으로 정해 주세요.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/api/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          author_name: name,
          password,
          email: email || null,
          title,
          content,
          title_private: titlePrivate,
          consent,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(boardErrorMessage(data));
        return;
      }
      setDoneId((data as { id?: number }).id ?? 0);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  if (doneId !== null) {
    return (
      <section className="px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-xl mx-auto text-center">
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">문의가 접수되었습니다</h1>
          <p className="text-base text-gray-700 leading-relaxed break-keep">
            영업일 기준 1일 이내에 답변드리겠습니다. 내용과 답변은 <b>정하신 비밀번호</b>로 확인할 수 있습니다.
          </p>
          <p className="text-sm text-red-700 mt-3 break-keep">
            비밀번호는 복구할 수 없으니 꼭 기억해 두세요.
            {email ? " 답변이 등록되면 입력하신 이메일로 알려드립니다." : ""}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {doneId > 0 && (
              <Link href={`/board/${doneId}`} className="px-6 py-3 rounded-xl bg-blue-600 text-white text-base font-semibold hover:bg-blue-700">
                내 글 확인하기
              </Link>
            )}
            <Link href="/board" className="px-6 py-3 rounded-xl border border-gray-300 text-base text-gray-800 hover:bg-gray-50">
              목록으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/board" className="text-sm text-blue-700 hover:underline">
          ← 목록으로
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-3 mb-2">문의 남기기</h1>
        <p className="text-base text-gray-600 mb-6 break-keep">로그인 없이 작성할 수 있습니다. 제목은 목록에 공개되고, 내용은 비밀번호로 보호됩니다.</p>

        <form onSubmit={submit} className="space-y-5">
          {/* 허니팟 — 사람에게는 보이지 않음 */}
          <div className="hidden" aria-hidden="true">
            <label>
              웹사이트
              <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <div>
            <label htmlFor="b-cat" className={labelCls}>문의 유형</label>
            <select id="b-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {BOARD_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="b-name" className={labelCls}>이름 (목록에는 일부만 표시)</label>
              <input id="b-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required className={inputCls} placeholder="홍길동" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="b-pw" className={labelCls}>비밀번호 ({BOARD_PW_MIN}자 이상)</label>
              <input id="b-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={40} required className={inputCls} autoComplete="new-password" />
              <p className="text-sm text-gray-600 mt-1">내용·답변을 볼 때 필요합니다. 잊으면 복구할 수 없어요.</p>
            </div>
          </div>

          <div>
            <label htmlFor="b-email" className={labelCls}>답변 알림 받을 이메일 (선택)</label>
            <input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={100} className={inputCls} placeholder="example@company.com" autoComplete="email" />
            <p className="text-sm text-gray-600 mt-1">목록에는 공개되지 않으며, 답변이 등록되면 알림만 보냅니다.</p>
          </div>

          <div>
            <label htmlFor="b-title" className={labelCls}>제목 <span className="font-normal text-gray-600">({title.length}/{BOARD_TITLE_MAX})</span></label>
            <input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={BOARD_TITLE_MAX} required className={inputCls} />
            <p className="text-sm text-gray-600 mt-1">제목은 목록에 공개됩니다. 전화번호·이메일·웹주소는 제목에 쓰지 말고 내용에 적어 주세요.</p>
            <label className="flex items-center gap-2 mt-2 text-sm text-gray-800 cursor-pointer">
              <input type="checkbox" checked={titlePrivate} onChange={(e) => setTitlePrivate(e.target.checked)} className="w-4 h-4" />
              제목도 비공개로 하기 (목록에 &quot;비밀글입니다.&quot;로 표시)
            </label>
          </div>

          <div>
            <label htmlFor="b-content" className={labelCls}>내용 <span className="font-normal text-gray-600">({content.length}/{BOARD_CONTENT_MAX})</span></label>
            <textarea id="b-content" value={content} onChange={(e) => setContent(e.target.value)} maxLength={BOARD_CONTENT_MAX} required rows={8} className={`${inputCls} resize-y`} />
            <p className="text-sm text-gray-600 mt-1">회신받을 연락처(이메일·전화)가 필요하면 내용에 적어 주세요.</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="w-4 h-4 mt-0.5" />
            <span className="break-keep">
              [필수] 문의 처리를 위해 이름·이메일(선택)·작성 내용을 수집·이용하는 데 동의합니다. 비밀번호는 암호화되어 저장됩니다.{" "}
              <Link href="/privacy" target="_blank" className="text-blue-700 underline">개인정보처리방침</Link>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3 break-keep">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !consent}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white text-base font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            등록하기
          </button>
        </form>
      </div>
    </section>
  );
}
