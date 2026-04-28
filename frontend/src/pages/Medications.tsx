import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { recordsApi } from '../lib/api'
import { cn } from '../lib/utils'
import { Pill, Plus, Check, X, Clock } from 'lucide-react'
import type { Medication } from '../lib/types'

function MedCard({ med }: { med: Medication }) {
  const qc = useQueryClient()
  const logDose = useMutation({
    mutationFn: () => recordsApi.medications.logDose(med.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['medications'] }),
  })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 border border-border-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Pill size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="text-text-primary font-semibold text-sm">{med.name}</h3>
            <div className="text-text-secondary text-xs mt-0.5 space-y-0.5">
              {med.dose && <div>{med.dose} {med.unit} · {med.frequency}</div>}
              {med.prescribed_by && <div className="text-text-secondary">Dr. {med.prescribed_by}</div>}
              {med.start_date && (
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  Since {med.start_date}
                  {med.end_date && ` → ${med.end_date}`}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => logDose.mutate()}
          disabled={logDose.isPending}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs transition-colors shrink-0',
            logDose.isSuccess
              ? 'bg-success/10 border-success/30 text-success'
              : 'border-border-subtle text-text-secondary hover:border-accent/40 hover:text-accent'
          )}
        >
          {logDose.isSuccess ? <Check size={12} /> : <Check size={12} />}
          {logDose.isPending ? 'Logging…' : logDose.isSuccess ? 'Logged!' : 'Log Dose'}
        </button>
      </div>

      {med.notes && (
        <p className="text-text-secondary text-xs mt-2 pt-2 border-t border-border-subtle italic">
          {med.notes}
        </p>
      )}
    </motion.div>
  )
}

export function Medications() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', dose: '', unit: 'mg', frequency: 'Once daily', prescribed_by: '', notes: ''
  })

  const { data: meds, isLoading } = useQuery({
    queryKey: ['medications'],
    queryFn: () => recordsApi.medications.list().then(r => r.data as Medication[]),
  })

  const create = useMutation({
    mutationFn: () => recordsApi.medications.create({
      ...form,
      dose: form.dose ? parseFloat(form.dose) : null,
      start_date: new Date().toISOString().slice(0, 10),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] })
      setShowForm(false)
      setForm({ name: '', dose: '', unit: 'mg', frequency: 'Once daily', prescribed_by: '', notes: '' })
    },
  })

  return (
    <Shell title="Medications">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            {meds?.length ?? 0} medication{meds?.length !== 1 ? 's' : ''} tracked
          </p>
          <button
            onClick={() => setShowForm(s => !s)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={14} />
            Add Medication
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-text-primary font-medium text-sm">Add Medication</h3>
                  <button onClick={() => setShowForm(false)}>
                    <X size={14} className="text-text-secondary" />
                  </button>
                </div>
                {[
                  { key: 'name', placeholder: 'Medication name (e.g. Metformin)' },
                  { key: 'dose', placeholder: 'Dose (e.g. 500)' },
                  { key: 'unit', placeholder: 'Unit (mg, mcg, IU…)' },
                  { key: 'frequency', placeholder: 'Frequency (Once daily, Twice daily…)' },
                  { key: 'prescribed_by', placeholder: 'Prescribed by (doctor name)' },
                  { key: 'notes', placeholder: 'Notes (optional)' },
                ].map(({ key, placeholder }) => (
                  <input
                    key={key}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                  />
                ))}
                <button
                  onClick={() => create.mutate()}
                  disabled={!form.name || create.isPending}
                  className="btn-primary w-full"
                >
                  {create.isPending ? 'Saving…' : 'Add Medication'}
                </button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Shimmer key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : meds?.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <Pill size={36} className="mx-auto mb-3" />
            <p className="text-sm">No medications tracked yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {meds?.map(m => <MedCard key={m.id} med={m} />)}
          </div>
        )}

        <p className="safety-footer text-center">
          Always follow your physician's instructions. Never adjust medications without medical supervision.
        </p>
      </div>
    </Shell>
  )
}
