import { cn } from '../../lib/utils'

export function LoadingDot({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  )
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn('shimmer rounded-md', className)} />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-64">
      <LoadingDot />
    </div>
  )
}
