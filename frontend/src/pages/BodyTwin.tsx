import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Shell } from '../components/layout/Shell'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { intelligenceApi } from '../lib/api'
import { scoreColor, cn } from '../lib/utils'
import type { BodyTwinState, BodySystem } from '../lib/types'

const SYSTEM_META: Record<string, { emoji: string; keyMetricLabels: Record<string, string> }> = {
  cardio:          { emoji: '❤️', keyMetricLabels: { rhr: 'RHR', hrv: 'HRV' } },
  sleep:           { emoji: '💤', keyMetricLabels: { sleep_h: 'Sleep', sleep_efficiency: 'Efficiency' } },
  metabolic:       { emoji: '⚡', keyMetricLabels: { glucose: 'Glucose' } },
  mental:          { emoji: '🧠', keyMetricLabels: { mood: 'Mood', stress: 'Stress' } },
  musculoskeletal: { emoji: '🏃', keyMetricLabels: { steps: 'Steps' } },
  immune:          { emoji: '🛡️', keyMetricLabels: { spo2: 'SpO2' } },
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = size / 2 - 6
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = scoreColor(score)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#2A2E3B" strokeWidth="5"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="font-mono text-sm font-semibold"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {Math.round(score)}
        </motion.span>
      </div>
    </div>
  )
}

function SystemCard({ systemKey, system }: { systemKey: string; system: BodySystem }) {
  const meta = SYSTEM_META[systemKey]
  const color = scoreColor(system.score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Object.keys(SYSTEM_META).indexOf(systemKey) * 0.08 }}
      className="card p-5 flex flex-col gap-4"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl mb-1">{meta?.emoji}</div>
          <div className="text-text-primary font-semibold text-sm">{system.label}</div>
        </div>
        <ScoreRing score={system.score} />
      </div>

      {/* Score bar */}
      <div>
        <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${system.score}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(system.metrics).map(([key, val]) => {
          if (val === null || val === undefined) return null
          const label = meta?.keyMetricLabels[key] ?? key
          const formatted = typeof val === 'number' ? val.toFixed(key === 'steps' ? 0 : 1) : val
          return (
            <div key={key} className="bg-bg-elevated rounded px-2 py-1.5 text-center">
              <div className="font-mono text-sm text-text-primary">{formatted}</div>
              <div className="text-text-secondary text-xs">{label}</div>
            </div>
          )
        })}
      </div>

      {/* One-liner */}
      {system.one_liner && (
        <p className="text-text-secondary text-xs leading-relaxed italic border-t border-border-subtle pt-3">
          "{system.one_liner}"
        </p>
      )}
    </motion.div>
  )
}

function OverallBar({ systems }: { systems: BodyTwinState['systems'] }) {
  const scores = Object.values(systems).map(s => s.score)
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const color = scoreColor(avg)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-text-secondary text-xs font-mono uppercase tracking-wider mb-1">
            Body Twin State
          </div>
          <div className="text-text-primary font-semibold text-lg">Overall Readiness</div>
        </div>
        <div className="text-right">
          <motion.div
            className="font-mono text-4xl font-bold"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {avg}
          </motion.div>
          <div className="text-text-secondary text-xs">/100</div>
        </div>
      </div>

      <div className="h-3 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${avg}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-text-secondary text-xs">0</span>
        <div className="flex gap-4">
          {Object.entries(systems).map(([key, sys]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: scoreColor(sys.score) }} />
              <span className="text-text-secondary text-xs">{sys.label.split(' ')[0]}: {Math.round(sys.score)}</span>
            </div>
          ))}
        </div>
        <span className="text-text-secondary text-xs">100</span>
      </div>
    </div>
  )
}

export function BodyTwin() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['body-twin'],
    queryFn: () => intelligenceApi.bodyTwin().then(r => r.data as BodyTwinState),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Shell title="Body Twin">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            A real-time model of your body systems powered by 7-day rolling averages.
          </p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={cn(
              'text-xs text-accent-soft hover:text-accent flex items-center gap-1.5 px-3 py-1.5 rounded border border-accent/20 hover:border-accent/40 transition-colors',
              isFetching && 'opacity-60 cursor-not-allowed'
            )}
          >
            <svg
              className={cn('w-3 h-3', isFetching && 'animate-spin')}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Shimmer className="h-32 w-full rounded-lg" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Shimmer key={i} className="h-52 rounded-lg" />
              ))}
            </div>
          </div>
        ) : data?.systems ? (
          <>
            <OverallBar systems={data.systems} />

            <div className="grid grid-cols-3 gap-4">
              {Object.entries(data.systems).map(([key, system]) => (
                <SystemCard key={key} systemKey={key} system={system} />
              ))}
            </div>

            <p className="safety-footer text-center">
              Body Twin is a statistical model for wellness tracking. Not a diagnostic tool.
              Always consult a licensed clinician for medical decisions.
            </p>
          </>
        ) : (
          <div className="text-center py-16 text-text-secondary">
            <p className="text-sm mb-4">
              Body Twin requires health data. Load the demo dataset first.
            </p>
            <p className="text-xs">
              Go to Dashboard → Load Demo Data, then return here.
            </p>
          </div>
        )}
      </div>
    </Shell>
  )
}
