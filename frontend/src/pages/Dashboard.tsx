import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts'
import { format } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { intelligenceApi, ingestApi } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { scoreColor, cn } from '../lib/utils'
import { AlertTriangle, CheckCircle, RefreshCw, Database, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { HealthScore, Whisper, DailyBrief } from '../lib/types'

interface ScoreSnapshot {
  date: string
  overall: number
  sleep_score: number
  recovery_score: number
  readiness: number
}

function HealthScoreRing({ score, label }: { score: number; label: string }) {
  const r = 54
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#2A2E3B" strokeWidth="10" />
          <motion.circle
            cx="64" cy="64" r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="font-mono text-3xl font-medium"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-text-secondary text-xs">/100</span>
        </div>
      </div>
      <span className="text-text-secondary text-sm">{label}</span>
    </div>
  )
}

function ScoreBreakdown({ score }: { score: HealthScore }) {
  const items = [
    { label: 'Sleep', value: score.sleep_score },
    { label: 'Recovery', value: score.recovery_score },
    { label: 'Activity', value: score.activity_score },
    { label: 'Mind', value: score.mind_score },
    { label: 'Nutrition', value: score.nutrition_score },
    { label: 'Readiness', value: score.readiness },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {items.map(({ label, value }) => (
        <div key={label} className="text-center">
          <div className="text-xs text-text-secondary mb-1">{label}</div>
          <div className="font-mono text-sm font-medium" style={{ color: scoreColor(value) }}>
            {Math.round(value)}
          </div>
        </div>
      ))}
    </div>
  )
}

