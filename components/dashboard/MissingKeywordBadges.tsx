"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Props {
  keywords: string[];
  bizId: string;
  token?: string;
}

export default function MissingKeywordBadges({ keywords, bizId, token }: Props) {
  const [excluded, setExcluded] = useState<string[]>([]);
  const [visible, setVisible] = useState<string[]>([]);

  // 마운트 시 excluded 목록 로드
  useEffect(() => {
    if (!bizId || !token) return;
    fetch(`${BACKEND}/api/businesses/${bizId}/keywords`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.excluded && Array.isArray(data.excluded)) {
          setExcluded(data.excluded);
        }
      })
      .catch(() => {
        // 로드 실패해도 전체 키워드 표시
      });
  }, [bizId, token]);

  // keywords에서 excluded 필터링
  useEffect(() => {
    setVisible(keywords.filter((kw) => !excluded.includes(kw)));
  }, [keywords, excluded]);

  function handleExclude(kw: string) {
    // 1) 옵티미스틱 UI 제거
    setVisible((prev) => prev.filter((k) => k !== kw));
    setExcluded((prev) => [...prev, kw]);

    // 2) 서버에 영구 저장
    if (!token) return;
    fetch(`${BACKEND}/api/businesses/${bizId}/keywords/exclude`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keyword: kw }),
    }).catch(() => {
      // 실패 시 롤백
      setVisible((prev) => [...prev, kw]);
      setExcluded((prev) => prev.filter((k) => k !== kw));
    });
  }

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((kw) => (
        <span
          key={kw}
          className="inline-flex items-center gap-1 text-sm bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium"
        >
          {kw}
          <button
            type="button"
            onClick={() => handleExclude(kw)}
            title="이 키워드 제외"
            className="hover:text-red-500 transition-colors ml-0.5"
            aria-label={`${kw} 키워드 제외`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
