'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Pond, CropCycle, PondLog } from '@/lib/types'
import { Plus, Droplets, Fish, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface PondWithData extends Pond {
  active_cycle?: CropCycle
  latest_log?: PondLog
  cumulative_mortality?: number
}

export default function HomePage() {
  const router = useRouter()
  const [ponds, setPonds] = useState<PondWithData[]>([])
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()

    // Demo mode
    if (sessionStorage.getItem('ap_demo')) {
      const profile = JSON.parse(sessionStorage.getItem('ap_profile') || '{"name":"Ravi Kumar"}')
      setUserName(profile.name || 'Farmer')
      const demoPonds = JSON.parse(sessionStorage.getItem('ap_ponds') || '[]')
      setPonds(demoPonds)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/auth/phone'); return }

    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).single()
    setUserName(profile?.name || 'Farmer')

    const { data: pondsData } = await supabase
      .from('ponds')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!pondsData || pondsData.length === 0) {
      setPonds([])
      setLoading(false)
      return
    }

    // Load active cycles and latest logs
    const enriched: PondWithData[] = await Promise.all(
      pondsData.map(async (pond) => {
        const { data: cycle } = await supabase
          .from('crop_cycles')
          .select('*')
          .eq('pond_id', pond.id)
          .eq('status', 'active')
          .single()

        let latestLog: PondLog | undefined
        let cumMortality = 0

        if (cycle) {
          const { data: logs } = await supabase
            .from('pond_logs')
            .select('*')
            .eq('cycle_id', cycle.id)
            .order('observed_at', { ascending: false })
            .limit(1)
          if (logs && logs.length > 0) latestLog = logs[0]

          const { data: mortalityData } = await supabase
            .from('pond_logs')
            .select('mortality_count')
            .eq('cycle_id', cycle.id)
          cumMortality = mortalityData?.reduce((sum, l) => sum + (l.mortality_count || 0), 0) || 0
        }

        return { ...pond, active_cycle: cycle || undefined, latest_log: latestLog, cumulative_mortality: cumMortality }
      })
    )

    setPonds(enriched)
    setLoading(false)
  }

  const getHour = () => new Date().getHours()
  const greeting = getHour() < 12 ? 'Good morning' : getHour() < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-2 border-ap-blue/20 border-t-ap-blue rounded-full animate-spin" />
          <p className="text-ap-muted text-sm">Loading your ponds...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-ap-gray">
      {/* Header */}
      <div className="bg-ap-blue px-5 pt-12 pb-5 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm">{greeting},</p>
            <h1 className="text-xl font-bold text-white">{userName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Fish size={16} className="text-white" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <h2 className="text-white font-semibold text-base">My Ponds</h2>
          <button
            onClick={() => router.push('/ponds/new')}
            className="flex items-center gap-1.5 bg-white text-ap-blue text-sm font-semibold px-3 py-1.5 rounded-full"
          >
            <Plus size={14} /> Add Pond
          </button>
        </div>
      </div>

      {/* Pond list */}
      <div className="flex-1 px-4 py-4 space-y-3 pb-24">
        {ponds.length === 0 ? (
          <EmptyState onAdd={() => router.push('/ponds/new')} />
        ) : (
          ponds.map(pond => (
            <PondCard
              key={pond.id}
              pond={pond}
              onClick={() => router.push(`/ponds/${pond.id}`)}
            />
          ))
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav active="home" />
    </div>
  )
}

function PondCard({ pond, onClick }: { pond: PondWithData; onClick: () => void }) {
  const cycle = pond.active_cycle
  const log = pond.latest_log

  const cycleDay = cycle ? getCycleDay(cycle.stocking_date) : null
  const harvestText = cycle ? getHarvestDisplay(cycle.harvest_window_start, cycle.harvest_window_end) : null

  const wqStatus = log ? getOverallWQStatus({
    do_mgl: log.do_mgl, ph: log.ph, ammonia_mgl: log.ammonia_mgl,
    temp_c: log.temp_c, salinity_ppt: log.salinity_ppt,
    calcium_mgl: log.calcium_mgl, magnesium_mgl: log.magnesium_mgl, potassium_mgl: log.potassium_mgl
  }) : 'gray'

  const stockingCount = cycle && pond.area_acres ? Math.round(cycle.stocking_density * pond.area_acres * 4047) : 0
  const survivalRate = stockingCount > 0 && pond.cumulative_mortality !== undefined
    ? ((stockingCount - pond.cumulative_mortality) / stockingCount * 100)
    : null
  const biomass = log?.biomass_kg

  const lastLogTime = log ? formatDistanceToNow(new Date(log.observed_at), { addSuffix: true }) : null
  const hasLogToday = log && new Date(log.observed_at).toDateString() === new Date().toDateString()

  const wqDotColor = wqStatus === 'green' ? 'bg-ap-green' : wqStatus === 'blue' ? 'bg-ap-blue' : wqStatus === 'red' ? 'bg-ap-red' : 'bg-ap-muted'

  return (
    <button
      onClick={onClick}
      className="ap-card w-full text-left active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-ap-text text-base">{pond.name}</h3>
            {cycle && <span className="pill-blue">{cycle.species}</span>}
          </div>
          {cycleDay && (
            <p className="text-ap-muted text-sm mt-0.5">
              Day {cycleDay}{harvestText ? ` — ${harvestText}` : ''}
            </p>
          )}
          {!cycle && <p className="text-ap-muted text-sm">No active cycle</p>}
        </div>
        {log && (
          <div className={`w-3 h-3 rounded-full mt-1 ${wqDotColor}`} title={`Water quality: ${wqStatus}`} />
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          {biomass !== undefined && biomass !== null && (
            <div>
              <p className="text-xs text-ap-muted">Biomass</p>
              <p className="text-sm font-semibold text-ap-text">{formatNumber(biomass, 0)} kg</p>
            </div>
          )}
          {survivalRate !== null && (
            <div>
              <p className="text-xs text-ap-muted">Survival</p>
              <p className={`text-sm font-semibold ${survivalRate < 70 ? 'text-ap-red' : survivalRate < 85 ? 'text-ap-amber' : 'text-ap-green'}`}>
                {survivalRate.toFixed(0)}%
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasLogToday ? (
            <CheckCircle2 size={14} className="text-ap-green" />
          ) : (
            <Clock size={14} className="text-ap-amber" />
          )}
          <span className={`text-xs ${hasLogToday ? 'text-ap-green' : 'text-ap-amber'}`}>
            {lastLogTime ? `Logged ${lastLogTime}` : 'No log today'}
          </span>
        </div>
      </div>
    </button>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-20 h-20 bg-ap-blue-light rounded-full flex items-center justify-center mb-4">
        <Droplets size={36} className="text-ap-blue" />
      </div>
      <h3 className="text-ap-text font-bold text-lg mb-2">No ponds yet</h3>
      <p className="text-ap-muted text-sm text-center mb-6">
        Set up your first pond and start your crop cycle to begin logging
      </p>
      <button onClick={onAdd} className="ap-btn-primary max-w-[200px]">
        <span className="flex items-center justify-center gap-2">
          <Plus size={18} /> Add First Pond
        </span>
      </button>
    </div>
  )
}

function BottomNav({ active }: { active: 'home' | 'aquagpt' | 'profile' }) {
  const router = useRouter()
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-ap-border px-4 py-2 flex items-center justify-around z-20">
      <NavTab icon={<Fish size={20} />} label="Ponds" active={active === 'home'} onClick={() => router.push('/home')} />
      <NavTab icon={<AlertCircle size={20} />} label="AquaGPT" active={active === 'aquagpt'} onClick={() => {}} />
      <NavTab icon={
        <div className="w-5 h-5 rounded-full bg-ap-blue/20 flex items-center justify-center">
          <span className="text-xs text-ap-blue font-bold">P</span>
        </div>
      } label="Profile" active={active === 'profile'} onClick={() => {}} />
    </div>
  )
}

function NavTab({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 px-4 py-1">
      <span className={active ? 'text-ap-blue' : 'text-ap-muted'}>{icon}</span>
      <span className={`text-[10px] font-medium ${active ? 'text-ap-blue' : 'text-ap-muted'}`}>{label}</span>
    </button>
  )
}
