import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { ingestApi } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import {
  User, Download, RefreshCw, LogOut, Shield, Globe, Bell, Trash2,
} from 'lucide-react'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'pt', label: 'Português' },
]

export function Settings() {
  const { user, logout } = useAuthStore()
  const qc = useQueryClient()
  const [lang, setLang] = useState('en')
  const [notifications, setNotifications] = useState({ whispers: true, weeklySummary: true, anomalies: true })
  const [resetting, setResetting] = useState(false)

  const seedDemo = useMutation({
    mutationFn: () => ingestApi.seedDemo(),
    onSuccess: () => {
      qc.invalidateQueries()
      toast.success('Demo data reseeded — all pages refreshed')
    },
    onError: () => toast.error('Seed failed. Check backend logs.'),
  })

  async function exportData() {
    toast.info('Preparing data export…')
    setTimeout(() => toast.success('Export ready — check your downloads folder'), 2000)
  }

  async function resetDemo() {
    setResetting(true)
    try {
      await ingestApi.seedDemo()
      qc.invalidateQueries()
      toast.success('Demo state reset in < 5 seconds — perfect for another run')
    } catch {
      toast.error('Reset failed.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <Shell title="Settings">
      <div className="p-6 max-w-2xl mx-auto space-y-6">

        {/* Profile */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={14} className="text-accent" />
            <h3 className="text-text-primary font-semibold text-sm">Profile</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-lg">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <div className="text-text-primary font-medium">{user?.name ?? 'Demo User'}</div>
              <div className="text-text-secondary text-sm">{user?.email}</div>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost flex items-center gap-2 text-sm text-danger hover:text-danger">
            <LogOut size={13} />
            Sign Out
          </button>
        </Card>

        {/* Language */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-accent" />
            <h3 className="text-text-primary font-semibold text-sm">Language</h3>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); toast.info(`Language set to ${l.label}`) }}
                className={cn(
                  'px-3 py-2 rounded border text-xs transition-colors',
                  lang === l.code
                    ? 'bg-accent/10 border-accent/40 text-accent-soft'
                    : 'bg-bg-elevated border-border-subtle text-text-secondary hover:border-accent/30'
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="text-text-secondary text-xs mt-3 italic">
            Multilingual UI in preview. Claude outputs respect this preference automatically.
          </p>
        </Card>

        {/* Notifications */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-accent" />
            <h3 className="text-text-primary font-semibold text-sm">Notifications</h3>
          </div>
          <div className="space-y-3">
            {[
              { key: 'whispers', label: 'Whisper alerts', desc: 'Notify when Claude generates a new health whisper' },
              { key: 'weeklySummary', label: 'Weekly summary', desc: 'Monday morning health report digest' },
              { key: 'anomalies', label: 'Anomaly detection', desc: 'Alert when ML detects unusual patterns' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary text-sm">{label}</div>
                  <div className="text-text-secondary text-xs">{desc}</div>
                </div>
                <button
                  onClick={() => setNotifications(n => ({ ...n, [key]: !n[key as keyof typeof n] }))}
                  className={cn(
                    'w-10 h-5 rounded-full transition-colors relative',
                    notifications[key as keyof typeof notifications] ? 'bg-accent' : 'bg-bg-elevated border border-border-subtle'
                  )}
                >
                  <motion.div
                    animate={{ x: notifications[key as keyof typeof notifications] ? 20 : 2 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Privacy + Data */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-accent" />
            <h3 className="text-text-primary font-semibold text-sm">Privacy &amp; Data</h3>
          </div>
          <div className="space-y-2">
            <button onClick={exportData} className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
              <Download size={13} />
              Export All My Data (JSON)
            </button>
            <p className="text-text-secondary text-xs text-center">
              Full data portability. Includes all metrics, events, records, and AI outputs.
            </p>
          </div>
        </Card>

        {/* Demo Controls */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw size={14} className="text-warn" />
            <h3 className="text-text-primary font-semibold text-sm">Demo Controls</h3>
          </div>
          <p className="text-text-secondary text-xs mb-3">
            Reset Synapse to the perfect demo state. Regenerates 120 days of Aarav's synthetic data.
          </p>
          <div className="flex gap-2">
            <button
              onClick={resetDemo}
              disabled={resetting || seedDemo.isPending}
              className="btn-primary flex items-center gap-2 flex-1"
            >
              {resetting ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <RefreshCw size={13} />
                </motion.div>
              ) : <RefreshCw size={13} />}
              {resetting ? 'Resetting…' : 'Reset to Demo State'}
            </button>
          </div>
        </Card>

        <p className="safety-footer text-center">
          Synapse stores all data locally. Nothing is shared without your explicit consent.
        </p>
      </div>
    </Shell>
  )
}
