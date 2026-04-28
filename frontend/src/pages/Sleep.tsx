import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { timelineApi } from '../lib/api'
import { sleepMinToHours, scoreColor } from '../lib/utils'
import { Moon, Clock, Zap, Star } from 'lucide-react'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-xs shadow">
      <div className="text-text-secondary mb-1">{label}</div>
      <div className="font-mono text-text-primary">
        {payload[0]?.name === 'sleep_duration_min' ? sleepMinToHours(val) : `${val?.toFixed(1)}%`}
      </div>
    </div>
  )
}

export function Sleep() {
  const from = format(subDays(new Date(), 90), "yyyy-MM-dd'T'HH:mm:ssxxx")

  const { data: timeline, isLoading } = useQuery({
    queryKey: ['timeline-sleep'],
    queryFn: () =>
      timelineApi
        .get({ from, metrics: 'sleep_duration_min,sleep_efficiency,deep_sleep_min,rem_sleep_min' })
        .then(r => r.data as { tracks: Array<{ metric_type: string; data: Array<{ ts: string; value: number }> }> }),
  })

  const tracks = Object.fromEntries(
    (timeline?.tracks ?? []).map(t => [t.metric_type, t.data])
  )

  const durationData = (tracks.sleep_duration_min ?? []).map(d => ({
    day: d.ts.slice(0, 10),
    value: d.value,
    label: format(new Date(d.ts), 'MMM d'),
  }))

  const efficiencyData = (tracks.sleep_efficiency ?? []).map(d => ({
    day: d.ts.slice(0, 10),
    value: d.value,
    label: format(new Date(d.ts), 'MMM d'),
  }))

  const avgDuration = durationData.length
    ? durationData.reduce((s, d) => s + d.value, 0) / durationData.length
    : 0
  const avgEfficiency = efficiencyData.length
    ? efficiencyData.reduce((s, d) => s + d.value, 0) / efficiencyData.length
    : 0

  return (
    <Shell title="Sleep Lab">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Avg Duration', value: sleepMinToHours(avgDuration), icon: Clock, color: '#8B5CF6' },
            { label: 'Avg Efficiency', value: `${avgEfficiency.toFixed(1)}%`, icon: Star, color: '#3B82F6' },
            { label: 'Nights tracked', value: durationData.length.toString(), icon: Moon, color: '#6366F1' },
            { label: 'Target', value: '8h 0m', icon: Zap, color: '#22C55E' },
          ].map(({ label, value, icon: Icon, color }) => (
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

        {/* Duration chart */}
        <Card className="p-5">
          <CardHeader>
            <CardTitle className="text-sm">Sleep Duration (90 days)</CardTitle>
            <span className="text-text-secondary text-xs">8h = optimal</span>
          </CardHeader>
          {isLoading ? (
            <Shimmer className="h-48 w-full" />
          ) : durationData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-text-secondary text-sm">
              No sleep data — seed demo first
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={durationData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3B" />
                <XAxis dataKey="label" tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false}
                  axisLine={{ stroke: '#2A2E3B' }}
                  interval={Math.max(1, Math.floor(durationData.length / 10))} />
                <YAxis tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => sleepMinToHours(v)} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={480} stroke="#22C55E" strokeDasharray="4 2" strokeWidth={1} label={{ value: '8h', fill: '#22C55E', fontSize: 10 }} />
                <Area type="monotone" dataKey="value" name="sleep_duration_min"
                  stroke="#8B5CF6" strokeWidth={1.5} fill="url(#sleepGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Efficiency chart */}
        <Card className="p-5">
          <CardHeader>
            <CardTitle className="text-sm">Sleep Efficiency (90 days)</CardTitle>
            <span className="text-text-secondary text-xs">85%+ = good</span>
          </CardHeader>
          {isLoading ? (
            <Shimmer className="h-40 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={efficiencyData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3B" />
                <XAxis dataKey="label" tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false}
                  axisLine={{ stroke: '#2A2E3B' }}
                  interval={Math.max(1, Math.floor(efficiencyData.length / 10))} />
                <YAxis tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false} axisLine={false}
                  domain={[50, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={85} stroke="#22C55E" strokeDasharray="4 2" strokeWidth={1} />
                <Area type="monotone" dataKey="value" name="sleep_efficiency"
                  stroke="#6366F1" strokeWidth={1.5} fill="url(#effGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <p className="safety-footer text-center">
          Sleep data from wearable sensors. For clinical sleep disorders, consult a sleep medicine specialist.
        </p>
      </div>
    </Shell>
  )
}
