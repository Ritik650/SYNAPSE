import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { recordsApi, intelligenceApi } from '../lib/api'
import { cn } from '../lib/utils'
import {
  Plus, CheckCircle, X, AlertTriangle, Activity, Clock,
} from 'lucide-react'
import type { Symptom } from '../lib/types'

const SEVERITY_COLORS = ['', '#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444',
  '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D', '#6B1010']

function SeverityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="w-1.5 h-3 rounded-sm"
            style={{ background: i < value ? SEVERITY_COLORS[value] : '#2A2E3B' }}
          />
        ))}
      </div>
      <span className="font-mono text-xs" style={{ color: SEVERITY_COLORS[value] }}>
        {value}/10
      </span>
    </div>
  )
}

function SymptomCard({ sym, onResolve }: { sym: Symptom; onResolve: (id: string) => void }) {
  const isActive = !sym.resolved_at
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'card p-4 border',
        isActive ? 'border-warn/20' : 'border-border-subtle opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'w-2 h-2 rounded-full shrink-0',
              isActive ? 'bg-warn' : 'bg-success'
            )} />
            <h3 className="text-text-primary font-medium text-sm">{sym.name}</h3>
            {sym.body_region && (
              <span className="text-text-secondary text-xs px-2 py-0.5 bg-bg-elevated rounded-full">
                {sym.body_region}
              </span>
            )}
          </div>
          <SeverityBar value={sym.severity} />
          <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Since {format(new Date(sym.started_at), 'MMM d, yyyy')}
            </span>
            {sym.resolved_at && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle size={11} />
                Resolved {format(new Date(sym.resolved_at), 'MMM d')}
              </span>
            )}
          </div>
          {sym.notes && (
            <p className="text-text-secondary text-xs mt-1 italic">{sym.notes}</p>
          )}
        </div>
        {isActive && (
          <button
            onClick={() => onResolve(sym.id)}
            className="text-success hover:text-success/80 text-xs border border-success/20 hover:border-success/40 px-2 py-1 rounded transition-colors"
          >
            Resolve
          </button>
        )}
      </div>
    </motion.div>
  )
}

interface TriageResult {
  red_flag_detected: boolean
  likely_categories?: Array<{ category: string; notes: string }>
  when_to_seek_care?: string
  monitor_at_home?: string[]
  red_flags_to_watch?: string[]
  disclaimer?: string
  message?: string
}

