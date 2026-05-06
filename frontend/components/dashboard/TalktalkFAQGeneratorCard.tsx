"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface ChatMenu {
  menu_name: string;        // 6자 이내
  link_type: "message" | "url";
  url?: string | null;
  message?: string | null;
}

interface GeneratedResult {
  items: FAQItem[];         // 소개글 Q&A 섹션용
  chat_menus: ChatMenu[];   // 채팅방 메뉴 6개
}

// 기존 사용자 talktalk_faq_draft의 string[] 형태를 ChatMenu[]로 안전 변환
function normalizeChatMenus(raw: unknown[]): ChatMenu[] {
  return raw.map((item) => {
    if (typeof item === "string") {
      // 하위 호환: 기존 string → link_type="message" 기본값 변환
      return { menu_name: item.slice(0, 6), link_type: "message" as const, message: item };
    }
    return item as ChatMenu;
  });
}

interface Props {
  bizId: string;
  initialDraft?: { items?: FAQItem[]; chat_menus?: unknown[] } | null;
  generatedAt?: string;
  planLabel?: string;
  planMonthlyLimit?: number;
}

export function TalktalkFAQGeneratorCard({
  bizId,
  initialDraft,
  generatedAt,
  planLabel = "Free",
  planMonthlyLimit = 0,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedResult | null>(() => {
    if (!initialDraft) return null;
    const items = initialDraft.items ?? [];
    const rawMenus = initialDraft.chat_menus ?? [];
    return { items, chat_menus: normalizeChatMenus(rawMenus) };
  });
  const [copiedFaqIndex, setCopiedFaqIndex] = useState<number | null>(null);
  const [copiedMenuIndex, setCopiedMenuIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [error, setError] = useState<string>("");

  const canGenerate = planMonthlyLimit > 0;
  const planBadgeColor =
    planMonthlyLimit === 0 ? "bg-gray-100 text-gray-700" :
    planMonthlyLimit >= 999 ? "bg-emerald-100 text-emerald-700" :
    "bg-purple-100 text-purple-700";

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/api/guide/${bizId}/smartplace-faq`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ count: 5 }),
        }
      );
      if (!res.ok) {
        if (res.status === 403) throw new Error("이 기능은 Basic 이상 플랜에서 사용 가능합니다.");
        if (res.status === 429) throw new Error(`이번 달 한도(${planMonthlyLimit}회)에 도달했습니다.`);
        throw new Error("생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
      const data = await res.json();
      setGenerated({
        items: data.items ?? [],
        chat_menus: normalizeChatMenus(data.chat_menus ?? []),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const copyFaqOne = async (faq: FAQItem, index: number) => {
    const text = `Q. ${faq.question}\nA. ${faq.answer}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFaqIndex(index);
      setTimeout(() => setCopiedFaqIndex(null), 2000);
    } catch {
      alert("복사에 실패했습니다. 텍스트를 직접 선택해주세요.");
    }
  };

  const copyMenuContent = async (menu: ChatMenu, index: number) => {
    const text = menu.link_type === "url"
      ? (menu.url ?? menu.menu_name)
      : (menu.message ?? menu.menu_name);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMenuIndex(index);
      setTimeout(() => setCopiedMenuIndex(null), 2000);
    } catch {
      alert("복사에 실패했습니다.");
    }
  };

  const copyAll = async () => {
    if (!generated) return;
    const text = generated.items
      .map((faq) => `[${faq.category}]\nQ. ${faq.question}\nA. ${faq.answer}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      alert("복사에 실패했습니다. 텍스트를 직접 선택해주세요.");
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="text-base md:text-lg font-bold text-gray-900">
          톡톡 채팅방 메뉴 자동 생성
        </h3>
        <span className={`text-xs md:text-sm px-2 py-0.5 rounded-full font-medium ${planBadgeColor}`}>
          {planLabel} 플랜 · 월 {planMonthlyLimit >= 999 ? "무제한" : `${planMonthlyLimit}회`}
        </span>
      </div>

      <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
        네이버 톡톡 채팅방 하단에 노출되는 메뉴 6개를 생성합니다.
        메뉴 클릭 시 메시지 전송 또는 URL 실행을 선택할 수 있습니다.
      </p>

      {!canGenerate && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm md:text-base text-gray-700">
          <strong>Free 플랜은 사용할 수 없습니다.</strong> Basic 이상 플랜에서 월 5회부터 사용 가능합니다.{" "}
          <a href="/pricing" className="text-blue-600 hover:underline font-medium">플랜 보기 →</a>
        </div>
      )}

      {!generated && canGenerate && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full md:w-auto px-5 py-3 bg-purple-600 text-white rounded font-medium text-sm md:text-base hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {generating ? "생성 중... (30초)" : "채팅방 메뉴 자동 생성"}
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm md:text-base text-red-700 bg-red-50 p-3 rounded border border-red-200">
          {error}
        </p>
      )}

      {generated && (
        <div className="mt-4 space-y-5">
          {generatedAt && (
            <p className="text-sm text-gray-500">
              마지막 생성: {new Date(generatedAt).toLocaleString("ko-KR")}
            </p>
          )}

          {/* ── 채팅방 메뉴 6개 카드 ── */}
          {generated.chat_menus.length > 0 && (
            <div>
              <h4 className="text-sm md:text-base font-bold text-gray-900 mb-3">
                채팅방 메뉴 {generated.chat_menus.length}개
                <span className="ml-2 text-xs md:text-sm text-gray-500 font-normal">(메뉴명 6자 이내)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {generated.chat_menus.map((menu, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-gray-50 p-3 flex flex-col gap-2"
                  >
                    {/* 메뉴명 + 배지 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm md:text-base font-bold text-gray-900">
                        {menu.menu_name}
                      </span>
                      {menu.link_type === "url" ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          URL
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                          메시지
                        </span>
                      )}
                    </div>

                    {/* URL 또는 메시지 미리보기 */}
                    {menu.link_type === "url" && menu.url ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={menu.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs md:text-sm text-blue-600 hover:underline truncate max-w-[160px]"
                        >
                          {menu.url}
                        </a>
                        <button
                          onClick={() => copyMenuContent(menu, i)}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium shrink-0"
                        >
                          {copiedMenuIndex === i ? "복사됨!" : "URL 복사"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="text-xs md:text-sm text-gray-600 leading-relaxed flex-1 min-w-0">
                          {menu.message ?? ""}
                        </p>
                        <button
                          onClick={() => copyMenuContent(menu, i)}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium shrink-0"
                        >
                          {copiedMenuIndex === i ? "복사됨!" : "복사"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 등록 안내 */}
              <p className="mt-3 text-sm md:text-base text-gray-600 leading-relaxed">
                네이버 톡톡 파트너센터 → <strong>채팅방 메뉴관리</strong>에 등록하세요.
                아이콘 2단(6개) / 1단(3개) / 텍스트(최대 12개) 중 선택 가능합니다.
              </p>
            </div>
          )}

          {/* ── 소개글 Q&A 섹션 ── */}
          {generated.items.length > 0 && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <p className="text-sm md:text-base text-blue-900 leading-relaxed">
                  <strong>소개글에 포함할 Q&A {generated.items.length}개</strong> —
                  스마트플레이스 → 업체정보 → 소개글에 자연스럽게 포함하세요.
                  소개글 안의 Q&A 섹션이 사장님이 직접 컨트롤할 수 있는 가장 효과적인 AI 브리핑 인용 후보 경로입니다.
                </p>
              </div>
              <div className="space-y-3">
                {generated.items.map((faq, i) => (
                  <div key={i} className="p-3 md:p-4 bg-gray-50 rounded border">
                    <div className="text-xs md:text-sm text-purple-700 font-medium mb-1">
                      [{faq.category}]
                    </div>
                    <div className="text-sm md:text-base font-medium text-gray-900 mb-1">
                      Q. {faq.question}
                    </div>
                    <div className="text-sm md:text-base text-gray-700 mb-2 leading-relaxed">
                      A. {faq.answer}
                    </div>
                    <button
                      onClick={() => copyFaqOne(faq, i)}
                      className="text-xs md:text-sm text-blue-700 hover:underline font-medium"
                    >
                      {copiedFaqIndex === i ? "복사됨!" : "이 Q&A 복사"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 하단 액션 버튼 ── */}
          <div className="flex flex-col md:flex-row gap-2">
            {generated.items.length > 0 && (
              <button
                onClick={copyAll}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded font-medium text-sm md:text-base hover:bg-green-700 transition-colors"
              >
                {copiedAll ? "복사됨!" : "소개글 Q&A 전체 복사"}
              </button>
            )}
            <a
              href="https://partner.talk.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-3 bg-gray-700 text-white rounded font-medium text-sm md:text-base hover:bg-gray-800 transition-colors text-center"
            >
              네이버 톡톡 파트너센터 열기 →
            </a>
            {canGenerate && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-3 border border-gray-300 rounded font-medium text-sm md:text-base hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                다시 생성
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
