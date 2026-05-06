"use client";

import { useState } from "react";
import { ScanTrigger } from "./ScanTrigger";
import PostScanModal from "@/components/dashboard/PostScanModal";

interface ScanWithModalProps {
  businessId: string;
  businessName: string;
  category: string;
  region: string;
  keywords?: string[];
  scanUsed?: number;
  scanLimit?: number;
  plan?: string;
  lastQueryUsed?: string;
}

export default function ScanWithModal({
  businessId,
  businessName,
  category,
  region,
  keywords,
  scanUsed,
  scanLimit,
  plan,
  lastQueryUsed,
}: ScanWithModalProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [topMissingKeyword, setTopMissingKeyword] = useState<string | null>(null);
  const [faqCopyText, setFaqCopyText] = useState<string | null>(null);

  const handleScanComplete = (data: { topMissingKeyword?: string; faqCopyText?: string }) => {
    setTopMissingKeyword(data.topMissingKeyword ?? null);
    setFaqCopyText(data.faqCopyText ?? null);
    setModalOpen(true);
  };

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
        lastQueryUsed={lastQueryUsed}
        onScanComplete={handleScanComplete}
      />
      <PostScanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        topMissingKeyword={topMissingKeyword}
        faqCopyText={faqCopyText}
        businessName={businessName}
      />
    </>
  );
}
