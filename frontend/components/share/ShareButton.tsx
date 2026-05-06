"use client";

import { useState } from "react";
import { MessageCircle, Share2, Link2, Check } from "lucide-react";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
}

export default function ShareButton({ title, text, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("링크를 클립보드에 복사하지 못했습니다.");
    }
  };

  const handleKakaoShare = () => {
    const kakaoText = `${title}\n${text}\n\n${shareUrl}`;
    // 카카오 SDK 미로드 시 카카오톡 앱 링크로 대체
    const kakaoLink = `https://sharer.kakao.com/talk/friends/picker/link?app_key=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY || ""}&text=${encodeURIComponent(kakaoText)}`;
    window.open(kakaoLink, "_blank", "width=400,height=600");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleKakaoShare}
        className="flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-yellow-500 transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" /> 카카오 공유
      </button>
      <button
        onClick={handleNativeShare}
        className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <Share2 className="w-3.5 h-3.5" /> 공유
      </button>
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        {copied ? "복사됨" : "링크 복사"}
      </button>
    </div>
  );
}
