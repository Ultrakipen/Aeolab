"use client";

import { useEffect } from "react";

/**
 * 복사 안전망 (2026-11-09) — 카카오톡·네이버 앱 등 인앱 브라우저(WebView)와 구형 브라우저 대비.
 *
 * 이 서비스의 핵심 동작은 "AI가 만든 소개글·FAQ·답글을 복사해 네이버에 붙여 넣기"인데, 코드 27곳이 `navigator.clipboard.writeText(...)`를
 * 직접 부르고 대부분 `.catch(() => {})`로 실패를 삼킨다. API가 없는 환경에서는 `navigator.clipboard`가 undefined라 `.catch`에 닿기도
 * 전에 TypeError가 나고, 거부되면 사용자는 아무 반응도 못 본다.
 * 호출 지점을 하나씩 고치는 대신 한 곳에서 `writeText`를 감싼다:
 *   ① 원래 API가 되면 그대로 쓴다(정상 환경은 동작이 달라지지 않는다).
 *   ② API가 없거나 거부하면 숨은 textarea + execCommand("copy")로 한 번 더 시도한다.
 *   ③ 그래도 안 되면 원래처럼 reject를 돌려주고(기존 호출부의 처리 유지) 화면에 짧은 안내를 띄운다.
 * 모든 설치는 try/catch로 감싸 실패해도 페이지에 영향이 없다.
 */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.setAttribute("aria-hidden", "true");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

let toastTimer: number | undefined;
function showFailToast() {
  try {
    let el = document.getElementById("aeo-copy-fail-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "aeo-copy-fail-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.style.cssText =
        "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:90;max-width:calc(100vw - 32px);" +
        "background:#111827;color:#fff;font-size:14px;line-height:1.5;padding:10px 16px;border-radius:12px;" +
        "box-shadow:0 4px 16px rgba(0,0,0,.25);text-align:center;word-break:keep-all";
      document.body.appendChild(el);
    }
    el.textContent = "복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요.";
    el.style.display = "block";
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (el) el.style.display = "none";
    }, 4000);
  } catch {
    /* 안내 표시 실패는 무시 */
  }
}

export default function ClipboardFallback() {
  useEffect(() => {
    try {
      const nav = navigator as unknown as { clipboard?: { writeText?: (t: string) => Promise<void> } };
      const wrap = (orig?: (t: string) => Promise<void>) => async (text: string) => {
        if (orig) {
          try {
            return await orig(text);
          } catch (e) {
            if (legacyCopy(text)) return;
            showFailToast();
            throw e;
          }
        }
        if (legacyCopy(text)) return;
        showFailToast();
        throw new Error("clipboard unavailable");
      };

      if (!nav.clipboard) {
        Object.defineProperty(navigator, "clipboard", {
          value: { writeText: wrap(undefined) },
          configurable: true,
        });
        return;
      }
      const clip = nav.clipboard;
      const orig = clip.writeText ? clip.writeText.bind(clip) : undefined;
      clip.writeText = wrap(orig);
    } catch {
      /* 설치 실패 시 기존 동작 유지 */
    }
  }, []);
  return null;
}
