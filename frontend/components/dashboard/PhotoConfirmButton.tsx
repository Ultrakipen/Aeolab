'use client';

import { useState } from 'react';

interface Props {
  bizId: string;
  accessToken: string;
  naverPlaceId?: string | null;
  effect: string;
  alreadyConfirmed?: boolean;
}

export default function PhotoConfirmButton({
  bizId,
  accessToken,
  naverPlaceId,
  effect,
  alreadyConfirmed,
}: Props) {
  const [confirmed, setConfirmed] = useState(alreadyConfirmed ?? false);
  const [loading, setLoading] = useState(false);

  const photoUrl = naverPlaceId
    ? `https://m.place.naver.com/place/${naverPlaceId}/photo`
    : 'https://smartplace.naver.com/';

  const handleConfirm = async () => {
    setLoading(true);
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    try {
      await fetch(`${BACKEND}/api/report/ai-tab-checklist-confirm/${bizId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ item: '__photo_sufficient', completed: true }),
      });
    } catch {
      // no-op — optimistic update proceeds
    } finally {
      setConfirmed(true);
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 gap-2">
        <span className="text-sm text-gray-800">✅ 사진 10장 이상 확인됨</span>
        <span className="text-sm px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap bg-emerald-100 text-emerald-700">
          {effect}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <a
        href={photoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 gap-2 hover:bg-amber-100 transition-colors"
      >
        <span className="text-sm text-amber-800">📸 사진 탭 직접 확인 →</span>
        <span className="text-sm px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap bg-amber-100 text-amber-700">
          {effect}
        </span>
      </a>
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="w-full text-sm text-center py-1.5 rounded-lg border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-50"
      >
        {loading ? '저장 중...' : '✅ 10장 이상 있어요'}
      </button>
    </div>
  );
}
