'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface Props {
  text: string
}

export function CopyActionButton({ text }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API 미지원 환경 fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 bg-white border-2 border-green-400 text-green-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" /> 복사됨!
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" /> 할 일 복사
        </>
      )}
    </button>
  )
}
