/**
 * 크렙(Krep) 결제 SDK 로더 — https://docs.creb.co.kr/web-payment , /api-payment
 * npm 패키지가 아니라 pay.js 스크립트를 동적으로 주입하며, 전역 `Hansolpay(clientKey)`를 노출한다.
 * 결제창/카드등록창은 successUrl·failUrl로 리다이렉트되므로 이 함수들은 보통 반환 전에 페이지가 이동한다.
 */
import { createClient } from "@/lib/supabase/client";

const CREB_SCRIPT_URL = "https://payapi.creb.co.kr/assets/js/pay.js";

export interface CrebPaymentRequest {
  amount: string; // 숫자만, 1원 이상, 최대 10자
  orderId: string; // 가맹점 고유값, 최대 64자
  orderName: string; // 최대 100자
  customerName: string; // 필수, 최대 50자
  customerPhone: string; // 필수, 하이픈 없이 10~11자
  customerEmail?: string;
  successUrl: string;
  failUrl: string;
  customData?: string;
}

interface CrebSdk {
  requestBillingAuth(opts: { successUrl: string; failUrl: string }): void | Promise<void>;
  requestPayment(opts: CrebPaymentRequest): void | Promise<void>;
}

declare global {
  interface Window {
    Hansolpay?: (clientKey: string) => CrebSdk;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (window.Hansolpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = CREB_SCRIPT_URL;
    el.async = true;
    el.onload = () => (window.Hansolpay ? resolve() : reject(new Error("크렙 결제 모듈을 불러오지 못했습니다.")));
    el.onerror = () => {
      scriptPromise = null; // 재시도 허용
      reject(new Error("크렙 결제 모듈을 불러오지 못했습니다. 네트워크를 확인해 주세요."));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

export async function loadCreb(): Promise<CrebSdk> {
  const clientKey = process.env.NEXT_PUBLIC_CREB_CLIENT_KEY;
  if (!clientKey) throw new Error("결제 키가 설정되지 않았습니다.");
  await loadScript();
  return window.Hansolpay!(clientKey);
}

/** 웹결제창 필수 구매자 정보 — 전화번호는 profiles에서 가져오며 없으면 null(임의 번호 금지). */
export async function getBuyerInfo(): Promise<{ name: string; phone: string | null; email: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { name: "", phone: null, email: null };
  const { data } = await supabase.from("profiles").select("phone").eq("user_id", user.id).maybeSingle();
  const digits = (data?.phone ?? "").replace(/\D/g, "");
  const email = user.email ?? null;
  const name =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    (email ? email.split("@")[0] : "AEOlab 회원");
  return { name: name.slice(0, 50), phone: digits.length >= 10 && digits.length <= 11 ? digits : null, email };
}
