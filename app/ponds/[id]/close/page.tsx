'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { CropCycle, PondLog } from '@/lib/types'
import { format } from 'date-fns'
import { ArrowLeft, FileText, CheckCircle, AlertTriangle } from 'lucide-react'

export default function CloseCyclePage() {
  const router = useRouter()
  const params = useParams()
  const pondId = params.id as string

  const [cycle, setCycle] = useState<CropCycle | null>(null)
  const [outcome, setOutcome] = useState<'Successful' | 'Failed'>('Successful')
  const [harvestWeight, setHarvestWeight] = useState('')
  const [harvestDate, setHarvestDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [failureReason, setFailureReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [summary, setSummary] = useState<{ fcr: number | null; survival: number | null; biomass: number | null }>({ fcr: null, survival: null, biomass: null })

  useEffect(() => {
    loadCycle()
  }, [pondId])

  const loadCycle = async () => {
    const isDemo = sessionStorage.getItem('ap_demo')
    if (isDemo) {
      const ponds = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
      const pond = ponds.find((p: { id: string }) => p.id === pondId)
      setCycle(pond?.active_cycle || null)
      // Calc summary from demo logs
      const logs: PondLog[] = JSON.parse(sessionStorage.getItem(`ap_logs_${pondId}`) || '[]')
      const totalFeed = logs.reduce((s: number, l: PondLog) => s + (l.feed_qty_kg || 0), 0)
      const totalMort = logs.reduce((s: number, l: PondLog) => s + (l.mortality_count || 0), 0)
      const lastLog = logs[0]
      const biomass = lastLog?.biomass_kg || null
      const stocked = pond?.active_cycle ? Math.round(pond.active_cycle.stocking_density * (pond.area_acres || 0) * 4047) : 0
      const survival = stocked > 0 ? ((stocked - totalMort) / stocked * 100) : null
      const fcr = biomass && totalFeed ? totalFeed / biomass : null
      setSummary({ fcr, survival, biomass })
      return
    }
    const supabase = createClient()
    const { data: c } = await supabase.from('crop_cycles').select('*').eq('pond_id', pondId).eq('status', 'active').single()
    setCycle(c || null)
    if (c) {
      const { data: pond } = await supabase.from('ponds').select('*').eq('id', pondId).single()
      const { data: logs } = await supabase.from('pond_logs').select('*').eq('cycle_id', c.id)
      const totalFeed = (logs || []).reduce((s, l) => s + (l.feed_qty_kg || 0), 0)
      const totalMort = (logs || []).reduce((s, l) => s + (l.mortality_count || 0), 0)
      const lastLog = (logs || []).sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime())[0]
      const biomass = lastLog?.biomass_kg || null
      const stocked = pond && pond.area_acres ? Math.round(c.stocking_density * pond.area_acres * 4047) : 0
      const survival = stocked > 0 ? ((stocked - totalMort) / stocked * 100) : null
      const fcr = biomass && totalFeed ? totalFeed / biomass : null
      setSummary({ fcr, survival, biomass })
    }
  }

  const handleClose = async () => {
    if (!cycle) return
    setLoading(true)

    const hw = harvestWeight ? parseFloat(harvestWeight) : null
    const finalFCR = hw && summary.biomass ? summary.fcr : null

    const isDemo = sessionStorage.getItem('ap_demo')
    if (isDemo) {
      const ponds = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
      const idx = ponds.findIndex((p: { id: string }) => p.id === pondId)
      if (idx >= 0) {
        ponds[idx].active_cycle = { ...ponds[idx].active_cycle, status: 'closed', outcome, harvest_weight_kg: hw, actual_harvest_date: harvestDate, fcr: finalFCR, survival_rate: summary.survival, closed_at: new Date().toISOString() }
      }
      sessionStorage.setItem('ap_ponds', JSON.stringify(ponds))
      setDone(true)
      setLoading(false)
      return
    }

    const supabase = createClient()
    await supabase.from('crop_cycles').update({
      status: 'closed',
      outcome,
      harvest_weight_kg: hw,
      actual_harvest_date: harvestDate,
      failure_reason: outcome === 'Failed' ? failureReason : null,
      fcr: finalFCR,
      survival_rate: summary.survival,
      closed_at: new Date().toISOString(),
    }).eq('id', cycle.id)

    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6 gap-5">
        <div className="w-16 h-16 bg-ap-green-light rounded-full flex items-center justify-center">
          <CheckCircle size={32} className="text-ap-green" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-ap-text">Cycle Closed</h2>
          <p className="text-ap-muted text-sm mt-1">{cycle?.species} · {harvestWeight ? `${harvestWeight} kg harvested` : 'No harvest recorded'}</p>
        </div>
        <div className="flex gap-6">
          {summary.biomass && <Stat label="Harvest" value={`${harvestWeight || summary.biomass?.toFixed(0)} kg`} />}
          {summary.fcr && <Stat label="FCR" value={summary.fcr.toFixed(2)} />}
          {summary.survival && <Stat label="Survival" value={`${summary.survival.toFixed(0)}%`} />}
        </div>
        <div className="w-full bg-ap-blue-light rounded-xl p-4 flex items-center gap-3">
          <FileText size={20} className="text-ap-blue" />
          <div>
            <p className="text-sm font-semibold text-ap-text">Cycle Report</p>
            <p className="text-xs text-ap-muted">PDF with full cycle data — share via WhatsApp, email</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => router.push(`/ponds/${pondId}/report`)}
            className="ap-btn-primary"
          >
            Download Cycle Report
          </button>
          <button
            onClick={() => router.push('/ponds/new')}
            className="ap-btn-secondary"
          >
            Start New Cycle
          </button>
          <button
            onClick={() => router.push('/home')}
            className="ap-btn-ghost text-center"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="bg-ap-blue px-5 pt-12 pb-5">
        <button onClick={() => router.back()} className="text-white/80 flex items-center gap-1 text-sm mb-3">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-xl font-bold text-white">Close Cycle</h1>
        {cycle && <p className="text-white/70 text-sm mt-1">{cycle.species}</p>}
      </div>

      <div className="flex-1 px-5 py-6 space-y-5 pb-32">
        {/* Cycle summary */}
        {cycle && (
          <div className="ap-card">
            <p className="ap-section-title">Cycle Summary</p>
            <div className="flex gap-6">
              <Stat label="Species" value={cycle.species} />
              {summary.biomass && <Stat label="Biomass" value={`${summary.biomass.toFixed(0)} kg`} />}
              {summary.fcr && <Stat label="FCR" value={summary.fcr.toFixed(2)} />}
              {summary.survival && <Stat label="Survival" value={`${summary.survival.toFixed(0)}%`} />}
            </div>
          </div>
        )}

        {/* Harvest details */}
        <div>
          <p className="ap-section-title">Harvest Details</p>
          <div className="space-y-4">
            <div>
              <label className="ap-label">Outcome <span className="text-ap-red">*</span></label>
              <div className="flex gap-3">
                {(['Successful', 'Failed'] as const).map(o => (
                  <button
                    key={o}
                    onClick={() => setOutcome(o)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all ${
                      outcome === o
                        ? o === 'Successful' ? 'bg-ap-green text-white border-ap-green' : 'bg-ap-red text-white border-ap-red'
                        : 'bg-ap-gray border-ap-border text-ap-muted'
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="ap-label">Harvest weight (kg)</label>
              <input type="number" className="ap-input" placeholder="Enter harvest weight" value={harvestWeight}
                onChange={e => setHarvestWeight(e.target.value)} min="0" step="0.1" />
            </div>
            <div>
              <label className="ap-label">Actual harvest date</label>
              <input type="date" className="ap-input" value={harvestDate}
                onChange={e => setHarvestDate(e.target.value)} />
            </div>
            {outcome === 'Failed' && (
              <div>
                <label className="ap-label">Failure reason</label>
                <textarea className="ap-input resize-none" rows={3} placeholder="Describe what happened..."
                  value={failureReason} onChange={e => setFailureReason(e.target.value)} maxLength={500} />
              </div>
            )}
          </div>
        </div>

        <div className="bg-ap-amber-light rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-ap-amber mt-0.5 flex-shrink-0" />
          <p className="text-xs text-ap-muted">
            After closing, all logs for this cycle will be locked for editing. A Cycle Report PDF will be generated automatically.
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-ap-border px-5 py-4 space-y-3">
        <button className="ap-btn-primary" onClick={handleClose} disabled={loading}>
          {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto block" /> : 'Close Cycle & Download Report'}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ap-muted">{label}</p>
      <p className="text-sm font-bold text-ap-text">{value}</p>
    </div>
  )
}
