import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { intelligenceApi } from '../lib/api'
import { cn } from '../lib/utils'
import { RefreshCw, ArrowRight, Lightbulb, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import type { Pattern } from '../lib/types'

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="font-mono text-xs" style={{ color }}>{pct}%</span>
    </div>
  )
}

function PatternCard({ pattern }: { pattern: Pattern }) {
  const [expanded, setExpanded] = useState(false)
  let antecedent: { description?: string; metrics?: string[]; thresholds?: Record<string, number> } = {}
  let consequent: { description?: string; events?: string[] } = {}
  try {
    if (pattern.antecedent_json) antecedent = typeof pattern.antecedent_json === 'string'
      ? JSON.parse(pattern.antecedent_json) : pattern.antecedent_json
    if (pattern.consequent_json) consequent = typeof pattern.consequent_json === 'string'
      ? JSON.parse(pattern.consequent_json) : pattern.consequent_json
  } catch {}

  const lagHours = pattern.lag_hours
  const lagLabel = lagHours
    ? lagHours >= 24 ? `${Math.round(lagHours / 24)}d lag` : `${Math.round(lagHours)}h lag`
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card border border-border-subtle overflow-hidden"
    >
      {/* Header */}
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp size={14} className="text-accent shrink-0" />
              <h3 className="text-text-primary font-semibold text-sm">{pattern.title}</h3>
            </div>
            <p className="text-text-secondary text-xs leading-relaxed">
              {pattern.description}
            </p>
          </div>
          <div className="shrink-0 text-right space-y-1">
            <ConfidenceBadge value={pattern.confidence} />
            <div className="text-text-secondary text-xs">
              {pattern.occurrences} observations
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3">
          {lagLabel && (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <Clock size={11} />
              {lagLabel}
            </div>
          )}
          <div className={cn(
            'text-xs font-mono px-2 py-0.5 rounded-full',
            pattern.status === 'active'
              ? 'bg-success/10 text-success'
              : 'bg-text-secondary/10 text-text-secondary'
          )}>
            {pattern.status}
          </div>
          {pattern.discovered_at && (
            <div className="text-xs text-text-secondary ml-auto">
              Discovered {format(new Date(pattern.discovered_at), 'MMM d')}
            </div>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border-subtle"
          >
            <div className="p-5 space-y-4">
              {/* Antecedent → Consequent flow */}
              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 bg-bg-elevated rounded-lg">
                  <div className="text-xs font-mono text-warn uppercase mb-1">When</div>
                  <p className="text-text-primary text-sm">
                    {antecedent.description ?? 'Antecedent condition'}
                  </p>
                  {antecedent.metrics?.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {antecedent.metrics.map(m => (
                        <span key={m} className="text-xs bg-warn/10 text-warn px-2 py-0.5 rounded-full">
                          {m}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <ArrowRight size={16} className="text-text-secondary shrink-0" />
                <div className="flex-1 p-3 bg-bg-elevated rounded-lg">
                  <div className="text-xs font-mono text-danger uppercase mb-1">Then</div>
                  <p className="text-text-primary text-sm">
                    {consequent.description ?? 'Consequent outcome'}
                  </p>
                  {consequent.events?.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {consequent.events.map(e => (
                        <span key={e} className="text-xs bg-danger/10 text-danger px-2 py-0.5 rounded-full">
                          {e}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Intervention */}
              {pattern.suggested_intervention && (
                <div className="flex items-start gap-2 p-3 bg-success/5 border border-success/20 rounded-lg">
                  <Lightbulb size={14} className="text-success shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-mono text-success uppercase mb-0.5">
                      Suggested Intervention
                    </div>
                    <p className="text-text-primary text-sm">{pattern.suggested_intervention}</p>
                  </div>
                </div>
              )}

              <p className="safety-footer">
                Patterns are statistical associations, not medical diagnoses. Consult a clinician.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function Patterns() {
  const qc = useQueryClient()

  const { data: patterns, isLoading } = useQuery({
    queryKey: ['patterns'],
    queryFn: () => intelligenceApi.patterns().then(r => r.data as Pattern[]),
  })

  const refresh = useMutation({
    mutationFn: () => intelligenceApi.refreshPatterns().then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  })

  const active = (patterns ?? []).filter(p => p.status !== 'dismissed')

  return (
    <Shell title="Pattern Discovery">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-sm">
              AI-discovered causal relationships from your 90-day health history.
            </p>
          </div>
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className={cn(
              'btn-primary flex items-center gap-2',
              refresh.isPending && 'opacity-70 cursor-not-allowed'
            )}
          >
            <RefreshCw size={14} className={refresh.isPending ? 'animate-spin' : ''} />
            {refresh.isPending ? 'Analysing…' : 'Refresh Patterns'}
          </button>
        </div>

        {/* Status banner when refreshing */}
        <AnimatePresence>
          {refresh.isPending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-accent/5 border border-accent/20 rounded-lg p-4 text-sm text-accent-soft"
            >
              Sending 90-day timeline to Claude for pattern analysis… this takes 10–20 seconds.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pattern list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-5">
                <Shimmer className="h-5 w-2/3 mb-2" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-3/4 mt-1" />
              </Card>
            ))}
          </div>
        ) : active.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <AlertCircle size={36} className="text-text-secondary mx-auto mb-3" />
            <h3 className="text-text-primary font-medium mb-2">No patterns discovered yet</h3>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-6">
              Click "Refresh Patterns" to run Claude's causal analysis on your health history.
              Requires data from at least 14 days.
            </p>
            <button
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="btn-primary"
            >
              Run Pattern Analysis
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-text-secondary">
              {active.length} pattern{active.length !== 1 ? 's' : ''} found · click to expand
            </div>
            {active.map(p => <PatternCard key={p.id} pattern={p} />)}
          </div>
        )}
      </div>
    </Shell>
  )
}
