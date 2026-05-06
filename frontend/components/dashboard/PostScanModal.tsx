"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface PostScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  topMissingKeyword: string | null;
  faqCopyText: string | null;
  businessName: string;
}

const COUNTDOWN_SEC = 5;

export default function PostScanModal({
  isOpen,
  onClose,
  topMissingKeyword,
  faqCopyText,
  businessName,
}: PostScanModalProps) {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(COUNTDOWN_SEC);
      setCopied(false);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, onClose]);

  const handleCopy = () => {
    if (!faqCopyText) return;
    navigator.clipboard.writeText(faqCopyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // 무시
    });
  };

  if (!isOpen) return null;

  const progress = ((COUNTDOWN_SEC - countdown) / COUNTDOWN_SEC) * 100;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal — PC: 중앙, 모바일: bottom sheet */}
      <div className="fixed z-50 inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden">
          {/* 헤더 */}
          <div className="bg-green-50 border-b border-green-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-xl">✓</span>
              <p className="text-base md:text-lg font-bold text-green-800">스캔 완료! 지금 바로 할 수 있는 것</p>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 본문 */}
          <div className="px-5 py-5 space-y-4">
            {/* 없는 키워드 + FAQ 복사 */}
            {topMissingKeyword ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-bold text-amber-800 mb-1">
                  ❌ &ldquo;{topMissingKeyword}&rdquo; 키워드가 없습니다
                </p>
                <p className="text-sm text-amber-700 mb-3">
                  스마트플레이스 소개글 안 Q&A에 이 키워드를 포함하면 AI 브리핑 인용 후보 가능성이 높아집니다.
                </p>
                {faqCopyText && (
                  <div className="bg-white border border-amber-200 rounded-lg p-3 mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1.5">바로 복사해서 FAQ에 붙여넣기</p>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{faqCopyText}</p>
                  </div>
                )}
                <button
                  onClick={handleCopy}
                  disabled={!faqCopyText}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      복사됨
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      FAQ 문구 복사
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">
                  {businessName} 스캔이 완료됐습니다
                </p>
                <p className="text-sm text-blue-700">
                  아래 가이드에서 개선할 수 있는 항목을 확인해 보세요.
                </p>
              </div>
            )}

            {/* 액션 링크 */}
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="https://smartplace.naver.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                스마트플레이스 바로 가기
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <Link
                href="/guide"
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors"
              >
                가이드에서 전체 보기
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* 카운트다운 프로그레스 바 */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400">{countdown}초 후 자동으로 닫힙니다</span>
              <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
                지금 닫기
              </button>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
