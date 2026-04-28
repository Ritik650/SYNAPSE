import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { intelligenceApi } from '../lib/api'
import { severityColor, severityBg, cn } from '../lib/utils'
import {
  Bell, BellOff, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, RefreshCw, Shield,
} from 'lucide-react'
import type { Whisper } from '../lib/types'

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  info:   Shield,
  watch:  Bell,
  act:    AlertTriangle,
  urgent: AlertTriangle,
}

function EvidenceRow({ metric, observed, baseline, z }: { metric: string; observed: number; baseline: number; z: number }) {
  const direction = z > 0 ? '+' : ''
  const isSignificant = Math.abs(z) >= 1.5
  return (
    <div className={cn(
      'flex items-center justify-between py-1.5 px-2 rounded text-xs',
      isSignificant ? 'bg-bg-elevated' : ''
    )}>
      <span className="text-text-secondary font-mono">{metric}</span>
      <div className="flex items-center gap-3">
        <span className="text-text-primary font-mono">{observed?.toFixed(1)}</span>
        <span className="text-text-secondary">vs {baseline?.toFixed(1)}</span>
        <span className={cn(
          'font-mono',
          Math.abs(z) >= 2 ? 'text-danger' : Math.abs(z) >= 1.5 ? 'text-warn' : 'text-text-secondary'
        )}>
          z={direction}{z?.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

function WhisperCard({ whisper }: { whisper: Whisper }) {
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()

  const feedback = useMutation({
    mutationFn: ({ helpful, action }: { helpful: boolean; action?: string }) =>
      intelligenceApi.whisperFeedback(whisper.id, helpful, action).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whispers'] }),
  })

  const IconComp = SEVERITY_ICON[whisper.severity] ?? AlertTriangle
  const expiresIn = whisper.expires_at
    ? formatDistanceToNow(new Date(whisper.expires_at), { addSuffix: true })
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('border rounded-lg overflow-hidden', severityBg(whisper.severity))}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 shrink-0', severityColor(whisper.severity))}>
            <IconComp size={16} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={cn('text-xs font-mono uppercase tracking-wider', severityColor(whisper.severity))}>
                {whisper.severity}
              </span>
              <span className="text-text-secondary text-xs">·</span>
              <span className="text-text-secondary text-xs font-mono">
                {Math.round(whisper.confidence * 100)}% confidence
              </span>
            </div>
            <h3 className="text-text-primary font-semibold text-sm">{whisper.title}</h3>
            <p className="text-text-secondary text-xs mt-1 leading-relaxed">{whisper.narrative}</p>
          </div>
          <div className="shrink-0 text-right">
            {expiresIn && (
              <div className="text-text-secondary text-xs">expires {expiresIn}</div>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-text-secondary hover:text-text-primary mt-1 block ml-auto"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-border-subtle"
          >
            <div className="p-4 space-y-4">
              {/* Evidence */}
              {whisper.evidence?.length > 0 && (
                <div>
                  <div className="text-xs font-mono text-text-secondary uppercase mb-2">
                    Evidence
                  </div>
                  <div className="space-y-0.5">
                    {whisper.evidence.map((ev, i) => (
                      <EvidenceRow key={i} {...ev} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended actions */}
              {whisper.recommended_actions?.length > 0 && (
                <div>
                  <div className="text-xs font-mono text-text-secondary uppercase mb-2">
                    Recommended Actions
                  </div>
                  <ul className="space-y-1">
                    {whisper.recommended_actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-text-primary">
                        <CheckCircle size={11} className="text-success mt-0.5 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feedback */}
              {whisper.helpful === null || whisper.helpful === undefined ? (
                <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
                  <span className="text-text-secondary text-xs">Was this helpful?</span>
                  <button
                    onClick={() => feedback.mutate({ helpful: true })}
                    disabled={feedback.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-success/30 text-success text-xs hover:bg-success/10 transition-colors"
                  >
                    <ThumbsUp size={12} /> Yes
                  </button>
                  <button
                    onClick={() => feedback.mutate({ helpful: false })}
                    disabled={feedback.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-danger/30 text-danger text-xs hover:bg-danger/10 transition-colors"
                  >
                    <ThumbsDown size={12} /> No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                  {whisper.helpful ? (
                    <ThumbsUp size={12} className="text-success" />
                  ) : (
                    <ThumbsDown size={12} className="text-danger" />
                  )}
                  <span className="text-text-secondary text-xs">
                    Feedback recorded — thank you
                  </span>
                </div>
              )}

              <p className="safety-footer">
                Whispers are predictive signals, not medical diagnoses. Consult a licensed clinician.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function Whispers() {
  const qc = useQueryClient()

  const { data: whispers, isLoading } = useQuery({
    queryKey: ['whispers'],
    queryFn: () => intelligenceApi.whispers().then(r => r.data as Whisper[]),
  })

  const generate = useMutation({
    mutationFn: () =>
      fetch('/api/v1/whispers/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('synapse_token')}`,
        },
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whispers'] }),
  })

  const active = (whispers ?? []).filter(w => w.is_active)
  const dismissed = (whispers ?? []).filter(w => !w.is_active)

  return (
    <Shell title="Whispers">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-sm">
              Predictive early-warning signals based on multi-metric deviation analysis.
            </p>
          </div>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className={cn('btn-primary flex items-center gap-2',
              generate.isPending && 'opacity-70 cursor-not-allowed')}
          >
            <RefreshCw size={14} className={generate.isPending ? 'animate-spin' : ''} />
            {generate.isPending ? 'Analysing…' : 'Generate Whisper'}
          </button>
        </div>

        {/* Active whispers */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <Card key={i} className="p-4">
                <Shimmer className="h-4 w-32 mb-2" />
                <Shimmer className="h-5 w-3/4 mb-1" />
                <Shimmer className="h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : active.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <BellOff size={36} className="text-success mx-auto mb-3" />
            <h3 className="text-text-primary font-semibold mb-2">All clear</h3>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-4">
              No active predictive alerts. Your metrics look stable relative to your 30-day baseline.
            </p>
            <p className="text-text-secondary text-xs">
              Click "Generate Whisper" to run a fresh analysis.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-text-secondary">
              {active.length} active alert{active.length !== 1 ? 's' : ''} · click to expand
            </div>
            {active
              .sort((a, b) => {
                const order = { urgent: 0, act: 1, watch: 2, info: 3 }
                return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
              })
              .map(w => <WhisperCard key={w.id} whisper={w} />)}
          </div>
        )}

        {/* Dismissed */}
        {dismissed.length > 0 && (
          <div>
            <div className="text-xs font-mono text-text-secondary uppercase tracking-wider mb-3">
              Dismissed ({dismissed.length})
            </div>
            <div className="space-y-2 opacity-50">
              {dismissed.slice(0, 3).map(w => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 px-3 py-2 bg-bg-elevated rounded-lg text-xs text-text-secondary"
                >
                  <BellOff size={12} />
                  <span>{w.title}</span>
                  <span className="ml-auto font-mono">
                    {format(new Date(w.generated_at), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
