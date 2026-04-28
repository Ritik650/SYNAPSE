import { format } from 'date-fns'
import { Bell, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

export function Topbar({ title }: { title?: string }) {
  const { user, logout } = useAuthStore()
  const today = format(new Date(), 'EEEE, MMMM d')

  return (
    <header className="h-14 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between px-6">
      <div>
        {title && <h1 className="text-text-primary font-medium text-sm">{title}</h1>}
        <p className="text-text-secondary text-xs">{today}</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-ghost p-2">
          <Bell size={16} />
        </button>
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-accent-soft text-xs font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-text-secondary text-sm hidden md:block">{user.name}</span>
            <button onClick={logout} className="btn-ghost p-2" title="Logout">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
