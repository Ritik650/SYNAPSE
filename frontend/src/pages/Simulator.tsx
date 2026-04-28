import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { intelligenceApi } from '../lib/api'
import { FlaskConical, Sparkles, ChevronRight, AlertCircle } from 'lucide-react'

interface Intervention {
  label: string
  key: string
  unit: string
  min: number
  max: number
  step: number
  default: number
  description: string
}

const INTERVENTIONS: Intervention[] = [
  { label: 'Extra Sleep', key: 'extra_sleep_hours', unit: 'h/night', min: 0, max: 3, step: 0.5, default: 1, description: 'Additional hours of sleep each night' },
  { label: 'Daily Steps', key: 'daily_steps_increase', unit: 'k steps', min: 0, max: 10, step: 1, default: 3, description: 'Increase in daily step count (thousands)' },
  { label: 'Screen Time Reduction', key: 'screen_time_reduction_hours', unit: 'h/day', min: 0, max: 4, step: 0.5, default: 1, description: 'Reduction in daily screen time' },
  { label: 'Meditation', key: 'meditation_minutes', unit: 'min/day', min: 0, max: 60, step: 5, default: 10, description: 'Daily mindfulness minutes' },
  { label: 'Alcohol Reduction', key: 'alcohol_units_reduction', unit: 'units/week', min: 0, max: 14, step: 1, default: 3, description: 'Weekly alcohol unit reduction' },
]

interface SimResult {
  summary: string
  projected_changes: Array<{ metric: string; direction: string; magnitude: string; confidence: string }>
  timeline: string
  caveats: string[]
  disclaimer?: string
}

export function Simulator() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(INTERVENTIONS.map(i => [i.key, i.default]))
  )
  const [duration, setDuration] = useState(30)
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runSim() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await intelligenceApi.simulate({ interventions: values, duration_days: duration })
      setResult(r.data as SimResult)
    } catch {
      setError('Simulation failed. Ensure the backend is running with a valid ANTHROPIC_API_KEY.')
    } finally {
      setLoading(false)
    }
  }

  const DIRECTION_COLOR: Record<string, string> = {
    increase: '#22C55E',
    decrease: '#EF4444',
    stable: '#8A92A6',
  }

  return (
    <Shell title="What-If Simulator">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <p className="text-text-secondary text-sm">
          Adjust lifestyle interventions and let Claude project how your health metrics would respond over time.
        </p>

        {/* Intervention sliders */}
        <Card className="p-5 space-y-5">
          <h3 className="text-text-primary font-semibold text-sm">Configure Interventions</h3>
          {INTERVENTIONS.map(itv => (
            <div key={itv.key}>
              <div className="flex justify-between items-center mb-1">
                <div>
                  <span className="text-text-primary text-sm font-medium">{itv.label}</span>
                  <span className="text-text-secondary text-xs ml-2">{itv.description}</span>
                </div>
                <span className="font-mono text-sm text-accent">
                  {values[itv.key]} {itv.unit}
                </span>
              </div>
              <input
                type="range"
                min={itv.min}
                max={itv.max}
                step={itv.step}
                value={values[itv.key]}
                onChange={e => setValues(v => ({ ...v, [itv.key]: +e.target.value }))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-text-secondary mt-0.5">
                <span>{itv.min} {itv.unit}</span>
                <span>{itv.max} {itv.unit}</span>
              </div>
            </div>
          ))}

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-text-primary text-sm font-medium">Projection Window</span>
              <span className="font-mono text-sm text-accent">{duration} days</span>
            </div>
            <input
              type="range" min={7} max={90} step={7} value={duration}
              onChange={e => setDuration(+e.target.value)}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-0.5">
              <span>7 days</span>
              <span>90 days</span>
            </div>
          </div>

          <button
            onClick={runSim}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <FlaskConical size={14} />
                </motion.div>
                Simulating with Claude…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Run Simulation
              </>
            )}
          </button>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded text-danger text-sm">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Summary */}
              <Card className="p-5">
                <div className="text-xs font-mono text-accent-soft uppercase mb-2">Claude Projection</div>
                <p className="text-text-primary text-sm leading-relaxed">{result.summary}</p>
                {result.timeline && (
                  <p className="text-text-secondary text-xs mt-3 italic">{result.timeline}</p>
                )}
              </Card>

              {/* Metric changes */}
              {result.projected_changes?.length > 0 && (
                <Card className="p-5">
                  <div className="text-xs font-mono text-accent-soft uppercase mb-3">Projected Metric Changes</div>
                  <div className="space-y-2">
                    {result.projected_changes.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                        <div className="flex items-center gap-2">
                          <ChevronRight size={12}
                            style={{ color: DIRECTION_COLOR[c.direction] ?? '#8A92A6' }} />
                          <span className="text-text-primary text-sm">{c.metric}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs" style={{ color: DIRECTION_COLOR[c.direction] ?? '#8A92A6' }}>
                            {c.direction === 'increase' ? '↑' : c.direction === 'decrease' ? '↓' : '→'} {c.magnitude}
                          </span>
                          <span className="text-text-secondary text-xs">{c.confidence} confidence</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Caveats */}
              {result.caveats?.length > 0 && (
                <div className="p-4 bg-warn/10 border border-warn/20 rounded">
                  <div className="text-xs font-mono text-warn uppercase mb-2">Caveats</div>
                  <ul className="space-y-1">
                    {result.caveats.map((c, i) => (
                      <li key={i} className="text-text-secondary text-xs">• {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="safety-footer text-center">
                {result.disclaimer ?? 'Projections are illustrative, not medical advice. Consult a physician before making health changes.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  )
}
