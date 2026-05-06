'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  basic: 1,
  startup: 1.5,
  pro: 2,
  biz: 3,
}

const PLAN_PRICE: Record<string, string> = {
  basic: '월 9,900원',
  startup: '월 12,900원',
  pro: '월 18,900원',
  biz: '월 49,900원',
}

// 기능별 구체적 손실 표현 메시지 매핑
// feature prop이 이 키와 일치하면 맞춤 문구 사용, 아니면 feature 그대로 표시
const FEATURE_LOSS_MESSAGES: Record<string, string> = {
  // Pro 기능
  'condition_search':       '경쟁사 전체 키워드 비교는 Pro에서 확인할 수 있습니다',
  'competitor_keyword':     '경쟁사 전체 키워드 비교는 Pro에서 확인할 수 있습니다',
  'pdf_report':             'PDF 리포트 다운로드는 Pro에서 이용 가능합니다',
  'csv_export':             'CSV 내보내기는 Basic 이상에서 이용 가능합니다',
  // Biz 기능
  'team_members':           '팀원 초대 및 다중 사업장 관리는 Biz에서 가능합니다',
  'multi_biz':              '팀원 초대 및 다중 사업장 관리는 Biz에서 가능합니다',
  'api_keys':               'Public API 키 발급은 Biz 플랜 전용 기능입니다',
}

interface PlanGateProps {
  requiredPlan: 'basic' | 'startup' | 'pro' | 'biz'
  currentPlan: string
  feature: string
  children: React.ReactNode
}

export function PlanGate({ requiredPlan, currentPlan, feature, children }: PlanGateProps) {
  const router = useRouter()
  const hasAccess = (PLAN_HIERARCHY[currentPlan] ?? 0) >= PLAN_HIERARCHY[requiredPlan]

  if (hasAccess) return <>{children}</>

  // 기능별 맞춤 손실 문구 우선, 없으면 feature prop 그대로
  const lossMessage = FEATURE_LOSS_MESSAGES[feature] ?? null

  // 일반 설명 문구 — 맞춤 문구가 있으면 생략
  const genericDesc = lossMessage
    ? null
    : `${PLAN_PRICE[requiredPlan]} ${requiredPlan === 'pro' ? 'Pro' : requiredPlan === 'biz' ? 'Biz' : requiredPlan === 'startup' ? '창업패키지' : 'Basic'} 플랜부터 이용 가능합니다`

  return (
    <div className="relative">
      {/* 블러 처리된 미리보기 */}
      <div className="blur-sm pointer-events-none select-none">{children}</div>

      {/* 업그레이드 오버레이 */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
        <div className="text-center p-6">
          <Lock className="w-6 h-6 text-gray-400 mx-auto mb-2" strokeWidth={1.5} />
          <p className="font-bold text-gray-800 mb-1">
            {lossMessage ?? feature}
          </p>
          {genericDesc && (
            <p className="text-base text-gray-500 mb-4">{genericDesc}</p>
          )}
          {!genericDesc && (
            <p className="text-base text-gray-500 mb-4">{PLAN_PRICE[requiredPlan]}</p>
          )}
          <Button
            onClick={() => router.push('/pricing')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {requiredPlan === 'basic'
              ? 'Basic 플랜 시작하기 →'
              : requiredPlan === 'startup'
              ? '창업패키지 시작하기 →'
              : requiredPlan === 'pro'
              ? 'Pro 플랜으로 업그레이드 →'
              : 'Biz 플랜으로 업그레이드 →'}
          </Button>
        </div>
      </div>
    </div>
  )
}
