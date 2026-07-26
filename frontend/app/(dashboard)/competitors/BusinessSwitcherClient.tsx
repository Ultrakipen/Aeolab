'use client'

import { useRouter } from 'next/navigation'
import { Store } from 'lucide-react'
import { syncActiveBusinessCookie } from '@/lib/active-business-client'

interface Business {
  id: string
  name: string
}

interface Props {
  businesses: Business[]
  currentBizId: string
}

export function BusinessSwitcherClient({ businesses, currentBizId }: Props) {
  const router = useRouter()

  const handleSwitch = (bizId: string) => {
    if (bizId === currentBizId) return
    syncActiveBusinessCookie(bizId)
    router.push(`?biz_id=${bizId}`, { scroll: false })
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2 md:mt-4 pt-4 md:pt-6 border-t border-gray-200 mb-8 md:mb-10">
      {businesses.map(b => (
        <button
          key={b.id}
          onClick={() => handleSwitch(b.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border ${
            b.id === currentBizId
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          {b.name}
        </button>
      ))}
    </div>
  )
}
