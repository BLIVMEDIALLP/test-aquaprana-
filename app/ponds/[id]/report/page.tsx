'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CropCycle, PondLog, Pond } from '@/lib/types'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ArrowLeft, Share2, Download } from 'lucide-react'

export default function CycleReportPage() {
  const router = useRouter()
  const params = useParams()
  const pondId = params.id as string

  const [pond, setPond] = useState<Pond | null>(null)
  const [cycle, setCycle] = useState<CropCycle | null>(null)
  const [logs, setLogs] = useState<PondLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const isDemo = sessionStorage.getItem('ap_demo')
      if (isDemo) {
        const ponds = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
        const p = ponds.find((x: Pond) => x.id === pondId)
        setPond(p || null)
        setCycle(p?.active_cycle || null)
        const demoLogs: PondLog[] = JSON.parse(sessionStorage.getItem(`ap_logs_${pondId}`) || '[]')
        setLogs(demoLogs)
        setLoading(false)
        return
      }
      const supabase = createClient()
      const { data: p } = await supabase.from('ponds').select('*').eq('id', pondId).single()
      setPond(p)
      const { data: c } = await supabase.from('crop_cycles').select('*').eq('pond_id', pondId).order('created_at', { ascending: false }).limit(1).single()
      setCycle(c)
      if (c) {
        const { data: l } = await supabase.from('pond_logs').select('*').eq('cycle_id', c.id).order('observed_at')
        setLogs(l || [])
      }
      setLoading(false)
    }
    load()
  }, [pondId])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><span className="w-8 h-8 border-2 border-ap-blue/20 border-t-ap-blue rounded-full animate-spin" /></div>
  if (!cycle || !pond) return <div className="flex items-center justify-center min-h-screen text-ap-muted">No cycle data found</div>

  const cycleDuration = differenceInDays(
    cycle.closed_at ? parseISO(cycle.closed_at) : new Date(),
    parseISO(cycle.stocking_date)
  )

  const totalFeed = logs.reduce((s, l) => s + (l.feed_qty_kg || 0), 0)
  const totalMort = logs.reduce((s, l) => s + (l.mortality_count || 0), 0)
  const stocked = pond.area_acres ? Math.round(cycle.stocking_density * pond.area_acres * 4047) : 0
  const survival = stocked > 0 ? ((stocked - totalMort) / stocked * 100) : null
  const lastLog = logs[logs.length - 1]
  const biomass = lastLog?.biomass_kg || null
  const fcr = totalFeed > 0 && biomass ? totalFeed / biomass : null

  // WQ summary
  const wqParams = ['do_mgl', 'ph', 'temp_c', 'salinity_ppt', 'ammonia_mgl', 'calcium_mgl', 'magnesium_mgl', 'potassium_mgl']
  const wqSummary = wqParams.map(p => {
    const vals = logs.map(l => (l as unknown as Record<string, number>)[p]).filter(v => v != null)
    if (vals.length === 0) return null
    return {
      param: p,
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      count: vals.length,
    }
  }).filter(Boolean)

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.share) {
      navigator.share({ title: `Cycle Report - ${pond.name}`, text: `Cycle Report for ${pond.name} (${cycle.species})`, url: window.location.href })
    } else {
      window.print()
    }
  }

  const PARAM_LABELS: Record<string, string> = {
    do_mgl: 'DO (mg/L)', ph: 'pH', temp_c: 'Temp (°C)', salinity_ppt: 'Salinity (ppt)',
    ammonia_mgl: 'Ammonia (mg/L)', calcium_mgl: 'Calcium (mg/L)', magnesium_mgl: 'Magnesium (mg/L)', potassium_mgl: 'Potassium (mg/L)'
  }

  return (
    <div className="flex flex-col min-h-screen bg-ap-gray">
      {/* Header */}
      <div className="bg-ap-blue px-5 pt-12 pb-5 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-white/80 flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-base font-bold text-white">Cycle Report</h1>
          <button onClick={handleShare} className="text-white/80 flex items-center gap-1 text-sm">
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 pb-8">
        {/* Report header */}
        <div className="ap-card text-center">
          <div className="w-10 h-10 bg-ap-blue rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C12 2 6 9 6 14C6 17.3 8.7 20 12 20C15.3 20 18 17.3 18 14C18 9 12 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <h2 className="text-base font-bold text-ap-text">AquaPrana</h2>
          <p className="text-ap-muted text-xs">Cycle Report</p>
          <p className="text-sm font-semibold text-ap-text mt-2">{pond.name}</p>
          <p className="text-xs text-ap-muted">Generated {format(new Date(), 'dd MMM yyyy')}</p>
        </div>

        {/* 1. Cycle summary */}
        <ReportSection title="1. CYCLE SUMMARY">
          <ReportRow label="Species" value={cycle.species} />
          <ReportRow label="Duration" value={`${cycleDuration} days`} />
          <ReportRow label="Stocked" value={format(parseISO(cycle.stocking_date), 'dd MMM yyyy')} />
          <ReportRow label="Closed" value={cycle.closed_at ? format(parseISO(cycle.closed_at), 'dd MMM yyyy') : 'Active'} />
          <ReportRow label="Outcome" value={cycle.outcome || 'Active'} valueColor={cycle.outcome === 'Successful' ? 'text-ap-green' : cycle.outcome === 'Failed' ? 'text-ap-red' : undefined} />
          {cycle.failure_reason && <ReportRow label="Failure reason" value={cycle.failure_reason} />}
        </ReportSection>

        {/* 2. Production outcomes */}
        <ReportSection title="2. PRODUCTION OUTCOMES">
          <div className="grid grid-cols-2 gap-4">
            <MetricBox label="Harvest" value={cycle.harvest_weight_kg ? `${cycle.harvest_weight_kg} kg` : biomass ? `~${biomass.toFixed(0)} kg` : '—'} />
            <MetricBox label="FCR" value={fcr ? fcr.toFixed(2) : '—'} sub={fcr ? (fcr <= 1.4 ? 'Target: ≤1.4 ✓' : 'Target: ≤1.4') : undefined} subColor={fcr && fcr <= 1.4 ? 'text-ap-green' : 'text-ap-amber'} />
            <MetricBox label="Survival" value={survival ? `${survival.toFixed(1)}%` : '—'} />
            <MetricBox label="Final ABW" value={lastLog?.abw_g ? `${lastLog.abw_g}g` : '—'} />
            <MetricBox label="Stocking" value={stocked > 0 ? stocked.toLocaleString() : '—'} />
            <MetricBox label="Total Feed" value={`${totalFeed.toFixed(0)} kg`} />
          </div>
        </ReportSection>

        {/* 3. Water quality summary */}
        <ReportSection title="3. WATER QUALITY SUMMARY">
          {wqSummary.length === 0 ? (
            <p className="text-ap-muted text-sm">No water quality data recorded</p>
          ) : (
            <div className="space-y-2">
              {wqSummary.map(w => w && (
                <div key={w.param} className="flex items-center justify-between py-1 border-b border-ap-border last:border-0">
                  <span className="text-sm text-ap-text">{PARAM_LABELS[w.param] || w.param}</span>
                  <span className="text-xs text-ap-muted">
                    avg {w.avg.toFixed(2)} · min {w.min.toFixed(2)} · max {w.max.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        {/* 5. Full log table (summary) */}
        <ReportSection title="4. LOG SUMMARY">
          <p className="text-xs text-ap-muted mb-2">{logs.length} total log entries</p>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {logs.slice(0, 20).map(log => (
              <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-ap-border last:border-0">
                <span className="text-ap-muted">{format(parseISO(log.observed_at), 'dd MMM HH:mm')}</span>
                <span className="text-ap-text">
                  {log.do_mgl != null && `DO: ${log.do_mgl} `}
                  {log.ph != null && `pH: ${log.ph} `}
                  {log.feed_qty_kg != null && `Feed: ${log.feed_qty_kg}kg`}
                </span>
              </div>
            ))}
          </div>
        </ReportSection>

        <p className="text-[10px] text-ap-muted text-center px-4">
          This report was auto-generated from farmer-logged data in AquaPrana. Log entries are locked after 24 hours and cannot be altered after cycle close.
        </p>
      </div>
    </div>
  )
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ap-card">
      <p className="ap-section-title">{title}</p>
      {children}
    </div>
  )
}

function ReportRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-ap-border last:border-0">
      <span className="text-sm text-ap-muted">{label}</span>
      <span className={`text-sm font-semibold ${valueColor || 'text-ap-text'}`}>{value}</span>
    </div>
  )
}

function MetricBox({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="bg-ap-gray rounded-xl p-3">
      <p className="text-xs text-ap-muted">{label}</p>
      <p className="text-lg font-bold text-ap-text mt-0.5">{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${subColor || 'text-ap-muted'}`}>{sub}</p>}
    </div>
  )
}
