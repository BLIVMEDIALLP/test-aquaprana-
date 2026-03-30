'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { calcHarvestWindow } from '@/lib/calculations'
import { SPECIES_LIST, SPECIES_CATEGORIES } from '@/lib/types'
import { ArrowLeft, MapPin, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function NewPondPage() {
  const router = useRouter()

  // Pond fields
  const [pondName, setPondName] = useState('')
  const [areaAcres, setAreaAcres] = useState('')
  const [depthFt, setDepthFt] = useState('')
  const [locationCaptured, setLocationCaptured] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  // Cycle fields
  const [species, setSpecies] = useState('')
  const [stockingDensity, setStockingDensity] = useState('')
  const [stockingDate, setStockingDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [cycleNotes, setCycleNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const harvestWindow = species && stockingDate ? calcHarvestWindow(stockingDate, species) : null

  const captureGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLat(pos.coords.latitude)
          setLng(pos.coords.longitude)
          setLocationCaptured(true)
        },
        () => setError('Could not get location. Please allow location access.')
      )
    }
  }

  const handleSave = async () => {
    if (!pondName.trim()) { setError('Pond name is required'); return }
    if (!species) { setError('Select a species'); return }
    if (!stockingDensity || parseFloat(stockingDensity) <= 0) { setError('Enter stocking density'); return }
    if (!stockingDate) { setError('Enter stocking date'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const isDemo = sessionStorage.getItem('ap_demo')

    if (isDemo) {
      const window_ = calcHarvestWindow(stockingDate, species)
      const newPond = {
        id: `demo-${Date.now()}`,
        user_id: 'demo',
        name: pondName.trim(),
        area_acres: areaAcres ? parseFloat(areaAcres) : null,
        depth_ft: depthFt ? parseFloat(depthFt) : null,
        location_lat: lat,
        location_lng: lng,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active_cycle: {
          id: `demo-cycle-${Date.now()}`,
          pond_id: `demo-${Date.now()}`,
          species,
          stocking_density: parseFloat(stockingDensity),
          stocking_date: stockingDate,
          harvest_window_start: window_?.start,
          harvest_window_end: window_?.end,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }
      const existing = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
      sessionStorage.setItem('ap_ponds', JSON.stringify([newPond, ...existing]))
      router.push('/home')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/phone'); return }

    // Create pond
    const { data: pond, error: pondErr } = await supabase
      .from('ponds')
      .insert({
        user_id: user.id,
        name: pondName.trim(),
        area_acres: areaAcres ? parseFloat(areaAcres) : null,
        depth_ft: depthFt ? parseFloat(depthFt) : null,
        location_lat: lat,
        location_lng: lng,
      })
      .select()
      .single()

    if (pondErr || !pond) { setError(pondErr?.message || 'Failed to create pond'); setLoading(false); return }

    // Calculate harvest window
    const hw = calcHarvestWindow(stockingDate, species)

    // Create cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from('crop_cycles')
      .insert({
        pond_id: pond.id,
        species,
        stocking_density: parseFloat(stockingDensity),
        stocking_date: stockingDate,
        harvest_window_start: hw?.start || null,
        harvest_window_end: hw?.end || null,
        notes: cycleNotes || null,
        status: 'active',
      })
      .select()
      .single()

    if (cycleErr) { setError(cycleErr.message); setLoading(false); return }

    router.replace(`/ponds/${pond.id}`)
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="bg-ap-blue px-5 pt-12 pb-5 sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-white/80 mb-3 flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-xl font-bold text-white">Set up your pond</h1>
        <p className="text-white/70 text-sm">Pond details and first crop cycle</p>
      </div>

      <div className="flex-1 px-5 py-6 space-y-6 pb-32">
        {/* Section 1: Pond Details */}
        <div>
          <p className="ap-section-title">Pond Details</p>
          <div className="space-y-4">
            <div>
              <label className="ap-label">Pond name <span className="text-ap-red">*</span></label>
              <input type="text" className="ap-input" placeholder="e.g. Pond 1 — East" value={pondName}
                onChange={e => setPondName(e.target.value)} maxLength={60} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ap-label">Area (acres)</label>
                <input type="number" className="ap-input" placeholder="2.5" value={areaAcres}
                  onChange={e => setAreaAcres(e.target.value)} min="0" step="0.01" />
              </div>
              <div>
                <label className="ap-label">Depth (ft)</label>
                <input type="number" className="ap-input" placeholder="4.0" value={depthFt}
                  onChange={e => setDepthFt(e.target.value)} min="0" step="0.1" />
              </div>
            </div>
            <div>
              <label className="ap-label">Location (optional)</label>
              <button onClick={captureGPS}
                className={`ap-input text-left flex items-center gap-2 ${locationCaptured ? 'text-ap-green' : 'text-ap-muted'}`}>
                <MapPin size={16} className={locationCaptured ? 'text-ap-green' : 'text-ap-muted'} />
                {locationCaptured && lat && lng
                  ? `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`
                  : '⊕ Capture GPS location'}
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-ap-border" />

        {/* Section 2: Crop Cycle */}
        <div>
          <p className="ap-section-title">First Crop Cycle</p>
          <div className="space-y-4">
            <div>
              <label className="ap-label">Species <span className="text-ap-red">*</span></label>
              <div className="relative">
                <select className="ap-input appearance-none pr-8" value={species}
                  onChange={e => setSpecies(e.target.value)}>
                  <option value="">Select species</option>
                  {SPECIES_CATEGORIES.map(cat => (
                    <optgroup key={cat} label={cat}>
                      {SPECIES_LIST.filter(s => s.category === cat).map(s => (
                        <option key={s.display_name} value={s.display_name}>{s.display_name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ap-muted pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="ap-label">Stocking density (per m²) <span className="text-ap-red">*</span></label>
              <input type="number" className="ap-input" placeholder="60" value={stockingDensity}
                onChange={e => setStockingDensity(e.target.value)} min="0" step="1" />
            </div>

            <div>
              <label className="ap-label">Stocking date <span className="text-ap-red">*</span></label>
              <input type="date" className="ap-input" value={stockingDate} max={today}
                onChange={e => setStockingDate(e.target.value)} />
            </div>

            {/* Harvest window auto-calc */}
            {harvestWindow && (
              <div className="bg-ap-blue-light rounded-xl p-3">
                <p className="text-xs text-ap-muted mb-0.5">Estimated harvest window (auto-calculated)</p>
                <p className="text-sm font-semibold text-ap-blue">
                  {format(parseISO(harvestWindow.start), 'dd MMM yyyy')} — {format(parseISO(harvestWindow.end), 'dd MMM yyyy')}
                </p>
                <p className="text-xs text-ap-muted mt-0.5">This is a guide, not a deadline.</p>
              </div>
            )}

            {species === 'Other (custom)' && (
              <div>
                <label className="ap-label">Expected harvest date (optional)</label>
                <input type="date" className="ap-input" min={today} />
              </div>
            )}

            <div>
              <label className="ap-label">Notes (optional)</label>
              <textarea className="ap-input resize-none" rows={3}
                placeholder="Seed source, initial conditions, etc."
                value={cycleNotes} onChange={e => setCycleNotes(e.target.value)} maxLength={1000} />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-ap-red-light border border-red-200 rounded-xl px-4 py-3">
            <p className="text-ap-red text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-ap-border px-5 py-4">
        <button className="ap-btn-primary flex items-center justify-center gap-2" onClick={handleSave} disabled={loading}>
          {loading
            ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : 'Save Pond & Start Cycle →'}
        </button>
      </div>
    </div>
  )
}
