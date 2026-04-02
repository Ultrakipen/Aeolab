"use client";

import { useState } from "react";
import { ContactModal } from "./ContactModal";

export function BizContactButton({ cta }: { cta: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block w-full text-center py-3 rounded-xl font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {cta}
      </button>
      <ContactModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
