import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { reportsApi } from '../lib/api'
import { Stethoscope, Download, ClipboardList, AlertCircle, ChevronRight } from 'lucide-react'

interface DoctorReport {
  executive_summary: string
  key_metrics: Array<{ name: string; value: string; trend: string; flag: string }>
  flagged_labs: Array<{ marker: string; value: string; reference: string; flag: string }>
  active_concerns: string[]
  top_5_questions: string[]
  medication_review: string
  suggested_tests: string[]
  _meta?: { visit_reason: string; visit_date: string; generated_at: string }
  disclaimer?: string
}

export function DoctorMode() {
  const [form, setForm] = useState({
    visit_reason: '',
    visit_date: format(new Date(), 'yyyy-MM-dd'),
    physician_name: '',
  })
  const [report, setReport] = useState<DoctorReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (!form.visit_reason) return
    setLoading(true)
    setError('')
    setReport(null)
    try {
      const r = await reportsApi.doctorPrep(form)
      setReport(r.data as DoctorReport)
    } catch {
      setError('Report generation failed. Ensure the backend is running with a valid ANTHROPIC_API_KEY.')
    } finally {
      setLoading(false)
    }
  }

  async function downloadPdf() {
    if (!report) return
    setDownloading(true)
    try {
      const blob = await reportsApi.doctorPrepPdf({ ...form, report })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `synapse_doctor_prep_${form.visit_date}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('PDF download failed.')
    } finally {
      setDownloading(false)
    }
  }

  const FLAG_COLOR: Record<string, string> = {
    high: '#EF4444', low: '#F59E0B', critical: '#DC2626', normal: '#22C55E',
  }

  return (
    <Shell title="Doctor Mode">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <p className="text-text-secondary text-sm">
          Generate a structured pre-visit report for your physician — your health story in clinical language.
        </p>

        {/* Form */}
        <Card className="p-5 space-y-4">
          <h3 className="text-text-primary font-semibold text-sm">Visit Details</h3>
          <div>
            <label className="text-text-secondary text-xs block mb-1">Reason for Visit *</label>
            <textarea
              rows={3}
              value={form.visit_reason}
              onChange={e => setForm(f => ({ ...f, visit_reason: e.target.value }))}
              placeholder="e.g. Annual check-up, fatigue evaluation, medication review…"
              className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text-secondary text-xs block mb-1">Visit Date</label>
              <input
                type="date"
                value={form.visit_date}
                onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))}
                className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-text-secondary text-xs block mb-1">Physician Name (optional)</label>
              <input
                value={form.physician_name}
                onChange={e => setForm(f => ({ ...f, physician_name: e.target.value }))}
                placeholder="Dr. Smith"
                className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <button
            onClick={generate}
            disabled={!form.visit_reason || loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <ClipboardList size={14} />
                </motion.div>
                Generating with Claude…
              </>
            ) : (
              <>
                <Stethoscope size={14} />
                Generate Doctor Brief
              </>
            )}
          </button>
        </Card>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/20 rounded text-danger text-sm">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Report */}
        <AnimatePresence>
          {report && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Header + download */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-text-primary font-semibold">Pre-Visit Health Brief</h3>
                  {report._meta && (
                    <p className="text-text-secondary text-xs mt-0.5">
                      For {report._meta.visit_date} · Generated {format(new Date(report._meta.generated_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                </div>
                <button
                  onClick={downloadPdf}
                  disabled={downloading}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download size={13} />
                  {downloading ? 'Generating PDF…' : 'Download PDF'}
                </button>
              </div>

              {/* Executive summary */}
              <Card className="p-5">
                <div className="text-xs font-mono text-accent-soft uppercase mb-2">Executive Summary</div>
                <p className="text-text-primary text-sm leading-relaxed">{report.executive_summary}</p>
              </Card>

              {/* Key metrics */}
              {report.key_metrics?.length > 0 && (
                <Card className="p-5">
                  <div className="text-xs font-mono text-accent-soft uppercase mb-3">Key Metrics</div>
                  <div className="space-y-2">
                    {report.key_metrics.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                        <span className="text-text-primary text-sm">{m.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-text-primary">{m.value}</span>
                          {m.trend && <span className="text-text-secondary text-xs">{m.trend}</span>}
                          {m.flag && m.flag !== 'normal' && (
                            <span className="text-xs px-1.5 py-0.5 rounded border"
                              style={{ color: FLAG_COLOR[m.flag] ?? '#8A92A6', borderColor: (FLAG_COLOR[m.flag] ?? '#8A92A6') + '40', background: (FLAG_COLOR[m.flag] ?? '#8A92A6') + '12' }}>
                              {m.flag}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Flagged labs */}
              {report.flagged_labs?.length > 0 && (
                <Card className="p-5">
                  <div className="text-xs font-mono text-danger uppercase mb-3">Flagged Labs</div>
                  <div className="space-y-2">
                    {report.flagged_labs.map((lab, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                        <span className="text-text-primary text-sm">{lab.marker}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-text-primary">{lab.value}</span>
                          <span className="text-text-secondary text-xs">ref: {lab.reference}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded border"
                            style={{ color: FLAG_COLOR[lab.flag] ?? '#8A92A6', borderColor: (FLAG_COLOR[lab.flag] ?? '#8A92A6') + '40', background: (FLAG_COLOR[lab.flag] ?? '#8A92A6') + '12' }}>
                            {lab.flag}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Top 5 questions */}
              {report.top_5_questions?.length > 0 && (
                <Card className="p-5">
                  <div className="text-xs font-mono text-accent-soft uppercase mb-3">Top Questions for Your Doctor</div>
                  <ol className="space-y-2">
                    {report.top_5_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                        <span className="font-mono text-accent-soft shrink-0">{i + 1}.</span>
                        {q}
                      </li>
                    ))}
                  </ol>
                </Card>
              )}

              {/* Active concerns */}
              {report.active_concerns?.length > 0 && (
                <Card className="p-5">
                  <div className="text-xs font-mono text-warn uppercase mb-3">Active Concerns</div>
                  <ul className="space-y-1">
                    {report.active_concerns.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-text-secondary text-sm">
                        <ChevronRight size={12} className="text-warn mt-0.5 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Medication review */}
              {report.medication_review && (
                <Card className="p-5">
                  <div className="text-xs font-mono text-accent-soft uppercase mb-2">Medication Review</div>
                  <p className="text-text-secondary text-sm leading-relaxed">{report.medication_review}</p>
                </Card>
              )}

              {/* Suggested tests */}
              {report.suggested_tests?.length > 0 && (
                <Card className="p-5">
                  <div className="text-xs font-mono text-accent-soft uppercase mb-3">Suggested Tests</div>
                  <ul className="space-y-1">
                    {report.suggested_tests.map((t, i) => (
                      <li key={i} className="text-text-secondary text-sm flex items-start gap-2">
                        <ChevronRight size={12} className="text-accent-soft mt-0.5 shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <p className="safety-footer text-center">
                {report.disclaimer ?? 'This brief is a decision-support tool. Clinical decisions rest with your licensed physician.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  )
}
