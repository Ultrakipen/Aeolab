"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface BizOption {
  id: string;
  name: string;
}

interface Props {
  onClose?: () => void;
}

export function SidebarBusinessSwitcher({ onClose }: Props) {
  const [businesses, setBusinesses] = useState<BizOption[]>([]);
  const [activeBizId, setActiveBizId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("businesses")
      .select("id, name")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .then(
        ({ data }) => {
          const list = (data ?? []) as BizOption[];
          setBusinesses(list);
          // 활성 사업장 복원: cookie → localStorage → 첫 번째
          try {
            // cookie에서 읽기
            const cookieMatch = document.cookie
              .split(";")
              .map((c) => c.trim())
              .find((c) => c.startsWith("aeolab_active_biz="));
            const cookieId = cookieMatch ? cookieMatch.split("=")[1] : null;

            if (cookieId && list.find((b) => b.id === cookieId)) {
              setActiveBizId(cookieId);
            } else {
              const stored = localStorage.getItem("aeolab.activeBizId");
              if (stored && list.find((b) => b.id === stored)) {
                // localStorage 값을 cookie에 동기화
                document.cookie = `aeolab_active_biz=${stored}; path=/; max-age=31536000; samesite=lax`;
                setActiveBizId(stored);
              } else if (list.length > 0) {
                document.cookie = `aeolab_active_biz=${list[0].id}; path=/; max-age=31536000; samesite=lax`;
                setActiveBizId(list[0].id);
              }
            }
          } catch {
            if (list.length > 0) setActiveBizId(list[0].id);
          }
          setLoading(false);
        },
        () => setLoading(false),
      );
  }, []);

  // 외부 클릭 시 닫힘
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  function handleSelect(id: string) {
    setActiveBizId(id);
    // cookie 설정 (SSR 페이지가 읽는 값)
    document.cookie = `aeolab_active_biz=${id}; path=/; max-age=31536000; samesite=lax`;
    // localStorage 하위 호환
    try {
      localStorage.setItem("aeolab.activeBizId", id);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("aeolab:active-biz-changed", { detail: { bizId: id } }));
    setOpen(false);
    // 서버 컴포넌트(SSR 페이지) 재렌더 트리거
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-3 mb-3 h-9 bg-gray-100 rounded-lg animate-pulse" aria-hidden="true" />
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="mx-3 mb-3 flex items-center justify-between px-3 py-2 rounded-lg border border-dashed border-gray-200">
        <span className="text-[14px] text-gray-400">사업장 없음</span>
        <Link
          href="/onboarding"
          onClick={onClose}
          className="text-[13px] text-blue-600 hover:text-blue-700 font-medium"
        >
          등록하기
        </Link>
      </div>
    );
  }

  const activeBiz = businesses.find((b) => b.id === activeBizId) ?? businesses[0];
  const canSwitch = businesses.length >= 2;

  return (
    <div ref={containerRef} className="mx-3 mb-3 relative">
      <button
        type="button"
        onClick={() => canSwitch && setOpen((v) => !v)}
        className={[
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50",
          "hover:bg-gray-100 transition-colors text-left",
          canSwitch ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
        aria-haspopup={canSwitch ? "listbox" : undefined}
        aria-expanded={canSwitch ? open : undefined}
        aria-label={canSwitch ? "사업장 전환" : undefined}
        disabled={!canSwitch}
      >
        <span className="flex-1 truncate text-[15px] font-semibold text-gray-900">
          {activeBiz.name}
        </span>
        {canSwitch && (
          <ChevronDown
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        )}
      </button>

      {canSwitch && open && (
        <ul
          role="listbox"
          aria-label="사업장 선택"
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          {businesses.map((biz) => (
            <li key={biz.id} role="option" aria-selected={biz.id === activeBizId}>
              <button
                type="button"
                onClick={() => handleSelect(biz.id)}
                className={[
                  "w-full text-left px-3 py-2.5 text-[14px] transition-colors",
                  biz.id === activeBizId
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="truncate block">{biz.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
