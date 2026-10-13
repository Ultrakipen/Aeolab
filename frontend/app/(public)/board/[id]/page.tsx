import { notFound } from "next/navigation";
import { BoardPostClient } from "./BoardPostClient";
import type { BoardItem } from "@/lib/board";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function fetchMeta(id: number): Promise<(BoardItem & { content?: string }) | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/board/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function BoardPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const num = parseInt(id, 10);
  if (!Number.isFinite(num) || num <= 0) notFound();
  const meta = await fetchMeta(num);
  if (!meta) notFound();
  return <BoardPostClient meta={meta} />;
}
