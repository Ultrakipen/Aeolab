"use client";

import { useState, useCallback } from "react";
import { ScanTrigger, ScanCompleteResult } from "./ScanTrigger";
import PostScanModal from "@/components/dashboard/PostScanModal";

interface Props {
  businessId: string;
  businessName: string;
  category: string;
  region: string;
  keywords?: string[];
  scanUsed?: number;
  scanLimit?: number;
  plan?: string;
  topMissingKeyword: string | null;
  faqCopyText: string | null;
}

export default function DashboardScanWrapper({
  businessId,
  businessName,
  category,
  region,
  keywords,
  scanUsed,
  scanLimit,
  plan,
  topMissingKeyword,
  faqCopyText,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleScanComplete = useCallback((_result: ScanCompleteResult) => {
    // 스캔 완료 시 모달 오픈 (Props로 받은 topMissingKeyword/faqCopyText 사용)
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <>
      <ScanTrigger
        businessId={businessId}
        businessName={businessName}
        category={category}
        region={region}
        keywords={keywords}
        scanUsed={scanUsed}
        scanLimit={scanLimit}
        plan={plan}
        onScanComplete={handleScanComplete}
      />
      <PostScanModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        topMissingKeyword={topMissingKeyword}
        faqCopyText={faqCopyText}
        businessName={businessName}
      />
    </>
  );
}
