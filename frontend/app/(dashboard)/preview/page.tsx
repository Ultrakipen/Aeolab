import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PreviewClient from "./PreviewClient";
import type { ScanResult } from "@/types";

export const metadata = {
  title: "요금제별 미리보기 — AEOlab",
  description: "각 요금제에서 볼 수 있는 기능을 내 사업장 데이터로 미리 확인하세요.",
};

export default async function PreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    redirect("/login");
  }

  // 구독 플랜 조회
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "hoozdev@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());

  const activePlan = isAdmin
    ? "biz"
    : (sub?.status === "active" || sub?.status === "grace_period")
    ? (sub?.plan ?? "free")
    : "free";

  // 첫 번째 활성 사업장 조회
  const { data: biz } = await supabase
    .from("businesses")
    .select("id, name, category, region")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 최신 스캔 결과 조회
  let latestScan: ScanResult | null = null;
  if (biz) {
    const { data: scan } = await supabase
      .from("scan_results")
      .select(
        "id, business_id, scanned_at, query_used, total_score, exposure_freq, unified_score, track1_score, track2_score, naver_weight, global_weight, keyword_coverage, growth_stage, growth_stage_label, is_keyword_estimated, score_breakdown, naver_channel_score, global_channel_score, competitor_scores"
      )
      .eq("business_id", biz.id)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestScan = scan as ScanResult | null;
  }

  return (
    <PreviewClient
      currentPlan={activePlan}
      businessData={
        biz
          ? { id: biz.id, name: biz.name, category: biz.category, region: biz.region }
          : null
      }
      latestScan={latestScan}
    />
  );
}
