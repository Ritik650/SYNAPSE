import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { Shell } from '../components/layout/Shell'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { timelineApi, recordsApi } from '../lib/api'
import { Brain, Mic, Smile, Wind } from 'lucide-react'

interface VoiceNote {
  id: string
  ts: string
  transcript?: string
  sentiment?: string
  themes?: string[]
  summary?: string
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#22C55E',
  negative: '#EF4444',
  neutral: '#8A92A6',
  mixed: '#F59E0B',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-xs shadow">
      <div className="text-text-secondary mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="font-mono" style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(1)}/10
        </div>
      ))}
    </div>
  )
}

export function Mind() {
  const from = format(subDays(new Date(), 90), "yyyy-MM-dd'T'HH:mm:ssxxx")

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['timeline-mind'],
    queryFn: () =>
      timelineApi
        .get({ from, metrics: 'mood_self,stress_self' })
        .then(r => r.data as { tracks: Array<{ metric_type: string; data: Array<{ ts: string; value: number }> }> }),
  })

  const { data: voiceNotes, isLoading: notesLoading } = useQuery({
    queryKey: ['voice-notes'],
    queryFn: () => recordsApi.voiceNotes.list().then(r => r.data as VoiceNote[]),
  })

  const tracks = Object.fromEntries(
    (timeline?.tracks ?? []).map(t => [t.metric_type, t.data])
  )

  const moodData = (tracks.mood_self ?? []).map(d => ({
    day: d.ts.slice(0, 10),
    label: format(new Date(d.ts), 'MMM d'),
    mood: d.value,
  }))

  const stressData = (tracks.stress_self ?? []).map(d => ({
    day: d.ts.slice(0, 10),
    label: format(new Date(d.ts), 'MMM d'),
    stress: d.value,
  }))

  const merged: Record<string, { label: string; mood?: number; stress?: number }> = {}
  moodData.forEach(d => { merged[d.day] = { label: d.label, mood: d.mood } })
  stressData.forEach(d => { merged[d.day] = { ...merged[d.day], label: d.label, stress: d.stress } })
  const combinedData = Object.values(merged).sort((a, b) => a.label.localeCompare(b.label))

  const avgMood = moodData.length
    ? moodData.reduce((s, d) => s + d.mood, 0) / moodData.length
    : 0
  const avgStress = stressData.length
    ? stressData.reduce((s, d) => s + d.stress, 0) / stressData.length
    : 0

  const stats = [
    { label: 'Avg Mood', value: `${avgMood.toFixed(1)}/10`, icon: Smile, color: '#22C55E' },
    { label: 'Avg Stress', value: `${avgStress.toFixed(1)}/10`, icon: Wind, color: '#F59E0B' },
    { label: 'Voice Notes', value: (voiceNotes?.length ?? 0).toString(), icon: Mic, color: '#8B5CF6' },
    { label: 'Days tracked', value: moodData.length.toString(), icon: Brain, color: '#3B82F6' },
  ]

  return (
    <Shell title="Mind Lab">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color }} />
                <span className="text-text-secondary text-xs">{label}</span>
              </div>
              <div className="font-mono text-2xl font-semibold text-text-primary">{value}</div>
            </motion.div>
          ))}
        </div>

        {/* Mood + Stress chart */}
        <Card className="p-5">
          <CardHeader>
            <CardTitle className="text-sm">Mood &amp; Stress (90 days)</CardTitle>
            <span className="text-text-secondary text-xs">Mood↑ Stress↓ = better wellbeing</span>
          </CardHeader>
          {timelineLoading ? (
            <Shimmer className="h-48 w-full" />
          ) : combinedData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-text-secondary text-sm">
              No mind data — seed demo first
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={combinedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2E3B" />
                <XAxis dataKey="label" tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false}
                  axisLine={{ stroke: '#2A2E3B' }}
                  interval={Math.max(1, Math.floor(combinedData.length / 10))} />
                <YAxis tick={{ fill: '#8A92A6', fontSize: 10 }} tickLine={false} axisLine={false}
                  domain={[0, 10]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8A92A6' }} />
                <Line type="monotone" dataKey="mood" name="Mood"
                  stroke="#22C55E" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="stress" name="Stress"
                  stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Voice Notes */}
        <Card className="p-5">
          <CardHeader>
            <CardTitle className="text-sm">Voice Notes</CardTitle>
            <span className="text-text-secondary text-xs">AI-transcribed and analysed</span>
          </CardHeader>
          {notesLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Shimmer key={i} className="h-16 rounded" />)}
            </div>
          ) : !voiceNotes?.length ? (
            <div className="py-10 text-center text-text-secondary">
              <Mic size={28} className="mx-auto mb-2" />
              <p className="text-sm">No voice notes yet.</p>
              <p className="text-xs mt-1">POST an audio file to <code className="bg-bg-elevated px-1 rounded">/api/v1/ingest/voice-note</code></p>
            </div>
          ) : (
            <div className="space-y-3">
              {voiceNotes.map(note => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-bg-elevated rounded border border-border-subtle"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-secondary text-xs">
                      {format(new Date(note.ts), 'MMM d, yyyy · h:mm a')}
                    </span>
                    {note.sentiment && (
                      <span className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                          color: SENTIMENT_COLOR[note.sentiment] ?? '#8A92A6',
                          borderColor: (SENTIMENT_COLOR[note.sentiment] ?? '#8A92A6') + '40',
                          background: (SENTIMENT_COLOR[note.sentiment] ?? '#8A92A6') + '12',
                        }}>
                        {note.sentiment}
                      </span>
                    )}
                  </div>
                  {note.summary ? (
                    <p className="text-text-primary text-xs leading-relaxed">{note.summary}</p>
                  ) : note.transcript ? (
                    <p className="text-text-secondary text-xs italic leading-relaxed line-clamp-3">{note.transcript}</p>
                  ) : null}
                  {note.themes?.length ? (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {note.themes.map((t, i) => (
                        <span key={i} className="text-xs bg-bg-base text-text-secondary px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        <p className="safety-footer text-center">
          Mood and stress data are self-reported. For mental health concerns, consult a qualified professional.
        </p>
      </div>
    </Shell>
  )
}
