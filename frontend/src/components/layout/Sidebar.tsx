import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Clock, Zap, Brain, MessageSquare, Camera,
  Moon, Activity, FileText, Pill, Play, Stethoscope, Users,
  Settings, Heart
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/timeline', icon: Clock, label: 'Time Machine' },
  { to: '/patterns', icon: Zap, label: 'Patterns' },
  { to: '/whispers', icon: Heart, label: 'Whispers' },
  { to: '/body', icon: Brain, label: 'Body Twin' },
  { divider: true },
  { to: '/sleep', icon: Moon, label: 'Sleep Lab' },
  { to: '/recovery', icon: Activity, label: 'Recovery' },
  { to: '/mind', icon: Brain, label: 'Mind' },
  { to: '/meals', icon: Camera, label: 'Meals' },
  { to: '/symptoms', icon: MessageSquare, label: 'Symptoms' },
  { to: '/labs', icon: FileText, label: 'Labs' },
  { to: '/medications', icon: Pill, label: 'Medications' },
  { divider: true },
  { to: '/simulate', icon: Play, label: 'Simulator' },
  { to: '/doctor', icon: Stethoscope, label: 'Doctor Mode' },
  { to: '/care-circle', icon: Users, label: 'Care Circle' },
  { divider: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="w-56 h-screen bg-bg-surface border-r border-border-subtle flex flex-col sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-accent flex items-center justify-center">
            <span className="text-white font-mono text-xs font-medium">S</span>
          </div>
          <span className="font-semibold text-text-primary tracking-tight">Synapse</span>
        </div>
        <p className="text-text-secondary text-xs mt-1 ml-9">Health Intelligence</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item, i) => {
          if ('divider' in item) {
            return <div key={i} className="border-t border-border-subtle my-2" />
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-200 group',
                  isActive
                    ? 'bg-accent/10 text-accent-soft'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={16}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'
                    )}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Medical disclaimer footer */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <p className="text-text-secondary text-xs leading-tight">
          Informational only. Not a medical device. Consult a clinician for decisions.
        </p>
      </div>
    </aside>
  )
}