function WhisperCard({ whisper }: { whisper: Whisper }) {
  const severityStyles = {
    info: 'border-accent/30 bg-accent/5',
    watch: 'border-warn/30 bg-warn/5',
    act: 'border-orange-400/30 bg-orange-400/5',
    urgent: 'border-danger/30 bg-danger/5',
  }

  const severityTextColor = {
    info: 'text-accent-soft',
    watch: 'text-warn',
    act: 'text-orange-400',
    urgent: 'text-danger',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('border rounded-lg p-4', severityStyles[whisper.severity])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className={severityTextColor[whisper.severity]} />
            <span className={cn('text-xs font-mono uppercase', severityTextColor[whisper.severity])}>
              {whisper.severity}
            </span>
          </div>
          <h4 className="text-text-primary font-medium text-sm">{whisper.title}</h4>
          <p className="text-text-secondary text-xs mt-1 line-clamp-2">{whisper.narrative}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xs text-text-secondary">
            {Math.round(whisper.confidence * 100)}% conf.
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const ScoreHistoryTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-xs shadow">
      <div className="text-text-secondary mb-1">{label}</div>
      <div className="font-mono" style={{ color: scoreColor(payload[0]?.value) }}>
        {payload[0]?.value?.toFixed(1)}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { user } = useAuthStore()
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)

  const { data: score, isLoading: scoreLoading } = useQuery({
    queryKey: ['score-today'],
    queryFn: () => intelligenceApi.score().then((r) => r.data as HealthScore),
    retry: 1,
  })

  const { data: scoreHistory } = useQuery({
    queryKey: ['score-history-30'],
    queryFn: () => intelligenceApi.scoreHistory(30).then((r) => r.data as ScoreSnapshot[]),
    retry: 1,
  })

  const { data: brief, isLoading: briefLoading } = useQuery({
    queryKey: ['brief-today'],
    queryFn: () => intelligenceApi.brief().then((r) => r.data as DailyBrief),
    retry: 1,
  })

  const { data: whispers } = useQuery({
    queryKey: ['whispers'],
    queryFn: () => intelligenceApi.whispers().then((r) => r.data as Whisper[]),
    retry: 1,
  })

  async function handleSeedDemo() {
    setSeeding(true)
    try {
      await ingestApi.seedDemo()
      setSeeded(true)
      window.location.reload()
    } finally {
      setSeeding(false)
    }
  }

  const activeWhispers = whispers?.filter((w) => w.is_active) ?? []

  return (
    <Shell title="Dashboard">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Welcome banner with seed demo option */}
        {!seeded && !score && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 border-accent/20"
          >
            <h2 className="text-text-primary font-semibold text-lg mb-2">
              Welcome to Synapse{user ? `, ${user.name.split(' ')[0]}` : ''}
            </h2>
            <p className="text-text-secondary text-sm mb-4">
              Connect your health data or load the demo dataset to see Synapse in action.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSeedDemo}
                disabled={seeding}
                className="btn-primary flex items-center gap-2"
              >
                {seeding ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Loading 120 days of data...
                  </>
                ) : (
                  <>
                    <Database size={14} />
                    Load Demo Data
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Daily Brief — full width */}
          <div className="col-span-3">
            <Card className="p-6">
              <CardHeader>
                <CardTitle className="text-base">Daily Brief</CardTitle>
                <span className="text-text-secondary text-xs">AI-generated · Updated today</span>
              </CardHeader>
              {briefLoading ? (
                <div className="space-y-2">
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-4 w-4/5" />
                  <Shimmer className="h-4 w-3/5" />
                </div>
              ) : brief ? (
                <div className="space-y-3">
                  <p className="narrative-text text-sm leading-relaxed">{brief.narrative}</p>
                  {brief.recommendation && (
                    <div className="flex items-start gap-2 pt-3 border-t border-border-subtle">
                      <CheckCircle size={14} className="text-success mt-0.5 shrink-0" />
                      <p className="text-success text-sm font-medium">{brief.recommendation}</p>
                    </div>
                  )}
                  <p className="safety-footer">
                    Synapse is informational only and is not a medical device. Always consult a licensed clinician for medical decisions.
                  </p>
                </div>
              ) : (
                <p className="text-text-secondary text-sm">
                  Brief will appear after data is loaded. Click "Load Demo Data" above to begin.
                </p>
              )}
            </Card>
          </div>

          {/* Health Score */}
          <div className="col-span-1">
            <Card className="p-6 h-full">
              <CardTitle className="text-base mb-4">Health Score</CardTitle>
              {scoreLoading ? (
                <div className="flex justify-center">
                  <Shimmer className="w-32 h-32 rounded-full" />
                </div>
              ) : score ? (
                <div>
                  <HealthScoreRing score={Math.round(score.overall)} label="Overall" />
                  <ScoreBreakdown score={score} />
                  {/* 30-day trend sparkline */}
                  {scoreHistory && scoreHistory.length > 2 && (
                    <div className="mt-4 pt-3 border-t border-border-subtle">
                      <div className="flex items-center gap-1 text-xs text-text-secondary mb-2">
                        <TrendingUp size={11} />
                        30-day trend
                      </div>
                      <ResponsiveContainer width="100%" height={56}>
                        <AreaChart
                          data={[...scoreHistory].reverse()}
                          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
                        >
                          <defs>
                            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" hide />
                          <Tooltip content={<ScoreHistoryTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="overall"
                            stroke="#3B82F6"
                            strokeWidth={1.5}
                            fill="url(#scoreGrad)"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-text-secondary text-sm py-8">
                  No score data yet
                </div>
              )}
            </Card>
          </div>

          {/* Whispers */}
          <div className="col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">Active Whispers</CardTitle>
                <span className="text-text-secondary text-xs">{activeWhispers.length} active</span>
              </CardHeader>
              {activeWhispers.length > 0 ? (
                <div className="space-y-3">
                  {activeWhispers.slice(0, 3).map((w) => (
                    <WhisperCard key={w.id} whisper={w} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle size={28} className="text-success mb-2" />
                  <p className="text-text-primary text-sm font-medium">All clear</p>
                  <p className="text-text-secondary text-xs mt-1">
                    No predictive alerts today
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Shell>
  )
}
