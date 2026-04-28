import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Shell } from '../components/layout/Shell'
import { Card } from '../components/ui/Card'
import { Shimmer } from '../components/ui/LoadingSpinner'
import { careCircleApi } from '../lib/api'
import { toast } from '../lib/toast'
import { cn } from '../lib/utils'
import { Users, Plus, X, Shield, FlaskConical, Activity, Pill, MessageSquare } from 'lucide-react'

interface Member {
  id: string
  email: string
  name: string
  role: string
  status: string
  share_labs: boolean
  share_vitals: boolean
  share_medications: boolean
  share_symptoms: boolean
  invited_at: string | null
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  supporter: { label: 'Supporter', color: 'text-accent-soft bg-accent/10 border-accent/20' },
  clinician: { label: 'Clinician', color: 'text-success bg-success/10 border-success/20' },
  family: { label: 'Family', color: 'text-warn bg-warn/10 border-warn/20' },
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-warn',
  accepted: 'text-success',
  declined: 'text-danger',
}

function ShareToggle({
  label, icon: Icon, value, onChange,
}: { label: string; icon: React.ElementType; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors',
        value
          ? 'bg-success/10 border-success/30 text-success'
          : 'bg-bg-elevated border-border-subtle text-text-secondary hover:border-accent/30'
      )}
    >
      <Icon size={10} />
      {label}
    </button>
  )
}

function MemberCard({ member }: { member: Member }) {
  const qc = useQueryClient()
  const [sharing, setSharing] = useState({
    share_labs: member.share_labs,
    share_vitals: member.share_vitals,
    share_medications: member.share_medications,
    share_symptoms: member.share_symptoms,
  })

  const updateSharing = useMutation({
    mutationFn: (newSharing: typeof sharing) =>
      careCircleApi.updateSharing(member.id, newSharing),
    onSuccess: () => toast.success('Sharing preferences saved'),
    onError: () => toast.error('Failed to update sharing'),
  })

  const remove = useMutation({
    mutationFn: () => careCircleApi.remove(member.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['care-circle'] })
      toast.success(`${member.name} removed from care circle`)
    },
  })

  function handleToggle(key: keyof typeof sharing, val: boolean) {
    const next = { ...sharing, [key]: val }
    setSharing(next)
    updateSharing.mutate(next)
  }

  const roleInfo = ROLE_LABELS[member.role] ?? ROLE_LABELS.supporter

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 border border-border-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0 text-accent font-semibold text-sm">
            {member.name[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-text-primary font-medium text-sm">{member.name}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded border', roleInfo.color)}>
                {roleInfo.label}
              </span>
            </div>
            <div className="text-text-secondary text-xs">{member.email}</div>
            <div className={cn('text-xs mt-0.5', STATUS_COLOR[member.status] ?? 'text-text-secondary')}>
              {member.status === 'pending' ? 'Invitation pending' : member.status}
            </div>
          </div>
        </div>
        <button
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          className="text-text-secondary hover:text-danger transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-border-subtle">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-1">
          <Shield size={10} />
          Sharing with {member.name.split(' ')[0]}
        </div>
        <div className="flex flex-wrap gap-2">
          <ShareToggle label="Vitals" icon={Activity} value={sharing.share_vitals}
            onChange={v => handleToggle('share_vitals', v)} />
          <ShareToggle label="Labs" icon={FlaskConical} value={sharing.share_labs}
            onChange={v => handleToggle('share_labs', v)} />
          <ShareToggle label="Medications" icon={Pill} value={sharing.share_medications}
            onChange={v => handleToggle('share_medications', v)} />
          <ShareToggle label="Symptoms" icon={MessageSquare} value={sharing.share_symptoms}
            onChange={v => handleToggle('share_symptoms', v)} />
        </div>
      </div>
    </motion.div>
  )
}

export function CareCircle() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'supporter' })

  const { data: members, isLoading } = useQuery({
    queryKey: ['care-circle'],
    queryFn: () => careCircleApi.list().then(r => r.data as Member[]),
  })

  const invite = useMutation({
    mutationFn: () => careCircleApi.invite(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['care-circle'] })
      setShowForm(false)
      setForm({ name: '', email: '', role: 'supporter' })
      toast.success(`Invitation sent to ${form.email}`)
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Invite failed'),
  })

  return (
    <Shell title="Care Circle">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-text-secondary text-sm">
            Share your health journey with people who care about you.
          </p>
          <button
            onClick={() => setShowForm(s => !s)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={14} />
            Invite Someone
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
                  <h3 className="text-text-primary font-medium text-sm">Invite to Care Circle</h3>
                  <button onClick={() => setShowForm(false)}>
                    <X size={14} className="text-text-secondary" />
                  </button>
                </div>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email address"
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
                />
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="supporter">Supporter (friend / partner)</option>
                  <option value="family">Family member</option>
                  <option value="clinician">Clinician / Doctor</option>
                </select>
                <button
                  onClick={() => invite.mutate()}
                  disabled={!form.name || !form.email || invite.isPending}
                  className="btn-primary w-full"
                >
                  {invite.isPending ? 'Sending…' : 'Send Invitation'}
                </button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Shimmer key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : !members?.length ? (
          <div className="text-center py-16 text-text-secondary">
            <Users size={36} className="mx-auto mb-3" />
            <p className="text-sm">Your care circle is empty.</p>
            <p className="text-xs mt-1">Invite a family member, partner, or physician to share your health data.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(m => <MemberCard key={m.id} member={m} />)}
          </div>
        )}

        <p className="safety-footer text-center">
          You control exactly what each person can see. Invitees cannot modify your data.
        </p>
      </div>
    </Shell>
  )
}
