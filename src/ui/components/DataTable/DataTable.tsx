import {
  forwardRef,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react'
import { cn } from '@ui/cn'
import styles from './DataTable.module.css'

interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  density?: 'default' | 'compact'
  wrapperClassName?: string
}

export const DataTable = forwardRef<HTMLTableElement, DataTableProps>(function DataTable(
  { className, density = 'default', wrapperClassName, ...props },
  ref,
) {
  return (
    <div className={cn(styles.wrapper, wrapperClassName)}>
      <table
        ref={ref}
        className={cn(styles.table, density === 'compact' && styles.compactTable, className)}
        data-density={density}
        {...props}
      />
    </div>
  )
})

export function DataTableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />
}

export function DataTableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}

export function DataTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn(styles.row, className)} {...props} />
}

export function DataTableHeader({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn(styles.headerCell, className)} {...props} />
}

export function DataTableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(styles.cell, className)} {...props} />
}
