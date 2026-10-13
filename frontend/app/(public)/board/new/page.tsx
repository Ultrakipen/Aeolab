import { BoardNewForm } from "./BoardNewForm";

export default async function BoardNewPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  return <BoardNewForm initialType={sp.type ?? "general"} />;
}
