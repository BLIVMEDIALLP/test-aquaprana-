'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  getCycleDay, getHarvestDisplay, getWQStatus, calcSurvivalRate,
  calcBiomass, calcFCR, formatNumber, WQStatus
} from '@/lib/calculations'
import { Pond, CropCycle, PondLog } from '@/lib/types'
import { Plus, ArrowLeft, AlertTriangle, Clock, CheckCircle2, Wifi, WifiOff } from 'lucide-react'
import { formatDistanceToNow, format, parseISO, isAfter } from 'date-fns'
import LogsTab from './LogsTab'
import TrendsTab from './TrendsTab'
import CyclesTab from './CyclesTab'

type Tab = 'logs' | 'trends' | 'cycles'

interface DashboardData {
  pond: Pond
  cycle: CropCycle | null
  latestLog: PondLog | null
  allLogs: PondLog[]
  cumulativeMortality: number
  cumulativeFeed: number
}

export default function PondDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const pondId = params.id as string

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('logs')

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const isDemo = sessionStorage.getItem('ap_demo')

    if (isDemo) {
      const ponds = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
      const pond = ponds.find((p: Pond) => p.id === pondId)
      if (!pond) { router.replace('/home'); return }
      const demoLogs: PondLog[] = JSON.parse(sessionStorage.getItem(`ap_logs_${pondId}`) || '[]')
      setData({
        pond,
        cycle: pond.active_cycle || null,
        latestLog: demoLogs[0] || null,
        allLogs: demoLogs,
        cumulativeMortality: demoLogs.reduce((s: number, l: PondLog) => s + (l.mortality_count || 0), 0),
        cumulativeFeed: demoLogs.reduce((s: number, l: PondLog) => s + (l.feed_qty_kg || 0), 0),
      })
      setLoading(false)
      return
    }

    const { data: pond } = await supabase.from('ponds').select('*').eq('id', pondId).single()
    if (!pond) { router.replace('/home'); return }

    const { data: cycle } = await supabase.from('crop_cycles')
      .select('*').eq('pond_id', pondId).eq('status', 'active').single()

    let allLogs: PondLog[] = []
    let latestLog: PondLog | null = null

    if (cycle) {
      const { data: logs } = await supabase.from('pond_logs')
        .select('*').eq('cycle_id', cycle.id).order('observed_at', { ascending: false })
      allLogs = logs || []
      latestLog = allLogs[0] || null
    }

    setData({
      pond,
      cycle: cycle || null,
      latestLog,
      allLogs,
      cumulativeMortality: allLogs.reduce((s, l) => s + (l.mortality_count || 0), 0),
      cumulativeFeed: allLogs.reduce((s, l) => s + (l.feed_qty_kg || 0), 0),
    })
    setLoading(false)
  }, [pondId, router])

  useEffect(() => { loadData() }, [loadData])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <span className="w-8 h-8 border-2 border-ap-blue/20 border-t-ap-blue rounded-full animate-spin" />
      </div>
    )
  }

  const { pond, cycle, latestLog, allLogs, cumulativeMortality, cumulativeFeed } = data
  const cycleDay = cycle ? getCycleDay(cycle.stocking_date) : null
  const harvestText = cycle ? getHarvestDisplay(cycle.harvest_window_start, cycle.harvest_window_end) : null
  const isPastWindow = cycle?.harvest_window_end ? isAfter(new Date(), parseISO(cycle.harvest_window_end)) : false

  const stockingCount = cycle && pond.area_acres
    ? Math.round(cycle.stocking_density * pond.area_acres * 4047) : 0
  const survivalRate = stockingCount > 0 ? calcSurvivalRate(stockingCount, cumulativeMortality) : null
  const biomass = latestLog?.abw_g && survivalRate !== null
    ? calcBiomass(stockingCount, latestLog.abw_g, survivalRate) : latestLog?.biomass_kg
  const fcr = cumulativeFeed > 0 && biomass ? calcFCR(cumulativeFeed, biomass) : null

  const lastLogTime = latestLog
    ? formatDistanceToNow(new Date(latestLog.observed_at), { addSuffix: true }) : null
  const hasLogToday = latestLog && new Date(latestLog.observed_at).toDateString() === new Date().toDateString()
  const logData24hStale = latestLog
    ? new Date().getTime() - new Date(latestLog.observed_at).getTime() > 24 * 60 * 60 * 1000 : true

  return (
    <div className="flex flex-col min-h-screen bg-ap-gray">
      {/* Zone 1: Identity strip */}
      <div className="bg-ap-blue px-5 pt-12 pb-4 sticky top-0 z-10">
        <button onClick={() => router.push('/home')} className="text-white/70 text-sm flex items-center gap-1 mb-3">
          <ArrowLeft size={15} /> My Ponds
        </button>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white leading-tight">{pond.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {cycle && <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{cycle.species}</span>}
              {cycleDay && <span className="text-white/80 text-xs">Day {cycleDay}</span>}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cycle ? 'bg-ap-green text-white' : 'bg-white/20 text-white/60'}`}>
                {cycle ? 'Active' : 'No Cycle'}
              </span>
            </div>
          </div>
        </div>
        {cycle && (
          <div className="mt-2">
            <p className={`text-xs font-medium ${isPastWindow ? 'text-red-300' : 'text-white/80'}`}>
              {harvestText}
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {/* Zone 2: Water quality tiles */}
        {cycle && (
          <div className="px-4 pt-4">
            <div className="ap-card">
              <p className="ap-section-title">Water Quality</p>
              <div className="grid grid-cols-4 gap-2">
                {WQ_PARAMS.map(p => (
                  <WQTile
                    key={p.key}
                    param={p}
                    value={latestLog ? (latestLog as unknown as Record<string, number>)[p.key] : undefined}
                    isStale={logData24hStale}
                    onClick={() => setActiveTab('trends')}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Zone 3: Biomass & growth */}
        {cycle && (
          <div className="px-4 pt-3">
            <div className="ap-card">
              <p className="ap-section-title">Biomass & Growth</p>
              <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                <MetricCell
                  label="ABW"
                  value={latestLog?.abw_g ? `${formatNumber(latestLog.abw_g)}g` : '—'}
                  sub={latestLog?.abw_g ? undefined : 'Update needed'}
                  stale={!latestLog?.abw_g}
                />
                <MetricCell
                  label="Biomass"
                  value={biomass ? `${formatNumber(biomass, 0)} kg` : '—'}
                  stale={!biomass}
                />
                <MetricCell
                  label="Survival"
                  value={survivalRate !== null ? `${survivalRate.toFixed(1)}%` : '—'}
                  color={survivalRate !== null ? (survivalRate < 70 ? 'text-ap-red' : survivalRate < 85 ? 'text-ap-amber' : 'text-ap-green') : undefined}
                />
                <MetricCell
                  label="FCR"
                  value={fcr ? formatNumber(fcr, 2) : '—'}
                  color={fcr ? (fcr <= 1.4 ? 'text-ap-green' : fcr <= 1.8 ? 'text-ap-amber' : 'text-ap-red') : undefined}
                  sub={fcr ? (fcr <= 1.4 ? 'Good' : fcr <= 1.8 ? 'Monitor' : 'High') : undefined}
                />
                <MetricCell
                  label="Feed total"
                  value={cumulativeFeed > 0 ? `${formatNumber(cumulativeFeed, 0)} kg` : '—'}
                />
                <MetricCell
                  label="Mortality"
                  value={`${cumulativeMortality.toLocaleString()}`}
                  color={stockingCount > 0 && cumulativeMortality / stockingCount > 0.005 ? 'text-ap-red' : undefined}
                />
              </div>
            </div>
          </div>
        )}

        {/* Zone 4: Last log indicator */}
        <div className="px-4 pt-3">
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${hasLogToday ? 'bg-ap-green-light' : 'bg-ap-amber-light'}`}>
            <div className="flex items-center gap-2">
              {hasLogToday
                ? <CheckCircle2 size={16} className="text-ap-green" />
                : <Clock size={16} className="text-ap-amber" />}
              <span className={`text-sm font-medium ${hasLogToday ? 'text-ap-green' : 'text-ap-amber'}`}>
                {lastLogTime ? `Last log: ${lastLogTime}` : 'No log today'}
              </span>
            </div>
            {!cycle && <span className="text-xs text-ap-muted">No active cycle</span>}
          </div>
        </div>

        {/* Zone 5: Tab bar */}
        <div className="px-4 pt-4">
          <div className="flex bg-ap-gray rounded-xl p-1 gap-1">
            {(['logs', 'trends', 'cycles'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  activeTab === tab ? 'bg-white text-ap-blue shadow-card' : 'text-ap-muted'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {activeTab === 'logs' && <LogsTab logs={allLogs} cycleId={cycle?.id} pondId={pondId} onRefresh={loadData} />}
            {activeTab === 'trends' && <TrendsTab logs={allLogs} />}
            {activeTab === 'cycles' && <CyclesTab pondId={pondId} activeCycleId={cycle?.id} />}
          </div>
        </div>
      </div>

      {/* FAB: Log Today */}
      {cycle && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => router.push(`/ponds/${pondId}/log`)}
            className="flex items-center gap-2 bg-ap-blue text-white font-bold px-6 py-4 rounded-full shadow-lg active:bg-ap-blue-dark transition-colors"
          >
            <Plus size={20} /> Log Today
          </button>
        </div>
      )}
    </div>
  )
}

