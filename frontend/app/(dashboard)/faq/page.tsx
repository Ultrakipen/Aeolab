import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FAQ } from "@/types";
import FAQClient from "./FAQClient";

export const metadata = { title: "고객 지원 | AEOlab" };

async function fetchFAQs(): Promise<FAQ[]> {
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  try {
    const res = await fetch(BACKEND_URL + "/api/faq", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function FAQPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const items = await fetchFAQs();

  // 프로필에서 이름 조회 시도
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">고객 지원</h1>
        <p className="text-sm text-gray-500 mt-1">자주 묻는 질문 확인 및 1:1 문의</p>
      </div>
      <FAQClient
        initialItems={items}
        userEmail={user.email}
        userName={(profile as { full_name?: string } | null)?.full_name ?? undefined}
        isLoggedIn={true}
      />
    </div>
  );
}
