"use client";

import { useEffect, useRef } from "react";
import { trackCalculatorUsed } from "@/lib/analytics";

/** 유효한 결과가 처음 나왔을 때 한 번만 사용 이벤트를 보낸다(입력값은 보내지 않음). */
export function useCalcUsage(tool: string, produced: boolean): void {
  const sent = useRef(false);
  useEffect(() => {
    if (produced && !sent.current) {
      sent.current = true;
      trackCalculatorUsed(tool);
    }
  }, [tool, produced]);
}
