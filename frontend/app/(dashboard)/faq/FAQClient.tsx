"use client";

import { useState, useEffect } from "react";
import { FAQ, Inquiry } from "@/types";
import { ChevronDown, ChevronUp, Send, MessageSquare, HelpCircle } from "lucide-react";
import { submitInquiry, getMyInquiries } from "@/lib/api";

interface Props {
  initialItems: FAQ[];
  userEmail?: string;
  userName?: string;
  isLoggedIn: boolean;
}

const CATEGORY_TABS = [
  { key: "", label: "전체" },
  { key: "general", label: "서비스 이용" },
  { key: "pricing", label: "요금제" },
  { key: "scan", label: "스캔" },
  { key: "guide", label: "개선 가이드" },
];

const SUBJECT_OPTIONS = [
  "서비스 이용 문의",
  "요금제·결제 문의",
  "오류·버그 신고",
  "기타",
];

// ─── FAQ 아코디언 섹션 ────────────────────────────────────────
function FAQSection({ initialItems }: { initialItems: FAQ[] }) {
  const [activeCategory, setActiveCategory] = useState("");
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const filtered =
    activeCategory === ""
      ? initialItems
      : initialItems.filter((f) => f.category === activeCategory);

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4 md:mb-6">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors " +
              (activeCategory === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-gray-400 text-base">등록된 FAQ가 없습니다.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((faq) => {
          const isOpen = openIds.has(faq.id);
          return (
            <div
              key={faq.id}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggle(faq.id)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm md:text-base font-semibold text-gray-900 leading-snug">
                  {faq.question}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed whitespace-pre-wrap pt-3">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 내 문의 내역 ──────────────────────────────────────────────
function MyInquiryList() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    getMyInquiries()
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-2 mt-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 py-10 text-center border border-dashed border-gray-200 rounded-xl">
        <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">아직 문의 내역이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">내 문의 내역</h3>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        return (
          <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className={
                    "shrink-0 text-xs px-2 py-0.5 rounded-full font-medium " +
                    (item.status === "answered"
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700")
                  }
                >
                  {item.status === "answered" ? "답변완료" : "대기중"}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate">
                  {item.subject}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleDateString("ko-KR")}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>
            {isOpen && (
              <div className="bg-gray-50 border-t border-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">문의 내용</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-1">
                    {item.status === "answered" && item.answered_at
                      ? `답변 (${new Date(item.answered_at).toLocaleDateString("ko-KR")})`
                      : "답변"}
                  </p>
                  {item.answer ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {item.answer}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">검토 중입니다.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 문의하기 섹션 ────────────────────────────────────────────
function InquirySection({
  userEmail,
  userName,
  isLoggedIn,
}: {
  userEmail?: string;
  userName?: string;
  isLoggedIn: boolean;
}) {
  const [form, setForm] = useState({
    name: userName || "",
    email: userEmail || "",
    subject: SUBJECT_OPTIONS[0],
    content: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.content.trim()) {
      setError("이름, 이메일, 내용은 필수입니다.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitInquiry(form);
      setSuccess(true);
      setForm({
        name: userName || "",
        email: userEmail || "",
        subject: SUBJECT_OPTIONS[0],
        content: "",
      });
    } catch {
      setError("문의 전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* 문의 폼 */}
      <div className="max-w-2xl mx-auto">
        {success ? (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3 text-green-600 font-bold">✓</div>
            <p className="text-green-700 font-semibold text-base mb-1">
              문의가 접수되었습니다.
            </p>
            <p className="text-green-600 text-sm">
              영업일 1~2일 내 답변 드립니다.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-4 text-sm text-green-600 underline hover:no-underline"
            >
              추가 문의하기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="홍길동"
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                문의 유형 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {SUBJECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                문의 내용 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="문의 내용을 자세히 입력해주세요."
                rows={5}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  전송 중...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  문의 보내기
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* 내 문의 내역 - 로그인 사용자만 */}
      {isLoggedIn && <MyInquiryList />}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function FAQClient({
  initialItems,
  userEmail,
  userName,
  isLoggedIn,
}: Props) {
  const [activeTab, setActiveTab] = useState<"faq" | "inquiry">("faq");

  const MAIN_TABS = [
    { key: "faq" as const, label: "자주 묻는 질문", icon: HelpCircle },
    { key: "inquiry" as const, label: "문의하기", icon: MessageSquare },
  ];

  return (
    <div>
      {/* 메인 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {MAIN_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors " +
              (activeTab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "faq" && <FAQSection initialItems={initialItems} />}
      {activeTab === "inquiry" && (
        <InquirySection
          userEmail={userEmail}
          userName={userName}
          isLoggedIn={isLoggedIn}
        />
      )}
    </div>
  );
}