export function Symptoms() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [triageText, setTriageText] = useState('')
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null)
  const [triaging, setTriaging] = useState(false)
  const [form, setForm] = useState({ name: '', severity: 5, body_region: '', notes: '' })

  const { data: symptoms, isLoading } = useQuery({
    queryKey: ['symptoms'],
    queryFn: () => recordsApi.symptoms.list().then(r => r.data as Symptom[]),
  })

  const resolve = useMutation({
    mutationFn: (id: string) => recordsApi.symptoms.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['symptoms'] }),
  })

  const create = useMutation({
    mutationFn: () => recordsApi.symptoms.create({
      ...form,
      started_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['symptoms'] })
      setShowForm(false)
      setForm({ name: '', severity: 5, body_region: '', notes: '' })
    },
  })

  async function runTriage() {
    if (!triageText.trim()) return
    setTriaging(true)
    try {
      const r = await intelligenceApi.triage(triageText)
      setTriageResult(r.data as TriageResult)
    } finally {
      setTriaging(false)
    }
  }

  const active = (symptoms ?? []).filter(s => !s.resolved_at)
  const resolved = (symptoms ?? []).filter(s => s.resolved_at)

  return (
    <Shell title="Symptoms">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            {active.length} active · {resolved.length} resolved
          </p>
          <button
            onClick={() => setShowForm(s => !s)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={14} />
            Log Symptom
          </button>
        </div>

        {/* Log form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-text-primary font-medium text-sm">Log Symptom</h3>
                  <button onClick={() => setShowForm(false)}>
                    <X size={14} className="text-text-secondary" />
                  </button>
                </div>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Symptom (e.g. headache, fatigue)"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                />
                <div className="flex items-center gap-3">
                  <label className="text-text-secondary text-xs">Severity: {form.severity}/10</label>
                  <input
                    type="range" min={1} max={10} value={form.severity}
                    onChange={e => setForm(f => ({ ...f, severity: +e.target.value }))}
                    className="flex-1"
                  />
                </div>
                <input
                  value={form.body_region}
                  onChange={e => setForm(f => ({ ...f, body_region: e.target.value }))}
                  placeholder="Body region (optional)"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                />
                <input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                />
                <button
                  onClick={() => create.mutate()}
                  disabled={!form.name || create.isPending}
                  className="btn-primary w-full"
                >
                  {create.isPending ? 'Saving…' : 'Save Symptom'}
                </button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Claude Triage */}
        <Card className="p-4">
          <h3 className="text-text-primary font-medium text-sm mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-warn" />
            Symptom Triage Assistant
          </h3>
          <div className="flex gap-2">
            <input
              value={triageText}
              onChange={e => setTriageText(e.target.value)}
              placeholder="Describe your symptoms in plain language..."
              className="flex-1 bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
            />
            <button
              onClick={runTriage}
              disabled={triaging || !triageText.trim()}
              className="btn-primary px-4 whitespace-nowrap"
            >
              {triaging ? 'Analysing…' : 'Triage'}
            </button>
          </div>

          <AnimatePresence>
            {triageResult && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'mt-4 p-4 rounded-lg border text-sm',
                  triageResult.red_flag_detected
                    ? 'bg-danger/10 border-danger/30'
                    : 'bg-bg-elevated border-border-subtle'
                )}
              >
                {triageResult.red_flag_detected ? (
                  <div>
                    <p className="text-danger font-semibold mb-2">
                      Emergency Response Required
                    </p>
                    <p className="text-text-primary">{triageResult.message}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {triageResult.likely_categories?.map((c, i) => (
                      <div key={i}>
                        <div className="font-medium text-text-primary">{c.category}</div>
                        <div className="text-text-secondary text-xs">{c.notes}</div>
                      </div>
                    ))}
                    {triageResult.when_to_seek_care && (
                      <div>
                        <div className="text-xs font-mono text-warn uppercase mb-1">When to Seek Care</div>
                        <p className="text-text-secondary text-xs">{triageResult.when_to_seek_care}</p>
                      </div>
                    )}
                    {triageResult.monitor_at_home?.length ? (
                      <div>
                        <div className="text-xs font-mono text-accent-soft uppercase mb-1">Monitor at Home</div>
                        <ul className="text-text-secondary text-xs space-y-0.5">
                          {triageResult.monitor_at_home.map((m, i) => <li key={i}>• {m}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    <p className="text-text-secondary text-xs italic border-t border-border-subtle pt-2">
                      {triageResult.disclaimer}
                    </p>
                  </div>
                )}
                <button onClick={() => setTriageResult(null)} className="mt-2 text-xs text-text-secondary hover:text-text-primary">
                  Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Active symptoms */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Shimmer key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div>
                <div className="text-xs font-mono text-text-secondary uppercase tracking-wider mb-3">
                  Active ({active.length})
                </div>
                <div className="space-y-3">
                  {active.map(s => (
                    <SymptomCard key={s.id} sym={s} onResolve={id => resolve.mutate(id)} />
                  ))}
                </div>
              </div>
            )}
            {resolved.length > 0 && (
              <div>
                <div className="text-xs font-mono text-text-secondary uppercase tracking-wider mb-3">
                  Resolved ({resolved.length})
                </div>
                <div className="space-y-2">
                  {resolved.map(s => (
                    <SymptomCard key={s.id} sym={s} onResolve={() => {}} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  )
}
