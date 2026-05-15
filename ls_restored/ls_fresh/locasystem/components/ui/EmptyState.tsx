// Estado vazio padrão
interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon = '📋', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4 opacity-30">{icon}</div>
      <h3 className="font-bold text-gray-500 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