const WQ_PARAMS = [
  { key: 'do_mgl', label: 'DO', unit: 'mg/L' },
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'ammonia_mgl', label: 'NH₃', unit: 'mg/L' },
  { key: 'temp_c', label: 'Temp', unit: '°C' },
  { key: 'salinity_ppt', label: 'Sal', unit: 'ppt' },
  { key: 'calcium_mgl', label: 'Ca', unit: 'mg/L' },
  { key: 'magnesium_mgl', label: 'Mg', unit: 'mg/L' },
  { key: 'potassium_mgl', label: 'K', unit: 'mg/L' },
]

function WQTile({ param, value, isStale, onClick }: {
  param: typeof WQ_PARAMS[0]
  value: number | undefined
  isStale: boolean
  onClick: () => void
}) {
  const status: WQStatus = value !== undefined ? getWQStatus(param.key, value) : 'gray'
  const bgClass = {
    green: 'bg-ap-green-light',
    blue: 'bg-ap-blue-light',
    red: 'bg-ap-red-light',
    gray: 'bg-ap-gray',
  }[status]
  const valClass = {
    green: 'text-ap-green',
    blue: 'text-ap-blue',
    red: 'text-ap-red',
    gray: 'text-ap-muted',
  }[status]
  const dotClass = {
    green: 'bg-ap-green',
    blue: 'bg-ap-blue',
    red: 'bg-ap-red',
    gray: 'bg-ap-muted/40',
  }[status]

  return (
    <button onClick={onClick} className={`${bgClass} rounded-xl p-2 relative text-left ${isStale && value !== undefined ? 'border border-dashed border-ap-muted/40' : ''}`}>
      <div className="flex justify-between items-start">
        <span className="text-[9px] text-ap-muted font-medium">{param.label}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      </div>
      <p className={`text-sm font-bold mt-0.5 ${valClass}`}>
        {value !== undefined ? formatNumber(value) : '—'}
      </p>
      <p className="text-[9px] text-ap-muted">{param.unit || '\u00A0'}</p>
    </button>
  )
}

function MetricCell({ label, value, sub, color, stale }: {
  label: string; value: string; sub?: string; color?: string; stale?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-ap-muted">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${stale ? 'text-ap-muted' : color || 'text-ap-text'}`}>{value}</p>
      {sub && <p className="text-[10px] text-ap-muted">{sub}</p>}
    </div>
  )
}
