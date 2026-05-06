"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

interface Props {
  onClick?: () => void;
}

export function FloatingChatButton({ onClick }: Props) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="fixed right-5 bottom-[80px] lg:bottom-5 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center transition-colors"
        aria-label="1:1 문의"
      >
        <MessageCircle className="w-6 h-6 text-white" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Link
      href="/support/tickets"
      className="fixed right-5 bottom-[80px] lg:bottom-5 z-30 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center transition-colors"
      aria-label="1:1 문의"
    >
      <MessageCircle className="w-6 h-6 text-white" aria-hidden="true" />
    </Link>
  );
}
