import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      return NextResponse.json({ authorized: false }, { status: 403 });
    }

    const adminKey = process.env.ADMIN_SECRET_KEY;
    if (!adminKey) {
      return NextResponse.json({ authorized: false }, { status: 500 });
    }

    return NextResponse.json({ authorized: true, key: adminKey });
  } catch {
    return NextResponse.json({ authorized: false }, { status: 500 });
  }
}
