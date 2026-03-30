'use client'

import { useState } from 'react'
import { PondLog } from '@/lib/types'
import { getWQStatus } from '@/lib/calculations'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts'
import { format, subDays, parseISO } from 'date-fns'
import { Download } from 'lucide-react'

type TimeRange = '7D' | '14D' | '30D'

const TREND_PARAMS = [
  { key: 'do_mgl', label: 'DO (mg/L)', safeMin: 4, safeMax: 10, color: '#1E7AB8' },
  { key: 'ph', label: 'pH', safeMin: 7.5, safeMax: 8.5, color: '#27ae60' },
  { key: 'ammonia_mgl', label: 'Ammonia (mg/L)', safeMin: 0, safeMax: 0.1, color: '#e74c3c' },
  { key: 'temp_c', label: 'Temperature (°C)', safeMin: 26, safeMax: 32, color: '#f39c12' },
  { key: 'salinity_ppt', label: 'Salinity (ppt)', safeMin: 10, safeMax: 25, color: '#8e44ad' },
  { key: 'calcium_mgl', label: 'Calcium (mg/L)', safeMin: 75, safeMax: 500, color: '#16a085' },
  { key: 'magnesium_mgl', label: 'Magnesium (mg/L)', safeMin: 100, safeMax: 1000, color: '#d35400' },
  { key: 'potassium_mgl', label: 'Potassium (mg/L)', safeMin: 5, safeMax: 500, color: '#2980b9' },
]

export default function TrendsTab({ logs }: { logs: PondLog[] }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7D')

  const days = timeRange === '7D' ? 7 : timeRange === '14D' ? 14 : 30
  const cutoff = subDays(new Date(), days)

  const filteredLogs = logs.filter(l => parseISO(l.observed_at) >= cutoff)

  const handleExport = () => {
    const headers = ['observed_at', 'do_mgl', 'ph', 'temp_c', 'salinity_ppt', 'ammonia_mgl', 'turbidity_cm', 'calcium_mgl', 'magnesium_mgl', 'potassium_mgl', 'param_source']
    const rows = filteredLogs.map(l => headers.map(h => (l as unknown as Record<string, unknown>)[h] ?? '').join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `water_params_${timeRange}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex bg-ap-gray rounded-lg p-0.5 gap-0.5">
          {(['7D', '14D', '30D'] as TimeRange[]).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === r ? 'bg-white text-ap-blue shadow-sm' : 'text-ap-muted'}`}>
              {r}
            </button>
          ))}
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 text-ap-blue text-sm font-medium px-3 py-1.5 bg-ap-blue-light rounded-lg">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {filteredLogs.length < 2 ? (
        <div className="flex flex-col items-center py-12">
          <p className="text-ap-muted text-sm">Log more data to see trends</p>
          <p className="text-ap-muted text-xs mt-1">Need at least 2 data points</p>
        </div>
      ) : (
        TREND_PARAMS.map(param => {
          const paramLogs = filteredLogs.filter(l => (l as unknown as Record<string, number | null>)[param.key] != null)
          if (paramLogs.length < 2) return null

          const chartData = [...paramLogs].reverse().map(l => ({
            date: format(parseISO(l.observed_at), 'MMM d'),
            value: (l as unknown as Record<string, number>)[param.key],
          }))

          return (
            <div key={param.key} className="ap-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-ap-text">{param.label}</p>
                <span className="text-xs text-ap-muted">Safe: {param.safeMin}–{param.safeMax}</span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#718096' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#718096' }} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(val: number) => [val.toFixed(2), param.label]}
                  />
                  <ReferenceArea y1={param.safeMin} y2={param.safeMax} fill={param.color} fillOpacity={0.08} />
                  <ReferenceLine y={param.safeMin} stroke={param.color} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={param.safeMax} stroke={param.color} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={param.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: param.color }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        })
      )}
    </div>
  )
}
