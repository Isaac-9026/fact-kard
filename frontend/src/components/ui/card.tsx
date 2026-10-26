import * as React from 'react'
import { cn } from '../../lib/utils'

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      // min-w-0: dentro de un grid/flex, una tabla ancha no estira la tarjeta (la tabla se desplaza dentro).
      className={cn('min-w-0 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xs transition-shadow', className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5 border-b border-slate-100/80', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold text-base leading-none tracking-tight text-slate-900', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-slate-500 mt-1', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5', className)} {...props} />
)
CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-5 pt-0 border-t border-slate-100/80 mt-2', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export interface KpiCardProps {
  title: string
  value: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>
  badge?: React.ReactNode
  className?: string
  trend?: {
    value: string
    positive?: boolean
  }
}

export function KpiCard({ title, value, subtitle, icon, badge, className, trend }: KpiCardProps) {
  const renderIcon = () => {
    if (!icon) return null
    if (React.isValidElement(icon)) return icon
    const IconComponent = icon as React.ComponentType<{ className?: string }>
    return <IconComponent className="h-4 w-4" />
  }

  return (
    <Card className={cn('overflow-hidden relative border-slate-200 shadow-xs hover:border-slate-300 transition-colors', className)}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase truncate">{title}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {badge}
            {icon && (
              <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
                {renderIcon()}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-slate-900 truncate">
            {value}
          </div>
          {trend && (
            <span className={cn('text-xs font-medium font-mono', trend.positive ? 'text-emerald-600' : 'text-rose-600')}>
              {trend.positive ? '+' : ''}{trend.value}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
    </Card>
  )
}
