'use client'

import { PondLog } from '@/lib/types'
import { formatNumber } from '@/lib/calculations'
import { format } from 'date-fns'
import { Droplets, Edit2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LogsTab({ logs, cycleId, pondId, onRefresh }: {
  logs: PondLog[]
  cycleId?: string
  pondId: string
  onRefresh: () => void
}) {
  const router = useRouter()

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-12">
        <Droplets size={32} className="text-ap-muted mb-3" />
        <p className="text-ap-muted text-sm">No logs yet.</p>
        <p className="text-ap-muted text-xs">Tap + Log Today to add your first entry.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 pb-4">
      {logs.map(log => {
        const logDate = new Date(log.observed_at)
        const isEditable = new Date().getTime() - logDate.getTime() < 24 * 60 * 60 * 1000

        return (
          <div key={log.id} className="ap-card">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-ap-text">
                  {format(logDate, 'dd MMM yyyy')}
                </p>
                <p className="text-xs text-ap-muted">{format(logDate, 'h:mm a')}</p>
              </div>
              <div className="flex items-center gap-2">
                {log.param_source === 'iot' && (
                  <span className="text-[9px] bg-ap-blue-light text-ap-blue px-1.5 py-0.5 rounded font-semibold">IoT</span>
                )}
                {isEditable && (
                  <button
                    onClick={() => router.push(`/ponds/${pondId}/log?edit=${log.id}`)}
                    className="p-1 text-ap-muted hover:text-ap-blue"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
              {log.do_mgl != null && <MiniStat label="DO" value={`${formatNumber(log.do_mgl)}`} unit="mg/L" />}
              {log.ph != null && <MiniStat label="pH" value={`${formatNumber(log.ph)}`} />}
              {log.temp_c != null && <MiniStat label="Temp" value={`${formatNumber(log.temp_c)}`} unit="°C" />}
              {log.ammonia_mgl != null && <MiniStat label="NH₃" value={`${formatNumber(log.ammonia_mgl, 2)}`} unit="mg/L" />}
              {log.salinity_ppt != null && <MiniStat label="Sal" value={`${formatNumber(log.salinity_ppt)}`} unit="ppt" />}
              {log.calcium_mgl != null && <MiniStat label="Ca" value={`${formatNumber(log.calcium_mgl, 0)}`} unit="mg/L" />}
              {log.magnesium_mgl != null && <MiniStat label="Mg" value={`${formatNumber(log.magnesium_mgl, 0)}`} unit="mg/L" />}
              {log.potassium_mgl != null && <MiniStat label="K" value={`${formatNumber(log.potassium_mgl)}`} unit="mg/L" />}
            </div>

            {(log.feed_qty_kg || log.abw_g || log.mortality_count || log.treatment) && (
              <div className="border-t border-ap-border mt-2 pt-2 grid grid-cols-4 gap-x-3 gap-y-1">
                {log.feed_qty_kg != null && <MiniStat label="Feed" value={`${formatNumber(log.feed_qty_kg, 0)}`} unit="kg" />}
                {log.abw_g != null && <MiniStat label="ABW" value={`${formatNumber(log.abw_g)}`} unit="g" />}
                {log.biomass_kg != null && <MiniStat label="Biomass" value={`${formatNumber(log.biomass_kg, 0)}`} unit="kg" />}
                {log.mortality_count != null && log.mortality_count > 0 && (
                  <MiniStat label="Mort." value={`${log.mortality_count}`} color="text-ap-red" />
                )}
              </div>
            )}

            {log.treatment && (
              <p className="text-xs text-ap-muted mt-1.5">💊 {log.treatment}</p>
            )}
            {log.notes && (
              <p className="text-xs text-ap-muted mt-1 italic">{log.notes}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MiniStat({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color?: string
}) {
  return (
    <div>
      <p className="text-[9px] text-ap-muted">{label}</p>
      <p className={`text-xs font-semibold ${color || 'text-ap-text'}`}>
        {value}{unit ? <span className="font-normal text-ap-muted"> {unit}</span> : null}
      </p>
    </div>
  )
}
