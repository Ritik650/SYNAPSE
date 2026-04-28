import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { timelineApi } from '../lib/api'
import { Heart, Activity, TrendingUp, Zap } from 'lucide-react'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-xs shadow">
      <div className="text-text-secondary mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="font-mono" style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(1)} {p.name === 'HRV' ? 'ms' : 'bpm'}
        </div>
      ))}
    </div>
  )
}

export function Recovery() {
  const from = format(subDays(new Date(), 90), "yyyy-MM-dd'T'HH:mm:ssxxx")

  const { data: timeline, isLoading } = useQuery({
    queryKey: ['timeline-recovery'],
    queryFn: () =>
      timelineApi
        .get({ from, metrics: 'hrv_rmssd,rhr,spo2,resp_rate' })
        .then(r => r.data as { tracks: Array<{ metric_type: string; data: Array<{ ts: string; value: number }> }> }),
  })

  const tracks = Object.fromEntries(
    (timeline?.tracks ?? []).map(t => [t.metric_type, t.data])
  )

  const hrvData = (tracks.hrv_rmssd ?? []).map(d => ({
    day: d.ts.slice(0, 10),
    label: format(new Date(d.ts), 'MMM d'),
    hrv: d.value,
  }))

  const rhrData = (tracks.rhr ?? []).map(d => ({
    day: d.ts.slice(0, 10),
    label: format(new Date(d.ts), 'MMM d'),
    rhr: d.value,
  }))

  const merged: Record<string, { label: string; hrv?: number; rhr?: number }> = {}
  hrvData.forEach(d => { merged[d.day] = { label: d.label, hrv: d.hrv } })
  rhrData.forEach(d => { merged[d.day] = { ...merged[d.day], label: d.label, rhr: d.rhr } })
  const combinedData = Object.values(merged).sort((a, b) => a.label.localeCompare(b.label))

  const avgHrv = hrvData.length
    ? hrvData.reduce((s, d) => s + d.hrv, 0) / hrvData.length
    : 0
  const avgRhr = rhrData.length
    ? rhrData.reduce((s, d) => s + d.rhr, 0) / rhrData.length
    : 0

  const spo2Data = (tracks.spo2 ?? [])
  const avgSpo2 = spo2Data.length
    ? spo2Data.reduce((s, d) => s + d.value, 0) / spo2Data.length
    : 0

  const stats = [
    { label: 'Avg HRV', value: `${avgHrv.toFixed(0)} ms`, icon: Activity, color: '#8B5CF6' },
    { label: 'Avg RHR', value: `${avgRhr.toFixed(0)} bpm`, icon: Heart, color: '#EF4444' },
    { label: 'Avg SpO2', value: `${avgSpo2.toFixed(1)}%`, icon: TrendingUp, color: '#22C55E' },
    { label: 'Days tracked', value: hrvData.length.toString(), icon: Zap, color: '#3B82F6' },
  ]

  return (
    <Shell title="Recovery Lab">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color }} />
                <span className="text-text-secondary text-xs">{label}</span>
              </div>
              <div className="font-mono text-2xl font-semibold text-text-primary">{value}</div>
            </motion.div>
          ))}
        </div>

        {/* HRV + RHR combined */}
        <Card className="p-5">
          <CardHeader>
            <CardTitle className="text-sm">HRV &amp; Resting Heart Rate (90 days)</CardTitle>
            <span className="text-text-secondary text-xs">HRV↑ + RHR↓ = better recovery</span>
          </CardHeader>
          {isLoading ? (
            <Shimmer className="h-56 w-full" />
          ) : combinedData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-text-secondary text-sm">
              No recovery data — seed demo first
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={combinedData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="hrvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3B" />
                <XAxis dataKey="label" tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false}
                  axisLine={{ stroke: '#2A2E3B' }}
                  interval={Math.max(1, Math.floor(combinedData.length / 10))} />
                <YAxis yAxisId="hrv" tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false} axisLine={false}
                  domain={['auto', 'auto']} tickFormatter={v => `${v}ms`} />
                <YAxis yAxisId="rhr" orientation="right" tick={{ fill: '#8A92A6', fontSize: 10 }}
                  tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={v => `${v}bpm`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8A92A6' }} />
                <Area yAxisId="hrv" type="monotone" dataKey="hrv" name="HRV"
                  stroke="#8B5CF6" strokeWidth={1.5} fill="url(#hrvGrad)" dot={false} />
                <Line yAxisId="rhr" type="monotone" dataKey="rhr" name="RHR"
                  stroke="#EF4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* SpO2 */}
        {!isLoading && (tracks.spo2 ?? []).length > 0 && (
          <Card className="p-5">
            <CardHeader>
              <CardTitle className="text-sm">Blood Oxygen SpO2 (90 days)</CardTitle>
              <span className="text-text-secondary text-xs">95%+ normal</span>
            </CardHeader>
            <ResponsiveContainer width="100%" height={140}>
              <ComposedChart
                data={(tracks.spo2 ?? []).map(d => ({
                  label: format(new Date(d.ts), 'MMM d'),
                  spo2: d.value,
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3B" />
                <XAxis dataKey="label" tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false}
                  axisLine={{ stroke: '#2A2E3B' }}
                  interval={Math.max(1, Math.floor((tracks.spo2 ?? []).length / 10))} />
                <YAxis tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false} axisLine={false}
                  domain={[90, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip />
                <ReferenceLine y={95} stroke="#EF4444" strokeDasharray="4 2" strokeWidth={1} />
                <Area type="monotone" dataKey="spo2" stroke="#22C55E" strokeWidth={1.5}
                  fill="url(#spo2Grad)" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}

        <p className="safety-footer text-center">
          HRV and recovery metrics are informational. Consult a cardiologist for clinical interpretation.
        </p>
      </div>
    </Shell>
  )
}
