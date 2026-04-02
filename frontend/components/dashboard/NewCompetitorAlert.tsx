'use client'

import { useState, useEffect } from 'react'
import { X, Store, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  payload: { new_places?: string[] }
  created_at: string
}

interface Props {
  businessId: string
}

export function NewCompetitorAlert({ businessId }: Props) {
  const [alerts, setAlerts] = useState<Notification[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 읽지 않은 신규 경쟁사 알림 (최근 7일)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('notifications')
        .select('id, payload, created_at')
        .eq('business_id', businessId)
        .eq('type', 'new_competitor')
        .gte('sent_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(3)

      if (data) setAlerts(data as Notification[])
      setLoading(false)
    }
    load()
  }, [businessId])

  if (loading) return null  // 로딩 중에는 레이아웃 shift 없이 숨김

  const visible = alerts.filter((a) => !dismissed.has(a.id))
  if (!visible.length) return null

  return (
    <div className="space-y-2 mb-4">
      {visible.map((alert) => {
        const places = alert.payload?.new_places ?? []
        return (
          <div
            key={alert.id}
            className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
          >
            <Store className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-900 font-medium">
                {places.length > 0
                  ? `새 경쟁 가게 발견: ${places.slice(0, 2).join(', ')}${places.length > 2 ? ` 외 ${places.length - 2}곳` : ''}`
                  : '이번 주 근처에 새 경쟁 가게가 등장했습니다'}
              </p>
              <a
                href="/competitors"
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 mt-0.5 font-medium"
              >
                경쟁사로 등록하기 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
              className="text-amber-400 hover:text-amber-600 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
