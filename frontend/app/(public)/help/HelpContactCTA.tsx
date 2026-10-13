"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { getSafeSession } from "@/lib/supabase/client";

export function HelpContactCTA({ variant }: { variant: "banner" | "footer" | "button" }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getSafeSession().then((session) => {
      if (!active) return;
      setLoggedIn(!!session?.user);
    });
    return () => {
      active = false;
    };
  }, []);

  const href = loggedIn ? "/support/tickets/new" : "/login?next=/support/tickets/new";

  if (variant === "banner") {
    return (
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              {loggedIn ? "1:1 문의를 작성할 수 있습니다." : "해결되지 않으셨나요? 로그인 없이도 문의를 남길 수 있습니다."}
            </p>
            {loggedIn === false && (
              <p className="text-sm text-blue-700">구독 중이라면 로그인 후 1:1 문의가 계정·결제 문제 처리에 더 빠릅니다.</p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col sm:flex-row gap-2">
          <Link
            href={href}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
          >
            <span className="inline-flex items-center gap-1">{loggedIn ? "1:1 문의 작성하기" : "로그인 후 문의하기"} <ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
          </Link>
          {!loggedIn && (
            <Link
              href="/board/new"
              className="px-4 py-2 rounded-xl border border-blue-300 bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors text-center"
            >
              로그인 없이 게시판에 문의
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (variant === "button") {
    return (
      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          {loggedIn ? "1:1 문의 작성하기" : "로그인 후 문의하기"}
        </Link>
        {!loggedIn && (
          <Link
            href="/board/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-blue-300 bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            로그인 없이 게시판에 문의
          </Link>
        )}
      </div>
    );
  }

  return (
    <p className="text-sm text-gray-600">
      궁금한 점은{" "}
      <Link href={href} className="text-blue-600 hover:underline">
        {loggedIn ? "1:1 문의 작성" : "로그인 후 직접 문의"}
      </Link>
      해 주세요.
      {!loggedIn && (
        <>
          {" "}로그인 없이는{" "}
          <Link href="/board/new" className="text-blue-600 hover:underline">
            게시판에 문의 남기기
          </Link>
          가 가능합니다.
        </>
      )}
    </p>
  );
}
