import { Notice } from "@/types";
import NoticesClient from "./NoticesClient";

export const metadata = { title: "공지사항 | AEOlab" };

async function fetchNotices(): Promise<{ items: Notice[]; total: number; page: number }> {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  try {
    const res = await fetch(BACKEND_URL + "/api/notices?page=1", { cache: "no-store" });
    if (!res.ok) return { items: [], total: 0, page: 1 };
    return res.json();
  } catch {
    return { items: [], total: 0, page: 1 };
  }
}

export default async function NoticesPage() {
  // 비로그인 사용자도 공지사항 조회 가능
  const { items, total } = await fetchNotices();

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">공지사항</h1>
      <NoticesClient initialItems={items} initialTotal={total} />
    </div>
  );
}
