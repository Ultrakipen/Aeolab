/**
 * 관리자 API 프록시 — 서버 사이드에서 ADMIN_SECRET_KEY 처리
 * 클라이언트 번들에 관리자 키가 노출되지 않도록 함
 * [C-01 fix] Supabase 세션 기반 관리자 인증 추가 — ADMIN_SECRET_KEY 유출 시 이중 방어
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  // 관리자 세션 검증 — 유효한 Supabase 관리자 계정만 통과
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "";
  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  // 쿼리 파라미터 전달 (path 제외)
  const forwardParams = new URLSearchParams(searchParams);
  forwardParams.delete("path");
  const qs = forwardParams.toString();
  const backendUrl = `${BACKEND}/${path.replace(/^\//, "")}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {
    "X-Admin-Key": ADMIN_KEY,
  };

  let body: string | undefined;
  if (method !== "GET" && method !== "DELETE") {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      headers["Content-Type"] = "application/json";
      body = await req.text();
    }
  }

  try {
    const res = await fetch(backendUrl, { method, headers, body });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return proxy(req, "GET"); }
export async function POST(req: NextRequest) { return proxy(req, "POST"); }
export async function PATCH(req: NextRequest) { return proxy(req, "PATCH"); }
export async function DELETE(req: NextRequest) { return proxy(req, "DELETE"); }
