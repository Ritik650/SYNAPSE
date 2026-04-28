import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { recordsApi } from '../lib/api'
import { cn } from '../lib/utils'
import { FlaskConical, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { LabResult, LabValue } from '../lib/types'

const FLAG_STYLE: Record<string, string> = {
  high:     'text-danger bg-danger/10 border-danger/20',
  low:      'text-warn bg-warn/10 border-warn/20',
  critical: 'text-danger bg-danger/20 border-danger/40 font-bold',
  normal:   'text-success bg-success/10 border-success/20',
}

function LabValueRow({ v }: { v: LabValue }) {
  const isAbnormal = v.flag !== 'normal'
  return (
    <div className={cn(
      'flex items-center justify-between py-2 px-3 rounded text-xs',
      isAbnormal ? 'bg-bg-elevated' : ''
    )}>
      <div className="flex items-center gap-2">
        {isAbnormal ? (
          <AlertTriangle size={11} className="text-warn shrink-0" />
        ) : (
          <CheckCircle size={11} className="text-success shrink-0" />
        )}
        <span className="text-text-primary font-medium">{v.marker}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-text-primary">
          {v.value} {v.unit}
        </span>
        {v.ref_low !== null && v.ref_high !== null && (
          <span className="text-text-secondary">
            [{v.ref_low}–{v.ref_high}]
          </span>
        )}
        <span className={cn('px-1.5 py-0.5 rounded border text-xs', FLAG_STYLE[v.flag] ?? FLAG_STYLE.normal)}>
          {v.flag}
        </span>
      </div>
    </div>
  )
}

function LabCard({ lab }: { lab: LabResult }) {
  const [expanded, setExpanded] = useState(false)
  const flagCount = lab.values.filter(v => v.flag !== 'normal').length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card border border-border-subtle overflow-hidden"
    >
      <div
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical size={14} className="text-accent" />
              <h3 className="text-text-primary font-semibold text-sm">{lab.panel_name}</h3>
            </div>
            <div className="text-text-secondary text-xs">
              Drawn {format(new Date(lab.drawn_at), 'MMMM d, yyyy')}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {flagCount > 0 && (
              <span className="text-xs bg-danger/10 text-danger border border-danger/20 px-2 py-0.5 rounded-full">
                {flagCount} flagged
              </span>
            )}
            {expanded ? <ChevronUp size={14} className="text-text-secondary" /> : <ChevronDown size={14} className="text-text-secondary" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border-subtle"
          >
            <div className="p-4 space-y-4">
              {lab.claude_summary && (
                <div>
                  <div className="text-xs font-mono text-accent-soft uppercase mb-2">AI Summary</div>
                  <p className="narrative-text text-sm leading-relaxed">{lab.claude_summary}</p>
                </div>
              )}

              <div>
                <div className="text-xs font-mono text-text-secondary uppercase mb-2">Results</div>
                <div className="space-y-1">
                  {lab.values
                    .sort((a, b) => (a.flag === 'normal' ? 1 : -1) - (b.flag === 'normal' ? 1 : -1))
                    .map((v, i) => <LabValueRow key={i} v={v} />)}
                </div>
              </div>

              <p className="safety-footer">
                Lab results should be interpreted by a licensed physician in the context of your full medical history.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function Labs() {
  const { data: labs, isLoading } = useQuery({
    queryKey: ['labs'],
    queryFn: () => recordsApi.labs.list().then(r => r.data as LabResult[]),
  })

  return (
    <Shell title="Labs">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            {labs?.length ?? 0} lab report{labs?.length !== 1 ? 's' : ''} · click to expand
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-4">
                <Shimmer className="h-5 w-40 mb-2" />
                <Shimmer className="h-4 w-24" />
              </Card>
            ))}
          </div>
        ) : labs?.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <FlaskConical size={36} className="mx-auto mb-3 text-text-secondary" />
            <p className="text-sm">No lab results yet. Upload a PDF using the ingest endpoint.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {labs?.map(lab => <LabCard key={lab.id} lab={lab} />)}
          </div>
        )}
      </div>
    </Shell>
  )
}
