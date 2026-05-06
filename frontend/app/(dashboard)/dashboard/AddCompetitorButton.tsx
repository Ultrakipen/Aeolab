"use client";

import { useState } from "react";
import { addCompetitor } from "@/lib/api";

interface Props {
  bizId: string;
  userId: string;
  authToken: string;
  competitorName: string;
  alreadyAdded: boolean;
}

export default function AddCompetitorButton({
  bizId,
  userId,
  authToken,
  competitorName,
  alreadyAdded,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    alreadyAdded ? "done" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string>("");

  if (status === "done") {
    return (
      <span
        className="text-xs font-semibold text-emerald-600 shrink-0"
        title="이미 경쟁사로 등록됨"
      >
        ✓ 등록됨
      </span>
    );
  }

  const handleClick = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await addCompetitor(
        {
          business_id: bizId,
          name: competitorName,
        },
        userId,
        authToken
      );
      setStatus("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "추가 실패";
      setErrorMsg(message);
      setStatus("error");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "loading"}
      className="text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2 py-1 rounded-md transition-colors shrink-0 disabled:opacity-50"
      title={status === "error" ? errorMsg : "이 사업장을 경쟁사로 추가"}
    >
      {status === "loading" ? "추가 중…" : status === "error" ? "재시도" : "+ 경쟁사 추가"}
    </button>
  );
}
