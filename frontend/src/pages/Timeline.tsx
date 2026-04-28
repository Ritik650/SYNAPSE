import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, CartesianGrid, Legend,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { timelineApi, intelligenceApi } from '../lib/api'
import { metricLabel, cn } from '../lib/utils'
import { X, Zap } from 'lucide-react'
import type { CascadeExplanation, HealthEvent } from '../lib/types'

const METRIC_CONFIG: Record<string, { color: string; normalizeMax: number; invert?: boolean }> = {
  hrv_rmssd:        { color: '#3B82F6', normalizeMax: 80 },
  rhr:              { color: '#EF4444', normalizeMax: 90, invert: true },
  sleep_duration_min:{ color: '#8B5CF6', normalizeMax: 540 },
  sleep_efficiency:  { color: '#6366F1', normalizeMax: 100 },
  steps:            { color: '#22C55E', normalizeMax: 15000 },
  mood_self:        { color: '#F59E0B', normalizeMax: 10 },
  stress_self:      { color: '#F97316', normalizeMax: 10, invert: true },
  screen_time_min:  { color: '#EC4899', normalizeMax: 480, invert: true },
}

const DEFAULT_METRICS = ['hrv_rmssd', 'rhr', 'sleep_duration_min', 'steps']

const EVENT_COLORS: Record<string, string> = {
  illness_onset: '#EF4444',
  illness_resolve: '#22C55E',
  symptom: '#F97316',
  workout: '#22C55E',
}

const RANGE_OPTIONS = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '120d', days: 120 },
]

function normalize(value: number, cfg: { normalizeMax: number; invert?: boolean }) {
  const pct = Math.min(100, Math.max(0, (value / cfg.normalizeMax) * 100))
  return cfg.invert ? 100 - pct : pct
}

interface CascadeModalProps {
  event: HealthEvent
  onClose: () => void
}

