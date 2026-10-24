import * as React from 'react'
import { cn } from '../../lib/utils'

export interface PageHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  icon,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  const renderIcon = () => {
    if (!icon) return null
    if (React.isValidElement(icon)) return icon
    const IconComponent = icon as React.ComponentType<{ className?: string }>
    return <IconComponent className="h-5 w-5" />
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 mb-6',
        className
      )}
    >
      <div className="flex items-start gap-3.5">
        {icon && (
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs mt-0.5">
            {renderIcon()}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{actions}</div>}
    </div>
  )
}
