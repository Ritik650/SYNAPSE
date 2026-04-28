import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  elevated?: boolean
  onClick?: () => void
}

export function Card({ children, className, elevated, onClick }: CardProps) {
  return (
    <div
      className={cn(elevated ? 'card-elevated' : 'card', 'p-4', onClick && 'cursor-pointer hover:border-border-subtle/80 transition-colors', className)}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-text-primary font-medium text-sm', className)}>
      {children}
    </h3>
  )
}
