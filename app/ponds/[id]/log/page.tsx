'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { calcBiomass, calcSurvivalRate } from '@/lib/calculations'
import { PondLog } from '@/lib/types'
import { ArrowLeft, AlertTriangle, Wifi, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'

interface LogFormState {
  observed_at: string
  do_mgl: string
  ph: string
  temp_c: string
  salinity_ppt: string
  ammonia_mgl: string
  turbidity_cm: string
  calcium_mgl: string
  magnesium_mgl: string
  potassium_mgl: string
  feed_qty_kg: string
  feed_brand: string
  mortality_count: string
  treatment: string
  abw_g: string
  notes: string
}

const EMPTY_FORM: LogFormState = {
  observed_at: format(new Date(), "HH:mm"),
  do_mgl: '', ph: '', temp_c: '', salinity_ppt: '', ammonia_mgl: '',
  turbidity_cm: '', calcium_mgl: '', magnesium_mgl: '', potassium_mgl: '',
  feed_qty_kg: '', feed_brand: '', mortality_count: '', treatment: '',
  abw_g: '', notes: '',
}

// Validation ranges
const RANGES: Record<string, [number, number, number, number]> = {
  // [hardMin, warnMin, warnMax, hardMax]
  do_mgl:       [0,   4,   10,  20],
  ph:           [0,   7.5, 8.5, 14],
  temp_c:       [0,   26,  32,  45],
  salinity_ppt: [0,   10,  25,  60],
  ammonia_mgl:  [0,   0,   0.1, 10],
  turbidity_cm: [0,   30,  50,  200],
  calcium_mgl:  [0,   75,  500, 500],
  magnesium_mgl:[0,   100, 1000,1000],
  potassium_mgl:[0,   5,   500, 500],
}

function getFieldWarning(key: string, val: string): 'ok' | 'warn' | 'critical' | null {
  if (!val) return null
  const n = parseFloat(val)
  if (isNaN(n)) return null
  const r = RANGES[key]
  if (!r) return null
  if (n < r[0] || n > r[3]) return 'critical'
  if (n < r[1] || n > r[2]) return (key === 'ammonia_mgl' && n > r[2]) ? 'critical' : 'warn'
  return 'ok'
}

export default function LogEntryPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const pondId = params.id as string
  const editLogId = searchParams.get('edit')

  const [form, setForm] = useState<LogFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [autoBiomass, setAutoBiomass] = useState<number | null>(null)
  const [cycleId, setCycleId] = useState<string | null>(null)
  const [stockingCount, setStockingCount] = useState<number>(0)
  const [cumulativeMortality, setCumulativeMortality] = useState<number>(0)
  const [recentBrands, setRecentBrands] = useState<string[]>([])

  useEffect(() => {
    loadCycleData()
  }, [pondId, editLogId])

  const loadCycleData = async () => {
    const isDemo = sessionStorage.getItem('ap_demo')
    if (isDemo) {
      const ponds = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
      const pond = ponds.find((p: { id: string }) => p.id === pondId)
      if (pond?.active_cycle) {
        setCycleId(pond.active_cycle.id)
        if (pond.area_acres) {
          setStockingCount(Math.round(pond.active_cycle.stocking_density * pond.area_acres * 4047))
        }
        const logs: PondLog[] = JSON.parse(sessionStorage.getItem(`ap_logs_${pondId}`) || '[]')
        setCumulativeMortality(logs.reduce((s: number, l: PondLog) => s + (l.mortality_count || 0), 0))
        setRecentBrands([...new Set(logs.slice(0, 5).map((l: PondLog) => l.feed_brand).filter(Boolean) as string[])])
        if (editLogId) {
          const log = logs.find((l: PondLog) => l.id === editLogId)
          if (log) populateForm(log)
        }
      }
      return
    }

    const supabase = createClient()
    const { data: pond } = await supabase.from('ponds').select('*, crop_cycles!inner(*)').eq('id', pondId).single()
    if (!pond) return

    const { data: cycle } = await supabase.from('crop_cycles').select('*').eq('pond_id', pondId).eq('status', 'active').single()
    if (!cycle) return

    setCycleId(cycle.id)
    if (pond.area_acres) {
      setStockingCount(Math.round(cycle.stocking_density * pond.area_acres * 4047))
    }

    const { data: logs } = await supabase.from('pond_logs').select('mortality_count, feed_brand').eq('cycle_id', cycle.id)
    setCumulativeMortality(logs?.reduce((s, l) => s + (l.mortality_count || 0), 0) || 0)
    setRecentBrands([...new Set(logs?.slice(0, 5).map(l => l.feed_brand).filter(Boolean) as string[])])

    if (editLogId) {
      const { data: log } = await supabase.from('pond_logs').select('*').eq('id', editLogId).single()
      if (log) populateForm(log)
    }
  }

  const populateForm = (log: PondLog) => {
    setForm({
      observed_at: format(new Date(log.observed_at), "HH:mm"),
      do_mgl: log.do_mgl?.toString() || '',
      ph: log.ph?.toString() || '',
      temp_c: log.temp_c?.toString() || '',
      salinity_ppt: log.salinity_ppt?.toString() || '',
      ammonia_mgl: log.ammonia_mgl?.toString() || '',
      turbidity_cm: log.turbidity_cm?.toString() || '',
      calcium_mgl: log.calcium_mgl?.toString() || '',
      magnesium_mgl: log.magnesium_mgl?.toString() || '',
      potassium_mgl: log.potassium_mgl?.toString() || '',
      feed_qty_kg: log.feed_qty_kg?.toString() || '',
      feed_brand: log.feed_brand || '',
      mortality_count: log.mortality_count?.toString() || '',
      treatment: log.treatment || '',
      abw_g: log.abw_g?.toString() || '',
      notes: log.notes || '',
    })
  }

  const set = (key: keyof LogFormState, val: string) => setForm(f => ({ ...f, [key]: val }))

  // Auto biomass when ABW changes
  useEffect(() => {
    const abw = parseFloat(form.abw_g)
    if (abw > 0 && stockingCount > 0) {
      const mortalityAdj = cumulativeMortality + (parseInt(form.mortality_count) || 0)
      const sr = calcSurvivalRate(stockingCount, mortalityAdj)
      const bm = calcBiomass(stockingCount, abw, sr)
      setAutoBiomass(bm)
    } else {
      setAutoBiomass(null)
    }
  }, [form.abw_g, form.mortality_count, stockingCount, cumulativeMortality])

  const handleSave = async () => {
    if (!form.observed_at) { setError('Observation time is required'); return }
    if (!cycleId) { setError('No active cycle found for this pond'); return }

    setSaving(true)
    setError('')

    const today = format(new Date(), 'yyyy-MM-dd')
    const observedAt = new Date(`${today}T${form.observed_at}:00`)

    const payload = {
      cycle_id: cycleId,
      pond_id: pondId,
      observed_at: observedAt.toISOString(),
      do_mgl: form.do_mgl ? parseFloat(form.do_mgl) : null,
      ph: form.ph ? parseFloat(form.ph) : null,
      temp_c: form.temp_c ? parseFloat(form.temp_c) : null,
      salinity_ppt: form.salinity_ppt ? parseFloat(form.salinity_ppt) : null,
      ammonia_mgl: form.ammonia_mgl ? parseFloat(form.ammonia_mgl) : null,
      turbidity_cm: form.turbidity_cm ? parseFloat(form.turbidity_cm) : null,
      calcium_mgl: form.calcium_mgl ? parseFloat(form.calcium_mgl) : null,
      magnesium_mgl: form.magnesium_mgl ? parseFloat(form.magnesium_mgl) : null,
      potassium_mgl: form.potassium_mgl ? parseFloat(form.potassium_mgl) : null,
      feed_qty_kg: form.feed_qty_kg ? parseFloat(form.feed_qty_kg) : null,
      feed_brand: form.feed_brand || null,
      mortality_count: form.mortality_count ? parseInt(form.mortality_count) : 0,
      treatment: form.treatment || null,
      abw_g: form.abw_g ? parseFloat(form.abw_g) : null,
      biomass_kg: autoBiomass,
      notes: form.notes || null,
      param_source: 'manual' as const,
    }

    const isDemo = sessionStorage.getItem('ap_demo')
    if (isDemo) {
      const logs: PondLog[] = JSON.parse(sessionStorage.getItem(`ap_logs_${pondId}`) || '[]')
      if (editLogId) {
        const idx = logs.findIndex(l => l.id === editLogId)
        if (idx >= 0) logs[idx] = { ...logs[idx], ...payload }
      } else {
        // Check daily cap
        const todayLogs = logs.filter(l => new Date(l.observed_at).toDateString() === new Date().toDateString())
        if (todayLogs.length >= 4) { setError('Daily log limit reached. Maximum 4 entries per day.'); setSaving(false); return }
        logs.unshift({ ...payload, id: `log-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      }
      sessionStorage.setItem(`ap_logs_${pondId}`, JSON.stringify(logs))
      setSuccess(true)
      setTimeout(() => router.push(`/ponds/${pondId}`), 1200)
      setSaving(false)
      return
    }

    const supabase = createClient()

    // Check daily cap
    if (!editLogId) {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
      const { count } = await supabase.from('pond_logs')
        .select('id', { count: 'exact', head: true })
        .eq('cycle_id', cycleId)
        .gte('observed_at', startOfDay.toISOString())
      if (count && count >= 4) {
        setError('Daily log limit reached. Maximum 4 entries per day.')
        setSaving(false)
        return
      }
    }

    const { error: err } = editLogId
      ? await supabase.from('pond_logs').update(payload).eq('id', editLogId)
      : await supabase.from('pond_logs').insert(payload)

    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push(`/ponds/${pondId}`), 1200)
    }
    setSaving(false)
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <div className="w-16 h-16 bg-ap-green-light rounded-full flex items-center justify-center">
          <CheckCircle size={32} className="text-ap-green" />
        </div>
        <p className="text-ap-text font-bold text-lg">Log Saved!</p>
        <p className="text-ap-muted text-sm">Returning to dashboard...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="bg-ap-blue px-5 pt-12 pb-5 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-white/80 flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-base font-bold text-white">{editLogId ? 'Edit Log Entry' : 'Log Entry'}</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-white font-semibold text-sm bg-white/20 px-3 py-1.5 rounded-full"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-6 pb-24 overflow-y-auto">
        {/* Observation time */}
        <div>
          <label className="ap-label">Observation time <span className="text-ap-red">*</span></label>
          <input type="time" className="ap-input" value={form.observed_at}
            onChange={e => set('observed_at', e.target.value)} />
        </div>

        {/* Water Quality */}
        <div>
          <p className="ap-section-title">Water Quality</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="DO (mg/L)" value={form.do_mgl} onChange={v => set('do_mgl', v)} fieldKey="do_mgl" hint="Safe: 4–10" />
            <NumberField label="pH" value={form.ph} onChange={v => set('ph', v)} fieldKey="ph" hint="Safe: 7.5–8.5" />
            <NumberField label="Temperature (°C)" value={form.temp_c} onChange={v => set('temp_c', v)} fieldKey="temp_c" hint="Safe: 26–32" />
            <NumberField label="Salinity (ppt)" value={form.salinity_ppt} onChange={v => set('salinity_ppt', v)} fieldKey="salinity_ppt" hint="10–25" />
            <NumberField label="Ammonia (mg/L)" value={form.ammonia_mgl} onChange={v => set('ammonia_mgl', v)} fieldKey="ammonia_mgl" hint="Safe: ≤0.1" step="0.001" />
            <NumberField label="Turbidity (cm)" value={form.turbidity_cm} onChange={v => set('turbidity_cm', v)} fieldKey="turbidity_cm" hint="30–50 Secchi" />
            <NumberField label="Calcium (mg/L)" value={form.calcium_mgl} onChange={v => set('calcium_mgl', v)} fieldKey="calcium_mgl" hint="Safe: ≥75" />
            <NumberField label="Magnesium (mg/L)" value={form.magnesium_mgl} onChange={v => set('magnesium_mgl', v)} fieldKey="magnesium_mgl" hint="Safe: ≥100" />
            <NumberField label="Potassium (mg/L)" value={form.potassium_mgl} onChange={v => set('potassium_mgl', v)} fieldKey="potassium_mgl" hint="Safe: ≥5" />
          </div>
        </div>

        {/* Farm Management */}
        <div>
          <p className="ap-section-title">Farm Management</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Feed qty (kg)" value={form.feed_qty_kg} onChange={v => set('feed_qty_kg', v)} fieldKey="" />
              <div>
                <label className="ap-label">Feed brand</label>
                <input type="text" className="ap-input" placeholder="e.g. Growel" value={form.feed_brand}
                  onChange={e => set('feed_brand', e.target.value)} list="brands-list" maxLength={100} />
                <datalist id="brands-list">
                  {recentBrands.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="ABW sample (g)" value={form.abw_g} onChange={v => set('abw_g', v)} fieldKey="" hint="5–10 animals" />
              <NumberField label="Mortality count" value={form.mortality_count} onChange={v => set('mortality_count', v)} fieldKey="" step="1" />
            </div>

            {/* Auto biomass display */}
            {autoBiomass !== null && (
              <div className="bg-ap-blue-light rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-ap-muted">Biomass (auto-calculated)</p>
                  <p className="text-lg font-bold text-ap-blue">{autoBiomass.toFixed(0)} kg</p>
                </div>
                <Wifi size={16} className="text-ap-blue" />
              </div>
            )}

            <div>
              <label className="ap-label">Treatment applied</label>
              <input type="text" className="ap-input" placeholder="e.g. Vitazyme 2L" value={form.treatment}
                onChange={e => set('treatment', e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="ap-label">Notes</label>
              <textarea className="ap-input resize-none" rows={3} placeholder="Observations, remarks..."
                value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-ap-red-light border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-ap-red" />
            <p className="text-ap-red text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-ap-border px-5 py-4">
        <button className="ap-btn-primary flex items-center justify-center gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Log Entry'}
        </button>
      </div>
    </div>
  )
}

function NumberField({ label, value, onChange, fieldKey, hint, step = '0.01' }: {
  label: string; value: string; onChange: (v: string) => void
  fieldKey: string; hint?: string; step?: string
}) {
  const warning = fieldKey ? getFieldWarning(fieldKey, value) : null
  const borderClass = warning === 'critical' ? 'border-ap-red ring-1 ring-ap-red' :
    warning === 'warn' ? 'border-ap-amber ring-1 ring-ap-amber' : ''

  return (
    <div>
      <label className="ap-label">{label}</label>
      <div className="relative">
        <input type="number" className={`ap-input ${borderClass}`} placeholder="—"
          value={value} onChange={e => onChange(e.target.value)} step={step} min="0" />
        {warning && warning !== 'ok' && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <AlertTriangle size={14} className={warning === 'critical' ? 'text-ap-red' : 'text-ap-amber'} />
          </div>
        )}
      </div>
      {hint && <p className="text-[10px] text-ap-muted mt-0.5">{hint}</p>}
    </div>
  )
}
