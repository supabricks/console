import { useState } from 'react'
import { ArrowDown, ArrowUp, KeyRound, Link2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { Row } from '@/lib/data'
import { cn } from '@/lib/utils'
import { copy } from './common'

export type GridColumn = { name: string; type: string; pk?: boolean; fk?: string }
export type Sort = { col: string; dir: 'asc' | 'desc' } | null

const NUMERIC = /int|numeric|decimal|double|real/

function Cell({ v }: { v: Row[string] }) {
  if (v === null) return <span className="rounded bg-muted px-1 text-[11px] font-medium text-muted-foreground">NULL</span>
  if (v === '') return <span className="text-muted-foreground">(empty string)</span>
  if (typeof v === 'boolean') return <span className={v ? 'text-success' : 'text-muted-foreground'}>{String(v)}</span>
  return <>{String(v)}</>
}

/**
 * Typed data grid. With `onEdit` it becomes editable: double-click a cell,
 * Enter to keep the change, Escape to drop it. Edits are reported, not applied.
 */
export function DataGrid({ columns, rows, sort, onSort, onEdit, dirty, selected, onSelect, rowKey, deleted, className }: {
  columns: GridColumn[]
  rows: Row[]
  sort?: Sort
  onSort?: (s: Sort) => void
  onEdit?: (rowId: string, col: string, value: string | null) => void
  dirty?: Set<string>
  selected?: Set<string>
  onSelect?: (s: Set<string>) => void
  rowKey?: (r: Row, i: number) => string
  deleted?: Set<string>
  className?: string
}) {
  const [editing, setEditing] = useState<{ id: string; col: string; value: string } | null>(null)
  const keyOf = rowKey ?? ((_: Row, i: number) => String(i))
  const commit = () => { if (editing && onEdit) onEdit(editing.id, editing.col, editing.value === '' ? null : editing.value); setEditing(null) }
  const allIds = rows.map(keyOf)

  return (
    <div className={cn('min-h-0 overflow-auto', className)}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {onSelect && (
              <th className="w-9 border-r border-b px-2">
                <Checkbox aria-label="Select all rows" checked={!!selected?.size && selected.size === rows.length} onCheckedChange={(c) => onSelect(new Set(c ? allIds : []))} />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.name} className="border-r border-b px-3 py-1.5 text-left font-medium whitespace-nowrap">
                <button className="flex w-full items-center gap-1.5" onClick={() => onSort?.(sort?.col !== c.name ? { col: c.name, dir: 'asc' } : sort.dir === 'asc' ? { col: c.name, dir: 'desc' } : null)}>
                  {c.pk && <KeyRound className="size-3 text-warning" aria-label="Primary key" />}
                  {c.fk && <Link2 className="size-3 text-info" aria-label={`References ${c.fk}`} />}
                  <span>{c.name}</span>
                  <span className="font-mono text-[11px] font-normal text-muted-foreground">{c.type}</span>
                  {sort?.col === c.name && (sort.dir === 'asc' ? <ArrowUp className="ml-auto size-3" /> : <ArrowDown className="ml-auto size-3" />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const id = keyOf(r, i)
            const gone = deleted?.has(id)
            return (
              <tr key={id} className={cn('group', selected?.has(id) && 'bg-primary/8', gone && 'bg-destructive/8 line-through opacity-60')}>
                {onSelect && (
                  <td className="border-r border-b px-2 text-center">
                    <Checkbox aria-label={`Select row ${id}`} checked={selected?.has(id) ?? false} onCheckedChange={(c) => { const n = new Set(selected); if (c) n.add(id); else n.delete(id); onSelect(n) }} />
                  </td>
                )}
                {columns.map((c) => {
                  const isEditing = editing?.id === id && editing.col === c.name
                  const isDirty = dirty?.has(`${id}:${c.name}`)
                  return (
                    <td
                      key={c.name}
                      className={cn('max-w-80 border-r border-b px-3 py-1 font-mono whitespace-nowrap group-hover:bg-muted/40', NUMERIC.test(c.type) && 'tabular text-right', isDirty && 'bg-warning/12! shadow-[inset_2px_0_0_var(--warning)]', isEditing && 'p-0')}
                      onDoubleClick={() => (onEdit && !gone && !c.pk ? setEditing({ id, col: c.name, value: r[c.name] === null ? '' : String(r[c.name]) }) : copy(String(r[c.name]), 'Cell copied'))}
                      title={onEdit ? (c.pk ? 'Primary key columns cannot be edited here' : 'Double-click to edit') : 'Double-click to copy'}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          aria-label={`Edit ${c.name}`}
                          className="w-full min-w-32 bg-background px-3 py-1 font-mono outline-2 outline-primary"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onBlur={commit}
                          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(null) }}
                        />
                      ) : (
                        <div className="truncate"><Cell v={r[c.name]} /></div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
