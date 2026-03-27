'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  biz: 3,
}

const PLAN_PRICE: Record<string, string> = {
  basic: '월 9,900원',
  pro: '월 29,900원',
  biz: '월 79,900원',
}

interface PlanGateProps {
  requiredPlan: 'basic' | 'pro' | 'biz'
  currentPlan: string
  feature: string
  children: React.ReactNode
}

export function PlanGate({ requiredPlan, currentPlan, feature, children }: PlanGateProps) {
  const router = useRouter()
  const hasAccess = (PLAN_HIERARCHY[currentPlan] ?? 0) >= PLAN_HIERARCHY[requiredPlan]

  if (hasAccess) return <>{children}</>

  return (
    <div className="relative">
      {/* 블러 처리된 미리보기 */}
      <div className="blur-sm pointer-events-none select-none">{children}</div>

      {/* 업그레이드 오버레이 */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
        <div className="text-center p-6">
          <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" strokeWidth={1.5} />
          <p className="font-bold text-gray-800 mb-1">{feature}</p>
          <p className="text-sm text-gray-500 mb-4">
            {PLAN_PRICE[requiredPlan]} {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} 플랜부터 이용 가능합니다
          </p>
          <Button
            onClick={() => router.push('/pricing')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            업그레이드하기 →
          </Button>
        </div>
      </div>
    </div>
  )
}
