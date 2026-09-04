"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
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
              {loggedIn ? "1:1 문의를 작성할 수 있습니다." : "직접 문의하려면 로그인이 필요합니다."}
            </p>
            {loggedIn === false && (
              <p className="text-sm text-blue-600">로그인 후 1:1 문의를 작성할 수 있습니다.</p>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
        >
          {loggedIn ? "1:1 문의 작성하기 →" : "로그인 후 문의하기 →"}
        </Link>
      </div>
    );
  }

  if (variant === "button") {
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        {loggedIn ? "1:1 문의 작성하기" : "로그인 후 문의하기"}
      </Link>
    );
  }

  return (
    <p className="text-sm text-gray-600">
      궁금한 점은{" "}
      <Link href={href} className="text-blue-600 hover:underline">
        {loggedIn ? "1:1 문의 작성" : "로그인 후 직접 문의"}
      </Link>
      해 주세요.
    </p>
  );
}
