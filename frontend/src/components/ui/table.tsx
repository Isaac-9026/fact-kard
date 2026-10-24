import * as React from 'react'
import { cn } from '../../lib/utils'

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xs">
      <table ref={ref} className={cn('w-full caption-bottom text-xs text-left border-collapse', className)} {...props} />
    </div>
  )
)
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500 select-none', className)} {...props} />
  )
)
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-slate-100 text-slate-700', className)} {...props} />
  )
)
TableBody.displayName = 'TableBody'

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('border-t border-slate-200 bg-slate-50/80 font-medium text-slate-900', className)} {...props} />
  )
)
TableFooter.displayName = 'TableFooter'

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('hover:bg-slate-50/80 transition-colors border-b border-slate-100/80 last:border-0', className)}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }>(
  ({ className, numeric, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-9 px-3.5 py-2 align-middle font-semibold text-slate-600',
        numeric && 'text-right',
        className
      )}
      {...props}
    />
  )
)
TableHead.displayName = 'TableHead'

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }>(
  ({ className, numeric, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        'px-3.5 py-2.5 align-middle text-slate-700',
        numeric && 'text-right font-mono tabular-nums',
        className
      )}
      {...props}
    />
  )
)
TableCell.displayName = 'TableCell'
