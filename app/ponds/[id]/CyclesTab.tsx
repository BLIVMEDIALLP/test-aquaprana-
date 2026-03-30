'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { CropCycle } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { ChevronRight, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CyclesTab({ pondId, activeCycleId }: {
  pondId: string
  activeCycleId?: string
}) {
  const router = useRouter()
  const [cycles, setCycles] = useState<CropCycle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const isDemo = sessionStorage.getItem('ap_demo')
      if (isDemo) {
        const ponds = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
        const pond = ponds.find((p: { id: string }) => p.id === pondId)
        if (pond?.active_cycle) setCycles([pond.active_cycle])
        setLoading(false)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from('crop_cycles')
        .select('*')
        .eq('pond_id', pondId)
        .order('created_at', { ascending: false })
      setCycles(data || [])
      setLoading(false)
    }
    load()
  }, [pondId])

  if (loading) return <div className="py-8 text-center text-ap-muted text-sm">Loading...</div>
  if (cycles.length === 0) return <div className="py-8 text-center text-ap-muted text-sm">No cycles yet</div>

  return (
    <div className="space-y-2 pb-4">
      {cycles.map(cycle => {
        const isActive = cycle.status === 'active'
        return (
          <div key={cycle.id} className="ap-card">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ap-text text-sm">{cycle.species}</span>
                  <span className={isActive ? 'pill-green' : 'pill-gray'}>
                    {isActive ? 'Active' : 'Closed'}
                  </span>
                </div>
                <p className="text-xs text-ap-muted mt-0.5">
                  Stocked: {format(parseISO(cycle.stocking_date), 'dd MMM yyyy')}
                  {cycle.closed_at && ` · Closed: ${format(parseISO(cycle.closed_at), 'dd MMM yyyy')}`}
                </p>
              </div>
              {!isActive && (
                <button
                  onClick={() => router.push(`/ponds/${pondId}/report?cycle=${cycle.id}`)}
                  className="flex items-center gap-1 text-ap-blue text-xs font-medium px-2 py-1 bg-ap-blue-light rounded-lg"
                >
                  <FileText size={12} /> Report
                </button>
              )}
            </div>
            {!isActive && (
              <div className="flex gap-4 mt-2 pt-2 border-t border-ap-border">
                {cycle.fcr && <SmallStat label="FCR" value={cycle.fcr.toFixed(2)} />}
                {cycle.survival_rate && <SmallStat label="Survival" value={`${cycle.survival_rate.toFixed(0)}%`} />}
                {cycle.harvest_weight_kg && <SmallStat label="Harvest" value={`${cycle.harvest_weight_kg} kg`} />}
                {cycle.outcome && <SmallStat label="Outcome" value={cycle.outcome} color={cycle.outcome === 'Successful' ? 'text-ap-green' : 'text-ap-red'} />}
              </div>
            )}
            {isActive && (
              <p className="text-xs text-ap-muted mt-1">Report available on cycle close</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SmallStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[9px] text-ap-muted">{label}</p>
      <p className={`text-xs font-semibold ${color || 'text-ap-text'}`}>{value}</p>
    </div>
  )
}