function CascadeModal({ event, onClose }: CascadeModalProps) {
  const [result, setResult] = useState<CascadeExplanation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    intelligenceApi.cascade(event.id)
      .then(r => { setResult(r.data as CascadeExplanation); setLoading(false) })
      .catch(() => setLoading(false))
  }, [event.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-bg-surface border border-border-subtle rounded-lg w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-5 border-b border-border-subtle">
          <div>
            <div className="text-xs font-mono text-text-secondary uppercase tracking-wider mb-1">
              Causal Cascade
            </div>
            <h3 className="text-text-primary font-semibold">{event.title}</h3>
            <div className="text-text-secondary text-xs mt-0.5">
              {format(new Date(event.ts), 'MMMM d, yyyy')}
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-4/5" />
              <Shimmer className="h-4 w-3/5" />
            </div>
          ) : result ? (
            <>
              <p className="narrative-text text-sm leading-relaxed">{result.narrative}</p>

              {result.contributing_factors?.length > 0 && (
                <div>
                  <div className="text-xs font-mono text-text-secondary uppercase tracking-wider mb-2">
                    Contributing Factors
                  </div>
                  <div className="space-y-2">
                    {result.contributing_factors.map((f, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-1.5 w-full">
                          <div className="flex justify-between mb-1">
                            <span className="text-text-primary text-xs font-medium">{f.factor}</span>
                            <span className="text-text-secondary text-xs font-mono">
                              {Math.round(f.weight * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full"
                              style={{ width: `${f.weight * 100}%` }}
                            />
                          </div>
                          <p className="text-text-secondary text-xs mt-1">{f.evidence}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.alternative_explanations?.length > 0 && (
                <div>
                  <div className="text-xs font-mono text-text-secondary uppercase tracking-wider mb-2">
                    Alternative Explanations
                  </div>
                  <ul className="space-y-1">
                    {result.alternative_explanations.map((e, i) => (
                      <li key={i} className="text-text-secondary text-xs flex gap-2">
                        <span className="text-text-secondary">•</span> {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                <span className="text-xs text-text-secondary">Confidence:</span>
                <span className="text-xs font-mono text-accent-soft">
                  {Math.round((result.confidence || 0) * 100)}%
                </span>
              </div>

              <p className="safety-footer">
                Synapse is informational only. This analysis does not constitute medical advice.
              </p>
            </>
          ) : (
            <p className="text-text-secondary text-sm text-center py-4">
              Cascade analysis unavailable — requires API key.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded p-3 text-xs shadow-lg">
      <div className="text-text-secondary mb-1.5 font-mono">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono text-text-primary">{p.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export function Timeline() {
  const [rangeDays, setRangeDays] = useState(120)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(DEFAULT_METRICS)
  const [cascadeEvent, setCascadeEvent] = useState<HealthEvent | null>(null)

  const fromDate = format(subDays(new Date(), rangeDays), "yyyy-MM-dd'T'HH:mm:ssxxx")

  const { data: timelineData, isLoading: chartLoading } = useQuery({
    queryKey: ['timeline', rangeDays, selectedMetrics.join(',')],
    queryFn: () =>
      timelineApi
        .get({ from: fromDate, metrics: selectedMetrics.join(',') })
        .then(r => r.data as { tracks: Array<{ metric_type: string; data: Array<{ ts: string; value: number }> }> }),
    enabled: selectedMetrics.length > 0,
  })

  const { data: events } = useQuery({
    queryKey: ['events', rangeDays],
    queryFn: () =>
      timelineApi
        .events({ from: fromDate, types: 'illness_onset,illness_resolve,symptom,workout' })
        .then(r => r.data as HealthEvent[]),
  })

  // Merge tracks into per-day records for recharts
  const chartData = useMemo(() => {
    if (!timelineData?.tracks?.length) return []
    const dayMap: Record<string, Record<string, number>> = {}
    for (const track of timelineData.tracks) {
      const cfg = METRIC_CONFIG[track.metric_type]
      if (!cfg) continue
      for (const pt of track.data) {
        const day = pt.ts.slice(0, 10)
        if (!dayMap[day]) dayMap[day] = {}
        dayMap[day][track.metric_type] = normalize(pt.value, cfg)
      }
    }
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, values]) => ({ day, ...values }))
  }, [timelineData])

  const keyEvents = useMemo(() =>
    (events ?? []).filter(e =>
      ['illness_onset', 'symptom', 'workout'].includes(e.event_type)
    ).slice(0, 30),
    [events]
  )

  const toggleMetric = useCallback((m: string) => {
    setSelectedMetrics(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }, [])

  return (
    <Shell title="Time Machine">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Range selector */}
          <div className="flex items-center gap-1 bg-bg-elevated rounded-lg p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setRangeDays(opt.days)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-mono transition-colors',
                  rangeDays === opt.days
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Metric toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(METRIC_CONFIG).map(([m, cfg]) => (
              <button
                key={m}
                onClick={() => toggleMetric(m)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  selectedMetrics.includes(m)
                    ? 'border-transparent text-white'
                    : 'border-border-subtle text-text-secondary hover:border-text-secondary'
                )}
                style={selectedMetrics.includes(m) ? { background: cfg.color } : {}}
              >
                {metricLabel(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <Card className="p-6">
          <CardHeader>
            <CardTitle className="text-sm">Normalized health metrics (0–100 scale)</CardTitle>
            <span className="text-text-secondary text-xs">Inverted metrics: lower RHR/stress/screen = better</span>
          </CardHeader>

          {chartLoading ? (
            <div className="h-72 flex items-center justify-center">
              <Shimmer className="w-full h-64" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-text-secondary text-sm">
              No data — seed demo data first
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3B" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#8A92A6', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2A2E3B' }}
                  tickFormatter={d => format(new Date(d), 'MMM d')}
                  interval={Math.max(1, Math.floor(chartData.length / 12))}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#8A92A6', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: '#8A92A6', fontSize: 11 }}>{metricLabel(value)}</span>
                  )}
                />

                {/* Event reference lines */}
                {keyEvents.map(e => (
                  <ReferenceLine
                    key={e.id}
                    x={e.ts.slice(0, 10)}
                    stroke={EVENT_COLORS[e.event_type] ?? '#8A92A6'}
                    strokeDasharray="4 2"
                    strokeWidth={1.5}
                  />
                ))}

                {selectedMetrics.map(m => {
                  const cfg = METRIC_CONFIG[m]
                  if (!cfg) return null
                  return (
                    <Line
                      key={m}
                      type="monotone"
                      dataKey={m}
                      name={m}
                      stroke={cfg.color}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  )
                })}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Events list */}
        <div>
          <h3 className="text-text-secondary text-xs font-mono uppercase tracking-wider mb-3">
            Key Events
          </h3>
          <div className="space-y-2">
            {keyEvents.length === 0 ? (
              <p className="text-text-secondary text-sm">No events in range</p>
            ) : (
              keyEvents.filter(e => ['illness_onset', 'symptom'].includes(e.event_type)).concat(
                keyEvents.filter(e => e.event_type === 'workout').slice(0, 5)
              ).map(event => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg border border-border-subtle"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: EVENT_COLORS[event.event_type] ?? '#8A92A6' }}
                    />
                    <div>
                      <div className="text-text-primary text-sm font-medium">{event.title}</div>
                      <div className="text-text-secondary text-xs">
                        {format(new Date(event.ts), 'MMM d, yyyy')}
                        {' · '}
                        <span className="font-mono">{event.event_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setCascadeEvent(event)}
                    className="text-xs text-accent-soft hover:text-accent flex items-center gap-1 px-3 py-1.5 rounded border border-accent/20 hover:border-accent/40 transition-colors"
                  >
                    <Zap size={12} />
                    Explain
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {cascadeEvent && (
          <CascadeModal event={cascadeEvent} onClose={() => setCascadeEvent(null)} />
        )}
      </AnimatePresence>
    </Shell>
  )
}
