import { Shell } from '../components/layout/Shell'
import { Construction } from 'lucide-react'

interface Props {
  title: string
  description?: string
}

export function Placeholder({ title, description }: Props) {
  return (
    <Shell title={title}>
      <div className="flex flex-col items-center justify-center h-full min-h-96 p-6 text-center">
        <Construction size={40} className="text-text-secondary mb-4" />
        <h2 className="text-text-primary font-medium text-lg mb-2">{title}</h2>
        <p className="text-text-secondary text-sm max-w-sm">
          {description ?? `This page will be built in upcoming stages. The full ${title} feature is planned.`}
        </p>
      </div>
    </Shell>
  )
}
